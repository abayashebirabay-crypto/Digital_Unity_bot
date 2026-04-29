from telegram import Update
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes
from datetime import datetime

from database import payments_collection, users_collection, get_active_game
from services.game_service import announce_winner


def _parse_payload(payload: str):
    """Parse callback data format: approve_{user_id}_{game_id} or reject_{user_id}_{game_id}"""
    parts = payload.split("_")
    if len(parts) < 3:
        return None, None
    try:
        user_id = int(parts[1])
        game_id = int(parts[2])
        return user_id, game_id
    except (ValueError, IndexError):
        return None, None


async def approve_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle admin approval of payment"""
    query = update.callback_query
    await query.answer()

    user_id, game_id = _parse_payload(query.data)
    if user_id is None:
        await query.edit_message_caption(caption="❌ Invalid approve payload")
        return

    user = users_collection.find_one({"telegram_id": user_id})
    if not user:
        await query.edit_message_caption(caption="❌ User not found")
        return

    active_game = get_active_game()
    
    if game_id != active_game["game_id"]:
        await query.edit_message_caption(
            caption=f"⚠️ Game {game_id} is not active. Current game is {active_game['game_id']}"
        )
        return

    if user.get("selected_game_id") != game_id or not user.get("selected_number"):
        await query.edit_message_caption(
            caption=f"❌ User has no number selected for game {game_id}"
        )
        return

    # Update user payment status
    users_collection.update_one(
        {"telegram_id": user_id},
        {
            "$set": {
                "payment_status": "approved",
                "approved_at": datetime.utcnow(),
                "approved_by": query.from_user.id,
                "updated_at": datetime.utcnow()
            }
        }
    )

    # Update payment record
    payments_collection.update_one(
        {"telegram_id": user_id, "game_id": game_id, "status": "pending"},
        {
            "$set": {
                "status": "approved",
                "approved_at": datetime.utcnow(),
                "approved_by": query.from_user.id,
                "updated_at": datetime.utcnow()
            }
        }
    )

    selected_number = user.get("selected_number")
    price_per_number = active_game.get("price_per_number", 100)

    await query.edit_message_caption(
        caption=query.message.caption + f"\n\n✅ APPROVED by @{query.from_user.username}\n🎲 Number: {selected_number}\n💰 Amount: {price_per_number} ETB",
        reply_markup=None
    )

    try:
        await context.bot.send_message(
            chat_id=user_id,
            text=f"✅ *Payment Approved!*\n\n"
                 f"🎮 Game Round: #{game_id}\n"
                 f"🔢 Your lucky number: *{selected_number}*\n"
                 f"💰 Amount: {price_per_number} ETB\n\n"
                 f"Your number is now locked for this round. Good luck! 🍀",
            parse_mode='Markdown'
        )
    except Exception as e:
        print(f"Could not notify user: {e}")


async def reject_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle admin rejection of payment"""
    query = update.callback_query
    await query.answer()

    user_id, game_id = _parse_payload(query.data)
    if user_id is None:
        await query.edit_message_caption(caption="❌ Invalid reject payload")
        return

    user = users_collection.find_one({"telegram_id": user_id})
    selected_number = user.get("selected_number") if user else None

    users_collection.update_one(
        {"telegram_id": user_id},
        {
            "$set": {
                "payment_status": "rejected",
                "rejected_at": datetime.utcnow(),
                "rejected_by": query.from_user.id,
                "selected_number": None,
                "selected_game_id": None,
                "updated_at": datetime.utcnow()
            }
        }
    )

    payments_collection.update_one(
        {"telegram_id": user_id, "game_id": game_id, "status": "pending"},
        {
            "$set": {
                "status": "rejected",
                "rejected_at": datetime.utcnow(),
                "rejected_by": query.from_user.id,
                "updated_at": datetime.utcnow()
            }
        }
    )

    await query.edit_message_caption(
        caption=query.message.caption + f"\n\n❌ REJECTED by @{query.from_user.username}",
        reply_markup=None
    )

    try:
        await context.bot.send_message(
            chat_id=user_id,
            text=f"❌ *Payment Rejected*\n\n"
                 f"🎮 Game Round: #{game_id}\n"
                 f"🔢 Number {selected_number if selected_number else ''} is now free.\n\n"
                 f"Possible reasons:\n"
                 f"• Unclear screenshot\n"
                 f"• Wrong amount\n"
                 f"• Transaction not found\n\n"
                 f"Please submit again with a clear screenshot.",
            parse_mode='Markdown'
        )
    except Exception as e:
        print(f"Could not notify user: {e}")


async def announce_winner_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin command to announce winner manually"""
    user_id = update.effective_user.id
    ADMIN_ID = 1296141395
    
    if user_id != ADMIN_ID:
        await update.message.reply_text("❌ Admin only command")
        return
    
    winner = announce_winner()
    if not winner:
        await update.message.reply_text("❌ No approved players found for current round.")
        return

    text = (
        "🏆 *WINNER ANNOUNCED!* 🏆\n\n"
        f"🎮 Game Round: #{winner['game_id']}\n"
        f"👤 Username: @{winner.get('username', 'unknown')}\n"
        f"🔢 Lucky number: *{winner['winning_number']}*\n\n"
        f"✨ Round closed. New round started.\n"
        f"💰 All users need to pay again for the next round."
    )
    await update.message.reply_text(text, parse_mode='Markdown')
    
    try:
        await context.bot.send_message(
            chat_id=winner["telegram_id"],
            text=f"🎉 *CONGRATULATIONS!* 🎉\n\n"
                 f"You won round #{winner['game_id']}!\n"
                 f"🔢 Your lucky number: *{winner['winning_number']}*\n\n"
                 f"🏆 You are the champion!",
            parse_mode='Markdown'
        )
    except Exception as e:
        print(f"Could not notify winner: {e}")


# Export handlers (ONLY admin handlers - no payment handlers here)
approve_handler = CallbackQueryHandler(approve_callback, pattern='approve_')
reject_handler = CallbackQueryHandler(reject_callback, pattern='reject_')