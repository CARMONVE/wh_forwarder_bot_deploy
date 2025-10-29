#!/bin/bash
# Instalación automática de dependencias del sistema para Puppeteer en Replit

echo "🔧 Instalando librerías del sistema necesarias para Chrome/Puppeteer..."

if [ ! -f ".deps_installed" ]; then
  apt-get update
  apt-get install -y \
    libx11-xcb1 libxcb-dri3-0 libxcomposite1 libxcursor1 libxdamage1 \
    libxi6 libxtst6 libnss3 libcups2 libxss1 libxrandr2 libasound2 \
    libatk1.0-0 libatk-bridge2.0-0 libpangocairo-1.0-0 libpango-1.0-0 \
    libcairo2 libatspi2.0-0 libdrm2 libgbm1 libgtk-3-0 libgdk-pixbuf2.0-0 \
    libxshmfence1
  touch .deps_installed
else
  echo "✅ Dependencias ya instaladas, omitiendo..."
fi
