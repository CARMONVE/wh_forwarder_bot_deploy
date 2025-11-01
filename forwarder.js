/**
 * WhatsApp Forwarder Bot (Modo DEBUG)
 * ------------------------------------
 * • Reenvía mensajes entre grupos según LISTA.xlsx
 * • Imprime trazas detalladas (depuración completa)
 * • Guarda sesión y evita reconexión constante
 */

import express from "express";
import qrcode from "qrcode-terminal";
import xlsx from "xlsx";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import fs from "fs";

// === CONFIGURACIÓN === //
const EXCEL_PATH = "./LISTA.xlsx";
const PORT = 8080;
const SESSION_PATH = "/home/c_monsalve_vejar/.whatsapp_session";
const DEBUG = true; // ⚙️ Cambia a false para modo silencioso

function logDebug(msg, data = null) {
  if (DEBUG) {
    const time = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${time}] 🪲 ${msg}`);
    if (data) console.dir(data, { depth: null, colors: true });
  }
}

// === LEER REGLAS DEL EXCEL === //
let reglas = [];
try {
  const wb = xlsx.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  reglas = xlsx.utils.sheet_to_json(ws);
  console.log(`📋 Se cargaron ${reglas.length} reglas desde el Excel.`);
} catch (err) {
  console.error("❌ Error al leer LISTA.xlsx:", err);
}

// === CREAR CLIENTE DE WHATSAPP === //
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
  puppeteer: {
    headless: true,
    executablePath: "/usr/bin/chromium-browser",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process"
    ],
  },
});

// === EVENTOS DE CONEXIÓN === //
client.on("qr", qr => {
  console.log("📱 Escanea este código QR para vincular tu cuenta:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  console.log("✅ Bot conectado y listo para reenviar mensajes.");
  const chats = await client.getChats();
  logDebug("Chats disponibles al iniciar:", chats.map(c => c.name));
});

client.on("disconnected", reason => {
  console.log("⚠️ Bot desconectado. Razón:", reason);
});

// === LÓGICA DE REENVÍO CON TRAZAS === //
client.on("message", async msg => {
  try {
    const chat = await msg.getChat();
    if (!chat.isGroup) return;

    const origen = chat.name.trim();
    const contenido = msg.body.trim();

    logDebug(`📩 Mensaje recibido del grupo "${origen}":`, contenido);

    const reglasAplicables = reglas.filter(r =>
      r["Grupo_Origen"] &&
      r["Grupo_Origen"].toLowerCase().includes(origen.toLowerCase())
    );

    if (reglasAplicables.length === 0) {
      logDebug(`🚫 No hay reglas para el grupo origen: "${origen}"`);
      return;
    }

    logDebug(`🔍 Reglas encontradas para "${origen}":`, reglasAplicables);

    const chats = await client.getChats();

    for (const regla of reglasAplicables) {
      const destino = regla["Grupo_Destino"]?.trim();
      if (!destino) continue;

      const matchRestriccion1 = regla["Restriccion_1"]
        ? contenido.toLowerCase().includes(regla["Restriccion_1"].toLowerCase())
        : true;

      const matchRestriccion2 = regla["Restriccion_2"]
        ? contenido.toLowerCase().includes(regla["Restriccion_2"].toLowerCase())
        : true;

      const matchRestriccion3 = regla["Restriccion_3"]
        ? contenido.toLowerCase().includes(regla["Restriccion_3"].toLowerCase())
        : true;

      logDebug(`Evaluando regla hacia "${destino}"`, {
        matchRestriccion1,
        matchRestriccion2,
        matchRestriccion3,
      });

      if (matchRestriccion1 && matchRestriccion2 && matchRestriccion3) {
        const chatDestino = chats.find(c =>
          c.isGroup && c.name.toLowerCase().includes(destino.toLowerCase())
        );

        if (chatDestino) {
          await chatDestino.sendMessage(
            `📩 *Reenviado desde:* ${origen}\n\n${contenido}`
          );
          console.log(`✅ Mensaje reenviado de "${origen}" a "${destino}"`);
        } else {
          console.warn(`⚠️ No se encontró el grupo destino: ${destino}`);
        }
      } else {
        logDebug(`⛔ Restricciones no cumplidas para "${destino}"`);
      }
    }
  } catch (err) {
    console.error("❌ Error procesando mensaje:", err);
  }
});

// === SERVIDOR EXPRESS === //
const app = express();
app.get("/", (req, res) => {
  res.send("✅ Bot WhatsApp activo (modo depuración).");
});
app.listen(PORT, () => console.log(`🌐 Servidor web activo en el puerto ${PORT}`));

// === INICIAR BOT === //
client.initialize();

