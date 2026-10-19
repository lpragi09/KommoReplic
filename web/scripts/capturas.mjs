// Refaz as capturas do produto usadas na landing e na imagem social (public/produto-*.png),
// a partir da conta de demonstração do banco em memória.
// Uso: suba o app (npm run dev -- --port 3200) e rode  node scripts/capturas.mjs [porta]
import { chromium } from "@playwright/test";

const base = `http://localhost:${process.argv[2] ?? 3200}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
await page.goto(`${base}/login`);
await page.getByLabel("Email").fill("demo@exemplo.com");
await page.getByLabel("Senha").fill("demo1234");
await page.getByRole("button", { name: "Entrar", exact: true }).click();
await page.waitForURL(/\/demo\/home/);
await page.goto(`${base}/demo/leads`);
await page.waitForTimeout(1500);

// funil: só a faixa de cima (1440 × 560)
await page.screenshot({ path: "public/produto-funil.png", clip: { x: 0, y: 0, width: 1440, height: 560 } });

// cartão do lead com conversa: no tema escuro (combina com a landing), em 2x e recortado
// sem a faixa do teste e sem o menu lateral, para a conversa aparecer grande e nítida
const leadHref = await page.locator('a[href*="/demo/leads/"]').first().getAttribute("href");
const dark = await browser.newPage({ viewport: { width: 1120, height: 660 }, deviceScaleFactor: 2, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
await dark.context().addCookies(await page.context().cookies());
await dark.addInitScript(() => localStorage.setItem("netzer-tema", "escuro"));
await dark.goto(base + leadHref);
await dark.waitForTimeout(2000);
await dark.screenshot({ path: "public/produto-lead.png", clip: { x: 64, y: 30, width: 1056, height: 630 } });

await browser.close();
console.log("capturas atualizadas");
