const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const pino = require('pino');
const readline = require('readline');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CHOOSE METHOD HERE =====
// Change this in Render -> Environment -> PAIR_METHOD
// "qr" = Scan QR Code
// "pair" = Enter Number + Pair Code
const METHOD = process.env.PAIR_METHOD || "qr";
let pairingNumber = process.env.PAIR_NUMBER || ""; // e.g 254712345678
let currentPairCode = "";
let botStatus = "Disconnected";
let qrCodeText = "";

app.get('/', (req, res) => {
  res.send(`<h1>BRIAN BOT - ${botStatus}</h1><p>Method: ${METHOD}</p><a href="/pair">Pair Page</a>`);
});

app.get('/pair', (req, res) => {
  if (METHOD === "qr") {
    res.send(`<h1>Scan QR Code</h1><p>Status: ${botStatus}</p><p>Check Render Logs for QR, or use this:</p><pre>${qrCodeText}</pre><p>Open WhatsApp > Linked Devices > Link a Device > Scan QR</p>`);
  } else {
    res.send(`<h1>Pair Code: ${currentPairCode || "Waiting... Check Logs"}</h1><p>Status: ${botStatus}</p><p>Number: ${pairingNumber}</p><p>WhatsApp > Linked Devices > Link with phone number</p>`);
  }
});

app.get('/status', (req, res) => res.json({ status: botStatus, method: METHOD, pairCode: currentPairCode }));
app.listen(PORT, () => console.log(`Server on ${PORT}`));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true, // Show QR in logs
    auth: state,
    browser: ['BRIAN BOT', 'Chrome', '1.0.0'],
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  // ===== IF USING PAIR CODE =====
  if (METHOD === "pair" && !sock.authState.creds.registered) {
    // Wait 3 sec for socket to be ready
    setTimeout(async () => {
      if (!pairingNumber) {
        console.log("❌ Set PAIR_NUMBER in Render Env, e.g 254712345678");
        return;
      }
      try {
        const code = await sock.requestPairingCode(pairingNumber);
        currentPairCode = code;
        console.log(`\n✅ YOUR PAIR CODE FOR ${pairingNumber}: ${code}\n`);
      } catch (e) {
        console.log("Pair Code Error:", e.message);
      }
    }, 3000);
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && METHOD === "qr") {
      qrCodeText = qr;
      console.log("📷 SCAN THIS QR IN RENDER LOGS:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Disconnected, Reconnect?', shouldReconnect);
      botStatus = "Disconnected";
      if (shouldReconnect) {
        startBot();
      } else {
        console.log("Logged Out - Delete session folder and re-pair");
      }
    } else if (connection === 'open') {
      botStatus = "Connected - Online";
      console.log('✅ BOT CONNECTED - ONLINE');
      // ===== MAKE STATUS ONLINE =====
      await sock.sendPresenceUpdate('available');
      // Keep online every 20 sec
      setInterval(() => sock.sendPresenceUpdate('available'), 20000);
    }
  });

  // ===== SIMPLE COMMAND TO TEST =====
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    if (text === ".menu" || text === ".ping") {
      await sock.sendMessage(msg.key.remoteJid, { text: "✅ BRIAN BOT IS ONLINE 🔥\n\n.menu - Show menu\n.ping - Check online" });
    }
  });
}

startBot();
