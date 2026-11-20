const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });

      if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.PHONE_NUMBER || '254758690110';
        const digits = phoneNumber.replace(/[^0-9]/g, '');

        if (digits) {
          try {
            const pairingCode = await sock.requestPairingCode(digits);
            console.log(`📱 BRIAN BOT Pairing code: ${pairingCode}`);
          } catch (error) {
            console.error('BRIAN BOT Could not generate pairing code:', error.message);
          }
        }
      }
    }

    if (connection === 'open') {
      console.log('✅ BRIAN BOT Connected!');
    } else if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode !== 401) startBot();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      if (!from) continue;

      await sock.readMessages([msg.key]);

      const text = msg.message.conversation
        || msg.message.extendedTextMessage?.text
        || '';

      if (text.toLowerCase() === 'hi') {
        await sock.sendMessage(from, { text: 'Hello 👋 I am BRIAN BOT' });
      } else if (text.toLowerCase() === 'price') {
        await sock.sendMessage(from, { text: 'Price is 500' });
      } else if (text.toLowerCase() === 'contribution') {
        await sock.sendMessage(
          from,
          { text: 'Send to 0720864928 - Abel Bungei\nTarget: 800,000\nTotal: 424,230' }
        );
      } else if (text.toLowerCase() === 'sticker') {
        const stickerUrl = process.env.STICKER_URL;
        if (stickerUrl) {
          await sock.sendMessage(from, { sticker: { url: stickerUrl } });
        } else {
          await sock.sendMessage(from, { text: 'Sticker is not configured yet.' });
        }
      } else if (text.toLowerCase() === 'football') {
        await sock.sendMessage(from, { text: '⚽ Choose Left / Center / Right' });
      } else if (text.includes('https://')) {
        await sock.sendMessage(from, { text: 'Links not allowed! ❌' });
      }
    }
  });
}

startBot();
