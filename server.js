const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is missing. Add it in Railway Variables.");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();

app.get("/", (req, res) => {
  res.json({ ok: true, bot: "Free Fire Likes Bot" });
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

bot.onText(/\/start/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    "🔥 Free Fire Likes Bot\n\nApna Free Fire UID bhejo.\nExample: 14262702036"
  );
});

bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;

  const uid = msg.text.trim();

  if (!/^\d{5,15}$/.test(uid)) {
    await bot.sendMessage(msg.chat.id, "❌ Valid Free Fire UID bhejo (sirf numbers).");
    return;
  }

  await bot.sendMessage(
    msg.chat.id,
    `⏳ UID ${uid} receive ho gaya.\n\nLikes service connect hone ke baad result show hoga.`
  );
});

process.on("unhandledRejection", console.error);
