#!/bin/bash
set -e

echo "🚀 Instalando dependencias del sistema..."
sudo apt-get update -y
sudo apt-get install -y chromium-browser lsof

echo "🧰 Instalando dependencias de Node..."
npm install

echo "🔧 Verificando puertos..."
PORT=8080
PID=$(lsof -ti:$PORT || true)
if [ ! -z "$PID" ]; then
  echo "⚠️ Puerto $PORT en uso, matando proceso $PID..."
  kill -9 $PID || true
fi

echo "✅ Todo listo. Para iniciar el bot:"
echo "-----------------------------------------"
echo "npm start"
echo "-----------------------------------------"
