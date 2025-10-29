// ===============================
// 🟢 WhatsApp Forwarder Bot (Google Cloud Shell)
// Compatible con: whatsapp-web.js@1.25.0 y puppeteer@24.15.0
// ===============================

import express from "express";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import puppeteer from "puppeteer";
import qrcode from "qrcode-terminal";
import XLSX from "xlsx";
import fs from "fs";

// ===============================
// 🧠 CONFIGURACIÓN BASE
// ===============================
const app = express();
const PORT = process.env.PORT || 8080;
const EXCEL_FILE = "./LISTA.xlsx";
const CONFIG_FILE = "./config.json";

// ===============================
// ⚙️ CARGAR CONFIGURACIÓN Y EXCEL
// ===============================
let reglas = {};
if (fs.existsSync(CONFIG_FILE)) {
  reglas = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  console.log("✅ Configuración cargada desde config.json");
} else {
  console.log("⚠️ No se encontró config.json, usando configuración vacía.");
}

let contactos = [];
if (fs.existsSync(EXCEL_FILE)) {
  const workbook = XLSX.readFile(EXCEL_FILE);
  const hoja = workbook.SheetNames[0];
  contactos = XLSX.utils.sheet_to_json(workbook.Sheets[hoja]);
  console.log(`📋 Se cargaron ${contactos.length} filas desde ${hoja}`);
} else {
  console.log("⚠️ No se encontró LISTA.xlsx, verifique el archivo.");
}

// ===============================
// 🤖 INICIALIZAR WHATSAPP CLIENT
// ===============================
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: puppeteer.executablePath(), // usa el Chromium interno
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer"
    ]
  }
});

// ===============================
// 🧾 EVENTOS DE WHATSAPP
// ===============================
client.on("qr", (qr) => {
  console.log("📱 Escanea este QR para conectar tu WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Cliente de WhatsApp conectado y listo!");
});

client.on("message", async (msg) => {
  const texto = msg.body.toLowerCase().trim();
  const remitente = msg.from;

  for (const [regla, respuesta] of Object.entries(reglas)) {
    if (texto.includes(regla.toLowerCase())) {
      await client.sendMessage(remitente, respuesta);
      console.log(`➡️ Mensaje automático enviado a ${remitente}`);
      return;
    }
  }
});

// ===============================
// 🌐 SERVIDOR EXPRESS
// ===============================
app.get("/", (req, res) => {
  res.send("✅ WhatsApp Forwarder Bot en ejecución");
});

app.listen(PORT, () =>
  console.log(`🌐 Servidor web activo en el puerto ${PORT}`)
);

// ===============================
// 🚀 INICIAR CLIENTE
// ===============================
client.initialize();
