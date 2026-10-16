import type { ChannelKind, RobotInput, RobotStep, RobotStepType, RobotTrigger } from "@/data/types";

/* Textos e modelos prontos dos robôs. Sem nada de servidor: usado pelas telas e pelo motor. */

export const VARIABLES = [
  { key: "nome", label: "Primeiro nome" },
  { key: "nome_completo", label: "Nome completo" },
  { key: "empresa", label: "Sua empresa" },
  { key: "responsavel", label: "Responsável" },
  { key: "lead", label: "Nome do lead" },
  { key: "utm_campaign", label: "Campanha (UTM)" },
  { key: "utm_source", label: "Fonte (UTM)" },
] as const;

export function humanMinutes(min: number) {
  if (min > 0 && min % 1440 === 0) return `${min / 1440} ${min === 1440 ? "dia" : "dias"}`;
  if (min > 0 && min % 60 === 0) return `${min / 60} ${min === 60 ? "hora" : "horas"}`;
  return `${min} min`;
}

export const TRIGGERS: Record<RobotTrigger, { label: string; hint: string }> = {
  stage_enter: { label: "Lead entra na etapa", hint: "Quando um lead for criado ou movido para a etapa escolhida." },
  lead_created: { label: "Lead novo no funil", hint: "Quando qualquer lead for criado no funil (à mão ou aceito da entrada)." },
  message_in: { label: "Mensagem recebida", hint: "A cada mensagem que chegar, opcionalmente só com certas palavras." },
  new_contact: { label: "Primeiro contato", hint: "Quando alguém novo escreve pela primeira vez em um canal." },
};

export const CHANNELS: { kind: ChannelKind; label: string }[] = [
  { kind: "whatsapp", label: "WhatsApp" },
  { kind: "instagram", label: "Instagram" },
  { kind: "messenger", label: "Messenger" },
  { kind: "webchat", label: "Chat do site" },
];
export const channelLabel = (k: ChannelKind) => CHANNELS.find((c) => c.kind === k)?.label ?? k;

export const STEP_TYPES: Record<RobotStepType, { label: string; hint: string }> = {
  message: { label: "Enviar mensagem", hint: "Responde na conversa do lead, no canal por onde ele falou." },
  wait: { label: "Esperar", hint: "Pausa o robô antes do próximo passo." },
  task: { label: "Criar tarefa", hint: "Lembrete para o responsável do lead." },
  tag: { label: "Adicionar etiqueta", hint: "Marca o lead para filtrar depois." },
  responsible: { label: "Trocar responsável", hint: "Passa o lead para outra pessoa da equipe." },
  stage: { label: "Mover de etapa", hint: "Leva o lead para outra etapa do funil." },
  note: { label: "Adicionar nota", hint: "Registro interno no histórico do lead." },
};

const sid = () => Math.random().toString(36).slice(2, 10);

export function newStep(type: RobotStepType): RobotStep {
  const id = sid();
  switch (type) {
    case "message":
      return { id, type, text: "" };
    case "wait":
      return { id, type, minutes: 60 };
    case "task":
      return { id, type, text: "Retornar {{nome}}", dueMinutes: 60 };
    case "tag":
      return { id, type, tag: "" };
    case "responsible":
      return { id, type, userId: "" };
    case "stage":
      return { id, type, stageId: "" };
    case "note":
      return { id, type, text: "" };
  }
}

/** Robôs prontos para começar com um clique. `stage` é a posição da etapa no funil (0 = primeira; "won" = ganho). */
export type Preset = {
  key: string;
  title: string;
  text: string;
  stage?: number | "won";
  robot: Omit<RobotInput, "pipelineId" | "stageId">;
};

export const PRESETS: Preset[] = [
  {
    key: "boas-vindas",
    title: "Boas-vindas",
    text: "Lead caiu na primeira etapa: manda um oi na hora e cria a tarefa de responder.",
    stage: 0,
    robot: {
      name: "Boas-vindas",
      active: true,
      trigger: "stage_enter",
      channels: [],
      keywords: [],
      once: true,
      steps: [
        { id: sid(), type: "message", text: "Oi, {{nome}}! Aqui é da {{empresa}} 👋 Recebemos seu contato e já já alguém da equipe te responde por aqui." },
        { id: sid(), type: "task", text: "Responder {{nome}}", dueMinutes: 30 },
      ],
    },
  },
  {
    key: "follow-up",
    title: "Cobrar proposta",
    text: "Lead parado em proposta: espera 2 dias, pergunta se viu e avisa o responsável.",
    stage: 2,
    robot: {
      name: "Follow-up da proposta",
      active: true,
      trigger: "stage_enter",
      channels: [],
      keywords: [],
      once: true,
      steps: [
        { id: sid(), type: "wait", minutes: 2880 },
        { id: sid(), type: "message", text: "Oi, {{nome}}! Conseguiu dar uma olhada na proposta? Se quiser, ajusto alguma coisa." },
        { id: sid(), type: "task", text: "Ligar para {{nome}} sobre a proposta", dueMinutes: 1440 },
      ],
    },
  },
  {
    key: "preco",
    title: "Perguntou preço",
    text: "Mensagem com “preço”, “valor” ou “quanto”: responde e etiqueta o lead.",
    robot: {
      name: "Perguntou preço",
      active: true,
      trigger: "message_in",
      channels: [],
      keywords: ["preço", "preco", "valor", "quanto custa", "quanto é"],
      once: true,
      steps: [
        { id: sid(), type: "message", text: "Boa pergunta, {{nome}}! Já vou te passar os valores certinhos. Me conta rapidinho o que você precisa?" },
        { id: sid(), type: "tag", tag: "pediu preço" },
      ],
    },
  },
  {
    key: "primeiro-contato",
    title: "Primeiro contato nas redes",
    text: "Alguém novo escreveu no WhatsApp ou Instagram: responde na hora, mesmo fora do expediente.",
    robot: {
      name: "Resposta imediata nas redes",
      active: true,
      trigger: "new_contact",
      channels: ["whatsapp", "instagram", "messenger"],
      keywords: [],
      once: true,
      steps: [{ id: sid(), type: "message", text: "Oi! Obrigado por chamar a {{empresa}} 💙 Já recebemos sua mensagem e respondemos em instantes." }],
    },
  },
  {
    key: "pos-venda",
    title: "Pós-venda",
    text: "Venda ganha: agradece, espera 7 dias e pede uma avaliação.",
    stage: "won",
    robot: {
      name: "Pós-venda",
      active: true,
      trigger: "stage_enter",
      channels: [],
      keywords: [],
      once: true,
      steps: [
        { id: sid(), type: "message", text: "{{nome}}, muito obrigado pela confiança! Qualquer coisa, é só chamar aqui." },
        { id: sid(), type: "wait", minutes: 10080 },
        { id: sid(), type: "message", text: "Oi, {{nome}}! Como está sendo a experiência? Sua opinião ajuda muito a gente." },
        { id: sid(), type: "tag", tag: "pós-venda" },
      ],
    },
  },
];
