const categories = require('./commands.js');
const PREFIX = '.'; // <-- your prefix

// Build one fast lookup: command -> category
const cmdMap = {};
for (let cat in categories) {
  for (let cmd of categories[cat]) {
    const clean = cmd.toLowerCase().replace(/[^a-z0-9]/g, ''); // removes spaces
    if (!cmdMap[clean]) cmdMap[clean] = cat; // keeps first category if duplicate
  }
}
console.log('Total commands loaded with . prefix:', Object.keys(cmdMap).length);

sock.ev.on('messages.upsert', async ({ messages }) => {
  const msg = messages[0];
  if (!msg.message || msg.key.fromMe) return;

  const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';
  if (!text.startsWith(PREFIX)) return;

  const args = text.slice(1).trim().split(/ +/);
  const cmd = args[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const jid = msg.key.remoteJid;

  // .menu
  if (cmd === 'menu') {
    let menuText = `🤖 *BRIAN BOT - 1000 COMMANDS*\nPrefix: ${PREFIX}\n\n`;
    for (let cat in categories) {
      menuText += `*${cat.toUpperCase()}* - ${categories[cat].length} cmds\nExample: ${PREFIX}menu ${cat}\n\n`;
    }
    menuText += `Type ${PREFIX}menu fun to see all fun commands`;
    return sock.sendMessage(jid, { text: menuText });
  }

  // .menu <category>
  if (cmd === 'menu' || args[0] === 'menu') {}

  // Check if command exists
  if (cmdMap[cmd]) {
    const cat = cmdMap[cmd];
    // This is where ALL 1000 reply
    await sock.sendMessage(jid, { 
      text: `✅ *Command:* ${PREFIX}${cmd}\n📂 *Category:* ${cat.toUpperCase()}\n\nThis command is working! Add your real logic for *${cmd}* here.` 
    });
    return;
  }

  // .menu fun / .menu games etc
  if (args[0].toLowerCase() === 'menu' && args[1]) {
    const cat = args[1].toLowerCase();
    if (categories[cat]) {
      return sock.sendMessage(jid, { text: `📂 *${cat.toUpperCase()}* (${categories[cat].length})\n\n${categories[cat].map(c => PREFIX + c).join(', ')}` });
    }
  }

  await sock.sendMessage(jid, { text: `❌ Command *${PREFIX}${cmd}* not found.\nType *${PREFIX}menu*` });
});
