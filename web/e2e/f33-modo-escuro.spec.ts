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

/* Uma imagem só: a foto trocada em Meu perfil aparece também no quadro da empresa em Configurações. */
test("F33-H2 botão de modo escuro no menu e foto de Meu perfil no quadro de Configurações", async ({ page }) => {
  test.setTimeout(90_000);
  const { slug } = await signUp(page);
  await page.getByRole("button", { name: "Modo escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Modo escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.goto(`/${slug}/settings/profile`);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "eu.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("button", { name: /Remover/ })).toBeVisible();
  await page.goto(`/${slug}/settings`);
  const link = page.getByRole("link", { name: "Trocar a foto em Meu perfil" });
  await expect(link.locator("img")).toHaveAttribute("src", /^data:image\//);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/settings/profile`));
});
