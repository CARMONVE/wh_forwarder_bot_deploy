#!/bin/bash
# === Instalador y reiniciador automático para Google Cloud Shell ===
# by ARA + ChatGPT
# Ejecuta la instalación inicial y mantiene el bot activo automáticamente.

echo "🚀 Iniciando instalación del bot de WhatsApp en Google Cloud Shell..."

# Crear carpeta para evitar advertencia de apt
mkdir -p ~/.cloudshell
touch ~/.cloudshell/no-apt-get-warning

# Actualizar el sistema
sudo apt-get update -y

# Instalar Chromium (paquete correcto en Cloud Shell)
echo "🌐 Instalando navegador Chromium..."
sudo apt-get install -y chromium

# Verificar instalación alternativa
if [ ! -f "/usr/bin/chromium" ]; then
  echo "⚠️ No se encontró Chromium. Intentando ruta alternativa..."
  sudo apt-get install -y chromium-browser
fi

# Instalar dependencias Node
echo "📦 Instalando dependencias Node..."
npm install

# Mensaje informativo
echo "✅ Instalación completa. Iniciando el bot con autoreinicio."

# === BUCLE DE REINICIO AUTOMÁTICO ===
while true; do
  echo "🟢 Ejecutando bot..."
  npm start
  echo "⚠️ El bot se detuvo. Reiniciando en 10 segundos..."
  sleep 10
done
