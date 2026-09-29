# Free Fire Telegram Likes Bot — Guest Backend

Telegram command:
`/like <UID>`

The bot uses Free Fire guest credentials stored in Railway environment variables and the guest/JWT + encrypted LikeProfile flow.

## Railway variables

Required:
- `BOT_TOKEN`
- `FF_GUESTS_JSON`

`FF_GUESTS_JSON` must be a JSON array, for example:
[
  {"uid":"GUEST_UID_1","password":"GUEST_PASSWORD_1"},
  {"uid":"GUEST_UID_2","password":"GUEST_PASSWORD_2"}
]

Optional:
- `FF_REGION=PK`
- `LIKE_CONCURRENCY=5`

Do not put credentials in GitHub files.

## Important
One guest account can contribute only one like to the same target under the one-like-per-guest-per-target rule used by this implementation. To reach 100 likes for one target, the pool needs up to 100 usable guest accounts.

The bot keeps usage history in `data/guest_usage_by_target.json`. Railway's normal ephemeral filesystem is not permanent, so a restart/redeploy can reset that local history.
