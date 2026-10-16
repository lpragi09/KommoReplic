/* Regras de mensagem por rede social, usadas no editor de modelos (limites, botões, janela de resposta).
   Fontes: documentação pública da Meta (WhatsApp Cloud API, Instagram e Messenger Platform) e, para o TikTok,
   guias de provedores (respond.io, Chatwoot) — a TikTok não publica um guia aberto; conferir ao conectar o canal. */

export type Network = "whatsapp" | "instagram" | "messenger" | "tiktok" | "webchat";
export type WaCategory = "marketing" | "utility" | "authentication";

export type NetworkRules = {
  label: string;
  maxBody: number;
  header: number | null; // limite do título, null = não tem
  footer: number | null;
  quickReplies: { max: number; maxChars: number } | null;
  linkButtons: { max: number; maxChars: number } | null;
  /** janela para responder depois da última mensagem do cliente */
  window: string;
  approval: boolean;
  notes: string[];
  approximate?: boolean;
};

export const RULES: Record<Network, NetworkRules> = {
  whatsapp: {
    label: "WhatsApp",
    maxBody: 1024,
    header: 60,
    footer: 60,
    quickReplies: { max: 3, maxChars: 25 },
    linkButtons: { max: 2, maxChars: 25 },
    window: "24 horas. Fora disso, só modelo aprovado pela Meta.",
    approval: true,
    notes: ["Precisa ser aprovado pela Meta antes do 1º uso (de minutos a 24h).", "Sem links encurtados e sem pedir dados sensíveis.", "Variáveis viram {{1}}, {{2}}… ao enviar para aprovação."],
  },
  instagram: {
    label: "Instagram",
    maxBody: 1000,
    header: null,
    footer: null,
    quickReplies: { max: 13, maxChars: 20 },
    linkButtons: null,
    window: "24 horas depois da última mensagem do cliente (7 dias com atendimento humano).",
    approval: false,
    notes: ["Não precisa de aprovação.", "Só responde quem escreveu primeiro: não dá para iniciar conversa."],
  },
  messenger: {
    label: "Facebook Messenger",
    maxBody: 2000,
    header: null,
    footer: null,
    quickReplies: { max: 13, maxChars: 20 },
    linkButtons: { max: 3, maxChars: 20 },
    window: "24 horas. Depois, só com etiquetas de mensagem (ex.: atualização de pedido).",
    approval: false,
    notes: ["Não precisa de aprovação.", "Com botões de link, o texto fica limitado a 640 caracteres."],
  },
  tiktok: {
    label: "TikTok",
    maxBody: 6000,
    header: null,
    footer: null,
    quickReplies: null,
    linkButtons: null,
    window: "48 horas depois da mensagem do cliente; até 10 mensagens suas enquanto ele não responder.",
    approval: false,
    notes: ["Não dá para iniciar conversa nem fazer disparo.", "Sem botões; imagens só JPG/PNG até 3 MB."],
    approximate: true,
  },
  webchat: {
    label: "Chat do site",
    maxBody: 2000,
    header: null,
    footer: null,
    quickReplies: { max: 6, maxChars: 30 },
    linkButtons: { max: 3, maxChars: 30 },
    window: "Sem janela: responda quando quiser.",
    approval: false,
    notes: ["Aparece igual para todos os visitantes do seu site."],
  },
};

export const WA_CATEGORIES: Record<WaCategory, { label: string; text: string; cost: string }> = {
  marketing: {
    label: "Marketing",
    text: "Promoções, ofertas, novidades, convite para voltar. Qualquer mensagem que tente vender.",
    cost: "A mais cara por conversa iniciada.",
  },
  utility: {
    label: "Utilidade",
    text: "Confirmação de pedido, agendamento, atualização de entrega, lembrete de pagamento.",
    cost: "Mais barata; grátis dentro da janela de 24h aberta pelo cliente.",
  },
  authentication: {
    label: "Autenticação",
    text: "Código de verificação (senha de uso único). Texto fixo definido pela Meta.",
    cost: "A mais barata. Só serve para códigos.",
  },
};

export type TemplateButton = { kind: "reply" | "url"; text: string; url?: string };

/** Problemas do modelo segundo as regras da rede escolhida (lista vazia = pode salvar). */
export function checkTemplate(net: Network, t: { body: string; header?: string; footer?: string; buttons: TemplateButton[]; category?: WaCategory | null }) {
  const r = RULES[net];
  const out: string[] = [];
  const body = t.body.trim();
  const links = t.buttons.filter((b) => b.kind === "url");
  const replies = t.buttons.filter((b) => b.kind === "reply");
  const maxBody = net === "messenger" && links.length ? 640 : r.maxBody;
  if (!body) out.push("Escreva o texto da mensagem.");
  if (body.length > maxBody) out.push(`Texto passou do limite do ${r.label}: ${body.length}/${maxBody}.`);
  if (t.header && r.header === null) out.push(`${r.label} não tem título.`);
  if (t.header && r.header !== null && t.header.length > r.header) out.push(`Título com mais de ${r.header} caracteres.`);
  if (t.footer && r.footer !== null && t.footer.length > r.footer) out.push(`Rodapé com mais de ${r.footer} caracteres.`);
  if (replies.length && !r.quickReplies) out.push(`${r.label} não aceita botões de resposta.`);
  if (r.quickReplies && replies.length > r.quickReplies.max) out.push(`No máximo ${r.quickReplies.max} respostas rápidas no ${r.label}.`);
  if (links.length && !r.linkButtons) out.push(`${r.label} não aceita botões de link.`);
  if (r.linkButtons && links.length > r.linkButtons.max) out.push(`No máximo ${r.linkButtons.max} botões de link no ${r.label}.`);
  for (const b of t.buttons) {
    const lim = b.kind === "reply" ? r.quickReplies?.maxChars : r.linkButtons?.maxChars;
    if (!b.text.trim()) out.push("Há um botão sem texto.");
    else if (lim && b.text.length > lim) out.push(`Botão “${b.text}” passou de ${lim} caracteres.`);
    if (b.kind === "url" && !/^https:\/\/\S+\.\S+/.test(b.url ?? "")) out.push(`Botão “${b.text || "link"}” precisa de um endereço https:// válido.`);
  }
  if (net === "whatsapp") {
    if (!t.category) out.push("Escolha a categoria do WhatsApp (Marketing, Utilidade ou Autenticação).");
    if (/https?:\/\/(bit\.ly|tinyurl\.com|encurtador)/i.test(body)) out.push("WhatsApp recusa links encurtados.");
    if (/^\s*\{\{|\}\}\s*$/.test(body)) out.push("No WhatsApp a mensagem não pode começar nem terminar com variável.");
  }
  return [...new Set(out)];
}
