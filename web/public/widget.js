/* netzer · botão de chat para o site do cliente.
   Uso: <script src="https://SEU-DOMINIO/widget.js" data-chat="CHAVE_DO_CHAT" async></script>
   Opcional: data-cor="#2563eb" (cor do botão), data-lado="esquerda".
   Abre o chat do sistema numa janelinha no canto, levando as UTMs da visita (as mesmas que o t.js guarda).
   Sem cookies e sem dados pessoais; o iframe só carrega quando a pessoa clica. */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var key = s.getAttribute("data-chat");
  if (!key || !/^[A-Za-z0-9_-]{4,40}$/.test(key)) return;
  var base = new URL(s.src).origin;
  var color = /^#[0-9a-fA-F]{3,8}$/.test(s.getAttribute("data-cor") || "") ? s.getAttribute("data-cor") : "#2563eb";
  var side = s.getAttribute("data-lado") === "esquerda" ? "left" : "right";
  var KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];

  function origin() {
    var p = new URLSearchParams();
    var q = new URLSearchParams(location.search);
    var saved = null;
    try {
      saved = JSON.parse(localStorage.getItem("recadi_origem") || "null");
    } catch {
      saved = null;
    }
    KEYS.forEach(function (k) {
      var v = q.get(k) || (saved && saved.p && saved.p[k]);
      if (v) p.set(k, String(v).slice(0, 150));
    });
    p.set("landing", ((saved && saved.landing) || location.href.split("#")[0]).slice(0, 300));
    var ref = (saved && saved.ref) || document.referrer;
    if (ref) p.set("ref", ref.slice(0, 300));
    p.set("via", "site");
    return p.toString();
  }

  var CHAT = '<svg width="26" height="26" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M128 24A104 104 0 0 0 36.18 176.88L24.83 210.93a16 16 0 0 0 20.24 20.24l34.05-11.35A104 104 0 1 0 128 24Z"/></svg>';
  var CLOSE = '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/></svg>';

  var btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", "Abrir o chat");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = CHAT;
  btn.style.cssText =
    "position:fixed;bottom:20px;" + side + ":20px;z-index:2147483000;width:58px;height:58px;border:0;border-radius:999px;cursor:pointer;" +
    "display:grid;place-items:center;color:#fff;background:" + color + ";box-shadow:0 10px 30px -8px rgba(0,0,0,.45);transition:transform .15s ease";
  btn.onmouseenter = function () {
    btn.style.transform = "scale(1.06)";
  };
  btn.onmouseleave = function () {
    btn.style.transform = "";
  };

  var box = null;
  function open() {
    if (!box) {
      box = document.createElement("div");
      box.style.cssText =
        "position:fixed;bottom:90px;" + side + ":20px;z-index:2147483000;width:min(380px,calc(100vw - 24px));height:min(600px,calc(100vh - 120px));" +
        "border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 24px 60px -20px rgba(0,0,0,.5),0 0 0 1px rgba(0,0,0,.06)";
      var f = document.createElement("iframe");
      f.src = base + "/chat/" + encodeURIComponent(key) + "?" + origin();
      f.title = "Chat";
      f.allow = "clipboard-write";
      f.style.cssText = "width:100%;height:100%;border:0;display:block";
      box.appendChild(f);
      document.body.appendChild(box);
    }
    box.style.display = "block";
    btn.innerHTML = CLOSE;
    btn.setAttribute("aria-label", "Fechar o chat");
    btn.setAttribute("aria-expanded", "true");
  }
  function close() {
    if (box) box.style.display = "none";
    btn.innerHTML = CHAT;
    btn.setAttribute("aria-label", "Abrir o chat");
    btn.setAttribute("aria-expanded", "false");
  }
  btn.onclick = function () {
    if (box && box.style.display !== "none") close();
    else open();
  };
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && box && box.style.display !== "none") close();
  });

  function mount() {
    document.body.appendChild(btn);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
