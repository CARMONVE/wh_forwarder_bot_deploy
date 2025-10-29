// === WHATSAPP FORWARDER BOT - Google Cloud Shell Version ===
// Compatible con Puppeteer en entorno headless, sin dependencias gráficas adicionales

const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// === CONFIGURACIÓN SERVIDOR WEB (para mantener vivo el proceso) ===
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (_, res) => res.send('✅ Bot WhatsApp activo en Google Cloud Shell'));
app.listen(PORT, () => console.log(`🌐 Web server listening on ${PORT}`));

// === RUTAS DE ARCHIVOS ===
const configPath = path.join(__dirname, 'config.json');
const excelPath = path.join(__dirname, 'LISTA.xlsx');

// === VALIDACIÓN DE ARCHIVOS ===
if (!fs.existsSync(configPath)) {
  console.error('❌ No se encontró config.json');
  process.exit(1);
}
if (!fs.existsSync(excelPath)) {
  console.error('❌ No se encontró LISTA.xlsx');
  process.exit(1);
}

// === CARGA DE CONFIGURACIÓN Y DATOS DE EXCEL ===
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
console.log(`📋 Se cargaron ${data.length} filas desde ${sheetName}`);

// === CONFIGURACIÓN DEL CLIENTE WHATSAPP ===
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: '/usr/bin/chromium-browser', // compatible con Cloud Shell
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-software-rasterizer'
    ]
  }
});

// === EVENTOS DEL CLIENTE ===

// Mostrar QR en consola
client.on('qr', qr => {
  console.log('📱 Escanea este código QR desde tu WhatsApp (Dispositivos vinculados):');
  console.log(qr);
});

// Confirmar conexión
client.on('ready', () => {
  console.log('✅ Bot conectado y listo para recibir mensajes.');
});

// Escuchar mensajes y responder según Excel
client.on('message', async msg => {
  try {
    const texto = msg.body?.trim()?.toLowerCase() || '';
    const coincidencia = data.find(
      row => row.Trigger?.toLowerCase() === texto
    );

    if (coincidencia && coincidencia.Respuesta) {
      await client.sendMessage(msg.from, coincidencia.Respuesta);
      console.log(`💬 Respondido a ${msg.from}: ${coincidencia.Respuesta}`);
    } else {
      console.log(`ℹ️ Mensaje recibido sin coincidencia: ${texto}`);
    }
  } catch (error) {
    console.error('⚠️ Error procesando mensaje:', error);
  }
});

// Inicializar el cliente
client.initialize().catch(err => {
  console.error('❌ Error inicializando cliente:', err);
});
