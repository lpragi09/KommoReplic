-- Recadi: confere se o setup.sql já foi aplicado por completo.
-- Se as 4 linhas mostrarem "ok", está tudo certo e NÃO precisa rodar o setup de novo.
select 'tabelas (esperado 36)' as item, count(*)::text as valor,
       case when count(*) = 36 then 'ok' else 'faltando' end as status
  from pg_tables where schemaname = 'public'
union all
select 'tabelas sem RLS (esperado 0)', count(*)::text, case when count(*) = 0 then 'ok' else 'ATENÇÃO' end
  from pg_tables where schemaname = 'public' and not rowsecurity
union all
select 'funções do app (esperado 6)', count(*)::text, case when count(*) = 6 then 'ok' else 'faltando' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('accept_incoming_lead','create_workspace','decline_incoming_lead','link_incoming_lead','receive_inbound','visitor_thread')
union all
select 'migração 0003 (email no perfil)', count(*)::text, case when count(*) = 1 then 'ok' else 'faltando' end
  from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'email';
