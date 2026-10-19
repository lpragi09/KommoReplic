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
