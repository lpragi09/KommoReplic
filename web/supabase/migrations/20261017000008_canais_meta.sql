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
