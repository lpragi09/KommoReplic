import { expect, test, unique } from "./helpers";

test("D-H1 modo demonstração: email novo entra direto na Loja Demo", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(`${unique()}@qualquer.test`);
  await page.getByLabel("Senha").fill("qualquer-senha");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/demo\/home/);
  await expect(page.getByRole("heading", { name: "Painel", level: 1 })).toBeVisible();
});
