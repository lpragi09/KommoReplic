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
