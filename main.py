import logging
from telegram import Update
from telegram.ext import Application, CallbackQueryHandler, CommandHandler
from config import TOKEN, ADMIN_ID
from handlers.user import (
    app_handler,
    pay_handler,
    payment_handler,
    profile_handler,
    registration_conv_handler,
    start,
    status_handler,
)
from handlers.admin import announce_winner_command, approve_handler, reject_handler
from handlers.payment import photo_handler

logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)

async def button_callback(update: Update, context):
    """Handle button clicks from main menu"""
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
    if update and update.effective_message:
        await update.effective_message.reply_text("❌ An error occurred. Please try again later.")

def main():
    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(registration_conv_handler)
    app.add_handler(pay_handler)
    app.add_handler(status_handler)
    app.add_handler(profile_handler)
    app.add_handler(app_handler)
    app.add_handler(CommandHandler("announce_winner", announce_winner_command))
    app.add_handler(photo_handler)
    app.add_handler(approve_handler)
    app.add_handler(reject_handler)
    app.add_handler(CallbackQueryHandler(button_callback))
    app.add_error_handler(error_handler)

    print(f"🚀 Bot Started! Admin ID: {ADMIN_ID}")
    app.run_polling()

if __name__ == "__main__":
    main()