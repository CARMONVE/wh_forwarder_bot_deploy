// ✅ forwarder.js — versión compatible con Node 22 / Google Cloud Shell
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import express from 'express';
import fs from 'fs';
import XLSX from 'xlsx';

// 🌐 Servidor básico Express
const app = express();
app.get('/', (req, res) => {
  res.send('✅ Servidor activo: Bot de WhatsApp corriendo en Google Cloud Shell');
});
app.listen(3000, () => console.log('🌐 Web server escuchando en puerto 3000'));

// 📂 Cargar archivo Excel
const excelPath = './LISTA.xlsx';
let data = [];
if (fs.existsSync(excelPath)) {
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  data = XLSX.utils.sheet_to_json(sheet);
  console.log(`📋 Se cargaron ${data.length} filas desde ${workbook.SheetNames[0]}`);
} else {
  console.log('⚠️ No se encontró LISTA.xlsx en la carpeta del proyecto.');
}

// 🤖 Inicializar cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-extensions',
      '--disable-dev-shm-usage',
      '--single-process',
    ],
  },
});

client.on('qr', (qr) => {
  console.log('📱 Escanea este código QR para iniciar sesión:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ WhatsApp conectado y listo.');
});

client.on('disconnected', (reason) => {
  console.log('⚠️ Cliente desconectado:', reason);
});

client.initialize();
