import { axe, expect, signUp, test } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("F28-H1 chat da equipe: emoji no texto e foto com legenda", async ({ page }) => {
  const { slug } = await signUp(page);
  await page.goto(`/${slug}/team-chat`);
  await page.getByLabel("Mensagem para a equipe").fill("Reunião às 15h ");
  await page.getByRole("button", { name: "Inserir emoji" }).click();
  await page.getByRole("button", { name: "Emoji 👍" }).click();
  await expect(page.getByLabel("Mensagem para a equipe")).toHaveValue("Reunião às 15h 👍");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Reunião às 15h 👍")).toBeVisible();

  await page.getByLabel("Mensagem para a equipe").fill("Print do problema");
  await page.locator('input[type="file"]').setInputFiles({ name: "print.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "print.png" })).toBeVisible();
  await expect(page.getByText("Print do problema")).toBeVisible();
  await axe(page);
});

test("F28-H2 gatilho de etapa 'Enviar email' e disparo por email aparecem prontos", async ({ page }) => {
  const { slug } = await signUp(page);
  await page.goto(`/${slug}/automations`);
  await page.getByRole("tab", { name: "Funil digital" }).click();
  await page.getByRole("button", { name: "Adicionar gatilho em Qualificado" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Enviar email/ }).click();
  const cfg = page.getByRole("dialog", { name: /Enviar email em “Qualificado”/ });
  await cfg.getByLabel("Assunto").fill("{{nome}}, sua proposta");
  await cfg.getByLabel("Texto do email").fill("Olá, {{nome}}! Segue a proposta.");
  await cfg.getByRole("button", { name: "Adicionar gatilho" }).click();
  await expect(cfg).toBeHidden();
  await expect(page.getByRole("region", { name: /Qualificado: 1 robôs/ }).getByText("Email: {{nome}}, sua proposta")).toBeVisible();

  await page.goto(`/${slug}/broadcasts`);
  await page.getByRole("radio", { name: /Email/ }).click();
  await expect(page.getByLabel("Assunto")).toBeVisible();
  await expect(page.getByLabel("Texto do email")).toBeVisible();
  await axe(page);
});
