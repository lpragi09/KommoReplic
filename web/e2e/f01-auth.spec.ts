import { axe, expect, signUp, test, unique } from "./helpers";

test.describe("F01 dono cria conta e chega ao funil", () => {
  test("F01-H1 cadastro → empresa → funil vazio", async ({ page }) => {
    await page.goto("/signup");
    await axe(page);
    await signUp(page);
    await expect(page.getByRole("heading", { name: "Funil de vendas" })).toBeVisible();
    await expect(page.getByText("Seu funil está vazio")).toBeVisible();
    await axe(page);
  });

  test("F01-N1 senha errada mostra erro e mantém o email", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("demo@exemplo.com");
    await page.getByLabel("Senha").fill("errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Email ou senha incorretos" })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("demo@exemplo.com");
  });

  test("F01-N2 email já cadastrado", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Seu nome").fill("Outra Pessoa");
    await page.getByLabel("Email de trabalho").fill("demo@exemplo.com");
    await page.getByLabel("Senha").fill("senha-teste-123");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Já existe uma conta" })).toBeVisible();
  });

  test("F01-E1 senha curta é recusada no servidor", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Seu nome").fill("Fulano");
    await page.getByLabel("Email de trabalho").fill(`${unique()}@exemplo.test`);
    await page.getByLabel("Senha").fill("123");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "8 caracteres" })).toBeVisible();
  });

  test("F01-E2 endereço reservado e acentos no nome da empresa", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Seu nome").fill("José Ação");
    await page.getByLabel("Email de trabalho").fill(`${unique()}@exemplo.test`);
    await page.getByLabel("Senha").fill("senha-teste-123");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await page.getByLabel("Nome da empresa").fill("Ótica São João 👓");
    await expect(page.getByLabel("Endereço")).toHaveValue("otica-sao-joao");
    await page.getByLabel("Endereço").fill("login");
    await page.getByRole("button", { name: "Abrir meu funil" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "reservado" })).toBeVisible();
  });

  test("F01-E3 sessão expirada volta para o login", async ({ page, context }) => {
    const { slug } = await signUp(page);
    await context.clearCookies();
    await page.goto(`/${slug}/leads`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("F01-E4 dados de outra empresa são invisíveis", async ({ page }) => {
    await signUp(page);
    await page.goto("/demo/leads");
    await expect(page.getByText("Não encontramos esta página")).toBeVisible();
    // nada da conta demo aparece
    await expect(page.getByText("Clínica Vida")).toHaveCount(0);
  });
});
