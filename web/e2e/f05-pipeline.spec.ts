import { axe, expect, signUp, test } from "./helpers";

test.describe("F05/F06/F07/F12 funil, leads e tarefas", () => {
  test("F06-H1 adicionar rápido sem nome vira Lead #n", async ({ page }) => {
    const { slug } = await signUp(page);
    await page.goto(`/${slug}/leads?view=kanban`);
    // funil vazio mostra o estado vazio; cria pelo botão do topo
    await page.getByRole("button", { name: "Novo lead" }).click();
    await expect(page.getByRole("dialog", { name: "Novo lead" })).toBeVisible();
    await axe(page);
    await page.getByRole("button", { name: "Criar lead" }).click();
    await expect(page.getByRole("button", { name: /Editar nome do lead: Lead #\d+/ })).toBeVisible();
  });

  test("F06-E1 nome com 60+ caracteres, acentos e valor em reais", async ({ page }) => {
    const { slug } = await signUp(page);
    const long = "Clínica Odontológica São Sebastião — implantes e próteses completas";
    await page.goto(`/${slug}/leads`);
    await page.getByRole("button", { name: "Novo lead" }).click();
    await page.getByLabel("Nome do negócio").fill(long);
    await page.getByLabel("Valor").fill("12.500,50");
    await page.getByLabel("Nome do contato").fill("Ana Paula");
    await page.getByRole("button", { name: "Criar lead" }).click();
    await expect(page.getByRole("button", { name: `Editar nome do lead: ${long}` })).toBeVisible();
    await expect(page.getByRole("button", { name: /Editar valor: R\$\s?12\.501/ })).toBeVisible();
    await page.goto(`/${slug}/leads`);
    await expect(page.getByRole("link", { name: long })).toBeVisible();
    await expect(page.getByRole("region", { name: /Primeiro contato, 1 lead/ }).getByText("R$ 12.501")).toHaveCount(2); // total da coluna + card
  });

  test("F05-H1 mover pelo teclado entre etapas", async ({ page }) => {
    const { slug } = await signUp(page);
    await page.goto(`/${slug}/leads`);
    await page.getByRole("button", { name: "Novo lead" }).click();
    await page.getByLabel("Nome do negócio").fill("Mover");
    await page.getByRole("button", { name: "Criar lead" }).click();
    await page.goto(`/${slug}/leads`);
    const handle = page.getByRole("button", { name: "Mover Mover para outra etapa" });
    await handle.focus();
    await page.keyboard.press("Space");
    const live = page.getByRole("status").filter({ hasText: /sobre|pego/ });
    await expect(live).toContainText("sobre Primeiro contato");
    await page.keyboard.press("ArrowRight");
    await expect(live).toContainText("sobre Qualificado");
    await page.keyboard.press("Space");
    await expect(page.getByRole("region", { name: /Qualificado, 1 lead/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", { name: /Qualificado, 1 lead/ })).toBeVisible();
  });

  test("F05-E1 perdido exige motivo", async ({ page }) => {
    const { slug } = await signUp(page);
    await page.goto(`/${slug}/leads`);
    await page.getByRole("button", { name: "Novo lead" }).click();
    await page.getByLabel("Nome do negócio").fill("Vai perder");
    await page.getByRole("button", { name: "Criar lead" }).click();
    const dlg = page.getByRole("dialog", { name: "Por que este negócio foi perdido?" });
    // o cartão chega pronto do servidor: um clique antes da hidratação se perde
    // (clica de novo só se o diálogo não abriu: com ele aberto, o botão fica atrás e o clique esperaria para sempre)
    await expect(async () => {
      if (!(await dlg.isVisible())) await page.getByRole("button", { name: "Perdido" }).click({ timeout: 3000 });
      await expect(dlg).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30_000 });
    await dlg.getByLabel("Escolheu concorrente").check();
    await dlg.getByRole("button", { name: "Marcar como perdido" }).click();
    await expect(page.getByText("Negócio perdido · Escolheu concorrente")).toBeVisible();
    await expect(page.getByText(/moveu de Primeiro contato para Perdido/)).toBeVisible();
  });

  test("F07-H1 tarefa criada no lead aparece na agenda e é concluída", async ({ page }) => {
    const { slug } = await signUp(page);
    await page.goto(`/${slug}/leads`);
    await page.getByRole("button", { name: "Novo lead" }).click();
    await page.getByLabel("Nome do negócio").fill("Com tarefa");
    await page.getByRole("button", { name: "Criar lead" }).click();
    await page.getByRole("tab", { name: "Tarefa" }).click();
    await page.getByLabel("Descrição da tarefa").fill("Ligar amanhã");
    await page.getByRole("button", { name: "Criar tarefa" }).click();
    await expect(page.getByText("Ligar amanhã")).toBeVisible();
    await page.goto(`/${slug}/calendar`);
    // visão do mês: a tarefa aparece no dia, com os feriados do mês listados embaixo
    await expect(page.getByRole("table").getByText("Ligar amanhã")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Feriados do mês" })).toBeVisible();
    await axe(page);
    await page.getByRole("radio", { name: "Lista" }).click();
    await expect(page.getByRole("heading", { name: /Amanhã \(1\)/ })).toBeVisible();
    await axe(page);
    await page.getByRole("button", { name: "Concluir", exact: true }).click();
    await page.getByLabel("Resultado da tarefa").fill("Fechou reunião");
    await page.getByRole("button", { name: "Concluir tarefa" }).click();
    await expect(page.getByText("Tudo em dia")).toBeVisible();
  });

  test("F04-E1 nota interna com campo vazio não envia", async ({ page }) => {
    const { slug } = await signUp(page);
    await page.goto(`/${slug}/leads`);
    await page.getByRole("button", { name: "Novo lead" }).click();
    await page.getByRole("button", { name: "Criar lead" }).click();
    await expect(page.getByRole("button", { name: "Salvar nota" })).toBeDisabled();
    await page.getByLabel("Nota interna").fill("Cliente prefere WhatsApp à tarde");
    await page.getByRole("button", { name: "Salvar nota" }).click();
    await expect(page.getByText("Cliente prefere WhatsApp à tarde")).toBeVisible();
  });

  test("F12-H1 visão em lista e filtro sem tarefa (conta demo)", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("demo@exemplo.com");
    await page.getByLabel("Senha").fill("demo1234");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/demo\/leads/);
    await page.goto("/demo/leads?view=list&task=none");
    await expect(page.getByRole("table", { name: "Leads do funil" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Rafael Torres — consultoria" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Clínica Vida — 2 implantes" })).toHaveCount(0);
    await axe(page);
  });
});

test.describe("telas restantes: acessibilidade e sem erros", () => {
  test("S09 S12 S14 S16 S17 S25 S27 S28 S29", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("demo@exemplo.com");
    await page.getByLabel("Senha").fill("demo1234");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/demo\/leads/);
    for (const p of ["inbox", "contacts", "companies", "calendar?who=all", "home", "settings/channels", "notifications", "search?q=cl", "settings"]) {
      await page.goto(`/demo/${p}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await axe(page);
    }
  });

  test("@mobile funil e cartão em 390px", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("demo@exemplo.com");
    await page.getByLabel("Senha").fill("demo1234");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/demo\/leads/);
    const noHScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(await noHScroll()).toBe(true);
    await page.getByRole("link", { name: "Clínica Vida — 2 implantes" }).click();
    await expect(page.getByRole("button", { name: /Editar nome do lead/ })).toBeVisible();
    expect(await noHScroll()).toBe(true);
    await page.goto("/demo/inbox");
    expect(await noHScroll()).toBe(true);
  });
});
