import { axe, expect, signUp, test, visitorPage, webchatKey } from "./helpers";

/* Robôs de automação e as telas que saíram de "em construção". */
test.describe("F20 robôs e telas novas", () => {
  test("F20-H1 boas-vindas: aceitar o contato dispara a mensagem automática", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const { slug } = await signUp(page);

    // cria o robô a partir do modelo pronto
    await page.goto(`/${slug}/automations`);
    await axe(page);
    await page.getByRole("tab", { name: "Modelos prontos" }).click();
    await page.getByRole("link", { name: /Boas-vindas/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${slug}/automations/new\\?preset=boas-vindas`));
    await expect(page.getByLabel("Nome do robô")).toHaveValue("Boas-vindas");
    await axe(page);
    await page.getByRole("button", { name: "Criar robô" }).click();
    await expect(page).toHaveURL(new RegExp(`/${slug}/automations/[0-9a-f-]{36}`));

    // aparece no funil digital, na primeira etapa
    await page.goto(`/${slug}/automations`);
    await expect(page.getByRole("region", { name: /Primeiro contato: 1 robôs/ }).getByText("Boas-vindas")).toBeVisible();

    // visitante escreve; equipe aceita; robô responde
    const key = await webchatKey(page, slug);
    const visitor = await visitorPage(browser);
    await visitor.goto(`/chat/${key}`);
    await visitor.getByLabel("Seu nome (opcional)").fill("Joana Prado");
    await visitor.getByLabel("Mensagem", { exact: true }).fill("Oi, quero saber mais");
    await visitor.getByRole("button", { name: "Enviar mensagem" }).click();

    await page.goto(`/${slug}/leads`);
    await page.getByRole("button", { name: "Aceitar Joana Prado como lead" }).click();
    await expect(page).toHaveURL(new RegExp(`/${slug}/leads/[0-9a-f-]{36}`));
    const convo = page.getByRole("region", { name: "Histórico e conversa" });
    await expect(convo.getByText(/Oi, Joana! .*Recebemos seu contato/)).toBeVisible();
    await expect(convo.getByText(/Robô “Boas-vindas”: Tarefa criada: Responder Joana/)).toBeVisible();
    await expect(visitor.getByText(/Recebemos seu contato/)).toBeVisible({ timeout: 10_000 });
  });

  test("F20-H2 palavra-chave: mensagem com “preço” recebe resposta na hora", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const { slug } = await signUp(page);
    await page.goto(`/${slug}/automations/new?preset=preco`);
    await page.getByRole("button", { name: "Criar robô" }).click();
    await expect(page).toHaveURL(new RegExp(`/${slug}/automations/[0-9a-f-]{36}`));

    const key = await webchatKey(page, slug);
    const visitor = await visitorPage(browser);
    await visitor.goto(`/chat/${key}`);
    await visitor.getByLabel("Mensagem", { exact: true }).fill("Qual o preço da consulta?");
    await visitor.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(visitor.getByText(/Boa pergunta/)).toBeVisible({ timeout: 10_000 });
  });

  test("F20-E1 robô sem passo válido não salva e mostra o motivo", async ({ page }) => {
    const { slug } = await signUp(page);
    await page.goto(`/${slug}/automations/new`);
    await page.getByLabel("Nome do robô").fill("Vazio");
    await page.getByRole("button", { name: "Criar robô" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Escreva a mensagem do robô." })).toBeVisible();
    await expect(page).toHaveURL(/\/automations\/new/);
  });

  test("F20-H3 telas novas: relatórios, modelos, equipe, campos, chat da equipe e disparos", async ({ page }) => {
    test.setTimeout(180_000);
    const { slug } = await signUp(page);

    await page.goto(`/${slug}/reports`);
    await expect(page.getByRole("heading", { name: "Relatórios", level: 1 })).toBeVisible();
    await axe(page);

    // modelo de mensagem
    await page.goto(`/${slug}/templates`);
    await page.getByRole("button", { name: "Novo modelo" }).click();
    await page.getByRole("radio", { name: "Chat do site" }).click();
    await page.getByLabel("Nome do modelo").fill("Horário");
    await page.getByLabel("Atalho (opcional)").fill("horario");
    await page.getByLabel("Mensagem", { exact: true }).fill("Atendemos das 9h às 18h.");
    await page.getByRole("button", { name: "Salvar modelo" }).click();
    await expect(page.getByText("/horario")).toBeVisible();
    await axe(page);

    // equipe
    await page.goto(`/${slug}/settings/users`);
    await page.getByRole("button", { name: "Criar acesso" }).click();
    await page.getByLabel("Nome", { exact: true }).fill("Carla Dias");
    await page.getByLabel("Email").fill(`carla-${Date.now()}@exemplo.test`);
    await page.getByLabel("Senha inicial").fill("senha-teste-456");
    await page.getByRole("dialog").getByRole("button", { name: "Criar acesso" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Carla Dias" })).toBeVisible();
    await axe(page);

    // campo personalizado aparece no lead
    await page.goto(`/${slug}/settings/fields`);
    await page.getByRole("button", { name: "Novo campo" }).click();
    await page.getByLabel("Nome do campo").fill("CPF ou CNPJ");
    await page.getByRole("button", { name: "Salvar campo" }).click();
    await expect(page.getByText("CPF ou CNPJ")).toBeVisible();
    await axe(page);

    // chat da equipe
    await page.goto(`/${slug}/team-chat`);
    await page.getByLabel("Mensagem para a equipe").fill("Bom dia, time!");
    await page.getByLabel("Mensagem para a equipe").press("Enter");
    await expect(page.getByText("Bom dia, time!")).toBeVisible();
    await axe(page);

    // disparos: tela abre e conta o público
    await page.goto(`/${slug}/broadcasts`);
    await expect(page.getByText(/leads têm conversa para receber/)).toBeVisible({ timeout: 15_000 });
    await axe(page);
  });

  test("F20-H4 menu com botões: cada resposta segue seu caminho no quadro", async ({ page, browser }) => {
    test.setTimeout(150_000);
    const { slug } = await signUp(page);
    await page.goto(`/${slug}/automations/new?preset=menu`);
    // quadro: passos ligados por fios
    await expect(page.locator("[data-node]")).toHaveCount(7);
    await expect(page.locator("svg path[stroke-width='2.5']").first()).toBeAttached();
    await page.getByRole("button", { name: "Criar robô" }).click();
    await expect(page).toHaveURL(new RegExp(`/${slug}/automations/[0-9a-f-]{36}`));

    const key = await webchatKey(page, slug);
    // caminho do botão 1
    const v1 = await visitorPage(browser);
    await v1.goto(`/chat/${key}`);
    await v1.getByLabel("Mensagem", { exact: true }).fill("oi");
    await v1.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(v1.getByText(/1 - Quero um orçamento/)).toBeVisible({ timeout: 15_000 });
    await v1.getByLabel("Mensagem", { exact: true }).fill("1");
    await v1.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(v1.getByText(/Já vou te passar os valores/)).toBeVisible({ timeout: 15_000 });

    // resposta fora das opções vai pelo "senão"
    const v2 = await visitorPage(browser);
    await v2.goto(`/chat/${key}`);
    await v2.getByLabel("Mensagem", { exact: true }).fill("bom dia");
    await v2.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(v2.getByText(/2 - Já sou cliente/)).toBeVisible({ timeout: 15_000 });
    await v2.getByLabel("Mensagem", { exact: true }).fill("quero falar sobre outra coisa");
    await v2.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(v2.getByText(/Sem problema! Em instantes/)).toBeVisible({ timeout: 15_000 });
  });
});

test("F20-E2 botão + Passo cria o passo escolhido no quadro", async ({ page }) => {
  const { slug } = await signUp(page);
  await page.goto(`/${slug}/automations/new`);
  const before = await page.locator("section[data-node]").count();
  await page.getByRole("button", { name: "Passo", exact: true }).click();
  await page.getByRole("menuitem", { name: /Criar tarefa/ }).click();
  await expect(page.locator("section[data-node]")).toHaveCount(before + 1);
});

test("F20-E3 clicar numa linha seleciona e Desligar remove a ligação", async ({ page }) => {
  const { slug } = await signUp(page);
  await page.goto(`/${slug}/automations/new?preset=menu`);
  const wires = page.locator("svg g.cursor-pointer");
  await expect(wires.first()).toBeAttached();
  await page.waitForTimeout(800); // quadro se organiza e enquadra
  const before = await wires.count();
  // ponto no meio do traçado da linha (não o meio da caixa dela)
  const pt = await page.evaluate(() => {
    const paths = [...document.querySelectorAll("svg g.cursor-pointer path:first-child")] as SVGPathElement[];
    for (const p of paths) {
      const q = p.getPointAtLength(p.getTotalLength() / 2);
      const m = p.getScreenCTM()!;
      const x = q.x * m.a + m.e;
      const y = q.y * m.d + m.f;
      const hit = document.elementFromPoint(x, y);
      if (hit && hit.closest("g.cursor-pointer")) return { x, y };
    }
    return null;
  });
  expect(pt).not.toBeNull();
  await page.mouse.click(pt!.x, pt!.y);
  await page.getByRole("button", { name: "Desligar" }).click();
  await expect(wires).toHaveCount(before - 1);
});
