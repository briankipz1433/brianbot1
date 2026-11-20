const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const http = require('http');
const { URL } = require('url');
const { handleCommand } = require('./handler.js');

const OWNER_NUMBER = process.env.OWNER_NUMBER || '';
const PORT = Number(process.env.PORT) || 3000;

let sock = null;
let LATEST_CODE = 'No pairing code yet';
let BOT_STATUS = 'Starting...';
let LAST_UPDATE = new Date().toISOString();
let pairingRequestInProgress = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function updateStatus(status) {
  BOT_STATUS = status;
  LAST_UPDATE = new Date().toISOString();
}

async function requestPairingCode(phoneNumber) {
  const digits = String(phoneNumber || '').replace(/[^0-9]/g, '');
  if (digits.length < 8 || digits.length > 15) {
    throw new Error('Enter a valid phone number including country code (8–15 digits).');
  }
  if (!sock || sock.authState?.creds?.registered) {
    throw new Error('The WhatsApp connection is not ready for pairing. Try again shortly.');
  }
  if (pairingRequestInProgress) {
    throw new Error('A pairing code request is already in progress.');
  }

  pairingRequestInProgress = true;
  try {
    const code = await sock.requestPairingCode(digits);
    LATEST_CODE = code;
    updateStatus('Pairing code ready — enter it in WhatsApp');
    return code;
  } finally {
    pairingRequestInProgress = false;
  }
}

function renderPage(message = '') {
  const phoneNumber = process.env.PHONE_NUMBER || '';
  const messageHtml = message ? `<p role="status">${escapeHtml(message)}</p>` : '';
  return `<!doctype html>
<html>
<head>
  <title>BRIAN BOT</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Cache-Control" content="no-store">
</head>
<body style="font-family:Arial,sans-serif;max-width:680px;margin:40px auto;padding:20px;background:#111b21;color:white;">
  <h1>🤖 BRIAN BOT</h1>
  <p><b>Status:</b> ${escapeHtml(BOT_STATUS)}</p>
  <p><b>Last update:</b> ${escapeHtml(LAST_UPDATE)}</p>
  <p><b>Last pairing code:</b> <strong>${escapeHtml(LATEST_CODE)}</strong></p>
  ${messageHtml}
  <h2>Pair WhatsApp</h2>
  <form method="POST" action="/pair">
    <label for="number">Phone number with country code</label><br>
    <input id="number" name="number" type="tel" inputmode="numeric" autocomplete="tel" required maxlength="20" placeholder="2547XXXXXXXX" value="${escapeHtml(phoneNumber)}" style="padding:10px;margin:8px 0;">
    <button type="submit" style="padding:10px 16px;">Get pairing code</button>
  </form>
  <p>In WhatsApp, open Linked Devices, choose Link with phone number instead, then enter the code.</p>
  <p><a href="/" style="color:#25D366;">Refresh status</a></p>
  <p style="color:#aaa;font-size:12px;">Keep this page and pairing code private. A pairing code can link a device to your WhatsApp account.</p>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (url.pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      connected: Boolean(sock?.user),
      status: BOT_STATUS,
      lastUpdate: LAST_UPDATE,
      uptime: process.uptime(),
      service: 'live'
    }));
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/pair')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderPage());
    return;
  }

  if (req.method === 'POST' && url.pathname === '/pair') {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 4096) req.destroy();
    });
    req.on('end', async () => {
      try {
        const number = new URLSearchParams(body).get('number');
        const code = await requestPairingCode(number);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderPage(`Your pairing code is ${code}. Enter it in WhatsApp.`));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderPage(error.message || 'Could not generate a pairing code.'));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found.');
});

server.listen(PORT, () => console.log(`🌐 BRIAN BOT pairing page listening on port ${PORT}`));

async function startBot() {
  // Reuse the auth directory so saved WhatsApp credentials continue to work.
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['BRIAN BOT', 'Chrome', '1.0.0'],
    syncFullHistory: false
  });
  const currentSock = sock;
  currentSock.ev.on('creds.update', saveCreds);

  currentSock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;
    if (currentSock !== sock) return;

    if (qr) {
      qrcode.generate(qr, { small: true });
      if (!currentSock.authState?.creds?.registered && process.env.PHONE_NUMBER) {
        try {
          await requestPairingCode(process.env.PHONE_NUMBER);
          console.log('📱 BRIAN BOT pairing code generated');
        } catch (error) {
          updateStatus('Pairing code unavailable; check the number and try again');
          console.log('Could not generate pairing code.');
        }
      }
    }

    if (connection === 'open') {
      updateStatus('Connected');
      LATEST_CODE = 'Connected';
      console.log('✅ BRIAN BOT Connected as:', currentSock.user?.id);

      const connectedMsg = `🤖 *BRIAN BOT CONNECTED SUCCESSFULLY* ✅

Hello Boss! 👋
Your bot is now live and ready.

*Bot Name:* BRIAN BOT
*Status:* 🟢 Online
*Prefix:* .
*Total Commands:* 1000
*Time:* ${new Date().toLocaleString()}

Type *.menu* to see all commands.
Type *.ping* to test me.

_Powered by BRIAN BOT_`;

      try {
        const ownerDigits = OWNER_NUMBER.replace(/[^0-9]/g, '');
        if (ownerDigits.length >= 8 && ownerDigits.length <= 15) {
          const ownerJid = `${ownerDigits}@s.whatsapp.net`;
          await currentSock.sendMessage(ownerJid, { text: connectedMsg });

          const selfJid = currentSock.user?.id;
          const selfNumber = selfJid?.split('@')[0].split(':')[0];
          if (selfJid && selfNumber !== ownerDigits) {
            await currentSock.sendMessage(selfJid, { text: connectedMsg });
          }
          console.log('✅ Connected message sent to WhatsApp');
        } else {
          console.log('Set OWNER_NUMBER to your full number with country code to receive connection notifications.');
        }
      } catch (error) {
        console.log('Could not send connected message:', error.message);
      }
    }

    if (connection === 'close') {
      updateStatus('Disconnected');
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut) {
        setTimeout(() => startBot().catch(() => updateStatus('Reconnect failed')), 3000);
      } else {
        sock = null;
      }
    }
  });

  currentSock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const from = msg.key.remoteJid;
      if (!from) continue;
      try {
        await currentSock.readMessages([msg.key]);
        await handleCommand(currentSock, msg);
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (text.toLowerCase() === 'hi') {
          await currentSock.sendMessage(from, { text: 'Hello 👋 I am BRIAN BOT' });
        } else if (text.toLowerCase() === 'price') {
          await currentSock.sendMessage(from, { text: 'Price is 500' });
        } else if (text.toLowerCase() === 'contribution') {
          await currentSock.sendMessage(from, { text: 'Send to 0720864928 - Abel Bungei\nTarget: 800,000\nTotal: 424,230' });
        } else if (text.toLowerCase() === 'sticker') {
          const stickerUrl = process.env.STICKER_URL;
          if (stickerUrl) {
            await currentSock.sendMessage(from, { sticker: { url: stickerUrl } });
          } else {
            await currentSock.sendMessage(from, { text: 'Sticker is not configured yet.' });
          }
        } else if (text.toLowerCase() === 'football') {
          await currentSock.sendMessage(from, { text: '⚽ Choose Left / Center / Right' });
        } else if (text.includes('https://')) {
          await currentSock.sendMessage(from, { text: 'Links not allowed! ❌' });
        }
      } catch (error) {
        console.error('Could not process message:', error.message);
      }
    }
  });
}

startBot().catch((error) => {
  updateStatus('Startup failed');
  console.error('Could not start BRIAN BOT:', error.message);
});
