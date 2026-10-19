-- netzer tech · robôs com caminhos + marcações do calendário. Rode depois de atualizacao-utm.sql. Pode rodar de novo.

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
