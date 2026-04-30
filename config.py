import os
from typing import Final
from dotenv import load_dotenv

# Load .env file for local development
load_dotenv()

# Bot Configuration
TOKEN: Final = os.getenv("BOT_TOKEN", "")
ADMIN_ID: Final = int(os.getenv("ADMIN_ID", "1296141395"))
BOT_USERNAME: Final = os.getenv("BOT_USERNAME", "@DigitalUnity_bot")

# Database Configuration
MONGO_URL: Final = os.getenv("MONGO_URL", "")
DB_NAME: Final = os.getenv("DB_NAME", "digital_unity")

# Web App URL
WEB_APP_URL: Final = os.getenv("WEB_APP_URL", "https://digital-unity-bot.vercel.app/")

# File Upload Configuration
UPLOAD_DIR: Final = os.getenv("UPLOAD_DIR", "uploads")
WINNER_TOP_LIMIT: Final = int(os.getenv("WINNER_TOP_LIMIT", "10"))

# Lucky number setup
MIN_LUCKY_NUMBER: Final = 1
MAX_LUCKY_NUMBER: Final = 999
LUCKY_NUMBER_PRICE_ETB: Final = int(os.getenv("LUCKY_NUMBER_PRICE_ETB", "100"))

# Referral setup
REFERRAL_POINTS_PER_USER: Final = int(os.getenv("REFERRAL_POINTS_PER_USER", "10"))

# Validate required environment variables
if not TOKEN:
    raise ValueError("BOT_TOKEN environment variable is required")
if not MONGO_URL:
    raise ValueError("MONGO_URL environment variable is required")

print(f"✅ Configuration loaded successfully")