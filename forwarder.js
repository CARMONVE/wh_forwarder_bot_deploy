import express from "express";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
import XLSX from "xlsx";
import fs from "fs";

const { Client, LocalAuth } = pkg;

// =========================
// 1. CARGAR CONFIGURACIÓN DESDE EXCEL
// =========================
const EXCEL_FILE = "./LISTA.xlsx";

function loadRules() {
  const workbook = XLSX.readFile(EXCEL_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const rules = rows.map((row) => ({
    origin: (row["Grupo_Origen"] || "").trim(),
    target: (row["Grupo_Destino"] || "").trim(),
    restrictions: [
      row["Restriccion_1"],
      row["Restriccion_2"],
      row["Restriccion_3"],
    ]
      .filter(Boolean)
      .map((r) => r.trim().toUpperCase()),
  }));

  console.log(`📋 Se cargaron ${rules.length} reglas desde el Excel.`);
  return rules;
}

const rules = loadRules();

// =========================
// 2. CONFIGURAR WHATSAPP
// =========================
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--no-zygote",
    ],
  },
});

client.on("qr", (qr) => {
  console.log("📱 Escanea este QR para vincular tu WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Cliente de WhatsApp conectado y listo.");
});

// =========================
// 3. REGLAS DE REENVÍO
// =========================
client.on("message", async (msg) => {
  const chat = await msg.getChat();
  const from = chat.name ? chat.name.trim() : "";

  const matchingRules = rules.filter((r) => r.origin === from);
  if (!matchingRules.length) return;

  for (const rule of matchingRules) {
    const content = msg.body.toUpperCase();
    const match = rule.restrictions.every((res) => content.includes(res));

    if (match) {
      const targetChat = await client.getChats().then((chats) =>
        chats.find((c) => c.name.trim() === rule.target)
      );

      if (targetChat) {
        await targetChat.sendMessage(msg.body);
        console.log(`📤 Mensaje reenviado de "${from}" a "${rule.target}"`);
      } else {
        console.warn(`⚠️ No se encontró el grupo destino "${rule.target}"`);
      }
    }
  }
});

// =========================
// 4. EXPRESS SERVER
// =========================
const app = express();
const PORT = 8080;

app.get("/", (req, res) => res.send("✅ Bot de WhatsApp activo"));
app.listen(PORT, () =>
  console.log(`🌐 Servidor web activo en el puerto ${PORT}`)
);

client.initialize();
