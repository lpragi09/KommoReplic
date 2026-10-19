-- netzer tech · anexos na conversa. Rode depois de atualizacao-notificacoes.sql. Pode rodar de novo.

-- Anexos no chat do site: o visitante também vê o arquivo que a equipe mandou.
-- A função passa a devolver o tipo e o arquivo (o link temporário é gerado no servidor).
drop function if exists public.visitor_thread(text, text);
create function public.visitor_thread(p_key text, p_thread text)
returns table (id uuid, direction text, body text, sent_at timestamptz, kind text, file_id uuid, file_name text, file_mime text, file_size bigint, file_path text)
language sql stable security definer set search_path = public as $$
  select m.id, m.direction, m.body, m.sent_at, m.kind, f.id, f.name, f.mime, f.size_bytes, f.storage_path
  from channels c
  join conversations cv on cv.channel_id = c.id and cv.external_thread_id = p_thread
  join messages m on m.conversation_id = cv.id
  left join files f on f.id = m.file_id
  where c.kind = 'webchat' and c.public_key = p_key
  order by m.sent_at
$$;
revoke execute on function public.visitor_thread(text, text) from public, anon, authenticated;
grant execute on function public.visitor_thread(text, text) to service_role;

-- prévia da conversa: anexo sem legenda aparece como "[foto]", "[áudio]"...
create or replace function private.after_outbound() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.direction = 'out' then
    update conversations set last_message_at = new.sent_at,
      last_message_preview = left(coalesce(nullif(new.body, ''), case new.kind when 'image' then '[foto]' when 'audio' then '[áudio]' when 'video' then '[vídeo]' when 'file' then '[arquivo]' else '' end), 200),
      is_unanswered = false, unread_count = 0, assigned_user_id = coalesce(assigned_user_id, new.sender_user_id)
    where id = new.conversation_id;
    update leads set last_activity_at = now()
    where id = (select lead_id from conversations where id = new.conversation_id);
  end if;
  return null;
end $$;
