-- Código na mensagem do anúncio: "se o texto tiver G-01-34 → estas UTMs", sem robô.
create table if not exists message_codes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  code text not null check (char_length(code) between 3 and 30),
  name text not null check (char_length(name) between 1 and 80),
  defaults jsonb not null default '{}',
  matched int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists message_codes_ws_code on message_codes (workspace_id, upper(code));
alter table message_codes enable row level security;
drop policy if exists member_read on message_codes;
drop policy if exists admin_write on message_codes;
create policy member_read on message_codes for select using (private.is_member(workspace_id));
create policy admin_write on message_codes for all using (private.is_admin(workspace_id)) with check (private.is_admin(workspace_id));
