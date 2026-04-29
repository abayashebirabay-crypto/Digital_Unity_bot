from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes
from datetime import datetime
import os
import traceback

from database import payments_collection, users_collection, get_active_game
from config import ADMIN_ID, UPLOAD_DIR
from services.game_service import announce_winner


async def check_payments_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Command to check all pending payments"""
    try:
        user_id = update.effective_user.id
        
        print(f"🔍 /check_payments command received from user: {user_id}")
        
        if user_id != ADMIN_ID:
            await update.message.reply_text("❌ Admin only command")
            return
        
        await update.message.reply_text("📋 Fetching pending payments...")
        
        active_game = get_active_game()
        if not active_game:
            await update.message.reply_text("❌ No active game round available.")
            return
        
        pending_payments = list(payments_collection.find(
            {
                "game_id": active_game["game_id"],
                "status": "pending"
            }
        ))
        
        print(f"📊 Found {len(pending_payments)} pending payments")
        
        if not pending_payments:
            await update.message.reply_text("📭 No pending payments at the moment.")
            return
        
        for payment in pending_payments:
            try:
                user = users_collection.find_one({"telegram_id": payment["telegram_id"]})
                
                caption = (
                    f"💰 *Pending Payment*\n\n"
                    f"👤 User: @{user.get('username', 'unknown')}\n"
                    f"🆔 ID: `{payment['telegram_id']}`\n"
                    f"🎮 Game Round: #{payment['game_id']}\n"
                    f"🔢 Number: {payment['number']}\n"
                    f"💰 Amount: {payment['amount']} ETB\n"
                    f"📞 Phone: {user.get('phone_number', 'N/A')}\n"
                    f"🆔 Payment ID: `{payment['payment_id']}`"
                )
                
                keyboard = InlineKeyboardMarkup([
                    [
                        InlineKeyboardButton("✅ Approve", callback_data=f"approve_{payment['telegram_id']}_{payment['game_id']}_{payment['payment_id']}"),
                        InlineKeyboardButton("❌ Reject", callback_data=f"reject_{payment['telegram_id']}_{payment['game_id']}_{payment['payment_id']}")
                    ]
                ])
                
                file_path = payment.get("file_path")
                if file_path and os.path.exists(file_path):
                    with open(file_path, 'rb') as f:
                        await context.bot.send_photo(
                            chat_id=user_id,
                            photo=f,
                            caption=caption,
                            reply_markup=keyboard,
                            parse_mode='Markdown'
                        )
                else:
                    await context.bot.send_message(
                        chat_id=user_id,
                        text=caption,
                        reply_markup=keyboard,
                        parse_mode='Markdown'
                    )
            except Exception as e:
                print(f"Error sending payment {payment.get('payment_id')}: {e}")
                traceback.print_exc()
                continue
                
    except Exception as e:
        print(f"Error in check_payments_command: {e}")
        traceback.print_exc()
        await update.message.reply_text("❌ An error occurred while fetching payments.")


async def approve_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle admin approval of payment"""
    query = update.callback_query
    await query.answer()

    parts = query.data.split("_")
    if len(parts) < 4:
        await query.edit_message_caption(caption="❌ Invalid approve payload")
        return
    
    try:
        user_id = int(parts[1])
        game_id = int(parts[2])
        payment_id = parts[3]
    except (ValueError, IndexError):
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

    payment = payments_collection.find_one({"payment_id": payment_id})
    if not payment:
        await query.edit_message_caption(caption="❌ Payment not found")
        return

    approved_number = payment["number"]

    # Update payment record
    payments_collection.update_one(
        {"payment_id": payment_id},
        {
            "$set": {
                "status": "approved",
                "approved_at": datetime.utcnow(),
                "approved_by": query.from_user.id
            }
        }
    )

    # Add number to user's selected_numbers array
    selected_numbers = user.get("selected_numbers", [])
    if approved_number not in selected_numbers:
        selected_numbers.append(approved_number)
    
    temp_selections = user.get("temp_selected_numbers", [])
    if approved_number in temp_selections:
        temp_selections.remove(approved_number)

    users_collection.update_one(
        {"telegram_id": user_id},
        {
            "$set": {
                "selected_numbers": selected_numbers,
                "temp_selected_numbers": temp_selections,
                "selected_game_id": game_id,
                "payment_status": "approved",
                "approved_at": datetime.utcnow(),
                "approved_by": query.from_user.id,
                "updated_at": datetime.utcnow()
            }
        }
    )

    price_per_number = active_game.get("price_per_number", 100)

    try:
        await query.edit_message_caption(
            caption=query.message.caption + f"\n\n✅ APPROVED by @{query.from_user.username}\n🎲 Number: {approved_number}\n💰 Amount: {price_per_number} ETB",
            reply_markup=None
        )
    except Exception:
        await query.edit_message_text(
            text=query.message.text + f"\n\n✅ APPROVED by @{query.from_user.username}\n🎲 Number: {approved_number}\n💰 Amount: {price_per_number} ETB",
            reply_markup=None
        )

    try:
        await context.bot.send_message(
            chat_id=user_id,
            text=f"✅ *Payment Approved!*\n\n"
                 f"🎮 Game Round: #{game_id}\n"
                 f"🔢 Your lucky number: *{approved_number}*\n"
                 f"💰 Amount: {price_per_number} ETB\n\n"
                 f"Your number is now locked. Good luck! 🍀",
            parse_mode='Markdown'
        )
    except Exception as e:
        print(f"Could not notify user: {e}")


async def reject_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle admin rejection of payment"""
    query = update.callback_query
    await query.answer()

    parts = query.data.split("_")
    if len(parts) < 4:
        await query.edit_message_caption(caption="❌ Invalid reject payload")
        return
    
    try:
        user_id = int(parts[1])
        game_id = int(parts[2])
        payment_id = parts[3]
    except (ValueError, IndexError):
        await query.edit_message_caption(caption="❌ Invalid reject payload")
        return

    user = users_collection.find_one({"telegram_id": user_id})
    
    payment = payments_collection.find_one({"payment_id": payment_id})
    if not payment:
        await query.edit_message_caption(caption="❌ Payment not found")
        return

    rejected_number = payment["number"]

    payments_collection.update_one(
        {"payment_id": payment_id},
        {
            "$set": {
                "status": "rejected",
                "rejected_at": datetime.utcnow(),
                "rejected_by": query.from_user.id
            }
        }
    )

    if user:
        temp_selections = user.get("temp_selected_numbers", [])
        if rejected_number in temp_selections:
            temp_selections.remove(rejected_number)
        
        users_collection.update_one(
            {"telegram_id": user_id},
            {
                "$set": {
                    "temp_selected_numbers": temp_selections,
                    "payment_status": "rejected",
                    "rejected_at": datetime.utcnow(),
                    "rejected_by": query.from_user.id,
                    "updated_at": datetime.utcnow()
                }
            }
        )

    try:
        await query.edit_message_caption(
            caption=query.message.caption + f"\n\n❌ REJECTED by @{query.from_user.username}",
            reply_markup=None
        )
    except Exception:
        await query.edit_message_text(
            text=query.message.text + f"\n\n❌ REJECTED by @{query.from_user.username}",
            reply_markup=None
        )

    try:
        await context.bot.send_message(
            chat_id=user_id,
            text=f"❌ *Payment Rejected*\n\n"
                 f"🎮 Game Round: #{game_id}\n"
                 f"🔢 Number {rejected_number} is now free.\n\n"
                 f"Please submit again with a clear screenshot.",
            parse_mode='Markdown'
        )
    except Exception as e:
        print(f"Could not notify user: {e}")


async def announce_winner_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin command to announce winner manually"""
    user_id = update.effective_user.id
    
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


# IMPORTANT: These are the handlers that get exported
approve_handler = CallbackQueryHandler(approve_callback, pattern='approve_')
reject_handler = CallbackQueryHandler(reject_callback, pattern='reject_')
check_payments_handler = CommandHandler("check_payments", check_payments_command)
announce_winner_handler = CommandHandler("announce_winner", announce_winner_command)