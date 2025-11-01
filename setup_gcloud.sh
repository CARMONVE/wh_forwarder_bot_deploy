#!/bin/bash
set -e

echo "🚀 Iniciando instalación limpia y automática del bot de WhatsApp en Google Cloud Shell..."

# --- LIMPIEZA PREVIA ---
echo "🧹 Limpiando entorno anterior..."
cd ~
rm -rf ~/wh_forwarder_bot_deploy
rm -rf ~/.cache/puppeteer
sudo rm -rf /usr/local/chromium || true

# --- CLONAR REPOSITORIO ---
echo "📦 Clonando repositorio desde GitHub..."
git clone https://github.com/CARMONVE/wh_forwarder_bot_deploy.git
cd ~/wh_forwarder_bot_deploy

# --- ACTUALIZAR SISTEMA ---
echo "🔄 Actualizando paquetes del sistema..."
sudo apt-get update -y
sudo apt-get install -y wget unzip libnss3 libx11-xcb1 libgbm1 libasound2t64 \
libxshmfence1 libxss1 libatk-bridge2.0-0t64 libgtk-3-0t64 libappindicator3-1 libindicator7 || true

# --- INSTALAR CHROMIUM MANUALMENTE (sin Snap) ---
echo "🌐 Descargando e instalando Chromium..."
CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/1215579/chrome-linux.zip"
wget -O /tmp/chrome-linux.zip "$CHROMIUM_URL" || { echo "❌ Error descargando Chromium"; exit 1; }
unzip -q /tmp/chrome-linux.zip -d /tmp/
sudo mv /tmp/chrome-linux /usr/local/chromium
sudo ln -sf /usr/local/chromium/chrome /usr/bin/chromium-browser
sudo ln -sf /usr/local/chromium/chrome /usr/bin/chromium
/usr/local/chromium/chrome --version || echo "⚠️ No se pudo verificar Chromium, pero se continuará."

# --- INSTALAR DEPENDENCIAS NODE ---
echo "📦 Instalando dependencias Node.js..."
rm -rf node_modules package-lock.json
npm install express whatsapp-web.js qrcode-terminal xlsx puppeteer@24.15.0 --force

# --- PRUEBA DE CHROMIUM ---
echo "🧠 Verificando ejecución de Chromium..."
cat <<EOF > chromium-check.js
const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch({
      executablePath: "/usr/local/chromium/chrome",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    console.log("✅ Chromium lanzado correctamente desde:", browser.process().spawnfile);
    await browser.close();
  } catch (err) {
    console.error("❌ Error lanzando Chromium:", err);
  }
})();
EOF
node chromium-check.js || echo "⚠️ Error al verificar Chromium, se continuará igualmente."

# --- INICIAR BOT EN MODO DEBUG ---
echo "▶️ Iniciando bot en modo depuración..."
nohup npm start > debug.log 2>&1 &

sleep 3
echo ""
echo "✅ Instalación completa y bot en ejecución."
echo "📋 Log en vivo (Ctrl + C para salir):"
echo ""

# --- MONITOREO EN TIEMPO REAL ---
tail -f ~/wh_forwarder_bot_deploy/debug.log
