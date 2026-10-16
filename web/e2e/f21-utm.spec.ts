import { axe, expect, signUp, test, visitorPage, webchatKey } from "./helpers";

/* Origem dos leads sem robô: link rastreável de WhatsApp e chat do site com UTM. */
test.describe("F21 UTMs e links rastreáveis", () => {
  test("F21-H1 clique no link rastreável → código na mensagem → origem no lead e no relatório", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const { slug } = await signUp(page);

    await page.goto(`/${slug}/settings/tracking`);
    await axe(page);
    await page.getByRole("button", { name: "Novo link" }).click();
    await page.getByLabel("Nome do link").fill("Instagram outubro");
    await page.getByLabel("Seu WhatsApp").fill("11988881234");
    await page.getByLabel("Campanha (utm_campaign)").fill("outubro");
    await page.getByRole("button", { name: "Salvar link" }).click();
    const url = (await page.locator("code").filter({ hasText: "/w/" }).first().textContent())!.trim();

    // o clique redireciona para o WhatsApp com o código de rastreio
    const res = await page.request.get(`${url}?utm_source=instagram`, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    const loc = res.headers()["location"];
    expect(loc).toContain("https://wa.me/5511988881234");
    const ref = decodeURIComponent(loc).match(/ref: ([A-Z0-9]+)/)![1];

    // a mensagem chega (aqui pelo chat do site, mesmo caminho do WhatsApp) com o código
    const key = await webchatKey(page, slug);
    const visitor = await visitorPage(browser);
    await visitor.goto(`/chat/${key}`);
    await visitor.getByLabel("Seu nome (opcional)").fill("Paula Reis");
    await visitor.getByLabel("Mensagem", { exact: true }).fill(`Olá! Quero saber mais.\n\n(ref: ${ref})`);
    await visitor.getByRole("button", { name: "Enviar mensagem" }).click();

    await page.goto(`/${slug}/leads`);
    await page.getByRole("button", { name: "Aceitar Paula Reis como lead" }).click();
    await expect(page).toHaveURL(new RegExp(`/${slug}/leads/[0-9a-f-]{36}`));
    await page.getByRole("tab", { name: "Origem" }).click();
    await expect(page.getByText("Link rastreável · Instagram outubro")).toBeVisible();
    await expect(page.getByText("instagram", { exact: true })).toBeVisible();
    await expect(page.getByText("outubro", { exact: true })).toBeVisible();

    await page.goto(`/${slug}/reports`);
    await expect(page.getByRole("region", { name: "Campanhas" }).getByText("instagram · outubro")).toBeVisible();

    await page.goto(`/${slug}/settings/tracking`);
    await expect(page.getByText("1 cliques · 1 conversas")).toBeVisible();
  });

  test("F21-H2 chat do site aberto com UTM na URL guarda a origem", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const { slug } = await signUp(page);
    const key = await webchatKey(page, slug);
    const visitor = await visitorPage(browser);
    await visitor.goto(`/chat/${key}?utm_source=google&utm_medium=cpc&utm_campaign=clareamento`);
    await visitor.getByLabel("Seu nome (opcional)").fill("Rui Matos");
    await visitor.getByLabel("Mensagem", { exact: true }).fill("Quanto custa o clareamento?");
    await visitor.getByRole("button", { name: "Enviar mensagem" }).click();

    await page.goto(`/${slug}/leads`);
    await page.getByRole("button", { name: "Aceitar Rui Matos como lead" }).click();
    await page.getByRole("tab", { name: "Origem" }).click();
    await expect(page.getByText("Chat do site", { exact: true })).toBeVisible();
    await expect(page.getByText("clareamento", { exact: true })).toBeVisible();
    await axe(page);
  });
});
