const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const http = require('http');

let LATEST_CODE = 'Generating... Please refresh shortly';
let BOT_STATUS = 'Starting...';

// A WhatsApp pairing code can link the account, so the page requires HTTP Basic
// Authentication. Configure PAIRING_PAGE_PASSWORD in the hosting environment.
const server = http.createServer((req, res) => {
  const password = process.env.PAIRING_PAGE_PASSWORD;
  const username = process.env.PAIRING_PAGE_USER || 'pairing';
  const expectedAuth = password
    ? `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
    : null;

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');

  if (!expectedAuth) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Pairing page is locked. Configure PAIRING_PAGE_PASSWORD to enable it.');
    return;
  }

  if (req.headers.authorization !== expectedAuth) {
    res.writeHead(401, {
      'Content-Type': 'text/plain; charset=utf-8',
      'WWW-Authenticate': 'Basic realm="BRIAN BOT Pairing", charset="UTF-8"'
    });
    res.end('Authentication required.');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!doctype html>
    <html>
    <head>
      <title>BRIAN BOT Pairing</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="font-family:Arial; text-align:center; padding:30px; background:#111b21; color:white;">
      <h1>🤖 BRIAN BOT</h1>
      <p>Number: <b>${process.env.PHONE_NUMBER || 'Configured phone number'}</b></p>
      <p>Status: ${BOT_STATUS}</p>
      <div style="background:#25D366; padding:20px; border-radius:15px; font-size:32px; letter-spacing:4px; font-weight:bold; margin:20px;">
        ${LATEST_CODE}
      </div>
      <p>1. Open WhatsApp on the configured phone</p>
      <p>2. Settings &gt; Linked Devices &gt; Link a Device</p>
      <p>3. Tap "Link with phone number instead"</p>
      <p>4. Enter the latest code above</p>
      <button onclick="location.reload()" style="padding:15px 30px; font-size:18px; border-radius:10px; background:#25D366; color:white; border:none;">🔄 Refresh</button>
      <p style="color:#888; font-size:12px; margin-top:20px;">Keep this page private. The pairing code grants access to your WhatsApp account.</p>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🌐 BRIAN BOT pairing page listening on port ${PORT}`));

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
            LATEST_CODE = pairingCode;
            BOT_STATUS = '✅ Code Ready - Enter it in WhatsApp';
            console.log('📱 BRIAN BOT Pairing code generated');
          } catch (error) {
            BOT_STATUS = 'Pairing code generation failed; retrying shortly';
            console.log('Could not generate pairing code; retrying in 20 seconds.');
            setTimeout(() => {
              if (!sock.authState.creds.registered) {
                sock.requestPairingCode(digits)
                  .then((pairingCode) => {
                    LATEST_CODE = pairingCode;
                    BOT_STATUS = '✅ Code Ready - Enter it in WhatsApp';
                    console.log('📱 BRIAN BOT Pairing code generated');
                  })
                  .catch(() => {
                    BOT_STATUS = 'Pairing code generation failed';
                  });
              }
            }, 20000);
          }
        }
      }
    }

    if (connection === 'open') {
      BOT_STATUS = '✅ CONNECTED! Bot is Online';
      LATEST_CODE = '✅ CONNECTED';
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
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

      if (text.toLowerCase() === 'hi') {
        await sock.sendMessage(from, { text: 'Hello 👋 I am BRIAN BOT' });
      } else if (text.toLowerCase() === 'price') {
        await sock.sendMessage(from, { text: 'Price is 500' });
      } else if (text.toLowerCase() === 'contribution') {
        await sock.sendMessage(from, { text: 'Send to 0720864928 - Abel Bungei\nTarget: 800,000\nTotal: 424,230' });
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
