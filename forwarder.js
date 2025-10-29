// --------------------------------------------------------
// 🌐 WhatsApp Forwarder Bot (Google Cloud Shell compatible)
// --------------------------------------------------------

import express from "express";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import XLSX from "xlsx";

const { Client, LocalAuth } = pkg;

// --- Servidor web para mantener activo el proceso ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("🤖 WhatsApp Forwarder Bot activo en Google Cloud Shell!");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server listening on port ${PORT}`);
});

// --- Inicializar cliente de WhatsApp ---
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("📱 Escanea este código QR para iniciar sesión:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Cliente de WhatsApp listo!");
});

// --- Ejemplo de envío de mensajes desde Excel ---
import fs from "fs";
const excelFile = "mensajes.xlsx";

if (fs.existsSync(excelFile)) {
  const workbook = XLSX.readFile(excelFile);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`📋 Se cargaron ${data.length} filas desde ${excelFile}`);

  data.forEach((row) => {
    const numero = row["Numero"];
    const mensaje = row["Mensaje"];

    if (numero && mensaje) {
      client.sendMessage(`${numero}@c.us`, mensaje).then(() => {
        console.log(`✅ Mensaje enviado a ${numero}`);
      });
    }
  });
} else {
  console.log("⚠️ No se encontró el archivo mensajes.xlsx, se omitió el envío.");
}

client.initialize();
