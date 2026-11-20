const PREFIX = '.';

async function handleCommand(sock, msg) {
  if (!msg?.message || msg.key?.fromMe) return;

  const text = msg.message.conversation
    || msg.message.extendedTextMessage?.text
    || msg.message.imageMessage?.caption
    || '';

  if (!text.startsWith(PREFIX)) return;

  const [command] = text.slice(PREFIX.length).trim().split(/\s+/);
  const jid = msg.key.remoteJid;

  if (command.toLowerCase() === 'ping') {
    await sock.sendMessage(jid, { text: '✅ Pong!' });
  } else if (command.toLowerCase() === 'menu') {
    await sock.sendMessage(jid, { text: '🤖 BRIAN BOT\n\n.ping — test connection\n.menu — show commands' });
  } else {
    await sock.sendMessage(jid, { text: '❌ Command not found. Type .menu' });
  }
}

module.exports = { handleCommand };
