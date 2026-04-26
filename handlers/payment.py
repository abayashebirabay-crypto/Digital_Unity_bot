from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import MessageHandler, filters, ContextTypes
from database import users_collection, payments_collection
from datetime import datetime
import uuid

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
    
    photo = update.message.photo[-1]
    file_id = photo.file_id
    payment_id = str(uuid.uuid4())
    
    # Save to payments collection
    payment_data = {
        "payment_id": payment_id,
        "telegram_id": user_id,
        "file_id": file_id,
        "status": "pending",
        "created_at": datetime.now(),
        "user_name": user.get('name', 'Unknown'),
        "phone_number": user.get('phone_number', 'Unknown')
    }
    payments_collection.insert_one(payment_data)
    
    # Update user
    users_collection.update_one(
        {"telegram_id": user_id},
        {"$set": {
            "payment_status": "pending",
            "payment_image": file_id,
            "payment_id": payment_id
        }}
    )
    
    await update.message.reply_text(
        f"✅ *Payment Received!*\n\n📸 Screenshot submitted\n🆔 ID: `{payment_id}`\n\n⏳ Waiting for admin approval.\nUse /status to check.",
        parse_mode='Markdown'
    )
    
    context.user_data['awaiting_payment'] = False
    
    # Notify admin
    admin_id = 1296141395
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("✅ Approve", callback_data=f"approve_{user_id}"),
         InlineKeyboardButton("❌ Reject", callback_data=f"reject_{user_id}")]
    ])
    
    try:
        await context.bot.send_photo(
            chat_id=admin_id,
            photo=file_id,
            caption=f"💰 *New Payment*\n\n👤 User: {user.get('name')}\n🆔 ID: `{user_id}`\n📞 Phone: {user.get('phone_number')}",
            reply_markup=keyboard,
            parse_mode='Markdown'
        )
    except:
        pass

photo_handler = MessageHandler(filters.PHOTO, payment_photo_handler)