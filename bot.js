const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

// Set PAIR_NUMBER in your hosting provider's environment settings.
// Use country code + number only (no + sign, leading zero, or spaces), e.g. 254712345678.
const pairingNumber = process.env.PAIR_NUMBER || '';
let currentPairCode = '';
let botStatus = 'Disconnected';

app.get('/', (req, res) => {
  res.send(`<h1>BRIAN BOT</h1><h2>Status: ${botStatus}</h2><p>Pair Code: <b>${currentPairCode || 'Waiting... Check Logs'}</b></p><p>Number: ${pairingNumber}</p>`);
});

app.get('/pair', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.send(`
    <html><body style="font-family:sans-serif;text-align:center;padding:20px">
    <h1>BRIAN BOT PAIR</h1>
    <h2>Status: ${botStatus}</h2>
    <p>Number: ${pairingNumber}</p>
    <h1 style="font-size:50px;letter-spacing:5px">${currentPairCode || 'Loading...'}</h1>
    <p>WhatsApp &gt; Linked Devices &gt; Link a Device &gt; Link with phone number instead</p>
    <p>Enter this code promptly; it expires shortly.</p>
    <button onclick="location.reload()">Refresh Code</button>
    </body></html>
  `);
});

app.get('/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: botStatus, pairCode: currentPairCode, number: pairingNumber });
});

app.listen(PORT, () => console.log(`Server on ${PORT}`));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['BRIAN BOT', 'Chrome', '1.0.0'],
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  // Request a phone-number pairing code only when this session is not registered.
  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      if (!pairingNumber) {
        console.error('ERROR: Set PAIR_NUMBER in your hosting provider environment, e.g. 254712345678.');
        return;
      }

      try {
        const code = await sock.requestPairingCode(pairingNumber);
        currentPairCode = code;
        console.log(`\n====================================`);
        console.log(`PAIR CODE FOR ${pairingNumber}: ${code}`);
        console.log(`====================================\n`);
      } catch (error) {
        console.error('Pair Code Error:', error.message);
        console.log('Retrying in 10 seconds...');
        setTimeout(() => startBot().catch(console.error), 10000);
      }
    }, 3000);
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Disconnected');
      botStatus = 'Disconnected';
      currentPairCode = '';
      if (shouldReconnect) {
        startBot().catch(console.error);
      } else {
        console.log('Logged out - remove the session folder and pair again.');
      }
    } else if (connection === 'open') {
      botStatus = 'Connected - ONLINE';
      currentPairCode = '';
      console.log('BOT CONNECTED - ONLINE');

      try {
        await sock.sendPresenceUpdate('available');
        setInterval(async () => {
          try {
            await sock.sendPresenceUpdate('available');
          } catch (error) {
            console.error('Presence update failed:', error.message);
          }
        }, 15000);
      } catch (error) {
        console.error('Presence update failed:', error.message);
      }

      try {
        await sock.updateProfileStatus('BRIAN BOT IS ONLINE 🔥');
      } catch (error) {
        console.error('Could not update profile status:', error.message);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if (text === '.ping' || text === '.menu') {
      await sock.sendMessage(msg.key.remoteJid, { text: '✅ BRIAN BOT IS ONLINE 🔥' });
    }
  });
}

startBot().catch(console.error);
