-- netzer: setup completo do banco (Supabase)
-- Cole tudo no SQL Editor de um projeto NOVO e clique em Run, uma vez só.
-- Junta, em ordem: migrations/20261011000001_init.sql, 0002_rpcs.sql, 0003_profile_email.sql


-- =====================================================================
-- migrations/20261011000001_init.sql
-- =====================================================================

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

-- =====================================================================
-- migrations/20261011000002_rpcs.sql
-- =====================================================================

-- RPCs do app. Regras:
--  * security definer só quando a função precisa cruzar o RLS; aí ela checa permissão por conta própria;
--  * funções chamadas por webhook/visitante (receive_inbound, visitor_thread) só para service_role.

-- ---------------------------------------------------------------------------
-- criar workspace com tudo que o onboarding promete
-- ---------------------------------------------------------------------------
create or replace function public.create_workspace(p_name text, p_slug text, p_timezone text, p_currency text)
returns text language plpgsql security definer set search_path = public as $$
declare ws uuid; r_admin uuid; pid uuid; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  if p_slug in ('login','signup','onboarding','chat','design','api','_next') then
    raise exception 'slug_reserved' using errcode = '22023'; end if;
  if exists (select 1 from workspaces where slug = p_slug) then
    raise exception 'slug_taken' using errcode = '23505'; end if;

  insert into workspaces (name, slug, timezone, currency, created_by)
  values (p_name, p_slug, p_timezone, p_currency, uid) returning id into ws;

  insert into roles (workspace_id, name, is_admin, rights) values (ws, 'Admin', true, '{}') returning id into r_admin;
  insert into roles (workspace_id, name, rights) values
    (ws, 'Gerente', '{"leads":{"view":"all","edit":"all","delete":"team","add":true},"contacts":{"view":"all","edit":"all","delete":"team","add":true},"companies":{"view":"all","edit":"all","delete":"team","add":true},"tasks":{"view":"all","edit":"all"}}'),
    (ws, 'Vendedor', '{"leads":{"view":"own","edit":"own","delete":"none","add":true},"contacts":{"view":"own","edit":"own","delete":"none","add":true},"companies":{"view":"all","edit":"own","delete":"none","add":true},"tasks":{"view":"own","edit":"own"}}');
  insert into memberships (workspace_id, user_id, role_id) values (ws, uid, r_admin);

  insert into pipelines (workspace_id, name) values (ws, 'Vendas') returning id into pid;
  insert into stages (workspace_id, pipeline_id, name, color, kind, sort) values
    (ws, pid, 'Primeiro contato', '2', 'open', 0),
    (ws, pid, 'Qualificado', '4', 'open', 1),
    (ws, pid, 'Proposta enviada', '6', 'open', 2),
    (ws, pid, 'Negociação', '8', 'open', 3),
    (ws, pid, 'Ganho', 'won', 'won', 90),
    (ws, pid, 'Perdido', 'lost', 'lost', 91);
  insert into loss_reasons (workspace_id, name, sort) values
    (ws, 'Preço', 0), (ws, 'Escolheu concorrente', 1), (ws, 'Sem resposta', 2), (ws, 'Sem orçamento agora', 3);
  insert into task_types (workspace_id, name, sort) values
    (ws, 'Follow-up', 0), (ws, 'Ligação', 1), (ws, 'Reunião', 2), (ws, 'Enviar proposta', 3);
  insert into channels (workspace_id, kind, name, public_key, default_pipeline_id, status)
  values (ws, 'webchat', 'Chat do site', substr(replace(gen_random_uuid()::text, '-', ''), 1, 10), pid, 'connected');
  insert into subscriptions (workspace_id, plan, status, trial_ends_at) values (ws, 'trial', 'trialing', now() + interval '14 days');
  return p_slug;
end $$;

-- ---------------------------------------------------------------------------
-- leads de entrada: recusar e vincular (aceitar está na 0001)
-- ---------------------------------------------------------------------------
create or replace function public.decline_incoming_lead(p_incoming uuid)
returns void language plpgsql security definer set search_path = public as $$
declare il incoming_leads;
begin
  select * into il from incoming_leads where id = p_incoming;
  if il.id is null or not private.is_member(il.workspace_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  update incoming_leads set status = 'declined', resolved_by = auth.uid(), resolved_at = now()
  where id = p_incoming and status = 'pending' returning * into il;
  if il.id is null then raise exception 'already_resolved' using errcode = 'P0001'; end if;
  update conversations set status = 'closed' where id = il.conversation_id;
end $$;

create or replace function public.link_incoming_lead(p_incoming uuid, p_lead uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare il incoming_leads; target uuid; lead_ws uuid;
begin
  select * into il from incoming_leads where id = p_incoming;
  if il.id is null or not private.is_member(il.workspace_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  select workspace_id into lead_ws from leads where id = p_lead;
  if lead_ws is distinct from il.workspace_id
     or not private.in_scope(il.workspace_id, 'leads', 'edit', (select responsible_user_id from leads where id = p_lead)) then
    raise exception 'forbidden' using errcode = '42501'; end if;

  update incoming_leads set status = 'linked', resolved_lead_id = p_lead, resolved_by = auth.uid(), resolved_at = now()
  where id = p_incoming and status = 'pending' returning * into il;
  if il.id is null then raise exception 'already_resolved' using errcode = 'P0001'; end if;

  select contact_id into target from lead_contacts where lead_id = p_lead and is_main;
  if target is not null and il.contact_id is not null and target <> il.contact_id then
    -- mescla: identidades e conversas do desconhecido passam para o contato do lead
    update contact_identities ci set contact_id = target
      where ci.contact_id = il.contact_id
        and not exists (select 1 from contact_identities x where x.contact_id = target and x.kind = ci.kind and x.value = ci.value);
    update conversations set contact_id = target where contact_id = il.contact_id;
    update incoming_leads set contact_id = target where contact_id = il.contact_id;
    delete from contacts where id = il.contact_id;
  elsif target is null and il.contact_id is not null then
    insert into lead_contacts (lead_id, contact_id, workspace_id, is_main) values (p_lead, il.contact_id, il.workspace_id, true);
  end if;
  update conversations set lead_id = p_lead, assigned_user_id = coalesce(assigned_user_id, auth.uid()) where id = il.conversation_id;
  insert into events (workspace_id, lead_id, kind, after, actor_user_id)
  values (il.workspace_id, p_lead, 'contact_linked', jsonb_build_object('incoming_id', p_incoming), auth.uid());
  update leads set last_activity_at = now() where id = p_lead;
  return p_lead;
end $$;

-- ---------------------------------------------------------------------------
-- mensagem recebida (webhook da Meta ou chat do site). Mesmo caminho para todos os canais.
-- Idempotente: a mesma external_id não grava duas vezes.
-- ---------------------------------------------------------------------------
create or replace function public.receive_inbound(p_channel uuid, p_thread text, p_sender_name text, p_body text, p_external_id text)
returns uuid language plpgsql security definer set search_path = public as $$
declare ch channels; conv conversations; ct uuid; msg uuid; id_kind text; lead uuid; body text := left(btrim(p_body), 4000);
begin
  select * into ch from channels where id = p_channel and status = 'connected';
  if ch.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if body = '' then raise exception 'invalid' using errcode = '22023'; end if;
  id_kind := case ch.kind when 'messenger' then 'messenger' else ch.kind end;

  select * into conv from conversations where channel_id = ch.id and external_thread_id = p_thread;
  if conv.id is null then
    select contact_id into ct from contact_identities where workspace_id = ch.workspace_id and kind = id_kind and value = p_thread;
    if ct is null then
      insert into contacts (workspace_id, name)
      values (ch.workspace_id, coalesce(nullif(left(btrim(p_sender_name), 80), ''), 'Visitante ' || right(p_thread, 4)))
      returning id into ct;
      insert into contact_identities (workspace_id, contact_id, kind, value) values (ch.workspace_id, ct, id_kind, p_thread);
    end if;
    select lc.lead_id into lead from lead_contacts lc join leads l on l.id = lc.lead_id
      where lc.contact_id = ct and l.deleted_at is null order by l.last_activity_at desc limit 1;
    insert into conversations (workspace_id, channel_id, contact_id, lead_id, external_thread_id)
    values (ch.workspace_id, ch.id, ct, lead, p_thread)
    on conflict (channel_id, external_thread_id) do nothing;
    select * into conv from conversations where channel_id = ch.id and external_thread_id = p_thread;
  end if;

  insert into messages (workspace_id, conversation_id, channel_id, direction, body, external_id, status)
  values (ch.workspace_id, conv.id, ch.id, 'in', body, p_external_id, 'received')
  on conflict (channel_id, external_id) where external_id is not null do nothing
  returning id into msg;
  if msg is null then return null; end if; -- repetido

  update conversations set status = 'open', unread_count = unread_count + 1, is_unanswered = true,
    last_message_at = now(), last_inbound_at = now(), last_message_preview = left(body, 200)
  where id = conv.id;

  if conv.lead_id is not null then
    update leads set last_activity_at = now() where id = conv.lead_id;
  else
    update incoming_leads set payload = jsonb_set(payload, '{preview}', to_jsonb(left(body, 200)))
      where conversation_id = conv.id and status = 'pending';
    if not found then
      insert into incoming_leads (workspace_id, pipeline_id, channel_id, conversation_id, contact_id, kind, payload)
      values (ch.workspace_id,
              coalesce(ch.default_pipeline_id, (select id from pipelines where workspace_id = ch.workspace_id order by sort limit 1)),
              ch.id, conv.id, conv.contact_id, 'chat', jsonb_build_object('preview', left(body, 200)))
      on conflict (conversation_id) where status = 'pending' do nothing;
    end if;
  end if;
  return msg;
end $$;

create or replace function public.visitor_thread(p_key text, p_thread text)
returns table (id uuid, direction text, body text, sent_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.direction, m.body, m.sent_at
  from channels c
  join conversations cv on cv.channel_id = c.id and cv.external_thread_id = p_thread
  join messages m on m.conversation_id = cv.id
  where c.kind = 'webchat' and c.public_key = p_key
  order by m.sent_at
$$;

-- ---------------------------------------------------------------------------
-- enviar mensagem: o vendedor insere direto (RLS) e um trigger arruma a conversa
-- ---------------------------------------------------------------------------
create policy msg_send on messages for insert to authenticated with check (
  direction = 'out' and sender_user_id = auth.uid()
  and exists (select 1 from conversations cv where cv.id = conversation_id and cv.channel_id = messages.channel_id)
);

create or replace function private.after_outbound() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.direction = 'out' then
    update conversations set last_message_at = new.sent_at, last_message_preview = left(new.body, 200),
      is_unanswered = false, unread_count = 0, assigned_user_id = coalesce(assigned_user_id, new.sender_user_id)
    where id = new.conversation_id;
    update leads set last_activity_at = now()
    where id = (select lead_id from conversations where id = new.conversation_id);
  end if;
  return null;
end $$;
create trigger after_outbound after insert on messages for each row execute function private.after_outbound();

-- perdido exige motivo (a UI já pede; o banco garante)
create or replace function private.lost_needs_reason() returns trigger
language plpgsql as $$
begin
  if (select kind from stages where id = new.stage_id) = 'lost' and new.loss_reason_id is null then
    raise exception 'loss_reason_required' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger lost_needs_reason before insert or update of stage_id, loss_reason_id on leads
  for each row execute function private.lost_needs_reason();

-- ---------------------------------------------------------------------------
-- quem pode chamar o quê
-- ---------------------------------------------------------------------------
revoke execute on function public.create_workspace(text, text, text, text) from public, anon;
revoke execute on function public.decline_incoming_lead(uuid) from public, anon;
revoke execute on function public.link_incoming_lead(uuid, uuid) from public, anon;
grant execute on function public.create_workspace(text, text, text, text) to authenticated;
grant execute on function public.decline_incoming_lead(uuid) to authenticated;
grant execute on function public.link_incoming_lead(uuid, uuid) to authenticated;
revoke execute on function public.receive_inbound(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.visitor_thread(text, text) from public, anon, authenticated;
grant execute on function public.receive_inbound(uuid, text, text, text, text) to service_role;
grant execute on function public.visitor_thread(text, text) to service_role;

-- =====================================================================
-- migrations/20261011000003_profile_email.sql
-- =====================================================================

-- O app lista colegas com nome e email; auth.users não é exposto pela API.
alter table profiles add column if not exists email text;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

-- mantém o email em dia quando o usuário troca no Auth
create or replace function private.sync_user_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles set email = new.email where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email after update of email on auth.users
  for each row execute function private.sync_user_email();

update profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- FKs para profiles (além das que apontam para auth.users), para a API embutir nome e email
alter table memberships add constraint memberships_profile_fk foreign key (user_id) references profiles(id) on delete cascade;
alter table tasks add constraint tasks_responsible_profile_fk foreign key (responsible_user_id) references profiles(id) on delete restrict;
alter table contacts add constraint contacts_responsible_profile_fk foreign key (responsible_user_id) references profiles(id) on delete set null;

-- excluir a conta não pode travar por ter criado uma empresa que continua com outras pessoas
alter table workspaces alter column created_by drop not null;
alter table workspaces drop constraint workspaces_created_by_fkey;
alter table workspaces add constraint workspaces_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

-- ===== 20261015000004_robots.sql =====
-- Robôs de automação (estilo Salesbot + funil digital do Kommo).
-- Um robô = gatilho (etapa, lead novo, mensagem, primeiro contato) + lista de passos em jsonb.
-- Quem executa é o servidor com a chave secreta (age como "sistema"); a equipe só lê o histórico.

create table if not exists robots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  is_active boolean not null default true,
  trigger text not null check (trigger in ('stage_enter','lead_created','message_in','new_contact')),
  pipeline_id uuid references pipelines(id) on delete cascade,
  stage_id uuid references stages(id) on delete cascade,
  channels text[] not null default '{}',        -- vazio = todos os canais
  keywords text[] not null default '{}',        -- só para message_in
  once boolean not null default true,           -- uma vez por lead/conversa
  steps jsonb not null default '[]' check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 30),
  run_count int not null default 0,
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint robot_needs_stage check (trigger <> 'stage_enter' or stage_id is not null)
);
create index if not exists robots_ws_trigger on robots (workspace_id, trigger) where is_active;
create index if not exists robots_stage on robots (stage_id);
create index if not exists robots_pipeline on robots (pipeline_id);
create index if not exists robots_created_by on robots (created_by);

create table if not exists robot_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  robot_id uuid not null references robots(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete cascade,
  step int not null default 0,
  depth int not null default 0 check (depth <= 5),                  -- trava de laço
  status text not null default 'waiting' check (status in ('waiting','running','done','failed')),
  run_at timestamptz not null default now(),
  log jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists robot_runs_due on robot_runs (run_at) where status = 'waiting';
create index if not exists robot_runs_robot_lead on robot_runs (robot_id, lead_id);
create index if not exists robot_runs_robot_conv on robot_runs (robot_id, conversation_id);
create index if not exists robot_runs_ws on robot_runs (workspace_id);
create index if not exists robot_runs_lead on robot_runs (lead_id);
create index if not exists robot_runs_conv on robot_runs (conversation_id);

drop trigger if exists touch on robots;
create trigger touch before update on robots for each row execute function private.touch_updated_at();
drop trigger if exists touch on robot_runs;
create trigger touch before update on robot_runs for each row execute function private.touch_updated_at();

alter table robots enable row level security;
alter table robot_runs enable row level security;

drop policy if exists member_read on robots;
drop policy if exists admin_write on robots;
create policy member_read on robots for select using (private.is_member(workspace_id));
create policy admin_write on robots for all using (private.is_admin(workspace_id)) with check (private.is_admin(workspace_id));

-- histórico: a equipe lê; só o servidor (service role) escreve
drop policy if exists member_read on robot_runs;
create policy member_read on robot_runs for select using (private.is_member(workspace_id));

-- modelos de mensagem: atalho único por empresa
create unique index if not exists templates_shortcut on templates (workspace_id, shortcut) where shortcut is not null;

-- ---------------------------------------------------------------------------
-- chat interno da equipe
-- ---------------------------------------------------------------------------
create table if not exists team_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists team_messages_ws on team_messages (workspace_id, created_at desc);
create index if not exists team_messages_user on team_messages (user_id);
alter table team_messages enable row level security;
drop policy if exists team_read on team_messages;
drop policy if exists team_send on team_messages;
create policy team_read on team_messages for select using (private.is_member(workspace_id));
create policy team_send on team_messages for insert to authenticated
  with check (user_id = auth.uid() and private.is_member(workspace_id));
drop trigger if exists rt on team_messages;
create trigger rt after insert on team_messages for each row execute function private.broadcast_change();

-- ---------------------------------------------------------------------------
-- disparos em massa (histórico; as mensagens em si vão para messages)
-- ---------------------------------------------------------------------------
create table if not exists broadcasts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  body text not null check (length(body) between 1 and 2000),
  filter jsonb not null default '{}',
  total int not null default 0,
  sent int not null default 0,
  failed int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists broadcasts_ws on broadcasts (workspace_id, created_at desc);
create index if not exists broadcasts_created_by on broadcasts (created_by);
alter table broadcasts enable row level security;
drop policy if exists bc_read on broadcasts;
drop policy if exists bc_send on broadcasts;
create policy bc_read on broadcasts for select using (private.is_member(workspace_id));
create policy bc_send on broadcasts for insert to authenticated
  with check (created_by = auth.uid() and private.is_member(workspace_id));

-- robôs: o painel atualiza sozinho quando um robô roda
drop trigger if exists rt on robot_runs;
create trigger rt after insert or update on robot_runs for each row execute function private.broadcast_change();

-- ===== 20261016000005_cadastro_teste.sql =====
-- Cadastro com CPF/CNPJ e trava do teste grátis.
-- - workspaces ganha tipo e número do documento e o WhatsApp de quem assina
-- - trial_claims guarda quem já usou os 14 dias: um por documento e um por email
--   (sobrevive à exclusão da empresa, para não dar para apagar e começar de novo)
-- - create_workspace confere o documento aqui no banco e só dá teste se for o 1º uso

alter table workspaces add column if not exists doc_type text check (doc_type in ('cpf','cnpj'));
alter table workspaces add column if not exists document text check (document ~ '^[0-9]{11}$|^[0-9]{14}$');
alter table workspaces add column if not exists phone text check (phone ~ '^[0-9]{10,13}$');
create index if not exists workspaces_document on workspaces (document);

create table if not exists trial_claims (
  kind text not null check (kind in ('document','email')),
  key text not null,                          -- documento (só dígitos) ou md5 do email em minúsculas
  workspace_id uuid references workspaces(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (kind, key)
);
create index if not exists trial_claims_ws on trial_claims (workspace_id);
alter table trial_claims enable row level security;   -- sem policy: só funções do banco e o servidor leem

-- dígitos verificadores de CPF (11) e CNPJ (14)
create or replace function private.valid_doc(d text) returns boolean
language plpgsql immutable as $$
declare s int; r int; i int; w int[];
begin
  if d is null or d !~ '^[0-9]+$' then return false; end if;
  if d ~ '^(.)\1+$' then return false; end if;           -- 000..., 111...
  if length(d) = 11 then
    s := 0; for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
    r := (s * 10) % 11; if r = 10 then r := 0; end if;
    if r <> substr(d, 10, 1)::int then return false; end if;
    s := 0; for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
    r := (s * 10) % 11; if r = 10 then r := 0; end if;
    return r = substr(d, 11, 1)::int;
  elsif length(d) = 14 then
    w := array[5,4,3,2,9,8,7,6,5,4,3,2];
    s := 0; for i in 1..12 loop s := s + substr(d, i, 1)::int * w[i]; end loop;
    r := s % 11; r := case when r < 2 then 0 else 11 - r end;
    if r <> substr(d, 13, 1)::int then return false; end if;
    w := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
    s := 0; for i in 1..13 loop s := s + substr(d, i, 1)::int * w[i]; end loop;
    r := s % 11; r := case when r < 2 then 0 else 11 - r end;
    return r = substr(d, 14, 1)::int;
  end if;
  return false;
end $$;

-- a versão antiga (sem documento) dava teste para qualquer um: sai de cena
drop function if exists public.create_workspace(text, text, text, text);

create or replace function public.create_workspace(
  p_name text, p_slug text, p_timezone text, p_currency text,
  p_doc_type text, p_document text, p_phone text default null
) returns text language plpgsql security definer set search_path = public as $$
declare ws uuid; r_admin uuid; pid uuid; uid uuid := auth.uid(); mail text; new_doc boolean; new_mail boolean; trial boolean; need_len int;
begin
  if uid is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  if p_slug in ('login','signup','onboarding','chat','design','api','_next','termos','privacidade','app') then
    raise exception 'slug_reserved' using errcode = '22023'; end if;
  if exists (select 1 from workspaces where slug = p_slug) then
    raise exception 'slug_taken' using errcode = '23505'; end if;
  p_document := regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g');
  need_len := case p_doc_type when 'cpf' then 11 when 'cnpj' then 14 else 0 end;
  if need_len = 0 or length(p_document) <> need_len or not private.valid_doc(p_document) then
    raise exception 'invalid_document' using errcode = '22023'; end if;
  p_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  select lower(email) into mail from auth.users where id = uid;

  insert into workspaces (name, slug, timezone, currency, created_by, doc_type, document, phone)
  values (p_name, p_slug, p_timezone, p_currency, uid, p_doc_type, p_document, p_phone) returning id into ws;

  -- teste grátis só no 1º uso do documento E do email
  insert into trial_claims (kind, key, workspace_id) values ('document', p_document, ws) on conflict do nothing;
  new_doc := found;
  insert into trial_claims (kind, key, workspace_id) values ('email', md5(coalesce(mail, uid::text)), ws) on conflict do nothing;
  new_mail := found;
  trial := new_doc and new_mail;

  insert into roles (workspace_id, name, is_admin, rights) values (ws, 'Admin', true, '{}') returning id into r_admin;
  insert into roles (workspace_id, name, rights) values
    (ws, 'Gerente', '{"leads":{"view":"all","edit":"all","delete":"team","add":true},"contacts":{"view":"all","edit":"all","delete":"team","add":true},"companies":{"view":"all","edit":"all","delete":"team","add":true},"tasks":{"view":"all","edit":"all"}}'),
    (ws, 'Vendedor', '{"leads":{"view":"own","edit":"own","delete":"none","add":true},"contacts":{"view":"own","edit":"own","delete":"none","add":true},"companies":{"view":"all","edit":"own","delete":"none","add":true},"tasks":{"view":"own","edit":"own"}}');
  insert into memberships (workspace_id, user_id, role_id) values (ws, uid, r_admin);

  insert into pipelines (workspace_id, name) values (ws, 'Vendas') returning id into pid;
  insert into stages (workspace_id, pipeline_id, name, color, kind, sort) values
    (ws, pid, 'Primeiro contato', '2', 'open', 0),
    (ws, pid, 'Qualificado', '4', 'open', 1),
    (ws, pid, 'Proposta enviada', '6', 'open', 2),
    (ws, pid, 'Negociação', '8', 'open', 3),
    (ws, pid, 'Ganho', 'won', 'won', 90),
    (ws, pid, 'Perdido', 'lost', 'lost', 91);
  insert into loss_reasons (workspace_id, name, sort) values
    (ws, 'Preço', 0), (ws, 'Escolheu concorrente', 1), (ws, 'Sem resposta', 2), (ws, 'Sem orçamento agora', 3);
  insert into task_types (workspace_id, name, sort) values
    (ws, 'Follow-up', 0), (ws, 'Ligação', 1), (ws, 'Reunião', 2), (ws, 'Enviar proposta', 3);
  insert into channels (workspace_id, kind, name, public_key, default_pipeline_id, status)
  values (ws, 'webchat', 'Chat do site', substr(replace(gen_random_uuid()::text, '-', ''), 1, 10), pid, 'connected');
  -- sem teste: trial_ends_at = agora, o painel já abre pedindo o plano
  insert into subscriptions (workspace_id, plan, status, trial_ends_at)
  values (ws, 'trial', 'trialing', case when trial then now() + interval '14 days' else now() end);
  return p_slug;
end $$;

revoke execute on function public.create_workspace(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_workspace(text, text, text, text, text, text, text) to authenticated;

-- situação de acesso da empresa, para qualquer membro (a tabela subscriptions só o admin lê)
create or replace function public.workspace_access(p_ws uuid)
returns table (plan text, status text, trial_ends_at timestamptz, current_period_end timestamptz)
language sql stable security definer set search_path = public as $$
  select s.plan, s.status, s.trial_ends_at, s.current_period_end
  from subscriptions s where s.workspace_id = p_ws and private.is_member(p_ws)
$$;
revoke execute on function public.workspace_access(uuid) from public, anon;
grant execute on function public.workspace_access(uuid) to authenticated, service_role;

-- ===== 20261016000006_utm.sql =====
-- Origem dos leads (UTMs, anúncios) sem depender de robô.
-- - conversations.attribution: de onde veio o 1º contato (link rastreável, script do site, chat do site, anúncio da Meta)
-- - leads.attribution: copiada da conversa quando o lead nasce ou é vinculado (trigger), editável à mão
-- - tracking_links + link_clicks: o "link rastreável de WhatsApp" (cada clique ganha um código curto que vai na mensagem)
-- - robots.conditions: filtro opcional do robô por UTM

alter table conversations add column if not exists attribution jsonb;
alter table leads add column if not exists attribution jsonb;
create index if not exists leads_utm_campaign on leads ((attribution ->> 'utm_campaign')) where attribution is not null;
create index if not exists leads_utm_source on leads ((attribution ->> 'utm_source')) where attribution is not null;

alter table robots add column if not exists conditions jsonb not null default '{}';

create table if not exists tracking_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  code text not null unique check (code ~ '^[a-z0-9]{6,12}$'),
  phone text not null check (phone ~ '^[0-9]{10,15}$'),
  message text not null default '' check (length(message) <= 500),
  defaults jsonb not null default '{}',              -- UTMs fixas do link (o clique pode sobrescrever)
  clicks int not null default 0,
  matched int not null default 0,                    -- cliques que viraram conversa
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tracking_links_ws on tracking_links (workspace_id);
create index if not exists tracking_links_created_by on tracking_links (created_by);

create table if not exists link_clicks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  link_id uuid not null references tracking_links(id) on delete cascade,
  ref text not null unique check (ref ~ '^[A-Z0-9]{5,8}$'),   -- código que vai na mensagem: "(ref: K7Q2M)"
  attribution jsonb not null default '{}',
  conversation_id uuid references conversations(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists link_clicks_ws on link_clicks (workspace_id, created_at desc);
create index if not exists link_clicks_link on link_clicks (link_id);
create index if not exists link_clicks_conv on link_clicks (conversation_id);

drop trigger if exists touch on tracking_links;
create trigger touch before update on tracking_links for each row execute function private.touch_updated_at();

alter table tracking_links enable row level security;
alter table link_clicks enable row level security;
drop policy if exists member_read on tracking_links;
drop policy if exists admin_write on tracking_links;
create policy member_read on tracking_links for select using (private.is_member(workspace_id));
create policy admin_write on tracking_links for all using (private.is_admin(workspace_id)) with check (private.is_admin(workspace_id));
drop policy if exists member_read on link_clicks;
create policy member_read on link_clicks for select using (private.is_member(workspace_id));   -- cliques: só o servidor grava

-- a origem da conversa passa para o lead (aceitar, vincular ou lead já existente), sem sobrescrever a que já existe
create or replace function private.conversation_attribution_to_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null and new.attribution is not null then
    update leads set attribution = new.attribution where id = new.lead_id and attribution is null;
  end if;
  return null;
end $$;
drop trigger if exists attribution_to_lead on conversations;
create trigger attribution_to_lead after insert or update of lead_id, attribution on conversations
  for each row execute function private.conversation_attribution_to_lead();

-- ---------------------------------------------------------------------------
-- modelos de mensagem por rede (regras e prévia por rede; categoria do WhatsApp)
-- ---------------------------------------------------------------------------
alter table templates add column if not exists network text not null default 'webchat'
  check (network in ('whatsapp','instagram','messenger','tiktok','webchat'));
alter table templates add column if not exists category text check (category in ('marketing','utility','authentication'));
alter table templates add column if not exists header text check (length(header) <= 60);
alter table templates add column if not exists footer text check (length(footer) <= 60);
-- o modelo de WhatsApp nasce como rascunho; o vínculo com o número vem quando o canal for conectado
alter table templates drop constraint if exists wa_needs_channel;

-- ===== 20261016000007_robo_fluxo.sql =====
-- Robôs com caminhos (botões, condição, esperar resposta, validação):
-- cada execução guarda o passo atual (cursor) e o que espera (state: tempo ou resposta, tentativas).
alter table robot_runs add column if not exists cursor text;
alter table robot_runs add column if not exists state jsonb not null default '{}';
create index if not exists robot_runs_waiting_reply on robot_runs (conversation_id)
  where status = 'waiting' and (state ->> 'wait') = 'reply';
-- até 60 passos por robô (antes 30)
alter table robots drop constraint if exists robots_steps_check;
alter table robots add constraint robots_steps_check check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 60);

-- marcações do calendário: etiqueta num dia, visível para a equipe
create table if not exists calendar_marks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  date date not null,
  label text not null check (length(label) between 1 and 60),
  color text not null default 'blue' check (color in ('blue','green','amber','red','purple','gray')),
  note text check (length(note) <= 500),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calendar_marks_ws_date on calendar_marks (workspace_id, date);
create index if not exists calendar_marks_created_by on calendar_marks (created_by);
drop trigger if exists touch on calendar_marks;
create trigger touch before update on calendar_marks for each row execute function private.touch_updated_at();
alter table calendar_marks enable row level security;
drop policy if exists marks_read on calendar_marks;
drop policy if exists marks_write on calendar_marks;
create policy marks_read on calendar_marks for select using (private.is_member(workspace_id));
create policy marks_write on calendar_marks for all to authenticated
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));

-- Canais da Meta conectados pelo próprio cliente (WhatsApp Cloud API, Instagram, Messenger).
-- O token fica cifrado (AES-256-GCM no servidor) numa tabela sem policy: só a chave secreta lê.
create table if not exists channel_secrets (
  channel_id uuid primary key references channels(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  token_enc text not null,
  updated_at timestamptz not null default now()
);
create index if not exists channel_secrets_ws on channel_secrets (workspace_id);
alter table channel_secrets enable row level security;

-- mensagens enviadas: erro da Meta guardado para mostrar ao vendedor
create index if not exists messages_outbox on messages (created_at) where status = 'queued' and direction = 'out';

-- Agente de IA (Claude): uma configuração por empresa. A base de conhecimento é o que a empresa escreve.
create table if not exists ai_agents (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  enabled boolean not null default false,
  name text not null default 'Assistente' check (char_length(name) between 1 and 40),
  tone text not null default 'amigavel' check (tone in ('amigavel', 'formal', 'direto')),
  instructions text not null default '' check (char_length(instructions) <= 4000),
  knowledge text not null default '' check (char_length(knowledge) <= 30000),
  channels text[] not null default '{webchat,whatsapp,instagram,messenger}',
  handoff_message text not null default 'Vou chamar alguém da equipe para continuar com você. Só um instante!' check (char_length(handoff_message) between 1 and 300),
  updated_at timestamptz not null default now()
);
alter table ai_agents enable row level security;
drop policy if exists ai_agents_read on ai_agents;
drop policy if exists ai_agents_write on ai_agents;
create policy ai_agents_read on ai_agents for select using (private.is_member(workspace_id));
create policy ai_agents_write on ai_agents for all to authenticated
  using (private.is_admin(workspace_id)) with check (private.is_admin(workspace_id));

-- conversa pausada para a IA (um vendedor assumiu ou a IA passou para humano) e mensagens escritas pela IA
alter table conversations add column if not exists ai_paused boolean not null default false;
alter table messages add column if not exists by_ai boolean not null default false;

-- Foto de perfil de cada pessoa e logo da empresa. A imagem chega já reduzida (160px, webp/jpeg) como data URL.
alter table profiles add column if not exists avatar text;
alter table profiles drop constraint if exists profiles_avatar_check;
alter table profiles add constraint profiles_avatar_check check (avatar is null or (char_length(avatar) <= 200000 and avatar ~ '^data:image/(webp|jpeg|png);base64,'));

alter table workspaces add column if not exists logo text;
alter table workspaces drop constraint if exists workspaces_logo_check;
alter table workspaces add constraint workspaces_logo_check check (logo is null or (char_length(logo) <= 200000 and logo ~ '^data:image/(webp|jpeg|png);base64,'));

-- Canal desconectado não prende mais o número: outra empresa pode conectar a mesma conta depois.
-- O índice único passa a valer só para canais ativos (o webhook já procura só os conectados).
drop index if exists channels_external;
create unique index channels_external on channels (kind, external_id) where external_id is not null and status <> 'disconnected';

-- Chave secreta do app da Meta por canal (cifrada), para empresas que usam o próprio app:
-- o webhook confere a assinatura de cada aviso com ela (ou com a META_APP_SECRET do netzer).
alter table channel_secrets add column if not exists app_secret_enc text;

-- Notificações: até quando cada pessoa já viu (as notificações são calculadas do estado atual).
-- memberships só é escrita por admin; a função abaixo deixa cada um marcar só a própria linha.
alter table memberships add column if not exists notifications_seen_at timestamptz;

create or replace function public.mark_notifications_seen(p_ws uuid)
returns void language sql security definer set search_path = public as $$
  update memberships set notifications_seen_at = now() where workspace_id = p_ws and user_id = auth.uid();
$$;
revoke execute on function public.mark_notifications_seen(uuid) from public, anon;
grant execute on function public.mark_notifications_seen(uuid) to authenticated;

-- Anexos no chat do site: o visitante também vê o arquivo que a equipe mandou.
-- A função passa a devolver o tipo e o arquivo (o link temporário é gerado no servidor).
drop function if exists public.visitor_thread(text, text);
create function public.visitor_thread(p_key text, p_thread text)
returns table (id uuid, direction text, body text, sent_at timestamptz, kind text, file_id uuid, file_name text, file_mime text, file_size bigint, file_path text)
language sql stable security definer set search_path = public as $$
  select m.id, m.direction, m.body, m.sent_at, m.kind, f.id, f.name, f.mime, f.size_bytes, f.storage_path
  from channels c
  join conversations cv on cv.channel_id = c.id and cv.external_thread_id = p_thread
  join messages m on m.conversation_id = cv.id
  left join files f on f.id = m.file_id
  where c.kind = 'webchat' and c.public_key = p_key
  order by m.sent_at
$$;
revoke execute on function public.visitor_thread(text, text) from public, anon, authenticated;
grant execute on function public.visitor_thread(text, text) to service_role;

-- prévia da conversa: anexo sem legenda aparece como "[foto]", "[áudio]"...
create or replace function private.after_outbound() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.direction = 'out' then
    update conversations set last_message_at = new.sent_at,
      last_message_preview = left(coalesce(nullif(new.body, ''), case new.kind when 'image' then '[foto]' when 'audio' then '[áudio]' when 'video' then '[vídeo]' when 'file' then '[arquivo]' else '' end), 200),
      is_unanswered = false, unread_count = 0, assigned_user_id = coalesce(assigned_user_id, new.sender_user_id)
    where id = new.conversation_id;
    update leads set last_activity_at = now()
    where id = (select lead_id from conversations where id = new.conversation_id);
  end if;
  return null;
end $$;

-- Gatilhos de etapa (estilo funil digital do Kommo): novo gatilho "quando o responsável muda",
-- que também pode guardar a etapa (só leads daquela etapa).
alter table robots drop constraint if exists robots_trigger_check;
alter table robots add constraint robots_trigger_check
  check (trigger in ('stage_enter','lead_created','message_in','new_contact','responsible_changed'));

-- Email: descadastro por contato e disparos por email (assunto). Chat da equipe com anexo.
alter table contacts add column if not exists email_opt_out boolean not null default false;
alter table broadcasts add column if not exists medium text not null default 'message';
alter table broadcasts drop constraint if exists broadcasts_medium_check;
alter table broadcasts add constraint broadcasts_medium_check check (medium in ('message','email'));
alter table broadcasts add column if not exists subject text check (subject is null or char_length(subject) <= 200);
alter table broadcasts drop constraint if exists broadcasts_body_check;
alter table broadcasts add constraint broadcasts_body_check check (char_length(body) between 1 and 5000);
alter table team_messages add column if not exists file_id uuid references files(id) on delete set null;

-- Créditos de IA: o plano inclui N respostas por mês; passou disso, gasta os créditos avulsos comprados (não vencem).
-- Com a chave própria da Anthropic, a empresa paga a IA direto e não gasta crédito.
create table if not exists ai_wallets (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  month text not null default '',                 -- AAAA-MM do uso abaixo
  used int not null default 0 check (used >= 0),  -- respostas da IA no mês
  extra int not null default 0 check (extra >= 0),-- créditos avulsos que sobram
  api_key_hint text,                              -- final da chave própria, só para mostrar
  updated_at timestamptz not null default now()
);
alter table ai_wallets enable row level security;
drop policy if exists ai_wallets_read on ai_wallets;
create policy ai_wallets_read on ai_wallets for select using (private.is_member(workspace_id));
-- escrita: só o servidor (service role), pelas funções abaixo

-- chave própria cifrada (AES-GCM no servidor). Sem política: só o service role lê.
create table if not exists ai_keys (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  key_enc text not null,
  updated_at timestamptz not null default now()
);
alter table ai_keys enable row level security;

-- compras confirmadas pelo Stripe (uma linha por sessão: o webhook repetido não soma duas vezes)
create table if not exists ai_credit_purchases (
  stripe_session_id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  credits int not null check (credits > 0),
  created_at timestamptz not null default now()
);
create index if not exists ai_credit_purchases_ws on ai_credit_purchases (workspace_id);
alter table ai_credit_purchases enable row level security;
drop policy if exists ai_purchases_read on ai_credit_purchases;
create policy ai_purchases_read on ai_credit_purchases for select using (private.is_admin(workspace_id));

-- gasta 1 crédito: primeiro o do plano, depois o avulso. Trava a linha (duas respostas ao mesmo tempo não furam o limite).
create or replace function spend_ai_credit(p_ws uuid, p_included int, p_month text) returns boolean
language plpgsql security definer set search_path = public as $$
declare w ai_wallets;
begin
  insert into ai_wallets (workspace_id, month) values (p_ws, p_month) on conflict (workspace_id) do nothing;
  select * into w from ai_wallets where workspace_id = p_ws for update;
  if w.month <> p_month then w.used := 0; end if;
  if w.used < p_included then
    update ai_wallets set month = p_month, used = w.used + 1, updated_at = now() where workspace_id = p_ws;
    return true;
  elsif w.extra > 0 then
    update ai_wallets set month = p_month, used = w.used + 1, extra = w.extra - 1, updated_at = now() where workspace_id = p_ws;
    return true;
  end if;
  update ai_wallets set month = p_month, used = w.used where workspace_id = p_ws;
  return false;
end $$;

-- devolve o crédito quando a chamada à IA falhou
create or replace function refund_ai_credit(p_ws uuid, p_included int, p_month text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update ai_wallets
     set extra = extra + case when used > p_included then 1 else 0 end,
         used = used - 1, updated_at = now()
   where workspace_id = p_ws and month = p_month and used > 0;
end $$;

-- soma créditos de uma compra (uma vez por sessão do Stripe)
create or replace function add_ai_credits(p_session text, p_ws uuid, p_credits int) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into ai_credit_purchases (stripe_session_id, workspace_id, credits) values (p_session, p_ws, p_credits)
    on conflict (stripe_session_id) do nothing;
  if not found then return false; end if;
  insert into ai_wallets (workspace_id, extra) values (p_ws, p_credits)
    on conflict (workspace_id) do update set extra = ai_wallets.extra + excluded.extra, updated_at = now();
  return true;
end $$;

revoke execute on function spend_ai_credit(uuid, int, text) from public, anon, authenticated;
revoke execute on function refund_ai_credit(uuid, int, text) from public, anon, authenticated;
revoke execute on function add_ai_credits(text, uuid, int) from public, anon, authenticated;
grant execute on function spend_ai_credit(uuid, int, text) to service_role;
grant execute on function refund_ai_credit(uuid, int, text) to service_role;
grant execute on function add_ai_credits(text, uuid, int) to service_role;

-- Gatilhos novos no funil digital: etiqueta adicionada, campo alterado, cliente sem responder e todo dia no horário.
alter table robots drop constraint if exists robots_trigger_check;
alter table robots add constraint robots_trigger_check
  check (trigger in ('stage_enter','lead_created','message_in','new_contact','responsible_changed','tag_added','field_changed','no_reply','schedule_daily'));
alter table robots drop constraint if exists robot_daily_needs_stage;
alter table robots add constraint robot_daily_needs_stage check (trigger <> 'schedule_daily' or stage_id is not null);
create index if not exists robots_daily on robots (trigger) where is_active and trigger = 'schedule_daily';

-- Estatísticas: metas do mês por pessoa, relatórios de ROI e mensagens por canal somadas no banco.
create table if not exists sales_goals (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  cents bigint not null default 0 check (cents >= 0),
  count int not null default 0 check (count >= 0),
  primary key (workspace_id, month, user_id)
);
alter table sales_goals enable row level security;
drop policy if exists sales_goals_read on sales_goals;
drop policy if exists sales_goals_write on sales_goals;
create policy sales_goals_read on sales_goals for select using (private.is_member(workspace_id));
create policy sales_goals_write on sales_goals for all to authenticated
  using (private.is_admin(workspace_id)) with check (private.is_admin(workspace_id));

create table if not exists roi_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  investment_cents bigint not null default 0 check (investment_cents >= 0),
  utm_source text check (utm_source is null or char_length(utm_source) <= 80),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 120),
  from_date date not null,
  to_date date not null,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);
create index if not exists roi_reports_ws on roi_reports (workspace_id);
alter table roi_reports enable row level security;
drop policy if exists roi_reports_read on roi_reports;
drop policy if exists roi_reports_write on roi_reports;
create policy roi_reports_read on roi_reports for select using (private.is_member(workspace_id));
create policy roi_reports_write on roi_reports for all to authenticated
  using (private.is_admin(workspace_id)) with check (private.is_admin(workspace_id));

-- mensagens no período por canal (roda com a permissão de quem chama: RLS vale)
create or replace function message_stats(p_ws uuid, p_from timestamptz)
returns table (kind text, received bigint, sent bigint, delivered bigint, read bigint, failed bigint, by_ai bigint)
language sql stable security invoker set search_path = public as $$
  select c.kind,
         count(*) filter (where m.direction = 'in'),
         count(*) filter (where m.direction = 'out'),
         count(*) filter (where m.direction = 'out' and m.status in ('delivered', 'read')),
         count(*) filter (where m.direction = 'out' and m.status = 'read'),
         count(*) filter (where m.direction = 'out' and m.status = 'failed'),
         count(*) filter (where m.direction = 'out' and m.by_ai)
    from messages m join channels c on c.id = m.channel_id
   where m.workspace_id = p_ws and m.sent_at >= p_from
   group by c.kind
$$;
grant execute on function message_stats(uuid, timestamptz) to authenticated;
create index if not exists events_ws_created on events (workspace_id, created_at desc);
create index if not exists notes_ws_created on notes (workspace_id, created_at desc);
create index if not exists messages_ws_sent on messages (workspace_id, sent_at desc);

-- Central da plataforma (só os donos do netzer): lista de empresas e usuários, ações de suporte,
-- contas de demonstração com dados de exemplo e registro de tudo o que a central fez.
-- Todas as funções aqui são chamadas só pelo servidor (service role), nunca pelo navegador.

alter table workspaces add column if not exists is_demo boolean not null default false;

create table if not exists platform_audit (
  id bigint generated always as identity primary key,
  actor_email text not null,
  action text not null,
  target text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists platform_audit_created on platform_audit (created_at desc);
alter table platform_audit enable row level security; -- sem política: só o service role lê e grava

-- uma linha por empresa, com dono, plano e números de uso
create or replace function platform_workspaces()
returns table (
  id uuid, name text, slug text, created_at timestamptz, is_demo boolean,
  owner_id uuid, owner_email text, owner_name text,
  plan text, status text, trial_ends_at timestamptz, seats int, stripe_customer_id text,
  members bigint, leads bigint, messages_30d bigint, last_activity timestamptz
)
language sql stable security definer set search_path = public as $$
  select w.id, w.name, w.slug, w.created_at, w.is_demo,
         o.user_id, p.email, p.full_name,
         s.plan, s.status, s.trial_ends_at, s.seats, s.stripe_customer_id,
         (select count(*) from memberships m where m.workspace_id = w.id and m.status = 'active'),
         (select count(*) from leads l where l.workspace_id = w.id and l.deleted_at is null),
         (select count(*) from messages g where g.workspace_id = w.id and g.sent_at > now() - interval '30 days'),
         (select max(l.last_activity_at) from leads l where l.workspace_id = w.id)
    from workspaces w
    left join subscriptions s on s.workspace_id = w.id
    left join lateral (
      select m.user_id from memberships m join roles r on r.id = m.role_id
       where m.workspace_id = w.id and r.is_admin order by m.created_at limit 1
    ) o on true
    left join profiles p on p.id = o.user_id
   order by w.created_at desc
$$;

-- dados de exemplo de uma empresa de demonstração (funil, conversas e tarefas com cara de uso real)
create or replace function private.seed_demo(ws uuid, uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  pid uuid; ch uuid; lost_reason uuid; ttype uuid;
  names text[] := array['Marina Alves','Carlos Reis','Joana Prado','Rafael Torres','Luciana Mota','Bruno Castro','Patrícia Nogueira','Diego Martins','Fernanda Lima','Otávio Souza'];
  deals text[] := array['Clínica Vida — 2 implantes','Pet Shop Bicho Feliz — plano anual','Escola Saber — 3 unidades','Torres Consultoria — projeto','Luciana Mota — pacote mensal','Academia Forte — 120 alunos','Studio Bela — agenda online','Mercado Bom Preço — 2 lojas','Fernanda Lima — clareamento','Souza Advocacia — atendimento'];
  sorts int[] := array[0,1,2,3,90,0,1,91,2,0];
  prices bigint[] := array[1250000,480000,3600000,900000,240000,1500000,320000,780000,180000,560000];
  tagsets text[] := array['indicação','varejo','educação','','vip','instagram','instagram','varejo','vip','indicação'];
  ask text[] := array['Oi! Queria um orçamento para dois implantes.','Vocês têm plano anual? Quanto fica?','Preciso para as 3 unidades da escola, conseguem?','Podemos marcar uma reunião essa semana?','Fechado! Pode mandar o contrato.','Boa tarde, quanto custa para 120 alunos?','Dá para agendar pelo Instagram também?','Obrigado, vamos seguir com outro fornecedor.','Vocês atendem aos sábados?','Vi o anúncio, como funciona?'];
  reply text[] := array['Olá, Marina! Claro. Posso te ligar hoje à tarde?','Temos sim! Te mando a tabela agora.','Conseguimos. Envio a proposta até amanhã.','Pode ser quinta às 10h?','Perfeito, contrato enviado no seu email.','','Dá sim, integra com o direct.','Que pena! Se mudar de ideia, estamos aqui.','',''];
  i int; c uuid; l uuid; cv uuid; st uuid; t uuid; ago interval;
begin
  select id into pid from pipelines where workspace_id = ws order by created_at limit 1;
  select id into ch from channels where workspace_id = ws and kind = 'webchat' limit 1;
  select id into lost_reason from loss_reasons where workspace_id = ws order by sort limit 1;
  select id into ttype from task_types where workspace_id = ws order by sort limit 1;
  for i in 1..array_length(names, 1) loop
    ago := make_interval(hours => i * 7);
    insert into contacts (workspace_id, name, responsible_user_id, created_by, created_at)
      values (ws, names[i], uid, uid, now() - ago) returning id into c;
    insert into contact_identities (workspace_id, contact_id, kind, value, is_primary)
      values (ws, c, 'phone', '+55319' || lpad((87650000 + i * 137)::text, 8, '0'), true);
    select id into st from stages where pipeline_id = pid and sort = sorts[i];
    insert into leads (workspace_id, name, pipeline_id, stage_id, responsible_user_id, price_cents, source, channel_id,
                       loss_reason_id, created_by, created_at, last_activity_at)
      values (ws, deals[i], pid, st, uid, prices[i], case when i % 3 = 0 then 'manual' else 'site' end, ch,
              case when sorts[i] = 91 then lost_reason end, uid, now() - ago, now() - ago / 2)
      returning id into l;
    insert into lead_contacts (lead_id, contact_id, workspace_id, is_main) values (l, c, ws, true);
    if tagsets[i] <> '' then
      insert into tags (workspace_id, name) values (ws, tagsets[i]) on conflict (workspace_id, name) do nothing;
      select id into t from tags where workspace_id = ws and name = tagsets[i];
      insert into lead_tags (lead_id, tag_id, workspace_id) values (l, t, ws) on conflict do nothing;
    end if;
    -- conversa pelo chat do site: pergunta do cliente e, quando tem, a resposta da equipe
    insert into conversations (workspace_id, channel_id, contact_id, lead_id, external_thread_id, status, created_at)
      values (ws, ch, c, l, 'demo-' || replace(gen_random_uuid()::text, '-', ''), 'open', now() - ago) returning id into cv;
    insert into messages (workspace_id, conversation_id, channel_id, direction, body, status, sent_at)
      values (ws, cv, ch, 'in', ask[i], 'received', now() - ago);
    if reply[i] <> '' then
      insert into messages (workspace_id, conversation_id, channel_id, direction, body, sender_user_id, status, sent_at)
        values (ws, cv, ch, 'out', reply[i], uid, 'read', now() - ago + interval '6 minutes');
    end if;
    update conversations
       set last_inbound_at = now() - ago,
           last_message_at = now() - ago + case when reply[i] <> '' then interval '6 minutes' else interval '0' end,
           last_message_preview = case when reply[i] <> '' then reply[i] else ask[i] end,
           unread_count = case when reply[i] <> '' then 0 else 1 end,
           is_unanswered = reply[i] = ''
     where id = cv;
    -- próxima tarefa nos negócios abertos (uma atrasada, para o painel mostrar o alerta)
    if sorts[i] < 90 and i <> 4 then
      insert into tasks (workspace_id, lead_id, task_type_id, responsible_user_id, text, due_at, created_by)
        values (ws, l, ttype, uid,
                (array['Ligar para confirmar horários','Enviar tabela de preços','Mandar proposta revisada','Confirmar reunião','Retornar contato'])[1 + i % 5],
                case when i = 2 then now() - interval '3 hours' else now() + make_interval(hours => i * 5) end, uid);
    end if;
  end loop;
end $$;

-- nova empresa de demonstração para um usuário já criado (plano Operação liberado, sem cobrança)
create or replace function platform_create_demo(p_user uuid, p_name text, p_slug text) returns text
language plpgsql security definer set search_path = public as $$
declare ws uuid; r_admin uuid; pid uuid;
begin
  if exists (select 1 from workspaces where slug = p_slug) then
    raise exception 'slug_taken' using errcode = '23505'; end if;
  insert into profiles (id, full_name, email)
    select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', ''), u.email from auth.users u where u.id = p_user
    on conflict (id) do nothing;
  insert into workspaces (name, slug, created_by, is_demo) values (p_name, p_slug, p_user, true) returning id into ws;
  insert into roles (workspace_id, name, is_admin, rights) values (ws, 'Admin', true, '{}') returning id into r_admin;
  insert into roles (workspace_id, name, rights) values
    (ws, 'Gerente', '{"leads":{"view":"all","edit":"all","delete":"team","add":true},"contacts":{"view":"all","edit":"all","delete":"team","add":true},"companies":{"view":"all","edit":"all","delete":"team","add":true},"tasks":{"view":"all","edit":"all"}}'),
    (ws, 'Vendedor', '{"leads":{"view":"own","edit":"own","delete":"none","add":true},"contacts":{"view":"own","edit":"own","delete":"none","add":true},"companies":{"view":"all","edit":"own","delete":"none","add":true},"tasks":{"view":"own","edit":"own"}}');
  insert into memberships (workspace_id, user_id, role_id) values (ws, p_user, r_admin);
  insert into pipelines (workspace_id, name) values (ws, 'Vendas') returning id into pid;
  insert into stages (workspace_id, pipeline_id, name, color, kind, sort) values
    (ws, pid, 'Primeiro contato', '2', 'open', 0),
    (ws, pid, 'Qualificado', '4', 'open', 1),
    (ws, pid, 'Proposta enviada', '6', 'open', 2),
    (ws, pid, 'Negociação', '8', 'open', 3),
    (ws, pid, 'Ganho', 'won', 'won', 90),
    (ws, pid, 'Perdido', 'lost', 'lost', 91);
  insert into loss_reasons (workspace_id, name, sort) values
    (ws, 'Preço', 0), (ws, 'Escolheu concorrente', 1), (ws, 'Sem resposta', 2), (ws, 'Sem orçamento agora', 3);
  insert into task_types (workspace_id, name, sort) values
    (ws, 'Follow-up', 0), (ws, 'Ligação', 1), (ws, 'Reunião', 2), (ws, 'Enviar proposta', 3);
  insert into channels (workspace_id, kind, name, public_key, default_pipeline_id, status)
    values (ws, 'webchat', 'Chat do site', substr(replace(gen_random_uuid()::text, '-', ''), 1, 10), pid, 'connected');
  insert into subscriptions (workspace_id, plan, status) values (ws, 'pro', 'active');
  perform private.seed_demo(ws, p_user);
  return p_slug;
end $$;

-- volta a demonstração ao estado inicial (apaga o que o cliente mexeu e semeia de novo)
create or replace function platform_reset_demo(p_ws uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not exists (select 1 from workspaces where id = p_ws and is_demo) then
    raise exception 'not_demo' using errcode = '22023'; end if;
  select m.user_id into uid from memberships m join roles r on r.id = m.role_id
   where m.workspace_id = p_ws and r.is_admin order by m.created_at limit 1;
  delete from tasks where workspace_id = p_ws;
  delete from notes where workspace_id = p_ws;
  delete from conversations where workspace_id = p_ws;
  delete from leads where workspace_id = p_ws;
  delete from contacts where workspace_id = p_ws;
  delete from companies where workspace_id = p_ws;
  delete from tags where workspace_id = p_ws;
  perform private.seed_demo(p_ws, uid);
end $$;

revoke execute on function platform_workspaces() from public, anon, authenticated;
revoke execute on function private.seed_demo(uuid, uuid) from public, anon, authenticated;
revoke execute on function platform_create_demo(uuid, text, text) from public, anon, authenticated;
revoke execute on function platform_reset_demo(uuid) from public, anon, authenticated;
grant execute on function platform_workspaces() to service_role;
grant execute on function private.seed_demo(uuid, uuid) to service_role;
grant execute on function platform_create_demo(uuid, text, text) to service_role;
grant execute on function platform_reset_demo(uuid) to service_role;

-- UTMs com histórico: a conversa guarda o 1º contato e o caminho (o app junta os toques); o lead acompanha a conversa.
create or replace function private.conversation_attribution_to_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null and new.attribution is not null then
    update leads set attribution = new.attribution
     where id = new.lead_id
       and (attribution is null or attribution is distinct from new.attribution)
       and coalesce(attribution ->> 'via', '') <> 'manual'; -- origem preenchida à mão pela equipe não é sobrescrita
  end if;
  return null;
end $$;
