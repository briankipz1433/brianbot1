module.exports = {
  botName: 'BRIAN BOT',
  ownerName: 'BRIAN',
  ownerNumber: process.env.OWNER_NUMBER || '',
  prefix: '.',
  mode: 'public',
  sessionFolder: './session',
  website: 'https://brianbot1.onrender.com',
  pairingPassConfigured: Boolean(process.env.PAIRING_PASS),
  version: '2.0.0',
};
