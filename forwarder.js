// ====================== DEPENDENCIAS ======================
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import xlsx from 'xlsx';
import mongoose from 'mongoose';
import path from 'path';
import url from 'url';

// ====================== RUTAS Y CONFIG ======================
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const EXCEL_PATH = path.resolve(config.excel_path);
const MONGO_URL = config.mongo_url;

// ====================== CONEXIÓN MONGODB ======================
async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URL, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log("✅ Conectado a MongoDB Atlas");
  } catch (err) {
    console.error("❌ Error MongoDB:", err.message);
  }
}
await connectMongo();

// ====================== CARGA DEL EXCEL ======================
function loadRules() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`❌ No se encontró el archivo Excel: ${EXCEL_PATH}`);
    process.exit(1);
  }

  const wb = xlsx.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(ws);

  console.log(`📘 ${data.length} reglas cargadas desde LISTA.xlsx`);
  return data;
}

const reglas = loadRules();

// ====================== WHATSAPP CLIENT ======================
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './session' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-extensions'
    ]
  }
});

// ====================== QR ======================
client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
  console.log("📱 Escanea el código QR para conectar tu bot...");
});

// ====================== READY ======================
client.on('ready', () => {
  console.log("✅ WhatsApp conectado y listo.");
});

// ====================== MENSAJES ======================
client.on('message', async msg => {
  const texto = msg.body.toUpperCase();
  const chat = await msg.getChat();

  if (!chat.isGroup) return;

  const grupoOrigen = chat.name?.trim().toUpperCase();

  console.log("\n===============================");
  console.log("📥 Mensaje recibido desde:", grupoOrigen);
  console.log("📄 Contenido:", texto);
  console.log("===============================\n");

  const regla = reglas.find(r =>
    (r.Grupo_Origen || "").trim().toUpperCase() === grupoOrigen
  );

  if (!regla) {
    console.log("⚠️ No hay reglas para este grupo.");
    return;
  }

  const r1 = (regla.Restriccion_1 || "").toUpperCase();
  const r2 = (regla.Restriccion_2 || "").toUpperCase();
  const r3 = (regla.Restriccion_3 || "").toUpperCase();

  const cumple1 = !r1 || texto.includes(r1);   // parcial
  const cumple2 = !r2 || texto.includes(r2);   // exacta
  const cumple3 = !r3 || texto.includes(r3);   // exacta

  console.log("🔎 Verificando reglas:");
  console.log(" - Restriccion_1:", r1, "→", cumple1);
  console.log(" - Restriccion_2:", r2, "→", cumple2);
  console.log(" - Restriccion_3:", r3, "→", cumple3);

  if (!(cumple1 && cumple2 && cumple3)) {
    console.log("❌ No cumple todas las restricciones. No se reenvía.");
    return;
  }

  const destino = (regla.Grupo_Destino || "").trim();
  if (!destino) {
    console.log("❌ La regla NO tiene grupo destino.");
    return;
  }

  const chats = await client.getChats();
  const grupoDestino = chats.find(c => c.name.trim().toUpperCase() === destino.toUpperCase());

  if (!grupoDestino) {
    console.log(`❌ Grupo destino no encontrado: ${destino}`);
    return;
  }

  await grupoDestino.sendMessage(`📩 Reenviado desde *${grupoOrigen}*\n\n${msg.body}`);
  console.log(`✅ Reenvío exitoso: "${grupoOrigen}" → "${destino}"`);
});

// ====================== INICIO ======================
client.initialize();
