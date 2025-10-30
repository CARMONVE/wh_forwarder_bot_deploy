// --- forwarder.js ---
// Versión estable para Google Cloud Shell (usa Chromium interno Puppeteer)

import express from "express";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import xlsx from "xlsx";
import puppeteer from "puppeteer";

const { Client, LocalAuth } = pkg;
const app = express();

// -----------------------------
// 🔹 Leer reglas desde LISTA.xlsx
// -----------------------------
const workbook = xlsx.readFile("LISTA.xlsx");
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet);

console.log(`📋 Se cargaron ${data.length} reglas desde el Excel.`);

// -----------------------------
// 🔹 Crear mapa de reenvío
// -----------------------------
const reglas = data.map(r => ({
  origen: r.Grupo_Origen?.trim().toUpperCase(),
  destino: r.Grupo_Destino?.trim(),
  restr1: r.Restriccion_1?.trim() || "",
  restr2: r.Restriccion_2?.trim() || "",
  restr3: r.Restriccion_3?.trim() || ""
}));

// -----------------------------
// 🔹 Configurar cliente WhatsApp
// -----------------------------
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: '/home/c_monsalve_vejar/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-infobars",
      "--window-size=1920,1080"
    ]
  }
});

// -----------------------------
// 🔹 Eventos WhatsApp
// -----------------------------
client.on("qr", (qr) => {
  console.log("📱 Escanea este código QR para conectar:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ WhatsApp conectado y listo para reenviar mensajes.");
});

client.on("message", async (msg) => {
  try {
    const chat = await msg.getChat();
    const nombreGrupo = chat.name?.trim().toUpperCase();

    // Buscar reglas aplicables
    const reglasCoincidentes = reglas.filter(r => nombreGrupo.includes(r.origen));

    for (const regla of reglasCoincidentes) {
      const texto = msg.body || "";
      if (
        (!regla.restr1 || texto.includes(regla.restr1)) &&
        (!regla.restr2 || texto.includes(regla.restr2)) &&
        (!regla.restr3 || texto.includes(regla.restr3))
      ) {
        const destino = await client.getChats().then(chats =>
          chats.find(c => c.name?.trim() === regla.destino)
        );
        if (destino) {
          await client.sendMessage(destino.id._serialized, texto);
          console.log(`➡️ Reenviado de "${nombreGrupo}" a "${regla.destino}"`);
        }
      }
    }
  } catch (err) {
    console.error("❌ Error al procesar mensaje:", err);
  }
});

client.initialize();

// -----------------------------
// 🔹 Servidor Express
// -----------------------------
const PORT = process.env.PORT || 8080;
app.get("/", (req, res) => res.send("✅ Bot de WhatsApp activo en Cloud Shell"));
app.listen(PORT, () => console.log(`🌐 Servidor web activo en el puerto ${PORT}`));
