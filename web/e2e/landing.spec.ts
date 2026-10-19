import { axe, expect, test } from "./helpers";

test.describe("landing pública", () => {
  test("L-H1 landing sem login, acessível, CTA leva ao cadastro", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" }); // tudo visível de uma vez para o axe medir
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Nenhum cliente perdido no caminho." })).toBeVisible();
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

test("L-H2 termos e privacidade abertos pelo rodapé, acessíveis", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Privacidade" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Política de privacidade" })).toBeVisible();
  await expect(page.getByText("Supabase — banco de dados")).toBeVisible();
  await axe(page);
  await page.goto("/termos");
  await expect(page.getByRole("heading", { level: 1, name: "Termos de uso" })).toBeVisible();
  await axe(page);
});
