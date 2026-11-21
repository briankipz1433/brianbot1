const fs = require('fs');
const path = require('path');

const sessionDir = path.join(__dirname, 'session');

try {
  fs.rmSync(sessionDir, { recursive: true, force: true });
  console.log('WhatsApp session credentials removed. Restart the service, then request a new pairing code from the pairing page.');
} catch (error) {
  console.error('Could not remove the WhatsApp session:', error.message);
  process.exitCode = 1;
}
