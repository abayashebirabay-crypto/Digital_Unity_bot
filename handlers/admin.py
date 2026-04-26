from telegram import Update
from telegram.ext import CallbackQueryHandler, ContextTypes
from database import users_collection, payments_collection
from datetime import datetime

async def approve_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user_id = int(query.data.split('_')[1])
    
    users_collection.update_one(
        {"telegram_id": user_id},
        {"$set": {"payment_status": "approved", "approved_at": datetime.now()}}
    )
    
    payments_collection.update_one(
        {"telegram_id": user_id, "status": "pending"},
        {"$set": {"status": "approved", "approved_at": datetime.now()}}
    )
    
    await query.edit_message_caption(caption=query.message.caption + "\n\n✅ APPROVED")
    
    try:
        await context.bot.send_message(
            chat_id=user_id,
            text="✅ Your payment has been approved! Thank you."
        )
    except:
        pass

async def reject_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    user_id = int(query.data.split('_')[1])
    
    users_collection.update_one(
        {"telegram_id": user_id},
        {"$set": {"payment_status": "rejected", "rejected_at": datetime.now()}}
    )
    
    payments_collection.update_one(
        {"telegram_id": user_id, "status": "pending"},
        {"$set": {"status": "rejected", "rejected_at": datetime.now()}}
    )
    
    await query.edit_message_caption(caption=query.message.caption + "\n\n❌ REJECTED")
    
    try:
        await context.bot.send_message(
            chat_id=user_id,
            text="❌ Your payment was rejected. Please contact support."
        )
    except:
        pass

approve_handler = CallbackQueryHandler(approve_callback, pattern='approve_')
reject_handler = CallbackQueryHandler(reject_callback, pattern='reject_')