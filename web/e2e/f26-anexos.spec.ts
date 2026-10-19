import { axe, expect, signUp, test, visitorPage, webchatKey } from "./helpers";

/* Anexos: a equipe manda uma foto pelo cartão do lead e o visitante vê no chat do site. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("F26-H1 foto com legenda sai do cartão do lead e aparece para o visitante", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const { slug } = await signUp(page);
  const key = await webchatKey(page, slug);
  const visitor = await visitorPage(browser);
  await visitor.goto(`/chat/${key}`);
  await visitor.getByLabel("Seu nome (opcional)").fill("Lia Foto");
  await visitor.getByLabel("Mensagem", { exact: true }).fill("Tem o cardápio?");
  await visitor.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(visitor.getByText("Tem o cardápio?")).toBeVisible();

  await page.goto(`/${slug}/leads`);
  await page.getByRole("button", { name: "Aceitar Lia Foto como lead" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/leads/[0-9a-f-]{36}`));

  // tipo não aceito é recusado antes de enviar
  await page.locator('input[type="file"]').setInputFiles({ name: "virus.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") });
  await expect(page.getByRole("alert").filter({ hasText: "não é aceito" })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({ name: "cardapio.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("cardapio.png")).toBeVisible();
  await page.getByLabel("Mensagem para o cliente").fill("Segue o cardápio!");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByRole("img", { name: "cardapio.png" })).toBeVisible();
  await expect(page.getByText("Segue o cardápio!")).toBeVisible();
  await axe(page);

  // o visitante recebe (o chat do site busca as novas a cada poucos segundos)
  await expect(visitor.getByRole("img", { name: "cardapio.png" })).toBeVisible({ timeout: 15_000 });
  await expect(visitor.getByText("Segue o cardápio!")).toBeVisible();
});

test("F26-H2 visitante manda foto pelo chat do site e a equipe vê no cartão do lead", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const { slug } = await signUp(page);
  const key = await webchatKey(page, slug);
  const visitor = await visitorPage(browser);
  await visitor.goto(`/chat/${key}`);
  await visitor.getByLabel("Seu nome (opcional)").fill("Caio Anexo");
  await visitor.getByLabel("Mensagem", { exact: true }).fill("Olha o defeito");
  await visitor.locator('input[type="file"]').setInputFiles({ name: "defeito.png", mimeType: "image/png", buffer: PNG });
  await expect(visitor.getByRole("img", { name: "defeito.png" })).toBeVisible();
  await expect(visitor.getByText("Olha o defeito")).toBeVisible();

  await page.goto(`/${slug}/leads`);
  await page.getByRole("button", { name: "Aceitar Caio Anexo como lead" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/leads/[0-9a-f-]{36}`));
  await expect(page.getByRole("img", { name: "defeito.png" })).toBeVisible();
  await expect(page.getByText("Olha o defeito").first()).toBeVisible();
});
