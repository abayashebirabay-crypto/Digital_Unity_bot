import os
import uuid
from datetime import datetime
from pathlib import Path
from fastapi import Request
import traceback
from typing import Optional
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from config import (
    LUCKY_NUMBER_PRICE_ETB,
    MAX_LUCKY_NUMBER,
    MIN_LUCKY_NUMBER,
    UPLOAD_DIR,
    WINNER_TOP_LIMIT,
    ADMIN_ID,
)
from database import announcements_collection, users_collection, winners_collection, payments_collection,games_collection
from services.game_service import (
    create_payment_record, 
    get_user_dashboard, 
    lock_number_for_user,
    upsert_user,
    get_active_game,   
    rotate_game,
    approve_payment,
    reject_payment,
    get_game_config,
    get_numbers_for_game
)

# Initialize FastAPI app FIRST
app = FastAPI(title="Digital Unity Mini App API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://blot-animal-matcher.ngrok-free.dev", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(UPLOAD_DIR, exist_ok=True)
BASE_DIR = Path(__file__).resolve().parent


def convert_datetime_to_str(obj):
    """Recursively convert datetime objects to ISO format strings"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: convert_datetime_to_str(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_datetime_to_str(item) for item in obj]
    return obj


# ============ API ROUTES ============

@app.get("/api/bootstrap/{telegram_id}")
async def bootstrap(telegram_id: int):
    try:
        payload = get_user_dashboard(telegram_id)
        if not payload:
            return JSONResponse({"registered": False, "message": "User is not registered."})
        
        payload = convert_datetime_to_str(payload)
        return JSONResponse({"registered": True, **payload})
    except Exception as e:
        print(f"Error in bootstrap: {e}")
        traceback.print_exc()
        return JSONResponse(
            {"registered": False, "message": f"Server error: {str(e)}"}, 
            status_code=500
        )


@app.get("/api/game/config")
async def game_config():
    """Get current game configuration (prices, limits, round number)"""
    try:
        from database import games_collection
        
        active_game = games_collection.find_one({
            "is_active": True,
            "winners_selected": {"$ne": True}
        })
        
        if not active_game:
            return JSONResponse({
                "game_id": None,
                "round": None,
                "is_active": False,
                "price_per_number": 100,
                "min_number": 1,
                "max_number": 999,
                "total_numbers": 999,
                "message": "No active game round available"
            })
        
        return JSONResponse({
            "game_id": active_game.get("game_id"),
            "round": active_game.get("round", active_game.get("game_id")),
            "is_active": True,
            "price_per_number": active_game.get("price_per_number", 100),
            "min_number": active_game.get("min_number", 1),
            "max_number": active_game.get("max_number", 999),
            "total_numbers": active_game.get("total_numbers", 999),
            "winners_selected": False
        })
    except Exception as e:
        print(f"Error in game_config: {e}")
        traceback.print_exc()
        return JSONResponse({
            "game_id": None,
            "is_active": False,
            "error": str(e)
        }, status_code=500)
    

@app.get("/api/lucky-numbers")
async def lucky_numbers(
    telegram_id: int = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(16, ge=1, le=100),
    q: str = Query(""),
):
    payload = get_user_dashboard(telegram_id)
    if not payload:
        raise HTTPException(status_code=404, detail="User not found")

    active_game = get_active_game()
    
    # Check if game exists and is active AND no winners selected
    if not active_game or not active_game.get("is_active", False) or active_game.get("winners_selected", False):
        return JSONResponse(
            {
                "items": [],
                "pagination": {
                    "page": 1,
                    "page_size": page_size,
                    "total": 0,
                    "has_next": False
                },
                "game_id": None,
                "price_per_number": 0,
                "taken_numbers": {},
                "user_selected_numbers": [],
                "pending_numbers": [],
                "game_active": False,
                "message": "Game has ended or no active game round available"
            }
        )
    
    active_game_id = active_game["game_id"]
    price_per_number = active_game.get("price_per_number", LUCKY_NUMBER_PRICE_ETB)
    
    # Get taken numbers - BOTH approved AND pending payments by OTHER users
    taken_by_others = payments_collection.find(
        {
            "game_id": active_game_id,
            "status": {"$in": ["approved", "pending"]},
            "telegram_id": {"$ne": telegram_id}
        },
        {"number": 1, "telegram_id": 1, "_id": 0}
    )
    taken_numbers = {p["number"]: p["telegram_id"] for p in taken_by_others}
    
    # Get user's approved and pending numbers
    user = users_collection.find_one({"telegram_id": telegram_id})
    user_approved_numbers = []
    user_pending_numbers = []
    
    if user:
        user_payments = list(payments_collection.find(
            {
                "telegram_id": telegram_id,
                "game_id": active_game_id
            },
            {"number": 1, "status": 1, "_id": 0}
        ))
        
        for payment in user_payments:
            if payment["status"] == "approved":
                user_approved_numbers.append(payment["number"])
            elif payment["status"] == "pending":
                user_pending_numbers.append(payment["number"])
    
    # Use game config for number range
    min_num = active_game.get("min_number", MIN_LUCKY_NUMBER)
    max_num = active_game.get("max_number", MAX_LUCKY_NUMBER)
    all_numbers = list(range(min_num, max_num + 1))
    
    if q.strip().isdigit():
        query_num = int(q.strip())
        all_numbers = [n for n in all_numbers if str(query_num) in str(n)]

    offset = (page - 1) * page_size
    page_items = all_numbers[offset : offset + page_size]

    items = [
        {
            "number": n,
            "is_taken": n in taken_numbers,
            "is_mine": n in user_approved_numbers,
            "is_pending": n in user_pending_numbers,
            "price": price_per_number,
        }
        for n in page_items
    ]
    
    return JSONResponse(
        {
            "items": items,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": len(all_numbers),
                "has_next": offset + page_size < len(all_numbers),
            },
            "game_id": active_game_id,
            "price_per_number": price_per_number,
            "taken_numbers": taken_numbers,
            "user_selected_numbers": user_approved_numbers,
            "pending_numbers": user_pending_numbers,
            "game_active": True
        }
    )


@app.post("/api/select-number")
async def select_number(data: dict):
    """Select/lock a number for the user - ATOMIC operation"""
    user_id = int(data.get("user_id", 0))
    number = int(data.get("number", 0))
    
    if not user_id or number < MIN_LUCKY_NUMBER or number > MAX_LUCKY_NUMBER:
        return JSONResponse({"success": False, "message": "Invalid user or number"})

    from database import users_collection
    user = users_collection.find_one({"telegram_id": user_id})
    
    if not user:
        return JSONResponse({"success": False, "message": "User not found"})
    
    active_game = get_active_game()
    active_game_id = active_game["game_id"]
    
    # Get user's selected numbers for current game
    user_selected_numbers = user.get("selected_numbers", [])
    user_selected_game = user.get("selected_game_id")
    
    # Check if user already selected this number
    if user_selected_game == active_game_id and number in user_selected_numbers:
        return JSONResponse({
            "success": False, 
            "message": f"You already selected number {number} for this game"
        })
    
    # Temporarily store selected number (not yet paid)
    # Use a temporary selection list
    temp_selections = user.get("temp_selected_numbers", [])
    if number not in temp_selections:
        temp_selections.append(number)
    
    users_collection.update_one(
        {"telegram_id": user_id},
        {
            "$set": {
                "temp_selected_numbers": temp_selections,
                "selected_game_id": active_game_id,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return JSONResponse({
        "success": True, 
        "message": f"Number {number} added to your cart! You can select more numbers."
    })

@app.post("/api/submit-payment-web")
async def submit_payment_web(
    user_id: int = Form(...),
    amount: int = Form(...),
    number: int = Form(...),
    file: UploadFile = File(...),
):
    try:
        print(f"🔍 Payment submission received:")
        print(f"   user_id: {user_id}")
        print(f"   amount: {amount}")
        print(f"   number: {number}")
        
        if not file.content_type or not file.content_type.startswith("image/"):
            return JSONResponse({"success": False, "message": "Only image uploads allowed"})

        user = users_collection.find_one({"telegram_id": user_id})
        if not user:
            return JSONResponse({"success": False, "message": "User not found"})
        
        active_game = get_active_game()
        active_game_id = active_game["game_id"]
        price_per_number = active_game.get("price_per_number", 100)
        
        if not active_game.get("is_active", True):
            return JSONResponse({"success": False, "message": "No active game round available"})
        
        # Check if number is already taken by another user's APPROVED OR PENDING payment
        existing_by_others = payments_collection.find_one({
            "game_id": active_game_id,
            "number": number,
            "status": {"$in": ["approved", "pending"]},
            "telegram_id": {"$ne": user_id}
        })
        
        if existing_by_others:
            status_text = "approved" if existing_by_others["status"] == "approved" else "pending approval"
            return JSONResponse({
                "success": False,
                "message": f"❌ Number {number} is already taken by another user ({status_text})!"
            })
        
        # Check if user already has a PENDING payment for this number
        existing_pending = payments_collection.find_one({
            "telegram_id": user_id,
            "game_id": active_game_id,
            "number": number,
            "status": "pending"
        })
        
        if existing_pending:
            return JSONResponse({
                "success": False,
                "message": f"You already have a pending payment for number {number}"
            })

        # Save file
        ext = Path(file.filename or "proof.jpg").suffix or ".jpg"
        filename = f"{uuid.uuid4().hex}{ext}"
        file_path = str(Path(UPLOAD_DIR) / filename)
        content = await file.read()
        with open(file_path, "wb") as out:
            out.write(content)

        # Create payment record with status pending
        payment_data = {
            "payment_id": str(uuid.uuid4()),
            "telegram_id": user_id,
            "game_id": active_game_id,
            "number": number,
            "amount": price_per_number,
            "file_path": file_path,
            "status": "pending",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "user_name": user.get('username', f"user_{user_id}"),
            "phone_number": user.get('phone_number', 'Unknown')
        }
        payments_collection.insert_one(payment_data)
        
        # Add to temp_selected_numbers (temporary selection before approval)
        temp_selections = user.get("temp_selected_numbers", [])
        if number not in temp_selections:
            temp_selections.append(number)
        
        users_collection.update_one(
            {"telegram_id": user_id},
            {
                "$set": {
                    "temp_selected_numbers": temp_selections,
                    "selected_game_id": active_game_id,
                    "current_game_id": active_game_id,
                    "payment_status": "pending",
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        print(f"✅ Payment recorded for user {user_id}, number {number}, game {active_game_id} (pending approval)")
        return JSONResponse({"success": True, "message": "Payment submitted and marked pending"})
        
    except Exception as e:
        print(f"❌ ERROR in payment submission: {e}")
        traceback.print_exc()
        return JSONResponse({"success": False, "message": f"Server error: {str(e)}"}, status_code=500)


@app.get("/api/winners")
async def winners(game_id: Optional[int] = None):
    """Get winners - optionally filter by game_id"""
    try:
        if game_id:
            query = {"game_id": game_id}
        else:
            # Get active game first
            active_game = get_active_game()
            if active_game and active_game.get("game_id"):
                query = {"game_id": {"$lt": active_game["game_id"]}}
            else:
                query = {}
        
        # Get all winners sorted by game_id desc and place asc
        winners_list = list(
            winners_collection.find(query, {"_id": 0})
            .sort("game_id", -1)
            .sort("place", 1)
        )
        
        # Convert datetime to string safely
        for w in winners_list:
            if "created_at" in w and w["created_at"]:
                w["created_at"] = str(w["created_at"])
        
        # Group winners by game/round
        winners_by_round = {}
        for w in winners_list:
            round_num = w.get("game_id", "unknown")
            if round_num not in winners_by_round:
                winners_by_round[round_num] = []
            # Add place display
            place = w.get("place", 0)
            place_display = {
                1: "🥇 1st Place",
                2: "🥈 2nd Place", 
                3: "🥉 3rd Place",
                4: "4th Place",
                5: "5th Place"
            }.get(place, f"{place}th Place" if place else "Unknown Place")
            w["place_display"] = place_display
            winners_by_round[round_num].append(w)
        
        # Get the most recent completed game winners
        most_recent_game = None
        current_round_winners = []
        current_winner = None
        
        if winners_list:
            # Find the highest game_id that has winners
            game_ids = list(set([w.get("game_id") for w in winners_list if w.get("game_id")]))
            if game_ids:
                most_recent_game = max(game_ids)
                current_round_winners = [w for w in winners_list if w.get("game_id") == most_recent_game]
                current_round_winners.sort(key=lambda x: x.get("place", 999))
                if current_round_winners:
                    current_winner = current_round_winners[0]
        
        return JSONResponse({
            "recent_winners": winners_list[:20],
            "winners_by_round": winners_by_round,
            "current_winner": current_winner,
            "current_round_winners": current_round_winners
        })
    except Exception as e:
        print(f"Error in winners endpoint: {e}")
        traceback.print_exc()
        return JSONResponse({
            "recent_winners": [],
            "winners_by_round": {},
            "current_winner": None,
            "current_round_winners": []
        })


@app.get("/api/announcements")
async def announcements():
    rows = list(announcements_collection.find({}, {"_id": 0}).sort("created_at", -1).limit(20))
    rows = convert_datetime_to_str(rows)
    return JSONResponse({"items": rows})


@app.get("/api/referral/{telegram_id}")
async def referral(telegram_id: int):
    user = users_collection.find_one({"telegram_id": telegram_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user = convert_datetime_to_str(user)
    return JSONResponse({
        "referral_code": user.get("referral_code"),
        "referral_count": user.get("referral_count", 0),
        "referral_points": user.get("referral_points", 0),
        "invited_by": user.get("invited_by"),
    })


# ============ ADMIN API ROUTES ============

# Admin authentication check
def is_admin(telegram_id: int) -> bool:
    return telegram_id == ADMIN_ID


@app.get("/api/admin/stats")
async def admin_stats(admin_id: int = Query(...)):
    if not is_admin(admin_id):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    active_game = get_active_game()
    active_game_id = active_game["game_id"]
    
    total_users = users_collection.count_documents({})
    
    # Count pending payments (not users)
    pending_payments_count = payments_collection.count_documents({
        "game_id": active_game_id,
        "status": "pending"
    })
    
    approved_payments_count = payments_collection.count_documents({
        "game_id": active_game_id,
        "status": "approved"
    })
    
    rejected_payments_count = payments_collection.count_documents({
        "game_id": active_game_id,
        "status": "rejected"
    })
    
    total_winners = winners_collection.count_documents({})
    total_announcements = announcements_collection.count_documents({})
    
    # Count unique users with approved payments
    unique_approved_users = len(payments_collection.distinct("telegram_id", {
        "game_id": active_game_id,
        "status": "approved"
    }))
    
    numbers_locked = payments_collection.count_documents({
        "game_id": active_game_id,
        "status": "approved"
    })
    
    return JSONResponse({
        "total_users": total_users,
        "pending_payments": pending_payments_count,
        "approved_payments": approved_payments_count,
        "rejected_payments": rejected_payments_count,
        "total_winners": total_winners,
        "total_announcements": total_announcements,
        "numbers_locked": numbers_locked,
        "unique_approved_users": unique_approved_users,
        "active_game_round": active_game["game_id"]
    })

@app.get("/api/uploads/{filename}")
async def get_uploaded_image(filename: str):
    """Serve uploaded payment images"""
    file_path = Path(UPLOAD_DIR) / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path, media_type="image/jpeg")

@app.get("/api/admin/pending-payments")
async def admin_pending_payments(admin_id: int = Query(...)):
    if not is_admin(admin_id):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    active_game = get_active_game()
    active_game_id = active_game["game_id"]
    
    # Get ALL pending payments for the current game
    pending_payments = list(payments_collection.find(
        {
            "game_id": active_game_id,
            "status": "pending"
        },
        {"_id": 0, "payment_id": 1, "telegram_id": 1, "number": 1, "amount": 1, 
         "user_name": 1, "phone_number": 1, "created_at": 1, "file_path": 1}
    ).sort("created_at", -1))
    
    # Convert datetime to string and add image URL
    for payment in pending_payments:
        if "created_at" in payment and payment["created_at"]:
            if hasattr(payment["created_at"], 'isoformat'):
                payment["created_at"] = payment["created_at"].isoformat()
            else:
                payment["created_at"] = str(payment["created_at"])
        
        # Add image URL for display
        if "file_path" in payment and payment["file_path"]:
            filename = Path(payment["file_path"]).name
            payment["image_url"] = f"/api/uploads/{filename}"
    
    return JSONResponse({
        "pending_payments": pending_payments, 
        "active_game_id": active_game_id,
        "count": len(pending_payments)
    })


@app.post("/api/admin/approve-payment")
async def admin_approve_payment(data: dict):
    admin_id = data.get("admin_id")
    payment_id = data.get("payment_id")
    
    if not is_admin(admin_id):
        return JSONResponse({"success": False, "message": "Admin access required"})
    
    if not payment_id:
        return JSONResponse({"success": False, "message": "Payment ID required"})
    
    # Find the payment
    payment = payments_collection.find_one({"payment_id": payment_id})
    if not payment:
        return JSONResponse({"success": False, "message": "Payment not found"})
    
    user_id = payment["telegram_id"]
    success, message = approve_payment(user_id, admin_id)
    return JSONResponse({"success": success, "message": message})


@app.post("/api/admin/reject-payment")
async def admin_reject_payment(data: dict):
    admin_id = data.get("admin_id")
    payment_id = data.get("payment_id")
    reason = data.get("reason", "Not specified")
    
    if not is_admin(admin_id):
        return JSONResponse({"success": False, "message": "Admin access required"})
    
    if not payment_id:
        return JSONResponse({"success": False, "message": "Payment ID required"})
    
    # Find the payment
    payment = payments_collection.find_one({"payment_id": payment_id})
    if not payment:
        return JSONResponse({"success": False, "message": "Payment not found"})
    
    user_id = payment["telegram_id"]
    success, message = reject_payment(user_id, admin_id, reason)
    return JSONResponse({"success": success, "message": message})
    
@app.get("/api/admin/all-users")
async def admin_all_users(admin_id: int = Query(...), limit: int = 50, offset: int = 0):
    if not is_admin(admin_id):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    active_game = get_active_game()
    
    users = list(users_collection.find(
        {},
        {"_id": 0, "telegram_id": 1, "username": 1, "phone_number": 1, 
         "location_text": 1, "payment_status": 1, "selected_number": 1, 
         "selected_game_id": 1, "referral_points": 1, "referral_count": 1, 
         "registered_at": 1}
    ).sort("registered_at", -1).skip(offset).limit(limit))
    
    for user in users:
        if "registered_at" in user and user["registered_at"]:
            user["registered_at"] = user["registered_at"].isoformat()
        # Mark if selection is for current game
        user["is_selected_for_current_game"] = user.get("selected_game_id") == active_game["game_id"]
    
    total = users_collection.count_documents({})
    
    return JSONResponse({
        "users": users,
        "total": total,
        "limit": limit,
        "offset": offset,
        "active_game_id": active_game["game_id"]
    })


@app.post("/api/admin/select-multi-winners")
async def admin_select_multi_winners(data: dict):
    admin_id = data.get("admin_id")
    num_places = data.get("num_places", 3)
    prize_amounts = data.get("prize_amounts", {1: 5000, 2: 3000, 3: 2000, 4: 1000, 5: 500})
    
    if not is_admin(admin_id):
        return JSONResponse({"success": False, "message": "Admin access required"})
    
    active_game = get_active_game()
    active_game_id = active_game["game_id"]
    
    # Get ALL approved payments for current game
    approved_payments = list(payments_collection.find(
        {
            "game_id": active_game_id,
            "status": "approved"
        },
        {"_id": 0, "telegram_id": 1, "number": 1, "payment_id": 1, "user_name": 1}
    ))
    
    if len(approved_payments) < num_places:
        return JSONResponse({
            "success": False, 
            "message": f"Not enough approved numbers. Need {num_places}, have {len(approved_payments)}"
        })
    
    # Fetch usernames from users_collection for each payment
    for payment in approved_payments:
        user = users_collection.find_one({"telegram_id": payment["telegram_id"]}, {"username": 1})
        payment["username"] = user.get("username", f"user_{payment['telegram_id']}") if user else f"user_{payment['telegram_id']}"
    
    import random
    selected_winners = random.sample(approved_payments, num_places)
    
    winners = []
    for i, winner_payment in enumerate(selected_winners, 1):
        prize = prize_amounts.get(i, prize_amounts.get(str(i), 500))
        winner_doc = {
            "game_id": active_game_id,
            "telegram_id": winner_payment["telegram_id"],
            "username": winner_payment.get("username", "unknown"),
            "winning_number": winner_payment["number"],
            "place": i,
            "prize_amount": prize,
            "created_at": datetime.utcnow(),
            "declared_by": admin_id,
            "payment_id": winner_payment.get("payment_id", "")
        }
        winners_collection.insert_one(winner_doc)
        winners.append({
            "place": i,
            "username": winner_payment.get("username", "unknown"),
            "winning_number": winner_payment["number"],
            "prize_amount": prize,
            "telegram_id": winner_payment["telegram_id"]
        })
    
    # Mark current game as INACTIVE
    games_collection.update_one(
        {"game_id": active_game_id},
        {"$set": {
            "is_active": False,
            "ended_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "winners_selected": True
        }}
    )
    print(f"🎮 Game #{active_game_id} marked as INACTIVE")
    
    # Reset users' payment_status for this game
    users_collection.update_many(
        {
            "selected_game_id": active_game_id,
            "payment_status": "approved"
        },
        {
            "$set": {
                "payment_status": "none",
                "selected_game_id": None,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    print(f"✅ Reset users for next round")
    
    # Create NEW active game for next round
    from database import create_new_game
    
    # Get the highest game_id
    last_game = games_collection.find_one({}, sort=[("game_id", -1)])
    new_game_id = (last_game["game_id"] if last_game else 0) + 1
    
    # Create new game
    new_game = {
        "game_id": new_game_id,
        "round": new_game_id,
        "is_active": True,
        "winners_selected": False,
        "price_per_number": active_game.get("price_per_number", 100),
        "min_number": active_game.get("min_number", 1),
        "max_number": active_game.get("max_number", 999),
        "total_numbers": active_game.get("max_number", 999) - active_game.get("min_number", 1) + 1,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    
    games_collection.insert_one(new_game)
    print(f"🎮 Created new active game: Round #{new_game_id}")
    
    return JSONResponse({
        "success": True, 
        "winners": winners,
        "total_entries": len(approved_payments),
        "new_game_id": new_game_id
    })

@app.get("/api/admin/winner-leaderboard")
async def admin_winner_leaderboard(admin_id: int = Query(...), limit: int = 20):
    if not is_admin(admin_id):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    winners = list(winners_collection.find(
        {},
        {"_id": 0, "username": 1, "winning_number": 1, "place": 1, "prize_amount": 1, 
         "game_id": 1, "created_at": 1}
    ).sort("game_id", -1).sort("place", 1).limit(limit))
    
    for w in winners:
        if "created_at" in w and w["created_at"]:
            w["created_at"] = w["created_at"].isoformat()
    
    total_winners = winners_collection.count_documents({})
    total_prize_distributed = winners_collection.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$prize_amount"}}}
    ])
    total_prize = list(total_prize_distributed)
    total_prize_amount = total_prize[0]["total"] if total_prize else 0
    
    return JSONResponse({
        "winners": winners,
        "total_winners": total_winners,
        "total_prize_distributed": total_prize_amount
    })


@app.post("/api/admin/announcement")
async def admin_create_announcement(data: dict):
    admin_id = data.get("admin_id")
    text = data.get("text", "").strip()
    
    if not is_admin(admin_id):
        return JSONResponse({"success": False, "message": "Admin access required"})
    
    if not text:
        return JSONResponse({"success": False, "message": "Announcement text required"})
    
    announcements_collection.insert_one({
        "text": text,
        "created_at": datetime.utcnow(),
        "created_by": admin_id
    })
    
    return JSONResponse({"success": True, "message": "Announcement created"})

@app.post("/api/admin/create-game")
async def admin_create_game(data: dict):
    admin_id = data.get("admin_id")
    price_per_number = data.get("price_per_number", LUCKY_NUMBER_PRICE_ETB)
    min_number = data.get("min_number", MIN_LUCKY_NUMBER)
    max_number = data.get("max_number", MAX_LUCKY_NUMBER)
    
    if not is_admin(admin_id):
        return JSONResponse({"success": False, "message": "Admin access required"})
    
    from database import create_new_game
    new_game = create_new_game(price_per_number, min_number, max_number)
    
    return JSONResponse({
        "success": True,
        "game_id": new_game["game_id"],
        "round": new_game["round"],
        "price_per_number": new_game["price_per_number"]
    })

@app.post("/api/admin/update-game")
async def admin_update_game(data: dict):
    admin_id = data.get("admin_id")
    game_id = data.get("game_id")
    price_per_number = data.get("price_per_number")
    min_number = data.get("min_number")
    max_number = data.get("max_number")
    is_active = data.get("is_active", True)
    
    if not is_admin(admin_id):
        return JSONResponse({"success": False, "message": "Admin access required"})
    
    if not game_id:
        return JSONResponse({"success": False, "message": "Game ID required"})
    
    # Update the game
    result = games_collection.update_one(
        {"game_id": game_id},
        {
            "$set": {
                "price_per_number": price_per_number,
                "min_number": min_number,
                "max_number": max_number,
                "total_numbers": max_number - min_number + 1,
                "is_active": is_active,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.modified_count > 0:
        print(f"✅ Game #{game_id} updated successfully")
        return JSONResponse({"success": True, "message": "Game updated successfully"})
    else:
        return JSONResponse({"success": False, "message": "No changes made or game not found"})

@app.delete("/api/admin/announcement/{announcement_id}")
async def admin_delete_announcement(announcement_id: str, admin_id: int = Query(...)):
    if not is_admin(admin_id):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from bson import ObjectId
    result = announcements_collection.delete_one({"_id": ObjectId(announcement_id)})
    
    if result.deleted_count > 0:
        return JSONResponse({"success": True, "message": "Announcement deleted"})
    return JSONResponse({"success": False, "message": "Announcement not found"})


# ============ NGROK BYPASS MIDDLEWARE ============
# This MUST be added to bypass the ngrok warning page
@app.middleware("http")
async def add_ngrok_bypass_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["ngrok-skip-browser-warning"] = "true"
    return response

# ============ FRONTEND SERVING ============

import os
is_dev_mode = os.getenv("WEB_APP_URL", "").startswith("http://localhost:3000")

if is_dev_mode:
    print("⚠️ Development mode detected - React will be served from http://localhost:3000")
    print("   Make sure to run: cd frontend && npm start")
    
    @app.get("/")
    async def serve_dev_frontend():
        return JSONResponse({
            "message": "Development mode active",
            "react_dev_server": "http://localhost:3000",
            "api_server": "http://localhost:8000"
        })
    
    @app.get("/{full_path:path}")
    async def serve_dev_fallback(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        return JSONResponse({
            "message": "Development mode - Please use React dev server at http://localhost:3000",
            "path": full_path
        })

else:
    REACT_BUILD_DIR = Path(__file__).resolve().parent / "frontend" / "build"
    
    if REACT_BUILD_DIR.exists() and (REACT_BUILD_DIR / "index.html").exists():
        print("✅ Serving React build from:", REACT_BUILD_DIR)
        
        from fastapi.staticfiles import StaticFiles
        
        static_dir = REACT_BUILD_DIR / "static"
        if static_dir.exists():
            app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
        
        @app.get("/{full_path:path}")
        async def serve_react(full_path: str):
            if full_path.startswith("api/") or full_path.startswith("_next/"):
                raise HTTPException(status_code=404)
            index_path = REACT_BUILD_DIR / "index.html"
            if index_path.exists():
                return FileResponse(str(index_path))
            return FileResponse(str(index_path))
        
        @app.get("/")
        async def serve_root():
            index_path = REACT_BUILD_DIR / "index.html"
            if index_path.exists():
                return FileResponse(str(index_path))
            return JSONResponse({"error": "index.html not found"}, status_code=404)
    else:
        print("⚠️ React build not found, using original index.html")
        
        @app.get("/")
        async def serve_frontend():
            index_path = BASE_DIR / "index.html"
            if index_path.exists():
                return FileResponse(str(index_path))
            return JSONResponse({"error": "index.html not found"}, status_code=404)