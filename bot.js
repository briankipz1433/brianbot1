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
const pairingNumber = (process.env.PAIR_NUMBER || process.env.PHONE_NUMBER || '').replace(/[^0-9]/g, '');
const pairingPass = process.env.PAIRING_PASS || '';
const SESSION_FOLDER = 'session';

let botStatus = 'Disconnected';
let sock = null;
let reconnectTimer = null;
let presenceTimer = null;

function authorized(req) {
  return Boolean(pairingPass) && req.get('x-pairing-pass') === pairingPass;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function getHTML() {
  const online = botStatus.toLowerCase().includes('online');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>BRIAN BOT — Pair</title>
  <style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;text-align:center;padding:20px;margin:0;background:#0b141a;color:#fff}
    main{max-width:440px;margin:24px auto;border:1px solid #FFD700;border-radius:16px;padding:24px;background:#111b21}
    .crown{font-size:48px}h1{margin:8px 0}.gold{color:#FFD700}.green{color:#25D366}
    .status{display:inline-block;background:${online ? '#25D366' : '#FF3B30'};padding:10px 14px;border-radius:20px;font-weight:bold}
    .box{margin:20px 0;padding:18px;border:1px solid #333;border-radius:12px;background:#0b141a}
    input,button{width:100%;padding:14px;border-radius:9px;font-size:16px}input{margin:12px 0;background:#000;color:#fff;border:1px solid #FFD700}
    button{border:0;background:linear-gradient(90deg,#25D366,#FFD700);font-weight:bold;cursor:pointer}
    #code{font-size:30px;letter-spacing:5px;color:#FFD700;font-weight:bold;margin:12px 0;overflow-wrap:anywhere}
    #error{color:#ff7777;margin-top:10px}.steps{text-align:left;line-height:1.8;color:#ddd}.muted{color:#aaa;font-size:12px}
  </style>
</head>
<body><main>
  <div class="crown">👑</div><h1>BRIAN <span class="gold">BOT</span></h1>
  <p class="green">👑 KING OF BOTS • GREEN + GOLD 👑</p>
  <div class="status">${online ? '✅' : '🔴'} ${escapeHtml(botStatus.toUpperCase())}</div>
  <section class="box">
    <p>🤖 <b>Bot number</b></p>
    <h2 class="green">${pairingNumber ? `+${escapeHtml(pairingNumber)}` : 'Not configured'}</h2>
    <label for="pass">Pairing password</label>
    <input id="pass" type="password" autocomplete="current-password" placeholder="Enter pairing password">
    <button id="generate" type="button">GENERATE CODE 👑</button>
    <div id="code" aria-live="polite"></div><div id="error" role="alert"></div>
    <p class="muted">The pairing code is shown only in the browser that requests it.</p>
  </section>
  <section class="steps"><b class="gold">📱 How To Link:</b><br>
    1. Generate and copy the code<br>2. Open WhatsApp on the configured bot number<br>
    3. Settings → Linked Devices → Link a Device<br>4. Tap “Link with phone number instead”<br>5. Enter the code
  </section>
  <p class="muted">👑 BRIAN BOT © 2026 • Green + Gold Edition</p>
</main>
<script>
document.getElementById('generate').addEventListener('click', async () => {
  const button = document.getElementById('generate');
  const error = document.getElementById('error');
  const code = document.getElementById('code');
  error.textContent = ''; code.textContent = ''; button.disabled = true;
  try {
    const response = await fetch('/pair', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-pairing-pass': document.getElementById('pass').value},
      cache: 'no-store'
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Pairing failed');
    code.textContent = body.code;
  } catch (e) {
    error.textContent = e.message || 'Pairing failed';
  } finally { button.disabled = false; }
});
</script></body></html>`;
}

app.get('/', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('html').send(getHTML());
});
app.get('/status', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: botStatus, pairingConfigured: Boolean(pairingNumber), pairingPasswordConfigured: Boolean(pairingPass) });
});

app.post('/pair', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!pairingPass) return res.status(503).json({ error: 'PAIRING_PASS is not configured' });
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!pairingNumber) return res.status(400).json({ error: 'PAIR_NUMBER is not configured' });
  if (!sock || sock.authState?.creds?.registered) {
    return res.status(409).json({ error: 'Session is not available for pairing' });
  }

  try {
    const code = await sock.requestPairingCode(pairingNumber);
    res.json({ code });
  } catch (error) {
    console.error('Pairing error:', error.message);
    res.status(500).json({ error: 'Could not generate pairing code' });
  }
});

app.listen(PORT, () => console.log(`BRIAN BOT web server listening on port ${PORT}`));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_FOLDER);
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
  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'connecting') botStatus = 'Connecting';

    if (connection === 'close') {
      botStatus = 'Disconnected';
      if (presenceTimer) clearInterval(presenceTimer);
      presenceTimer = null;

      const loggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
      if (loggedOut) {
        try { fs.rmSync(SESSION_FOLDER, { recursive: true, force: true }); }
        catch (error) { console.error('Could not clear session:', error.message); }
      }

      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          startBot().catch(error => {
            console.error('Reconnect error:', error.message);
            scheduleReconnect();
          });
        }, 3000);
      }
    }

    if (connection === 'open') {
      botStatus = 'Connected - ONLINE';
      if (presenceTimer) clearInterval(presenceTimer);
      try {
        await sock.sendPresenceUpdate('available');
        await sock.updateProfileStatus('👑 BRIAN BOT ONLINE 🔥');
      } catch (error) { console.error('Presence update failed:', error.message); }
      presenceTimer = setInterval(async () => {
        try { await sock.sendPresenceUpdate('available'); }
        catch (error) { console.error('Presence update failed:', error.message); }
      }, 15000);
      console.log('✅ BRIAN BOT ONLINE');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages || []) {
      if (!msg?.message || msg.key?.fromMe) continue;
      const jid = msg.key?.remoteJid;
      if (!jid) continue;
      const text = msg.message.conversation
        || msg.message.extendedTextMessage?.text
        || msg.message.imageMessage?.caption
        || '';
      const command = text.toLowerCase().trim().replace(/^[.!/]/, '');

      try {
        if (command === 'hi' || command === 'hello') {
          await sock.sendMessage(jid, { text: 'Hello 👋 I am BRIAN BOT\nType *menu* to see commands' });
        } else if (command === 'menu' || command === 'help') {
          await sock.sendMessage(jid, { text: '🤖 *BRIAN BOT MENU*\n\n• hi - Hello\n• menu - This menu\n• price - Price\n• ping - Check online\n• football - Football game' });
        } else if (command === 'ping') {
          await sock.sendMessage(jid, { text: '✅ BRIAN BOT is ONLINE ⚡' });
        } else if (command === 'price') {
          await sock.sendMessage(jid, { text: 'Price is 500' });
        } else if (command === 'football') {
          await sock.sendMessage(jid, { text: '⚽ Choose Left / Center / Right' });
        }
      } catch (error) {
        console.error('Message handling failed:', error.message);
      }
    }
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startBot().catch(error => {
      console.error('Reconnect error:', error.message);
      scheduleReconnect();
    });
  }, 5000);
}

startBot().catch(error => {
  console.error('Startup error:', error.message);
  scheduleReconnect();
});
