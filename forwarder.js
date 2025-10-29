import express from "express";
import fs from "fs";
import XLSX from "xlsx";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth } = pkg;

// --- CONFIGURACIÓN DEL SERVIDOR EXPRESS ---
const app = express();
const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("✅ Bot de WhatsApp activo en Google Cloud Shell");
});

app.listen(PORT, () => console.log(`🌐 Servidor web activo en el puerto ${PORT}`));

// --- CARGA DE EXCEL ---
const EXCEL_PATH = "./LISTA.xlsx";

function cargarExcel() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.log("❌ No se encontró el archivo LISTA.xlsx");
    return [];
  }

  const workbook = XLSX.readFile(EXCEL_PATH);
  const hoja = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(hoja);
  console.log(`📋 Se cargaron ${data.length} filas desde ${workbook.SheetNames[0]}`);
  return data;
}

// --- CONFIGURAR WHATSAPP ---
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
});

client.on("qr", qr => {
  console.log("📱 Escanea este código QR para iniciar sesión:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("🤖 WhatsApp listo para enviar mensajes");
  const data = cargarExcel();

  for (const row of data) {
    if (row.Numero && row.Mensaje) {
      const numero = `${row.Numero}@c.us`;
      client.sendMessage(numero, row.Mensaje)
        .then(() => console.log(`✅ Mensaje enviado a ${row.Numero}`))
        .catch(err => console.error(`❌ Error al enviar a ${row.Numero}:`, err.message));
    }
  }
});

client.initialize();
