-- replica/schema.sql — primeira migração (supabase/migrations/0001_init.sql)
-- Postgres 15+ no Supabase. Acesso: Row Level Security em todas as tabelas.
-- Convenções: uuid pk, timestamptz em UTC, dinheiro em centavos + moeda,
-- workspace_id em tudo que pertence a um cliente (multi-tenant).

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;    -- busca por nome/telefone

create schema if not exists private;        -- helpers fora da API pública

-- ---------------------------------------------------------------------------
-- utilitários
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------------------
-- tenant, usuários, equipes, papéis
-- ---------------------------------------------------------------------------
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  timezone text not null default 'America/Sao_Paulo',
  currency char(3) not null default 'BRL',
  locale text not null default 'pt-BR',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (                       -- espelho público de auth.users
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_path text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);
create index on teams (workspace_id);

-- rights: {"leads":{"view":"all|team|own|none","edit":"...","delete":"...","add":true,"export":false},
--          "contacts":{...},"companies":{...},"tasks":{...}}
create table roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  is_admin boolean not null default false,
  rights jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);
create index on roles (workspace_id);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete restrict,
  team_id uuid references teams(id) on delete set null,
  status text not null default 'active' check (status in ('active','deactivated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index on memberships (user_id);
create index on memberships (role_id);
create index on memberships (team_id);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role_id uuid not null references roles(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on invitations (workspace_id);
create unique index on invitations (workspace_id, lower(email)) where accepted_at is null;

-- ---------------------------------------------------------------------------
-- helpers de acesso (security definer: leem memberships sem recursão de RLS)
-- ---------------------------------------------------------------------------
create or replace function private.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships
                 where workspace_id = ws and user_id = auth.uid() and status = 'active')
$$;

create or replace function private.is_admin(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m join roles r on r.id = m.role_id
                 where m.workspace_id = ws and m.user_id = auth.uid()
                   and m.status = 'active' and r.is_admin)
$$;

-- escopo do usuário atual para uma entidade/ação: 'all' | 'team' | 'own' | 'none'
create or replace function private.scope(ws uuid, entity text, action text) returns text
language sql stable security definer set search_path = public as $$
  select case when r.is_admin then 'all'
              else coalesce(r.rights -> entity ->> action, 'none') end
  from memberships m join roles r on r.id = m.role_id
  where m.workspace_id = ws and m.user_id = auth.uid() and m.status = 'active'
$$;

-- o registro com responsável `owner` está no escopo do usuário atual?
create or replace function private.in_scope(ws uuid, entity text, action text, owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case private.scope(ws, entity, action)
    when 'all'  then true
    when 'own'  then owner = auth.uid()
    when 'team' then owner = auth.uid() or exists (
      select 1 from memberships me join memberships other
        on other.team_id = me.team_id and other.workspace_id = me.workspace_id
      where me.workspace_id = ws and me.user_id = auth.uid()
        and me.team_id is not null and other.user_id = owner)
    else false end
$$;

create or replace function private.can_add(ws uuid, entity text) returns boolean
language sql stable security definer set search_path = public as $$
  select private.is_admin(ws) or coalesce((
    select (r.rights -> entity ->> 'add')::boolean
    from memberships m join roles r on r.id = m.role_id
    where m.workspace_id = ws and m.user_id = auth.uid() and m.status = 'active'), false)
$$;

-- ---------------------------------------------------------------------------
-- funis e etapas
-- ---------------------------------------------------------------------------
create table pipelines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  sort int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on pipelines (workspace_id, sort);

create table stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  color text not null default 'slate',          -- nome de cor da paleta, não hex
  kind text not null default 'open' check (kind in ('open','won','lost')),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on stages (pipeline_id, sort);
create index on stages (workspace_id);
-- exatamente uma etapa de ganho e uma de perda por funil
create unique index stages_one_won  on stages (pipeline_id) where kind = 'won';
create unique index stages_one_lost on stages (pipeline_id) where kind = 'lost';

create table loss_reasons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

-- ---------------------------------------------------------------------------
-- campos personalizados (valores ficam em jsonb `custom` na entidade, chave = field id)
-- ---------------------------------------------------------------------------
create table field_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  entity text not null check (entity in ('lead','contact','company')),
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on field_groups (workspace_id, entity);

create table custom_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  entity text not null check (entity in ('lead','contact','company')),
  group_id uuid references field_groups(id) on delete set null,
  name text not null,
  kind text not null check (kind in ('text','textarea','number','money','select','multiselect',
                                    'date','datetime','checkbox','url','phone','email')),
  options jsonb not null default '[]',          -- [{id,label}] para select/multiselect
  is_required boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on custom_fields (workspace_id, entity, sort);
create index on custom_fields (group_id);

-- ---------------------------------------------------------------------------
-- empresas, contatos, identidades
-- ---------------------------------------------------------------------------
create table companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  responsible_user_id uuid references auth.users(id) on delete set null,
  custom jsonb not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on companies (workspace_id, updated_at desc);
create index on companies (responsible_user_id);
create index on companies using gin (name gin_trgm_ops);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  name text not null,
  responsible_user_id uuid references auth.users(id) on delete set null,
  avatar_url text,
  custom jsonb not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on contacts (workspace_id, updated_at desc);
create index on contacts (company_id);
create index on contacts (responsible_user_id);
create index on contacts using gin (name gin_trgm_ops);

-- telefones, emails e ids de canal (wa_id, igsid, psid, visitante do site).
-- usado para deduplicar quem manda mensagem.
create table contact_identities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  kind text not null check (kind in ('phone','email','whatsapp','instagram','messenger','telegram','webchat')),
  value text not null,                          -- normalizado: E.164, email minúsculo, id externo
  label text,                                   -- "celular", "trabalho"
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on contact_identities (contact_id);
create unique index contact_identities_unique on contact_identities (workspace_id, kind, value);
create index on contact_identities using gin (value gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  number bigint generated always as identity,   -- "Lead #123" quando sem nome
  name text not null default '',
  pipeline_id uuid not null references pipelines(id) on delete restrict,
  stage_id uuid not null references stages(id) on delete restrict,
  company_id uuid references companies(id) on delete set null,
  responsible_user_id uuid references auth.users(id) on delete set null,
  price_cents bigint not null default 0 check (price_cents >= 0),
  currency char(3) not null default 'BRL',
  loss_reason_id uuid references loss_reasons(id) on delete set null,
  source text,                                  -- 'whatsapp', 'site', 'manual', 'import'...
  channel_id uuid,                              -- fk adicionada após channels
  score int,
  custom jsonb not null default '{}',
  closed_at timestamptz,                        -- preenchido por trigger em won/lost
  stage_entered_at timestamptz not null default now(),
  closest_task_at timestamptz,                  -- mantido por trigger de tasks
  last_activity_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on leads (workspace_id, pipeline_id, stage_id, last_activity_at desc) where deleted_at is null;
create index on leads (stage_id);
create index on leads (company_id);
create index on leads (responsible_user_id);
create index on leads (loss_reason_id);
create index on leads (workspace_id, created_at desc);
create index on leads (workspace_id, closed_at) where closed_at is not null;
create index on leads (workspace_id, closest_task_at);
create index on leads using gin (custom jsonb_path_ops);
create index on leads using gin (name gin_trgm_ops);

create table lead_contacts (
  lead_id uuid not null references leads(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  is_main boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (lead_id, contact_id)
);
create index on lead_contacts (contact_id);
create unique index lead_contacts_one_main on lead_contacts (lead_id) where is_main;

create table lead_subscribers (
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lead_id, user_id)
);
create index on lead_subscribers (user_id);

-- ---------------------------------------------------------------------------
-- tags (tabelas de junção por entidade, para manter FKs reais)
-- ---------------------------------------------------------------------------
create table tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  color text not null default 'slate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);
create table lead_tags (
  lead_id uuid not null references leads(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  primary key (lead_id, tag_id)
);
create index on lead_tags (tag_id);
create table contact_tags (
  contact_id uuid not null references contacts(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  primary key (contact_id, tag_id)
);
create index on contact_tags (tag_id);

-- ---------------------------------------------------------------------------
-- tarefas
-- ---------------------------------------------------------------------------
create table task_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  icon text not null default 'check',           -- nome de ícone Lucide
  color text not null default 'slate',
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  task_type_id uuid references task_types(id) on delete set null,
  responsible_user_id uuid not null references auth.users(id) on delete restrict,
  text text not null default '',
  due_at timestamptz not null,
  all_day boolean not null default false,
  duration_minutes int check (duration_minutes is null or duration_minutes > 0),
  completed_at timestamptz,
  result_text text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_one_parent check (num_nonnulls(lead_id, contact_id, company_id) <= 1)
);
create index on tasks (workspace_id, responsible_user_id, due_at) where completed_at is null;
create index on tasks (lead_id);
create index on tasks (contact_id);
create index on tasks (company_id);
create index on tasks (task_type_id);

-- ---------------------------------------------------------------------------
-- feed: notas manuais + eventos do sistema
-- ---------------------------------------------------------------------------
create table notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text','call_in','call_out','attachment','system')),
  body text not null default '',
  params jsonb not null default '{}',
  is_pinned boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint note_one_parent check (num_nonnulls(lead_id, contact_id, company_id) = 1)
);
create index on notes (lead_id, created_at desc);
create index on notes (contact_id, created_at desc);
create index on notes (company_id, created_at desc);
create index on notes (workspace_id);

create table events (                          -- somente inserção, nunca editado
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  kind text not null check (kind in ('lead_created','stage_changed','responsible_changed','price_changed',
    'name_changed','field_changed','tag_added','tag_removed','contact_linked','contact_unlinked',
    'task_completed','won','lost','restored','automation_ran')),
  before jsonb,
  after jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,   -- null = sistema/automação
  created_at timestamptz not null default now()
);
create index on events (lead_id, created_at desc);
create index on events (contact_id, created_at desc);
create index on events (company_id, created_at desc);
create index on events (workspace_id, kind, created_at desc);       -- relatórios

create table files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  storage_path text not null unique,            -- bucket "attachments": {workspace_id}/{uuid}/{nome}
  name text not null,
  mime text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 104857600),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on files (workspace_id);

-- ---------------------------------------------------------------------------
-- canais, conversas, mensagens, leads de entrada
-- ---------------------------------------------------------------------------
create table channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null check (kind in ('whatsapp','instagram','messenger','telegram','webchat','email')),
  name text not null,
  external_id text,                             -- phone_number_id, page_id, ig_user_id...
  public_key text unique,                       -- webchat: chave pública do widget
  secret_id uuid,                               -- id no Supabase Vault (token de acesso). nunca em texto puro
  default_pipeline_id uuid references pipelines(id) on delete set null,
  status text not null default 'connecting' check (status in ('connecting','connected','error','disconnected')),
  status_detail text,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on channels (workspace_id);
create index on channels (default_pipeline_id);
create unique index channels_external on channels (kind, external_id) where external_id is not null;

alter table leads add constraint leads_channel_fk
  foreign key (channel_id) references channels(id) on delete set null;
create index on leads (channel_id);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  external_thread_id text not null,             -- wa_id do cliente, igsid, id do visitante
  status text not null default 'open' check (status in ('open','closed')),
  assigned_user_id uuid references auth.users(id) on delete set null,
  unread_count int not null default 0 check (unread_count >= 0),
  is_unanswered boolean not null default false,
  last_message_at timestamptz,
  last_inbound_at timestamptz,                  -- janela de 24h do WhatsApp
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, external_thread_id)
);
create index on conversations (workspace_id, status, last_message_at desc);
create index on conversations (contact_id);
create index on conversations (lead_id);
create index on conversations (assigned_user_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  direction text not null check (direction in ('in','out')),
  kind text not null default 'text' check (kind in ('text','image','audio','video','file','template','location','sticker','unsupported')),
  body text not null default '',
  file_id uuid references files(id) on delete set null,
  template_id uuid,                             -- fk adicionada após templates
  sender_user_id uuid references auth.users(id) on delete set null,
  external_id text,                             -- id da Meta etc. (dedup de webhook)
  client_id uuid,                               -- id otimista do navegador (dedup de duplo clique)
  status text not null default 'sent' check (status in ('queued','sent','delivered','read','failed','received')),
  error text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on messages (conversation_id, sent_at desc);
create index on messages (workspace_id);
create index on messages (file_id);
create index on messages (sender_user_id);
create unique index messages_external on messages (channel_id, external_id) where external_id is not null;
create unique index messages_client on messages (conversation_id, client_id) where client_id is not null;

create table incoming_leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  channel_id uuid references channels(id) on delete set null,
  conversation_id uuid references conversations(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  kind text not null check (kind in ('chat','call','email','form')),
  payload jsonb not null default '{}',          -- dados do formulário, prévia, etc.
  status text not null default 'pending' check (status in ('pending','accepted','declined','linked')),
  resolved_lead_id uuid references leads(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on incoming_leads (workspace_id, pipeline_id, created_at desc) where status = 'pending';
create index on incoming_leads (channel_id);
create index on incoming_leads (conversation_id);
create index on incoming_leads (contact_id);
create index on incoming_leads (resolved_lead_id);
-- uma pendência por conversa: o 2º, 3º... texto do mesmo desconhecido não cria outro card
create unique index incoming_one_pending on incoming_leads (conversation_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- modelos, automações, webhooks de saída
-- ---------------------------------------------------------------------------
create table templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null check (kind in ('chat','email','whatsapp')),
  name text not null,
  shortcut text,                                -- "/preco"
  subject text,
  body text not null,
  buttons jsonb not null default '[]',
  channel_id uuid references channels(id) on delete cascade,          -- obrigatório para whatsapp
  wa_name text,
  wa_language text,
  wa_status text check (wa_status in ('draft','pending','approved','rejected','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wa_needs_channel check (kind <> 'whatsapp' or channel_id is not null)
);
create index on templates (workspace_id, kind);
create index on templates (channel_id);
alter table messages add constraint messages_template_fk
  foreign key (template_id) references templates(id) on delete set null;
create index on messages (template_id);

create table automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  stage_id uuid not null references stages(id) on delete cascade,
  kind text not null check (kind in ('add_task','change_stage','add_tags','remove_tags','change_responsible',
                                    'complete_tasks','send_message','send_email','send_webhook','change_field')),
  run_on text not null default 'enter' check (run_on in ('enter','create','enter_or_create')),
  delay_seconds int not null default 0 check (delay_seconds between 0 and 2592000),
  conditions jsonb not null default '{}',
  params jsonb not null default '{}',
  is_active boolean not null default true,
  sort int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on automations (stage_id) where is_active;
create index on automations (pipeline_id);
create index on automations (workspace_id);

create table automation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  automation_id uuid not null references automations(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  trigger_event_id uuid not null references events(id) on delete cascade,
  depth int not null default 0 check (depth <= 5),                     -- trava de loop
  status text not null default 'scheduled' check (status in ('scheduled','running','done','skipped','failed')),
  run_at timestamptz not null,
  attempts int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (automation_id, trigger_event_id)                            -- idempotência
);
create index on automation_runs (status, run_at) where status = 'scheduled';
create index on automation_runs (lead_id);
create index on automation_runs (trigger_event_id);
create index on automation_runs (workspace_id);

create table webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  url text not null check (url ~ '^https://'),
  events text[] not null,
  signing_secret_id uuid not null,              -- Vault
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on webhook_endpoints (workspace_id);

-- webhooks recebidos (Meta, Stripe): grava primeiro, processa depois. dedup por id do provedor
create table inbound_webhooks (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('meta','stripe','telegram')),
  external_id text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);
create index on inbound_webhooks (created_at) where processed_at is null;

-- ---------------------------------------------------------------------------
-- notificações e cobrança
-- ---------------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('new_message','new_incoming','task_due','mention','assigned','system')),
  title text not null,
  link text,
  lead_id uuid references leads(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, created_at desc) where read_at is null;
create index on notifications (workspace_id);
create index on notifications (lead_id);

create table subscriptions (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  plan text not null default 'trial' check (plan in ('trial','basic','advanced','pro')),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','canceled','unpaid')),
  seats int not null default 1 check (seats >= 1),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- triggers de domínio
-- ---------------------------------------------------------------------------
do $$ declare t text; begin
  for t in select unnest(array['workspaces','profiles','teams','roles','memberships','invitations',
    'pipelines','stages','loss_reasons','field_groups','custom_fields','companies','contacts',
    'contact_identities','leads','tags','task_types','tasks','notes','files','channels','conversations',
    'messages','incoming_leads','templates','automations','automation_runs','webhook_endpoints','subscriptions'])
  loop
    execute format('create trigger touch before update on %I for each row execute function private.touch_updated_at()', t);
  end loop;
end $$;

-- etapa coerente com o funil; closed_at em ganho/perda; histórico em events
create or replace function private.leads_before() returns trigger
language plpgsql as $$
declare k text;
begin
  select kind into k from stages where id = new.stage_id and pipeline_id = new.pipeline_id;
  if k is null then raise exception 'stage % não pertence ao funil %', new.stage_id, new.pipeline_id; end if;
  if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    new.stage_entered_at := now();
    new.closed_at := case when k in ('won','lost') then now() else null end;
    if k <> 'lost' then new.loss_reason_id := null; end if;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
create trigger leads_before before insert or update on leads
  for each row execute function private.leads_before();

create or replace function private.leads_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into events (workspace_id, lead_id, kind, after, actor_user_id)
    values (new.workspace_id, new.id, 'lead_created', jsonb_build_object('stage_id', new.stage_id), auth.uid());
    return new;
  end if;
  if new.stage_id is distinct from old.stage_id then
    insert into events (workspace_id, lead_id, kind, before, after, actor_user_id)
    values (new.workspace_id, new.id, 'stage_changed',
            jsonb_build_object('stage_id', old.stage_id, 'pipeline_id', old.pipeline_id),
            jsonb_build_object('stage_id', new.stage_id, 'pipeline_id', new.pipeline_id), auth.uid());
  end if;
  if new.responsible_user_id is distinct from old.responsible_user_id then
    insert into events (workspace_id, lead_id, kind, before, after, actor_user_id)
    values (new.workspace_id, new.id, 'responsible_changed',
            jsonb_build_object('user_id', old.responsible_user_id),
            jsonb_build_object('user_id', new.responsible_user_id), auth.uid());
  end if;
  if new.price_cents is distinct from old.price_cents then
    insert into events (workspace_id, lead_id, kind, before, after, actor_user_id)
    values (new.workspace_id, new.id, 'price_changed',
            jsonb_build_object('price_cents', old.price_cents),
            jsonb_build_object('price_cents', new.price_cents), auth.uid());
  end if;
  if new.name is distinct from old.name then
    insert into events (workspace_id, lead_id, kind, before, after, actor_user_id)
    values (new.workspace_id, new.id, 'name_changed',
            jsonb_build_object('name', old.name), jsonb_build_object('name', new.name), auth.uid());
  end if;
  return new;
end $$;
create trigger leads_after after insert or update on leads
  for each row execute function private.leads_after();

-- leads.closest_task_at sempre igual ao menor prazo de tarefa aberta
create or replace function private.tasks_sync_lead() returns trigger
language plpgsql security definer set search_path = public as $$
declare lid uuid;
begin
  for lid in select distinct x from unnest(array[
      case when tg_op <> 'INSERT' then old.lead_id end,
      case when tg_op <> 'DELETE' then new.lead_id end]) x where x is not null
  loop
    update leads set closest_task_at =
      (select min(due_at) from tasks where lead_id = lid and completed_at is null)
    where id = lid;
  end loop;
  return null;
end $$;
create trigger tasks_sync_lead after insert or update of due_at, completed_at, lead_id or delete on tasks
  for each row execute function private.tasks_sync_lead();

-- nova conta de auth -> profile
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- workspaces / membros / config: membro lê, admin escreve
create policy ws_read  on workspaces for select using (private.is_member(id));
create policy ws_admin on workspaces for update using (private.is_admin(id));
-- criação de workspace via server action (service role) que também cria papel admin e membership.

create policy prof_read on profiles for select using (
  id = auth.uid() or exists (select 1 from memberships a join memberships b on a.workspace_id = b.workspace_id
                             where a.user_id = auth.uid() and b.user_id = profiles.id));
create policy prof_self on profiles for update using (id = auth.uid());

do $$ declare t text; begin
  for t in select unnest(array['teams','roles','memberships','pipelines','stages','loss_reasons',
                               'field_groups','custom_fields','tags','task_types','channels','templates',
                               'automations','webhook_endpoints'])
  loop
    execute format('create policy member_read on %I for select using (private.is_member(workspace_id))', t);
    execute format('create policy admin_write on %I for all using (private.is_admin(workspace_id)) with check (private.is_admin(workspace_id))', t);
  end loop;
end $$;
create policy invitations_admin on invitations for all
  using (private.is_admin(workspace_id)) with check (private.is_admin(workspace_id));
create policy subs_read on subscriptions for select using (private.is_admin(workspace_id));
-- subscriptions só é escrita pelo webhook do Stripe (service role).

-- leads / contatos / empresas: escopo por papel (all | team | own)
create policy leads_read on leads for select using (
  private.is_member(workspace_id) and private.in_scope(workspace_id, 'leads', 'view', responsible_user_id));
create policy leads_add on leads for insert with check (
  private.is_member(workspace_id) and private.can_add(workspace_id, 'leads'));
create policy leads_edit on leads for update using (
  private.in_scope(workspace_id, 'leads', 'edit', responsible_user_id))
  with check (private.is_member(workspace_id));
create policy leads_delete on leads for delete using (
  private.in_scope(workspace_id, 'leads', 'delete', responsible_user_id));

create policy contacts_read on contacts for select using (
  private.is_member(workspace_id) and private.in_scope(workspace_id, 'contacts', 'view', responsible_user_id));
create policy contacts_add on contacts for insert with check (
  private.is_member(workspace_id) and private.can_add(workspace_id, 'contacts'));
create policy contacts_edit on contacts for update using (
  private.in_scope(workspace_id, 'contacts', 'edit', responsible_user_id))
  with check (private.is_member(workspace_id));
create policy contacts_delete on contacts for delete using (
  private.in_scope(workspace_id, 'contacts', 'delete', responsible_user_id));

create policy companies_read on companies for select using (
  private.is_member(workspace_id) and private.in_scope(workspace_id, 'companies', 'view', responsible_user_id));
create policy companies_add on companies for insert with check (
  private.is_member(workspace_id) and private.can_add(workspace_id, 'companies'));
create policy companies_edit on companies for update using (
  private.in_scope(workspace_id, 'companies', 'edit', responsible_user_id))
  with check (private.is_member(workspace_id));
create policy companies_delete on companies for delete using (
  private.in_scope(workspace_id, 'companies', 'delete', responsible_user_id));

-- filhos herdam a visibilidade do pai (as subconsultas passam pelo RLS do pai)
create policy ci_all on contact_identities for all
  using (exists (select 1 from contacts c where c.id = contact_id))
  with check (exists (select 1 from contacts c where c.id = contact_id));
create policy lc_all on lead_contacts for all
  using (exists (select 1 from leads l where l.id = lead_id))
  with check (exists (select 1 from leads l where l.id = lead_id));
create policy ls_all on lead_subscribers for all
  using (exists (select 1 from leads l where l.id = lead_id))
  with check (exists (select 1 from leads l where l.id = lead_id));
create policy lt_all on lead_tags for all
  using (exists (select 1 from leads l where l.id = lead_id))
  with check (exists (select 1 from leads l where l.id = lead_id));
create policy ct_all on contact_tags for all
  using (exists (select 1 from contacts c where c.id = contact_id))
  with check (exists (select 1 from contacts c where c.id = contact_id));

-- tarefas: escopo próprio ('tasks'), mais quem vê o lead
create policy tasks_read on tasks for select using (
  private.is_member(workspace_id) and (responsible_user_id = auth.uid()
    or private.in_scope(workspace_id, 'tasks', 'view', responsible_user_id)));
create policy tasks_write on tasks for all using (
  responsible_user_id = auth.uid() or private.in_scope(workspace_id, 'tasks', 'edit', responsible_user_id))
  with check (private.is_member(workspace_id));

create policy notes_read on notes for select using (
  private.is_member(workspace_id) and (
    exists (select 1 from leads l where l.id = lead_id) or
    exists (select 1 from contacts c where c.id = contact_id) or
    exists (select 1 from companies co where co.id = company_id)));
create policy notes_add on notes for insert with check (
  created_by = auth.uid() and private.is_member(workspace_id) and (
    exists (select 1 from leads l where l.id = lead_id) or
    exists (select 1 from contacts c where c.id = contact_id) or
    exists (select 1 from companies co where co.id = company_id)));
create policy notes_own on notes for update using (created_by = auth.uid());
create policy notes_del on notes for delete using (created_by = auth.uid() or private.is_admin(workspace_id));

create policy events_read on events for select using (
  private.is_member(workspace_id) and (
    exists (select 1 from leads l where l.id = lead_id) or
    exists (select 1 from contacts c where c.id = contact_id) or
    exists (select 1 from companies co where co.id = company_id)));
-- events: sem insert/update/delete para clientes; só triggers (security definer) e service role.

create policy files_read on files for select using (private.is_member(workspace_id));
create policy files_add on files for insert with check (private.is_member(workspace_id) and uploaded_by = auth.uid());

-- conversas: visível se está atribuída a mim, ou se vejo o lead ou o contato
create policy conv_read on conversations for select using (
  private.is_member(workspace_id) and (assigned_user_id = auth.uid()
    or exists (select 1 from leads l where l.id = lead_id)
    or exists (select 1 from contacts c where c.id = contact_id)));
create policy conv_edit on conversations for update using (
  private.is_member(workspace_id) and (assigned_user_id = auth.uid()
    or exists (select 1 from leads l where l.id = lead_id)
    or exists (select 1 from contacts c where c.id = contact_id)));
create policy msg_read on messages for select using (
  exists (select 1 from conversations cv where cv.id = conversation_id));
-- mensagens de saída são inseridas pela server action (valida janela 24h e chama a API do canal).

create policy incoming_read on incoming_leads for select using (private.is_member(workspace_id));
-- aceitar/recusar/vincular: função rpc abaixo (atômica).

create policy runs_read on automation_runs for select using (private.is_admin(workspace_id));
create policy notif_own on notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- inbound_webhooks: sem políticas = só service role.

-- ---------------------------------------------------------------------------
-- RPC: aceitar lead de entrada (um vencedor em corrida)
-- ---------------------------------------------------------------------------
create or replace function public.accept_incoming_lead(p_incoming uuid, p_stage uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
-- security definer: quem aceita vira responsável do contato e da conversa, mesmo com escopo "own".
-- por isso as checagens de permissão são explícitas aqui.
declare il incoming_leads; st uuid; new_lead uuid;
begin
  select * into il from incoming_leads where id = p_incoming;
  if il.id is null or not private.is_member(il.workspace_id) then
    raise exception 'not_found' using errcode = 'P0002'; end if;
  if not private.can_add(il.workspace_id, 'leads') then raise exception 'forbidden' using errcode = '42501'; end if;

  update incoming_leads set status = 'accepted', resolved_by = auth.uid(), resolved_at = now()
  where id = p_incoming and status = 'pending'
  returning * into il;
  if il.id is null then raise exception 'already_resolved' using errcode = 'P0001'; end if;
  if p_stage is not null and not exists (select 1 from stages where id = p_stage and pipeline_id = il.pipeline_id) then
    raise exception 'bad_stage' using errcode = '22023'; end if;

  st := coalesce(p_stage, (select id from stages where pipeline_id = il.pipeline_id and kind = 'open'
                                                 order by sort limit 1));
  insert into leads (workspace_id, pipeline_id, stage_id, name, responsible_user_id, source, channel_id, created_by)
  values (il.workspace_id, il.pipeline_id, st, coalesce(il.payload ->> 'lead_name', ''), auth.uid(),
          il.kind, il.channel_id, auth.uid())
  returning id into new_lead;

  if il.contact_id is not null then
    update contacts set responsible_user_id = coalesce(responsible_user_id, auth.uid()) where id = il.contact_id;
    insert into lead_contacts (lead_id, contact_id, workspace_id, is_main) values (new_lead, il.contact_id, il.workspace_id, true);
  end if;
  if il.conversation_id is not null then
    update conversations set lead_id = new_lead, assigned_user_id = coalesce(assigned_user_id, auth.uid())
    where id = il.conversation_id;
  end if;
  update incoming_leads set resolved_lead_id = new_lead where id = il.id;
  return new_lead;
end $$;
revoke execute on function public.accept_incoming_lead(uuid, uuid) from public, anon;
grant execute on function public.accept_incoming_lead(uuid, uuid) to authenticated;
-- recusar / vincular seguem o mesmo padrão (decline_incoming_lead, link_incoming_lead) — ver architecture.md.

-- ---------------------------------------------------------------------------
-- Realtime: broadcast privado por workspace (escala melhor que postgres_changes com RLS)
-- canal "ws:{workspace_id}"; o cliente refaz a consulta (com RLS) ao receber o aviso.
-- ---------------------------------------------------------------------------
create or replace function private.broadcast_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  rec := coalesce(new, old);
  perform realtime.send(
    jsonb_build_object('table', tg_table_name, 'op', tg_op, 'id', rec.id),
    'change', 'ws:' || rec.workspace_id::text, true);
  return null;
end $$;
create trigger rt after insert or update or delete on leads         for each row execute function private.broadcast_change();
create trigger rt after insert or update or delete on conversations for each row execute function private.broadcast_change();
create trigger rt after insert or update            on messages      for each row execute function private.broadcast_change();
create trigger rt after insert or update            on incoming_leads for each row execute function private.broadcast_change();
create trigger rt after insert or update or delete on tasks         for each row execute function private.broadcast_change();

create policy rt_member on realtime.messages for select to authenticated using (
  realtime.topic() like 'ws:%' and private.is_member(substring(realtime.topic() from 4)::uuid));

-- ---------------------------------------------------------------------------
-- Storage: bucket privado "attachments", primeiro segmento do caminho = workspace_id
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 104857600) on conflict do nothing;
create policy att_read on storage.objects for select to authenticated using (
  bucket_id = 'attachments' and private.is_member((storage.foldername(name))[1]::uuid));
create policy att_write on storage.objects for insert to authenticated with check (
  bucket_id = 'attachments' and private.is_member((storage.foldername(name))[1]::uuid));
