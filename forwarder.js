// forwarder.js — versión estable sin getChats()
// ✅ Auto-mapeo de nombres -> IDs
// ✅ Compatible con config.json (nombres o IDs)
// ✅ Sin errores "Evaluation failed" ni "bulkCreateOrReplace"

const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const MAPPINGS_PATH = path.join(__dirname, 'mappings.json');

// Funciones utilitarias
function readJSON(p, defaultValue) {
  try {
    if (!fs.existsSync(p)) return defaultValue;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`❌ Error leyendo ${p}:`, e.message);
    return defaultValue;
  }
}

function writeJSON(p, obj) {
  try {
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.error(`❌ Error escribiendo ${p}:`, e.message);
  }
}

// Cargar configuración y mappings
const cfg = readJSON(CONFIG_PATH, { rules: [] });
const reglas = cfg.rules || [];
let mappings = readJSON(MAPPINGS_PATH, {}); // { "nombre grupo": "id@g.us" }

console.log(`📘 Reglas cargadas: ${reglas.length}`);
console.log(`🗺️ Mappings cargados: ${Object.keys(mappings).length}`);

// Inicializar cliente WhatsApp
const WA_WEB_VERSION = cfg.webVersion || '2.2412.54';

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'forwarder_bot' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  },
  webVersion: WA_WEB_VERSION,
  webVersionCache: {
    type: 'remote',
    remotePath:
      'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
    strict: false
  }
});

// ======== EVENTOS ========

client.on('qr', (qr) => console.log('📱 Escanea este código QR:\n', qr));
client.on('ready', () => console.log('✅ Bot conectado y listo para reenviar mensajes.'));
client.on('auth_failure', (msg) => console.error('❌ Error de autenticación:', msg));
client.on('disconnected', (reason) => console.warn('⚠️ Bot desconectado. Razón:', reason));

// ======== FUNCIONES AUXILIARES ========

function resolveDestino(destino) {
  if (!destino) return null;
  if (destino.includes('@')) return destino; // ya es ID
  return mappings[destino] || null; // buscar por nombre
}

function saveMapping(name, id) {
  if (!name || !id) return;
  if (mappings[name] === id) return;
  mappings[name] = id;
  writeJSON(MAPPINGS_PATH, mappings);
  console.log(`🗺️ Guardado mapping: "${name}" -> ${id}`);
}

function cumpleRestricciones(texto, regla) {
  const t = texto.toLowerCase();
  for (let i = 1; i <= 3; i++) {
    const restr = (regla[`Restriccion_${i}`] || '').toLowerCase().trim();
    if (restr && !t.includes(restr)) return false;
  }
  return true;
}

// ======== PROCESAMIENTO DE MENSAJES ========

client.on('message', async (msg) => {
  try {
    const chat = await msg.getChat();
    const origenName = chat.name || chat.id._serialized || 'Unknown';
    const originId = chat.id._serialized;
    const texto = msg.body || '';

    // Guardar auto-mapeo
    if (chat.name && originId) saveMapping(chat.name, originId);

    // Buscar reglas aplicables
    const aplicables = reglas.filter(
      (r) => r.Grupo_Origen === origenName || r.Grupo_Origen === originId
    );
    if (aplicables.length === 0) return;

    console.log(`🪲 Reglas aplicables para "${origenName}": ${aplicables.length}`);

    for (const regla of aplicables) {
      if (!cumpleRestricciones(texto, regla)) continue;

      const destinoId = resolveDestino(regla.Grupo_Destino);
      if (!destinoId) {
        console.warn(
          `⚠️ No se encontró mapping para "${regla.Grupo_Destino}". Envía un mensaje desde ese grupo para aprender su ID.`
        );
        continue;
      }

      try {
        await client.sendMessage(destinoId, `🔁 Reenvío desde "${origenName}":\n\n${texto}`);
        console.log(`➡️ Reenviado correctamente a "${regla.Grupo_Destino}" (${destinoId})`);
      } catch (err) {
        console.error(`❌ Error reenviando a "${regla.Grupo_Destino}":`, err.message);
      }
    }
  } catch (err) {
    console.error('❌ Error procesando mensaje:', err.message);
  }
});

process.on('unhandledRejection', (r) => console.error('⚠️ Error no manejado:', r));

client.initialize();
