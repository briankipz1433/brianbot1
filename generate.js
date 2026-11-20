const fs = require('fs');

const base = {
  general: ['menu', 'ping'],
};

fs.writeFileSync('./commands.js', `module.exports = ${JSON.stringify(base, null, 2)};\n`);
console.log('commands.js created successfully');
