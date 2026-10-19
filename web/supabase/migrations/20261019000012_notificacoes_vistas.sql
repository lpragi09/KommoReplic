-- Notificações: até quando cada pessoa já viu (as notificações são calculadas do estado atual).
-- memberships só é escrita por admin; a função abaixo deixa cada um marcar só a própria linha.
alter table memberships add column if not exists notifications_seen_at timestamptz;

create or replace function public.mark_notifications_seen(p_ws uuid)
returns void language sql security definer set search_path = public as $$
  update memberships set notifications_seen_at = now() where workspace_id = p_ws and user_id = auth.uid();
$$;
revoke execute on function public.mark_notifications_seen(uuid) from public, anon;
grant execute on function public.mark_notifications_seen(uuid) to authenticated;
