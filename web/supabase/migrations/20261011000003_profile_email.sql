-- O app lista colegas com nome e email; auth.users não é exposto pela API.
alter table profiles add column if not exists email text;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

-- mantém o email em dia quando o usuário troca no Auth
create or replace function private.sync_user_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles set email = new.email where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email after update of email on auth.users
  for each row execute function private.sync_user_email();

update profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- FKs para profiles (além das que apontam para auth.users), para a API embutir nome e email
alter table memberships add constraint memberships_profile_fk foreign key (user_id) references profiles(id) on delete cascade;
alter table tasks add constraint tasks_responsible_profile_fk foreign key (responsible_user_id) references profiles(id) on delete restrict;
alter table contacts add constraint contacts_responsible_profile_fk foreign key (responsible_user_id) references profiles(id) on delete set null;

-- excluir a conta não pode travar por ter criado uma empresa que continua com outras pessoas
alter table workspaces alter column created_by drop not null;
alter table workspaces drop constraint workspaces_created_by_fkey;
alter table workspaces add constraint workspaces_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
