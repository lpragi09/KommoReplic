-- Checkout no próprio site: dados de cobrança da empresa (documento e endereço, pedidos pelo boleto e pela nota).
create table if not exists billing_profiles (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  person text not null check (person in ('pf','pj')),
  doc text not null check (doc ~ '^[0-9]{11}$|^[0-9]{14}$'),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) <= 200),
  phone text not null default '' check (char_length(phone) <= 20),
  address jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table billing_profiles enable row level security;
drop policy if exists admin_all on billing_profiles;
create policy admin_all on billing_profiles for all using (private.is_admin(workspace_id)) with check (private.is_admin(workspace_id));
