from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import MessageHandler, filters, ContextTypes
from datetime import datetime
import uuid
import os

from config import ADMIN_ID, UPLOAD_DIR
from database import get_active_game, payments_collection, users_collection


async def payment_photo_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle payment screenshots sent directly to bot"""
    user_id = update.effective_user.id

    if not context.user_data.get('awaiting_payment'):
        await update.message.reply_text("❌ Please use /pay first to initiate a payment.")
        return

    user = users_collection.find_one({"telegram_id": user_id})

    if not user:
        await update.message.reply_text("❌ Please use /start first")
        context.user_data['awaiting_payment'] = False
        return

    active_game = get_active_game()
    active_game_id = active_game["game_id"]
    price_per_number = active_game.get("price_per_number", 100)

    if not active_game.get("is_active", True):
        await update.message.reply_text(
            "❌ No active game round available.\n\n"
            "Please wait for admin to start a new game round."
        )
        context.user_data['awaiting_payment'] = False
        return

    # Get user's temp selected numbers
    temp_selections = user.get("temp_selected_numbers", [])
    if not temp_selections:
        await update.message.reply_text(
            "❌ Please select a lucky number in the Mini App first.\n\n"
            "1. Open the Mini App\n"
            "2. Select your lucky number\n"
            "3. Then send payment screenshot"
        )
        context.user_data['awaiting_payment'] = False
        return
    
    user_selected_number = temp_selections[0] if temp_selections else None
    
    if not user_selected_number:
        await update.message.reply_text(
            "❌ Please select a lucky number in the Mini App first."
        )
        context.user_data['awaiting_payment'] = False
        return

    # Check if user already has pending payment for this number
    existing_pending = payments_collection.find_one({
        "telegram_id": user_id,
        "game_id": active_game_id,
        "number": user_selected_number,
        "status": "pending"
    })
    
    if existing_pending:
        await update.message.reply_text(
            f"⏳ You already have a pending payment for number {user_selected_number}. Please wait for approval."
        )
        context.user_data['awaiting_payment'] = False
        return

    photo = update.message.photo[-1]
    file_id = photo.file_id
    payment_id = str(uuid.uuid4())

    # Download and save photo
    file = await context.bot.get_file(file_id)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, f"{payment_id}.jpg")
    print("UPLOAD_DIR:", UPLOAD_DIR)
    await file.download_to_drive(custom_path=file_path)

    payment_data = {
        "payment_id": payment_id,
        "telegram_id": user_id,
        "game_id": active_game_id,
        "number": user_selected_number,
        "amount": price_per_number,
        "file_id": file_id,
        "file_path": file_path,
        "status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "user_name": user.get('username', 'Unknown'),
        "phone_number": user.get('phone_number', 'Unknown')
    }
    payments_collection.insert_one(payment_data)

    # Remove from temp selections
    temp_selections.remove(user_selected_number)
    users_collection.update_one(
        {"telegram_id": user_id},
        {"$set": {
            "temp_selected_numbers": temp_selections,
            "payment_status": "pending",
            "current_game_id": active_game_id,
            "updated_at": datetime.utcnow(),
        }}
    )

    await update.message.reply_text(
        f"✅ *Payment Received!*\n\n"
        f"📋 Payment ID: `{payment_id}`\n"
        f"🎮 Game Round: #{active_game_id}\n"
        f"🔢 Number: {user_selected_number}\n"
        f"💰 Amount: {price_per_number} ETB\n\n"
        f"⏳ Status: *PENDING*\n\n"
        f"You will be notified once approved.",
        parse_mode='Markdown'
    )

    context.user_data['awaiting_payment'] = False

    # Send to admin with image
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Approve", callback_data=f"approve_{user_id}_{active_game_id}_{payment_id}"),
            InlineKeyboardButton("❌ Reject", callback_data=f"reject_{user_id}_{active_game_id}_{payment_id}")
        ]
    ])

    try:
        with open(file_path, 'rb') as f:
            await context.bot.send_photo(
                chat_id=ADMIN_ID,
                photo=file_id,
                caption=(
                    f"💰 *New Payment Received!*\n\n"
                    f"👤 User: @{user.get('username', 'unknown')}\n"
                    f"🆔 ID: `{user_id}`\n"
                    f"🎮 Game Round: #{active_game_id}\n"
                    f"🔢 Number: {user_selected_number}\n"
                    f"💰 Amount: {price_per_number} ETB\n"
                    f"📞 Phone: {user.get('phone_number', 'N/A')}\n"
                    f"🆔 Payment ID: `{payment_id}`"
                ),
                reply_markup=keyboard,
                parse_mode='Markdown'
            )
    except Exception as e:
        print(f"Could not send photo to admin: {e}")


# Export handler
photo_handler = MessageHandler(filters.PHOTO, payment_photo_handler)