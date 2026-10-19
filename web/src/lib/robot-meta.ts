import type { ChannelKind, RobotInput, RobotStep, RobotStepType, RobotTrigger, StepBranch } from "@/data/types";

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
  responsible_changed: { label: "Responsável muda", hint: "Quando o responsável do lead é trocado (opcionalmente só para leads de uma etapa)." },
  tag_added: { label: "Etiqueta adicionada", hint: "Quando alguém (ou um robô) coloca uma etiqueta no lead." },
  field_changed: { label: "Campo alterado", hint: "Quando o valor da venda ou um campo personalizado muda." },
  no_reply: { label: "Cliente sem responder", hint: "Depois de um tempo sem o cliente mandar mensagem." },
  schedule_daily: { label: "Todo dia no horário", hint: "Todo dia, no horário escolhido, para cada lead da etapa." },
};

export const CHANNELS: { kind: ChannelKind; label: string }[] = [
  { kind: "whatsapp", label: "WhatsApp" },
  { kind: "instagram", label: "Instagram" },
  { kind: "messenger", label: "Messenger" },
  { kind: "webchat", label: "Chat do site" },
];
export const channelLabel = (k: ChannelKind) => CHANNELS.find((c) => c.kind === k)?.label ?? k;

/** Passos agrupados como no menu do editor. `branches`: o passo abre caminhos (botões, regras). */
export const STEP_TYPES: Record<RobotStepType, { label: string; hint: string; group: "Conversa" | "Fluxo" | "Lead" | "Equipe" | "Integração" }> = {
  message: { label: "Enviar mensagem", hint: "Texto no canal do cliente. Com botões, cada resposta segue um caminho.", group: "Conversa" },
  wait_reply: { label: "Esperar resposta", hint: "Pausa até o cliente responder (ou o tempo acabar).", group: "Conversa" },
  validate: { label: "Pergunta com validação", hint: "Pergunta e confere a resposta: email, telefone, CPF, número.", group: "Conversa" },
  close: { label: "Fechar conversa", hint: "Marca a conversa como encerrada.", group: "Conversa" },
  email: { label: "Enviar email", hint: "Email para o contato principal do lead, com link de descadastro.", group: "Conversa" },
  condition: { label: "Condição (se / senão)", hint: "Segue por caminhos diferentes conforme a mensagem, a campanha ou a etiqueta.", group: "Fluxo" },
  wait: { label: "Esperar tempo", hint: "Pausa o robô antes do próximo passo.", group: "Fluxo" },
  start_robot: { label: "Iniciar outro robô", hint: "Passa o lead para outro robô.", group: "Fluxo" },
  stop: { label: "Parar", hint: "Termina o robô aqui.", group: "Fluxo" },
  task: { label: "Criar tarefa", hint: "Lembrete para o responsável do lead.", group: "Lead" },
  tag: { label: "Etiqueta", hint: "Adiciona ou remove uma etiqueta do lead.", group: "Lead" },
  stage: { label: "Mover de etapa", hint: "Leva o lead para outra etapa do funil.", group: "Lead" },
  set_field: { label: "Preencher campo", hint: "Grava um valor num campo personalizado do lead.", group: "Lead" },
  note: { label: "Adicionar nota", hint: "Registro interno no histórico do lead.", group: "Lead" },
  responsible: { label: "Trocar responsável", hint: "Passa o lead para uma pessoa da equipe.", group: "Equipe" },
  round_robin: { label: "Rodízio entre vendedores", hint: "Distribui os leads um para cada, em sequência.", group: "Equipe" },
  internal: { label: "Mensagem interna", hint: "Avisa a equipe no chat interno (o cliente não vê).", group: "Equipe" },
  webhook: { label: "Webhook", hint: "Envia os dados do lead para outro sistema (Zapier, Make, seu site).", group: "Integração" },
  ai: { label: "Agente de IA", hint: "Liga ou para o agente de IA nesta conversa.", group: "Conversa" },
  complete_tasks: { label: "Concluir tarefas", hint: "Marca como feitas todas as tarefas abertas do lead.", group: "Lead" },
  create_lead: { label: "Criar lead", hint: "Abre um lead novo para o mesmo contato, em outra etapa ou funil.", group: "Lead" },
};

const sid = () => Math.random().toString(36).slice(2, 10);

export function newStep(type: RobotStepType): RobotStep {
  const id = sid();
  switch (type) {
    case "message":
      return { id, type, text: "" };
    case "wait":
      return { id, type, minutes: 60 };
    case "wait_reply":
      return { id, type, minutes: 1440, timeoutNext: null };
    case "validate":
      return { id, type, kind: "email", question: "Qual o seu melhor email?", retryText: "Hmm, não parece um email válido. Pode mandar de novo?", tries: 2, failNext: null };
    case "condition":
      return { id, type, source: "message", rules: [{ id: sid(), label: "", op: "contains", next: null }], elseNext: null };
    case "round_robin":
      return { id, type, userIds: [] };
    case "internal":
      return { id, type, text: "Lead {{lead}} precisa de atenção." };
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
    case "set_field":
      return { id, type, fieldId: "", value: "" };
    case "close":
      return { id, type };
    case "webhook":
      return { id, type, url: "https://" };
    case "email":
      return { id, type, subject: "", text: "Olá, {{nome}}!\n\n" };
    case "start_robot":
      return { id, type, robotId: "" };
    case "ai":
      return { id, type, on: true };
    case "complete_tasks":
      return { id, type };
    case "create_lead":
      return { id, type, stageId: "", name: "{{lead}}" };
    case "stop":
      return { id, type };
  }
}

export const newBranch = (label = ""): StepBranch => ({ id: sid(), label, next: null });

/** Robôs prontos para começar com um clique. `stage` é a posição da etapa no funil (0 = primeira; "won" = ganho). */
export type Preset = {
  key: string;
  title: string;
  text: string;
  stage?: number | "won";
  robot: Omit<RobotInput, "pipelineId" | "stageId">;
};

/** cópia do modelo com ids novos, mantendo as ligações entre os passos */
export function clonePresetSteps(steps: RobotStep[]): RobotStep[] {
  const map = new Map(steps.map((x) => [x.id, sid()]));
  const m = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : (map.get(v) ?? null));
  return steps.map((x) => {
    const c = structuredClone(x) as RobotStep & Record<string, unknown>;
    c.id = map.get(x.id)!;
    if (x.next !== undefined) c.next = m(x.next);
    for (const k of ["elseNext", "timeoutNext", "failNext"]) if (k in c) c[k] = m(c[k] as string | null);
    if ("buttons" in c && Array.isArray(c.buttons)) c.buttons = c.buttons.map((b) => ({ ...b, id: sid(), next: m(b.next) ?? null }));
    if ("rules" in c && Array.isArray(c.rules)) c.rules = c.rules.map((b) => ({ ...b, id: sid(), next: m(b.next) ?? null }));
    return c as RobotStep;
  });
}

export const PRESETS: Preset[] = [
  {
    key: "menu",
    title: "Menu de atendimento",
    text: "Primeira mensagem nas redes: oferece opções em botões, cada uma segue um caminho; vendas vai para o rodízio de vendedores.",
    robot: {
      name: "Menu de atendimento",
      active: true,
      trigger: "new_contact",
      channels: [],
      keywords: [],
      once: true,
      steps: [
        {
          id: "m1",
          type: "message",
          text: "Oi, {{nome}}! Bem-vindo à {{empresa}} 👋 Como posso te ajudar?",
          buttons: [
            { id: "b1", label: "Quero um orçamento", next: "m2" },
            { id: "b2", label: "Já sou cliente", next: "m3" },
          ],
          elseNext: "m4",
        },
        { id: "m2", type: "message", text: "Ótimo! Já vou te passar os valores. Me conta rapidinho o que você precisa?", next: "t1" },
        { id: "t1", type: "tag", tag: "orçamento", next: null },
        { id: "m3", type: "message", text: "Que bom te ver de novo! Já chamei alguém da equipe para te atender.", next: "i1" },
        { id: "i1", type: "internal", text: "Cliente {{nome}} pediu atendimento no menu.", next: null },
        { id: "m4", type: "message", text: "Sem problema! Em instantes alguém da equipe te responde por aqui.", next: null },
      ],
    },
  },
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
