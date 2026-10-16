import { axe, expect, fillSignUp, newCPF, signUp, test, unique } from "./helpers";

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
    await fillSignUp(page, { name: "Outra Pessoa", email: "demo@exemplo.com" });
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
    await fillSignUp(page, { name: "José Ação", email: `${unique()}@exemplo.test`, company: "Ótica São João 👓" });
    await expect(page.getByLabel("Endereço")).toHaveValue("otica-sao-joao");
    await page.getByLabel("Endereço").fill("login");
    await page.getByRole("button", { name: "Continuar para os planos" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "reservado" })).toBeVisible();
  });

  test("F01-E5 CPF inválido e email temporário são recusados", async ({ page }) => {
    await page.goto("/signup");
    await fillSignUp(page, { email: `${unique()}@exemplo.test`, cpf: "529.982.247-26" });
    await expect(page.getByRole("alert").filter({ hasText: "CPF ou CNPJ" })).toBeVisible();
    await fillSignUp(page, { email: `${unique()}@yopmail.com` });
    await expect(page.getByRole("alert").filter({ hasText: "temporários" })).toBeVisible();
  });

  test("F01-E6 mesmo CPF não ganha outro teste: abre direto nos planos e o painel fica pausado", async ({ page, context }) => {
    const cpf = newCPF();
    await signUp(page, "Primeira Conta", cpf);
    await context.clearCookies();
    const id = unique();
    await page.goto("/signup");
    await fillSignUp(page, { name: "Segunda Conta", email: `${id}@exemplo.test`, company: `Empresa ${id}`, cpf });
    await page.getByRole("button", { name: "Continuar para os planos" }).click();
    await expect(page).toHaveURL(/semteste=1/);
    await expect(page.getByText("Este CPF/CNPJ ou email já usou o teste grátis")).toBeVisible();
    await axe(page);
    const slug = new URL(page.url()).pathname.split("/")[1];
    await page.goto(`/${slug}/leads`);
    await expect(page.getByRole("heading", { name: "Seu teste grátis terminou" })).toBeVisible();
    await axe(page);
    await page.getByRole("link", { name: "Ver planos e ativar" }).click();
    await expect(page).toHaveURL(new RegExp(`/${slug}/settings/billing`));
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
