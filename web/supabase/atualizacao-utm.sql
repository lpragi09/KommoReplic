-- =====================================================================
-- netzer tech · atualização de 16/10/2026: UTMs, links rastreáveis de WhatsApp, filtro de robô por campanha
-- e modelos de mensagem por rede (WhatsApp, Instagram, Messenger, TikTok, chat do site)
-- Rode no Supabase: SQL Editor → New query → cole tudo → Run. Pode rodar de novo.
-- Ordem: atualizacao-robos.sql → atualizacao-cadastro.sql → esta.
-- =====================================================================

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
