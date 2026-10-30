import { axe, expect, signUp, test, visitorPage, webchatKey } from "./helpers";

/* Fontes de cada funil: canal padrão e regras de entrada (a mesma rede alimentando funis diferentes). */
test("F36-H1 regra de palavra manda o contato novo para outro funil; sem regra, vai para o padrão do canal", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const { slug } = await signUp(page);
  const key = await webchatKey(page, slug);

  await page.goto(`/${slug}/leads`);
  const panel = page.getByRole("complementary", { name: "Fontes do funil" });
  await expect(panel.getByText("Chat do site")).toBeVisible(); // o chat do site nasce apontando para o funil Vendas

  await page.getByRole("button", { name: "Opções do funil" }).click();
  await page.getByRole("menuitem", { name: "Novo funil" }).click();
  await page.getByLabel("Nome do funil").fill("Orçamentos");
  await page.getByRole("button", { name: "Criar funil" }).click();
  await expect(page.getByRole("combobox", { name: "Funil", exact: true })).toContainText("Orçamentos");
  await expect(panel.getByText("Nenhum canal manda contato novo direto para este funil.")).toBeVisible();
  const orcamentos = page.url();

  // regra: qualquer canal, mensagem com "orçamento"
  await panel.getByRole("button", { name: "Mandar contatos para cá por palavra" }).click();
  await panel.getByLabel("Se a mensagem tiver estas palavras").fill("orçamento, preço");
  await panel.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(panel.getByRole("listitem").filter({ hasText: "Mensagem de qualquer canal que tem a palavra “orçamento, preço”" })).toBeVisible();
  await axe(page);

  const visitor = await visitorPage(browser);
  await visitor.goto(`/chat/${key}`);
  await visitor.getByLabel("Seu nome (opcional)").fill("Ana Prado");
  await visitor.getByLabel("Mensagem", { exact: true }).fill("Oi, queria um ORCAMENTO de clareamento");
  await visitor.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(visitor.getByText("Oi, queria um ORCAMENTO de clareamento")).toBeVisible();

  const other = await visitorPage(browser);
  await other.goto(`/chat/${key}`);
  await other.getByLabel("Seu nome (opcional)").fill("Beto Lima");
  await other.getByLabel("Mensagem", { exact: true }).fill("Bom dia, vocês abrem sábado?");
  await other.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(other.getByText("Bom dia, vocês abrem sábado?")).toBeVisible();

  await page.goto(orcamentos);
  await expect(page.getByRole("button", { name: "Aceitar Ana Prado como lead" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aceitar Beto Lima como lead" })).toHaveCount(0);
  await expect(panel.getByText("1 contato trazido")).toBeVisible();

  await page.goto(`/${slug}/leads`);
  await expect(page.getByRole("button", { name: "Aceitar Beto Lima como lead" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aceitar Ana Prado como lead" })).toHaveCount(0);

  // trazer o canal para o outro funil: passa a ser o padrão dele
  await page.goto(orcamentos);
  await panel.getByRole("combobox", { name: "Trazer canal para cá" }).click();
  await page.getByRole("option", { name: /Chat do site/ }).click();
  await expect(panel.getByRole("listitem").filter({ hasText: "Chat do site" })).toBeVisible();

  // fechar o painel vira uma faixa e continua fechado ao recarregar
  await panel.getByRole("button", { name: "Fechar fontes do funil" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Abrir fontes do funil" })).toBeVisible();
});
