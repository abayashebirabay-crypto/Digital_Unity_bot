from datetime import datetime
from typing import Optional

from pymongo import ASCENDING, DESCENDING, MongoClient, ReturnDocument

from config import DB_NAME, MONGO_URL

client: Optional[MongoClient] = None
db = None
users_collection = None
payments_collection = None
games_collection = None
winners_collection = None
announcements_collection = None


def init_db():
    global client, db, users_collection, payments_collection, games_collection, winners_collection, announcements_collection
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=8000, maxPoolSize=60)
    client.admin.command("ping")
    db = client[DB_NAME]
    users_collection = db["users"]
    payments_collection = db["payments"]
    games_collection = db["games"]
    winners_collection = db["winners"]
    announcements_collection = db["announcements"]
    ensure_indexes()


def ensure_indexes():
    users_collection.create_index("telegram_id", unique=True)
    users_collection.create_index("username")
    users_collection.create_index("referral_code", unique=True)
    users_collection.create_index("invited_by")
    users_collection.create_index([("updated_at", DESCENDING)])

    payments_collection.create_index([("telegram_id", ASCENDING), ("game_id", ASCENDING)])
    payments_collection.create_index("status")
    payments_collection.create_index([("created_at", DESCENDING)])

    games_collection.create_index("game_id", unique=True)
    games_collection.create_index("is_active")
    games_collection.create_index([("created_at", DESCENDING)])

    winners_collection.create_index([("game_id", ASCENDING), ("created_at", DESCENDING)])
    winners_collection.create_index("telegram_id")

    announcements_collection.create_index([("created_at", DESCENDING)])


def get_active_game():
    game = games_collection.find_one({"is_active": True})
    if game:
        return game

    game = {
        "game_id": 1,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    games_collection.insert_one(game)
    return game


def rotate_game():
    active = get_active_game()
    old_game_id = active["game_id"]
    games_collection.update_one(
        {"game_id": old_game_id},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}},
    )
    next_game = {
        "game_id": old_game_id + 1,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    games_collection.insert_one(next_game)
    return next_game


def mark_user_active(telegram_id: int):
    users_collection.find_one_and_update(
        {"telegram_id": telegram_id},
        {"$set": {"last_active": datetime.utcnow(), "updated_at": datetime.utcnow()}},
        return_document=ReturnDocument.AFTER,
    )


init_db()