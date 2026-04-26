def create_user(user_id, name, phone_number=None, latitude=None, longitude=None):
    """
    Create a user document for MongoDB with all fields
    """
    return {
        "telegram_id": user_id,
        "name": name,
        "phone_number": phone_number,     # NEW: Store phone number
        "latitude": latitude,              # NEW: Store latitude
        "longitude": longitude,            # NEW: Store longitude
        "payment_status": "none",
        "selected_number": None,
        "payment_id": None,
        "payment_image": None,
        "registered_at": None,             # NEW: Registration timestamp
        "last_active": None,               # NEW: Last activity timestamp
        "is_active": True                  # NEW: Active status
    }