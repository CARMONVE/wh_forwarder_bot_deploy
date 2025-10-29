// forwarder.js - versión estable para Cloud Shell
import express from "express";
import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import XLSX from "xlsx";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

// --- Prevención de bloqueo del puerto ---
try {
  const server = app.listen(PORT, () => {
    console.log(`🌐 Servidor web escuchando en el puerto ${PORT}`);
  });
  process.on("SIGTERM", () => server.close());
  process.on("SIGINT", () => server.close());
} catch (err) {
  console.error("⚠️ Error iniciando servidor:", err.message);
}

// --- Cargar configuración ---
const configPath = "./config.json";
let config = { excelPath: "./LISTA.xlsx" };
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath));
  console.log("⚙️ Configuración cargada correctamente.");
} else {
  console.log("⚠️ No se encontró config.json, usando valores por defecto.");
}

// --- Leer Excel ---
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

// --- Inicializar WhatsApp ---
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
  console.log("🔹 Escanea este código QR en WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Cliente de WhatsApp listo.");
  const lista = cargarDatosExcel();

  // ejemplo de reenvío simulado
  lista.forEach((item) => {
    console.log(`📨 Enviando mensaje a: ${item.telefono}`);
  });
});

client.on("disconnected", (reason) => {
  console.log("⚠️ Cliente desconectado:", reason);
  console.log("🔁 Reiniciando en 5 segundos...");
  setTimeout(() => {
    process.exit(1);
  }, 5000);
});

client.initialize();
