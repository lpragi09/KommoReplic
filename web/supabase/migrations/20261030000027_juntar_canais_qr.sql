-- Cada reconexão do QR criava um canal novo e a mesma pessoa aparecia em duas conversas. Junta tudo no canal
-- por QR conectado de cada empresa (mensagens repetidas são apagadas) e remove os canais antigos.
do $$
declare keep record; old record;
begin
  perform set_config('netzer.quiet', '1', true);
  for keep in select id, workspace_id from channels where kind = 'whatsapp' and external_id like 'qr:%' and status = 'connected' loop
    for old in select id from channels where workspace_id = keep.workspace_id and kind = 'whatsapp' and external_id like 'qr:%' and id <> keep.id loop
      delete from messages m using messages k where m.channel_id = old.id and k.channel_id = keep.id and k.external_id = m.external_id;
      update messages m set channel_id = keep.id, conversation_id = k.id
        from conversations o join conversations k on k.channel_id = keep.id and k.external_thread_id = o.external_thread_id
        where o.channel_id = old.id and m.conversation_id = o.id;
      update incoming_leads i set conversation_id = k.id, channel_id = keep.id
        from conversations o join conversations k on k.channel_id = keep.id and k.external_thread_id = o.external_thread_id
        where o.channel_id = old.id and i.conversation_id = o.id and i.status <> 'pending';
      update conversations k set lead_id = coalesce(k.lead_id, o.lead_id)
        from conversations o where o.channel_id = old.id and k.channel_id = keep.id and k.external_thread_id = o.external_thread_id;
      delete from conversations o using conversations k where o.channel_id = old.id and k.channel_id = keep.id and k.external_thread_id = o.external_thread_id;
      update conversations set channel_id = keep.id where channel_id = old.id;
      update messages set channel_id = keep.id where channel_id = old.id;
      update incoming_leads set channel_id = keep.id where channel_id = old.id;
      update leads set channel_id = keep.id where channel_id = old.id;
      delete from channels where id = old.id;
    end loop;
    update conversations c set last_message_at = s.mx
      from (select conversation_id, max(sent_at) mx from messages where channel_id = keep.id group by 1) s
      where s.conversation_id = c.id;
  end loop;
end $$;
