import { axe, expect, signUp, test, visitorPage, webchatKey } from "./helpers";

/* Agente de IA. Sem ANTHROPIC_API_KEY e com AI_FAKE=1 (playwright.config) a IA responde de forma previsível:
   a 1ª linha da base de conhecimento, ou passa para humano quando o cliente pede uma pessoa. */
test.describe("F22 agente de IA", () => {
  test("F22-H1 liga o agente, testa na tela, responde o cliente e passa para a equipe", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const { slug } = await signUp(page);

    // a IA é paga à parte: sem crédito nem chave própria o agente não liga
    await page.goto(`/${slug}/settings/ai`);
    await expect(page.getByRole("switch", { name: "Ligar o agente de IA" })).toBeDisabled();
    await page.goto(`/${slug}/settings/billing?aba=complementos`);
    await page.getByLabel("Chave da API").fill("sk-ant-teste-0000000000000000000000001234");
    await page.getByRole("button", { name: "Testar e salvar" }).click();
    await expect(page.getByText("Chave salva e testada.", { exact: false })).toBeVisible();

    // atalho no menu lateral, logo abaixo de Automações
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Agente de IA" }).click();
    await expect(page).toHaveURL(new RegExp(`/${slug}/settings/ai`));
    await axe(page);
    await page.getByLabel("Nome do agente").fill("Bia");
    await page.getByRole("textbox", { name: "Base de conhecimento" }).fill("Entregamos em todo o Brasil em até 5 dias úteis.\nPix ou cartão.");
    await page.getByRole("switch", { name: "Ligar o agente de IA" }).click();
    await page.getByRole("button", { name: "Salvar agente" }).click();
    await expect(page.getByText("Salvo.")).toBeVisible();

    // chat de teste ao lado
    await page.getByLabel("Mensagem de teste").fill("vocês entregam em Recife?");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("[Bia] Entregamos em todo o Brasil em até 5 dias úteis.")).toBeVisible();

    // cliente de verdade pelo chat do site
    const key = await webchatKey(page, slug);
    const visitor = await visitorPage(browser);
    await visitor.goto(`/chat/${key}`);
    await visitor.getByLabel("Seu nome (opcional)").fill("Caio Lima");
    await visitor.getByLabel("Mensagem", { exact: true }).fill("Oi, vocês entregam?");
    await visitor.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(visitor.getByText("[Bia] Entregamos em todo o Brasil em até 5 dias úteis.")).toBeVisible({ timeout: 20_000 });

    await visitor.getByLabel("Mensagem", { exact: true }).fill("quero falar com uma pessoa");
    await visitor.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(visitor.getByText("Vou chamar alguém da equipe para continuar com você.")).toBeVisible({ timeout: 20_000 });

    // na caixa de entrada: a resposta aparece marcada e a IA ficou pausada nesta conversa
    await page.goto(`/${slug}/inbox`);
    await page.getByRole("link", { name: /Caio Lima/ }).first().click();
    await expect(page.getByText("Agente de IA").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "IA pausada · devolver" })).toBeVisible();
    await axe(page);

    // depois de pausada, a IA não responde mais
    await visitor.getByLabel("Mensagem", { exact: true }).fill("e o pix?");
    await visitor.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(visitor.getByText("e o pix?")).toBeVisible();
    await visitor.waitForTimeout(2500);
    await expect(visitor.getByText("[Bia]")).toHaveCount(1);
  });
});
