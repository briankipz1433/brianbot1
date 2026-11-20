# BRIAN BOT

A WhatsApp bot built with Baileys, with a web status/pairing page and basic chat commands.

## Required environment variables

- `PAIR_NUMBER` (or `PHONE_NUMBER`): the WhatsApp number receiving the pairing code, digits only with country code.
- `PAIRING_PASS`: a strong password required to generate a pairing code.
- `PORT`: optional HTTP port; defaults to `3000`.

## Run

```bash
npm install
npm start
```

Open `/` for the status and pairing page. Pairing is available only after setting `PAIR_NUMBER` (or `PHONE_NUMBER`) and `PAIRING_PASS`. The code is returned only to the authorized pairing request and is not placed in the public page HTML. Deploy the page over HTTPS and keep the pairing password private.

## Chat commands

Commands work with or without the `.`, `!`, or `/` prefix:

- `hi` / `hello` — greeting
- `menu` / `help` — show commands
- `price` — show the configured example price (`500`)
- `ping` — check that the bot responds
- `football` — show the left/center/right prompt
