from telegram import Update
from telegram.ext import CallbackQueryHandler, ContextTypes
from datetime import datetime

from database import payments_collection, users_collection
from services.game_service import announce_winner


def _parse_payload(payload: str):
    parts = payload.split("_")
    if len(parts) < 3:
        return None, None
    return int(parts[1]), int(parts[2])

async def approve_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    user_id, game_id = _parse_payload(query.data)
    if user_id is None:
        await query.edit_message_caption(caption="Invalid approve payload")
        return

    users_collection.update_one(
        {"telegram_id": user_id, "current_game_id": game_id},
        {"$set": {"payment_status": "approved", "approved_at": datetime.utcnow(), "updated_at": datetime.utcnow()}}
    )

    payments_collection.update_one(
        {"telegram_id": user_id, "game_id": game_id, "status": "pending"},
        {"$set": {"status": "approved", "approved_at": datetime.utcnow(), "updated_at": datetime.utcnow()}}
    )

    await query.edit_message_caption(caption=query.message.caption + "\n\n✅ APPROVED")

    try:
        await context.bot.send_message(
            chat_id=user_id,
            text="✅ Your payment is approved and your lucky number is now reserved."
        )
    except Exception:
        pass

async def reject_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    user_id, game_id = _parse_payload(query.data)
    if user_id is None:
        await query.edit_message_caption(caption="Invalid reject payload")
        return

    users_collection.update_one(
        {"telegram_id": user_id, "current_game_id": game_id},
        {"$set": {"payment_status": "rejected", "rejected_at": datetime.utcnow(), "updated_at": datetime.utcnow()}}
    )

    payments_collection.update_one(
        {"telegram_id": user_id, "game_id": game_id, "status": "pending"},
        {"$set": {"status": "rejected", "rejected_at": datetime.utcnow(), "updated_at": datetime.utcnow()}}
    )

    await query.edit_message_caption(caption=query.message.caption + "\n\n❌ REJECTED")

    try:
        await context.bot.send_message(
            chat_id=user_id,
            text="❌ Your payment was rejected. Please retry with a valid screenshot."
        )
    except Exception:
        pass


async def announce_winner_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    winner = announce_winner()
    if not winner:
        await update.message.reply_text("No approved players found for current round.")
        return

    text = (
        "🏆 Winner announced\n\n"
        f"Game: {winner['game_id']}\n"
        f"Username: @{winner.get('username', 'unknown')}\n"
        f"Lucky number: {winner['winning_number']}\n\n"
        "Round closed. New round started. Payment is required again for all users."
    )
    await update.message.reply_text(text)
    try:
        await context.bot.send_message(
            chat_id=winner["telegram_id"],
            text=f"🎉 You won! Lucky number: {winner['winning_number']}",
        )
    except Exception:
        pass

approve_handler = CallbackQueryHandler(approve_callback, pattern='approve_')
reject_handler = CallbackQueryHandler(reject_callback, pattern='reject_')