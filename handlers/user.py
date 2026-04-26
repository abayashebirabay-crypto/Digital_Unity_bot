from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from telegram.ext import CommandHandler, ContextTypes, ConversationHandler, MessageHandler, filters
from database import users_collection
from datetime import datetime

# Conversation states
NAME, PHONE, PHONE_MANUAL, LOCATION, LOCATION_MANUAL = range(5)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command - Begin registration"""
    try:
        user_id = update.effective_user.id
        
        if users_collection is None:
            await update.message.reply_text("❌ Database error. Please try again later.")
            return
        
        existing_user = users_collection.find_one({"telegram_id": user_id})
        
        if existing_user and existing_user.get('phone_number'):
            await send_to_web_dashboard(update, context, existing_user)
            return
        
        context.user_data['registration'] = {}
        await update.message.reply_text(
            "🌟 *Welcome to Digital Unity!* 🌟\n\n"
            "To get started, I need some information from you.\n\n"
            "📝 *Step 1 of 3:* Please enter your full name:",
            parse_mode='Markdown'
        )
        return NAME
    except Exception as e:
        print(f"Start error: {e}")
        await update.message.reply_text("❌ An error occurred. Please try again later.")
        return ConversationHandler.END

async def get_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get user's name"""
    try:
        user_name = update.message.text
        context.user_data['registration']['name'] = user_name
        
        phone_keyboard = ReplyKeyboardMarkup([
            [KeyboardButton("📱 Share Phone Number (Auto)")],
            [KeyboardButton("✏️ Enter Number Manually")]
        ], resize_keyboard=True, one_time_keyboard=True)
        
        await update.message.reply_text(
            f"✅ Thanks {user_name}!\n\n"
            f"📞 *Step 2 of 3:* How would you like to provide your phone number?\n\n"
            f"• Auto: Share via Telegram (mobile only)\n"
            f"• Manual: Type your number with country code\n\n"
            f"Example: +251912345678",
            parse_mode='Markdown',
            reply_markup=phone_keyboard
        )
        return PHONE
    except Exception as e:
        print(f"get_name error: {e}")
        await update.message.reply_text("❌ Error. Please type /start to begin again.")
        return ConversationHandler.END

async def get_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get user's phone number choice"""
    choice = update.message.text
    
    if "Auto" in choice or "Share" in choice:
        auto_keyboard = ReplyKeyboardMarkup(
            [[KeyboardButton("📱 Share My Phone Number", request_contact=True)]],
            resize_keyboard=True,
            one_time_keyboard=True
        )
        await update.message.reply_text(
            "Click the button below to share your phone number:",
            reply_markup=auto_keyboard
        )
        return PHONE_MANUAL
    else:
        await update.message.reply_text(
            "📞 Please enter your phone number with country code:\n\n"
            "Example: +251912345678\n\n"
            "Or type /cancel to stop."
        )
        return PHONE_MANUAL

async def get_phone_manual(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get phone number from contact or manual entry"""
    try:
        phone_number = None
        
        if update.message.contact:
            phone_number = update.message.contact.phone_number
        else:
            phone_number = update.message.text.strip()
        
        if not phone_number:
            await update.message.reply_text("❌ Invalid number. Please try again or type /cancel.")
            return PHONE_MANUAL
        
        context.user_data['registration']['phone'] = phone_number
        
        location_keyboard = ReplyKeyboardMarkup([
            [KeyboardButton("📍 Share Location (Auto)")],
            [KeyboardButton("✏️ Enter Location Manually")]
        ], resize_keyboard=True, one_time_keyboard=True)
        
        await update.message.reply_text(
            f"✅ Phone number saved: `{phone_number}`\n\n"
            f"📍 *Step 3 of 3:* How would you like to provide your location?\n\n"
            f"• Auto: Share via Telegram (mobile only)\n"
            f"• Manual: Type your city/area",
            parse_mode='Markdown',
            reply_markup=location_keyboard
        )
        return LOCATION
    except Exception as e:
        print(f"get_phone_manual error: {e}")
        await update.message.reply_text("❌ Error. Please type /start to begin again.")
        return ConversationHandler.END

async def get_location(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get user's location choice"""
    choice = update.message.text
    
    if "Auto" in choice or "Share" in choice:
        auto_keyboard = ReplyKeyboardMarkup(
            [[KeyboardButton("📍 Share My Location", request_location=True)]],
            resize_keyboard=True,
            one_time_keyboard=True
        )
        await update.message.reply_text(
            "Click the button below to share your location:",
            reply_markup=auto_keyboard
        )
        return LOCATION_MANUAL
    else:
        await update.message.reply_text(
            "📍 Please enter your location (city/area):\n\n"
            "Example: Addis Ababa, Ethiopia\n\n"
            "Or type /cancel to stop."
        )
        return LOCATION_MANUAL

async def get_location_manual(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get location from GPS or manual entry and complete registration"""
    try:
        location = update.message.location
        location_text = None
        latitude = None
        longitude = None
        
        if location:
            latitude = location.latitude
            longitude = location.longitude
            location_text = f"GPS: {latitude}, {longitude}"
        else:
            location_text = update.message.text.strip()
        
        if not location_text:
            await update.message.reply_text("❌ Invalid location. Please try again or type /cancel.")
            return LOCATION_MANUAL
        
        user_id = update.effective_user.id
        user_data = context.user_data['registration']
        
        user_document = {
            "telegram_id": user_id,
            "name": user_data['name'],
            "phone_number": user_data['phone'],
            "latitude": latitude,
            "longitude": longitude,
            "location_text": location_text,
            "payment_status": "none",
            "selected_number": None,
            "payment_id": None,
            "payment_image": None,
            "registered_at": datetime.now(),
            "last_active": datetime.now()
        }
        
        existing = users_collection.find_one({"telegram_id": user_id})
        if existing:
            users_collection.update_one({"telegram_id": user_id}, {"$set": user_document})
        else:
            users_collection.insert_one(user_document)
        
        clear_keyboard = ReplyKeyboardMarkup([[]], resize_keyboard=True)
        
        await update.message.reply_text(
            f"✅ *Registration Complete!* ✅\n\n"
            f"Welcome to Digital Unity, {user_data['name']}!\n\n"
            f"📞 Phone: `{user_data['phone']}`\n"
            f"📍 Location: {location_text}\n\n"
            f"🎉 Redirecting you to the game dashboard...",
            parse_mode='Markdown',
            reply_markup=clear_keyboard
        )
        
        await send_to_web_dashboard(update, context, user_document)
        
        admin_id = 1296141395
        try:
            await context.bot.send_message(
                chat_id=admin_id,
                text=f"🆕 *New User Registered!*\n\n👤 Name: {user_data['name']}\n🆔 ID: `{user_id}`\n📞 Phone: {user_data['phone']}\n📍 Location: {location_text}",
                parse_mode='Markdown'
            )
        except:
            pass
        
        return ConversationHandler.END
    except Exception as e:
        print(f"get_location_manual error: {e}")
        await update.message.reply_text(f"❌ Error saving data: {e}")
        return ConversationHandler.END

async def send_to_web_dashboard(update: Update, context: ContextTypes.DEFAULT_TYPE, user):
    """Send user to the web dashboard/game"""
    
    # CHANGE THIS LINE - use your ngrok HTTPS URL
    web_app_url = "https://blot-animal-matcher.ngrok-free.dev"  # ← YOUR NGROK URL
    
    # Create Web App button
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("🎮 Launch Game Mini App", web_app=WebAppInfo(url=web_app_url))],
        [InlineKeyboardButton("💰 Make Payment", callback_data="make_payment")],
        [InlineKeyboardButton("📊 Check Status", callback_data="check_status")]
    ])
    
    await update.message.reply_text(
        f"🎮 *Welcome to Digital Unity Game!* 🎮\n\n"
        f"👤 Player: {user['name']}\n"
        f"📞 Phone: {user.get('phone_number', 'N/A')}\n"
        f"📍 Location: {user.get('location_text', 'Shared')}\n"
        f"💰 Status: {user.get('payment_status', 'none').upper()}\n\n"
        f"✨ *Click the Launch Game Mini App button below!* ✨\n\n"
        f"🎲 Select your lucky number (1-16)!\n\n"
        f"🚀 *Let's play!*",
        parse_mode='Markdown',
        reply_markup=keyboard
    )

async def pay(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /pay command"""
    try:
        user_id = update.effective_user.id
        
        if users_collection is None:
            await update.message.reply_text("❌ Database error.")
            return
        
        user = users_collection.find_one({"telegram_id": user_id})
        
        if not user or not user.get('phone_number'):
            await update.message.reply_text("❌ Please complete registration first!\n\nType /start to register.")
            return
        
        if user.get('payment_status') == 'pending':
            await update.message.reply_text("⏳ You already have a pending payment. Please wait for admin approval.")
        elif user.get('payment_status') == 'approved':
            await update.message.reply_text("✅ Your payment is already approved! Thank you.")
        else:
            await update.message.reply_text(
                "💰 *Payment Instructions*\n\n"
                "1. Send money to:\n"
                "   Bank: CBE\n"
                "   Account: 123456789\n\n"
                "2. Take a screenshot\n\n"
                "3. Send the screenshot here\n\n"
                "📸 Please send your payment screenshot NOW:"
            )
            context.user_data['awaiting_payment'] = True
    except Exception as e:
        print(f"pay error: {e}")
        await update.message.reply_text("❌ An error occurred. Please try again later.")

async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /status command"""
    try:
        user_id = update.effective_user.id
        
        if users_collection is None:
            await update.message.reply_text("❌ Database error.")
            return
        
        user = users_collection.find_one({"telegram_id": user_id})
        
        if not user:
            await update.message.reply_text("❌ Please use /start first")
            return
        
        status_value = user.get('payment_status', 'none')
        messages = {
            'none': "📭 No payment submitted yet.\nUse /pay to submit.",
            'pending': "⏳ Your payment is pending approval.",
            'approved': "✅ Your payment has been approved!",
            'rejected': "❌ Your payment was rejected."
        }
        await update.message.reply_text(messages.get(status_value, "Unknown status"))
    except Exception as e:
        print(f"status error: {e}")
        await update.message.reply_text("❌ Error checking status.")

async def profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /profile command"""
    try:
        user_id = update.effective_user.id
        
        if users_collection is None:
            await update.message.reply_text("❌ Database error.")
            return
        
        user = users_collection.find_one({"telegram_id": user_id})
        
        if not user:
            await update.message.reply_text("❌ Please use /start first")
            return
        
        location = user.get('location_text') or f"GPS: {user.get('latitude')}, {user.get('longitude')}" if user.get('latitude') else "Not provided"
        
        text = f"👤 *Your Profile*\n\n📝 Name: {user.get('name', 'N/A')}\n🆔 ID: `{user['telegram_id']}`\n📞 Phone: {user.get('phone_number', 'N/A')}\n📍 Location: {location}\n💰 Status: {user.get('payment_status', 'none').upper()}"
        await update.message.reply_text(text, parse_mode='Markdown')
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("🎮 Open Game Dashboard", url="http://localhost:8000")]
        ])
        await update.message.reply_text("Click below to open the game:", reply_markup=keyboard)
    except Exception as e:
        print(f"profile error: {e}")
        await update.message.reply_text("❌ Error loading profile.")

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel registration"""
    await update.message.reply_text("❌ Registration cancelled.\n\nType /start to begin again.")
    return ConversationHandler.END

# Conversation handler
registration_conv_handler = ConversationHandler(
    entry_points=[CommandHandler("start", start)],
    states={
        NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_name)],
        PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_phone)],
        PHONE_MANUAL: [MessageHandler(filters.CONTACT | filters.TEXT & ~filters.COMMAND, get_phone_manual)],
        LOCATION: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_location)],
        LOCATION_MANUAL: [MessageHandler(filters.LOCATION | filters.TEXT & ~filters.COMMAND, get_location_manual)],
    },
    fallbacks=[CommandHandler("cancel", cancel)],
)

# Command handlers
pay_handler = CommandHandler("pay", pay)
status_handler = CommandHandler("status", status)
profile_handler = CommandHandler("profile", profile)