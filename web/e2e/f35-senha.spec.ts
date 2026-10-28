import { axe, expect, signUp, test } from "./helpers";

/* Esqueci minha senha: pede o link, cria a senha nova e entra (no modo de desenvolvimento o link aparece na tela). */
test("F35-H1 recupera a senha pelo link e entra com a nova", async ({ page }) => {
  test.setTimeout(90_000);
  const { email } = await signUp(page);
  await page.goto("/sair");
  await page.goto("/login");
  await page.getByRole("link", { name: "Esqueci minha senha" }).click();
  await expect(page.getByRole("heading", { name: "Esqueci minha senha" })).toBeVisible();
  await axe(page);
  await page.getByLabel("Email da conta").fill(email);
  await page.getByRole("button", { name: "Mandar link" }).click();
  await expect(page.getByText("Pronto! Confira seu email.")).toBeVisible();
  await page.getByRole("link", { name: /Abrir o link/ }).click();

  await expect(page.getByRole("heading", { name: "Senha nova" })).toBeVisible();
  await page.getByLabel("Senha nova", { exact: true }).fill("nova-senha-789");
  await page.getByLabel("Repita a senha nova").fill("outra-coisa-000");
  await page.getByRole("button", { name: "Salvar e entrar" }).click();
  await expect(page.getByText("As duas senhas não são iguais.")).toBeVisible();
  await page.getByLabel("Senha nova", { exact: true }).fill("nova-senha-789");
  await page.getByLabel("Repita a senha nova").fill("nova-senha-789");
  await page.getByRole("button", { name: "Salvar e entrar" }).click();
  await expect(page).toHaveURL(/\/home/);

  // a senha antiga não entra mais; a nova entra
  await page.goto("/sair");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha-teste-123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Email ou senha incorretos.")).toBeVisible();
  await page.getByLabel("Senha").fill("nova-senha-789");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/home/);
});

test("F35-E1 email que não existe recebe a mesma resposta (ninguém descobre quem tem conta)", async ({ page }) => {
  await page.goto("/esqueci");
  await page.getByLabel("Email da conta").fill("ninguem-aqui@exemplo.test");
  await page.getByRole("button", { name: "Mandar link" }).click();
  await expect(page.getByText("Pronto! Confira seu email.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Abrir o link/ })).toHaveCount(0);
});
