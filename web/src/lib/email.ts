import "server-only";
import { BRAND } from "@/lib/brand";

/* Email transacional pelo Resend (API REST). Precisa de RESEND_API_KEY e EMAIL_FROM
   (ex.: "netzer <convites@seudominio.com.br>", com o domínio verificado no Resend).
   Sem essas variáveis não envia nada e devolve false: quem chamou mostra o link para mandar à mão. */

export const emailOn = () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }) {
  if (!emailOn()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("[email] Resend respondeu", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error("[email] falhou", e instanceof Error ? e.message : e);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** convite para a equipe: texto simples + HTML enxuto (bom em qualquer cliente de email) */
export function inviteEmail(o: { workspace: string; inviter: string; role: string; url: string }) {
  const subject = `${o.inviter} te convidou para ${o.workspace} no ${BRAND.name}`;
  const text = `${o.inviter} te convidou para entrar na equipe de ${o.workspace} no ${BRAND.name}, como ${o.role}.

Aceite pelo link (vale 7 dias):
${o.url}

Se você não esperava este convite, é só ignorar.`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f7f5;font-family:Segoe UI,Arial,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0">
<tr><td style="font-size:20px;font-weight:600;color:#1f7a55">${esc(BRAND.name)}</td></tr>
<tr><td style="padding-top:20px;font-size:16px;line-height:1.5"><strong>${esc(o.inviter)}</strong> te convidou para entrar na equipe de <strong>${esc(o.workspace)}</strong>, como ${esc(o.role)}.</td></tr>
<tr><td style="padding:28px 0"><a href="${esc(o.url)}" style="display:inline-block;background:#1f7a55;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Aceitar convite</a></td></tr>
<tr><td style="font-size:13px;color:#555;line-height:1.5">O link vale 7 dias e só funciona para este email. Se o botão não abrir, copie: <br><span style="word-break:break-all">${esc(o.url)}</span></td></tr>
<tr><td style="padding-top:20px;font-size:12px;color:#888">Se você não esperava este convite, é só ignorar.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

/** email escrito no CRM (texto simples com {{variáveis}} já trocadas) → HTML enxuto + rodapé com descadastro */
export function marketingEmail(o: { company: string; text: string; unsubscribe: string | null }) {
  const paras = o.text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const foot = o.unsubscribe
    ? `Você recebe este email por ser contato de ${esc(o.company)}. <a href="${esc(o.unsubscribe)}" style="color:#888">Não quero mais receber</a>.`
    : `Enviado por ${esc(o.company)}.`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f7f5;font-family:Segoe UI,Arial,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;padding:28px" cellpadding="0" cellspacing="0"><tr><td>${paras}</td></tr></table>
<p style="max-width:560px;font-size:12px;color:#888;line-height:1.5;margin:14px auto 0">${foot}</p>
</td></tr></table></body></html>`;
  const text = o.unsubscribe ? `${o.text}\n\n—\nNão quer mais receber? ${o.unsubscribe}` : o.text;
  return { html, text };
}

export type OutEmail = { to: string; subject: string; html: string; text: string; unsubscribe?: string | null };

/** vários emails de uma vez (Resend: até 100 por pedido). Devolve quantos o Resend aceitou. */
export async function sendEmailBatch(list: OutEmail[]) {
  if (!emailOn() || !list.length) return 0;
  let ok = 0;
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify(
          chunk.map((m) => ({
            from: process.env.EMAIL_FROM,
            to: [m.to],
            subject: m.subject,
            html: m.html,
            text: m.text,
            // descadastro em um clique (Gmail, Outlook): POST direto na rota da API
            ...(m.unsubscribe ? { headers: { "List-Unsubscribe": `<${m.unsubscribe.replace("/descadastrar/", "/api/descadastrar/")}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
          })),
        ),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) ok += chunk.length;
      else console.error("[email] lote recusado", res.status, (await res.text().catch(() => "")).slice(0, 300));
    } catch (e) {
      console.error("[email] lote falhou", e instanceof Error ? e.message : e);
    }
  }
  return ok;
}
