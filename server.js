const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const PORT = Number(process.env.PORT || 8080);
const BOT_TOKEN = process.env.BOT_TOKEN;
const DEFAULT_REGION = String(process.env.FF_DEFAULT_REGION || "PK").trim().toUpperCase();

/*
  Free API backends.
  LIKE_API_URL can be changed in Railway Variables without changing code.
  The default endpoint is the current keyless endpoint documented by likesff-v2.
*/
const DIRECT_API_BASE = String(
  process.env.LIKE_API_URL || "https://botlikesff.rexapi.com.br/api/v2/likes"
).trim();

const PROXY_API_BASE = String(
  process.env.LIKE_API_PROXY || "https://r.jina.ai/http://botlikesff.rexapi.com.br/api/v2/likes"
).trim();

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is missing. Add BOT_TOKEN in Railway Variables.");
  process.exit(1);
}

const app = express();

app.get("/", (_req, res) => {
  res.status(200).send("Free Fire Telegram Bot is running.");
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "free-fire-telegram-bot",
    likeApi: DIRECT_API_BASE
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server listening on port ${PORT}`);
});

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

function validUid(uid) {
  return /^\d{5,15}$/.test(String(uid));
}

function buildUrl(base, uid) {
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}uid=${encodeURIComponent(uid)}`;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "FreeFireTelegramBot/5.0"
      },
      signal: controller.signal
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${text.slice(0, 500)}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`API returned non-JSON response: ${text.slice(0, 500)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function requestLikes(uid) {
  const attempts = [
    { name: "direct", url: buildUrl(DIRECT_API_BASE, uid) },
    { name: "fallback", url: buildUrl(PROXY_API_BASE, uid) }
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      console.log(`Trying likes backend: ${attempt.name}`);
      const data = await fetchJson(attempt.url);
      return { backend: attempt.name, data };
    } catch (error) {
      lastError = error;
      console.error(`${attempt.name} likes backend failed:`, error.message);
    }
  }

  throw new Error(
    `All likes backends failed. Last error: ${lastError ? lastError.message : "unknown error"}`
  );
}

function pick(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function formatResult(uid, data) {
  const status = String(pick(data, ["status", "status_envio", "message"]) || "").toLowerCase();
  const likes = data && typeof data.likes === "object" ? data.likes : {};

  const before = pick(likes, ["antes", "before", "likesBefore"]);
  const after = pick(likes, ["depois", "after", "likesAfter"]);
  const added = pick(likes, ["adicionados", "added", "sent", "sentLikes"]);

  const success =
    status.includes("success") ||
    status.includes("enviados") ||
    status.includes("sucesso") ||
    status.includes("sent");

  if (success) {
    return [
      "❤️ Free Fire Likes",
      "",
      `UID: ${uid}`,
      "",
      before !== undefined ? `Before: ${before}` : null,
      after !== undefined ? `After: ${after}` : null,
      added !== undefined ? `Added: ${added}` : null,
      "",
      "✅ Likes request completed."
    ].filter(x => x !== null).join("\n");
  }

  return [
    "❌ Likes service response",
    "",
    `UID: ${uid}`,
    "",
    JSON.stringify(data, null, 2).slice(0, 2500)
  ].join("\n");
}

bot.onText(/^\/start$/i, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    "🔥 Free Fire Likes Bot\n\n" +
    "Use:\n" +
    "/like <UID>\n\n" +
    "Example:\n" +
    "/like 14262702036\n\n" +
    `Default region: ${DEFAULT_REGION}`
  );
});

bot.onText(/^\/help$/i, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    "/start — bot start\n" +
    "/like <UID> — send likes request\n\n" +
    "Example: /like 14262702036"
  );
});

bot.onText(/^\/like\s+(\d{5,15})$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const uid = match[1];

  if (!validUid(uid)) {
    await bot.sendMessage(chatId, "❌ Invalid UID.");
    return;
  }

  await bot.sendMessage(
    chatId,
    `⏳ UID ${uid} receive ho gaya.\nRegion: ${DEFAULT_REGION}\nTarget likes: 100\n\nLikes process ho rahe hain...`
  );

  try {
    const result = await requestLikes(uid);
    console.log("Likes API response:", JSON.stringify(result.data));
    await bot.sendMessage(chatId, formatResult(uid, result.data));
  } catch (error) {
    console.error("Likes request failed:", error);
    await bot.sendMessage(
      chatId,
      "❌ Likes send nahi ho sake.\n\n" +
      `UID: ${uid}\nRegion: ${DEFAULT_REGION}\n\n` +
      `Reason: ${error.message.slice(0, 1200)}`
    );
  }
});

bot.on("polling_error", (error) => {
  console.error("Telegram polling error:", error);
});

bot.on("error", (error) => {
  console.error("Telegram bot error:", error);
});

bot.getMe()
  .then((me) => console.log(`Telegram bot connected: @${me.username}`))
  .catch((error) => console.error("Telegram getMe failed:", error));
