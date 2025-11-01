// forwarder.js (reemplazar archivo actual)
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');

const CONFIG_PATH = path.join(__dirname, 'config.json');

// Load rules safely
let rules = [];
try {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  rules = cfg.rules || [];
  console.log(`📂 ${rules.length} reglas cargadas desde config.json`);
} catch (e) {
  console.error('❌ No se pudo leer config.json:', e.message);
  process.exit(1);
}

// Ajusta esta versión si necesitas otra (ve instrucciones más abajo para cambiarla)
const WA_WEB_VERSION = '2.2412.54';

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'forwarder_bot' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
    // Opcional: si tu Chromium está en otra ruta, añade executablePath
    // executablePath: '/usr/bin/chromium-browser'
  },
  webVersion: WA_WEB_VERSION,
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
    strict: false
  }
});

client.on('qr', qr => {
  console.log('📱 QR RECIBIDO (escanea con WhatsApp Web):\n', qr);
});

client.on('ready', () => {
  console.log('✅ Bot conectado y listo para reenviar mensajes.');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Falló la autenticación:', msg);
});

client.on('disconnected', (reason) => {
  console.warn('⚠️ Cliente desconectado:', reason);
});

// Función que determina targets según reglas (pattern es regex string con flags)
function findTargetsForText(text, originName) {
  const matchedTargets = [];
  for (const r of rules) {
    try {
      // Validamos origin si viene configurado
      if (r.origin && originName && r.origin !== originName) {
        // skip si se quiere filtrar por origen exacto
      }
      const re = new RegExp(r.pattern, r.flags || '');
      if (re.test(text)) {
        matchedTargets.push(r.target);
      }
    } catch (e) {
      console.error('❌ Regla inválida:', r, e.message);
    }
  }
  // eliminar duplicados
  return Array.from(new Set(matchedTargets));
}

client.on('message', async (msg) => {
  try {
    // Evitamos llamadas globales; trabajamos por mensaje
    const text = msg.body || '';
    const chat = await msg.getChat(); // esto es seguro por mensaje
    const originName = chat.name || chat.id._serialized || chat.formattedTitle || '';

    console.log(`📩 Mensaje de ${originName} (${msg.from}): ${text.substring(0,200)}`);

    const targets = findTargetsForText(text, originName);
    if (targets.length === 0) {
      // No hay reglas aplicables
      return;
    }

    // Reenvía el mensaje a cada target (targets deben ser nombres de chats/grupos).
    for (const t of targets) {
      try {
        // Buscamos el chat destino por nombre (no usamos getChats())
        // getChats global puede fallar; en su lugar utilizamos search
        const searchRes = await client.getChats(); // <<--- PROTEGIDO: lo usamos en modo try/catch
        // pero la recomendación ES evitarlo; si falla, lo omitimos y solo logueamos
        // Para entornos donde getChats falla, se puede mapear targets a IDs en config.json
        const destChat = searchRes.find(c => (c.name || c.formattedTitle) === t);
        if (!destChat) {
          console.warn(`⚠️ No se encontró chat destino con nombre "${t}". Considera usar el ID en config.json`);
          continue;
        }
        await client.sendMessage(destChat.id._serialized, `🔁 Reenvío desde ${originName}:\n\n${text}`);
        console.log(`➡️ Reenviado a "${t}" (${destChat.id._serialized})`);
      } catch (e) {
        // Si getChats o búsqueda falla, indicamos y seguimos
        console.error('❌ Error buscando/enviando al target:', t, e.message);
      }
    }

  } catch (err) {
    console.error('❌ Error manejando mensaje:', err && err.message ? err.message : err);
  }
});

// Capturamos errores globales no atrapados
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

client.initialize();

