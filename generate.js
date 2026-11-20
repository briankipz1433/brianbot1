const fs = require('fs');

const base = {
  general: ['menu','help','ping','alive','owner','info','speed','runtime','uptime'],
  fun: ['joke','meme','roast','dare','truth','fact','quote'],
  games: ['quiz','slots','dice','rps','guess'],
  music: ['play','song','lyrics','video','ytmp3'],
  stickers: ['sticker','toimg','attp','ttp'],
  ai: ['ai','gpt','imagine','translate','ask'],
  utility: ['weather','calc','qr','google','search'],
  group: ['kick','add','promote','demote','tagall','mute'],
  owner: ['broadcast','restart','block','unblock'],
  economy: ['daily','balance','work','rob','shop'],
  anime: ['waifu','neko','anime','manga'],
  religion: ['bible','quran','verse','prayer']
};

let seen = new Set();
let cleaned = {};
for (const cat in base) {
  cleaned[cat] = [];
  for (const c of base[cat]) {
    const clean = c.toLowerCase().trim();
    if (seen.has(clean)) continue;
    seen.add(clean);
    cleaned[cat].push(clean);
  }
}

fs.writeFileSync('./commands.js', 'module.exports = ' + JSON.stringify(cleaned, null, 2));
console.log('commands.js created OK');
