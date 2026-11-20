const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

let pairingNumber = (process.env.PAIR_NUMBER || '').replace(/[^0-9]/g, '');
let currentPairCode = '';
let botStatus = 'Disconnected';
let sock = null;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
}

function getHTML(errorMsg = '') {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="referrer" content="no-referrer">
<title>BRIAN BOT - Pair</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',sans-serif}
body{background:#0a0f0a;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:15px}
.card{background:linear-gradient(180deg,#1a241a 0%,#0f1510 100%);width:100%;max-width:420px;border-radius:22px;padding:28px 24px;text-align:center;border:2px solid #FFD700;box-shadow:0 10px 40px rgba(255,215,0,.25)}
.crown{font-size:55px}h1{color:#fff;font-size:26px;letter-spacing:2px;margin-top:6px}h1 span{color:#FFD700}
.sub{color:#25D366;font-size:12px;font-weight:700;letter-spacing:2px;margin:6px 0 16px}
.status{display:inline-block;padding:7px 16px;border-radius:20px;font-size:12px;font-weight:800;background:${botStatus.includes('ONLINE') ? '#25D366' : '#ff3b30'};color:#000;margin-bottom:18px;border:1px solid #FFD700}
.box{background:#111a11;padding:18px;border-radius:14px;margin-bottom:16px;border:1px solid #FFD700}
.box label{color:#FFD700;font-size:11px;letter-spacing:2px;font-weight:700}.code{font-size:42px;letter-spacing:8px;color:#fff;font-weight:900;margin:10px 0}.number{color:#25D366;font-size:15px;font-weight:700}
.steps{text-align:left;background:#111a11;padding:16px;border-radius:14px;margin-bottom:16px;border:1px solid #333}.steps h3{color:#FFD700;font-size:14px;margin-bottom:10px}.steps p{color:#ccc;font-size:13px;line-height:1.9}
input{width:100%;padding:13px;border-radius:10px;border:1px solid #FFD700;background:#000;color:#fff;font-size:15px;text-align:center;outline:none;margin-bottom:10px}button{width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(90deg,#25D366,#FFD700);color:#000;font-weight:900;font-size:15px;cursor:pointer}.error{background:#ff3b30;color:#fff;padding:10px;border-radius:10px;font-size:13px;margin-bottom:12px}.footer{color:#888;font-size:11px;margin-top:16px}.footer b{color:#FFD700}
</style>
</head>
<body>
<div class="card">
<div class="crown">👑</div>
<h1>BRIAN <span>BOT</span></h1>
<p class="sub">KING OF BOTS • GREEN + GOLD</p>
<div class="status">${escapeHTML(botStatus.toUpperCase())}</div>
${errorMsg ? `<div class="error">${escapeHTML(errorMsg)}</div>` : ''}
<div class="box">
<label>YOUR BOT PAIRING NUMBER</label>
<div class="number">${pairingNumber ? `+${escapeHTML(pairingNumber)}` : 'Not configured'}</div>
</div>
<div class="box">
<label>PAIRED NUMBER</label>
<div class="code">${escapeHTML(currentPairCode || 'Generating...')}</div>
</div>
<div class="steps">
<h3>How To Link:</h3>
<p><b>1.</b> Open the code above<br><b>2.</b> Open WhatsApp<br><b>3.</b> Settings → Linked Devices<br><b>4.</b> Link a Device<br><b>5.</b> Select “Link with phone number instead”<br><b>6.</b> Enter the pairing code</p>
</div>
<p class="footer">BRIAN BOT © 2026 • Green + Gold Edition</p>
</div>
</body>
</html>`;
}

app.get('/', (_req, res) => res.set('Cache-Control', 'no-store').send(getHTML()));
app.get('/pair', (_req, res) => res.set('Cache-Control', 'no-store').send(getHTML()));
app.get('/status', (_req, res) => res.set('Cache-Control', 'no-store').json({
  status: botStatus,
  pairingNumber,
  pairingCode: currentPairCode
}));

app.listen(PORT, () => console.log(`Server on ${PORT}`));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['BRIAN BOT', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true
  });

  sock.ev.on('creds.update', saveCreds);

  if (!sock.authState.creds.registered && pairingNumber) {
    setTimeout(async () => {
      try {
        currentPairCode = await sock.requestPairingCode(pairingNumber);
        console.log(`\nBRIAN BOT PAIR CODE FOR ${pairingNumber}: ${currentPairCode}\n`);
      } catch (error) {
        console.log('Pair error:', error.message);
      }
    }, 3000);
  }

  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const loggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
      botStatus = 'Disconnected';
      currentPairCode = '';

      if (loggedOut) {
        console.log('Logged out - deleting session and restarting');
        fs.rmSync('session', { recursive: true, force: true });
        setTimeout(startBot, 2000);
      } else {
        setTimeout(startBot, 3000);
      }
    } else if (connection === 'open') {
      botStatus = 'Connected - ONLINE';
      currentPairCode = '';
      console.log('BRIAN BOT CONNECTED - ONLINE');

      try {
        await sock.sendPresenceUpdate('available');
      } catch {}

      setInterval(async () => {
        try { await sock.sendPresenceUpdate('available'); } catch {}
      }, 15000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key?.fromMe) return;

    const jid = msg.key.remoteJid;
    const text = msg.message.conversation
      || msg.message.extendedTextMessage?.text
      || '';

    if (text.toLowerCase() === 'pair' || text.toLowerCase() === 'code') {
      await sock.sendMessage(jid, {
        text: `BRIAN BOT\n\nPairing code: ${currentPairCode || 'Generating...'}\n\nOpen: https://brianbot1.onrender.com/pair`
      });
    }

    if (text === '.ping') {
      await sock.sendMessage(jid, { text: 'BRIAN BOT IS ONLINE' });
    }
  });
}

startBot();
