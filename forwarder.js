import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import XLSX from 'xlsx';
import mongoose from 'mongoose';

const { Client, LocalAuth } = pkg;

// ==== CONFIGURACIÓN ====
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const EXCEL_PATH = './LISTA.xlsx';

// ==== CONEXIÓN A MONGODB ====
async function conectarMongo() {
  try {
    await mongoose.connect(CONFIG.mongo_url, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Conectado a MongoDB Atlas');
  } catch (err) {
    console.error('❌ Error MongoDB:', err);
  }
}
await conectarMongo();

// ==== CARGAR REGLAS DESDE EXCEL ====
function cargarReglas() {
  try {
    const workbook = XLSX.readFile(EXCEL_PATH);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const reglas = XLSX.utils.sheet_to_json(sheet);
    console.log(`📘 ${reglas.length} reglas cargadas desde LISTA.xlsx`);
    return reglas;
  } catch (err) {
    console.error('❌ Error cargando LISTA.xlsx:', err);
    return [];
  }
}

const reglas = cargarReglas();

// ==== INICIAR WHATSAPP ====
const client = new Client({
  authStrategy: new LocalAuth({ clientId: "cloud_session" }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer'
    ]
  }
});

// ==== MOSTRAR QR EN CONSOLA ====
client.on('qr', (qr) => {
  console.log('📱 Escanea el código QR para conectar tu bot:');
  qrcode.generate(qr, { small: true });
});

// ==== CONFIRMACIÓN DE CONEXIÓN ====
client.on('ready', () => {
  console.log('✅ WhatsApp conectado y listo.');
});

// ==== ESCUCHA DE MENSAJES ENVIADOS Y RECIBIDOS ====
client.on('message', async (msg) => {
  console.log(`💬 Mensaje recibido en grupo: ${msg.from}`);
  try {
    await procesarMensaje(msg);
  } catch (err) {
    console.error('❌ Error procesando mensaje:', err);
  }
});

// 🔹 NUEVA LÍNEA AGREGADA: para capturar mensajes creados o reenviados 🔹
client.on('message_create', async (msg) => {
  console.log(`💬 Mensaje creado o recibido: ${msg.from}`);
  try {
    await procesarMensaje(msg);
  } catch (err) {
    console.error('❌ Error procesando mensaje_create:', err);
  }
});

// ==== PROCESAR MENSAJE ====
async function procesarMensaje(msg) {
  const chat = await msg.getChat();
  if (!chat.isGroup) return; // Ignorar chats privados

  const grupoOrigen = chat.name.trim();
  const mensajeTexto = msg.body.toUpperCase();

  for (const regla of reglas) {
    const origen = (regla.Grupo_Origen || '').trim().toUpperCase();
    const destino = (regla.Grupo_Destino || '').trim();
    const r1 = (regla.Restriccion_1 || '').toUpperCase();
    const r2 = (regla.Restriccion_2 || '').toUpperCase();
    const r3 = (regla.Restriccion_3 || '').toUpperCase();

    // Validar coincidencia exacta de grupo origen
    if (grupoOrigen === origen) {
      // Validar restricciones (1 parcial, 2 y 3 exactas si existen)
      const cumpleR1 = r1 ? mensajeTexto.includes(r1) : true;
      const cumpleR2 = r2 ? mensajeTexto.includes(r2) : true;
      const cumpleR3 = r3 ? mensajeTexto.includes(r3) : true;

      if (cumpleR1 && cumpleR2 && cumpleR3) {
        console.log(`📋 Coincidencia encontrada: reenviando mensaje a ${destino}`);
        await reenviarMensaje(msg, destino);
        break;
      }
    }
  }
}

// ==== FUNCIÓN PARA REENVIAR MENSAJE ====
async function reenviarMensaje(msg, grupoDestino) {
  const chats = await client.getChats();
  const destino = chats.find(c => c.isGroup && c.name.trim() === grupoDestino.trim());

  if (destino) {
    await client.sendMessage(destino.id._serialized, msg.body);
    console.log(`✅ Mensaje reenviado a ${grupoDestino}`);
  } else {
    console.warn(`⚠️ Grupo destino no encontrado: ${grupoDestino}`);
  }
}

// ==== INICIALIZAR CLIENTE ====
client.initialize();
