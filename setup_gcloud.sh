#!/bin/bash
# --------------------------------------------------------
# 🚀 setup_gcloud.sh — Instalador automático para el bot de WhatsApp
# Compatible con Google Cloud Shell, WSL y VPS Ubuntu/Debian
# --------------------------------------------------------

echo ""
echo "🚀 Iniciando instalación del bot WhatsApp..."
echo ""

# --- Evitar conflictos por saltos de línea ---
if command -v dos2unix >/dev/null 2>&1; then
  dos2unix "$0" >/dev/null 2>&1
fi

# --- Actualizar sistema ---
echo "📦 Actualizando sistema..."
sudo apt-get update -y

# --- Instalar dependencias necesarias para Puppeteer ---
echo "🧩 Instalando librerías del sistema..."
sudo apt-get install -y \
  wget unzip fonts-liberation libatk1.0-0 libatk-bridge2.0-0 libxdamage1 \
  libgtk-3-0 libasound2 libxcomposite1 libxrandr2 libgbm1 libnss3 \
  libxss1 libxtst6 xdg-utils chromium libxshmfence1 lsof net-tools

# --- Instalar dependencias Node.js ---
echo "📦 Instalando dependencias Node..."
npm install express whatsapp-web.js qrcode-terminal xlsx

# --- Ajustar permisos ---
chmod +x forwarder.js

# --- Limpiar puerto 3000 si está ocupado ---
echo "🧹 Liberando puerto 3000 (si está en uso)..."
sudo fuser -k 3000/tcp >/dev/null 2>&1

# --- Iniciar el bot ---
echo ""
echo "✅ Instalación completada. Iniciando bot..."
echo "--------------------------------------------------------"
npm start
