const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const fs = require('fs');

const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false }));

const PORT = Number(process.env.PORT) || 3000;
const PAIRING_PASS = process.env.PAIRING_PASS || '';
const pairingNumber = (process.env.PAIR_NUMBER || '').replace(/[^0-9]/g, '');

let currentPairCode = '';
let botStatus = 'Disconnected';
let sock = null;
let reconnectTimer = null;

function authorized(req) {
  return Boolean(PAIRING_PASS) && req.get('x-pairing-pass') === PAIRING_PASS;
}

const page = () => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BRIAN BOT</title><style>body{margin:0;background:#111;color:#eee;font-family:system-ui;text-align:center}main{max-width:420px;margin:10vh auto;padding:24px;border:1px solid #25D366;border-radius:16px}input,button{box-sizing:border-box;width:100%;padding:12px;margin-top:10px;border-radius:8px;border:1px solid #444}input{background:#181818;color:#fff}button{background:#25D366;color:#111;font-weight:bold}.code{font-size:42px;letter-spacing:6px}</style></head>
<body><main><h1>BRIAN BOT</h1><p>Status: ${botStatus}</p>
<form id="f"><input id="p" type="password" placeholder="Pairing password" required><button type="submit">Generate code</button></form>
<div id="code"></div><pre id="steps">WhatsApp → Linked devices → Link a device → Link with phone number instead</pre></main>
<script>document.getElementById('f').onsubmit=async e=>{e.prevent=e=>e.preventDefault();e.prevent();const r=await fetch('/pair',{method:'POST',headers:{'x-pairing-pass':document.getElementById('p').value}});const d=await r.json();document.getElementById('code').innerHTML=d.code?'<p>Your pairing code</p><div class="code">'+d.code+'</div>':'<p>'+((d.error||'Generating')+'</p>')};</script></body></html>`;

app.get('/', (_req, res) => res.type('html').send(page()));

app.get('/status', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: botStatus, pairingConfigured: Boolean(pairingNumber) });
});

app.post('/pair', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!PAIRING_PASS) return res.status(503).json({ error: 'PAIRING_PASS is not configured' });
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!pairingNumber) return res.status(400).json({ error: 'PAIR_NUMBER is not configured' });
  if (!sock || sock.authState?.creds?.registered) return res.status(409).json({ error: 'Session is not available for pairing' });

  try {
    currentPairCode = await sock.requestPairingCode(pairingNumber);
    res.json({ code: currentPairCode });
  } catch (error) {
    res.status(500).json({ error: 'Could not generate pairing code' });
  }
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

async function startBot() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['BRIAN BOT', 'Chrome', '1.0.0'],
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async update => {
    if (update.connection === 'close') {
      botStatus = 'Disconnected';
      currentPairCode = '';
      const statusCode = update.lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        fs.rmSync('./session', { recursive: true, force: true });
      }
      reconnectTimer = setTimeout(() => startBot().catch(error => console.error(error.message)), 5000);
    } else if (update.connection === 'open') {
      botStatus = 'Connected - ONLINE';
      currentPairCode = '';
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg?.message || msg.key?.fromMe) return;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const jid = msg.key.remoteJid;
    if (text.trim().toLowerCase() === '.ping') {
      await sock.sendMessage(jid, { text: '✅ Pong!' });
    } else if (text.trim().toLowerCase() === '.menu') {
      await sock.sendMessage(jid, { text: '🤖 BRIAN BOT\n\n.menu — show commands\n.ping — test connection' });
    }
  });
}

startBot().catch(error => {
  console.error(error.message);
  reconnectTimer = setTimeout(() => startBot().catch(() => {}), 5000);
});
