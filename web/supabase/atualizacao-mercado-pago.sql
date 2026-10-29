-- Cobrança pelo Mercado Pago: cada pagamento aprovado cobre um período (mês ou ano), sem renovação automática.
-- stripe_customer_id passa a marcar "paga de verdade" (mp:<empresa>), para a Central separar pagante de cortesia.
create table if not exists payments (
  id text primary key, -- mp:<id do pagamento>
  workspace_id uuid not null references workspaces(id) on delete cascade,
  plan text not null,
  seats int not null,
  months int not null,
  amount_cents int not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists payments_ws on payments (workspace_id, created_at desc);
alter table payments enable row level security;
drop policy if exists admin_read on payments;
create policy admin_read on payments for select using (private.is_admin(workspace_id));

-- aplica um pagamento de plano uma vez só (o webhook pode repetir)
create or replace function apply_plan_payment(p_payment text, p_ws uuid, p_plan text, p_seats int, p_months int, p_amount int, p_period_end timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into payments (id, workspace_id, plan, seats, months, amount_cents, period_end)
    values (p_payment, p_ws, p_plan, p_seats, p_months, p_amount, p_period_end)
    on conflict (id) do nothing;
  if not found then return false; end if;
  insert into subscriptions (workspace_id, plan, status, seats, stripe_customer_id, current_period_end)
    values (p_ws, p_plan, 'active', p_seats, 'mp:' || p_ws, p_period_end)
    on conflict (workspace_id) do update set plan = excluded.plan, status = 'active', seats = excluded.seats,
      stripe_customer_id = excluded.stripe_customer_id, current_period_end = excluded.current_period_end, updated_at = now();
  return true;
end $$;

-- venceu: 3 dias de tolerância (aviso na tela), depois trava. Cortesia da Central (sem data de fim) não vence.
create or replace function expire_subscriptions() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update subscriptions set status = 'past_due', updated_at = now()
    where status = 'active' and current_period_end is not null and current_period_end < now();
  update subscriptions set status = 'unpaid', updated_at = now()
    where status = 'past_due' and current_period_end is not null and current_period_end < now() - interval '3 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function apply_plan_payment(text, uuid, text, int, int, int, timestamptz) from public, anon, authenticated;
revoke execute on function expire_subscriptions() from public, anon, authenticated;
grant execute on function apply_plan_payment(text, uuid, text, int, int, int, timestamptz) to service_role;
grant execute on function expire_subscriptions() to service_role;
