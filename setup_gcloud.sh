#!/bin/bash
set -e

echo "🚀 Iniciando configuración completa del entorno GCloud para el bot de WhatsApp..."
echo "🧹 Limpiando residuos anteriores..."

# 1️⃣ Limpiar posibles restos previos
sudo rm -rf /usr/bin/chromium /usr/lib/chromium /usr/local/bin/chromium || true
rm -rf ~/.cache/puppeteer ~/.npm ~/.config/whatsapp-web.js ~/.wwebjs_auth || true

# 2️⃣ Actualizar paquetes base
echo "🔄 Actualizando sistema..."
sudo apt-get update -y
sudo apt-get install -y wget curl unzip ca-certificates fonts-liberation

# 3️⃣ Instalar Chromium manualmente (sin Snap)
echo "🌐 Instalando Chromium de forma manual..."
CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/1215579/chrome-linux.zip"
wget -O /tmp/chrome-linux.zip $CHROMIUM_URL
unzip -q /tmp/chrome-linux.zip -d /tmp/
sudo mv /tmp/chrome-linux /usr/local/chromium
sudo ln -sf /usr/local/chromium/chrome /usr/bin/chromium
rm /tmp/chrome-linux.zip

# 4️⃣ Verificar instalación de Chromium
echo "✅ Verificando Chromium instalado:"
chromium --version || echo "⚠️ No se pudo verificar la versión de Chromium"

# 5️⃣ Instalar librerías necesarias para Puppeteer y Chromium
echo "📦 Instalando librerías del sistema..."
sudo apt-get install -y \
  libnss3 libatk-bridge2.0-0t64 libgtk-3-0t64 libx11-xcb1 libgbm1 \
  libasound2t64 libxshmfence1 libxss1 libappindicator3-1 libindicator7

# 6️⃣ Instalar dependencias de Node.js del proyecto
echo "📦 Instalando dependencias npm..."
npm install --force puppeteer@24.15.0 whatsapp-web.js express xlsx qrcode-terminal

# 7️⃣ Mostrar versión del Chromium real
echo "🧠 Verificando binario Chromium utilizado por Puppeteer:"
which chromium

# 8️⃣ Lanzar el bot
echo "▶️ Iniciando bot de WhatsApp..."
npm start
