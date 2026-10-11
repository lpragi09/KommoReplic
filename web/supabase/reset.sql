-- Recadi: APAGA tudo o que o setup.sql criou (tabelas, dados, funções, regras de acesso).
-- Use só num projeto de teste, quando o setup rodou pela metade ou você quer começar do zero.
-- Depois rode o setup.sql de novo.
-- Não mexe nos usuários do Auth nem no bucket de arquivos (o setup reaproveita o bucket).

drop policy if exists rt_member on realtime.messages;
drop policy if exists att_read on storage.objects;
drop policy if exists att_write on storage.objects;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_email on auth.users;

drop function if exists public.accept_incoming_lead(uuid, uuid) cascade;
drop function if exists public.create_workspace(text, text, text, text) cascade;
drop function if exists public.decline_incoming_lead(uuid) cascade;
drop function if exists public.link_incoming_lead(uuid, uuid) cascade;
drop function if exists public.receive_inbound(uuid, text, text, text, text) cascade;
drop function if exists public.visitor_thread(text, text) cascade;

drop table if exists
  automation_runs, automations, webhook_endpoints, inbound_webhooks, notifications, subscriptions,
  incoming_leads, messages, conversations, templates, channels, files,
  events, notes, tasks, task_types, lead_tags, contact_tags, tags, lead_subscribers, lead_contacts,
  leads, contact_identities, contacts, companies, custom_fields, field_groups,
  loss_reasons, stages, pipelines, invitations, memberships, roles, teams, profiles, workspaces
cascade;

drop schema if exists private cascade;
