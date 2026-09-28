const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is missing. Add BOT_TOKEN in Railway Variables.");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "Free Fire Telegram Likes Bot",
    status: "running"
  });
});

app.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT}`);
});

async function startBot() {
  // Dynamic import keeps the bot compatible if ffapis is published as ESM.
  const { LikeAPI } = await import("ffapis");

  const obVersion = process.env.FF_OB_VERSION || "OB55";
  const likeApi = new LikeAPI({ obVersion });

  const bot = new TelegramBot(BOT_TOKEN, { polling: true });

  console.log(`Telegram bot started. FF OB version: ${obVersion}`);

  bot.onText(/^\/start$/i, async (msg) => {
    await bot.sendMessage(
      msg.chat.id,
      "🔥 Free Fire Likes Bot\\n\\n" +
      "Apna Free Fire UID bhejo.\\n" +
      "Default region: PK\\n\\n" +
      "Example: 14262702036\\n\\n" +
      "Specific region ke liye:\\n" +
      "/like PK 14262702036"
    );
  });

  bot.onText(/^\/like(?:\\s+([A-Za-z]+))?\\s+(\\d{5,15})$/i, async (msg, match) => {
    const region = (match[1] || "PK").toUpperCase();
    const uid = match[2];

    await sendLikes(bot, msg.chat.id, uid, region, likeApi);
  });

  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;

    const uid = msg.text.trim();

    if (!/^\\d{5,15}$/.test(uid)) {
      await bot.sendMessage(
        msg.chat.id,
        "❌ Valid Free Fire UID bhejo (5–15 digits)."
      );
      return;
    }

    await sendLikes(bot, msg.chat.id, uid, "PK", likeApi);
  });

  bot.on("polling_error", (err) => {
    console.error("Telegram polling error:", err.message);
  });
}

async function sendLikes(bot, chatId, uid, region, likeApi) {
  const progress = await bot.sendMessage(
    chatId,
    `⏳ UID ${uid} receive ho gaya.\\nRegion: ${region}\\n\\nLikes send ho rahe hain...`
  );

  try {
    const result = await likeApi.sendLikes(uid, region, 100);

    console.log("Like result:", JSON.stringify(result));

    const before = result?.likesBefore ?? result?.before ?? result?.oldLikes;
    const after = result?.likesAfter ?? result?.after ?? result?.newLikes;
    const sent = result?.likesSent ?? result?.sent ?? result?.added;

    let text = `✅ Likes request complete!\\n\\nUID: ${uid}\\nRegion: ${region}`;

    if (before !== undefined || after !== undefined) {
      text += `\\nBefore: ${before ?? "?"}\\nAfter: ${after ?? "?"}`;
    }
    if (sent !== undefined) {
      text += `\\nLikes sent: ${sent}`;
    }

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: progress.message_id
    });
  } catch (err) {
    console.error("Like API error:", err);

    const detail = String(err?.message || err).slice(0, 500);

    await bot.editMessageText(
      `❌ Likes send nahi ho sake.\\n\\nUID: ${uid}\\nRegion: ${region}\\n\\nError: ${detail}`,
      {
        chat_id: chatId,
        message_id: progress.message_id
      }
    );
  }
}

startBot().catch((err) => {
  console.error("Bot startup failed:", err);
  process.exit(1);
});
