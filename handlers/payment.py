from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import MessageHandler, filters, ContextTypes
from datetime import datetime
import uuid

from config import ADMIN_ID, LUCKY_NUMBER_PRICE_ETB
from database import get_active_game, payments_collection, users_collection

async def payment_photo_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle payment screenshots"""
    user_id = update.effective_user.id

    if not context.user_data.get('awaiting_payment'):
        await update.message.reply_text("❌ Please use /pay first to initiate a payment.")
        return

    user = users_collection.find_one({"telegram_id": user_id})

    if not user:
        await update.message.reply_text("❌ Please use /start first")
        return

    if user.get('payment_status') == 'pending':
        await update.message.reply_text("⏳ You already have a pending payment.")
        context.user_data['awaiting_payment'] = False
        return

    if not user.get("selected_number"):
        await update.message.reply_text("Please choose your lucky number in Mini App first.")
        return

    photo = update.message.photo[-1]
    file_id = photo.file_id
    payment_id = str(uuid.uuid4())
    active_game = get_active_game()

    payment_data = {
        "payment_id": payment_id,
        "telegram_id": user_id,
        "game_id": active_game["game_id"],
        "number": user.get("selected_number"),
        "amount": LUCKY_NUMBER_PRICE_ETB,
        "file_id": file_id,
        "status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "user_name": user.get('username', 'Unknown'),
        "phone_number": user.get('phone_number', 'Unknown')
    }
    payments_collection.insert_one(payment_data)

    users_collection.update_one(
        {"telegram_id": user_id},
        {"$set": {
            "payment_status": "pending",
            "payment_image": file_id,
            "payment_id": payment_id,
            "current_game_id": active_game["game_id"],
            "updated_at": datetime.utcnow(),
        }}
    )

    await update.message.reply_text(
        "✅ Payment received.\n\n"
        f"Payment ID: {payment_id}\n"
        f"Game: {active_game['game_id']}\n"
        f"Number: {user.get('selected_number')}\n\n"
        "Status: PENDING",
        parse_mode='Markdown'
    )

    context.user_data['awaiting_payment'] = False

    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Approve", callback_data=f"approve_{user_id}_{active_game['game_id']}"),
            InlineKeyboardButton("❌ Reject", callback_data=f"reject_{user_id}_{active_game['game_id']}")
        ]
    ])

    try:
        await context.bot.send_photo(
            chat_id=ADMIN_ID,
            photo=file_id,
            caption=(
                "💰 New Payment\n\n"
                f"User: @{user.get('username', 'unknown')}\n"
                f"ID: {user_id}\n"
                f"Game: {active_game['game_id']}\n"
                f"Number: {user.get('selected_number')}\n"
                f"Phone: {user.get('phone_number')}"
            ),
            reply_markup=keyboard,
        )
    except Exception:
        pass

photo_handler = MessageHandler(filters.PHOTO, payment_photo_handler)