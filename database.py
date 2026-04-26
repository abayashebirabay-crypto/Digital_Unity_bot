from pymongo import MongoClient
from typing import Final, Optional

# MongoDB Connection
MONGO_URL: Final = "mongodb+srv://abeyashebir:pOv4fI2dlf4j4UnM@cluster0.mryt6.mongodb.net/digital_unity"

# Create client with error handling
client: Optional[MongoClient] = None
db = None
users_collection = None
payments_collection = None

try:
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    # Test connection
    client.admin.command('ping')
    print("✅ MongoDB connected successfully")
    
    # Database and collections
    db = client["digital_unity"]
    users_collection = db["users"]
    payments_collection = db["payments"]
    
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    client = None
    db = None
    users_collection = None
    payments_collection = None