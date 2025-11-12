import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import xlsx from "xlsx";
import mongoose from "mongoose";
import fs from "fs";
const { Client, LocalAuth } = pkg;

// === CONFIG ===
const CONFIG = JSON.parse(fs.readFileSync("config.json", "utf8"));
const EXCEL_FILE = CONFIG.excel_file;
const LOG_FILE = CONFIG.log_file;

// === MongoDB Connection ===
mongoose
  .connect(CONFIG.mongo_url, { dbName: "whsession" })
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => console.error("❌ Error MongoDB:", err));

// === Cargar LISTA.xlsx ===
function loadRules() {
  const wb = xlsx.readFile(EXCEL_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws);
  console.log(`📘 ${rows.length} reglas cargadas desde ${EXCEL_FILE}`);
  return rows;
}
const rules = loadRules();

// === Inicializar Cliente WhatsApp ===
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "forwarder_session",
    dataPath: "./.wwebjs_auth",
  }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("📱 Escanea el código QR:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ WhatsApp conectado y listo.");
});

// === Lógica de reenvío ===
client.on("message", async (msg) => {
  try {
    const chat = await msg.getChat();
    if (!chat.isGroup) return;

    const groupName = chat.name.trim().toUpperCase();
    const text = msg.body.toUpperCase();

    for (const rule of rules) {
      const origen = (rule.Grupo_Origen || "").toUpperCase();
      const destino = (rule.Grupo_Destino || "").toUpperCase();
      const r1 = (rule.Restriccion_1 || "").toUpperCase();
      const r2 = (rule.Restriccion_2 || "").toUpperCase();
      const r3 = (rule.Restriccion_3 || "").toUpperCase();

      if (groupName === origen) {
        // Restricción parcial solo para r1
        const ok1 = text.includes(r1.split(" ")[0]);
        const ok2 = r2 ? text.includes(r2) : true;
        const ok3 = r3 ? text.includes(r3) : true;

        if (ok1 && ok2 && ok3) {
          const chats = await client.getChats();
          const destinoChat = chats.find(
            (c) => c.isGroup && c.name.trim().toUpperCase() === destino
          );
          if (destinoChat) {
            await client.sendMessage(destinoChat.id._serialized, msg.body);
            console.log(`➡️ Mensaje reenviado de [${origen}] a [${destino}]`);
            fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] OK ${origen} → ${destino}\n`);
          }
        }
      }
    }
  } catch (err) {
    console.error("⚠️ Error al procesar mensaje:", err);
  }
});

// === Inicio ===
client.initialize();
