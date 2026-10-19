import { axe, expect, signUp, test, unique, visitorPage, webchatKey } from "./helpers";

/* Convite por link (a pessoa aceita) e "marcar tudo como lido" nas notificações. */
test.describe("F25 convite e notificações", () => {
  test("F25-H1 admin convida por link; a pessoa cria a senha e cai na empresa; o link não serve de novo", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const { slug } = await signUp(page);
    const email = `${unique("convidada")}@exemplo.test`;

    await page.goto(`/${slug}/settings/users`);
    await page.getByRole("button", { name: "Convidar por link" }).click();
    const dlg = page.getByRole("dialog", { name: "Convidar por link" });
    await dlg.getByLabel("Email da pessoa").fill(email);
    await dlg.getByRole("button", { name: "Gerar link" }).click();
    const url = (await dlg.locator("code").textContent())!.trim();
    expect(url).toMatch(/\/convite\/[A-Za-z0-9_-]{20,}$/);
    await axe(page);
    await dlg.getByRole("button", { name: "Fechar", exact: true }).last().click();
    await expect(page.getByText(email)).toBeVisible(); // na lista de convites abertos

    // quem foi convidado, em outro navegador
    const guest = await visitorPage(browser);
    await guest.goto(new URL(url).pathname);
    await expect(guest.getByRole("heading", { name: /Entrar em/ })).toBeVisible();
    await guest.getByLabel("Seu nome").fill("Bia Convidada");
    await guest.getByLabel("Crie uma senha").fill("senha-convite-1");
    await guest.getByRole("button", { name: "Criar acesso e entrar" }).click();
    await expect(guest).toHaveURL(new RegExp(`/${slug}/home`));

    // o mesmo link não vale mais
    await guest.goto(new URL(url).pathname);
    await expect(guest.getByText("Este convite já foi usado.")).toBeVisible();

    // na equipe do admin
    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: "Bia Convidada" })).toBeVisible();
  });

  test("F25-H2 marcar tudo como lido zera a contagem e apaga as antigas", async ({ page, browser }) => {
    const { slug } = await signUp(page);
    // um contato novo pelo chat do site gera notificação
    const key = await webchatKey(page, slug);
    const visitor = await visitorPage(browser);
    await visitor.goto(`/chat/${key}`);
    await visitor.getByLabel("Seu nome (opcional)").fill("Rui Aviso");
    await visitor.getByLabel("Mensagem", { exact: true }).fill("Oi, vocês atendem hoje?");
    await visitor.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(visitor.getByText("Oi, vocês atendem hoje?")).toBeVisible();

    // sino do menu com a contagem e a prévia, sem sair da tela
    await page.goto(`/${slug}/home`);
    const bell = page.getByRole("button", { name: /^Notificações \(\d+ novas\)/ });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(page.getByRole("dialog").getByText("Novo contato: Rui Aviso")).toBeVisible();
    await page.getByRole("link", { name: /Ver todas/ }).click();

    await expect(page).toHaveURL(new RegExp(`/${slug}/notifications`));
    await expect(page.getByText("Novo contato: Rui Aviso")).toBeVisible();
    await page.getByRole("button", { name: /Contatos novos/ }).click();
    await expect(page.getByText("Novo contato: Rui Aviso")).toBeVisible();
    await page.getByRole("button", { name: "Marcar tudo como lido" }).click();
    await expect(page.getByRole("button", { name: "Marcar tudo como lido" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Notificações", exact: true })).toBeVisible();
    await expect(page.getByText("Novo contato: Rui Aviso")).toBeVisible(); // continua até ser resolvida
    await axe(page);
  });
});
