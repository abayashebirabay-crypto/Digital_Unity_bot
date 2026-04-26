from database import users_collection

def set_payment_pending(user_id, file_id):
    users_collection.update_one(
        {"telegram_id": user_id},
        {
            "$set": {
                "payment_status": "pending",
                "payment_image": file_id
            }
        }
    )


def approve_user(user_id):
    users_collection.update_one(
        {"telegram_id": user_id},
        {"$set": {"payment_status": "approved"}}
    )


def reject_user(user_id):
    users_collection.update_one(
        {"telegram_id": user_id},
        {"$set": {"payment_status": "rejected"}}
    )