-- =====================================================================
-- netzer tech · atualização de 16/10/2026: cadastro com CPF/CNPJ e trava do teste grátis
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run.
-- Pode rodar de novo sem problema. Rode DEPOIS da atualizacao-robos.sql.
-- =====================================================================

-- Cadastro com CPF/CNPJ e trava do teste grátis.
-- - workspaces ganha tipo e número do documento e o WhatsApp de quem assina
-- - trial_claims guarda quem já usou os 14 dias: um por documento e um por email
--   (sobrevive à exclusão da empresa, para não dar para apagar e começar de novo)
-- - create_workspace confere o documento aqui no banco e só dá teste se for o 1º uso

alter table workspaces add column if not exists doc_type text check (doc_type in ('cpf','cnpj'));
alter table workspaces add column if not exists document text check (document ~ '^[0-9]{11}$|^[0-9]{14}$');
alter table workspaces add column if not exists phone text check (phone ~ '^[0-9]{10,13}$');
create index if not exists workspaces_document on workspaces (document);

create table if not exists trial_claims (
  kind text not null check (kind in ('document','email')),
  key text not null,                          -- documento (só dígitos) ou md5 do email em minúsculas
  workspace_id uuid references workspaces(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (kind, key)
);
create index if not exists trial_claims_ws on trial_claims (workspace_id);
alter table trial_claims enable row level security;   -- sem policy: só funções do banco e o servidor leem

-- dígitos verificadores de CPF (11) e CNPJ (14)
create or replace function private.valid_doc(d text) returns boolean
language plpgsql immutable as $$
declare s int; r int; i int; w int[];
begin
  if d is null or d !~ '^[0-9]+$' then return false; end if;
  if d ~ '^(.)\1+$' then return false; end if;           -- 000..., 111...
  if length(d) = 11 then
    s := 0; for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
    r := (s * 10) % 11; if r = 10 then r := 0; end if;
    if r <> substr(d, 10, 1)::int then return false; end if;
    s := 0; for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
    r := (s * 10) % 11; if r = 10 then r := 0; end if;
    return r = substr(d, 11, 1)::int;
  elsif length(d) = 14 then
    w := array[5,4,3,2,9,8,7,6,5,4,3,2];
    s := 0; for i in 1..12 loop s := s + substr(d, i, 1)::int * w[i]; end loop;
    r := s % 11; r := case when r < 2 then 0 else 11 - r end;
    if r <> substr(d, 13, 1)::int then return false; end if;
    w := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
    s := 0; for i in 1..13 loop s := s + substr(d, i, 1)::int * w[i]; end loop;
    r := s % 11; r := case when r < 2 then 0 else 11 - r end;
    return r = substr(d, 14, 1)::int;
  end if;
  return false;
end $$;

-- a versão antiga (sem documento) dava teste para qualquer um: sai de cena
drop function if exists public.create_workspace(text, text, text, text);

create or replace function public.create_workspace(
  p_name text, p_slug text, p_timezone text, p_currency text,
  p_doc_type text, p_document text, p_phone text default null
) returns text language plpgsql security definer set search_path = public as $$
declare ws uuid; r_admin uuid; pid uuid; uid uuid := auth.uid(); mail text; new_doc boolean; new_mail boolean; trial boolean; need_len int;
begin
  if uid is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  if p_slug in ('login','signup','onboarding','chat','design','api','_next','termos','privacidade','app') then
    raise exception 'slug_reserved' using errcode = '22023'; end if;
  if exists (select 1 from workspaces where slug = p_slug) then
    raise exception 'slug_taken' using errcode = '23505'; end if;
  p_document := regexp_replace(coalesce(p_document, ''), '[^0-9]', '', 'g');
  need_len := case p_doc_type when 'cpf' then 11 when 'cnpj' then 14 else 0 end;
  if need_len = 0 or length(p_document) <> need_len or not private.valid_doc(p_document) then
    raise exception 'invalid_document' using errcode = '22023'; end if;
  p_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  select lower(email) into mail from auth.users where id = uid;

  insert into workspaces (name, slug, timezone, currency, created_by, doc_type, document, phone)
  values (p_name, p_slug, p_timezone, p_currency, uid, p_doc_type, p_document, p_phone) returning id into ws;

  -- teste grátis só no 1º uso do documento E do email
  insert into trial_claims (kind, key, workspace_id) values ('document', p_document, ws) on conflict do nothing;
  new_doc := found;
  insert into trial_claims (kind, key, workspace_id) values ('email', md5(coalesce(mail, uid::text)), ws) on conflict do nothing;
  new_mail := found;
  trial := new_doc and new_mail;

  insert into roles (workspace_id, name, is_admin, rights) values (ws, 'Admin', true, '{}') returning id into r_admin;
  insert into roles (workspace_id, name, rights) values
    (ws, 'Gerente', '{"leads":{"view":"all","edit":"all","delete":"team","add":true},"contacts":{"view":"all","edit":"all","delete":"team","add":true},"companies":{"view":"all","edit":"all","delete":"team","add":true},"tasks":{"view":"all","edit":"all"}}'),
    (ws, 'Vendedor', '{"leads":{"view":"own","edit":"own","delete":"none","add":true},"contacts":{"view":"own","edit":"own","delete":"none","add":true},"companies":{"view":"all","edit":"own","delete":"none","add":true},"tasks":{"view":"own","edit":"own"}}');
  insert into memberships (workspace_id, user_id, role_id) values (ws, uid, r_admin);

  insert into pipelines (workspace_id, name) values (ws, 'Vendas') returning id into pid;
  insert into stages (workspace_id, pipeline_id, name, color, kind, sort) values
    (ws, pid, 'Primeiro contato', '2', 'open', 0),
    (ws, pid, 'Qualificado', '4', 'open', 1),
    (ws, pid, 'Proposta enviada', '6', 'open', 2),
    (ws, pid, 'Negociação', '8', 'open', 3),
    (ws, pid, 'Ganho', 'won', 'won', 90),
    (ws, pid, 'Perdido', 'lost', 'lost', 91);
  insert into loss_reasons (workspace_id, name, sort) values
    (ws, 'Preço', 0), (ws, 'Escolheu concorrente', 1), (ws, 'Sem resposta', 2), (ws, 'Sem orçamento agora', 3);
  insert into task_types (workspace_id, name, sort) values
    (ws, 'Follow-up', 0), (ws, 'Ligação', 1), (ws, 'Reunião', 2), (ws, 'Enviar proposta', 3);
  insert into channels (workspace_id, kind, name, public_key, default_pipeline_id, status)
  values (ws, 'webchat', 'Chat do site', substr(replace(gen_random_uuid()::text, '-', ''), 1, 10), pid, 'connected');
  -- sem teste: trial_ends_at = agora, o painel já abre pedindo o plano
  insert into subscriptions (workspace_id, plan, status, trial_ends_at)
  values (ws, 'trial', 'trialing', case when trial then now() + interval '14 days' else now() end);
  return p_slug;
end $$;

revoke execute on function public.create_workspace(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_workspace(text, text, text, text, text, text, text) to authenticated;

-- situação de acesso da empresa, para qualquer membro (a tabela subscriptions só o admin lê)
create or replace function public.workspace_access(p_ws uuid)
returns table (plan text, status text, trial_ends_at timestamptz, current_period_end timestamptz)
language sql stable security definer set search_path = public as $$
  select s.plan, s.status, s.trial_ends_at, s.current_period_end
  from subscriptions s where s.workspace_id = p_ws and private.is_member(p_ws)
$$;
revoke execute on function public.workspace_access(uuid) from public, anon;
grant execute on function public.workspace_access(uuid) to authenticated, service_role;
