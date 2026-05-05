from datetime import datetime
from typing import Optional, Dict, Any
import uuid

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
game_bonuses_collection = None
wallet_migrations_collection = None


def init_db():
    global client, db, users_collection, payments_collection, games_collection, winners_collection, announcements_collection, game_bonuses_collection, wallet_migrations_collection
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
        game_bonuses_collection = db["game_bonuses"]
        wallet_migrations_collection = db["wallet_migrations"]
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
    game_bonuses_collection.create_index("game_id", unique=True)
    wallet_migrations_collection.create_index("key", unique=True)


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


# ============= WALLET FUNCTIONS (ADD ONLY) =============

def _wallet_defaults() -> Dict[str, Any]:
    return {
        "wallet_balance": 0,
        "total_earned": 0,
        "registration_bonus_claimed": False,
        "channel_bonus_claimed": False,
        "withdrawal_requests": [],
        "earning_history": [],
    }


def init_wallet_for_user(telegram_id: int):
    """Initialize wallet fields for user if missing."""
    users_collection.update_one(
        {"telegram_id": telegram_id},
        {
            "$setOnInsert": _wallet_defaults(),
            "$set": {"updated_at": datetime.utcnow()},
        },
        upsert=False,
    )
    users_collection.update_one(
        {"telegram_id": telegram_id, "wallet_balance": {"$exists": False}},
        {"$set": {**_wallet_defaults(), "updated_at": datetime.utcnow()}},
    )


def _push_earning(telegram_id: int, earning: Dict[str, Any], amount: int):
    users_collection.update_one(
        {"telegram_id": telegram_id},
        {
            "$inc": {"wallet_balance": amount, "total_earned": amount},
            "$push": {
                "earning_history": {
                    "$each": [earning],
                    "$position": 0,
                    "$slice": 200,
                }
            },
            "$set": {"updated_at": datetime.utcnow()},
        },
    )


def give_registration_bonus(telegram_id: int):
    """Give one-time 5 ETB registration bonus."""
    init_wallet_for_user(telegram_id)
    user = users_collection.find_one({"telegram_id": telegram_id}, {"registration_bonus_claimed": 1, "username": 1})
    if not user or user.get("registration_bonus_claimed"):
        return False, "Registration bonus already claimed"

    amount = 5
    _push_earning(
        telegram_id,
        {
            "type": "registration_bonus",
            "amount": amount,
            "from_user": user.get("username", ""),
            "payment_amount": 0,
            "date": datetime.utcnow(),
            "description": "Registration bonus credited",
        },
        amount,
    )
    users_collection.update_one(
        {"telegram_id": telegram_id},
        {"$set": {"registration_bonus_claimed": True, "updated_at": datetime.utcnow()}},
    )
    return True, "Registration bonus credited"


def give_channel_bonus(telegram_id: int):
    """Give one-time 5 ETB channel bonus."""
    init_wallet_for_user(telegram_id)
    user = users_collection.find_one({"telegram_id": telegram_id}, {"channel_bonus_claimed": 1, "username": 1})
    if not user or user.get("channel_bonus_claimed"):
        return False, "Channel bonus already claimed"

    amount = 5
    _push_earning(
        telegram_id,
        {
            "type": "channel_bonus",
            "amount": amount,
            "from_user": user.get("username", ""),
            "payment_amount": 0,
            "date": datetime.utcnow(),
            "description": "Channel join bonus credited",
        },
        amount,
    )
    users_collection.update_one(
        {"telegram_id": telegram_id},
        {"$set": {"channel_bonus_claimed": True, "updated_at": datetime.utcnow()}},
    )
    return True, "Channel bonus credited"


def get_referral_bonus_for_game(game_id: int):
    """Get referral bonus amount for a game. Defaults to 5 ETB."""
    row = game_bonuses_collection.find_one({"game_id": game_id}, {"referral_bonus_amount": 1})
    if not row:
        return 5
    return int(row.get("referral_bonus_amount", 5))


def update_referral_bonus_for_game(game_id: int, bonus_amount: int, admin_id: int):
    """Upsert referral bonus amount for a specific game."""
    if bonus_amount < 1:
        return False, "Bonus amount must be at least 1 ETB"
    game_bonuses_collection.update_one(
        {"game_id": game_id},
        {
            "$set": {
                "game_id": game_id,
                "referral_bonus_amount": int(bonus_amount),
                "updated_at": datetime.utcnow(),
                "updated_by": admin_id,
            }
        },
        upsert=True,
    )
    return True, "Referral bonus updated"


def give_referral_payment_bonus(referrer_id: int, referred_user_id: int, payment_amount: int, game_id: int):
    """Give referrer configurable bonus after referred user's approved payment."""
    init_wallet_for_user(referrer_id)
    marker_key = f"referral_bonus:{referrer_id}:{referred_user_id}:{game_id}:{payment_amount}"
    try:
        wallet_migrations_collection.insert_one(
            {"key": marker_key, "created_at": datetime.utcnow(), "type": "referral_bonus"}
        )
    except DuplicateKeyError:
        return False, "Referral bonus already credited"

    amount = get_referral_bonus_for_game(game_id)
    referred_user = users_collection.find_one({"telegram_id": referred_user_id}, {"username": 1})
    from_user = referred_user.get("username", f"user_{referred_user_id}") if referred_user else f"user_{referred_user_id}"
    _push_earning(
        referrer_id,
        {
            "type": "referral_payment",
            "amount": amount,
            "from_user": from_user,
            "payment_amount": payment_amount,
            "date": datetime.utcnow(),
            "description": f"Referral payment bonus from @{from_user} (Game {game_id})",
        },
        amount,
    )
    return True, "Referral payment bonus credited"


def get_wallet_info(telegram_id: int):
    """Return wallet info for user."""
    init_wallet_for_user(telegram_id)
    user = users_collection.find_one(
        {"telegram_id": telegram_id},
        {
            "_id": 0,
            "wallet_balance": 1,
            "total_earned": 1,
            "registration_bonus_claimed": 1,
            "channel_bonus_claimed": 1,
            "earning_history": 1,
            "withdrawal_requests": 1,
        },
    )
    return user or {
        "wallet_balance": 0,
        "total_earned": 0,
        "registration_bonus_claimed": False,
        "channel_bonus_claimed": False,
        "earning_history": [],
        "withdrawal_requests": [],
    }


def request_withdrawal(telegram_id: int, amount: int):
    """Create withdrawal request when user has enough wallet balance."""
    init_wallet_for_user(telegram_id)
    user = users_collection.find_one({"telegram_id": telegram_id}, {"wallet_balance": 1, "withdrawal_requests": 1})
    if not user:
        return False, "User not found"
    if amount < 100:
        return False, "Minimum withdrawal is 100 ETB"
    if user.get("wallet_balance", 0) < amount:
        return False, "Insufficient wallet balance"

    request_id = str(uuid.uuid4())
    request_row = {
        "request_id": request_id,
        "amount": amount,
        "requested_at": datetime.utcnow(),
        "status": "pending",
        "paid_by": "",
        "paid_at": None,
    }
    users_collection.update_one(
        {"telegram_id": telegram_id},
        {
            "$inc": {"wallet_balance": -amount},
            "$push": {"withdrawal_requests": request_row},
            "$set": {"updated_at": datetime.utcnow()},
        },
    )
    return True, {"request_id": request_id, "amount": amount}


def get_withdrawal_requests(status: str = "pending"):
    """List withdrawal requests from all users by status."""
    users = users_collection.find(
        {"withdrawal_requests": {"$exists": True, "$ne": []}},
        {"telegram_id": 1, "username": 1, "withdrawal_requests": 1},
    )
    rows = []
    for user in users:
        for req in user.get("withdrawal_requests", []):
            if req.get("status") == status:
                rows.append(
                    {
                        "request_id": req.get("request_id"),
                        "telegram_id": user["telegram_id"],
                        "username": user.get("username", f"user_{user['telegram_id']}"),
                        "amount": req.get("amount", 0),
                        "requested_at": req.get("requested_at"),
                        "status": req.get("status"),
                        "paid_by": req.get("paid_by", ""),
                        "paid_at": req.get("paid_at"),
                    }
                )
    rows.sort(key=lambda x: x.get("requested_at") or datetime.utcnow(), reverse=True)
    return rows


def approve_withdrawal(request_id: str, admin_id: int):
    """Mark withdrawal request as paid by admin."""
    user = users_collection.find_one({"withdrawal_requests.request_id": request_id}, {"telegram_id": 1})
    if not user:
        return False, "Withdrawal request not found"
    result = users_collection.update_one(
        {"telegram_id": user["telegram_id"], "withdrawal_requests.request_id": request_id},
        {
            "$set": {
                "withdrawal_requests.$.status": "paid",
                "withdrawal_requests.$.paid_by": str(admin_id),
                "withdrawal_requests.$.paid_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        },
    )
    if result.modified_count == 0:
        return False, "Withdrawal request not updated"
    return True, "Withdrawal marked as paid"


def process_retroactive_bonuses():
    """One-time retroactive credits: 5 ETB per approved referred payment."""
    marker_key = "retroactive_bonuses_v1"
    existing_run = wallet_migrations_collection.find_one({"key": marker_key})
    if existing_run:
        return False, "Retroactive bonuses already processed"

    credited = 0
    referred_users = users_collection.find({"invited_by": {"$type": "int"}}, {"telegram_id": 1, "invited_by": 1, "username": 1})
    for referred in referred_users:
        referrer_id = referred.get("invited_by")
        if not referrer_id:
            continue
        payments = payments_collection.find(
            {"telegram_id": referred["telegram_id"], "status": "approved"},
            {"payment_id": 1, "amount": 1, "game_id": 1},
        )
        for pay in payments:
            pay_id = pay.get("payment_id")
            if not pay_id:
                continue
            credit_marker = f"retroactive:{referrer_id}:{pay_id}"
            try:
                wallet_migrations_collection.insert_one(
                    {"key": credit_marker, "type": "retroactive_bonus_credit", "created_at": datetime.utcnow()}
                )
            except DuplicateKeyError:
                continue
            init_wallet_for_user(referrer_id)
            _push_earning(
                referrer_id,
                {
                    "type": "retroactive_bonus",
                    "amount": 5,
                    "from_user": referred.get("username", f"user_{referred['telegram_id']}"),
                    "payment_amount": pay.get("amount", 0),
                    "date": datetime.utcnow(),
                    "description": f"Retroactive referral bonus for payment {pay_id}",
                },
                5,
            )
            credited += 1

    wallet_migrations_collection.insert_one(
        {"key": marker_key, "type": "retroactive_bonus_run", "created_at": datetime.utcnow(), "credited_count": credited}
    )
    return True, f"Retroactive bonuses processed: {credited}"


# Initialize database on import
init_db()