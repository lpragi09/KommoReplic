-- Central da plataforma (só os donos do netzer): lista de empresas e usuários, ações de suporte,
-- contas de demonstração com dados de exemplo e registro de tudo o que a central fez.
-- Todas as funções aqui são chamadas só pelo servidor (service role), nunca pelo navegador.

alter table workspaces add column if not exists is_demo boolean not null default false;

create table if not exists platform_audit (
  id bigint generated always as identity primary key,
  actor_email text not null,
  action text not null,
  target text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists platform_audit_created on platform_audit (created_at desc);
alter table platform_audit enable row level security; -- sem política: só o service role lê e grava

-- uma linha por empresa, com dono, plano e números de uso
create or replace function platform_workspaces()
returns table (
  id uuid, name text, slug text, created_at timestamptz, is_demo boolean,
  owner_id uuid, owner_email text, owner_name text,
  plan text, status text, trial_ends_at timestamptz, seats int, stripe_customer_id text,
  members bigint, leads bigint, messages_30d bigint, last_activity timestamptz
)
language sql stable security definer set search_path = public as $$
  select w.id, w.name, w.slug, w.created_at, w.is_demo,
         o.user_id, p.email, p.full_name,
         s.plan, s.status, s.trial_ends_at, s.seats, s.stripe_customer_id,
         (select count(*) from memberships m where m.workspace_id = w.id and m.status = 'active'),
         (select count(*) from leads l where l.workspace_id = w.id and l.deleted_at is null),
         (select count(*) from messages g where g.workspace_id = w.id and g.sent_at > now() - interval '30 days'),
         (select max(l.last_activity_at) from leads l where l.workspace_id = w.id)
    from workspaces w
    left join subscriptions s on s.workspace_id = w.id
    left join lateral (
      select m.user_id from memberships m join roles r on r.id = m.role_id
       where m.workspace_id = w.id and r.is_admin order by m.created_at limit 1
    ) o on true
    left join profiles p on p.id = o.user_id
   order by w.created_at desc
$$;

-- dados de exemplo de uma empresa de demonstração (funil, conversas e tarefas com cara de uso real)
create or replace function private.seed_demo(ws uuid, uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  pid uuid; ch uuid; lost_reason uuid; ttype uuid;
  names text[] := array['Marina Alves','Carlos Reis','Joana Prado','Rafael Torres','Luciana Mota','Bruno Castro','Patrícia Nogueira','Diego Martins','Fernanda Lima','Otávio Souza'];
  deals text[] := array['Clínica Vida — 2 implantes','Pet Shop Bicho Feliz — plano anual','Escola Saber — 3 unidades','Torres Consultoria — projeto','Luciana Mota — pacote mensal','Academia Forte — 120 alunos','Studio Bela — agenda online','Mercado Bom Preço — 2 lojas','Fernanda Lima — clareamento','Souza Advocacia — atendimento'];
  sorts int[] := array[0,1,2,3,90,0,1,91,2,0];
  prices bigint[] := array[1250000,480000,3600000,900000,240000,1500000,320000,780000,180000,560000];
  tagsets text[] := array['indicação','varejo','educação','','vip','instagram','instagram','varejo','vip','indicação'];
  ask text[] := array['Oi! Queria um orçamento para dois implantes.','Vocês têm plano anual? Quanto fica?','Preciso para as 3 unidades da escola, conseguem?','Podemos marcar uma reunião essa semana?','Fechado! Pode mandar o contrato.','Boa tarde, quanto custa para 120 alunos?','Dá para agendar pelo Instagram também?','Obrigado, vamos seguir com outro fornecedor.','Vocês atendem aos sábados?','Vi o anúncio, como funciona?'];
  reply text[] := array['Olá, Marina! Claro. Posso te ligar hoje à tarde?','Temos sim! Te mando a tabela agora.','Conseguimos. Envio a proposta até amanhã.','Pode ser quinta às 10h?','Perfeito, contrato enviado no seu email.','','Dá sim, integra com o direct.','Que pena! Se mudar de ideia, estamos aqui.','',''];
  i int; c uuid; l uuid; cv uuid; st uuid; t uuid; ago interval;
begin
  select id into pid from pipelines where workspace_id = ws order by created_at limit 1;
  select id into ch from channels where workspace_id = ws and kind = 'webchat' limit 1;
  select id into lost_reason from loss_reasons where workspace_id = ws order by sort limit 1;
  select id into ttype from task_types where workspace_id = ws order by sort limit 1;
  for i in 1..array_length(names, 1) loop
    ago := make_interval(hours => i * 7);
    insert into contacts (workspace_id, name, responsible_user_id, created_by, created_at)
      values (ws, names[i], uid, uid, now() - ago) returning id into c;
    insert into contact_identities (workspace_id, contact_id, kind, value, is_primary)
      values (ws, c, 'phone', '+55319' || lpad((87650000 + i * 137)::text, 8, '0'), true);
    select id into st from stages where pipeline_id = pid and sort = sorts[i];
    insert into leads (workspace_id, name, pipeline_id, stage_id, responsible_user_id, price_cents, source, channel_id,
                       loss_reason_id, created_by, created_at, last_activity_at)
      values (ws, deals[i], pid, st, uid, prices[i], case when i % 3 = 0 then 'manual' else 'site' end, ch,
              case when sorts[i] = 91 then lost_reason end, uid, now() - ago, now() - ago / 2)
      returning id into l;
    insert into lead_contacts (lead_id, contact_id, workspace_id, is_main) values (l, c, ws, true);
    if tagsets[i] <> '' then
      insert into tags (workspace_id, name) values (ws, tagsets[i]) on conflict (workspace_id, name) do nothing;
      select id into t from tags where workspace_id = ws and name = tagsets[i];
      insert into lead_tags (lead_id, tag_id, workspace_id) values (l, t, ws) on conflict do nothing;
    end if;
    -- conversa pelo chat do site: pergunta do cliente e, quando tem, a resposta da equipe
    insert into conversations (workspace_id, channel_id, contact_id, lead_id, external_thread_id, status, created_at)
      values (ws, ch, c, l, 'demo-' || replace(gen_random_uuid()::text, '-', ''), 'open', now() - ago) returning id into cv;
    insert into messages (workspace_id, conversation_id, channel_id, direction, body, status, sent_at)
      values (ws, cv, ch, 'in', ask[i], 'received', now() - ago);
    if reply[i] <> '' then
      insert into messages (workspace_id, conversation_id, channel_id, direction, body, sender_user_id, status, sent_at)
        values (ws, cv, ch, 'out', reply[i], uid, 'read', now() - ago + interval '6 minutes');
    end if;
    update conversations
       set last_inbound_at = now() - ago,
           last_message_at = now() - ago + case when reply[i] <> '' then interval '6 minutes' else interval '0' end,
           last_message_preview = case when reply[i] <> '' then reply[i] else ask[i] end,
           unread_count = case when reply[i] <> '' then 0 else 1 end,
           is_unanswered = reply[i] = ''
     where id = cv;
    -- próxima tarefa nos negócios abertos (uma atrasada, para o painel mostrar o alerta)
    if sorts[i] < 90 and i <> 4 then
      insert into tasks (workspace_id, lead_id, task_type_id, responsible_user_id, text, due_at, created_by)
        values (ws, l, ttype, uid,
                (array['Ligar para confirmar horários','Enviar tabela de preços','Mandar proposta revisada','Confirmar reunião','Retornar contato'])[1 + i % 5],
                case when i = 2 then now() - interval '3 hours' else now() + make_interval(hours => i * 5) end, uid);
    end if;
  end loop;
end $$;

-- nova empresa de demonstração para um usuário já criado (plano Operação liberado, sem cobrança)
create or replace function platform_create_demo(p_user uuid, p_name text, p_slug text) returns text
language plpgsql security definer set search_path = public as $$
declare ws uuid; r_admin uuid; pid uuid;
begin
  if exists (select 1 from workspaces where slug = p_slug) then
    raise exception 'slug_taken' using errcode = '23505'; end if;
  insert into profiles (id, full_name, email)
    select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', ''), u.email from auth.users u where u.id = p_user
    on conflict (id) do nothing;
  insert into workspaces (name, slug, created_by, is_demo) values (p_name, p_slug, p_user, true) returning id into ws;
  insert into roles (workspace_id, name, is_admin, rights) values (ws, 'Admin', true, '{}') returning id into r_admin;
  insert into roles (workspace_id, name, rights) values
    (ws, 'Gerente', '{"leads":{"view":"all","edit":"all","delete":"team","add":true},"contacts":{"view":"all","edit":"all","delete":"team","add":true},"companies":{"view":"all","edit":"all","delete":"team","add":true},"tasks":{"view":"all","edit":"all"}}'),
    (ws, 'Vendedor', '{"leads":{"view":"own","edit":"own","delete":"none","add":true},"contacts":{"view":"own","edit":"own","delete":"none","add":true},"companies":{"view":"all","edit":"own","delete":"none","add":true},"tasks":{"view":"own","edit":"own"}}');
  insert into memberships (workspace_id, user_id, role_id) values (ws, p_user, r_admin);
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
  insert into subscriptions (workspace_id, plan, status) values (ws, 'pro', 'active');
  perform private.seed_demo(ws, p_user);
  return p_slug;
end $$;

-- volta a demonstração ao estado inicial (apaga o que o cliente mexeu e semeia de novo)
create or replace function platform_reset_demo(p_ws uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not exists (select 1 from workspaces where id = p_ws and is_demo) then
    raise exception 'not_demo' using errcode = '22023'; end if;
  select m.user_id into uid from memberships m join roles r on r.id = m.role_id
   where m.workspace_id = p_ws and r.is_admin order by m.created_at limit 1;
  delete from tasks where workspace_id = p_ws;
  delete from notes where workspace_id = p_ws;
  delete from conversations where workspace_id = p_ws;
  delete from leads where workspace_id = p_ws;
  delete from contacts where workspace_id = p_ws;
  delete from companies where workspace_id = p_ws;
  delete from tags where workspace_id = p_ws;
  perform private.seed_demo(p_ws, uid);
end $$;

revoke execute on function platform_workspaces() from public, anon, authenticated;
revoke execute on function private.seed_demo(uuid, uuid) from public, anon, authenticated;
revoke execute on function platform_create_demo(uuid, text, text) from public, anon, authenticated;
revoke execute on function platform_reset_demo(uuid) from public, anon, authenticated;
grant execute on function platform_workspaces() to service_role;
grant execute on function private.seed_demo(uuid, uuid) to service_role;
grant execute on function platform_create_demo(uuid, text, text) to service_role;
grant execute on function platform_reset_demo(uuid) to service_role;
