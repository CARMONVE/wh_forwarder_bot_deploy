// forwarder.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Puppeteer options compatible con contenedores cloud/Replit
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }
});

// QR
client.on('qr', async (qr) => {
  try {
    const dataUrl = await qrcode.toDataURL(qr);
    console.log('📱 QR (data URL) — pega esto en tu navegador para ver el QR:');
    console.log(dataUrl);
    // also save file so you can download it via Replit file manager
    await qrcode.toFile(path.join(__dirname, 'qr.png'), qr, { width: 400 });
    console.log('✅ qr.png guardado en el filesystem.');
  } catch (e) {
    console.error('Error generando QR:', e);
  }
});

client.on('ready', () => {
  console.log('✅ Cliente WhatsApp conectado y listo.');
});

client.on('auth_failure', msg => {
  console.error('❌ auth_failure:', msg);
});

client.on('disconnected', reason => {
  console.warn('⚠️ disconnected:', reason);
  // whatsapp-web.js intenta reconectar solo; no forzamos un initialize infinito aquí
});

// Message handling: uses your config.json rules (UNCHANGED)
client.on('message', async (message) => {
  try {
    const cfgPath = path.join(__dirname, 'config.json');
    if (!fs.existsSync(cfgPath)) return;
    const config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const rules = config.rules || [];
    for (const rule of rules) {
      const originMatch = message.from.includes(rule.origin);
      const pattern = new RegExp(rule.pattern, rule.flags || 'ims');
      if (originMatch && pattern.test(message.body)) {
        console.log(`📤 Reenvío: ${rule.origin} → ${rule.target}`);
        const chats = await client.getChats();
        const targetChat = chats.find(c => c.name === rule.target);
        if (targetChat) {
          await client.sendMessage(targetChat.id._serialized, message.body);
          console.log('✅ Mensaje reenviado.');
        } else {
          console.warn('⚠️ Target chat not found:', rule.target);
        }
      }
    }
  } catch (err) {
    console.error('Error en message handler:', err);
  }
});

client.initialize();

// Minimal HTTP server so Replit provides a web URL
app.get('/', (req, res) => res.send('Bot WhatsApp corriendo'));
app.get('/logs', (req, res) => {
  // quick way to download latest qr.png from Replit (if present)
  const f = path.join(__dirname, 'qr.png');
  if (fs.existsSync(f)) return res.sendFile(f);
  return res.send('No qr.png yet');
});

app.listen(PORT, () => console.log(`🌐 Web server listening on ${PORT}`));
