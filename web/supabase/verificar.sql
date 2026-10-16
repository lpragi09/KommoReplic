-- Recadi: confere se o setup.sql já foi aplicado por completo.
-- Se as 4 linhas mostrarem "ok", está tudo certo e NÃO precisa rodar o setup de novo.
select 'tabelas (esperado 41)' as item, count(*)::text as valor,
       case when count(*) = 41 then 'ok' else 'faltando' end as status
  from pg_tables where schemaname = 'public'
union all
select 'tabelas sem RLS (esperado 0)', count(*)::text, case when count(*) = 0 then 'ok' else 'ATENÇÃO' end
  from pg_tables where schemaname = 'public' and not rowsecurity
union all
select 'funções do app (esperado 7)', count(*)::text, case when count(*) = 7 then 'ok' else 'faltando' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('accept_incoming_lead','create_workspace','decline_incoming_lead','link_incoming_lead','receive_inbound','visitor_thread','workspace_access')
union all
select 'migração 0003 (email no perfil)', count(*)::text, case when count(*) = 1 then 'ok' else 'faltando' end
  from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
union all
select 'atualização 0004 (robôs, chat da equipe, disparos)', count(*)::text, case when count(*) = 4 then 'ok' else 'faltando' end
  from information_schema.tables where table_schema = 'public' and table_name in ('robots','robot_runs','team_messages','broadcasts')
union all
select 'atualização 0005 (cadastro com CPF/CNPJ e trava do teste)', count(*)::text, case when count(*) = 1 then 'ok' else 'faltando' end
  from information_schema.tables where table_schema = 'public' and table_name = 'trial_claims';
