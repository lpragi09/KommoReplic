-- Histórico do WhatsApp por QR code: grava mensagens antigas (dos dois lados) na conversa do contato,
-- aberta na caixa de entrada mas já lida, sem criar lead de entrada e sem disparar robô. Quando o contato escrever de novo,
-- receive_inbound continua a mesma conversa e segue o fluxo normal. Repetida (mesmo id) é ignorada.
create or replace function public.import_history(p_channel uuid, p_thread text, p_sender_name text, p_body text, p_external_id text, p_out boolean, p_at timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare ch channels; conv conversations; ct uuid; msg uuid; lead uuid; body text := left(btrim(p_body), 4000);
begin
  perform set_config('netzer.quiet', '1', true); -- sem aviso ao vivo por mensagem (ver private.broadcast_change)
  select * into ch from channels where id = p_channel and status = 'connected';
  if ch.id is null or body = '' then return false; end if;

  select * into conv from conversations where channel_id = ch.id and external_thread_id = p_thread;
  if conv.id is null then
    select contact_id into ct from contact_identities where workspace_id = ch.workspace_id and kind = 'whatsapp' and value = p_thread;
    if ct is null then
      insert into contacts (workspace_id, name)
      values (ch.workspace_id, coalesce(nullif(left(btrim(p_sender_name), 80), ''), '+' || regexp_replace(p_thread, '\D', '', 'g')))
      returning id into ct;
      insert into contact_identities (workspace_id, contact_id, kind, value) values (ch.workspace_id, ct, 'whatsapp', p_thread);
    end if;
    select lc.lead_id into lead from lead_contacts lc join leads l on l.id = lc.lead_id
      where lc.contact_id = ct and l.deleted_at is null order by l.last_activity_at desc limit 1;
    insert into conversations (workspace_id, channel_id, contact_id, lead_id, external_thread_id, status)
    values (ch.workspace_id, ch.id, ct, lead, p_thread, 'open')
    on conflict (channel_id, external_thread_id) do nothing;
    select * into conv from conversations where channel_id = ch.id and external_thread_id = p_thread;
  end if;

  insert into messages (workspace_id, conversation_id, channel_id, direction, body, external_id, status, sent_at, created_at)
  values (ch.workspace_id, conv.id, ch.id, case when p_out then 'out' else 'in' end, body, p_external_id,
          case when p_out then 'sent' else 'received' end, p_at, p_at)
  on conflict (channel_id, external_id) where external_id is not null do nothing
  returning id into msg;
  if msg is null then return false; end if;

  -- a prévia e a data só andam para frente (o histórico chega fora de ordem)
  update conversations set
    last_message_at = greatest(coalesce(last_message_at, p_at), p_at),
    last_message_preview = case when last_message_at is null or p_at >= last_message_at then left(body, 200) else last_message_preview end,
    last_inbound_at = case when p_out then last_inbound_at else greatest(coalesce(last_inbound_at, p_at), p_at) end
  where id = conv.id;
  return true;
end $$;

revoke execute on function public.import_history(uuid, text, text, text, text, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.import_history(uuid, text, text, text, text, boolean, timestamptz) to service_role;

-- conversas importadas antes desta versão entraram fechadas (a caixa de entrada só mostra as abertas)
update conversations c set status = 'open'
from channels ch
where ch.id = c.channel_id and ch.config->>'provider' = 'qr' and c.status = 'closed' and c.unread_count = 0;

-- Aviso ao vivo (realtime) pula o que vem da importação de histórico: milhares de mensagens seguidas faziam
-- todo navegador aberto recarregar a tela sem parar. A importação liga "netzer.quiet" só na própria transação.
create or replace function private.broadcast_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  if coalesce(current_setting('netzer.quiet', true), '') = '1' then return null; end if;
  rec := coalesce(new, old);
  perform realtime.send(
    jsonb_build_object('table', tg_table_name, 'op', tg_op, 'id', rec.id),
    'change', 'ws:' || rec.workspace_id::text, true);
  return null;
end $$;
