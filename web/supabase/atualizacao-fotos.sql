-- netzer · foto de perfil e logo da empresa. Rode depois de atualizacao-canais.sql. Pode rodar de novo.

-- Foto de perfil de cada pessoa e logo da empresa. A imagem chega já reduzida (160px, webp/jpeg) como data URL.
alter table profiles add column if not exists avatar text;
alter table profiles drop constraint if exists profiles_avatar_check;
alter table profiles add constraint profiles_avatar_check check (avatar is null or (char_length(avatar) <= 200000 and avatar ~ '^data:image/(webp|jpeg|png);base64,'));

alter table workspaces add column if not exists logo text;
alter table workspaces drop constraint if exists workspaces_logo_check;
alter table workspaces add constraint workspaces_logo_check check (logo is null or (char_length(logo) <= 200000 and logo ~ '^data:image/(webp|jpeg|png);base64,'));
