-- Gatilhos de etapa (estilo funil digital do Kommo): novo gatilho "quando o responsável muda",
-- que também pode guardar a etapa (só leads daquela etapa).
alter table robots drop constraint if exists robots_trigger_check;
alter table robots add constraint robots_trigger_check
  check (trigger in ('stage_enter','lead_created','message_in','new_contact','responsible_changed'));
