#!/bin/bash
set -e
echo "🚀 Instalación limpia del bot de WhatsApp (actualizado)"

# Variables
REPO_URL="https://github.com/CARMONVE/wh_forwarder_bot_deploy.git"
WORKDIR="$HOME/wh_forwarder_bot_deploy"
CHROMIUM_DIR="/usr/local/chromium"
CHROMIUM_BIN="$CHROMIUM_DIR/chrome"
CHROMIUM_SNAPSHOT_URL="https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/1157868/chrome-linux.zip"
PUPPETEER_VERSION="24.15.0"

# Limpieza previa
echo "🧹 Limpiando..."
rm -rf "$WORKDIR"
rm -rf ~/.cache/puppeteer

# Clonar repo
echo "📦 Clonando repo..."
git clone "$REPO_URL" "$WORKDIR"
cd "$WORKDIR"

# Actualizar sistema e instalar dependencias de Chromium
echo "🔄 Actualizando paquetes..."
sudo apt-get update -y
sudo apt-get install -y wget unzip ca-certificates gnupg2 curl git build-essential \
  libnss3 libatk-bridge2.0-0 libgtk-3-0 libx11-xcb1 libgbm1 libasound2 libxshmfence1 \
  libxss1 libappindicator3-1 libindicator7 || true

# Asegurar Node.js (instalar Node v18 LTS si no existe)
if ! command -v node >/dev/null 2>&1; then
  echo "🔧 Instalando Node.js 18..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Instalar Chromium portátil
echo "🌐 Instalando Chromium portátil..."
tmpzip="/tmp/chrome-linux.zip"
wget -q -O "$tmpzip" "$CHROMIUM_SNAPSHOT_URL"
unzip -q "$tmpzip" -d /tmp/
sudo rm -rf "$CHROMIUM_DIR" || true
sudo mv /tmp/chrome-linux "$CHROMIUM_DIR"
sudo ln -sf "$CHROMIUM_BIN" /usr/bin/chromium-browser || true
echo "✅ Chromium instalado en $CHROMIUM_DIR"

# Limpieza npm y reinstalación dependencias (usar versiones del package.json)
echo "📦 Instalando dependencias npm..."
rm -rf node_modules package-lock.json
npm install --no-audit --prefer-offline

# Verificar Chromium con Puppeteer (prueba)
cat > chromium-check.js <<'JS'
const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch({
      executablePath: "/usr/bin/chromium-browser",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    console.log("✅ Chromium lanzado correctamente desde:", browser.process().spawnfile);
    await browser.close();
  } catch (err) {
    console.error("❌ Error lanzando Chromium:", err.message || err);
    process.exit(1);
  }
})();
JS

node chromium-check.js || echo "⚠️ Advertencia: Chromium no pudo lanzarse — revisa rutas y dependencias."

# Iniciar bot en background (con nohup)
echo "▶️ Iniciando bot (nohup)..."
nohup npm start > debug.log 2>&1 &

sleep 2
echo "✅ Instalación y arranque finalizados. Mira debug.log para detalles."
tail -n 200 debug.log || true
