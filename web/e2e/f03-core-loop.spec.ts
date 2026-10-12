import { axe, expect, signUp, test, visitorPage, webchatKey } from "./helpers";

/* O loop central: visitante escreve → lead de entrada → aceitar → responder → ganho. */
test.describe("F03/F04/F05 do chat do site até o ganho", () => {
  test("F03-H1 loop completo", async ({ page, browser }) => {
    const { slug } = await signUp(page);
    const key = await webchatKey(page, slug);

    // visitante, em outro navegador (sem sessão)
    const visitor = await visitorPage(browser);
    await visitor.goto(`/chat/${key}`);
    await axe(visitor);
    await visitor.getByLabel("Seu nome (opcional)").fill("Márcia Ñúñez");
    await visitor.getByLabel("Mensagem", { exact: true }).fill("Olá! Vocês fazem orçamento? 😊");
    await visitor.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(visitor.getByText("Olá! Vocês fazem orçamento? 😊")).toBeVisible();

    // equipe vê o lead de entrada
    await page.goto(`/${slug}/leads`);
    const incoming = page.getByRole("region", { name: /Leads de entrada, 1/ });
    await expect(incoming.getByText("Márcia Ñúñez")).toBeVisible();
    await axe(page);
    await incoming.getByRole("button", { name: "Aceitar Márcia Ñúñez como lead" }).click();

    // cai no cartão do lead com a conversa
    await expect(page).toHaveURL(new RegExp(`/${slug}/leads/[0-9a-f-]{36}`));
    const convo = page.getByRole("region", { name: "Histórico e conversa" });
    await expect(convo.getByText("Olá! Vocês fazem orçamento? 😊")).toBeVisible();
    await axe(page);
    await page.getByLabel("Mensagem para o cliente").fill("Fazemos sim! Qual o seu bairro?");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByLabel("Mensagem para o cliente")).toHaveValue("");

    // visitante recebe a resposta
    await expect(visitor.getByText("Fazemos sim! Qual o seu bairro?")).toBeVisible({ timeout: 10_000 });

    // ganho
    await page.getByRole("button", { name: "Ganho" }).click();
    await expect(page.getByText("Negócio ganho")).toBeVisible();
    await page.goto(`/${slug}/leads`);
    await expect(page.getByRole("region", { name: /^Ganho, 1 leads?/ })).toBeVisible();
  });

  test("F03-E1 segunda mensagem do mesmo visitante não cria outro card", async ({ page, browser }) => {
    const { slug } = await signUp(page);
    const key = await webchatKey(page, slug);
    const visitor = await visitorPage(browser);
    await visitor.goto(`/chat/${key}`);
    for (const t of ["primeira", "segunda"]) {
      await visitor.getByLabel("Mensagem", { exact: true }).fill(t);
      await visitor.getByRole("button", { name: "Enviar mensagem" }).click();
      await expect(visitor.getByText(t, { exact: true })).toBeVisible();
    }
    await page.goto(`/${slug}/leads`);
    await expect(page.getByRole("region", { name: "Leads de entrada, 1" })).toBeVisible();
  });

  test("F03-E2 duas abas aceitando o mesmo lead: só uma ganha", async ({ page, context, browser }) => {
    const { slug } = await signUp(page);
    const key = await webchatKey(page, slug);
    const visitor = await visitorPage(browser);
    await visitor.goto(`/chat/${key}`);
    await visitor.getByLabel("Seu nome (opcional)").fill("Duplo");
    await visitor.getByLabel("Mensagem", { exact: true }).fill("oi");
    await visitor.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(visitor.getByText("oi", { exact: true })).toBeVisible();

    const tab2 = await context.newPage();
    await page.goto(`/${slug}/leads`);
    await tab2.goto(`/${slug}/leads`);
    // só clica depois que a página "acordou" (hidratação), senão o clique se perde
    await page.waitForLoadState("networkidle");
    await tab2.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Aceitar Duplo como lead" }).click();
    await expect(page).toHaveURL(/\/leads\/[0-9a-f-]{36}/);
    await tab2.getByRole("button", { name: "Aceitar Duplo como lead" }).click();
    await expect(tab2.getByRole("alert").filter({ hasText: "Alguém da equipe já cuidou" })).toBeVisible();
  });

  test("F03-E3 visitante com mensagem vazia ou longa demais", async ({ page, browser }) => {
    const { slug } = await signUp(page);
    const key = await webchatKey(page, slug);
    const visitor = await visitorPage(browser);
    await visitor.goto(`/chat/${key}`);
    await expect(visitor.getByRole("button", { name: "Enviar mensagem" })).toBeDisabled();
    await visitor.getByLabel("Mensagem", { exact: true }).fill("x".repeat(2500));
    await expect(visitor.getByLabel("Mensagem", { exact: true })).toHaveValue("x".repeat(2000)); // maxLength corta
  });

  test("F03-N1 chave de chat inexistente dá 404", async ({ page }) => {
    // com streaming o status já saiu como 200; o que importa é não abrir chat nenhum
    await page.goto("/chat/naoexiste");
    await expect(page.getByText("Não encontramos esta página")).toBeVisible();
    await expect(page.getByLabel("Mensagem", { exact: true })).toHaveCount(0);
  });
});

test("F03-E4 recusar lead de entrada pede confirmação", async ({ page, browser }) => {
  const { slug } = await signUp(page);
  const key = await webchatKey(page, slug);
  const visitor = await visitorPage(browser);
  await visitor.goto(`/chat/${key}`);
  await visitor.getByLabel("Seu nome (opcional)").fill("Spam");
  await visitor.getByLabel("Mensagem", { exact: true }).fill("compre já");
  await visitor.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(visitor.getByText("compre já")).toBeVisible();
  await page.goto(`/${slug}/leads`);
  await page.getByRole("button", { name: "Recusar Spam" }).click();
  await expect(page.getByRole("region", { name: "Leads de entrada, 1" })).toBeVisible(); // 1º clique não apaga
  await page.getByRole("alert").filter({ hasText: "Recusar e fechar a conversa?" }).getByRole("button", { name: "Recusar" }).click();
  await expect(page.getByText("Spam")).toHaveCount(0); // recusado: some do funil
  await expect(page.getByText("Seu funil está vazio")).toBeVisible();
});
