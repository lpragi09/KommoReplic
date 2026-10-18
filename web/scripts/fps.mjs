// Mede quadros por segundo (parado e rolando, CPU 4x mais lenta) na landing, login, funil e caixa de entrada.
// Uso: suba o app na porta 3100 (npm run dev -- --port 3100) e rode  node scripts/fps.mjs
import { chromium } from "@playwright/test";
const b = await chromium.launch({ args: ["--enable-gpu-rasterization"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
const cdp = await p.context().newCDPSession(p);
const fps = async () => { await p.waitForTimeout(1200); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const r = await p.evaluate(async () => { const run = async (scroll) => { const t = []; let last = performance.now(); let y = 0; const el = document.scrollingElement;
      await new Promise((done) => { const t0 = performance.now(); const tick = (now) => { t.push(now - last); last = now; if (scroll) { y += 40; el.scrollTo(0, y); } if (now - t0 < 2500) requestAnimationFrame(tick); else done(); }; requestAnimationFrame(tick); });
      return Math.round(1000 / (t.reduce((s, x) => s + x, 0) / t.length)); };
    return { parado: await run(false), rolando: await run(true) }; });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }); return JSON.stringify(r); };
await p.goto("http://localhost:3100/"); console.log("landing     ", await fps());
await p.goto("http://localhost:3100/login"); console.log("login       ", await fps());
await p.getByLabel("Email").fill("demo@exemplo.com"); await p.getByLabel("Senha").fill("demo1234");
await p.getByRole("button", { name: "Entrar" }).click(); await p.waitForURL(/demo\/leads/);
console.log("funil       ", await fps());
await p.goto("http://localhost:3100/demo/inbox"); console.log("caixa entr. ", await fps());
await b.close();
