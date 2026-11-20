const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

// Pair-code mode and fixed fallback number.
const METHOD = process.env.PAIR_METHOD || 'pair';
let pairingNumber = (process.env.PAIR_NUMBER || '254758690110').replace(/[^0-9]/g, '');
let currentPairCode = '';
let botStatus = 'Disconnected';
let qrCodeText = '';
let presenceTimer = null;
let reconnectTimer = null;
let reconnectAttempts = 0;

app.get('/', (req, res) => {
  res.send(`<h1>BRIAN BOT - ${botStatus}</h1><p>Method: ${METHOD}</p><a href="/pair">Pair Page</a>`);
});

app.get('/pair', (req, res) => {
  if (METHOD === 'qr') {
    res.send(`<h1>Scan QR Code</h1><p>Status: ${botStatus}</p><pre>${qrCodeText}</pre><p>Open WhatsApp > Linked Devices > Link a Device > Scan QR</p>`);
  } else {
    res.send(`<h1>Pair Code: ${currentPairCode || 'Waiting... Check Logs'}</h1><p>Status: ${botStatus}</p><p>Number: ${pairingNumber}</p><p>WhatsApp > Linked Devices > Link with phone number</p>`);
  }
});

app.get('/status', (req, res) => res.json({ status: botStatus, method: METHOD, pairCode: currentPairCode, number: pairingNumber }));
app.listen(PORT, () => console.log(`Server on ${PORT}`));

function scheduleReconnect(delay, force = false) {
  if (reconnectTimer && !force) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);

  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startBot();
  }, delay);
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    browser: ['BRIAN BOT', 'Chrome', '1.0.0'],
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  if (METHOD === 'pair' && !sock.authState.creds.registered) {
    setTimeout(async () => {
      if (!pairingNumber) {
        botStatus = 'Pair number missing';
        console.log('Set PAIR_NUMBER to a WhatsApp number, e.g. 254758690110');
        return;
      }

      try {
        currentPairCode = await sock.requestPairingCode(pairingNumber);
        botStatus = 'Waiting for pairing';
        console.log(`Pair code for ${pairingNumber}: ${currentPairCode}`);
      } catch (error) {
        botStatus = 'Pairing failed';
        console.log('Pair code error:', error.message);
      }
    }, 3000);
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && METHOD === 'qr') {
      qrCodeText = qr;
      console.log('Scan this QR in WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      if (presenceTimer) {
        clearInterval(presenceTimer);
        presenceTimer = null;
      }

      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      botStatus = loggedOut ? 'Logged out - re-pairing' : 'Disconnected';

      if (loggedOut) {
        reconnectAttempts = 0;
        currentPairCode = '';

        if (METHOD !== 'pair') {
          console.log('Logged out. Set PAIR_METHOD=pair to re-pair with PAIR_NUMBER automatically.');
          return;
        }

        console.log('Logged out. Re-pairing with configured number:', pairingNumber);
        scheduleReconnect(2000, true);
        return;
      }

      const delay = Math.min(30000, 1000 * (2 ** Math.min(reconnectAttempts, 5)));
      console.log(`Disconnected. Reconnecting in ${delay / 1000}s`);
      scheduleReconnect(delay);
    } else if (connection === 'open') {
      reconnectAttempts = 0;
      botStatus = 'Connected - Online';
      currentPairCode = '';
      console.log('BOT CONNECTED - ONLINE');

      await sock.sendPresenceUpdate('available').catch((error) => console.log(error.message));

      if (!presenceTimer) {
        presenceTimer = setInterval(() => {
          sock.sendPresenceUpdate('available').catch((error) => console.log(error.message));
        }, 20000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if (text === '.menu' || text === '.ping') {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '✅ BRIAN BOT IS ONLINE 🔥\n\n.menu - Show menu\n.ping - Check online',
      });
    }
  });
}

startBot();
