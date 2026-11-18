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

  async function sendWithTyping(from, text) {
    await sock.sendPresenceUpdate('composing', from);
    await sock.sendMessage(from, { text });
    await sock.sendPresenceUpdate('paused', from);
  }

  sock.ev.on('group-participants.update', async (update) => {
    if (update.action === 'add') {
      await sendWithTyping(update.id, 'Welcome to the group! 🎉');
    } else if (update.action === 'remove') {
      await sendWithTyping(update.id, 'Goodbye! 👋');
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
        await sendWithTyping(from, 'Hello 👋');
      } else if (text.toLowerCase() === 'price') {
        await sendWithTyping(from, 'Price is 500');
      } else if (text.toLowerCase() === 'contribution') {
        await sendWithTyping(
          from,
          'Send to 0720864928 - Abel Bungei\nTarget: 800,000\nTotal: 424,230'
        );
      } else if (text.toLowerCase() === 'sticker') {
        const stickerUrl = process.env.STICKER_URL;
        if (stickerUrl) {
          await sock.sendMessage(from, { sticker: { url: stickerUrl } });
        } else {
          await sendWithTyping(from, 'Sticker is not configured yet. Set the STICKER_URL environment variable.');
        }
      } else if (text.toLowerCase() === 'football') {
        await sendWithTyping(from, '⚽ Choose Left / Center / Right');
      } else if (text.includes('https://')) {
        await sendWithTyping(from, 'Links not allowed! ❌');
      }
    }
  });
}

startBot();
