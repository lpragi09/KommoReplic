-- Gatilhos novos no funil digital: etiqueta adicionada, campo alterado, cliente sem responder e todo dia no horário.
alter table robots drop constraint if exists robots_trigger_check;
alter table robots add constraint robots_trigger_check
  check (trigger in ('stage_enter','lead_created','message_in','new_contact','responsible_changed','tag_added','field_changed','no_reply','schedule_daily'));
alter table robots drop constraint if exists robot_daily_needs_stage;
alter table robots add constraint robot_daily_needs_stage check (trigger <> 'schedule_daily' or stage_id is not null);
create index if not exists robots_daily on robots (trigger) where is_active and trigger = 'schedule_daily';
