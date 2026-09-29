import asyncio
import os
import re
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from like_engine import send_likes

BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN is missing")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🔥 Free Fire Likes Bot\n\n"
        "Command:\n"
        "/like <UID>\n\n"
        "Example: /like 14262702036"
    )

async def like_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("❌ UID do: /like 14262702036")
        return

    uid = context.args[0].strip()
    if not re.fullmatch(r"\d{6,15}", uid):
        await update.message.reply_text("❌ UID numeric hona chahiye.")
        return

    msg = await update.message.reply_text("⏳ UID receive ho gaya. Likes process ho rahe hain...")

    try:
        result = await asyncio.wait_for(send_likes(uid, 100), timeout=180)
    except asyncio.TimeoutError:
        await msg.edit_text("⏱️ Request timeout ho gaya. Railway logs check karo.")
        return
    except Exception as e:
        await msg.edit_text(f"❌ Like service error:\n{str(e)[:800]}")
        return

    success = result["success"]
    planned = result["planned"]

    if success > 0:
        await msg.edit_text(
            f"✅ Likes process complete!\n\n"
            f"🎯 UID: {uid}\n"
            f"❤️ Likes sent: {success}\n"
            f"📦 Guests used: {planned}"
        )
    else:
        reason = next((d["info"] for d in result.get("details", []) if d["info"]), "No successful requests")
        await msg.edit_text(
            f"❌ Likes send nahi ho sake.\n\n"
            f"🎯 UID: {uid}\n"
            f"👥 Guests tried: {planned}\n"
            f"Reason: {str(reason)[:700]}"
        )

async def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("like", like_cmd))
    print("Bot is running...")
    await app.initialize()
    await app.start()
    await app.updater.start_polling()
    try:
        await asyncio.Event().wait()
    finally:
        await app.updater.stop()
        await app.stop()
        await app.shutdown()

if __name__ == "__main__":
    asyncio.run(main())
