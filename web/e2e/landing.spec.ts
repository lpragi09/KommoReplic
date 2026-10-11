import { axe, expect, test } from "./helpers";

test.describe("landing pública", () => {
  test("L-H1 landing sem login, acessível, CTA leva ao cadastro", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Nenhum cliente perdido no caminho." })).toBeVisible();
    await expect(page.getByText("em breve").first()).toBeVisible(); // recurso não pronto é marcado
    await axe(page);
    await page.getByRole("link", { name: /Testar 14 dias grátis/ }).first().click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("@mobile L-E1 landing em 390px sem rolagem horizontal", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
