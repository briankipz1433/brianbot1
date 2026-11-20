// ============================================
// BRIAN BOT - SETTINGS.JS
// ============================================

module.exports = {
  // BOT INFO
  botName: 'BRIAN BOT',
  ownerName: 'BRIAN',
  // Set OWNER_NUMBER in the host environment to your own number (country code, digits only).
  ownerNumber: process.env.OWNER_NUMBER || '254700000000',
  ownerJid: `${(process.env.OWNER_NUMBER || '254700000000').replace(/[^0-9]/g, '')}@s.whatsapp.net`,
  botNumber: '', // Leave empty to detect automatically after pairing.
  prefix: '.',
  secondPrefix: '!',

  // PAIRING / WEBSITE
  // Keep the pairing password out of source control; configure PAIRING_PASS in the host environment.
  pairingPass: process.env.PAIRING_PASS || '',
  port: Number(process.env.PORT) || 3000,
  website: 'https://brianbot1.onrender.com',

  // MODE: public = everyone can use, private = only owner, self = only bot number
  mode: 'public',
  autoRead: true,
  autoTyping: true,
  autoRecording: false,
  autoStatusView: true,
  autoStatusReact: true,
  autoReact: false,
  antiCall: false,
  antiDelete: true,

  // WELCOME / GOODBYE
  welcome: true,
  goodbye: true,
  welcomeMsg: '👋 Welcome @user to *{group}*\n\nYou are member #{count}\n\nPlease read group rules!',
  goodbyeMsg: '👋 Goodbye @user\n\nWe will miss you!',

  // ANTI-LINK / GROUP
  antiLink: false,
  antiLinkAction: 'kick', // kick / warn / delete
  antiBadWord: false,
  antiSpam: true,

  // OWNER-ONLY COMMAND NAMES. This list does not itself enforce authorization.
  // Do not implement eval/exec without a secure sandbox and strict authorization.
  ownerOnly: ['broadcast', 'restart', 'eval', 'exec', 'join', 'leave', 'block', 'unblock', 'shutdown'],

  // MESSAGES
  mess: {
    owner: '*❌ This command is for OWNER only!*',
    admin: '*❌ This command is for ADMINS only!*',
    group: '*❌ This command only works in GROUPS!*',
    private: '*❌ This command only works in DM!*',
    wait: '*⏳ Please wait...*',
    success: '*✅ Done!*',
    error: '*❌ Something went wrong! Try again.*',
    premium: '*💎 This is a PREMIUM command!*',
    notFound: '*❌ Command not found. Type .menu*'
  },

  // STICKER / MEDIA
  stickerAuthor: 'BRIAN BOT',
  stickerPack: 'BRIAN BOT 🇰🇪',
  watermark: '© BRIAN BOT',

  // AI
  aiEnabled: true,
  aiName: 'BRIAN AI',

  // ECONOMY
  dailyAmount: 1000,
  startBalance: 5000,

  // DATABASE / SESSION
  sessionName: 'session',
  sessionFolder: './session',

  // TIMEZONE
  timezone: 'Africa/Nairobi',
  country: 'Kenya',
  currency: 'KES',

  // SOCIAL LINKS
  youtube: 'https://youtube.com/@brian',
  instagram: 'https://instagram.com/brian',
  tiktok: 'https://tiktok.com/@brian',
  telegram: 'https://t.me/brian',
  whatsappChannel: 'https://whatsapp.com/channel/brian',

  // FOOTER
  footer: '© 2026 BRIAN BOT | Made in Kenya 🇰🇪',
  version: '1.0.0'
};
