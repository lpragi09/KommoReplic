import { axe, expect, signUp, test, webchatKey } from "./helpers";

/* Planilhas (importar e exportar contatos, exportar leads), widget de chat e cabeçalhos contra iframe. */
test.describe("F24 planilhas e widget", () => {
  test("F24-H1 importa contatos de CSV, pula repetidos e exporta de volta", async ({ page }) => {
    const { slug } = await signUp(page);
    await page.goto(`/${slug}/contacts`);
    await page.getByRole("button", { name: "Importar" }).click();
    const dlg = page.getByRole("dialog", { name: "Importar contatos" });
    const csv = 'Nome;Telefone;E-mail;Empresa\nJoão Teste;(11) 91234-5678;joao@teste.com;Padaria Sol\n"Silva, Ana";21 99876-5432;ana@x.com;Padaria Sol\nRepetido;11 91234-5678;;\n';
    await dlg.locator('input[type="file"]').setInputFiles({ name: "contatos.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(dlg.getByRole("cell", { name: "Silva, Ana" })).toBeVisible();
    await axe(page);
    await dlg.getByRole("button", { name: "Importar 3 contatos" }).click();
    await expect(dlg.getByRole("status")).toContainText("2 contatos importados; 1 pulados");
    await dlg.getByRole("button", { name: "Fechar", exact: true }).last().click();
    await expect(page.getByRole("link", { name: /João Teste/ })).toBeVisible();

    const res = await page.request.get(`/${slug}/contacts/export`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const text = await res.text();
    expect(text).toContain("Nome;Telefone;Email");
    expect(text).toContain("João Teste;(11) 91234-5678;joao@teste.com;;Padaria Sol");
    expect(text).toContain("Silva, Ana;(21) 99876-5432;ana@x.com"); // separador é ;, a vírgula do nome não precisa de aspas

    const leads = await page.request.get(`/${slug}/leads/export`);
    expect(leads.status()).toBe(200);
    expect(await leads.text()).toContain("Número;Negócio;Funil;Etapa");
  });

  test("F24-H2 widget abre o chat em iframe; painel não aceita iframe", async ({ page }) => {
    const { slug } = await signUp(page);
    const key = await webchatKey(page, slug);
    await page.goto(`/${slug}/settings/channels`);
    await expect(page.locator("code").filter({ hasText: "widget.js" })).toContainText(`data-chat="${key}"`);

    const chat = await page.request.get(`/chat/${key}`);
    expect(chat.headers()["content-security-policy"]).toBe("frame-ancestors *");
    const panel = await page.request.get("/login");
    expect(panel.headers()["x-frame-options"]).toBe("DENY");

    // "site do cliente": página HTML simples (outra origem) com o script do widget
    const base = test.info().project.use.baseURL;
    await page.setContent(`<!doctype html><html lang="pt-BR"><head><title>Site</title></head><body><h1>Padaria</h1><script src="${base}/widget.js" data-chat="${key}"></script></body></html>`);
    await page.getByRole("button", { name: "Abrir o chat" }).click();
    const frame = page.frameLocator('iframe[title="Chat"]');
    await expect(frame.getByLabel("Mensagem", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Abrir o chat" })).toBeVisible();
  });
});
