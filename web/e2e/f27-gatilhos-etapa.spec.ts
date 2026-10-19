import { axe, expect, signUp, test } from "./helpers";

/* "Adicionar" de uma etapa do funil digital, como no Kommo: lista do que pode acontecer,
   robô escolhido pelo nome, regra de execução, atraso — e o gatilho rodando de verdade. */
test("F27-H1 gatilho de etapa: escolhe um robô pelo nome e uma tarefa que roda ao criar o lead", async ({ page }) => {
  test.setTimeout(120_000);
  const { slug } = await signUp(page);

  // um robô seu, para ser chamado pela etapa
  await page.goto(`/${slug}/automations`);
  await page.getByRole("tab", { name: "Modelos prontos" }).click();
  await page.getByRole("link", { name: /Boas-vindas/ }).click();
  await page.getByLabel("Nome do robô").fill("Robô de recepção");
  await page.getByRole("button", { name: "Criar robô" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/automations/[0-9a-f-]{36}`));

  // + Adicionar na etapa "Qualificado": abre a lista de gatilhos
  await page.goto(`/${slug}/automations`);
  await page.getByRole("tab", { name: "Funil digital" }).click();
  await page.getByRole("button", { name: "Adicionar gatilho em Qualificado" }).click();
  const dlg = page.getByRole("dialog", { name: /Adicionar à etapa “Qualificado”/ });
  await expect(dlg.getByRole("button", { name: /Adicionar tarefa/ })).toBeVisible();
  await axe(page);
  await dlg.getByRole("button", { name: /^Robô/ }).click();

  // escolhe o robô pelo nome, quando movido, 5 min depois
  const cfg = page.getByRole("dialog", { name: /Robô em “Qualificado”/ });
  await cfg.getByLabel("Buscar robô pelo nome").fill("recep");
  await cfg.getByRole("radio", { name: /Robô de recepção/ }).click();
  await cfg.getByLabel("Quando").selectOption("moved");
  await cfg.getByRole("radio", { name: "5 min" }).click();
  await axe(page);
  await cfg.getByRole("button", { name: "Adicionar gatilho" }).click();
  await expect(cfg).toBeHidden();
  const col = page.getByRole("region", { name: /Qualificado: 1 robôs/ });
  await expect(col.getByText("Robô: Robô de recepção")).toBeVisible();
  await expect(col.getByText(/quando movido para cá · depois de 5 min/)).toBeVisible();

  // tarefa na hora, quando o lead nasce em "Primeiro contato"
  await page.getByRole("button", { name: "Adicionar gatilho em Primeiro contato" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Adicionar tarefa/ }).click();
  const task = page.getByRole("dialog", { name: /Adicionar tarefa em “Primeiro contato”/ });
  await task.getByLabel("Tarefa", { exact: true }).fill("Ligar em até 1 hora");
  await task.getByLabel("Quando").selectOption("created");
  await task.getByRole("button", { name: "Adicionar gatilho" }).click();
  await expect(task).toBeHidden();

  // o lead criado na etapa recebe a tarefa
  await page.goto(`/${slug}/leads`);
  await page.getByRole("button", { name: "Novo lead" }).click();
  await page.getByLabel("Nome do negócio").fill("Lead do gatilho");
  await page.getByRole("button", { name: "Criar lead" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/leads/[0-9a-f-]{36}`));
  await expect(page.getByText("Ligar em até 1 hora").first()).toBeVisible();

  // editar: clicar no gatilho reabre a janela já preenchida
  await page.goto(`/${slug}/automations`);
  await page.getByRole("tab", { name: "Funil digital" }).click();
  await page.getByRole("button", { name: /Tarefa: Ligar em até 1 hora/ }).click();
  const edit = page.getByRole("dialog", { name: /Gatilho em “Primeiro contato”/ });
  await expect(edit.getByLabel("Tarefa", { exact: true })).toHaveValue("Ligar em até 1 hora");
  await expect(edit.getByLabel("Quando")).toHaveValue("created");
});
