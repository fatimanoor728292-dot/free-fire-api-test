# Free Fire Telegram Bot v4 — Railway Safe

This version deliberately does **not** depend on the broken published `ffapis` package or a GitHub npm dependency.

## Railway variables

Required:
- `BOT_TOKEN`

Optional:
- `FF_DEFAULT_REGION=PK`
- `FF_OB_VERSION=OB55`
- `FF_LIKE_COUNT=100`

Keep `BOT_TOKEN` only in Railway Variables. Never put it in GitHub.

## Commands

- `/start`
- `/like 14262702036`
- `/like PK 14262702036`

## Build design

The project uses only:
- Express
- node-telegram-bot-api
- protobufjs

There is no `ffapis` dependency, no postinstall build, and no TypeScript compilation.

The Free Fire authentication/like request logic needed by this bot is included directly in `server.js`. Guest accounts are registered at runtime, so no guest-account credential files need to be uploaded to GitHub.

## Important operational note

Sending 100 likes requires multiple guest registrations/login/like requests. The bot performs them sequentially and stops after repeated infrastructure failures instead of endlessly retrying.

The bot reports actual successful/failed requests. It never claims likes were sent when the game server did not accept the request.

## Deployment

Replace the existing:
- `package.json`
- `server.js`
- `README.md`

Then commit.

Do not run another copy of this Telegram bot locally with the same BOT_TOKEN.
