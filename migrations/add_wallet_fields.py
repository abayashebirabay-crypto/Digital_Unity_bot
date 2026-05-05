from datetime import datetime

from database import users_collection


def main():
    now = datetime.utcnow()
    defaults = {
        "wallet_balance": 0,
        "total_earned": 0,
        "registration_bonus_claimed": False,
        "channel_bonus_claimed": False,
        "withdrawal_requests": [],
        "earning_history": [],
        "updated_at": now,
    }
    result = users_collection.update_many(
        {"wallet_balance": {"$exists": False}},
        {"$set": defaults},
    )
    print(f"Wallet fields migration completed. Updated users: {result.modified_count}")


if __name__ == "__main__":
    main()
