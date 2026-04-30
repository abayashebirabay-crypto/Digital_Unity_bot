import os
import asyncio
import sys
import logging
import traceback
from telegram import Update
from telegram.ext import Application, CallbackQueryHandler, CommandHandler
from config import TOKEN, ADMIN_ID

# Print startup info for debugging
print("=== BOT STARTING ===")
print(f"Python version: {sys.version}")
print(f"BOT_TOKEN set: {bool(os.getenv('BOT_TOKEN'))}")
print(f"MONGO_URL set: {bool(os.getenv('MONGO_URL'))}")
print(f"ADMIN_ID: {os.getenv('ADMIN_ID')}")
print("=== END STARTUP CHECK ===")

# Fix for event loop issues on different platforms
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from handlers.user import (
    app_handler,
    pay_handler,
    payment_handler,
    profile_handler,
    registration_conv_handler,
    start,
    status_handler,
)
from handlers.admin import (
    approve_handler, 
    reject_handler, 
    announce_winner_handler,
    check_payments_handler
)
from handlers.payment import photo_handler

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', 
    level=logging.INFO
)

async def button_callback(update: Update, context):
    """Handle button clicks from main menu (non-admin buttons)"""
    query = update.callback_query
    await query.answer()
    
    if query.data == "make_payment":
        await pay_handler.callback(update, context)
    elif query.data == "check_status":
        await status_handler.callback(update, context)
    elif query.data == "view_profile":
        await profile_handler.callback(update, context)
    else:
        await query.edit_message_text("❌ Unknown option")

async def error_handler(update, context):
    print(f"Error: {context.error}")
    traceback.print_exc()
    if update and update.effective_message:
        await update.effective_message.reply_text("❌ An error occurred. Please try again later.")

def main():
    if not TOKEN or TOKEN == "":
        print("❌ BOT_TOKEN is not set!")
        raise SystemExit("❌ BOT_TOKEN is not set.")
    
    print("🚀 Building application...")
    app = Application.builder().token(TOKEN).build()
    
    # Add handlers
    app.add_handler(CommandHandler("start", start))
    app.add_handler(registration_conv_handler)
    app.add_handler(pay_handler)
    app.add_handler(status_handler)
    app.add_handler(profile_handler)
    app.add_handler(app_handler)
    
    # Admin commands
    app.add_handler(announce_winner_handler)
    app.add_handler(check_payments_handler)
    
    # Payment and callback handlers
    app.add_handler(photo_handler)
    app.add_handler(approve_handler)
    app.add_handler(reject_handler)
    app.add_handler(CallbackQueryHandler(button_callback))
    app.add_error_handler(error_handler)
    
    print(f"🚀 Bot Started! Admin ID: {ADMIN_ID}")
    print(f"📋 Admin Commands:")
    print(f"   • /check_payments - View all pending payments")
    print(f"   • /announce_winner - Announce winner manually")
    
    # Start polling (this runs forever)
    app.run_polling()

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Fatal error: {e}")
        traceback.print_exc()
        sys.exit(1)