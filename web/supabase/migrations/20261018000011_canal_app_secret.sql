-- Chave secreta do app da Meta por canal (cifrada), para empresas que usam o próprio app:
-- o webhook confere a assinatura de cada aviso com ela (ou com a META_APP_SECRET do netzer).
alter table channel_secrets add column if not exists app_secret_enc text;
