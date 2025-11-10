/**
 * forwarder.js
 * Bot que lee reglas desde LISTA.xlsx y reenvía mensajes según la lógica acordada.
 *
 * Requisitos:
 *  - Node 18+ (probado con 22)
 *  - Dependencias definidas en package.json
 *
 * Uso:
 *  - Coloca LISTA.xlsx en la raíz del proyecto
 *  - Ejecuta: node forwarder.js
 *
 * Comportamiento importante:
 *  - Sesión de WhatsApp guardada en ./session (LocalAuth). Asegúrate de que esa carpeta esté dentro de $HOME en Cloud Shell.
 *  - Si LISTA.xlsx cambia, el script recarga las reglas (file watcher).
 */

const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const XLSX = require('xlsx');

const SESSION_DIR = path.resolve('./session'); // persistente en $HOME
const LISTA_XLSX = path.resolve('./LISTA.xlsx');
const PROCESSED_FILE = path.resolve('./processed.json');

function normalizeText(s) {
  if (!s) return '';
  let t = String(s);
  // quitar diacríticos (acentos)
  t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  t = t.replace(/\r\n/g, '\n');
  // normalizar espacio alrededor de ':' y colapsar espacios
  t = t.replace(/\s*:\s*/g, ':');
  t = t.replace(/[^\S\r\n]+/g, ' ');
  t = t.replace(/\n+/g, ' ');
  t = t.trim().toLowerCase();
  return t;
}

function loadRulesFromXlsx(xlsxPath) {
  if (!fs.existsSync(xlsxPath)) {
    console.error('LISTA.xlsx no encontrada en', xlsxPath);
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
    console.warn('No se pudo leer processed.json - se crea uno nuevo.', e.message);
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

// vigilamos cambios en LISTA.xlsx y recargamos automáticamente
try {
  fs.watchFile(LISTA_XLSX, { interval: 5000 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      console.log('LISTA.xlsx cambió -> recargando reglas...');
      RULES = loadRulesFromXlsx(LISTA_XLSX);
    }
  });
} catch (e) {
  console.warn('No se pudo establecer watcher para LISTA.xlsx.', e.message);
}

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
  console.log('QR recibido — escanea con WhatsApp (o usa el base64/imagen).');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  console.log('Cliente listo. Reglas cargadas:', RULES.length);
});

client.on('auth_failure', msg => {
  console.error('Auth failure:', msg);
});

client.on('disconnected', reason => {
  console.warn('Desconectado:', reason);
});

async function findChatByExactName(name) {
  const all = await client.getChats();
  const norm = normalizeText(name);
  return all.find(c => c && c.name && normalizeText(c.name) === norm);
}

function ruleAppliesToMessage(rule, chatName, messageText) {
  // Grupo origen debe coincidir EXACTO
  if (normalizeText(chatName) !== normalizeText(rule.source)) return false;

  // si alguna restricción vacía => la regla se cancela (B)
  if (!rule.r1 || !rule.r2 || !rule.r3) return false;

  const txt = normalizeText(messageText || '');
  const r1 = normalizeText(rule.r1);
  const r2 = normalizeText(rule.r2);
  const r3 = normalizeText(rule.r3);

  if (!txt.includes(r1)) return false; // r1 = partial (contains)
  if (!txt.includes(r2)) return false; // r2 = must appear
  if (!txt.includes(r3)) return false; // r3 = must appear

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
          console.log(`Regla aplicada (fila ${rule._rowIndex}): ${rule.source} -> ${rule.target} (msg ${mid})`);
          const targetChat = await findChatByExactName(rule.target);
          if (!targetChat) {
            console.warn('Chat destino no encontrado:', rule.target);
            continue;
          }
          try {
            await message.forward(targetChat.id._serialized);
            console.log('Reenviado a', targetChat.name);
            PROCESSED[mid] = { forwardedTo: targetChat.name, timestamp: new Date().toISOString() };
            saveProcessed(PROCESSED);
          } catch (e) {
            console.error('Error reenviando mensaje:', e);
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

// shutdown limpio
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
