import { axe, expect, signUp, test } from "./helpers";

/* Configurações: trocar nome, senha e os dados da empresa. */
test("F29-H1 troca nome, senha e dados da empresa", async ({ page }) => {
  const { slug } = await signUp(page, "Tester Silva");

  await page.goto(`/${slug}/settings/profile`);
  await page.getByLabel("Nome", { exact: true }).fill("Tester Novo Nome");
  await page.getByRole("button", { name: "Salvar nome" }).click();
  await expect(page.getByText("Nome atualizado.")).toBeVisible();

  await page.getByLabel("Senha atual").fill("errada-123");
  await page.getByLabel("Senha nova", { exact: true }).fill("senha-nova-456");
  await page.getByLabel("Repita a senha nova").fill("senha-nova-456");
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page.getByText("A senha atual não confere.")).toBeVisible();
  await page.getByLabel("Senha atual").fill("senha-teste-123");
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page.getByText("Senha trocada.")).toBeVisible();
  await axe(page);

  await page.goto(`/${slug}/settings/company`);
  await page.getByLabel("Nome da empresa").fill("Padaria Sol Nascente");
  await page.getByLabel("WhatsApp da empresa").fill("(31) 98765-4321");
  await page.getByLabel("Fuso horário").selectOption("America/Manaus");
  await page.getByRole("button", { name: "Salvar dados da empresa" }).click();
  await expect(page.getByText("Dados da empresa salvos.")).toBeVisible();
  await axe(page);

  await page.goto(`/${slug}/settings`);
  await expect(page.getByRole("heading", { name: "Padaria Sol Nascente" })).toBeVisible();
  await expect(page.getByText("Manaus (GMT-4)")).toBeVisible();
});
