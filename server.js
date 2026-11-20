const express = require('express');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { handleCommand } = require('./handler.js');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const OWNER_NUMBER = process.env.OWNER_NUMBER || '254700000000';

let sock = null;
let status = { connected: false, user: 'Not connected' };

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['BRIAN BOT', 'Chrome', '1.0.0']
  });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u) => {
    if (u.connection === 'open') {
      status.connected = true;
      status.user = sock.user.id;
      console.log('✅ Connected:', sock.user.id);
      const msg = `🤖 *BRIAN BOT CONNECTED SUCCESSFULLY* ✅\n\nHello Boss! Bot is now online.\nType *.menu* to start.`;
      try {
        await sock.sendMessage(OWNER_NUMBER + '@s.whatsapp.net', { text: msg });
      } catch (e) { console.log(e.message); }
    }
    if (u.connection === 'close') {
      status.connected = false;
      const shouldReconnect = u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    await handleCommand(sock, messages[0]);
  });
}

app.get('/', (req, res) => {
  res.send(`<h1>BRIAN BOT</h1><p>${status.connected ? '🟢 ONLINE' : '🔴 OFFLINE'}</p><a href="/pair">Pair WhatsApp</a>`);
});

app.get('/pair', (req, res) => {
  res.send(`
  <h1>Pair BRIAN BOT</h1>
  <form id="f"><input id="num" placeholder="2547XXXXXXXX" required><button>Generate Code</button></form>
  <h1 id="code"></h1><p id="info"></p>
  <script>
  document.getElementById('f').onsubmit = async (e) => {
    e.preventEvent();
    const number = document.getElementById('num').value;
    const r = await fetch('/pair', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ number }) });
    const d = await r.json();
    if (d.error) return alert(d.error);
    document.getElementById('code').innerText = d.code;
    document.getElementById('info').innerText = 'Now open WhatsApp > Linked Devices > Link with phone number > Enter this code';
  };
  </script>`);
});

app.post('/pair', async (req, res) => {
  try {
    const number = (req.body.number || '').replace(/[^0-9]/g, '');
    if (!sock) await startBot();
    const code = await sock.requestPairingCode(number);
    res.json({ code });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.get('/api/status', (req, res) => res.json(status));

app.listen(PORT, async () => {
  console.log('Server on', PORT);
  await startBot();
});
