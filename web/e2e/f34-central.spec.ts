import { axe, expect, signUp, test } from "./helpers";

/* Central da plataforma: só os donos (PLATFORM_ADMINS) entram; veem empresas e usuários, dão suporte e criam demonstrações. */
test("F34-H1 dono vê e administra empresas, usuários e cria uma demonstração", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@exemplo.com");
  await page.getByLabel("Senha").fill("demo1234");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/demo\/home/);

  // atalho no menu da conta
  await page.getByRole("button", { name: /^Conta de/ }).click();
  await page.getByRole("menuitem", { name: "Central da plataforma" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Central da plataforma" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Cadastros por dia" })).toBeVisible();
  await axe(page);

  // empresas: estende o teste da Loja Demo
  const tabs = page.getByRole("navigation", { name: "Seções da central" });
  await tabs.getByRole("link", { name: /Empresas/ }).click();
  await page.getByLabel("Buscar empresa, endereço ou dono…").fill("loja demo");
  await page.getByRole("button", { name: "Ações de Loja Demo" }).click();
  await page.getByRole("menuitem", { name: "Estender 14 dias" }).click();
  await expect(page.getByText("Teste de Loja Demo estendido em 14 dias.")).toBeVisible();
  await axe(page);

  // usuários
  await tabs.getByRole("link", { name: /Usuários/ }).click();
  await expect(page.getByRole("cell", { name: /demo@exemplo\.com/ }).first()).toBeVisible();
  await axe(page);

  // demonstração nova, já com dados, e o login dela funciona
  await tabs.getByRole("link", { name: "Demonstrações" }).click();
  const mail = `mostruario-${Date.now()}@exemplo.test`;
  await page.getByLabel("Nome da empresa").fill("Clínica Sorriso");
  await page.getByLabel("Email de acesso").fill(mail);
  await page.getByLabel("Senha da demonstração").fill("mostruario-123");
  await page.getByRole("button", { name: "Criar demonstração" }).click();
  await expect(page.getByText(/Pronta! Entre com/)).toBeVisible();
  await expect(page.getByText("Clínica Sorriso").first()).toBeVisible();

  const ctx = await browser.newContext();
  const guest = await ctx.newPage();
  await guest.goto("/login");
  await guest.getByLabel("Email").fill(mail);
  await guest.getByLabel("Senha").fill("mostruario-123");
  await guest.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(guest).toHaveURL(/\/home/);
  await guest.goto(guest.url().replace(/\/home.*/, "/leads"));
  await expect(guest.getByText("Clínica Vida — 2 implantes")).toBeVisible();
  await ctx.close();

  // tudo fica no registro
  await tabs.getByRole("link", { name: "Registro" }).click();
  await expect(page.getByText("estendeu o teste")).toBeVisible();
  await expect(page.getByText("criou demonstração")).toBeVisible();
});

test("F34-E1 quem não é dono não vê a Central (404) nem o atalho", async ({ page }) => {
  const { slug } = await signUp(page);
  await page.getByRole("button", { name: /^Conta de/ }).click();
  await expect(page.getByRole("menuitem", { name: "Central da plataforma" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  const r = await page.request.get("/admin", { maxRedirects: 0 });
  expect(r.status()).toBe(404);
  await page.goto(`/${slug}/home`);
});
