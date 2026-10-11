# Marca

Ângulo (de `fixes.md`, opção A): para pequenas empresas que vendem pelo WhatsApp e já perderam cliente porque a mensagem atrasou, sumiu ou o sistema caiu — o produto mostra o caminho de cada mensagem e avisa na hora quando um canal para.

Nome aplicado no código: **Recadi** (constante única em `web/src/lib/brand.ts`). É uma recomendação: trocar é uma linha.

## 1. Candidatos (20)

| estilo | nomes |
| --- | --- |
| descritivo | Recado, Conversa Certa, FunilChat |
| composto | Leadline, Vendaline, Trilho CRM |
| inventado | Recadi, Telva, Lumvo, Falaro, Vendrix, Zuno |
| metáfora | Farol, Bússola, Âncora, Trilha, Sinal, Rastro |
| verbo | Atende, Responde |

Cortados:
- **FunilChat:** genérico.
- **Recado, Farol, Sinal, Rastro, Trilho, Bússola, Âncora:** domínio com DNS em .com.br, .com e .app; palavras comuns, difíceis de registrar como marca.
- **Vendrix, Zuno:** domínios ocupados.
- **Atende, Responde:** verbos comuns, sem distinção.
- Nenhum candidato lembra "Kommo" no som, na grafia ou no sentido.

## 2. Finalistas e checagens

"sem DNS" = o domínio não respondeu a consulta de servidores de nome em 2026-10-11. **É indício, não disponibilidade.** Confirmar no registro.br (WHOIS) e no registrador.

| nome | por quê | domínio (DNS, 2026-10-11) | INPI (BR, classes 9 e 42) | USPTO | EUIPO/TMview | WIPO | App Store / Play | Instagram, TikTok, X, GitHub | busca "nome + CRM" |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Recadi** | de "recado": a mensagem que chega; fácil de falar no Brasil | recadi.com.br sem DNS · recadi.com com DNS | a rodar | a rodar | a rodar | a rodar | a rodar | a rodar | a rodar |
| Telva | curto, inventado, neutro | telva.com.br sem DNS · telvacrm.com sem DNS · usetelva.com sem DNS | a rodar | a rodar | a rodar | a rodar | a rodar | a rodar | a rodar |
| Falaro | "falar"; soa brasileiro | falaro.com.br sem DNS · falaro.com com DNS | a rodar | a rodar | a rodar | a rodar | a rodar | a rodar | a rodar |
| Lumvo | luz/caminho visível | lumvo.com.br sem DNS · lumvo.com com DNS | a rodar | a rodar | a rodar | a rodar | a rodar | a rodar | a rodar |
| Trilho CRM | o trilho da mensagem | trilhocrm.com.br e .com sem DNS | a rodar | a rodar | a rodar | a rodar | a rodar | a rodar | a rodar |

Onde rodar: INPI (busca.inpi.gov.br — o mercado principal é o Brasil, então esta vem primeiro), tmsearch.uspto.gov, TMview, WIPO Global Brand Database, registro.br, as lojas e as redes. **São checagens de triagem.** Antes de gastar dinheiro com o nome, um advogado de marcas faz a busca de verdade.

## 3. Paleta

Cores do original lidas da página pública em 2026-10-11: índigo muito escuro `#0e0142` (texto e botões) + lavanda. A nossa: **preto neutro `#0a0a0b` + azul royal `#1d4ed8`**, com aurora em azuis (`#1d4ed8`, `#38bdf8`, `#1e3a8a`). São famílias diferentes (violeta × azul), o que mantém distância de trade dress. `#0e0142` está no `brand.json` para a varredura pegar se aparecer.

Contraste: `contrast.py tokens.json` → 46 pares, **0 falhas AA**.

## 4. Briefing do logo

- **Ideia:** um balão de conversa que vira um ponto de chegada, a mensagem que chega ao lugar certo. Liga com "Recadi" e com o rastro de entrega.
- **Tipo:** símbolo + logotipo. O símbolo sozinho serve de ícone.
- **Construção:** balão com o rabicho virando um pino ou check. Um traço só, cantos arredondados, preenchido em azul `#1d4ed8` sobre preto e branco sobre azul.
- **Precisa funcionar em 16px** (favicon: só o símbolo) e em 1024px (ícone do app).
- **Entregas:** SVG (símbolo, logotipo, horizontal), ícone 1024×1024 sem transparência para iOS, favicon (16, 32, 48, `apple-touch-icon` 180), imagem social 1200×630.
- **Não pode lembrar o logo do Kommo:** nada de "K", nada de violeta/lavanda, nenhum par de cores igual. Colocar os rascunhos lado a lado com o logo deles antes de aprovar.
- Hoje o app usa um quadrado azul com "R" como provisório.

## 5. Voz

| palavra | não quer dizer |
| --- | --- |
| **direta** | seca ou mandona |
| **calma** | fria ou burocrática |
| **transparente** | técnica ou cheia de jargão |

| faça | não faça |
| --- | --- |
| "Não deu certo desta vez e nada foi perdido. Tente de novo." | "Erro 500. Contate o suporte." |
| "Alguém da equipe já cuidou deste contato." | "Operação inválida: recurso já resolvido." |
| "Que bom te ver de novo." | "Bem-vindo(a)!!! 🎉" |
| dizer o que aconteceu e o que fazer agora | culpar o usuário ("você digitou errado") |
| tratar por "você", sem gênero | "Caro cliente", "Prezado" |

Strings revistas nesta rodada (as outras já foram escritas na mesma voz no build):
1. Login: "Bem-vindo de volta." → **"Que bom te ver de novo."** (neutro em gênero)
2. Erro genérico: "Não foi possível concluir. Tente de novo." → **"Não deu certo desta vez e nada foi perdido. Tente de novo."**
3. Corrida ao aceitar: "Outra pessoa já tratou este lead." → **"Alguém da equipe já cuidou deste contato."**
4. Título das abas: "CRM" → **"{tela} · Recadi"**
5. Rodapé da entrada: "Versão de desenvolvimento" → **"Recadi · versão de desenvolvimento"**
6. Funil vazio: "Seu funil está vazio" (mantido)
7. Entrada vazia: "Nada novo por aqui. Mensagens de pessoas desconhecidas aparecem nesta coluna." (mantido)
8. Chat do visitante vazio: "Mande sua dúvida. Alguém da equipe responde em instantes." (mantido)
9. 404: "Não encontramos esta página" (mantido)
10. Janela de 24h: "Passaram 24h desde a última mensagem do cliente. Só modelos aprovados." (mantido)

## 6. Varredura

`python sweep.py web --config replica/brand.json` → **limpo** (nome, domínios e cor do original não aparecem no código). Conferido também com grep.
Falta conferir no olho quando existirem: favicon, imagem social, ícone do app e modelos de email.
