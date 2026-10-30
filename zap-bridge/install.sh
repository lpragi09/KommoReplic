#!/usr/bin/env bash
# Instala a ponte do WhatsApp (QR code) do netzer numa VM Linux (Oracle Cloud grátis, Ubuntu ou Oracle Linux).
# Uso, na VM:  curl -fsSL https://raw.githubusercontent.com/lpragi09/KommoReplic/main/zap-bridge/install.sh | sudo bash
# Instala Node e Caddy (binários oficiais, sem mexer em pacotes do sistema), cria o serviço e o HTTPS
# num endereço <ip>.sslip.io. Não toca em nada que já roda na máquina (a VPN segue igual).
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/lpragi09/KommoReplic/main/zap-bridge"
WEBHOOK="${NETZER_WEBHOOK:-https://recadi.vercel.app/api/webhooks/zap}"
DIR=/opt/netzer-zap
NODE_VERSION=v22.11.0

[ "$(id -u)" = 0 ] || { echo "Rode com sudo."; exit 1; }
case "$(uname -m)" in
  aarch64|arm64) ARCH=arm64 ;;
  x86_64|amd64) ARCH=x64 ;;
  *) echo "Arquitetura não suportada: $(uname -m)"; exit 1 ;;
esac
CADDY_ARCH=$([ "$ARCH" = x64 ] && echo amd64 || echo arm64)

echo "==> Node $NODE_VERSION"
if [ ! -x /opt/node/bin/node ]; then
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-$ARCH.tar.xz" -o /tmp/node.tar.xz
  mkdir -p /opt/node && tar -xJf /tmp/node.tar.xz -C /opt/node --strip-components=1 && rm /tmp/node.tar.xz
fi
export PATH=/opt/node/bin:$PATH

echo "==> Ponte do WhatsApp em $DIR"
id netzer >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin netzer
mkdir -p "$DIR/sessions"
curl -fsSL "$REPO_RAW/server.mjs" -o "$DIR/server.mjs"
curl -fsSL "$REPO_RAW/package.json" -o "$DIR/package.json"
(cd "$DIR" && npm install --omit=dev --no-audit --no-fund --loglevel=error)
if [ ! -f "$DIR/.env" ]; then
  TOKEN=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  printf 'BRIDGE_TOKEN=%s\nNETZER_WEBHOOK=%s\nPORT=3210\nDATA_DIR=%s/sessions\n' "$TOKEN" "$WEBHOOK" "$DIR" > "$DIR/.env"
fi
chmod 600 "$DIR/.env"
chown -R netzer:netzer "$DIR"

cat > /etc/systemd/system/netzer-zap.service <<EOF
[Unit]
Description=Ponte do WhatsApp do netzer
After=network-online.target
Wants=network-online.target

[Service]
User=netzer
WorkingDirectory=$DIR
ExecStart=/opt/node/bin/node --env-file=$DIR/.env $DIR/server.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "==> HTTPS (Caddy)"
IP=$(curl -fsS https://ifconfig.me || curl -fsS https://api.ipify.org)
HOST="$(echo "$IP" | tr . -).sslip.io"
if [ ! -x /usr/local/bin/caddy ]; then
  curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=$CADDY_ARCH" -o /usr/local/bin/caddy
  chmod +x /usr/local/bin/caddy
fi
busy() { ss -ltn "( sport = :$1 )" | grep -q LISTEN; }
if [ -f /etc/caddy/Caddyfile ] && grep -q "reverse_proxy 127.0.0.1:3210" /etc/caddy/Caddyfile; then
  # reinstalação: o HTTPS já é nosso (é ele que ocupa a 80 e a 443); só mantém a porta escolhida antes
  HTTPS_PORT=$(sed -n 's/^ *https_port \([0-9]*\).*/\1/p' /etc/caddy/Caddyfile)
  HTTPS_PORT=${HTTPS_PORT:-443}
  systemctl stop netzer-caddy 2>/dev/null || true
else
  HTTPS_PORT=443
  if busy 443; then HTTPS_PORT=8443; fi
  if busy 80; then echo "A porta 80 já está em uso: o HTTPS automático precisa dela. Me mande esta mensagem."; exit 1; fi
fi
mkdir -p /etc/caddy /var/lib/caddy
id caddy >/dev/null 2>&1 || useradd --system --home /var/lib/caddy --shell /usr/sbin/nologin caddy
chown caddy:caddy /var/lib/caddy
cat > /etc/caddy/Caddyfile <<EOF
{
  https_port $HTTPS_PORT
}
$HOST:$HTTPS_PORT {
  reverse_proxy 127.0.0.1:3210
}
EOF
cat > /etc/systemd/system/netzer-caddy.service <<EOF
[Unit]
Description=HTTPS da ponte do WhatsApp do netzer
After=network-online.target

[Service]
User=caddy
Environment=XDG_DATA_HOME=/var/lib/caddy XDG_CONFIG_HOME=/var/lib/caddy
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile
Restart=always
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

echo "==> Firewall da máquina (portas 80 e $HTTPS_PORT)"
if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port=80/tcp --add-port=$HTTPS_PORT/tcp >/dev/null && firewall-cmd --reload >/dev/null
elif command -v iptables >/dev/null; then
  for p in 80 $HTTPS_PORT; do
    iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport $p -j ACCEPT
  done
  command -v netfilter-persistent >/dev/null && netfilter-persistent save >/dev/null 2>&1 || true
fi

systemctl daemon-reload
systemctl enable --now netzer-zap netzer-caddy >/dev/null
systemctl restart netzer-zap netzer-caddy

URL="https://$HOST$([ "$HTTPS_PORT" = 443 ] || echo ":$HTTPS_PORT")"
echo
echo "================ PRONTO ================"
echo "Na Oracle (Rede > Lista de segurança), libere a entrada TCP nas portas 80 e $HTTPS_PORT."
echo "Depois coloque na Vercel (projeto recadi) e faça o Redeploy:"
echo "  ZAP_BRIDGE_URL   = $URL"
echo "  ZAP_BRIDGE_TOKEN = $(grep BRIDGE_TOKEN "$DIR/.env" | cut -d= -f2)   (tipo Segredo)"
echo "Teste: abra $URL/health no navegador (deve mostrar ok)."
echo "========================================"
