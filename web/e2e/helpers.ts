import { expect, test as base, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const extraErrors: string[] = []; // erros de abas extras (ex.: visitante)

/** Toda spec falha com erro de console ou resposta 5xx, em qualquer aba que ela abrir. */
export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
      });
      extraErrors.length = 0;
      await use();
      expect([...errors, ...extraErrors], "erros de console / 5xx").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

let n = 0;
export const unique = (p = "t") => `${p}${Date.now().toString(36)}${(n++).toString(36)}`;

/** Cria conta + empresa nova. Cada teste tem seus próprios dados. */
export async function signUp(page: Page, name = "Tester Silva") {
  const id = unique();
  const email = `${id}@exemplo.test`;
  await page.goto("/signup");
  await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("Email de trabalho").fill(email);
  await page.getByLabel("Senha").fill("senha-teste-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Nome da empresa").fill(`Empresa ${id}`);
  await page.getByRole("button", { name: "Abrir meu funil" }).click();
  await expect(page).toHaveURL(/\/leads/);
  const slug = new URL(page.url()).pathname.split("/")[1];
  return { email, password: "senha-teste-123", slug };
}

export async function webchatKey(page: Page, slug: string) {
  await page.goto(`/${slug}/settings/channels`);
  const code = await page.locator("code").first().textContent();
  return code!.replace("/chat/", "").trim();
}

export async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const summary = r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(summary, "violações de acessibilidade").toEqual([]);
}

/** Visitante anônimo num contexto separado (sem a sessão da equipe). */
export async function visitorPage(browser: Browser) {
  const ctx = await browser.newContext({ baseURL: base.info().project.use.baseURL, locale: "pt-BR" });
  const p = await ctx.newPage();
  p.on("console", (m) => {
    if (m.type() === "error") extraErrors.push(`[visitante] ${m.text()}`);
  });
  p.on("pageerror", (e) => extraErrors.push(`[visitante] ${e.message}`));
  return p;
}
