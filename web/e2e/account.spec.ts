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
    await expect(page).toHaveURL(/\/demo\/home/);
    await page.goto(`/${slug}/leads`);
    await expect(page.getByText("Não encontramos esta página")).toBeVisible();
  });

  test("A-N1 assinar sem Mercado Pago configurado avisa, sem quebrar", async ({ page }) => {
    const { slug } = await signUp(page);
    await page.goto(`/${slug}/settings/billing`);
    await page.getByRole("link", { name: "Assinar Equipe" }).click();
    await expect(page).toHaveURL(`/${slug}/settings/billing/checkout?plano=equipe&periodo=mensal`);
    await expect(page.getByRole("alert").filter({ hasText: "Cobrança ainda não configurada" })).toBeVisible();
    await expect(page.getByLabel("Resumo do pedido")).toContainText(/R\$\s149,00/);

    // passo 1: dados de cobrança (CPF errado é recusado no servidor)
    await page.getByLabel("CPF", { exact: true }).fill("111.111.111-11");
    await page.getByLabel("Nome completo").fill("Maria Souza");
    await page.getByLabel("Rua", { exact: true }).fill("Rua das Flores");
    await page.getByLabel("Número").fill("100");
    await page.getByLabel("Bairro").fill("Centro");
    await page.getByLabel("Cidade").fill("Campinas");
    await page.getByLabel("UF").fill("SP");
    await page.getByLabel("CEP", { exact: true }).fill("13010-000");
    await page.getByRole("button", { name: "Continuar para o pagamento" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "CPF ou CNPJ inválido" })).toBeVisible();
    await page.getByLabel("CPF", { exact: true }).fill("529.982.247-25");
    await page.getByRole("button", { name: "Continuar para o pagamento" }).click();

    // passo 2: forma de pagamento; sem Mercado Pago o botão fica desligado
    await expect(page.getByRole("heading", { name: "Forma de pagamento" })).toBeVisible();
    await expect(page.getByText("Maria Souza · 529.982.247-25")).toBeVisible();
    await page.getByText("Boleto", { exact: true }).click();
    await expect(page.getByRole("button", { name: /Gerar boleto de R\$\s149,00/ })).toBeDisabled();
    await axe(page);
    // os dados ficam salvos: voltar ao checkout abre direto no pagamento
    await page.reload();
    await expect(page.getByRole("heading", { name: "Forma de pagamento" })).toBeVisible();
  });
});
