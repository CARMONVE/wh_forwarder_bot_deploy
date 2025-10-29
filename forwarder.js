// forwarder.js - versión final estable compatible con Node 22+
// -----------------------------------------------------------

import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import express from "express";
import fs from "fs";
import XLSX from "xlsx";

const app = express();
const PORTS = [3000, 3001, 8080, 5000];

// === Función para intentar puertos libres ===
function tryListen(index = 0) {
  if (index >= PORTS.length) {
    console.error("❌ No hay puertos disponibles para el servidor web.");
    process.exit(1);
  }
  const port = PORTS[index];
  try {
    const server = app.listen(port, () => {
      console.log(`🌐 Servidor web escuchando en el puerto ${port}`);
    });
    process.on("SIGTERM", () => server.close());
    process.on("SIGINT", () => server.close());
  } catch (err) {
    if (err.code === "EADDRINUSE") {
      console.warn(`⚠️ Puerto ${port} en uso, intentando otro...`);
      tryListen(index + 1);
    } else {
      console.error("❌ Error iniciando servidor:", err.message);
      process.exit(1);
    }
  }
}

// === Configuración y carga de datos ===
const configPath = "./config.json";
let config = { excelPath: "./LISTA.xlsx" };

if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath));
  console.log("⚙️ Configuración cargada correctamente.");
} else {
  console.warn("⚠️ No se encontró config.json, usando valores por defecto.");
}

function cargarDatosExcel() {
  try {
    const wb = XLSX.readFile(config.excelPath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`📋 Se cargaron ${data.length} filas desde ${config.excelPath}`);
    return data;
  } catch (err) {
    console.error("❌ Error leyendo el archivo Excel:", err.message);
    return [];
  }
}

// === Inicializar cliente de WhatsApp ===
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
    ],
  },
});

client.on("qr", (qr) => {
  console.clear();
  console.log("📱 Escanea este código QR con tu WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Cliente de WhatsApp listo y conectado.");
  const lista = cargarDatosExcel();

  // Aquí puedes añadir tu lógica de reenvío
  lista.forEach((item) => {
    console.log(`📨 Mensaje preparado para: ${item.telefono}`);
  });
});

client.on("disconnected", (reason) => {
  console.error("⚠️ Cliente desconectado:", reason);
  console.log("🔁 Reinicio automático en 5 segundos...");
  setTimeout(() => process.exit(1), 5000);
});

// === Inicialización principal ===
try {
  tryListen();
  client.initialize();
} catch (err) {
  console.error("💥 Error general:", err.message);
}

process.on("uncaughtException", (err) => {
  console.error("💥 Error no controlado:", err.message);
  console.log("❌ El bot se detuvo. Reinícialo manualmente con 'npm start'.");
});
