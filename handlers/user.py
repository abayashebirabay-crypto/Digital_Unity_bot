from telegram import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, Update, WebAppInfo
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes, ConversationHandler, MessageHandler, filters

from config import ADMIN_ID, BOT_USERNAME, WEB_APP_URL
from database import mark_user_active, users_collection
from services.game_service import upsert_user

PHONE, LOCATION = range(2)


def _extract_referrer_from_start(start_param: str):
    if not start_param:
        return None
    if start_param.startswith("ref_"):
        raw = start_param.replace("ref_", "", 1)
        if raw.isdigit():
            return int(raw)
    return None


def build_launch_keyboard(user_id: int):
    web_app_url_with_user = f"{WEB_APP_URL}?user_id={user_id}"
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("🚀 Launch Mini App", web_app=WebAppInfo(url=web_app_url_with_user))],
        ]
    )

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    args = context.args or []
    start_param = args[0] if args else ""
    referrer_id = _extract_referrer_from_start(start_param)

    existing = users_collection.find_one({"telegram_id": user.id})
    
    if existing and existing.get("phone_number") and existing.get("location_text"):
        mark_user_active(user.id)
        # Only ONE message with ONLY Launch Mini App button
        await update.message.reply_text(
            "Welcome back to Digital Unity.\n\nTap below to open your dashboard.",
            reply_markup=build_launch_keyboard(user.id),
        )
        return ConversationHandler.END

    # New user registration flow
    context.user_data["registration"] = {
        "username": user.username or f"user_{user.id}",
        "phone_number": None,
        "location_text": None,
        "invited_by": referrer_id if referrer_id != user.id else None,
    }
    await update.message.reply_text(
        "🎓 *Digital Unity Platform*\n\n"
        "University-level lucky number voting with transparent payment verification, secure winner selection, and live referral rewards.\n\n"
        "Tap *Start Registration* to continue.",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(
            [[InlineKeyboardButton("▶️ Start Registration", callback_data="begin_registration")]]
        ),
    )
    return ConversationHandler.END


async def begin_registration_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    user = query.from_user
    reg = context.user_data.get("registration", {})
    reg["username"] = user.username or f"user_{user.id}"
    context.user_data["registration"] = reg

    kb = ReplyKeyboardMarkup(
        [[KeyboardButton("📱 Share Phone Number", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )
    await query.message.reply_text(
        f"Username: @{reg['username']}\n\nNow share your phone number.",
        reply_markup=kb,
    )
    return PHONE


async def get_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    reg = context.user_data.get("registration", {})
    if update.message.contact and update.message.contact.phone_number:
        reg["phone_number"] = update.message.contact.phone_number
    else:
        reg["phone_number"] = update.message.text.strip()

    kb = ReplyKeyboardMarkup(
        [[KeyboardButton("📍 Share Location", request_location=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )
    await update.message.reply_text(
        f"Phone: {reg['phone_number']}\n\nNow share your location.",
        reply_markup=kb,
    )
    context.user_data["registration"] = reg
    return LOCATION


async def get_location(update: Update, context: ContextTypes.DEFAULT_TYPE):
    reg = context.user_data.get("registration", {})
    if update.message.location:
        loc = update.message.location
        reg["location_text"] = f"{loc.latitude:.5f}, {loc.longitude:.5f}"
    else:
        reg["location_text"] = update.message.text.strip()

    created_user = upsert_user(
        telegram_id=update.effective_user.id,
        username=reg["username"],
        phone_number=reg["phone_number"],
        location_text=reg["location_text"],
        invited_by=reg.get("invited_by"),
    )
    context.user_data["registration"] = {}

    await update.message.reply_text(
        "✅ Registration completed.\n\n"
        f"Username: @{created_user['username']}\n"
        f"Phone: {created_user['phone_number']}\n"
        f"Location: {created_user['location_text']}\n\n"
        "Tap Launch Mini App to continue.",
        reply_markup=build_launch_keyboard(update.effective_user.id),
    )

    try:
        await context.bot.send_message(
            chat_id=ADMIN_ID,
            text=(
                "🆕 New registration\n"
                f"ID: {created_user['telegram_id']}\n"
                f"Username: @{created_user['username']}\n"
                f"Phone: {created_user['phone_number']}\n"
                f"Location: {created_user['location_text']}"
            ),
        )
    except Exception:
        pass

    return ConversationHandler.END


async def referral_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    user = users_collection.find_one({"telegram_id": user_id}, {"_id": 0})
    
    if not user:
        await update.message.reply_text("Please register first with /start")
        return
    
    deep_link = f"https://t.me/{BOT_USERNAME}?start=ref_{user_id}"
    
    message = (
        f"🔗 *Your Referral Stats*\n\n"
        f"📋 Referral Code: `{user.get('referral_code')}`\n"
        f"👥 Friends Joined: {user.get('referral_count', 0)}\n"
        f"⭐ Referral Points: {user.get('referral_points', 0)}\n\n"
        f"🎁 *How it works:*\n"
        f"• Share your unique link with friends\n"
        f"• When they register, you get points\n"
        f"• Points can be redeemed for prizes!\n\n"
        f"🔗 Your invite link:\n"
        f"`{deep_link}`"
    )
    
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("📤 Share Link", url=f"https://t.me/share/url?url={deep_link}&text=Join%20me%20on%20Digital%20Unity%20Campus%20Voting!")]
    ])
    
    await update.message.reply_text(message, parse_mode='Markdown', reply_markup=keyboard)

async def app_link(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Open Mini App:",
        reply_markup=build_launch_keyboard(update.effective_user.id),
    )

async def pay(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Upload payment screenshot here, then admin will review.\n"
        "You can also submit from Mini App.",
    )
    context.user_data["awaiting_payment"] = True


async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = users_collection.find_one({"telegram_id": update.effective_user.id}, {"_id": 0})
    if not user:
        await update.message.reply_text("No profile found. Use /start.")
        return
    await update.message.reply_text(
        f"Game: {user.get('current_game_id', 1)}\n"
        f"Payment: {user.get('payment_status', 'none').upper()}\n"
        f"Number: {user.get('selected_number') or '-'}"
    )


async def profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = users_collection.find_one({"telegram_id": update.effective_user.id}, {"_id": 0})
    if not user:
        await update.message.reply_text("No profile found. Use /start.")
        return
    await update.message.reply_text(
        f"Username: @{user.get('username', 'unknown')}\n"
        f"Phone: {user.get('phone_number', '-')}\n"
        f"Location: {user.get('location_text', '-')}\n"
        f"Referral points: {user.get('referral_points', 0)}\n"
        f"Payment: {user.get('payment_status', 'none').upper()}",
        reply_markup=build_launch_keyboard(update.effective_user.id),
    )

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Registration cancelled. Use /start to begin again.")
    return ConversationHandler.END


registration_conv_handler = ConversationHandler(
    entry_points=[
        CommandHandler("register", start),
        CallbackQueryHandler(begin_registration_callback, pattern="begin_registration"),
    ],
    states={
        PHONE: [MessageHandler((filters.CONTACT | filters.TEXT) & ~filters.COMMAND, get_phone)],
        LOCATION: [MessageHandler((filters.LOCATION | filters.TEXT) & ~filters.COMMAND, get_location)],
    },
    fallbacks=[CommandHandler("cancel", cancel)],
)

pay_handler = CommandHandler("pay", pay)
payment_handler = CommandHandler("payment", pay)
status_handler = CommandHandler("status", status)
profile_handler = CommandHandler("profile", profile)
app_handler = CommandHandler("app", app_link)