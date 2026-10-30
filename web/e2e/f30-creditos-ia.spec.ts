import { axe, expect, signUp, test } from "./helpers";

/* Lixeira no funil digital nunca apaga o robô: ele sai da coluna e fica em Todos os robôs. */
test("F30-H1 tirar robô do funil não apaga; põe de volta; excluir só de vez na lista", async ({ page }) => {
  test.setTimeout(90_000);
  const { slug } = await signUp(page);
  await page.goto(`/${slug}/automations`);
  await page.getByRole("tab", { name: "Modelos prontos" }).click();
  await page.getByRole("link", { name: /Boas-vindas/ }).click();
  await page.getByLabel("Nome do robô").fill("Recepção do site");
  await page.getByRole("button", { name: "Criar robô" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/automations/[0-9a-f-]{36}`));

  await page.goto(`/${slug}/automations`);
  await page.getByRole("tab", { name: "Funil digital" }).click();
  await page.getByRole("button", { name: "Tirar Recepção do site do funil" }).click();
  await page.getByRole("dialog", { name: /Tirar “Recepção do site” do funil/ }).getByRole("button", { name: "Tirar do funil" }).click();
  await expect(page.getByRole("region", { name: /Primeiro contato: 0 robôs/ })).toBeVisible();

  await page.getByRole("tab", { name: /Todos os robôs/ }).click();
  await expect(page.getByText("Fora do funil (só roda quando um gatilho chama)")).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /Todos os robôs/ }).click();
  await page.getByRole("button", { name: "Pôr no funil" }).click();
  await page.getByRole("tab", { name: "Funil digital" }).click();
  await expect(page.getByRole("region", { name: /Primeiro contato: 1 robô/ })).toBeVisible();

  await page.getByRole("tab", { name: /Todos os robôs/ }).click();
  await page.getByRole("button", { name: "Excluir Recepção do site" }).click();
  await page.getByRole("dialog", { name: /Excluir o robô “Recepção do site” de vez/ }).getByRole("button", { name: "Excluir de vez" }).click();
  await expect(page.getByText("Nenhum robô ainda")).toBeVisible();
});

/* Plano e cobrança: abas Meu plano, Complementos (créditos de IA, chave própria) e Uso. */
test("F30-H2 créditos de IA: teste gasta crédito, aba Uso mostra limites, chave própria", async ({ page }) => {
  test.setTimeout(90_000);
  const { slug } = await signUp(page);

  await page.goto(`/${slug}/settings/billing?aba=uso`);
  await expect(page.getByRole("heading", { name: "Plano Teste grátis" })).toBeVisible();
  await expect(page.getByText("Respostas da IA neste mês")).toBeVisible();
  await expect(page.getByRole("meter", { name: "Créditos de IA usados" })).toHaveAttribute("aria-valuenow", "0");
  await axe(page);

  // a IA não vem no plano: sem crédito, nem o chat de teste responde
  await page.goto(`/${slug}/settings/ai`);
  await page.getByRole("textbox", { name: "Base de conhecimento" }).fill("Abrimos às 9h.");
  await page.getByLabel("Mensagem de teste").fill("que horas abre?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText(/Sem créditos/).first()).toBeVisible();
  await page.goto(`/${slug}/settings/billing?aba=complementos`);
  await expect(page.getByRole("meter", { name: "Créditos de IA usados" })).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByRole("link", { name: "Adicionar créditos" })).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Adicionar créditos" }).first()).toHaveAttribute("href", /checkout\?pacote=ia_500$/);
  await axe(page);

  // chave própria: formato errado é recusado; a de teste passa e a IA deixa de gastar crédito
  await page.getByLabel("Chave da API").fill("abc");
  await page.getByRole("button", { name: "Testar e salvar" }).click();
  await expect(page.getByText(/não parece uma chave da Anthropic/)).toBeVisible();
  await page.getByLabel("Chave da API").fill("sk-ant-teste-0000000000000000000000001234");
  await page.getByRole("button", { name: "Testar e salvar" }).click();
  await expect(page.getByText("Chave salva e testada.", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Chave ativa (…1234)")).toBeVisible();
});
