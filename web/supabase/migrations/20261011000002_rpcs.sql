-- RPCs do app. Regras:
--  * security definer só quando a função precisa cruzar o RLS; aí ela checa permissão por conta própria;
--  * funções chamadas por webhook/visitante (receive_inbound, visitor_thread) só para service_role.

-- ---------------------------------------------------------------------------
-- criar workspace com tudo que o onboarding promete
-- ---------------------------------------------------------------------------
create or replace function public.create_workspace(p_name text, p_slug text, p_timezone text, p_currency text)
returns text language plpgsql security definer set search_path = public as $$
declare ws uuid; r_admin uuid; pid uuid; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  if p_slug in ('login','signup','onboarding','chat','design','api','_next') then
    raise exception 'slug_reserved' using errcode = '22023'; end if;
  if exists (select 1 from workspaces where slug = p_slug) then
    raise exception 'slug_taken' using errcode = '23505'; end if;

  insert into workspaces (name, slug, timezone, currency, created_by)
  values (p_name, p_slug, p_timezone, p_currency, uid) returning id into ws;

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
  insert into subscriptions (workspace_id, plan, status, trial_ends_at) values (ws, 'trial', 'trialing', now() + interval '14 days');
  return p_slug;
end $$;

-- ---------------------------------------------------------------------------
-- leads de entrada: recusar e vincular (aceitar está na 0001)
-- ---------------------------------------------------------------------------
create or replace function public.decline_incoming_lead(p_incoming uuid)
returns void language plpgsql security definer set search_path = public as $$
declare il incoming_leads;
begin
  select * into il from incoming_leads where id = p_incoming;
  if il.id is null or not private.is_member(il.workspace_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  update incoming_leads set status = 'declined', resolved_by = auth.uid(), resolved_at = now()
  where id = p_incoming and status = 'pending' returning * into il;
  if il.id is null then raise exception 'already_resolved' using errcode = 'P0001'; end if;
  update conversations set status = 'closed' where id = il.conversation_id;
end $$;

create or replace function public.link_incoming_lead(p_incoming uuid, p_lead uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare il incoming_leads; target uuid; lead_ws uuid;
begin
  select * into il from incoming_leads where id = p_incoming;
  if il.id is null or not private.is_member(il.workspace_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  select workspace_id into lead_ws from leads where id = p_lead;
  if lead_ws is distinct from il.workspace_id
     or not private.in_scope(il.workspace_id, 'leads', 'edit', (select responsible_user_id from leads where id = p_lead)) then
    raise exception 'forbidden' using errcode = '42501'; end if;

  update incoming_leads set status = 'linked', resolved_lead_id = p_lead, resolved_by = auth.uid(), resolved_at = now()
  where id = p_incoming and status = 'pending' returning * into il;
  if il.id is null then raise exception 'already_resolved' using errcode = 'P0001'; end if;

  select contact_id into target from lead_contacts where lead_id = p_lead and is_main;
  if target is not null and il.contact_id is not null and target <> il.contact_id then
    -- mescla: identidades e conversas do desconhecido passam para o contato do lead
    update contact_identities ci set contact_id = target
      where ci.contact_id = il.contact_id
        and not exists (select 1 from contact_identities x where x.contact_id = target and x.kind = ci.kind and x.value = ci.value);
    update conversations set contact_id = target where contact_id = il.contact_id;
    update incoming_leads set contact_id = target where contact_id = il.contact_id;
    delete from contacts where id = il.contact_id;
  elsif target is null and il.contact_id is not null then
    insert into lead_contacts (lead_id, contact_id, workspace_id, is_main) values (p_lead, il.contact_id, il.workspace_id, true);
  end if;
  update conversations set lead_id = p_lead, assigned_user_id = coalesce(assigned_user_id, auth.uid()) where id = il.conversation_id;
  insert into events (workspace_id, lead_id, kind, after, actor_user_id)
  values (il.workspace_id, p_lead, 'contact_linked', jsonb_build_object('incoming_id', p_incoming), auth.uid());
  update leads set last_activity_at = now() where id = p_lead;
  return p_lead;
end $$;

-- ---------------------------------------------------------------------------
-- mensagem recebida (webhook da Meta ou chat do site). Mesmo caminho para todos os canais.
-- Idempotente: a mesma external_id não grava duas vezes.
-- ---------------------------------------------------------------------------
create or replace function public.receive_inbound(p_channel uuid, p_thread text, p_sender_name text, p_body text, p_external_id text)
returns uuid language plpgsql security definer set search_path = public as $$
declare ch channels; conv conversations; ct uuid; msg uuid; id_kind text; lead uuid; body text := left(btrim(p_body), 4000);
begin
  select * into ch from channels where id = p_channel and status = 'connected';
  if ch.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if body = '' then raise exception 'invalid' using errcode = '22023'; end if;
  id_kind := case ch.kind when 'messenger' then 'messenger' else ch.kind end;

  select * into conv from conversations where channel_id = ch.id and external_thread_id = p_thread;
  if conv.id is null then
    select contact_id into ct from contact_identities where workspace_id = ch.workspace_id and kind = id_kind and value = p_thread;
    if ct is null then
      insert into contacts (workspace_id, name)
      values (ch.workspace_id, coalesce(nullif(left(btrim(p_sender_name), 80), ''), 'Visitante ' || right(p_thread, 4)))
      returning id into ct;
      insert into contact_identities (workspace_id, contact_id, kind, value) values (ch.workspace_id, ct, id_kind, p_thread);
    end if;
    select lc.lead_id into lead from lead_contacts lc join leads l on l.id = lc.lead_id
      where lc.contact_id = ct and l.deleted_at is null order by l.last_activity_at desc limit 1;
    insert into conversations (workspace_id, channel_id, contact_id, lead_id, external_thread_id)
    values (ch.workspace_id, ch.id, ct, lead, p_thread)
    on conflict (channel_id, external_thread_id) do nothing;
    select * into conv from conversations where channel_id = ch.id and external_thread_id = p_thread;
  end if;

  insert into messages (workspace_id, conversation_id, channel_id, direction, body, external_id, status)
  values (ch.workspace_id, conv.id, ch.id, 'in', body, p_external_id, 'received')
  on conflict (channel_id, external_id) where external_id is not null do nothing
  returning id into msg;
  if msg is null then return null; end if; -- repetido

  update conversations set status = 'open', unread_count = unread_count + 1, is_unanswered = true,
    last_message_at = now(), last_inbound_at = now(), last_message_preview = left(body, 200)
  where id = conv.id;

  if conv.lead_id is not null then
    update leads set last_activity_at = now() where id = conv.lead_id;
  else
    update incoming_leads set payload = jsonb_set(payload, '{preview}', to_jsonb(left(body, 200)))
      where conversation_id = conv.id and status = 'pending';
    if not found then
      insert into incoming_leads (workspace_id, pipeline_id, channel_id, conversation_id, contact_id, kind, payload)
      values (ch.workspace_id,
              coalesce(ch.default_pipeline_id, (select id from pipelines where workspace_id = ch.workspace_id order by sort limit 1)),
              ch.id, conv.id, conv.contact_id, 'chat', jsonb_build_object('preview', left(body, 200)))
      on conflict (conversation_id) where status = 'pending' do nothing;
    end if;
  end if;
  return msg;
end $$;

create or replace function public.visitor_thread(p_key text, p_thread text)
returns table (id uuid, direction text, body text, sent_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.direction, m.body, m.sent_at
  from channels c
  join conversations cv on cv.channel_id = c.id and cv.external_thread_id = p_thread
  join messages m on m.conversation_id = cv.id
  where c.kind = 'webchat' and c.public_key = p_key
  order by m.sent_at
$$;

-- ---------------------------------------------------------------------------
-- enviar mensagem: o vendedor insere direto (RLS) e um trigger arruma a conversa
-- ---------------------------------------------------------------------------
create policy msg_send on messages for insert to authenticated with check (
  direction = 'out' and sender_user_id = auth.uid()
  and exists (select 1 from conversations cv where cv.id = conversation_id and cv.channel_id = messages.channel_id)
);

create or replace function private.after_outbound() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.direction = 'out' then
    update conversations set last_message_at = new.sent_at, last_message_preview = left(new.body, 200),
      is_unanswered = false, unread_count = 0, assigned_user_id = coalesce(assigned_user_id, new.sender_user_id)
    where id = new.conversation_id;
    update leads set last_activity_at = now()
    where id = (select lead_id from conversations where id = new.conversation_id);
  end if;
  return null;
end $$;
create trigger after_outbound after insert on messages for each row execute function private.after_outbound();

-- perdido exige motivo (a UI já pede; o banco garante)
create or replace function private.lost_needs_reason() returns trigger
language plpgsql as $$
begin
  if (select kind from stages where id = new.stage_id) = 'lost' and new.loss_reason_id is null then
    raise exception 'loss_reason_required' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger lost_needs_reason before insert or update of stage_id, loss_reason_id on leads
  for each row execute function private.lost_needs_reason();

-- ---------------------------------------------------------------------------
-- quem pode chamar o quê
-- ---------------------------------------------------------------------------
revoke execute on function public.create_workspace(text, text, text, text) from public, anon;
revoke execute on function public.decline_incoming_lead(uuid) from public, anon;
revoke execute on function public.link_incoming_lead(uuid, uuid) from public, anon;
grant execute on function public.create_workspace(text, text, text, text) to authenticated;
grant execute on function public.decline_incoming_lead(uuid) to authenticated;
grant execute on function public.link_incoming_lead(uuid, uuid) to authenticated;
revoke execute on function public.receive_inbound(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.visitor_thread(text, text) from public, anon, authenticated;
grant execute on function public.receive_inbound(uuid, text, text, text, text) to service_role;
grant execute on function public.visitor_thread(text, text) to service_role;
