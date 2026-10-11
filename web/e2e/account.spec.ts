import { axe, expect, signUp, test } from "./helpers";

test.describe("conta e cobrança", () => {
  test("A-H1 excluir a conta apaga o login de verdade", async ({ page }) => {
    const { slug, email, password } = await signUp(page);
    await page.goto(`/${slug}/settings/billing`);
    await axe(page);
    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    const dlg = page.getByRole("dialog", { name: "Excluir a conta para sempre?" });
    await expect(dlg.getByRole("button", { name: "Excluir para sempre" })).toBeDisabled();
    await dlg.getByLabel("Digite EXCLUIR").fill("EXCLUIR");
    await dlg.getByRole("button", { name: "Excluir para sempre" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Nenhum cliente perdido no caminho." })).toBeVisible({ timeout: 20_000 });

    // a empresa antiga sumiu junto com a conta
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    // modo demonstração: o mesmo email entra de novo como conta NOVA, na Loja Demo
    await expect(page).toHaveURL(/\/demo\/leads/);
    await page.goto(`/${slug}/leads`);
    await expect(page.getByText("Não encontramos esta página")).toBeVisible();
  });

  test("A-N1 assinar sem Stripe configurado avisa, sem quebrar", async ({ page }) => {
    const { slug } = await signUp(page);
    await page.goto(`/${slug}/settings/billing`);
    await page.getByRole("button", { name: "Assinar" }).first().click();
    await expect(page.getByRole("alert").filter({ hasText: "Cobrança ainda não configurada" })).toBeVisible();
  });
});
