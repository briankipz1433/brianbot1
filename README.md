# BRIAN BOT

A WhatsApp bot and pairing dashboard built with Node.js, Express, and Baileys.

## Features

- WhatsApp pairing-code authentication
- Green and gold responsive web dashboard
- Connection status endpoint
- Persistent Baileys session storage
- Automatic reconnection
- Basic chat commands
- Password-protected pairing configuration

## Requirements

- Node.js 18 or newer
- A WhatsApp account

## Environment Variables

| Variable | Required | Description |
|---|---:|---|
| `PAIR_NUMBER` | No | WhatsApp number with country code, digits only, such as `254712345678` |
| `PAIRING_PASS` | Yes | Secret password used to authorize pairing requests |
| `PORT` | No | HTTP server port; defaults to `3000` |

## Installation

```bash
npm install
```

Create a `.env` file or configure environment variables on your hosting platform:

```env
PAIR_NUMBER=254712345678
PAIRING_PASS=replace-with-a-long-random-password
PORT=3000
```

Start the bot:

```bash
npm start
```

Open `http://localhost:3000/` or `/pair` on your deployed server.

## Pairing

1. Set `PAIR_NUMBER` and `PAIRING_PASS`.
2. Open the pairing page.
3. Enter the pairing password.
4. Copy the generated pairing code.
5. Open WhatsApp.
6. Select **Settings → Linked Devices → Link a Device**.
7. Choose **Link with phone number instead**.
8. Enter the pairing code.

Keep `PAIRING_PASS` private and deploy the dashboard over HTTPS.

## Status API

```http
GET /status
```

Example response:

```json
{
  "status": "Connected - ONLINE",
  "pairingNumber": "254712345678",
  "pairingCode": ""
}
```

The pairing code is omitted from the public status response. The `/pair` page shows it only to authorized users.

## Chat Commands

Messages are matched with or without a `.`, `!`, or `/` prefix.

- `hi` or `hello` — greeting
- `menu` or `help` — command list
- `ping` — response check
- `pair` or `code` — pairing status
- `football` — football position prompt

## Deployment

This project can be deployed on Render or another Node.js hosting service. Set `PAIR_NUMBER` and `PAIRING_PASS` in the hosting dashboard and add a persistent disk for the `session` directory so WhatsApp credentials survive restarts.

## Security

- Never commit `.env` or WhatsApp session credentials.
- Restrict access to the pairing page with a strong `PAIRING_PASS`.
- The `session/` and `.env` paths are excluded by `.gitignore`.
- Rotate `PAIRING_PASS` after testing or suspected exposure.

## License

MIT. See [LICENSE](LICENSE).
