const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'forwarder_bot'
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
      // otros flags si tu servidor lo requiere
    ]
  },
  webVersion: '2.2412.54',  // versión sugerida para compatibilidad
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
    strict: false
  }
});

client.on('qr', qr => {
  console.log('QR RECIBIDO:', qr);
});

client.on('ready', () => {
  console.log('✅ Bot conectado y listo para reenviar mensajes.');
});

client.on('message', async msg => {
  try {
    console.log('Mensaje recibido de', msg.from, ':', msg.body);
    // Lógica de reenvío: por ejemplo, reenviar a otro chat
    // await client.sendMessage('123456789@c.us', msg.body);
  } catch (err) {
    console.error('Error en handler de message:', err);
  }
});

client.initialize();
