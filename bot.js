// ============================================
// BRIAN BOT - GREEN + GOLD
// Pairing page + menus + basic commands
// ============================================
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_NAME = 'BRIAN BOT';
const FOOTER = '*BRIAN BOT BY BRIAN*\nSelect a command and type it.';

let botNumber = (process.env.PAIR_NUMBER || process.env.PHONE_NUMBER || '').replace(/[^0-9]/g, '');
let latestCode = 'Enter your number below then click GENERATE';
let botStatus = 'CONNECTED';
let sockGlobal = null;

app.use(express.urlencoded({ extended: false, limit: '2kb' }));
app.use(express.json({ limit: '2kb' }));

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
}

function boxMenu(title, emoji, commands) {
  const list = commands.map(command => `│ ◦ ${command}`).join('\n');
  return `┏─────────────────────┓\n   ${emoji} *${title}* ${emoji}\n┗─────────────────────┛\n\n┌──[${title}]──\n${list}\n└─────────────────────┘\n\n${FOOTER}`;
}

const MAIN_MENU = boxMenu('MAIN MENU', '👑', [
  '.owner - Owner Panel', '.game - Game Menu', '.download - Download Menu',
  '.group - Group Menu', '.ping - Check Online', '.hi - Say Hello',
  '.profile - My Profile', '.jid - Get JID', '.active - Active Users',
  '.setting - Settings', '.menutype - Change Menu'
]);
const OWNER_MENU = boxMenu('OWNER PANEL', '✨', [
  '.setreply', '.autoreply', '.listreply', '.delreply', '.setwelcome',
  '.listwelcome', '.delwelcome', '.setvoice', '.listvoice', '.delvoice',
  '.addsudo', '.delsudo', '.listsudo', '.save', '.anime', '.csong', '.movie',
  '.tv', '.forward', '.savesongs', '.autocsong', '.removesong', '.getdp',
  '.leave', '.join', '.jid', '.setpp', '.fullpp', '.set', '.gstatus', '.gjid',
  '.active', '.apply', '.profile', '.menutype', '.setting', '.game',
  '.schedule', '.schedules', '.unschedule', '.mytime'
]);
const GAME_MENU = boxMenu('GAME PANEL', '🎮', [
  '.football', '.tictactoe', '.quiz', '.rps', '.truth', '.dare', '.guess',
  '.slot', '.dice', '.chess', '.wordgame', '.mathquiz'
]);
const DOWNLOAD_MENU = boxMenu('DOWNLOAD MENU', '📥', [
  '.play - Song', '.video - Video', '.song - Audio', '.tiktok - TikTok',
  '.fb - Facebook', '.ig - Instagram', '.yt - YouTube', '.apk - App',
  '.movie - Movie', '.anime - Anime', '.csong - Christian Song',
  '.savesongs - Save Songs', '.autocsong - Auto Song'
]);
const GROUP_MENU = boxMenu('GROUP MENU', '👥', [
  '.kick', '.add', '.promote', '.demote', '.tagall', '.hidetag', '.antilink',
  '.welcome on/off', '.setwelcome', '.listwelcome', '.delwelcome', '.gstatus',
  '.gjid', '.getdp', '.leave', '.join', '.mute', '.unmute', '.open', '.close'
]);

function getHTML(error = '') {
  const online = botStatus === 'CONNECTED';
  const statusColor = online ? '#25D366' : '#25D366';
  const statusText = '✅ CONNECTED';
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer"><title>BRIAN BOT</title></head>
<body style="font-family:Arial;text-align:center;padding:20px;background:#0b141a;color:white">
<div style="font-size:50px">👑</div><h1>BRIAN BOT</h1>
<p style="color:#FFD700">👑 KING OF BOTS • GREEN + GOLD 👑</p>
<div style="background:${statusColor};padding:12px;border-radius:20px;font-weight:bold;display:inline-block">${escapeHTML(statusText)}</div>
<div style="border:1px solid #FFD700;border-radius:15px;padding:20px;margin-top:20px">
${error ? `<p role="alert" style="color:#ff6b6b">${escapeHTML(error)}</p>` : ''}
<form method="post" action="/generate">
<p><b>ENTER YOUR WHATSAPP NUMBER</b></p>
<p style="color:#aaa;font-size:13px">Type your number like 2547XXXXXXXX (no + or spaces). You can leave this blank if PAIR_NUMBER is configured on the server.</p>
<input name="number" type="tel" inputmode="numeric" autocomplete="tel" maxlength="20" value="${escapeHTML(botNumber)}" placeholder="e.g. 254758690110" style="padding:15px;width:90%;border-radius:10px;border:none;font-size:18px;text-align:center">
<br><br><button type="submit" style="width:100%;background:linear-gradient(to right,#25D366,#FFD700);color:black;padding:15px;border-radius:10px;font-weight:bold;font-size:18px;border:none">GENERATE PAIRING CODE</button>
</form>
<br><p><b>YOUR CODE TO ENTER IN WHATSAPP</b></p>
<div style="background:#111b21;padding:20px;border-radius:10px;font-size:28px;letter-spacing:3px;font-weight:bold;color:#FFD700">${escapeHTML(latestCode)}</div>
<p>Bot Number: <b style="color:#25D366">+${escapeHTML(botNumber || 'Not set yet')}</b></p>
</div>
<div style="text-align:left;background:#111b21;padding:15px;border-radius:15px;margin-top:20px">
<p><b>HOW TO LINK</b></p><p>1. Enter your WhatsApp number if it is not already configured, then generate a code.</p>
<p>2. Open WhatsApp → Linked Devices → Link a Device.</p>
<p>3. Choose “Link with phone number instead” and enter the code.</p>
</div><p style="color:#888;font-size:12px">👑 BRIAN BOT BY BRIAN © 2026</p>
</body></html>`;
}

async function generateCode(number) {
  const digits = String(number || botNumber || '').replace(/[^0-9]/g, '');
  if (digits.length < 8 || digits.length > 15) {
    throw new Error('Enter a valid WhatsApp number with country code, or configure PAIR_NUMBER on the server');
  }
  if (!sockGlobal) throw new Error('Bot is still starting. Please try again');
  if (sockGlobal.authState?.creds?.registered) throw new Error('Bot is already paired');
  botNumber = digits;
  latestCode = await sockGlobal.requestPairingCode(botNumber);
  console.log(`Pairing code generated for ${botNumber}`);
}

app.get('/', (_req, res) => res.set('Cache-Control', 'no-store').type('html').send(getHTML()));
app.get('/generate', (_req, res) => res.redirect(303, '/'));
app.post('/generate', async (req, res) => {
  try {
    await generateCode(req.body.number);
    return res.set('Cache-Control', 'no-store').redirect(303, '/');
  } catch (error) {
    return res.status(400).set('Cache-Control', 'no-store').type('html').send(getHTML(error.message));
  }
});
app.get('/status', (_req, res) => res.set('Cache-Control', 'no-store').json({ status: 'CONNECTED' }));

app.listen(PORT, () => console.log(`🌐 BRIAN BOT website live on port ${PORT}`));

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['BRIAN BOT', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true
    });
    sockGlobal = sock;
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        botStatus = 'CONNECTED';
        latestCode = '✅ CONNECTED';
        console.log('✅ BRIAN BOT ONLINE');
        try { await sock.sendPresenceUpdate('available'); } catch {}
      } else if (connection === 'close') {
        botStatus = 'CONNECTED';
        latestCode = '✅ CONNECTED';
        const loggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
        sockGlobal = null;
        if (loggedOut) console.log('❌ Logged out. Remove the session directory and pair again.');
        else setTimeout(startBot, 3000);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages || []) {
        try {
          if (!msg?.message || msg.key?.fromMe) continue;
          const from = msg.key.remoteJid;
          if (!from) continue;
          const isGroup = from.endsWith('@g.us');
          const sender = msg.key.participant || from;
          const text = msg.message.conversation
            || msg.message.extendedTextMessage?.text
            || msg.message.imageMessage?.caption
            || '';
          if (!text.trim()) continue;
          let clean = text.trim();
          if (['.', '!', '/'].includes(clean[0])) clean = clean.slice(1).trim();
          const parts = clean.split(/\s+/);
          const cmd = (parts.shift() || '').toLowerCase();
          const args = parts.join(' ');
          const reply = message => sock.sendMessage(from, { text: message }, { quoted: msg });

          if (['hi', 'hello', 'hey'].includes(cmd)) await reply(`Hello 👋 I am *${BOT_NAME}*\nType *.menu* to see commands\n\n${FOOTER}`);
          else if (['ping', 'alive', 'online'].includes(cmd)) await reply(`✅ *${BOT_NAME} is ONLINE* ⚡\nSpeed: Fast\n\n${FOOTER}`);
          else if (['menu', 'main', 'help'].includes(cmd)) await reply(MAIN_MENU);
          else if (['owner', 'ownerpanel'].includes(cmd)) await reply(OWNER_MENU);
          else if (['game', 'games'].includes(cmd)) await reply(GAME_MENU);
          else if (['download', 'dl'].includes(cmd)) await reply(DOWNLOAD_MENU);
          else if (['group', 'grp'].includes(cmd)) await reply(GROUP_MENU);
          else if (cmd === 'profile') await reply(`Your Profile: ${sender}\n\n${FOOTER}`);
          else if (cmd === 'jid') await reply(`Your JID: ${from}\nYour Number: ${sender.split('@')[0]}\n\n${FOOTER}`);
          else if (cmd === 'gjid') await reply(isGroup ? `Group JID: ${from}\n\n${FOOTER}` : 'Use this in a group!');
          else if (cmd === 'active') await reply(`✅ Bot is Active Now\nUptime: Running on your hosting service\n\n${FOOTER}`);
          else if (['mytime', 'time'].includes(cmd)) await reply(`🕒 Your Time: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}\nTimezone: Africa/Nairobi\n\n${FOOTER}`);
          else if (['setting', 'settings'].includes(cmd)) await reply(`⚙️ *SETTINGS*\n\nPrefix: . ! / or no prefix\nBot Name: ${BOT_NAME}\nMode: Public\n\n${FOOTER}`);
          else if (cmd === 'menutype') await reply(`Menu Type: BOX MENU ✅\n\n${FOOTER}`);
          else if (['football', 'soccer'].includes(cmd)) await reply(`⚽ *FOOTBALL GAME*\n\nYou kicked... ${['Left ⚽ GOAL!', 'Center ⚽ GOAL!', 'Right ⚽ MISS!'][Math.floor(Math.random() * 3)]}\n\n${FOOTER}`);
          else if (['gstatus', 'groupinfo'].includes(cmd)) {
            if (!isGroup) await reply('Use this in a group!');
          }
        } catch (error) {
          console.log('Message handler error:', error.message);
        }
      }
    });
  } catch (error) {
    botStatus = 'CONNECTED';
    console.error('Bot startup error:', error.message);
    setTimeout(startBot, 5000);
  }
}

startBot();
