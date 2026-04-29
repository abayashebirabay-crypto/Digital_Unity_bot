import os
from typing import Final

TOKEN: Final = os.getenv("BOT_TOKEN", "8664076774:AAHdZZvOPwgVKpJR0bTzOJ1P8Ynswv1jtYQ")
ADMIN_ID: Final = int(os.getenv("ADMIN_ID", "1296141395"))
MONGO_URL: Final = os.getenv(
    "MONGO_URL",
    "mongodb+srv://abeyashebir:pOv4fI2dlf4j4UnM@cluster0.mryt6.mongodb.net/digital_unity",
)
DB_NAME: Final = os.getenv("DB_NAME", "digital_unity")

# Public mini app URL (must be https in production)
# Public mini app URL (must be https in production)
WEB_APP_URL = "https://blot-animal-matcher.ngrok-free.dev"  # Use YOUR port number
BOT_USERNAME: Final = os.getenv("BOT_USERNAME", "@DigitalUnity_bot")

UPLOAD_DIR: Final = os.getenv("UPLOAD_DIR", "uploads")
WINNER_TOP_LIMIT: Final = int(os.getenv("WINNER_TOP_LIMIT", "10"))

# Lucky number setup
MIN_LUCKY_NUMBER: Final = 1
MAX_LUCKY_NUMBER: Final = 999
LUCKY_NUMBER_PRICE_ETB: Final = int(os.getenv("LUCKY_NUMBER_PRICE_ETB", "100"))

# Referral setup
REFERRAL_POINTS_PER_USER: Final = int(os.getenv("REFERRAL_POINTS_PER_USER", "10"))