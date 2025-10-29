// === FORWARDER BOT – Google Cloud Shell version ===

const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (_, res) => res.send('✅ Bot WhatsApp activo en Google Cloud Shell'));
app.listen(PORT, () => console.log(`🌐 Web server listening on ${PORT}`));

const configPath = path.join(__dirname, 'config.json');
const excelPath = path.join(__dirname, 'LISTA.xlsx');

if (!fs.existsSync(configPath)) {
  console.error('❌ No se encontró config.json');
  process.exit(1);
}
if (!fs.existsSync(excelPath)) {
  console.error('❌ No se encontró LISTA.xlsx');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
console.log(`📋 Se cargaron ${data.length} filas desde ${sheetName}`);

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage'
    ]
  }
});

client.on('qr', qr => {
  console.log('📱 Escanea este código QR desde tu WhatsApp:');
  console.log(qr);
});

client.on('ready', () => console.log('✅ Bot conectado y listo.'));

client.on('message', async msg => {
  try {
    const text = msg.body?.trim()?.toLowerCase() || '';
    const match = data.find(row => row.Trigger?.toLowerCase() === text);
    if (match && match.Respuesta) {
      await client.sendMessage(msg.from, match.Respuesta);
      console.log(`💬 Respondido a ${msg.from}: ${match.Respuesta}`);
    } else {
      console.log(`ℹ️ Mensaje sin coincidencia: ${text}`);
    }
  } catch (err) {
    console.error('⚠️ Error procesando mensaje:', err);
  }
});

client.initialize().catch(err => console.error('❌ Error inicializando cliente:', err));
