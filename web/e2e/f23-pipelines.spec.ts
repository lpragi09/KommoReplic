import { axe, expect, signUp, test } from "./helpers";

/* Vários funis e etapas editáveis direto no Kanban. */
test.describe("F23 funis e etapas", () => {
  test("F23-H1 cria funil, adiciona, renomeia e apaga etapa; voltar e Automatize", async ({ page }) => {
    test.setTimeout(120_000);
    const { slug } = await signUp(page);
    await page.goto(`/${slug}/leads`);
    await expect(page.getByRole("link", { name: "Voltar" })).toHaveCount(0); // tela principal da seção: sem voltar
    await expect(page.getByRole("link", { name: "Automatize" })).toHaveAttribute("href", `/${slug}/automations`);

    // novo funil
    await page.getByRole("button", { name: "Opções do funil" }).click();
    await page.getByRole("menuitem", { name: "Novo funil" }).click();
    await page.getByLabel("Nome do funil").fill("Pós-venda");
    await page.getByRole("button", { name: "Criar funil" }).click();
    await expect(page.getByRole("combobox", { name: "Funil" })).toContainText("Pós-venda");

    // nova etapa no fim
    await page.getByRole("button", { name: "Nova etapa" }).click();
    await page.getByLabel("Nome da nova etapa").fill("Visita agendada");
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(page.getByRole("region", { name: /Visita agendada, 0 leads/ })).toBeVisible();

    // renomeia
    await page.getByRole("button", { name: "Opções da etapa Visita agendada" }).click();
    await page.getByRole("menuitem", { name: "Renomear etapa" }).click();
    await page.getByLabel("Nome da etapa").fill("Visita marcada");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("region", { name: /Visita marcada, 0 leads/ })).toBeVisible();
    await axe(page);

    // apaga
    await page.getByRole("button", { name: "Opções da etapa Visita marcada" }).click();
    await page.getByRole("menuitem", { name: "Excluir etapa" }).click();
    await page.getByRole("button", { name: "Excluir etapa" }).click();
    await expect(page.getByRole("region", { name: /Visita marcada/ })).toHaveCount(0);

    // dentro de uma seção o voltar leva para a seção de cima
    await page.goto(`/${slug}/settings/channels`);
    await page.getByRole("link", { name: "Voltar" }).click();
    await expect(page).toHaveURL(new RegExp(`/${slug}/settings$`));
  });
});
