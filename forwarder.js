/**
 * forwarder.js
 * Reenvía mensajes entre grupos según LISTA.xlsx
 *
 * Requisitos:
 *  - Node 18+ (recomendado Node 22)
 *  - package.json con dependencias (whatsapp-web.js v1.21.0, puppeteer)
 *
 * Uso:
 *  - Coloca LISTA.xlsx en la raíz del repo
 *  - Ejecuta: npm install && npm start
 */

const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const XLSX = require('xlsx');

const SESSION_DIR = path.resolve('./session'); // carpeta persistente para la sesión
const LISTA_XLSX = path.resolve('./LISTA.xlsx');
const PROCESSED_FILE = path.resolve('./processed.json');

function normalizeText(s) {
  if (!s) return '';
  let t = String(s);
  t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quitar acentos
  t = t.replace(/\r\n/g, '\n');
  t = t.replace(/\s*:\s*/g, ':'); // normalizar " : " -> ":"
  t = t.replace(/[^\S\r\n]+/g, ' '); // compactar espacios (preserva saltos)
  t = t.replace(/\n+/g, ' '); // convertir saltos en espacios
  t = t.trim().toLowerCase();
  return t;
}

function loadRulesFromXlsx(xlsxPath) {
  if (!fs.existsSync(xlsxPath)) {
    console.error('ERROR: LISTA.xlsx no encontrada en', xlsxPath);
    return [];
  }
  try {
    const wb = XLSX.readFile(xlsxPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const rules = rows.map((r, idx) => ({
      source: String(r['Grupo_Origen'] || '').trim(),
      target: String(r['Grupo_Destino'] || '').trim(),
      r1: String(r['Restriccion_1'] || '').trim(),
      r2: String(r['Restriccion_2'] || '').trim(),
      r3: String(r['Restriccion_3'] || '').trim(),
      _rowIndex: idx + 2
    })).filter(r => r.source && r.target);
    console.log(`Reglas cargadas: ${rules.length}`);
    return rules;
  } catch (e) {
    console.error('Error leyendo LISTA.xlsx:', e);
    return [];
  }
}

function loadProcessed(file) {
  try {
    if (!fs.existsSync(file)) return {};
    const txt = fs.readFileSync(file, 'utf8');
    return JSON.parse(txt || '{}');
  } catch (e) {
    console.warn('No se pudo leer processed.json - se inicia vacío.', e.message);
    return {};
  }
}

function saveProcessed(obj) {
  try {
    fs.writeFileSync(PROCESSED_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.error('Error guardando processed.json', e);
  }
}

let RULES = loadRulesFromXlsx(LISTA_XLSX);
let PROCESSED = loadProcessed(PROCESSED_FILE);

// watcher para recargar reglas si actualizas LISTA.xlsx
try {
  fs.watchFile(LISTA_XLSX, { interval: 5000 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      console.log('LISTA.xlsx modificado -> recargando reglas...');
      RULES = loadRulesFromXlsx(LISTA_XLSX);
    }
  });
} catch (e) {
  console.warn('No se pudo establecer watcher para LISTA.xlsx.', e.message);
}

// Cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'forwarder_bot', dataPath: SESSION_DIR }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  }
});

client.on('qr', qr => {
  console.log('QR recibido — escanea con WhatsApp o usa el base64/imagen en logs si está deformado.');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Cliente listo. Reglas:', RULES.length);
});

client.on('auth_failure', msg => {
  console.error('Falló autenticación:', msg);
});

client.on('disconnected', reason => {
  console.warn('Cliente desconectado:', reason);
});

async function findChatByExactName(name) {
  const all = await client.getChats();
  const norm = normalizeText(name);
  return all.find(c => c && c.name && normalizeText(c.name) === norm);
}

/**
 * Lógica de validación:
 * - Grupo origen: coincidencia exacta (ignorando mayúsculas/acentos)
 * - r1: parcial (contains)  -> si está vacía se ignora
 * - r2: exacta (substring)  -> si está vacía se ignora
 * - r3: exacta (substring)  -> si está vacía se ignora
 * - Si la fila no tiene target o source, se omite.
 */
function ruleAppliesToMessage(rule, chatName, messageText) {
  if (normalizeText(chatName) !== normalizeText(rule.source)) return false;

  const txt = normalizeText(messageText || '');

  // si restricción vacía -> la ignoramos (NO cancelamos la regla)
  // (esto permite filas con 1,2 o 3 restricciones)
  if (rule.r1) {
    const r1 = normalizeText(rule.r1);
    if (!txt.includes(r1)) return false; // r1 partial
  }
  if (rule.r2) {
    const r2 = normalizeText(rule.r2);
    if (!txt.includes(r2)) return false; // r2 must be present
  }
  if (rule.r3) {
    const r3 = normalizeText(rule.r3);
    if (!txt.includes(r3)) return false; // r3 must be present
  }

  return true;
}

client.on('message_create', async (message) => {
  try {
    const mid = message.id && message.id._serialized;
    if (!mid) return;
    if (PROCESSED[mid]) return; // ya procesado

    const chat = await message.getChat();
    if (!chat || !chat.isGroup) return;

    const chatName = chat.name || '';
    const body = message.body || (message.caption || '') || '';

    for (const rule of RULES) {
      try {
        if (ruleAppliesToMessage(rule, chatName, body)) {
          console.log(`Regla matched (fila ${rule._rowIndex}): ${rule.source} -> ${rule.target} (msg ${mid})`);
          const targetChat = await findChatByExactName(rule.target);
          if (!targetChat) {
            console.warn('Destino no encontrado en la lista de chats:', rule.target);
            continue;
          }

          try {
            await message.forward(targetChat.id._serialized);
            console.log('Mensaje reenviado a', targetChat.name);
            PROCESSED[mid] = { forwardedTo: targetChat.name, timestamp: new Date().toISOString() };
            saveProcessed(PROCESSED);
          } catch (e) {
            console.error('Error reenviando:', e);
          }
          break; // no evaluar más reglas para este mensaje
        }
      } catch (e) {
        console.error('Error evaluando regla', rule, e);
      }
    }

  } catch (e) {
    console.error('Error en handler message_create', e);
  }
});

client.initialize();

process.on('SIGINT', () => {
  console.log('SIGINT -> cerrando cliente');
  client.destroy();
  process.exit();
});
process.on('SIGTERM', () => {
  console.log('SIGTERM -> cerrando cliente');
  client.destroy();
  process.exit();
});
