// Popula um projeto Supabase de DESENVOLVIMENTO com dados fictícios (nenhuma pessoa real).
// Uso:  SEED_EMAIL=voce+demo@exemplo.com SEED_PASSWORD=... node --env-file=.env.local scripts/seed.mjs
// Nunca rode contra produção: o script recusa se APP_URL não for localhost.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const { SEED_EMAIL: email, SEED_PASSWORD: password, APP_URL = "" } = process.env;
if (!url || !secret || !pub) throw new Error("Faltam variáveis do Supabase (.env.local)");
if (!email || !password) throw new Error("Defina SEED_EMAIL e SEED_PASSWORD (conta de teste)");
if (!/localhost|127\.0\.0\.1/.test(APP_URL)) throw new Error("Seed só em desenvolvimento (APP_URL precisa ser localhost)");

const admin = createClient(url, secret, { auth: { persistSession: false } });

// 1) usuário de teste confirmado
const { data: created, error: e1 } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Ana Souza" } });
if (e1 && !/already/i.test(e1.message)) throw e1;
console.log(created?.user ? "usuário criado" : "usuário já existia");

// 2) entra como ele e cria a empresa pelo mesmo caminho do onboarding (RPC + RLS)
const user = createClient(url, pub, { auth: { persistSession: false } });
const { error: e2 } = await user.auth.signInWithPassword({ email, password });
if (e2) throw e2;
const { error: e3 } = await user.rpc("create_workspace", { p_name: "Loja Demo", p_slug: "demo", p_timezone: "America/Sao_Paulo", p_currency: "BRL" });
if (e3 && !/slug_taken/.test(e3.message)) throw e3;

const { data: ws } = await user.from("workspaces").select("id").eq("slug", "demo").single();
const { data: pipe } = await user.from("pipelines").select("id, stages(id, kind, sort)").eq("workspace_id", ws.id).single();
const open = pipe.stages.filter((s) => s.kind === "open").sort((a, b) => a.sort - b.sort);
const me = (await user.auth.getUser()).data.user.id;

// 3) alguns leads e contatos fictícios
const people = [
  ["Marina Alves", "+5511988881234", "Clínica Vida — 2 implantes", 1250000, 0],
  ["Carlos Reis", "+5511977772222", "Pet Shop Bicho Feliz — plano anual", 480000, 1],
  ["Joana Prado", "+5521966663333", "Escola Saber — 3 unidades", 3600000, 2],
  ["Rafael Torres", "+5531955554444", "Rafael Torres — consultoria", 900000, 3],
];
for (const [name, phone, deal, cents, st] of people) {
  const { data: c } = await user.from("contacts").insert({ workspace_id: ws.id, name, responsible_user_id: me, created_by: me }).select("id").single();
  await user.from("contact_identities").insert({ workspace_id: ws.id, contact_id: c.id, kind: "phone", value: phone, is_primary: true });
  const { data: l } = await user.from("leads").insert({ workspace_id: ws.id, pipeline_id: pipe.id, stage_id: open[st].id, name: deal, price_cents: cents, responsible_user_id: me, created_by: me }).select("id").single();
  await user.from("lead_contacts").insert({ lead_id: l.id, contact_id: c.id, workspace_id: ws.id, is_main: true });
}

// 4) um visitante desconhecido no chat do site (vira lead de entrada)
const { data: ch } = await admin.from("channels").select("id").eq("workspace_id", ws.id).eq("kind", "webchat").single();
await admin.rpc("receive_inbound", { p_channel: ch.id, p_thread: "v-seed-0001", p_sender_name: "Visitante 0001", p_body: "Boa tarde, quanto custa a consulta?", p_external_id: "seed-1" });

console.log("pronto: /demo/leads");
