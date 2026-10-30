-- Pagamentos gerados no checkout (Pix, boleto, cartão), aprovados ou não: a aba de cobrança mostra a situação
-- e, enquanto o Pix não é pago, o QR code de novo. Quem grava é o servidor (chave secreta); admin da empresa lê.
create table if not exists checkout_payments (
  id text primary key, -- id do pagamento no Mercado Pago
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  amount_cents int not null,
  method text not null check (method in ('pix','boleto','card')),
  status text not null,
  pix_code text,
  pix_image text,
  boleto_url text,
  boleto_barcode text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists checkout_payments_ws on checkout_payments (workspace_id, created_at desc);
alter table checkout_payments enable row level security;
drop policy if exists admin_read on checkout_payments;
create policy admin_read on checkout_payments for select using (private.is_admin(workspace_id));
