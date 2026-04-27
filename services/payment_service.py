from database import users_collection
from datetime import datetime


def set_payment_pending(user_id, file_id):
    """Set user payment status to pending with image"""
    try:
        result = users_collection.update_one(
            {"telegram_id": user_id},
            {
                "$set": {
                    "payment_status": "pending",
                    "payment_image": file_id,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Error in set_payment_pending: {e}")
        return False


def approve_user(user_id):
    """Approve user payment and update timestamp"""
    try:
        result = users_collection.update_one(
            {"telegram_id": user_id},
            {
                "$set": {
                    "payment_status": "approved",
                    "approved_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Error in approve_user: {e}")
        return False


def reject_user(user_id):
    """Reject user payment and update timestamp"""
    try:
        result = users_collection.update_one(
            {"telegram_id": user_id},
            {
                "$set": {
                    "payment_status": "rejected",
                    "rejected_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Error in reject_user: {e}")
        return False


def get_payment_status(user_id):
    """Get current payment status for a user"""
    try:
        user = users_collection.find_one(
            {"telegram_id": user_id},
            {"payment_status": 1, "selected_number": 1, "payment_image": 1}
        )
        if user:
            return {
                "status": user.get("payment_status", "none"),
                "selected_number": user.get("selected_number"),
                "payment_image": user.get("payment_image")
            }
        return {"status": "none", "selected_number": None, "payment_image": None}
    except Exception as e:
        print(f"Error in get_payment_status: {e}")
        return {"status": "error", "message": str(e)}


def get_pending_users():
    """Get all users with pending payment status"""
    try:
        pending_users = list(users_collection.find(
            {"payment_status": "pending"},
            {"_id": 0, "telegram_id": 1, "username": 1, "phone_number": 1, "selected_number": 1, "payment_image": 1}
        ))
        return pending_users
    except Exception as e:
        print(f"Error in get_pending_users: {e}")
        return []