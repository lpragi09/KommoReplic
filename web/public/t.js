/* netzer tech · rastreamento de origem no site do cliente.
   Uso: <script src="https://SEU-DOMINIO/t.js" data-link="CODIGO" async></script>
   - guarda as UTMs da 1ª visita (30 dias), a página de entrada e de onde a pessoa veio;
   - troca todo botão de WhatsApp da página pelo link rastreável do sistema, levando essas UTMs;
   - leva as UTMs também para links do chat do site (/chat/...).
   Sem cookies de terceiros, sem dados pessoais: só os parâmetros da URL. */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var code = s.getAttribute("data-link");
  var base = new URL(s.src).origin;
  var KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
  var STORE = "recadi_origem";

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(STORE) || "null");
      return v && Date.now() - v.t < 30 * 864e5 ? v : null;
    } catch {
      return null;
    }
  }
  var q = new URLSearchParams(location.search);
  var fresh = {};
  var has = false;
  KEYS.forEach(function (k) {
    var v = q.get(k);
    if (v) {
      fresh[k] = v.slice(0, 150);
      has = true;
    }
  });
  var origem = read();
  if (has || !origem) {
    // nova campanha substitui a anterior; visita sem UTM só guarda entrada e referência
    origem = { p: has ? fresh : (origem && origem.p) || {}, landing: location.href.split("#")[0].slice(0, 300), ref: document.referrer.slice(0, 300), t: Date.now() };
    try {
      localStorage.setItem(STORE, JSON.stringify(origem));
    } catch {}
  }

  function params(extra) {
    var p = new URLSearchParams(origem.p);
    if (origem.landing) p.set("landing", origem.landing);
    if (origem.ref) p.set("ref", origem.ref);
    Object.keys(extra || {}).forEach(function (k) {
      p.set(k, extra[k]);
    });
    return p.toString();
  }
  var WA = /^(https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\/|whatsapp:\/\/)/i;

  function fix(a) {
    if (a.dataset.recadi) return;
    var href = a.getAttribute("href") || "";
    if (code && WA.test(href)) {
      a.setAttribute("href", base + "/w/" + code + "?" + params({ via: "site" }));
      a.dataset.recadi = "1";
    } else if (href.indexOf(base + "/chat/") === 0) {
      a.setAttribute("href", href + (href.indexOf("?") < 0 ? "?" : "&") + params({ via: "site" }));
      a.dataset.recadi = "1";
    }
  }
  function scan(root) {
    (root.querySelectorAll ? root : document).querySelectorAll("a[href]").forEach(fix);
  }
  scan(document);
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        if (n.tagName === "A") fix(n);
        scan(n);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
