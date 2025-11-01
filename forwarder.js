// forwarder.js — Auto-mapping names -> ids, no getChats()
// Guarda mappings en mappings.json para evitar getChats() y errores "Evaluation failed"

const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const MAPPINGS_PATH = path.join(__dirname, 'mappings.json');

function readJSON(p, defaultValue) {
  try {
    if (!fs.existsSync(p)) return defaultValue;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`Error leyendo ${p}:`, e.message);
    return defaultValue;
  }
}
function writeJSON(p, obj) {
  try {
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error escribiendo ${p}:`, e.message);
  }
}

// Cargar reglas y mappings
const cfg = readJSON(CONFIG_PATH, { rules: [] });
const reglas = cfg.rules || [];
let mappings = readJSON(MAPPINGS_PATH, {}); // { "Nombre del grupo": "1203630...@g.us", ... }

console.log(`📚 Reglas cargadas: ${reglas.length}`);
console.log(`🗺️ Mappings cargados: ${Object.keys(mappings).length}`);

// Versión WA
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
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
    strict: false
  }
});

client.on('qr', qr => console.log('📱 Escanea el QR:\n', qr));
client.on('ready', () => console.log('✅ Bot conectado y listo para reenviar mensajes.'));
client.on('auth_failure', (m) => console.error('❌ auth_failure:', m));
client.on('disconnected', r => console.warn('⚠️ disconnected:', r));

/**
 * Resuelve destino:
 * - Si destino incluye '@' (es ID) -> lo devuelve
 * - Si destino es nombre -> busca en mappings.json -> si existe devuelve ID
 * - Si no existe -> devuelve null (y el caller puede registrar aviso)
 */
function resolveDestino(destino) {
  if (!destino) return null;
  if (typeof destino !== 'string') return null;
  if (destino.includes('@')) return destino;
  // buscar por nombre exacto
  const id = mappings[destino];
  return id || null;
}

// Guardar mapeo: nombre -> id (persistente)
function saveMapping(name, id) {
  if (!name || !id) return false;
  if (mappings[name] === id) return false; // sin cambios
  mappings[name] = id;
  writeJSON(MAPPINGS_PATH, mappings);
  console.log(`🗺️ Nuevo mapping guardado: "${name}" -> ${id}`);
  return true;
}

// Función para evaluar restricciones (puedes hacer más compleja)
function cumpleRestricciones(texto, regla) {
  try {
    if (!regla) return false;
    // Si regla define Restriccion_1/2/3, cada una debe estar incluida (case insensitive)
    const t = (texto || '').toLowerCase();
    const r1 = regla.Restriccion_1 ? String(regla.Restriccion_1).toLowerCase() : null;
    const r2 = regla.Restriccion_2 ? String(regla.Restriccion_2).toLowerCase() : null;
    const r3 = regla.Restriccion_3 ? String(regla.Restriccion_3).toLowerCase() : null;
    if (r1 && !t.includes(r1)) return false;
    if (r2 && !t.includes(r2)) return false;
    if (r3 && !t.includes(r3)) return false;
    return true;
  } catch (e) {
    return false;
  }
}

client.on('message', async (msg) => {
  try {
    const chat = await msg.getChat();
    const origenName = chat.name || chat.id._serialized || chat.formattedTitle || 'Unknown';
    const originId = chat.id && chat.id._serialized ? chat.id._serialized : (msg.from || '');
    const texto = msg.body || '';

    // AUTO-LEARN mapping (si tenemos nombre y id)
    if (chat.name && originId) {
      saveMapping(chat.name, originId);
    }

    console.log(`[${new Date().toISOString()}] 🪲 📩 Mensaje recibido del grupo "${origenName}":\n${texto}`);
    // Filtrar reglas que aplican por Grupo_Origen
    const reglasAplicables = reglas.filter(r => r.Grupo_Origen === origenName || r.Grupo_Origen === originId);

    if (reglasAplicables.length === 0) {
      // nada que hacer
      return;
    }

    console.log(`🪲 🔍 Reglas encontradas para "${origenName}":`, reglasAplicables);

    for (const regla of reglasAplicables) {
      try {
        // comprobar restricciones
        if (!cumpleRestricciones(texto, regla)) {
          // No cumple -> saltar
          continue;
        }

        // resolver destino (puede ser nombre o ID)
        const destinoRaw = regla.Grupo_Destino;
        const destinoId = resolveDestino(destinoRaw);

        if (!destinoId) {
          console.warn(`⚠️ No existe mapping para destino "${destinoRaw}". Por favor, envía al menos un mensaje desde ese grupo para que el bot aprenda su ID, o agrega su ID en mappings.json.`);
          // opcional: almacenar en pending (no implementado) o notificar admin
          continue;
        }

        // Enviar mensaje (texto simple). Puedes mejorar para reenviar archivos/media.
        await client.sendMessage(destinoId, `🔁 Reenvío desde "${origenName}":\n\n${texto}`);
        console.log(`➡️ Reenviado a ${destinoRaw} -> ${destinoId}`);

      } catch (e) {
        console.error('❌ Error reenviando según regla:', regla, e && e.message ? e.message : e);
      }
    }

  } catch (err) {
    console.error('❌ Error procesando mensaje:', err && err.message ? err.message : err);
  }
});

process.on('unhandledRejection', (r) => console.error('UnhandledRejection:', r));

client.initialize();
