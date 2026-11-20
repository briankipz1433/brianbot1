const categories = require('./commands.js');
const PREFIX = '.';

const cmdMap = {};
for (const cat in categories) {
  for (const cmd of categories[cat]) {
    cmdMap[cmd] = cat;
  }
}

async function handleCommand(sock, msg) {
  if (!msg || !msg.message) return;
  if (msg.key.fromMe) return;

  const text = msg.message.conversation
    || msg.message.extendedTextMessage?.text
    || msg.message.imageMessage?.caption
    || '';

  if (!text.startsWith(PREFIX)) return;

  const parts = text.slice(1).trim().split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  const jid = msg.key.remoteJid;

  if (cmd === 'menu' && !args[0]) {
    let t = `🤖 *BRIAN BOT*\nPrefix: ${PREFIX}\n\n`;
    for (const cat in categories) {
      t += `*${cat.toUpperCase()}* (${categories[cat].length})\n→ ${PREFIX}menu ${cat}\n\n`;
    }
    return sock.sendMessage(jid, { text: t });
  }

  if (cmd === 'menu' && args[0]) {
    const cat = args[0].toLowerCase();
    if (!categories[cat]) return sock.sendMessage(jid, { text: 'Category not found. Type .menu' });
    return sock.sendMessage(jid, { text: `📂 *${cat.toUpperCase()}*\n\n${categories[cat].map(c => PREFIX + c).join('  ')}` });
  }

  if (cmd === 'ping') {
    const start = Date.now();
    await sock.sendMessage(jid, { text: 'Pinging...' });
    return sock.sendMessage(jid, { text: `Pong! ${Date.now() - start}ms` });
  }

  if (cmdMap[cmd]) {
    return sock.sendMessage(jid, { text: `✅ *${PREFIX}${cmd}*\nCategory: ${cmdMap[cmd]}` });
  }

  return sock.sendMessage(jid, { text: `❌ *${PREFIX}${cmd}* not found\nType *${PREFIX}menu*` });
}

module.exports = { handleCommand };
