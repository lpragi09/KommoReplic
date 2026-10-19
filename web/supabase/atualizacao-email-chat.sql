-- netzer · emails (descadastro, disparo por email) e anexo no chat da equipe. Rode depois de atualizacao-gatilhos.sql. Pode rodar de novo.

-- Email: descadastro por contato e disparos por email (assunto). Chat da equipe com anexo.
alter table contacts add column if not exists email_opt_out boolean not null default false;
alter table broadcasts add column if not exists medium text not null default 'message';
alter table broadcasts drop constraint if exists broadcasts_medium_check;
alter table broadcasts add constraint broadcasts_medium_check check (medium in ('message','email'));
alter table broadcasts add column if not exists subject text check (subject is null or char_length(subject) <= 200);
alter table broadcasts drop constraint if exists broadcasts_body_check;
alter table broadcasts add constraint broadcasts_body_check check (char_length(body) between 1 and 5000);
alter table team_messages add column if not exists file_id uuid references files(id) on delete set null;
