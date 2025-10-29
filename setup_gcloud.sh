

#!/bin/bash
# === Instalador automático para Google Cloud Shell ===

echo "🚀 Iniciando instalación del bot de WhatsApp en Google Cloud Shell..."

# Actualizar el sistema
sudo apt-get update -y

# Instalar Chromium
echo "🌐 Instalando navegador Chromium..."
sudo apt-get install -y chromium-browser

# Verificar instalación
if [ ! -f "/usr/bin/chromium-browser" ]; then
  echo "⚠️ No se encontró Chromium. Intentando ruta alternativa..."
  sudo apt-get install -y chromium
fi

# Instalar dependencias Node
echo "📦 Instalando dependencias Node..."
npm install

# Iniciar el bot
echo "✅ Instalación completa. Iniciando el bot..."
npm start
