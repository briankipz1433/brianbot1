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
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;
const PHONE_NUMBER = (process.env.PHONE_NUMBER || '2547XXXXXXXX').replace(/[^0-9]/g, '');
const AUTH_DIR = process.env.AUTH_DIR || 'brian_auth';

let lastQR = '';
let pairingCode = '';
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

app.get('/', (req, res) => {
  res.send(`
  <html><body style="font-family:sans-serif;text-align:center;padding:20px;background:#111;color:#fff">
    <h1>👑 BRIAN BOT IS RUNNING</h1>
    <p>Status: <b style="color:${isConnected ? 'lime' : 'orange'}">${isConnected ? '✅ CONNECTED TO WHATSAPP' : '⏳ WAITING TO LINK'}</b></p>
    <p>Pairing Code: <b style="font-size:28px;letter-spacing:3px">${pairingCode || 'Generating... refresh in a few seconds'}</b></p>
    <p>Phone: ${PHONE_NUMBER}</p>
    <hr>
    <a href="/qr" style="background:green;color:white;padding:12px 20px;text-decoration:none;border-radius:8px">📷 VIEW QR CODE</a>
    <br><br>
    <p>How to link:</p>
    <p>1. WhatsApp &gt; Settings &gt; Linked Devices &gt; Link with Phone Number</p>
    <p>2. Enter the pairing code above, or scan the QR code at /qr</p>
    <p><small>Brian Bot</small></p>
  </body></html>
  `);
});

app.get('/qr', async (req, res) => {
  if (isConnected) {
    return res.send('<h1>✅ Already Connected!</h1><a href="/">Back</a>');
  }
  if (!lastQR) {
    return res.send('<h1>⏳ No QR yet. Wait a few seconds and refresh.</h1><a href="/qr">Refresh</a><br><a href="/">Home</a>');
  }
  try {
    const qrImage = await QRCode.toDataURL(lastQR);
    res.send(`<html><body style="font-family:sans-serif;text-align:center"><h1>Scan This QR</h1><img src="${qrImage}" style="width:300px"/><br><p>WhatsApp &gt; Linked Devices &gt; Link Device &gt; Scan</p><a href="/qr">Refresh</a><br><a href="/">Home</a></body></html>`);
  } catch (error) {
    res.status(500).send(`QR Error: ${error.message}`);
  }
});

app.get('/pair', (req, res) => {
  res.json({ pairingCode, phone: PHONE_NUMBER, connected: isConnected });
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
        lastQR = '';
        pairingCode = '';
        console.log('✅ BRIAN BOT IS ONLINE!');
      }
    });

    if (!sock.authState.creds.registered && PHONE_NUMBER && !PHONE_NUMBER.includes('X')) {
      setTimeout(async () => {
        try {
          if (sock && !sock.authState.creds.registered) {
            pairingCode = await sock.requestPairingCode(PHONE_NUMBER);
            console.log('🔑 PAIRING CODE:', pairingCode);
          }
        } catch (error) {
          console.log('Pairing error:', error.message);
        }
      }, 5000);
    }

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
