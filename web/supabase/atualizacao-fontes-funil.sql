-- Fontes de cada funil: além do funil padrão do canal, regras de entrada mandam o contato novo para outro funil
-- ("mensagem do WhatsApp com a palavra orçamento → funil Orçamentos"). A primeira regra que bater vale.
create table if not exists source_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  channel_id uuid references channels(id) on delete cascade, -- null = qualquer canal
  match text not null check (match in ('keyword','code','link','ad')),
  value text not null default '' check (char_length(value) <= 200),
  matched int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists source_rules_ws on source_rules (workspace_id, created_at);
alter table source_rules enable row level security;
drop policy if exists member_read on source_rules;
drop policy if exists admin_write on source_rules;
create policy member_read on source_rules for select using (private.is_member(workspace_id));
create policy admin_write on source_rules for all using (private.is_admin(workspace_id)) with check (private.is_admin(workspace_id));
