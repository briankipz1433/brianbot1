const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;

    if (qr) qrcode.generate(qr, { small: true });
    if (connection === 'open') console.log('✅ Bot Connected!');
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text = msg.message.conversation || '';
    const from = msg.key.remoteJid;

    if (text === 'hi') {
      await sock.sendMessage(from, { text: 'Hello 👋' });
    } else if (text === 'price') {
      await sock.sendMessage(from, { text: 'Price is 500' });
    }
  });
}

startBot();
