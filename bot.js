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
const pairingPass = process.env.PAIRING_PASS || '';
let currentPairCode = '';
let botStatus = 'Disconnected';
let sock = null;
let presenceTimer = null;

app.use(express.json());

function authorized(req) {
  return pairingPass && req.get('x-pairing-pass') === pairingPass;
}

const getHTML = () => `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>👑 BRIAN BOT - Pair</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',sans-serif}
body{background:#0a0f0a;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:15px}
.card{background:linear-gradient(180deg,#1a241a 0%,#0f1510 100%);width:100%;max-width:420px;border-radius:22px;padding:28px 24px;text-align:center;border:2px solid #FFD700;box-shadow:0 10px 40px rgba(255,215,0,.25)}
.crown{font-size:55px;line-height:1}
h1{color:#fff;font-size:26px;letter-spacing:2px;margin-top:6px}
h1 span{color:#FFD700}
.sub{color:#25D366;font-size:12px;font-weight:700;letter-spacing:2px;margin:6px 0 16px}
.status{display:inline-block;padding:7px 16px;border-radius:20px;font-size:12px;font-weight:800;background:${botStatus.includes('ONLINE') ? '#25D366' : '#ff3b30'};color:${botStatus.includes('ONLINE') ? '#000' : '#fff'};margin-bottom:18px;border:1px solid #FFD700}
.box{background:#111a11;padding:18px;border-radius:14px;margin-bottom:16px;border:1px solid #FFD700}
.box label{color:#FFD700;font-size:11px;letter-spacing:2px;font-weight:700}
.code{font-size:42px;letter-spacing:8px;color:#fff;font-weight:900;margin:10px 0;text-shadow:0 0 15px rgba(255,215,0,.6)}
.number{color:#25D366;font-size:15px;font-weight:700}
.steps{text-align:left;background:#111a11;padding:16px;border-radius:14px;margin-bottom:16px;border:1px solid #333}
.steps h3{color:#FFD700;font-size:14px;margin-bottom:10px}
.steps p{color:#ccc;font-size:13px;line-height:1.9}
.steps b{color:#fff}
input{width:100%;padding:13px;border-radius:10px;border:1px solid #FFD700;background:#000;color:#fff;font-size:15px;text-align:center;outline:none;margin-bottom:10px}
button{width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(90deg,#25D366,#FFD700);color:#000;font-weight:900;font-size:15px;cursor:pointer}
.footer{color:#888;font-size:11px;margin-top:16px}
.footer b{color:#FFD700}
.gold-line{height:2px;background:linear-gradient(90deg,transparent,#FFD700,transparent);margin:14px 0}
#error{color:#ff6b6b;font-size:13px;margin-top:10px}
</style>
</head>
<body>
<div class="card">
  <div class="crown">👑</div>
  <h1>BRIAN <span>BOT</span></h1>
  <p class="sub">👑 KING OF BOTS • GREEN + GOLD 👑</p>
  <div class="status">${botStatus.includes('ONLINE') ? '🟢' : '🔴'} ${botStatus.toUpperCase()}</div>

  ${currentPairCode ? `
  <div class="box">
    <label>✨ YOUR PAIR CODE ✨</label>
    <div class="code">${currentPairCode}</div>
    <div class="number">For: +${pairingNumber}</div>
  </div>
  ` : `
  <div class="box">
    <label>👑 AUTHORIZED PAIRING</label>
    <input id="pass" type="password" autocomplete="current-password" placeholder="Pairing password">
    <button id="generate" type="button">GENERATE CODE 👑</button>
    <div id="error"></div>
  </div>
  `}

  <div class="steps">
    <h3>📱 How To Link:</h3>
    <p><b>1.</b> Generate and copy the code<br>
    <b>2.</b> Open WhatsApp on the configured bot number<br>
    <b>3.</b> Settings → Linked Devices<br>
    <b>4.</b> Link a Device<br>
    <b>5.</b> Tap <b>"Link with phone number instead"</b><br>
    <b>6.</b> Enter the code and connect</p>
  </div>

  <div class="gold-line"></div>
  <p class="footer">👑 <b>BRIAN BOT</b> © 2026 • Green + Gold Edition</p>
</div>
<script>
${currentPairCode ? '' : `
document.getElementById('generate').onclick = async () => {
  const pass = document.getElementById('pass').value;
  const error = document.getElementById('error');
  error.textContent = '';
  try {
    const response = await fetch('/pair', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-pairing-pass': pass}
    });
    if (!response.ok) {
      const body = await response.json();
      error.textContent = body.error || 'Pairing failed';
      return;
    }
    location.reload();
  } catch {
    error.textContent = 'Pairing failed';
  }
};
`}
</script>
</body>
</html>
`;

app.get('/', (_req, res) => res.type('html').send(getHTML()));
app.get('/pair', (_req, res) => res.type('html').send(getHTML()));

app.get('/status', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    status: botStatus,
    pairingConfigured: Boolean(pairingNumber),
    pairingPasswordConfigured: Boolean(pairingPass)
  });
});

app.post('/pair', async (_req, res) => {
  res.set('Cache-Control', 'no-store');

  if (!pairingPass) {
    return res.status(503).json({ error: 'PAIRING_PASS is not configured' });
  }
  if (!authorized(_req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!pairingNumber) {
    return res.status(400).json({ error: 'PAIR_NUMBER is not configured' });
  }
  if (!sock || sock.authState?.creds?.registered) {
    return res.status(409).json({ error: 'Session is not available for pairing' });
  }

  try {
    currentPairCode = await sock.requestPairingCode(pairingNumber);
    res.json({ code: currentPairCode });
  } catch (error) {
    console.error('Pairing error:', error.message);
    res.status(500).json({ error: 'Could not generate pairing code' });
  }
});

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

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      botStatus = 'Disconnected';
      currentPairCode = '';

      const loggedOut =
        lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        try {
          fs.rmSync('session', { recursive: true, force: true });
        } catch (error) {
          console.error(error.message);
        }
      }

      setTimeout(() => startBot(), 3000);
    }

    if (connection === 'open') {
      botStatus = 'Connected - ONLINE';
      currentPairCode = '';

      if (presenceTimer) clearInterval(presenceTimer);

      try {
        await sock.sendPresenceUpdate('available');
        await sock.updateProfileStatus('👑 BRIAN BOT ONLINE 🔥');
      } catch (error) {
        console.error(error.message);
      }

      presenceTimer = setInterval(async () => {
        try {
          await sock.sendPresenceUpdate('available');
        } catch (error) {
          console.error(error.message);
        }
      }, 15000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];

    if (!msg?.message || msg.key?.fromMe) return;

    const jid = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    if (text.trim().toLowerCase() === '.ping') {
      await sock.sendMessage(jid, { text: '✅ Pong!' });
    }

    if (text.trim().toLowerCase() === '.menu') {
      await sock.sendMessage(jid, {
        text: '🤖 BRIAN BOT\n\n.menu — show commands\n.ping — test connection'
      });
    }
  });
}

startBot().catch(error => {
  console.error(error.message);
  setTimeout(() => startBot().catch(() => {}), 5000);
});
