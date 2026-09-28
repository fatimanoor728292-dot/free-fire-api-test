# Free Fire Telegram Bot v3 — Fixed

## Railway setup

Keep the existing Railway service.

### Required variable
`BOT_TOKEN`

### Optional variables
`FF_DEFAULT_REGION=PK`
`FF_OB_VERSION=OB55`

Do NOT put the Telegram token in GitHub files.

## Why this version is different

The previous deployment used the published `ffapis@3.0.1` npm package. Its package metadata publishes `dist/index.*` but not the generated `dist/chunk-*.mjs` files, which can produce `ERR_MODULE_NOT_FOUND`.

This version installs `ffapis` directly from its GitHub source and, during Railway `postinstall`, installs its build dependencies and builds the package locally. That generates the missing chunk files before the bot imports `ffapis`.

The Telegram bot itself starts without importing `ffapis` immediately. The Free Fire library is loaded only when `/like` is used, so a library-side runtime problem cannot prevent `/start` from responding.

## Commands

`/start`

`/like 14262702036`

`/like PK 14262702036`

The default region is `PK` unless `FF_DEFAULT_REGION` is changed.

## Important

The Free Fire likes operation is unofficial and can stop working if Garena changes its protocol or the library becomes incompatible. The bot reports the actual runtime error instead of pretending that likes were sent.

## Deployment

Upload these three files to the existing GitHub repository:

- `package.json`
- `server.js`
- `README.md`

Do not upload `.env` or the Telegram token.

After Railway deploys, Logs should contain:

`Web server listening on port ...`

and

`Telegram bot connected: @...`

Do not run another copy of the bot locally with the same Telegram token, because Telegram polling allows only one active consumer for a bot token.
