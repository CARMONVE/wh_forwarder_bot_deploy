#!/bin/bash
set -e

echo "🚀 Instalación limpia y funcional del bot de WhatsApp..."

# --- LIMPIEZA ---
cd ~
rm -rf ~/wh_forwarder_bot_deploy
rm -rf ~/.cache/puppeteer
mkdir -p ~/.local/bin

# --- CLONAR REPOSITORIO ---
echo "📦 Clonando el repositorio desde GitHub..."
git clone https://github.com/CARMONVE/wh_forwarder_bot_deploy.git
cd ~/wh_forwarder_bot_deploy

# --- ACTUALIZAR SISTEMA ---
echo "🔄 Actualizando sistema..."
sudo apt-get update -y
sudo apt-get install -y wget unzip libnss3 libx11-xcb1 libgbm1 libasound2t64 libxshmfence1 libxss1 libatk-bridge2.0-0t64 libgtk-3-0t64 libappindicator3-1 libindicator7 || true

# --- INSTALAR CHROMIUM PORTÁTIL ---
echo "🌐 Descargando e instalando Chromium portátil..."
CHROMIUM_PATH="$HOME/chromium-portable"
CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/1215579/chrome-linux.zip"
rm -rf "$CHROMIUM_PATH"
wget -O /tmp/chrome-linux.zip "$CHROMIUM_URL" || { echo "❌ Error al descargar Chromium"; exit 1; }
unzip -q /tmp/chrome-linux.zip -d "$HOME"
mv "$HOME/chrome-linux" "$CHROMIUM_PATH"
ln -sf "$CHROMIUM_PATH/chrome" ~/.local/bin/chromium-browser
chmod +x ~/.local/bin/chromium-browser
echo "✅ Chromium instalado en: $CHROMIUM_PATH"

# --- DEPENDENCIAS NODE ---
echo "📦 Instalando dependencias de Node.js..."
rm -rf node_modules package-lock.json
npm install express whatsapp-web.js qrcode-terminal xlsx puppeteer@24.15.0 --force

# --- PRUEBA DE CHROMIUM ---
echo "🧠 Verificando ejecución de Chromium..."
cat <<EOF > chromium-check.js
const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch({
      executablePath: process.env.CHROMIUM_PATH || "$CHROMIUM_PATH/chrome",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    console.log("✅ Chromium lanzado correctamente desde:", browser.process().spawnfile);
    await browser.close();
  } catch (err) {
    console.error("❌ Error lanzando Chromium:", err.message);
  }
})();
EOF
node chromium-check.js || echo "⚠️ No se pudo verificar Chromium, pero se continuará."

# --- CONFIGURAR VARIABLE DE ENTORNO ---
echo "export CHROMIUM_PATH=$CHROMIUM_PATH" >> ~/.bashrc
source ~/.bashrc

# --- INICIAR BOT ---
echo "▶️ Iniciando bot en modo depuración..."
nohup npm start > debug.log 2>&1 &
sleep 3
echo ""
echo "✅ Instalación completa."
echo "📋 Log en vivo (Ctrl + C para salir):"
tail -f ~/wh_forwarder_bot_deploy/debug.log
