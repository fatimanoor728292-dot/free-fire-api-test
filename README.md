# Free Fire Telegram Bot v5

This version deliberately removes `ffapis`, Git dependencies, postinstall scripts,
TypeScript builds, and other fragile deployment steps.

## Railway

Required variable:

`BOT_TOKEN`

Optional:

`FF_DEFAULT_REGION=PK`

Optional override:

`LIKE_API_URL=https://botlikesff.rexapi.com.br/api/v2/likes`

The bot also has a fallback HTTP route through `r.jina.ai` if the direct API
host cannot be reached from the Railway runtime.

## Commands

`/start`

`/like 14262702036`

## Important

The likes backend is a third-party service, not an official Garena API.
Its availability can change. The bot reports the real response/error and does
not claim likes were sent when the backend did not confirm them.

Do not put BOT_TOKEN in GitHub.

## Deployment

Replace the existing:
- package.json
- server.js
- README.md

Commit once and let Railway deploy automatically.
