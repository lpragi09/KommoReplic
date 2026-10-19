import { axe, expect, signUp, test } from "./helpers";

/* Modo escuro: opção de cada pessoa (Meu perfil e menu da conta), lembrada no navegador, sem perder contraste. */
test("F33-H1 liga o modo escuro, continua depois de recarregar e passa no teste de contraste", async ({ page }) => {
  test.setTimeout(120_000);
  const { slug } = await signUp(page);
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");

  await page.goto(`/${slug}/settings/profile`);
  await page.getByRole("radio", { name: "Escuro" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await axe(page);

  for (const path of ["leads", "home", "inbox", "automations", "reports?aba=vendas", "settings"]) {
    await page.goto(`/${slug}/${path}`);
    await expect(html).toHaveAttribute("data-theme", "dark");
    await axe(page);
  }

  // troca rápida no menu da conta
  await page.getByRole("button", { name: /^Conta de/ }).click();
  await page.getByRole("menuitem", { name: "Modo claro" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
});
