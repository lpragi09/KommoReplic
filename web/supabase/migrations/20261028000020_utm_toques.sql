-- UTMs com histórico: a conversa guarda o 1º contato e o caminho (o app junta os toques); o lead acompanha a conversa.
create or replace function private.conversation_attribution_to_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null and new.attribution is not null then
    update leads set attribution = new.attribution
     where id = new.lead_id
       and (attribution is null or attribution is distinct from new.attribution)
       and coalesce(attribution ->> 'via', '') <> 'manual'; -- origem preenchida à mão pela equipe não é sobrescrita
  end if;
  return null;
end $$;
