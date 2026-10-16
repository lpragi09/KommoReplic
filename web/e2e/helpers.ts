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

/** CPF válido e diferente a cada chamada: cada conta de teste ganha o próprio teste grátis. */
export function newCPF() {
  const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  if (d.every((x) => x === d[0])) d[8] = (d[0] + 1) % 10;
  const dv = (len: number) => {
    const s = d.slice(0, len).reduce((acc, x, i) => acc + x * (len + 1 - i), 0);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  d.push(dv(9));
  d.push(dv(10));
  return d.join("");
}

/** Preenche o formulário de cadastro (empresa e CPF inclusos) e envia. */
export async function fillSignUp(page: Page, o: { name?: string; email: string; password?: string; company?: string; cpf?: string }) {
  await page.getByLabel("Seu nome").fill(o.name ?? "Tester Silva");
  await page.getByLabel("Email de trabalho").fill(o.email);
  await page.getByLabel("Senha").fill(o.password ?? "senha-teste-123");
  await page.getByLabel("Nome do seu negócio").fill(o.company ?? "Negócio de Teste");
  await page.getByLabel("CPF", { exact: true }).fill(o.cpf ?? newCPF());
  await page.getByRole("button", { name: "Criar conta" }).click();
}

/** Cria conta + empresa nova. Cada teste tem seus próprios dados. Cai na tela de planos e segue para o funil. */
export async function signUp(page: Page, name = "Tester Silva", cpf = newCPF()) {
  const id = unique();
  const email = `${id}@exemplo.test`;
  await page.goto("/signup");
  await fillSignUp(page, { name, email, company: `Empresa ${id}`, cpf });
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByLabel("Nome da empresa")).toHaveValue(`Empresa ${id}`);
  await page.getByRole("button", { name: "Continuar para os planos" }).click();
  await expect(page).toHaveURL(/\/settings\/billing\?(bemvindo|semteste)=1/);
  const slug = new URL(page.url()).pathname.split("/")[1];
  if (page.url().includes("bemvindo")) {
    await page.getByRole("link", { name: /Continuar no teste grátis/ }).click();
    await expect(page).toHaveURL(/\/leads/);
  }
  return { email, password: "senha-teste-123", slug, cpf };
}

export async function webchatKey(page: Page, slug: string) {
  await page.goto(`/${slug}/settings/channels`);
  const code = await page.locator("code").first().textContent();
  return code!.trim().split("/chat/").pop()!.trim();
}

export async function axe(page: Page) {
  await page.waitForLoadState("networkidle"); // não mede no meio de uma troca de página
  // espera as animações de entrada (finitas) acabarem; as de fundo (infinitas) não contam
  await page.waitForFunction(() =>
    document
      .getAnimations()
      // ignora as infinitas (fundo) e as ligadas à rolagem (só andam quando a pessoa rola)
      .every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity || !(a.timeline instanceof DocumentTimeline)),
  );
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
