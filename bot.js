// BRIAN BOT - WhatsApp bot with pairing page and six command directories.
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const QRCode = require('qrcode');
const crypto = require('crypto');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
const PORT = process.env.PORT || 10000;
const AUTH_DIR = process.env.AUTH_DIR || 'brian_auth';
const PAIRING_PASS = process.env.PAIRING_PASS || '';

let lastQR = '';
let pairingCode = '';
let pairingNumber = '';
let pairingStatus = 'waiting_for_number';
let pairingError = '';
let sock = null;
let isConnected = false;
let reconnectTimer = null;
let isStarting = false;

const panels = [
  {
    title: 'Owner Panel 👑',
    commands: [
      '.owner', '.ownerinfo', '.botname', '.botversion', '.status', '.ping', '.runtime', '.memory', '.platform', '.uptime',
      '.menu', '.help', '.support', '.contact', '.about', '.features', '.commands', '.panels', '.setprefix', '.getprefix',
      '.setname', '.getname', '.setbio', '.getbio', '.setstatus', '.getstatus', '.setgreeting', '.getgreeting', '.setlanguage', '.getlanguage',
      '.maintenance', '.maintenanceinfo', '.autoresponse', '.autoreply', '.welcomeconfig', '.goodbyeconfig', '.logstatus', '.health', '.version', '.botinfo',
      '.privacy', '.terms', '.report', '.feedback', '.request', '.ownerhelp', '.ownercommands', '.ownercontact', '.pairinghelp', '.webstatus',
    ],
  },
  {
    title: 'Main Panel 🛠️',
    commands: [
      '.hello', '.good morning', '.good afternoon', '.good evening', '.time', '.date', '.today', '.calendar', '.timezone', '.greeting',
      '.quote', '.motivation', '.joke', '.fact', '.tip', '.inspire', '.affirmation', '.word', '.define', '.dictionary',
      '.translate', '.language', '.math', '.calculate', '.percentage', '.convert', '.unit', '.currency', '.helpdesk', '.faq',
      '.aboutme', '.profile', '.profilehelp', '.myid', '.chatinfo', '.contactinfo', '.rules', '.guidelines', '.feedback', '.suggestion',
      '.pollhelp', '.reminderhelp', '.noteshelp', '.todohelp', '.weatherhelp', '.newshelp', '.searchhelp', '.shortcuts', '.mainhelp', '.maincommands',
    ],
  },
  {
    title: 'Downloads 📥',
    commands: [
      '.downloadhelp', '.supported', '.sourcehelp', '.mediainfo', '.fileinfo', '.linkinfo', '.imagehelp', '.videohelp', '.audiohelp', '.documenthelp',
      '.youtubehelp', '.instagramhelp', '.tiktokhelp', '.facebookhelp', '.xhelp', '.twitterhelp', '.pinteresthelp', '.reddithelp', '.spotifyhelp', '.soundcloudhelp',
      '.statushelp', '.thumbnailhelp', '.captionhelp', '.compresshelp', '.resizehelp', '.convertimagehelp', '.convertaudiohelp', '.convertvideohelp', '.formathelp', '.qualityhelp',
      '.filesizehelp', '.uploadhelp', '.sharehelp', '.linkhelp', '.safedownload', '.copyrighthelp', '.permissionhelp', '.mediapolicy', '.downloadlimits', '.downloadstatus',
      '.downloadfaq', '.downloadrules', '.downloadprivacy', '.downloadcontact', '.downloadreport', '.downloadrequest', '.downloadmenu', '.downloadcommands', '.downloadsupport', '.downloadabout',
    ],
  },
  {
    title: 'Group Tools 👥',
    commands: [
      '.grouphelp', '.groupinfo', '.grouprules', '.groupwelcome', '.groupgoodbye', '.groupadmins', '.groupmembers', '.groupcount', '.groupdescription', '.grouplinkhelp',
      '.tagallhelp', '.mentionhelp', '.pollhelp', '.votehelp', '.announcehelp', '.schedulehelp', '.eventhelp', '.topichelp', '.slowmodehelp', '.moderationhelp',
      '.warnhelp', '.warninglist', '.mutehelp', '.unmutehelp', '.kickhelp', '.banhelp', '.unbanhelp', '.promotehelp', '.demotehelp', '.adminhelp',
      '.antispamhelp', '.antilinkhelp', '.antifloodhelp', '.filterhelp', '.wordfilterhelp', '.joinrequesthelp', '.welcomeconfig', '.goodbyeconfig', '.groupconfig', '.groupbackuphelp',
      '.groupaudithelp', '.reportmember', '.reportmessage', '.pinnedhelp', '.cleanhelp', '.groupfaq', '.groupprivacy', '.groupcontact', '.groupmenu', '.groupcommands',
    ],
  },
  {
    title: 'VPN Panel 🔥',
    commands: [
      '.vpn', '.vpninfo', '.vpnhelp', '.vpnstatus', '.vpnplans', '.vpnprice', '.vpntrial', '.vpnfaq', '.vpnsetup', '.vpnandroid',
      '.vpniphone', '.vpnwindows', '.vpnmac', '.vpnlinux', '.vpnrouter', '.vpnprotocols', '.vpnlocations', '.vpnservers', '.vpnaccount', '.vpnrenew',
      '.vpnpayment', '.vpnreceipt', '.vpncontact', '.vpnrequest', '.vpnreport', '.vpntroubleshoot', '.vpnconnect', '.vpndisconnect', '.vpnconfighelp', '.vpnimporthelp',
      '.vpnsecurity', '.vpnprivacy', '.vpnterms', '.vpnrefunds', '.vpnlimits', '.vpncompatibility', '.vpnnetwork', '.vpnlatency', '.vpnspeedtesthelp', '.vpnfaqaccount',
      '.vpnfaqpayment', '.vpnfaqdevice', '.vpnfaqprivacy', '.vpnfaqconnection', '.vpnsupport', '.vpnmenu', '.vpncommands', '.vpnabout', '.vpnpolicy', '.vpncontactowner',
    ],
  },
  {
    title: 'Book Panel 📖',
    commands: [
      '.book', '.bookhelp', '.booklist', '.booksearch', '.bookrequest', '.bookrecommend', '.bookcategories', '.bookauthors', '.bookgenres', '.booklanguage',
      '.englishbooks', '.kiswahilibooks', '.kalenjinbooks', '.bible', '.devotional', '.fiction', '.nonfiction', '.historybooks', '.sciencebooks', '.technologybooks',
      '.educationbooks', '.childrenbooks', '.audiobooks', '.publicdomain', '.openlibrary', '.libraryhelp', '.readinglist', '.readingplan', '.bookquote', '.authorinfo',
      '.isbnhelp', '.bookreview', '.bookrating', '.booksummary', '.bookclub', '.bookformat', '.ebookhelp', '.borrowhelp', '.copyrightbooks', '.legalbooksources',
      '.bookprivacy', '.bookterms', '.bookfaq', '.bookcontact', '.bookreport', '.bookmenu', '.bookcommands', '.booksupport', '.bookabout', '.bookavailability',
    ],
  },
];

function renderMenu() {
  const lines = [
    '┌─ SYSTEM STATUS ─┐',
    `│ Runtime: ${formatRuntime(process.uptime())}`,
    `│ Memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
    '│ Version: 1.0.0',
    `│ Platform: ${isConnected ? 'Online' : 'Waiting for WhatsApp'}`,
    '└─────────────────┘',
    '',
    '┌─ CATEGORIES ─┐',
    ...panels.map((panel, index) => `│ ${index + 1} ${panel.title}`),
    '└──────────────┘',
    '',
    'Reply with a number (1-6) to view that panel’s command directory.',
  ];
  return lines.join('\n');
}

function renderPanel(index) {
  const panel = panels[index];
  const commands = panel.commands.map((command, i) => `${String(i + 1).padStart(2, '0')}. ${command}`);
  return [
    `┌─ ${panel.title.toUpperCase()} ─┐`,
    ...commands,
    '└────────────────────────┘',
    '',
    'This is the command directory. Commands requiring external services or owner configuration need those integrations enabled.',
    'Reply MENU to return to the categories.',
  ].join('\n');
}

function formatRuntime(seconds) {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  return `${hours}h ${minutes}m ${remainingSeconds}s`;
}

function suppliedPairingPassword(req) {
  const supplied = req.get('x-pairing-password') || req.body?.password || '';
  if (!PAIRING_PASS || !supplied) return false;
  const expectedBuffer = Buffer.from(PAIRING_PASS);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function pairingPage() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>BRIAN BOT · WhatsApp Pairing</title><style>
:root{color-scheme:dark;--gold:#f2c14e;--red:#dc3545;--ink:#160b0b;--panel:#241313;--muted:#d4b8a2}
*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:24px;display:grid;place-items:center;background:radial-gradient(ellipse at top,#531818 0,#1d0d0d 48%,#100909 100%);color:#fff;font:16px/1.5 system-ui,sans-serif}
main{width:min(100%,560px);padding:clamp(22px,6vw,42px);border:1px solid #f2c14e66;border-top:5px solid var(--gold);border-radius:22px;background:linear-gradient(145deg,#2c1717,#170e0e);box-shadow:0 24px 80px #0009}
.brand{color:var(--gold);font-size:.8rem;font-weight:800;letter-spacing:.2em;text-transform:uppercase}h1{margin:.5rem 0;color:#fff;font-size:clamp(2rem,7vw,3rem);line-height:1.05}p{color:var(--muted)}label{display:block;margin:18px 0 7px;font-weight:650;color:#fff}input{width:100%;padding:14px 15px;border:1px solid #7f4b3b;border-radius:10px;background:#120b0b;color:#fff;font:inherit}input:focus{outline:2px solid var(--gold);border-color:transparent}.hint{margin:7px 0;font-size:.88rem;color:#c7aaa0}button{width:100%;margin-top:20px;padding:14px;border:0;border-radius:10px;background:linear-gradient(90deg,var(--gold),#ffdf83);color:#28120b;font:inherit;font-weight:800;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.status{margin-top:22px;padding:16px;border:1px solid #ffffff20;border-radius:12px;background:#100b0b;color:#f5e5d4}.status strong{color:var(--gold)}.code{display:block;margin-top:8px;color:#ff6b6b;font-size:clamp(1.7rem,9vw,2.4rem);font-weight:900;letter-spacing:.16em;overflow-wrap:anywhere}.steps{padding-left:20px;color:var(--muted);font-size:.92rem}.steps li{margin:6px 0}.error{color:#ff8585}.success{color:#9ce6b0}.footer{margin:22px 0 0;text-align:center;font-size:.8rem}
</style></head><body><main><div class="brand">BRIAN BOT · Secure pairing</div><h1>Link WhatsApp</h1><p>Enter the WhatsApp number you want to link, including the country code. We’ll generate a pairing code for that account.</p>
<form id="pair-form"><label for="phone">WhatsApp phone number</label><input id="phone" name="phone" inputmode="numeric" autocomplete="tel" placeholder="254712345678" required pattern="[0-9+() -]{8,24}"><div class="hint">Use the international country code, digits only where possible (for example, 254712345678).</div>
<label for="password">Pairing password</label><input id="password" name="password" type="password" autocomplete="current-password" required><button id="submit" type="submit">Generate pairing code</button></form>
<div class="status" aria-live="polite"><strong id="status-title">Status: Waiting for phone number</strong><div id="status-message">Your WhatsApp connection state will appear here.</div><span class="code" id="code"></span></div>
<ol class="steps"><li>Open WhatsApp on the phone number you entered.</li><li>Go to <b>Settings → Linked Devices → Link a Device</b>.</li><li>Select <b>Link with phone number instead</b> and enter the code shown here.</li></ol><p class="footer">Keep your pairing password and code private. Only link accounts you own or are authorized to manage.</p></main>
<script>
const form=document.getElementById('pair-form'), button=document.getElementById('submit'), title=document.getElementById('status-title'), message=document.getElementById('status-message'), code=document.getElementById('code');let poller;
function show(data){const labels={waiting_for_number:'Waiting for phone number',generating:'Generating pairing code',code_ready:'Waiting for WhatsApp to link',connected:'Connected to WhatsApp',error:'Pairing error',waiting_for_whatsapp:'Waiting for WhatsApp service'};title.textContent='Status: '+(labels[data.status]||data.status);message.textContent=data.error||data.message||(data.phone?'Number: +'+data.phone:'');code.textContent=data.pairingCode||'';title.className=data.status==='connected'?'success':data.status==='error'?'error':'';}
async function refresh(){const password=document.getElementById('password').value;if(!password)return;try{const r=await fetch('/pair',{headers:{'X-Pairing-Password':password}});if(r.ok)show(await r.json());}catch(_){}}
form.addEventListener('submit',async e=>{e.preventDefault();button.disabled=true;button.textContent='Generating…';message.textContent='Requesting a pairing code from WhatsApp…';code.textContent='';try{const r=await fetch('/request-pairing',{method:'POST',headers:{'Content-Type':'application/json','X-Pairing-Password':document.getElementById('password').value},body:JSON.stringify({phone:document.getElementById('phone').value})});const data=await r.json();show(data);if(!r.ok)throw new Error(data.error||'Unable to generate pairing code');clearInterval(poller);poller=setInterval(refresh,3000);}catch(err){title.textContent='Pairing error';title.className='error';message.textContent=err.message;}finally{button.disabled=false;button.textContent='Generate pairing code';}});
</script></body></html>`;
}

app.get('/', (_req, res) => res.type('html').send(pairingPage()));

app.post('/request-pairing', async (req, res) => {
  if (!suppliedPairingPassword(req)) {
    return res.status(PAIRING_PASS ? 401 : 503).json({ status: 'error', error: PAIRING_PASS ? 'Incorrect pairing password.' : 'Pairing is disabled: configure PAIRING_PASS on the server first.' });
  }
  const number = String(req.body?.phone || '').replace(/[^0-9]/g, '');
  if (!/^\d{8,15}$/.test(number)) {
    return res.status(400).json({ status: 'error', error: 'Enter a valid international phone number with 8 to 15 digits.' });
  }
  if (isConnected || sock?.authState?.creds?.registered) {
    return res.status(409).json({ status: 'connected', error: 'This bot already has a linked WhatsApp account. Disconnect or reset its session before pairing another number.' });
  }
  if (!sock) {
    return res.status(503).json({ status: 'waiting_for_whatsapp', error: 'WhatsApp is still starting. Wait a few seconds and try again.' });
  }
  if (pairingStatus === 'generating') {
    return res.status(409).json({ status: pairingStatus, error: 'A pairing code request is already in progress.' });
  }

  pairingNumber = number;
  pairingCode = '';
  pairingError = '';
  pairingStatus = 'generating';
  try {
    pairingCode = await sock.requestPairingCode(number);
    pairingStatus = 'code_ready';
    console.log(`🔑 Pairing code generated for +${number}`);
    return res.json({ status: pairingStatus, pairingCode, phone: pairingNumber, message: 'Enter this code in WhatsApp under Linked Devices → Link with phone number instead.' });
  } catch (error) {
    pairingStatus = 'error';
    pairingError = error.message || 'WhatsApp could not generate a pairing code.';
    console.error('Pairing error:', pairingError);
    return res.status(500).json({ status: pairingStatus, error: pairingError });
  }
});

app.get('/qr', async (req, res) => {
  if (isConnected) {
    return res.send('<h1>✅ Already Connected!</h1><a href="/">Back</a>');
  }
  if (!lastQR) {
    return res.send('<h1>⏳ No QR yet. Use the pairing page to request a phone-number code.</h1><a href="/">Pair WhatsApp</a>');
  }
  try {
    const qrImage = await QRCode.toDataURL(lastQR);
    res.send(`<html><body style="font-family:sans-serif;text-align:center;background:#160b0b;color:white"><h1>Scan This QR</h1><img src="${qrImage}" style="width:300px"/><br/><p>WhatsApp &gt; Linked Devices &gt; Link Device &gt; Scan</p><a href="/">Pair WhatsApp</a></body></html>`);
  } catch (error) {
    res.status(500).send(`QR Error: ${error.message}`);
  }
});

app.get('/pair', (req, res) => {
  if (!suppliedPairingPassword(req)) {
    return res.status(PAIRING_PASS ? 401 : 503).json({ error: PAIRING_PASS ? 'Unauthorized' : 'Pairing is disabled until PAIRING_PASS is configured.' });
  }
  res.json({ status: isConnected ? 'connected' : pairingStatus, pairingCode, phone: pairingNumber, connected: isConnected, error: pairingError });
});

app.get('/status', (_req, res) => {
  res.json({ status: isConnected ? 'Connected - ONLINE' : pairingStatus, pairingNumber, connected: isConnected });
});

app.listen(PORT, () => console.log(`🌐 Web server listening on port ${PORT}`));

async function startBrian() {
  if (isStarting) {
    return;
  }
  isStarting = true;
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();
    console.log('Using Baileys version', version);

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      printQRInTerminal: false,
      browser: ['Brian Bot', 'Chrome', '1.0'],
      syncFullHistory: false,
    });
    isStarting = false;

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        lastQR = qr;
        console.log('✅ New QR generated - open /qr');
      }
      if (connection === 'close') {
        isConnected = false;
        if (pairingStatus !== 'error') pairingStatus = 'waiting_for_number';
        pairingCode = '';
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log('Disconnected. Reconnect?', shouldReconnect);
        if (!shouldReconnect) {
          console.log(`Logged out. Remove ${AUTH_DIR} and relink to connect again.`);
        }
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }
        reconnectTimer = setTimeout(() => {
          startBrian().catch((error) => console.error('Reconnect error:', error));
        }, 3000);
      } else if (connection === 'open') {
        isConnected = true;
        pairingStatus = 'connected';
        lastQR = '';
        pairingCode = '';
        console.log('✅ BRIAN BOT IS ONLINE!');
        const selfJid = sock.user?.id;
        if (selfJid) {
          try {
            await sock.sendMessage(selfJid, { text: '✅ BRIAN BOT SUCCESSFULLY LINKED TO WHATSAPP. The bot is now online and ready to use.' });
          } catch (error) {
            console.error('Unable to send WhatsApp link confirmation:', error.message);
          }
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages?.[0];
      if (!msg?.message || msg.key.fromMe) {
        return;
      }
      const from = msg.key.remoteJid;
      const message = msg.message;
      const text = (
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        ''
      ).trim();
      if (!text) {
        return;
      }

      const normalized = text.toLowerCase();
      console.log('MSG:', from, text);
      let reply = '';
      const numberChoice = normalized.match(/^([1-6])$/);

      if (numberChoice) {
        reply = renderPanel(Number(numberChoice[1]) - 1);
      } else if (['hi', 'hello', 'menu', '.menu', 'help', '.help', '.owner'].includes(normalized)) {
        reply = renderMenu();
      } else if (normalized === '.status' || normalized === 'status') {
        reply = `Status: ${isConnected ? 'Online' : 'Waiting for WhatsApp'}\nRuntime: ${formatRuntime(process.uptime())}\nMemory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`;
      } else if (normalized === '.ping' || normalized === 'ping') {
        reply = `Pong! ${formatRuntime(process.uptime())}`;
      } else if (normalized === '.vpn' || normalized === 'vpn') {
        reply = renderPanel(4);
      } else if (normalized === '.book' || normalized === 'book' || normalized === 'kitabu') {
        reply = renderPanel(5);
      } else if (normalized === '.ownercommands') {
        reply = renderPanel(0);
      } else if (normalized === '.maincommands') {
        reply = renderPanel(1);
      } else if (normalized === '.downloadcommands') {
        reply = renderPanel(2);
      } else if (normalized === '.groupcommands') {
        reply = renderPanel(3);
      } else if (normalized === '.vpncommands') {
        reply = renderPanel(4);
      } else if (normalized === '.bookcommands') {
        reply = renderPanel(5);
      } else if (normalized === '.human' || normalized === 'human') {
        reply = 'Sawa, Brian mwenyewe anakujia... 👑 Please wait.';
      }

      if (reply) {
        try {
          await sock.sendMessage(from, { text: reply });
        } catch (error) {
          console.error('Unable to send reply:', error.message);
        }
      }
    });
  } catch (error) {
    isStarting = false;
    console.error('Startup error:', error);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    reconnectTimer = setTimeout(() => {
      startBrian().catch((retryError) => console.error('Retry error:', retryError));
    }, 5000);
  }
}

startBrian().catch((error) => console.error('Fatal startup error:', error));
