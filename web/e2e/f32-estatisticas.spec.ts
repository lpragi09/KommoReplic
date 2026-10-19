import { axe, expect, signUp, test } from "./helpers";

/* Estatísticas como o "Análise de dados" do Kommo: cada seção abre, é acessível e mostra o que aconteceu. */
test("F32-H1 seções das estatísticas, registro com filtro, metas e ROI", async ({ page }) => {
  test.setTimeout(150_000);
  const { slug } = await signUp(page);

  // um pouco de movimento: lead criado com valor e uma nota
  await page.goto(`/${slug}/leads`);
  await page.getByRole("button", { name: "Novo lead" }).click();
  await page.getByLabel("Nome do negócio").fill("Padaria do Zé");
  await page.getByRole("button", { name: "Criar lead" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/leads/[0-9a-f-]{36}`));

  await page.goto(`/${slug}/reports`);
  await expect(page.getByRole("heading", { name: "Estatísticas", level: 1 })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Seções das estatísticas" });

  await nav.getByRole("link", { name: "Análise de vendas" }).click();
  await expect(page.getByRole("region", { name: "Etapa por etapa" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Análise de vendas por etapa" })).toBeVisible();
  await axe(page);

  await nav.getByRole("link", { name: "Relatório consolidado" }).click();
  await expect(page.getByRole("region", { name: "Total de leads" })).toBeVisible();
  await axe(page);

  await nav.getByRole("link", { name: "Por atividades" }).click();
  await expect(page.getByRole("table", { name: "Relatório por atividades" })).toBeVisible();
  await axe(page);

  await nav.getByRole("link", { name: "Registro de atividade" }).click();
  await expect(page.getByRole("cell", { name: "Lead criado" }).first()).toBeVisible();
  await page.getByLabel("Filtrar atividades").fill("padaria");
  await expect(page.getByRole("link", { name: "Padaria do Zé" }).first()).toBeVisible();
  await page.getByLabel("Filtrar atividades").fill("nada-disso-existe");
  await expect(page.getByText("Nada encontrado com esse filtro.")).toBeVisible();
  await axe(page);

  await nav.getByRole("link", { name: "Metas" }).click();
  await page.getByRole("button", { name: "Definir metas" }).click();
  await page.getByLabel(/^Meta em R\$ de/).first().fill("10.000,00");
  await page.getByRole("button", { name: "Salvar metas" }).click();
  await expect(page.getByText(/de R\$\s?10\.000/).first()).toBeVisible();
  await axe(page);

  await nav.getByRole("link", { name: "ROI" }).click();
  await page.getByRole("button", { name: "Novo relatório" }).click();
  await page.getByLabel("Nome").fill("Instagram outubro");
  await page.getByLabel("Investimento (R$)").fill("500,00");
  await page.getByRole("button", { name: "Criar relatório" }).click();
  await expect(page.getByRole("cell", { name: /Instagram outubro/ }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "-100%" })).toBeVisible();
  await axe(page);

  await nav.getByRole("link", { name: "Mensagens por canal" }).click();
  await expect(page.getByRole("region", { name: "Por canal" })).toBeVisible();
  await axe(page);
});
