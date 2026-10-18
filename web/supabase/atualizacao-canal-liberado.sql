-- Recadi · número de canal desconectado fica livre. Rode depois de atualizacao-fotos.sql. Pode rodar de novo.

-- Canal desconectado não prende mais o número: outra empresa pode conectar a mesma conta depois.
-- O índice único passa a valer só para canais ativos (o webhook já procura só os conectados).
drop index if exists channels_external;
create unique index channels_external on channels (kind, external_id) where external_id is not null and status <> 'disconnected';
