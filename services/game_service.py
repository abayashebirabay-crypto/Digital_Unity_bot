import random
import uuid
import string
from datetime import datetime
from typing import Optional
import traceback
from config import LUCKY_NUMBER_PRICE_ETB, REFERRAL_POINTS_PER_USER
from database import (
    give_referral_payment_bonus,
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
    active_game = get_active_game()
    
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
                "selected_numbers": [],  # Array of approved numbers
                "selected_game_id": None,
                "temp_selected_numbers": [],  # Temporarily selected (not paid)
                "selected_at": None,
                "payment_status": "none",
                "current_game_id": active_game["game_id"],
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


def get_user_dashboard(telegram_id: int):
    try:
        user = users_collection.find_one({"telegram_id": telegram_id}, {"_id": 0})
        if not user:
            return None
        
        active_game = get_active_game()
        
        # If no active game exists, return user data without game config
        if not active_game or not active_game.get("is_active", False):
            return {
                "user": {
                    **user,
                    "selected_numbers": [],
                    "pending_numbers": []
                },
                "taken_numbers": {},
                "active_game_id": None,
                "game_config": {
                    "game_id": None,
                    "price_per_number": 100,
                    "total_numbers": 999,
                    "min_number": 1,
                    "max_number": 999,
                    "is_active": False
                }
            }
        
        active_game_id = active_game["game_id"]
        
        # Get taken numbers (approved payments by others)
        approved_by_others = payments_collection.find(
            {
                "game_id": active_game_id,
                "status": "approved",
                "telegram_id": {"$ne": telegram_id}
            },
            {"number": 1, "telegram_id": 1, "_id": 0}
        )
        taken_numbers = {p["number"]: p["telegram_id"] for p in approved_by_others}
        
        # Get user's approved numbers (from payments with status approved)
        user_payments = list(payments_collection.find(
            {
                "telegram_id": telegram_id,
                "game_id": active_game_id
            },
            {"number": 1, "status": 1, "_id": 0}
        ))
        
        approved_numbers = []
        pending_numbers = []
        
        for payment in user_payments:
            if payment["status"] == "approved":
                approved_numbers.append(payment["number"])
            elif payment["status"] == "pending":
                pending_numbers.append(payment["number"])
        
        return {
            "user": {
                **user,
                "selected_numbers": approved_numbers,
                "pending_numbers": pending_numbers
            },
            "taken_numbers": taken_numbers,
            "active_game_id": active_game_id,
            "game_config": {
                "game_id": active_game_id,
                "price_per_number": active_game.get("price_per_number", LUCKY_NUMBER_PRICE_ETB),
                "total_numbers": active_game.get("total_numbers", 999),
                "min_number": active_game.get("min_number", 1),
                "max_number": active_game.get("max_number", 999),
                "is_active": active_game.get("is_active", True)
            }
        }
    except Exception as e:
        print(f"Error in get_user_dashboard: {e}")
        traceback.print_exc()
        return None

def approve_payment(telegram_id: int, admin_id: int):
    """Approve a user's payment for the current game"""
    active_game = get_active_game()
    active_game_id = active_game["game_id"]
    
    # Get user
    user = users_collection.find_one({"telegram_id": telegram_id})
    if not user:
        return False, "User not found"
    
    # Find the pending payment for this user and game
    pending_payment = payments_collection.find_one({
        "telegram_id": telegram_id,
        "game_id": active_game_id,
        "status": "pending"
    })
    
    if not pending_payment:
        return False, "No pending payment found"
    
    approved_number = pending_payment["number"]
    
    # Update payment record to approved
    payments_collection.update_one(
        {"_id": pending_payment["_id"]},
        {
            "$set": {
                "status": "approved",
                "approved_at": _now(),
                "approved_by": admin_id
            }
        }
    )
    
    # CRITICAL: Move number from temp_selected_numbers to selected_numbers
    selected_numbers = user.get("selected_numbers", [])
    if approved_number not in selected_numbers:
        selected_numbers.append(approved_number)
    
    # Remove from temp_selected_numbers
    temp_selections = user.get("temp_selected_numbers", [])
    if approved_number in temp_selections:
        temp_selections.remove(approved_number)
    
    users_collection.update_one(
        {"telegram_id": telegram_id},
        {
            "$set": {
                "selected_numbers": selected_numbers,
                "temp_selected_numbers": temp_selections,
                "selected_game_id": active_game_id,
                "payment_status": "approved" if len(selected_numbers) > 0 else "none",
                "approved_at": _now(),
                "approved_by": admin_id,
                "updated_at": _now()
            }
        }
    )

    referrer_id = user.get("invited_by")
    if referrer_id:
        give_referral_payment_bonus(
            referrer_id=referrer_id,
            referred_user_id=telegram_id,
            payment_amount=pending_payment.get("amount", 0),
            game_id=active_game_id,
        )
    
    return True, f"Payment approved for number {approved_number}"


def reject_payment(telegram_id: int, admin_id: int, reason: str = None):
    """Reject a user's payment and free up their number"""
    active_game = get_active_game()
    active_game_id = active_game["game_id"]
    
    # Get user
    user = users_collection.find_one({"telegram_id": telegram_id})
    if not user:
        return False, "User not found"
    
    # Find the pending payment
    pending_payment = payments_collection.find_one({
        "telegram_id": telegram_id,
        "game_id": active_game_id,
        "status": "pending"
    })
    
    if not pending_payment:
        return False, "No pending payment found"
    
    rejected_number = pending_payment["number"]
    
    # Update payment record
    payments_collection.update_one(
        {"_id": pending_payment["_id"]},
        {
            "$set": {
                "status": "rejected",
                "rejected_at": _now(),
                "rejected_by": admin_id,
                "rejection_reason": reason
            }
        }
    )
    
    # Remove from temp selections if present
    temp_selections = user.get("temp_selected_numbers", [])
    if rejected_number in temp_selections:
        temp_selections.remove(rejected_number)
    
    users_collection.update_one(
        {"telegram_id": telegram_id},
        {
            "$set": {
                "temp_selected_numbers": temp_selections,
                "updated_at": _now()
            }
        }
    )
    
    return True, f"Payment rejected for number {rejected_number}"


def get_game_config():
    """Get current game configuration including number prices"""
    from database import games_collection
    
    try:
        active_game = games_collection.find_one({"is_active": True})
        
        if not active_game:
            active_game = get_active_game()
        
        if not active_game:
            return {
                "game_id": None,
                "round": None,
                "price_per_number": LUCKY_NUMBER_PRICE_ETB,
                "min_number": 1,
                "max_number": 999,
                "total_numbers": 999,
                "is_active": False
            }
        
        return {
            "game_id": active_game.get("game_id"),
            "round": active_game.get("round", active_game.get("game_id")),
            "price_per_number": active_game.get("price_per_number", LUCKY_NUMBER_PRICE_ETB),
            "min_number": active_game.get("min_number", 1),
            "max_number": active_game.get("max_number", 999),
            "total_numbers": active_game.get("total_numbers", 999),
            "is_active": active_game.get("is_active", True)
        }
    except Exception as e:
        print(f"Error in get_game_config: {e}")
        traceback.print_exc()
        return {
            "game_id": None,
            "round": None,
            "price_per_number": LUCKY_NUMBER_PRICE_ETB,
            "min_number": 1,
            "max_number": 999,
            "total_numbers": 999,
            "is_active": False
        }


# Legacy functions kept for compatibility
def lock_number_for_user(telegram_id: int, number: int) -> bool:
    """Legacy - now handled by select-number endpoint with temp_selected_numbers"""
    return True


def create_payment_record(telegram_id: int, game_id: int, number: int, amount: int, file_path: str):
    """Legacy - now handled by submit-payment-web endpoint"""
    return True


def get_numbers_for_game(telegram_id: int, game_id: int):
    """Get numbers with their availability status for a specific game"""
    approved_payments = payments_collection.find(
        {
            "game_id": game_id,
            "status": "approved"
        },
        {"number": 1, "telegram_id": 1}
    )
    
    taken_numbers = {}
    for p in approved_payments:
        taken_numbers[p["number"]] = p["telegram_id"]
    
    user = users_collection.find_one({"telegram_id": telegram_id})
    user_number = None
    if user and user.get("selected_game_id") == game_id:
        user_numbers = user.get("selected_numbers", [])
        user_number = user_numbers[0] if user_numbers else None
    
    return {
        "taken_numbers": taken_numbers,
        "user_selected_number": user_number,
        "game_id": game_id
    }


def announce_winner():
    """Legacy function - replaced by multi-winner selection in admin panel"""
    active_game = get_active_game()
    approved_users = list(
        users_collection.find(
            {
                "payment_status": "approved",
                "current_game_id": active_game["game_id"],
                "selected_numbers": {"$ne": [], "$exists": True}
            },
            {"_id": 0},
        )
    )
    if not approved_users:
        return None

    # Flatten all selected numbers from all users
    all_numbers = []
    for user in approved_users:
        for num in user.get("selected_numbers", []):
            all_numbers.append({"telegram_id": user["telegram_id"], "username": user.get("username"), "number": num})
    
    if not all_numbers:
        return None
    
    winner_data = random.choice(all_numbers)
    winner_doc = {
        "game_id": active_game["game_id"],
        "telegram_id": winner_data["telegram_id"],
        "username": winner_data.get("username", "unknown"),
        "winning_number": winner_data["number"],
        "created_at": _now(),
    }
    winners_collection.insert_one(winner_doc)
    rotate_game()
    return winner_doc