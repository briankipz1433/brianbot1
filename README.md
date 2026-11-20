# BRIAN BOT

A minimal WhatsApp bot built with Baileys.

## Required environment variables

- `PAIR_NUMBER`: the WhatsApp number receiving the pairing code, digits only with country code.
- `PAIRING_PASS`: a strong password used to authorize pairing requests.
- `PORT`: optional HTTP port; defaults to 3000.

## Run

```bash
npm install
npm start
```

The pairing page is available at `/`. It does not expose a pairing code without the pairing password.
