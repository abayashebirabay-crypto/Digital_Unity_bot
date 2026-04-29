from datetime import datetime
from typing import Optional, Dict, Any

from pymongo import ASCENDING, DESCENDING, MongoClient, ReturnDocument
from pymongo.errors import DuplicateKeyError

from config import DB_NAME, MONGO_URL, LUCKY_NUMBER_PRICE_ETB, MIN_LUCKY_NUMBER, MAX_LUCKY_NUMBER

client: Optional[MongoClient] = None
db = None
users_collection = None
payments_collection = None
games_collection = None
winners_collection = None
announcements_collection = None


def init_db():
    global client, db, users_collection, payments_collection, games_collection, winners_collection, announcements_collection
    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=8000, maxPoolSize=60)
        client.admin.command("ping")
        print("✅ MongoDB connected successfully")
        db = client[DB_NAME]
        users_collection = db["users"]
        payments_collection = db["payments"]
        games_collection = db["games"]
        winners_collection = db["winners"]
        announcements_collection = db["announcements"]
        ensure_indexes()
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        raise


def ensure_indexes():
    """Create all necessary database indexes for performance"""
    # Users collection indexes
    users_collection.create_index("telegram_id", unique=True)
    users_collection.create_index("username")
    users_collection.create_index("referral_code", unique=True)
    users_collection.create_index("invited_by")
    users_collection.create_index([("updated_at", DESCENDING)])
    users_collection.create_index([("payment_status", ASCENDING)])
    users_collection.create_index([("selected_game_id", ASCENDING), ("selected_numbers", ASCENDING)])
    users_collection.create_index([("current_game_id", ASCENDING)])

    # Payments collection indexes
    payments_collection.create_index([("telegram_id", ASCENDING), ("game_id", ASCENDING)])
    payments_collection.create_index("status")
    payments_collection.create_index([("created_at", DESCENDING)])
    payments_collection.create_index([("game_id", ASCENDING), ("status", ASCENDING)])

    # Games collection indexes
    games_collection.create_index("game_id", unique=True)
    games_collection.create_index("is_active")
    games_collection.create_index([("created_at", DESCENDING)])

    # Winners collection indexes
    winners_collection.create_index([("game_id", ASCENDING), ("created_at", DESCENDING)])
    winners_collection.create_index("telegram_id")
    winners_collection.create_index([("game_id", ASCENDING), ("place", ASCENDING)])

    # Announcements collection indexes
    announcements_collection.create_index([("created_at", DESCENDING)])


def get_active_game() -> Optional[Dict[str, Any]]:
    """Get the current active game, or None if no active game exists"""
    # Find a game that is active AND has no winners selected
    game = games_collection.find_one({
        "is_active": True,
        "winners_selected": {"$ne": True}
    })
    
    if game:
        return game
    
    # Check if any game exists at all
    any_game = games_collection.find_one({}, sort=[("game_id", -1)])
    
    if any_game:
        # There are games but none active - return None
        print(f"⚠️ No active game found. Last game was #{any_game['game_id']}")
        return None
    
    # No games exist at all - create first game
    game = {
        "game_id": 1,
        "round": 1,
        "is_active": True,
        "winners_selected": False,
        "price_per_number": LUCKY_NUMBER_PRICE_ETB,
        "min_number": MIN_LUCKY_NUMBER,
        "max_number": MAX_LUCKY_NUMBER,
        "total_numbers": MAX_LUCKY_NUMBER - MIN_LUCKY_NUMBER + 1,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    games_collection.insert_one(game)
    print(f"🎮 Created initial game: Round {game['round']}")
    return game
def create_new_game(price_per_number: Optional[int] = None, min_number: Optional[int] = None, max_number: Optional[int] = None) -> Dict[str, Any]:
    """Create a new game round for the next round"""
    # Get the highest game_id
    last_game = games_collection.find_one({}, sort=[("game_id", -1)])
    
    if not last_game:
        new_game_id = 1
        # Deactivate any game that might be active (safety)
        games_collection.update_many({}, {"$set": {"is_active": False}})
    else:
        # Deactivate current active game
        games_collection.update_many({}, {"$set": {"is_active": False}})
        new_game_id = last_game["game_id"] + 1
    
    # Create new game
    new_game = {
        "game_id": new_game_id,
        "round": new_game_id,
        "is_active": True,
        "winners_selected": False,
        "price_per_number": price_per_number if price_per_number is not None else LUCKY_NUMBER_PRICE_ETB,
        "min_number": min_number if min_number is not None else MIN_LUCKY_NUMBER,
        "max_number": max_number if max_number is not None else MAX_LUCKY_NUMBER,
        "total_numbers": (max_number or MAX_LUCKY_NUMBER) - (min_number or MIN_LUCKY_NUMBER) + 1,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    
    # Check if game already exists
    existing = games_collection.find_one({"game_id": new_game_id})
    if existing:
        # Update existing game to active
        games_collection.update_one(
            {"game_id": new_game_id},
            {"$set": {"is_active": True, "winners_selected": False, "ended_at": None, "updated_at": datetime.utcnow()}}
        )
        print(f"🎮 Reactivated existing game: Round {new_game_id}")
        return games_collection.find_one({"game_id": new_game_id})
    
    games_collection.insert_one(new_game)
    print(f"🎮 Created new game: Round {new_game['round']}, Price: {new_game['price_per_number']} ETB")
    
    return new_game

def rotate_game():
    """Legacy function - creates new game and marks old as inactive"""
    active = get_active_game()
    old_game_id = active["game_id"]

    # Mark old game as inactive
    games_collection.update_one(
        {"game_id": old_game_id},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )

    # Create new game with same config
    next_game = {
        "game_id": old_game_id + 1,
        "round": old_game_id + 1,
        "is_active": True,
        "price_per_number": active.get("price_per_number", LUCKY_NUMBER_PRICE_ETB),
        "min_number": active.get("min_number", MIN_LUCKY_NUMBER),
        "max_number": active.get("max_number", MAX_LUCKY_NUMBER),
        "total_numbers": active.get("total_numbers", MAX_LUCKY_NUMBER - MIN_LUCKY_NUMBER + 1),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    games_collection.insert_one(next_game)
    return next_game


def get_game_by_id(game_id: int) -> Optional[Dict[str, Any]]:
    """Get game configuration by game_id"""
    return games_collection.find_one({"game_id": game_id})


def get_all_games(limit: int = 10, skip: int = 0) -> list:
    """Get all games (for admin panel)"""
    return list(games_collection.find({}, {"_id": 0}).sort("game_id", DESCENDING).skip(skip).limit(limit))


def update_game_config(game_id: int, config: Dict[str, Any]) -> bool:
    """Update game configuration (admin only)"""
    result = games_collection.update_one(
        {"game_id": game_id},
        {"$set": {**config, "updated_at": datetime.utcnow()}}
    )
    return result.modified_count > 0


def get_user_for_game(telegram_id: int, game_id: int) -> Optional[Dict[str, Any]]:
    """Get user's selection and payment status for a specific game"""
    user = users_collection.find_one({"telegram_id": telegram_id}, {"_id": 0})
    if not user:
        return None

    # Check if user's selected numbers are for this game
    selected_numbers = []
    if user.get("selected_game_id") == game_id:
        selected_numbers = user.get("selected_numbers", [])

    return {
        "telegram_id": user["telegram_id"],
        "username": user.get("username"),
        "selected_numbers": selected_numbers,
        "selected_game_id": user.get("selected_game_id"),
        "payment_status": user.get("payment_status") if user.get("current_game_id") == game_id else "none"
    }


def get_taken_numbers_for_game(game_id: int) -> Dict[int, int]:
    """Get all taken numbers for a specific game (telegram_id -> number)"""
    taken_payments = payments_collection.find(
        {
            "game_id": game_id,
            "status": {"$in": ["pending", "approved"]}
        },
        {"number": 1, "telegram_id": 1}
    )
    taken_numbers = {}
    for p in taken_payments:
        num = p.get('number')
        if num:
            taken_numbers[num] = p['telegram_id']
    return taken_numbers


def reset_users_for_new_game(game_id: int):
    """Reset all users from previous game to start fresh"""
    result = users_collection.update_many(
        {
            "current_game_id": {"$lt": game_id},
            "payment_status": {"$in": ["approved", "rejected"]}
        },
        {
            "$set": {
                "payment_status": "none",
                "selected_numbers": [],
                "selected_game_id": None,
                "updated_at": datetime.utcnow()
            }
        }
    )
    return result.modified_count


def get_payment_statistics() -> Dict[str, Any]:
    """Get overall payment statistics"""
    total_payments = payments_collection.count_documents({})
    pending_payments = payments_collection.count_documents({"status": "pending"})
    approved_payments = payments_collection.count_documents({"status": "approved"})
    rejected_payments = payments_collection.count_documents({"status": "rejected"})

    total_amount_approved = payments_collection.aggregate([
        {"$match": {"status": "approved"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ])
    total_amount = list(total_amount_approved)
    total_approved_amount = total_amount[0]["total"] if total_amount else 0

    return {
        "total_payments": total_payments,
        "pending_payments": pending_payments,
        "approved_payments": approved_payments,
        "rejected_payments": rejected_payments,
        "total_approved_amount": total_approved_amount
    }


def get_winner_statistics() -> Dict[str, Any]:
    """Get winner statistics"""
    total_winners = winners_collection.count_documents({})

    # Top winners by number of wins
    top_winners = list(winners_collection.aggregate([
        {"$group": {"_id": "$telegram_id", "username": {"$first": "$username"}, "wins": {"$sum": 1}}},
        {"$sort": {"wins": -1}},
        {"$limit": 10}
    ]))

    # Total prize distributed
    total_prize = winners_collection.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$prize_amount"}}}
    ])
    total_prize_amount = list(total_prize)
    total_prize_distributed = total_prize_amount[0]["total"] if total_prize_amount else 0

    return {
        "total_winners": total_winners,
        "top_winners": top_winners,
        "total_prize_distributed": total_prize_distributed
    }


def get_game_statistics() -> Dict[str, Any]:
    """Get game statistics"""
    active_game = get_active_game()
    total_games = games_collection.count_documents({})
    completed_games = games_collection.count_documents({"is_active": False})

    # Number of approved users for current game
    approved_for_current = users_collection.count_documents({
        "payment_status": "approved",
        "current_game_id": active_game["game_id"]
    })

    # Numbers locked for current game
    numbers_locked = users_collection.count_documents({
        "selected_game_id": active_game["game_id"],
        "selected_numbers": {"$ne": []}
    })

    return {
        "active_game_id": active_game["game_id"],
        "active_game_round": active_game.get("round", active_game["game_id"]),
        "total_games": total_games,
        "completed_games": completed_games,
        "approved_for_current_game": approved_for_current,
        "numbers_locked_current_game": numbers_locked,
        "price_per_number": active_game.get("price_per_number", LUCKY_NUMBER_PRICE_ETB)
    }


def mark_user_active(telegram_id: int):
    """Update user's last_active timestamp"""
    users_collection.find_one_and_update(
        {"telegram_id": telegram_id},
        {"$set": {"last_active": datetime.utcnow(), "updated_at": datetime.utcnow()}},
        return_document=ReturnDocument.AFTER,
    )


# Initialize database on import
init_db()