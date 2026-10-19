import type { Page } from "@playwright/test";
import { axe, expect, signUp, test } from "./helpers";

/* Gatilhos novos do funil digital: etiqueta adicionada (encadeada por outro gatilho), alterar campo,
   criar lead em outra etapa e "todo dia no horário" rodando agora para quem já está na etapa. */

async function add(page: Page, stage: string, option: RegExp) {
  await page.getByRole("button", { name: `Adicionar gatilho em ${stage}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: option }).click();
  return page.getByRole("dialog");
}

test("F31-H1 etiqueta dispara tarefa, campo muda o valor e um lead novo nasce em outra etapa", async ({ page }) => {
  test.setTimeout(150_000);
  const { slug } = await signUp(page);
  await page.goto(`/${slug}/automations`);
  await page.getByRole("tab", { name: "Funil digital" }).click();

  // 1) ao criar: coloca a etiqueta "vip"
  let d = await add(page, "Primeiro contato", /^Editar etiquetas/);
  await d.getByLabel("Etiqueta", { exact: true }).fill("vip");
  await d.getByLabel("Quando").selectOption("created");
  await d.getByRole("button", { name: "Adicionar gatilho" }).click();
  await expect(d).toBeHidden();

  // 2) quando ganha "vip": tarefa
  d = await add(page, "Primeiro contato", /^Adicionar tarefa/);
  await d.getByLabel("Tarefa", { exact: true }).fill("Atender VIP");
  await d.getByLabel("Quando").selectOption("tag");
  await d.getByLabel("Etiqueta que dispara").fill("vip");
  await axe(page);
  await d.getByRole("button", { name: "Adicionar gatilho" }).click();
  await expect(d).toBeHidden();

  // 3) ao criar: valor da venda = 1500
  d = await add(page, "Primeiro contato", /^Alterar campo/);
  await page.getByRole("combobox", { name: "Campo", exact: true }).selectOption({ label: "Valor da venda" });
  await expect(page.getByRole("combobox", { name: "Campo", exact: true })).toHaveValue("price");
  await d.getByLabel("Novo valor").fill("1500");
  await d.getByLabel("Quando").selectOption("created");
  await d.getByRole("button", { name: "Adicionar gatilho" }).click();
  await expect(d).toBeHidden();

  // 4) ao criar: abre um lead de pós-venda em Negociação
  d = await add(page, "Primeiro contato", /^Criar lead/);
  await d.getByLabel("Etapa do lead novo").selectOption({ label: "Negociação" });
  await d.getByLabel("Nome do lead novo").fill("{{lead}} pós-venda");
  await d.getByLabel("Quando").selectOption("created");
  await d.getByRole("button", { name: "Adicionar gatilho" }).click();
  await expect(d).toBeHidden();

  const col = page.getByRole("region", { name: /Primeiro contato: 4 robôs/ });
  await expect(col.getByText("quando ganha a etiqueta “vip”", { exact: false })).toBeVisible();

  // o lead criado passa por tudo
  await page.goto(`/${slug}/leads`);
  await page.getByRole("button", { name: "Novo lead" }).click();
  await page.getByLabel("Nome do negócio").fill("Cliente Ouro");
  await page.getByRole("button", { name: "Criar lead" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/leads/[0-9a-f-]{36}`));
  await page.reload();
  await expect(page.getByText("Atender VIP").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar valor: R$ 1.500" }).first()).toBeVisible();

  await page.goto(`/${slug}/leads?view=list`);
  await expect(page.getByRole("link", { name: "Cliente Ouro pós-venda" }).first()).toBeVisible();
});

test("F31-H2 todo dia no horário: rodar agora também aplica aos leads da etapa", async ({ page }) => {
  test.setTimeout(120_000);
  const { slug } = await signUp(page);
  await page.goto(`/${slug}/leads`);
  await page.getByRole("button", { name: "Novo lead" }).click();
  await page.getByLabel("Nome do negócio").fill("Lead parado");
  await page.getByRole("button", { name: "Criar lead" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/leads/[0-9a-f-]{36}`));
  const leadUrl = page.url();

  await page.goto(`/${slug}/automations`);
  await page.getByRole("tab", { name: "Funil digital" }).click();
  const d = await add(page, "Primeiro contato", /^Nota interna/);
  await d.getByLabel("Texto da nota").fill("Lembrete diário: retomar contato");
  await d.getByLabel("Quando").selectOption("daily");
  await d.getByLabel("Horário (Brasília)").fill("23:59");
  await d.getByLabel(/Rodar agora também/).check();
  await d.getByRole("button", { name: "Adicionar gatilho" }).click();
  await expect(d).toBeHidden();
  await expect(page.getByText("todo dia às 23:59", { exact: false })).toBeVisible();

  await page.goto(leadUrl);
  await expect(page.getByText("Lembrete diário: retomar contato").first()).toBeVisible();
});
