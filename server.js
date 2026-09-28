const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const PORT = Number(process.env.PORT || 8080);
const BOT_TOKEN = process.env.BOT_TOKEN;
const DEFAULT_REGION = String(process.env.FF_DEFAULT_REGION || "PK").toUpperCase();
const OB_VERSION = String(process.env.FF_OB_VERSION || "OB55");

const SUPPORTED_REGIONS = new Set([
  "SG", "IND", "ID", "ME", "BR", "VN", "BD", "EU", "TH",
  "SAC", "NA", "RU", "TW", "PK", "CIS", "US", "MY"
]);

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is missing. Add BOT_TOKEN in Railway Variables.");
  process.exit(1);
}

const app = express();
app.get("/", (_req, res) => {
  res.status(200).send("Free Fire Telegram Bot is running.");
});
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, bot: "free-fire-telegram-bot" });
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server listening on port ${PORT}`);
});

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

let likeApiPromise = null;

async function getLikeApi() {
  if (!likeApiPromise) {
    likeApiPromise = import("ffapis").then(({ LikeAPI }) => {
      if (!LikeAPI) throw new Error("ffapis LikeAPI export was not found.");
      return new LikeAPI({ obVersion: OB_VERSION });
    });
  }
  return likeApiPromise;
}

function normalizeRegion(value) {
  const region = String(value || DEFAULT_REGION).trim().toUpperCase();
  return SUPPORTED_REGIONS.has(region) ? region : null;
}

function isValidUid(uid) {
  return /^\d{5,15}$/.test(String(uid));
}

function formatLikeResult(result, uid, region) {
  const data = result && typeof result === "object" ? result : {};
  const likes = data.likes || data.like || {};
  const before = likes.before ?? likes.likesBefore ?? data.likesBefore;
  const after = likes.after ?? likes.likesAfter ?? data.likesAfter;
  const sent = likes.sent ?? likes.sentLikes ?? data.sentLikes ?? data.likeCount;

  const lines = [
    "❤️ Free Fire Likes",
    "",
    `UID: ${uid}`,
    `Region: ${region}`,
    ""
  ];

  if (before !== undefined) lines.push(`Before: ${before}`);
  if (sent !== undefined) lines.push(`Sent: ${sent}`);
  if (after !== undefined) lines.push(`After: ${after}`);

  if (lines.length === 5) {
    lines.push("✅ Like request completed.");
  } else {
    lines.push("", "✅ Like request completed.");
  }

  return lines.join("\n");
}

bot.onText(/^\/start$/i, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    "🔥 Free Fire Likes Bot\n\n" +
    "UID bhejo:\n" +
    "/like <UID>\n\n" +
    `Default region: ${DEFAULT_REGION}\n` +
    "Example: /like 14262702036\n\n" +
    "Region ke sath:\n" +
    "/like PK 14262702036"
  );
});

bot.onText(/^\/help$/i, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    "📖 Commands\n\n" +
    "/start — bot start\n" +
    "/like <UID> — default region se likes\n" +
    "/like <REGION> <UID> — specific region\n\n" +
    "Example:\n" +
    "/like 14262702036\n" +
    "/like PK 14262702036"
  );
});

bot.onText(/^\/like(?:\s+([A-Za-z]+))?\s+(\d{5,15})$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const possibleRegion = match && match[1] ? match[1] : DEFAULT_REGION;
  const uid = match && match[2] ? match[2] : "";

  const region = normalizeRegion(possibleRegion);
  if (!region) {
    await bot.sendMessage(
      chatId,
      "❌ Invalid region.\nExample: /like PK 14262702036"
    );
    return;
  }

  if (!isValidUid(uid)) {
    await bot.sendMessage(chatId, "❌ UID invalid hai. 5–15 digits honi chahiye.");
    return;
  }

  const waiting = await bot.sendMessage(
    chatId,
    `⏳ UID ${uid} receive ho gaya.\nRegion: ${region}\nLikes process ho rahe hain...`
  );

  try {
    const likeApi = await getLikeApi();
    const result = await likeApi.sendLikes(uid, region, 100, OB_VERSION);

    console.log("Like result:", JSON.stringify(result));
    await bot.sendMessage(chatId, formatLikeResult(result, uid, region));
  } catch (error) {
    console.error("Like request failed:", error);

    const detail = error && error.message ? error.message : String(error);
    await bot.sendMessage(
      chatId,
      "❌ Likes service failed.\n\n" +
      `UID: ${uid}\nRegion: ${region}\n\n` +
      "Technical error: " + detail.slice(0, 700)
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
  .then((me) => {
    console.log(`Telegram bot connected: @${me.username}`);
    console.log(`Default region: ${DEFAULT_REGION}, OB version: ${OB_VERSION}`);
  })
  .catch((error) => {
    console.error("Telegram getMe failed:", error);
  });
