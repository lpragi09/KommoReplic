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

// cartão do lead com conversa (1440 × 900)
await page.locator('a[href*="/demo/leads/"]').first().click();
await page.waitForURL(/\/demo\/leads\/[0-9a-f-]{36}/);
await page.waitForTimeout(1500);
await page.screenshot({ path: "public/produto-lead.png" });

await browser.close();
console.log("capturas atualizadas");
