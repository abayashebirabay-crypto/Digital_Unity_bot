import os
from typing import Final
from dotenv import load_dotenv
from urllib.parse import quote_plus

# Load .env file for local development
load_dotenv()

# Bot Configuration
TOKEN: Final = os.getenv("BOT_TOKEN")
if not TOKEN:
    raise ValueError("❌ BOT_TOKEN environment variable is required")

# Fix: Safe ADMIN_ID conversion
admin_id_raw = os.getenv("ADMIN_ID", "1296141395")
try:
    ADMIN_ID: Final = int(admin_id_raw)
except ValueError:
    raise ValueError(f"❌ ADMIN_ID must be a number, got '{admin_id_raw}'")

BOT_USERNAME: Final = os.getenv("BOT_USERNAME", "DigitalUnity_bot")

# Database Configuration - Fix for special characters
MONGO_URL_RAW = os.getenv("MONGO_URL", "")
MONGO_USER = os.getenv("MONGO_USER", "")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD", "")
MONGO_CLUSTER = os.getenv("MONGO_CLUSTER", "cluster0.mryt6.mongodb.net")

# Construct MongoDB URL properly
if MONGO_URL_RAW:
    # Use direct URL if provided
    MONGO_URL: Final = MONGO_URL_RAW
elif MONGO_USER and MONGO_PASSWORD:
    # Encode password for special characters like @, ?, #, etc.
    encoded_password = quote_plus(MONGO_PASSWORD)
    MONGO_URL: Final = f"mongodb+srv://{MONGO_USER}:{encoded_password}@{MONGO_CLUSTER}/digital_unity?retryWrites=true&w=majority"
else:
    MONGO_URL: Final = ""

DB_NAME: Final = os.getenv("DB_NAME", "digital_unity")

# Web App URL
WEB_APP_URL: Final = os.getenv("WEB_APP_URL", "https://digital-unity-bot.vercel.app/")

# File Upload Configuration
UPLOAD_DIR: Final = os.getenv("UPLOAD_DIR", "uploads")
WINNER_TOP_LIMIT: Final = int(os.getenv("WINNER_TOP_LIMIT", "10"))

# Lucky number setup
MIN_LUCKY_NUMBER: Final = 1
MAX_LUCKY_NUMBER: Final = 999

# Safe integer conversion with validation
def safe_int_env(var_name: str, default: int) -> int:
    val = os.getenv(var_name)
    if val is None:
        return default
    try:
        return int(val)
    except ValueError:
        print(f"⚠️ Warning: Invalid {var_name}='{val}', using default {default}")
        return default

LUCKY_NUMBER_PRICE_ETB: Final = safe_int_env("LUCKY_NUMBER_PRICE_ETB", 100)
REFERRAL_POINTS_PER_USER: Final = safe_int_env("REFERRAL_POINTS_PER_USER", 10)

# Validate required environment variables
if not MONGO_URL:
    raise ValueError("❌ MONGO_URL environment variable is required (either MONGO_URL or MONGO_USER+MONGO_PASSWORD)")

# Debug info (remove in production)
print(f"✅ Configuration loaded successfully")
print(f"🤖 Bot: @{BOT_USERNAME}")
print(f"👤 Admin ID: {ADMIN_ID}")
print(f"💾 Database: {DB_NAME}")
print(f"💰 Price per number: {LUCKY_NUMBER_PRICE_ETB} ETB")
print(f"🔗 MongoDB: {MONGO_URL[:50]}...")  # Only show first 50 chars for security