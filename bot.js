// BRIAN BOT v2 - Render Fixed - QR + Pairing Code on Website
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;
const PHONE_NUMBER = process.env.PHONE_NUMBER || '2547XXXXXXXX'; // CHANGE to your number, no +

let lastQR = '';
let pairingCode = '';
let sock = null;
let isConnected = false;

app.get('/', (req, res) => {
  res.send(`
  <html><body style="font-family:sans-serif;text-align:center;padding:20px;background:#111;color:#fff">
    <h1>👑 BRIAN BOT IS RUNNING</h1>
    <p>Status: <b style="color:${isConnected ? 'lime' : 'orange'}">${isConnected ? '✅ CONNECTED TO WHATSAPP' : '⏳ WAITING TO LINK'}</b></p>
    <p>Pairing Code: <b style="font-size:28px;letter-spacing:3px">${pairingCode || 'Generating... refresh in 10s'}</b></p>
    <p>Phone: ${PHONE_NUMBER}</p>
    <hr>
    <a href="/qr" style="background:green;color:white;padding:12px 20px;text-decoration:none;border-radius:8px">📷 VIEW QR CODE</a>
    <br><br>
    <p>How to link:</p>
    <p>1. WhatsApp > Settings > Linked Devices > Link with Phone Number</p>
    <p>2. Enter Pairing Code above</p>
    <p>OR scan QR at /qr</p>
    <p><small>Project Atomic ࿐</small></p>
  </body></html>
  `);
});

app.get('/qr', async (req, res) => {
  if (isConnected) return res.send('<h1>✅ Already Connected!</h1><a href="/">Back</a>');
  if (!lastQR) return res.send('<h1>⏳ No QR yet. Wait 10 sec and refresh.</h1><a href="/qr">Refresh</a><br><a href="/">Home</a>');
  try {
    const qrImage = await QRCode.toDataURL(lastQR);
    res.send(`<html><body style="text-align:center"><h1>Scan This QR</h1><img src="${qrImage}" style="width:300px"/><br><p>WhatsApp > Linked Devices > Link Device > Scan</p><a href="/qr">Refresh</a></body></html>`);
  } catch (e) { res.send('QR Error: ' + e.message); }
});

app.get('/pair', (req, res) => res.json({ pairingCode, phone: PHONE_NUMBER, connected: isConnected }));

app.listen(PORT, () => console.log(`🌐 Web on port ${PORT}`));

async function startBrian() {
  const { state, saveCreds } = await useMultiFileAuthState('brian_auth');
  const { version } = await fetchLatestBaileysVersion();
  console.log('Using Baileys v', version);

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false,
    browser: ['Brian Bot', 'Chrome', '1.0'],
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      lastQR = qr;
      console.log('✅ New QR generated - check /qr');
    }
    if (connection === 'close') {
      isConnected = false;
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Disconnected. Reconnect?', shouldReconnect);
      if (shouldReconnect) {
        setTimeout(startBrian, 3000);
      } else {
        console.log('LOGGED OUT - Delete brian_auth and relink');
        try { fs.rmSync('brian_auth', { recursive: true, force: true }); } catch {}
        setTimeout(startBrian, 3000);
      }
    } else if (connection === 'open') {
      isConnected = true;
      lastQR = '';
      pairingCode = '';
      console.log('✅ BRIAN BOT IS ONLINE!');
    }
  });

  // Pairing Code - Only if not registered
  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        if (!sock.authState.creds.registered) {
          pairingCode = await sock.requestPairingCode(PHONE_NUMBER);
          console.log('🔑 PAIRING CODE:', pairingCode);
        }
      } catch (e) { console.log('Pairing error:', e.message); }
    }, 5000);
  }

  // MESSAGES
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
    const lower = text.toLowerCase();
    console.log('MSG:', from, text);

    let reply = '';

    if (lower === 'hi' || lower === 'hello' || lower === 'menu' || lower === '.menu' || lower === '.owner') {
      reply = `┏─────────────────────┓\n   ✨ *OWNER PANEL* ✨\n┗─────────────────────┛\n\n┌─────────────────────┐\n│ ◦ .menu\n│ ◦ .vpn\n│ ◦ .book\n│ ◦ .free\n│ ◦ .price\n│ ◦ .english\n│ ◦ .kiswahili\n│ ◦ .kalenjin\n│ ◦ .verse\n│ ◦ .sabbath\n│ ◦ .human\n└─────────────────────┘\n\n*𝛲𝑅𝛩𝐽𝛯𝐶亇 𝜟亇𝛩𝛭𝐼𝐶 ࿐*\nSelect a command and type it.`;
    }
    else if (lower === '.vpn' || lower === 'vpn') {
      reply = `┏─────────────────────┓\n   🔥 *VPN MENU* 🔥\n┗─────────────────────┛\n\n┌─────────────────────┐\n│ ◦ .free - Free Test\n│ ◦ .price - Price List\n│ ◦ .pay - M-Pesa\n└─────────────────────┘\n\n*VPNTECH ࿐*`;
    }
    else if (lower === '.book' || lower === 'book' || lower === 'kitabu') {
      reply = `┏─────────────────────┓\n   📖 *BOOK MENU* 📖\n┗─────────────────────┛\n\n┌─────────────────────┐\n│ ◦ .english\n│ ◦ .kiswahili\n│ ◦ .kalenjin\n│ ◦ .verse\n│ ◦ .sabbath\n└─────────────────────┘\n\n*ADVENTIST ࿐*`;
    }
    else if (lower === '.free' || lower === 'free') {
      const user = 'brian' + Math.floor(Math.random() * 99999);
      reply = `🔥 FREE VPN TEST - VpnTech\n\nHost: vpntech.duckdns.org\nUser: ${user}\nPass: 1234\nPort: 443\nValid: 1 Hour\n\nType .price to buy full account.`;
    }
    else if (lower === '.price' || lower === 'price' || lower === 'bei') {
      reply = `💰 VPNTECH PRICE\n\n1 Day: Ksh 20\n3 Days: Ksh 50\n7 Days: Ksh 100\n30 Days: Ksh 250\n\nPay via M-Pesa, send screenshot.\nType .free to test first!`;
    }
    else if (lower === '.english') {
      reply = `📖 English Books:\n1. Steps to Christ\n2. Great Controversy\nLink: https://egwwritings.org`;
    }
    else if (lower === '.kiswahili') {
      reply = `📖 Kiswahili:\n1. Hatua za Kwenda kwa Kristo\n2. Vita Kuu\nLink: https://egwwritings.org`;
    }
    else if (lower === '.kalenjin') {
      reply = `Chamgei! 📖\nOroret ne bo Kristo - Somani tugul.\nKalenjin booklet coming soon.`;
    }
    else if (lower === '.human' || lower === 'human') {
      reply = `Sawa, Brian mwenyewe anakujia... 👑 Please wait 1 min.`;
    }

    if (reply) {
      await sock.sendMessage(from, { text: reply });
    }
  });
}

startBrian();
