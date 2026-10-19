-- =====================================================================
-- netzer · atualização de 15/10/2026: robôs de automação, chat da equipe e disparos
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run.
-- Pode rodar de novo sem problema (não apaga nada, só cria o que faltar).
-- =====================================================================

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
