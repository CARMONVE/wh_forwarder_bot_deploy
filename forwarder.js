import express from "express";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
import xlsx from "xlsx";
import fs from "fs";
import path from "path";

const { Client, LocalAuth } = pkg;
const app = express();
const PORT = process.env.PORT || 8080;

// === 1️⃣ Cargar archivo Excel ===
const excelPath = path.join(process.cwd(), "LISTA.xlsx");
const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const sheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
console.log(`📋 Se cargaron ${sheet.length} reglas desde el Excel.`);

// === 2️⃣ Inicializar cliente de WhatsApp ===
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-gpu",
    ],
  },
});

// === 3️⃣ Mostrar QR en consola ===
client.on("qr", (qr) => {
  console.log("📱 Escanea este código QR para vincular WhatsApp:");
  qrcode.generate(qr, { small: true });
});

// === 4️⃣ Confirmación de conexión ===
client.on("ready", () => {
  console.log("✅ Cliente de WhatsApp conectado y listo.");
});

// === 5️⃣ Procesar mensajes ===
client.on("message", async (msg) => {
  try {
    if (!msg.from.includes("@g.us")) return; // Solo grupos

    const chat = await msg.getChat();
    const groupName = chat.name.trim();

    console.log(`💬 Mensaje recibido desde grupo: "${groupName}"`);

    // Buscar reglas que coincidan con este grupo
    const reglas = sheet.filter((r) => r.Grupo_Origen && groupName.includes(r.Grupo_Origen.trim()));

    if (reglas.length === 0) {
      console.log(`⚠️ No hay reglas para el grupo "${groupName}"`);
      return;
    }

    for (const regla of reglas) {
      const restricciones = [
        regla.Restriccion_1,
        regla.Restriccion_2,
        regla.Restriccion_3,
      ].filter(Boolean); // elimina vacíos

      const cumpleTodas = restricciones.every((res) => msg.body.includes(res));

      if (cumpleTodas) {
        const destinoNombre = regla.Grupo_Destino?.trim();
        if (!destinoNombre) {
          console.log(`⚠️ Regla sin grupo destino: ${JSON.stringify(regla)}`);
          continue;
        }

        const chats = await client.getChats();
        const destino = chats.find(
          (c) => c.isGroup && c.name.trim().includes(destinoNombre)
        );

        if (destino) {
          await destino.sendMessage(msg.body);
          console.log(`✅ Mensaje reenviado a "${destinoNombre}"`);
        } else {
          console.log(`🚫 No se encontró el grupo destino: "${destinoNombre}"`);
        }
      } else {
        // Mostrar cuál restricción falló
        const noCumple = restricciones.filter((res) => !msg.body.includes(res));
        console.log(`❌ Mensaje NO cumple las restricciones: ${noCumple.join(", ")}`);
      }
    }
  } catch (err) {
    console.error("💥 Error al procesar mensaje:", err);
  }
});

// === 6️⃣ Servidor web para mantener vivo el bot ===
app.get("/", (req, res) => res.send("🤖 WhatsApp Bot activo"));
app.listen(PORT, () => console.log(`🌐 Servidor web activo en el puerto ${PORT}`));

// === 7️⃣ Iniciar cliente ===
client.initialize();
