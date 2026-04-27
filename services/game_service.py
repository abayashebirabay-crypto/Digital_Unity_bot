import random
import string
from datetime import datetime
from typing import Optional
import traceback
from config import LUCKY_NUMBER_PRICE_ETB, REFERRAL_POINTS_PER_USER
from database import (
    get_active_game,
    payments_collection,
    rotate_game,
    users_collection,
    winners_collection,
)


def _now():
    return datetime.utcnow()


def _build_referral_code(user_id: int) -> str:
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"DU{str(user_id)[-4:]}{suffix}"


def upsert_user(telegram_id: int, username: str, phone_number: str, location_text: str, invited_by: Optional[int]):
    existing = users_collection.find_one({"telegram_id": telegram_id})
    referral_code = existing.get("referral_code") if existing else _build_referral_code(telegram_id)

    user_doc = {
        "telegram_id": telegram_id,
        "username": username or f"user_{telegram_id}",
        "phone_number": phone_number or "Not provided",
        "location_text": location_text or "Not provided",
        "invited_by": invited_by if not existing else existing.get("invited_by"),
        "referral_code": referral_code,
        "referral_count": existing.get("referral_count", 0) if existing else 0,
        "referral_points": existing.get("referral_points", 0) if existing else 0,
        "updated_at": _now(),
        "last_active": _now(),
    }

    if not existing:
        user_doc.update(
            {
                "registered_at": _now(),
                "selected_number": None,
                "payment_status": "none",
                "current_game_id": get_active_game()["game_id"],
            }
        )
        users_collection.insert_one(user_doc)
        if invited_by:
            users_collection.update_one(
                {"telegram_id": invited_by},
                {"$inc": {"referral_count": 1, "referral_points": REFERRAL_POINTS_PER_USER}},
            )
    else:
        users_collection.update_one({"telegram_id": telegram_id}, {"$set": user_doc})

    return users_collection.find_one({"telegram_id": telegram_id}, {"_id": 0})


def can_user_pick_number(user: dict) -> bool:
    active_game_id = get_active_game()["game_id"]
    return user.get("payment_status") != "approved" or user.get("current_game_id") != active_game_id


def get_user_dashboard(telegram_id: int):
    try:
        user = users_collection.find_one({"telegram_id": telegram_id}, {"_id": 0})
        if not user:
            return None
        
        # Get taken numbers
        taken_users = users_collection.find(
            {"payment_status": "approved", "selected_number": {"$ne": None}},
            {"selected_number": 1, "telegram_id": 1}
        )
        taken_numbers = {}
        for u in taken_users:
            num = u.get('selected_number')
            if num:
                taken_numbers[num] = u['telegram_id']
        
        return {
            "user": user,
            "taken_numbers": taken_numbers,
            "active_game_id": user.get('current_game_id', 1)
        }
    except Exception as e:
        print(f"Error in get_user_dashboard: {e}")
        traceback.print_exc()
        return None


def reserve_candidate_number(telegram_id: int, number: int):
    users_collection.update_one(
        {"telegram_id": telegram_id},
        {"$set": {"selected_number": number, "updated_at": _now()}},
    )


def create_payment_record(telegram_id: int, game_id: int, number: int, amount: int, file_path: str):
    payments_collection.insert_one(
        {
            "telegram_id": telegram_id,
            "game_id": game_id,
            "number": number,
            "amount": amount,
            "file_path": file_path,
            "status": "pending",
            "created_at": _now(),
            "updated_at": _now(),
        }
    )
    users_collection.update_one(
        {"telegram_id": telegram_id},
        {
            "$set": {
                "payment_status": "pending",
                "current_game_id": game_id,
                "updated_at": _now(),
            }
        },
    )


def announce_winner():
    active_game = get_active_game()
    approved_users = list(
        users_collection.find(
            {
                "payment_status": "approved",
                "current_game_id": active_game["game_id"],
                "selected_number": {"$ne": None},
            },
            {"_id": 0},
        )
    )
    if not approved_users:
        return None

    winner = random.choice(approved_users)
    winner_doc = {
        "game_id": active_game["game_id"],
        "telegram_id": winner["telegram_id"],
        "username": winner.get("username", "unknown"),
        "winning_number": winner["selected_number"],
        "created_at": _now(),
    }
    winners_collection.insert_one(winner_doc)
    rotate_game()
    return winner_doc
