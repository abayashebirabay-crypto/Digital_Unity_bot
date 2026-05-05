import os
from urllib.parse import urlparse

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes

from config import ADMIN_ID
from database import (
    approve_withdrawal,
    get_wallet_info,
    get_withdrawal_requests,
    give_channel_bonus,
    request_withdrawal,
    update_referral_bonus_for_game,
)


VERIFY_CHANNEL = os.getenv("VERIFY_CHANNEL", "https://t.me/Unity_J").strip()


def _channel_chat_id_from_link(channel_link: str) -> str:
    value = channel_link.strip()
    if value.startswith("https://t.me/"):
        slug = value.replace("https://t.me/", "", 1).strip("/")
        return f"@{slug}"
    parsed = urlparse(value)
    if parsed.netloc.endswith("t.me") and parsed.path:
        return f"@{parsed.path.strip('/')}"
    return value


def _format_wallet_message(wallet: dict) -> str:
    balance = wallet.get("wallet_balance", 0)
    total = wallet.get("total_earned", 0)
    history = wallet.get("earning_history", [])[:10]
    reg_bonus = "Yes" if wallet.get("registration_bonus_claimed") else "No"
    channel_bonus = "Yes" if wallet.get("channel_bonus_claimed") else "No"
    lines = [
        "Wallet Summary",
        "",
        f"Current balance: {balance} ETB",
        f"Total earned: {total} ETB",
        f"Registration bonus claimed: {reg_bonus}",
        f"Channel bonus claimed: {channel_bonus}",
        "",
        "Recent earnings:",
    ]
    if not history:
        lines.append("- No earnings yet")
    else:
        for item in history:
            lines.append(
                f"- +{item.get('amount', 0)} ETB | {item.get('description', item.get('type', 'earning'))}"
            )
    if balance < 100:
        lines.extend(["", f"Withdrawal not available yet. Need {100 - balance} ETB more."])
    return "\n".join(lines)


async def wallet_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    wallet = get_wallet_info(user_id)
    keyboard = []
    if wallet.get("wallet_balance", 0) >= 100:
        keyboard.append([InlineKeyboardButton("Request Withdrawal (100 ETB)", callback_data="wallet_withdraw_100")])
    keyboard.append([InlineKeyboardButton("Join Channel Bonus", callback_data="wallet_join_channel")])
    await update.message.reply_text(
        _format_wallet_message(wallet),
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def withdraw_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    amount = 100
    if context.args and context.args[0].isdigit():
        amount = int(context.args[0])
    ok, data = request_withdrawal(user_id, amount)
    if not ok:
        await update.message.reply_text(f"Withdrawal request failed: {data}")
        return

    user_name = update.effective_user.username or f"user_{user_id}"
    await update.message.reply_text(
        f"Withdrawal request created.\nRequest ID: {data['request_id']}\nAmount: {amount} ETB"
    )
    try:
        await context.bot.send_message(
            chat_id=ADMIN_ID,
            text=f"Withdrawal Request: @{user_name} wants to withdraw {amount} ETB",
        )
    except Exception:
        pass


async def join_channel_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("Open Channel", url=VERIFY_CHANNEL)],
            [InlineKeyboardButton("I have joined", callback_data="wallet_verify_channel")],
        ]
    )
    await update.message.reply_text(
        "Join our channel first, then tap 'I have joined' to verify and claim 5 ETB.",
        reply_markup=keyboard,
    )


async def wallet_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id

    if query.data == "wallet_join_channel":
        keyboard = InlineKeyboardMarkup(
            [
                [InlineKeyboardButton("Open Channel", url=VERIFY_CHANNEL)],
                [InlineKeyboardButton("I have joined", callback_data="wallet_verify_channel")],
            ]
        )
        await query.message.reply_text("Join channel and verify membership.", reply_markup=keyboard)
        return

    if query.data == "wallet_verify_channel":
        channel_chat_id = _channel_chat_id_from_link(VERIFY_CHANNEL)
        try:
            member = await context.bot.get_chat_member(channel_chat_id, user_id)
            member_ok = member.status in {"member", "administrator", "creator"}
        except Exception:
            member_ok = False
        if not member_ok:
            await query.message.reply_text("Verification failed. Please join the channel and try again.")
            return
        ok, message = give_channel_bonus(user_id)
        await query.message.reply_text("Channel bonus credited: 5 ETB" if ok else message)
        return

    if query.data == "wallet_withdraw_100":
        ok, data = request_withdrawal(user_id, 100)
        if not ok:
            await query.message.reply_text(f"Withdrawal request failed: {data}")
            return
        user_name = query.from_user.username or f"user_{user_id}"
        await query.message.reply_text(f"Withdrawal request submitted.\nRequest ID: {data['request_id']}")
        try:
            await context.bot.send_message(
                chat_id=ADMIN_ID,
                text=f"Withdrawal Request: @{user_name} wants to withdraw 100 ETB",
            )
        except Exception:
            pass

    if query.data.startswith("wallet_mark_paid_"):
        if user_id != ADMIN_ID:
            await query.message.reply_text("Admin only action.")
            return
        request_id = query.data.replace("wallet_mark_paid_", "", 1)
        ok, message = approve_withdrawal(request_id, user_id)
        await query.message.reply_text(message if ok else f"Failed: {message}")


async def admin_withdrawals_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Admin only command")
        return
    rows = get_withdrawal_requests(status="pending")
    if not rows:
        await update.message.reply_text("No pending withdrawals.")
        return
    for row in rows[:20]:
        text = (
            f"Pending Withdrawal\n"
            f"Request ID: {row.get('request_id')}\n"
            f"User: @{row.get('username')}\n"
            f"User ID: {row.get('telegram_id')}\n"
            f"Amount: {row.get('amount')} ETB"
        )
        keyboard = InlineKeyboardMarkup(
            [[InlineKeyboardButton("Mark as Paid", callback_data=f"wallet_mark_paid_{row.get('request_id')}")]]
        )
        await update.message.reply_text(text, reply_markup=keyboard)


async def admin_bonus_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Admin only command")
        return
    if len(context.args) < 2:
        await update.message.reply_text("Usage: /set_bonus <game_id> <bonus_amount>")
        return
    try:
        game_id = int(context.args[0])
        bonus_amount = int(context.args[1])
    except ValueError:
        await update.message.reply_text("game_id and bonus_amount must be numbers.")
        return
    ok, message = update_referral_bonus_for_game(game_id, bonus_amount, update.effective_user.id)
    await update.message.reply_text(message if ok else f"Failed: {message}")


wallet_handler = CommandHandler("wallet", wallet_command)
withdraw_handler = CommandHandler("withdraw", withdraw_command)
join_channel_handler = CommandHandler("join_channel", join_channel_command)
admin_withdrawals_handler = CommandHandler("admin_withdrawals", admin_withdrawals_command)
admin_bonus_handler = CommandHandler("set_bonus", admin_bonus_command)
wallet_callback_handler = CallbackQueryHandler(wallet_callback, pattern=r"^wallet_")
