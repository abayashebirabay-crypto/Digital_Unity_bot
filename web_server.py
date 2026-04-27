import os
import uuid
from datetime import datetime
from pathlib import Path
from fastapi import Request
import traceback
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
from database import announcements_collection, users_collection, winners_collection, payments_collection
from services.game_service import (
    create_payment_record, 
    get_user_dashboard, 
    reserve_candidate_number, 
    upsert_user,
    get_active_game,   
    rotate_game        
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


@app.get("/api/lucky-numbers")
async def lucky_numbers(
    telegram_id: int = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(40, ge=10, le=100),
    q: str = Query(""),
):
    payload = get_user_dashboard(telegram_id)
    if not payload:
        raise HTTPException(status_code=404, detail="User not found")

    all_numbers = list(range(MIN_LUCKY_NUMBER, MAX_LUCKY_NUMBER + 1))
    if q.strip().isdigit():
        query_num = int(q.strip())
        all_numbers = [n for n in all_numbers if str(query_num) in str(n)]

    offset = (page - 1) * page_size
    page_items = all_numbers[offset : offset + page_size]
    taken = payload["taken_numbers"]

    items = [
        {
            "number": n,
            "is_taken": n in taken and taken[n] != telegram_id,
            "is_mine": payload["user"].get("selected_number") == n,
            "price": LUCKY_NUMBER_PRICE_ETB,
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
        }
    )


@app.post("/api/select-number")
async def select_number(data: dict):
    user_id = int(data.get("user_id", 0))
    number = int(data.get("number", 0))
    if not user_id or number < MIN_LUCKY_NUMBER or number > MAX_LUCKY_NUMBER:
        return JSONResponse({"success": False, "message": "Invalid user or number"})

    payload = get_user_dashboard(user_id)
    if not payload:
        return JSONResponse({"success": False, "message": "User not found"})

    taken = payload["taken_numbers"]
    if number in taken and taken[number] != user_id:
        return JSONResponse({"success": False, "message": "Number already reserved"})

    reserve_candidate_number(user_id, number)
    return JSONResponse({"success": True, "message": "Lucky number selected"})


@app.post("/api/submit-payment-web")
async def submit_payment_web(
    user_id: int = Form(...),
    amount: int = Form(...),
    number: int = Form(...),
    file: UploadFile = File(...),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        return JSONResponse({"success": False, "message": "Only image uploads allowed"})

    payload = get_user_dashboard(user_id)
    if not payload:
        return JSONResponse({"success": False, "message": "User not found"})
    if payload["user"].get("payment_status") == "pending":
        return JSONResponse({"success": False, "message": "A payment is already pending"})
    if number != payload["user"].get("selected_number"):
        return JSONResponse({"success": False, "message": "Selected number mismatch"})

    ext = Path(file.filename or "proof.jpg").suffix or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = Path(UPLOAD_DIR) / filename
    content = await file.read()
    with open(file_path, "wb") as out:
        out.write(content)

    create_payment_record(user_id, payload["active_game_id"], number, amount, str(file_path))
    return JSONResponse({"success": True, "message": "Payment submitted and marked pending"})


@app.get("/api/winners")
async def winners():
    latest = list(
        winners_collection.find({}, {"_id": 0})
        .sort("created_at", -1)
        .limit(WINNER_TOP_LIMIT)
    )
    latest = convert_datetime_to_str(latest)
    
    top = list(
        winners_collection.aggregate(
            [
                {"$group": {"_id": "$telegram_id", "username": {"$first": "$username"}, "wins": {"$sum": 1}}},
                {"$sort": {"wins": -1}},
                {"$limit": 10},
            ]
        )
    )
    
    return JSONResponse(
        {
            "recent_winners": latest,
            "top_winners": [{"telegram_id": x["_id"], "username": x.get("username"), "wins": x["wins"]} for x in top],
            "current_winner": latest[0] if latest else None,
        }
    )


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
    return JSONResponse(
        {
            "referral_code": user.get("referral_code"),
            "referral_count": user.get("referral_count", 0),
            "referral_points": user.get("referral_points", 0),
            "invited_by": user.get("invited_by"),
        }
    )


@app.post("/api/admin/announcement")
async def create_announcement(data: dict):
    text = (data.get("text") or "").strip()
    if not text:
        return JSONResponse({"success": False, "message": "Text required"})
    announcements_collection.insert_one({"text": text, "created_at": datetime.utcnow()})
    return JSONResponse({"success": True})


# ============ ADMIN API ROUTES ============

from config import ADMIN_ID

# Admin authentication check
def is_admin(telegram_id: int) -> bool:
    return telegram_id == ADMIN_ID

@app.get("/api/admin/stats")
async def admin_stats(admin_id: int = Query(...)):
    if not is_admin(admin_id):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get statistics
    total_users = users_collection.count_documents({})
    pending_payments = users_collection.count_documents({"payment_status": "pending"})
    approved_payments = users_collection.count_documents({"payment_status": "approved"})
    rejected_payments = users_collection.count_documents({"payment_status": "rejected"})
    total_winners = winners_collection.count_documents({})
    total_announcements = announcements_collection.count_documents({})
    
    # Get numbers status
    selected_numbers = users_collection.count_documents({"selected_number": {"$ne": None}})
    
    return JSONResponse({
        "total_users": total_users,
        "pending_payments": pending_payments,
        "approved_payments": approved_payments,
        "rejected_payments": rejected_payments,
        "total_winners": total_winners,
        "total_announcements": total_announcements,
        "selected_numbers": selected_numbers
    })

@app.get("/api/admin/pending-payments")
async def admin_pending_payments(admin_id: int = Query(...)):
    if not is_admin(admin_id):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    pending_users = list(users_collection.find(
        {"payment_status": "pending"},
        {"_id": 0, "telegram_id": 1, "username": 1, "phone_number": 1, 
         "selected_number": 1, "payment_image": 1, "registered_at": 1}
    ).sort("registered_at", -1))
    
    # Convert datetime to string
    for user in pending_users:
        if "registered_at" in user and user["registered_at"]:
            user["registered_at"] = user["registered_at"].isoformat()
    
    return JSONResponse({"pending_users": pending_users})

@app.post("/api/admin/approve-payment")
async def admin_approve_payment(data: dict):
    admin_id = data.get("admin_id")
    user_id = data.get("user_id")
    
    if not is_admin(admin_id):
        return JSONResponse({"success": False, "message": "Admin access required"})
    
    # Update user payment status
    users_collection.update_one(
        {"telegram_id": user_id},
        {"$set": {
            "payment_status": "approved",
            "approved_at": datetime.utcnow(),
            "approved_by": admin_id
        }}
    )
    
    # Also update the payment record
    payments_collection.update_one(
        {"telegram_id": user_id, "status": "pending"},
        {"$set": {
            "status": "approved",
            "approved_at": datetime.utcnow(),
            "approved_by": admin_id
        }}
    )
    
    return JSONResponse({"success": True, "message": f"User {user_id} payment approved"})

@app.post("/api/admin/reject-payment")
async def admin_reject_payment(data: dict):
    admin_id = data.get("admin_id")
    user_id = data.get("user_id")
    reason = data.get("reason", "Not specified")
    
    if not is_admin(admin_id):
        return JSONResponse({"success": False, "message": "Admin access required"})
    
    # Update user payment status
    users_collection.update_one(
        {"telegram_id": user_id},
        {"$set": {
            "payment_status": "rejected",
            "rejected_at": datetime.utcnow(),
            "rejected_by": admin_id,
            "rejection_reason": reason
        }}
    )
    
    # Also update the payment record
    payments_collection.update_one(
        {"telegram_id": user_id, "status": "pending"},
        {"$set": {
            "status": "rejected",
            "rejected_at": datetime.utcnow(),
            "rejected_by": admin_id,
            "rejection_reason": reason
        }}
    )
    
    return JSONResponse({"success": True, "message": f"User {user_id} payment rejected"})

@app.get("/api/admin/all-users")
async def admin_all_users(admin_id: int = Query(...), limit: int = 50, offset: int = 0):
    if not is_admin(admin_id):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = list(users_collection.find(
        {},
        {"_id": 0, "telegram_id": 1, "username": 1, "phone_number": 1, 
         "location_text": 1, "payment_status": 1, "selected_number": 1, 
         "referral_points": 1, "referral_count": 1, "registered_at": 1}
    ).sort("registered_at", -1).skip(offset).limit(limit))
    
    # Convert datetime
    for user in users:
        if "registered_at" in user and user["registered_at"]:
            user["registered_at"] = user["registered_at"].isoformat()
    
    total = users_collection.count_documents({})
    
    return JSONResponse({
        "users": users,
        "total": total,
        "limit": limit,
        "offset": offset
    })

@app.post("/api/admin/select-winner")
async def admin_select_winner(data: dict):
    admin_id = data.get("admin_id")
    
    if not is_admin(admin_id):
        return JSONResponse({"success": False, "message": "Admin access required"})
    
    # Get all approved users with selected numbers
    approved_users = list(users_collection.find(
        {"payment_status": "approved", "selected_number": {"$ne": None}},
        {"_id": 0, "telegram_id": 1, "username": 1, "selected_number": 1}
    ))
    
    if not approved_users:
        return JSONResponse({"success": False, "message": "No eligible users found"})
    
    import random
    winner = random.choice(approved_users)
    
    # Save winner
    winner_doc = {
        "telegram_id": winner["telegram_id"],
        "username": winner["username"],
        "winning_number": winner["selected_number"],
        "prize_amount": 1000,  # Configure as needed
        "created_at": datetime.utcnow(),
        "declared_by": admin_id
    }
    winners_collection.insert_one(winner_doc)
    
    return JSONResponse({"success": True, "winner": winner})

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

@app.delete("/api/admin/announcement/{announcement_id}")
async def admin_delete_announcement(announcement_id: str, admin_id: int = Query(...)):
    if not is_admin(admin_id):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from bson import ObjectId
    result = announcements_collection.delete_one({"_id": ObjectId(announcement_id)})
    
    if result.deleted_count > 0:
        return JSONResponse({"success": True, "message": "Announcement deleted"})
    return JSONResponse({"success": False, "message": "Announcement not found"})

# ============ MULTI-WINNER SELECTION ============

@app.post("/api/admin/select-multi-winners")
async def admin_select_multi_winners(data: dict):
    admin_id = data.get("admin_id")
    num_places = data.get("num_places", 3)
    
    if not is_admin(admin_id):
        return JSONResponse({"success": False, "message": "Admin access required"})
    
    # Get all approved users with selected numbers
    approved_users = list(users_collection.find(
        {"payment_status": "approved", "selected_number": {"$ne": None}},
        {"_id": 0, "telegram_id": 1, "username": 1, "selected_number": 1}
    ))
    
    if len(approved_users) < num_places:
        return JSONResponse({"success": False, "message": f"Not enough approved users. Need {num_places}, have {len(approved_users)}"})
    
    import random
    selected_winners = random.sample(approved_users, num_places)
    
    # Prize amounts (you can modify these)
    prize_amounts = {
        1: 5000,   # 1st place
        2: 3000,   # 2nd place
        3: 2000,   # 3rd place
        4: 1000,   # 4th place
        5: 500     # 5th place
    }
    
    winners = []
    for i, winner in enumerate(selected_winners, 1):
        prize = prize_amounts.get(i, 500)
        winner_doc = {
            "game_id": get_active_game()["game_id"],
            "telegram_id": winner["telegram_id"],
            "username": winner["username"],
            "winning_number": winner["selected_number"],
            "place": i,
            "prize_amount": prize,
            "created_at": datetime.utcnow(),
            "declared_by": admin_id,
            "is_multi_winner": True
        }
        winners_collection.insert_one(winner_doc)
        winners.append({
            "place": i,
            "username": winner["username"],
            "winning_number": winner["selected_number"],
            "prize_amount": prize
        })
    
    # Rotate game after winners are selected
    rotate_game()
    
    return JSONResponse({"success": True, "winners": winners})

@app.get("/api/admin/winner-leaderboard")
async def admin_winner_leaderboard(admin_id: int = Query(...), limit: int = 20):
    if not is_admin(admin_id):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    winners = list(winners_collection.find(
        {},
        {"_id": 0, "username": 1, "winning_number": 1, "place": 1, "prize_amount": 1, "created_at": 1}
    ).sort("place", 1).sort("created_at", -1).limit(limit))
    
    for w in winners:
        if "created_at" in w and w["created_at"]:
            w["created_at"] = w["created_at"].isoformat()
    
    # Get statistics
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

# ============ FRONTEND SERVING ============

# Check if we're in development mode (WEB_APP_URL points to localhost:3000)
import os
is_dev_mode = os.getenv("WEB_APP_URL", "").startswith("http://localhost:3000")

if is_dev_mode:
    # In development mode, don't serve React from FastAPI
    # React dev server runs separately on port 3000
    print("⚠️ Development mode detected - React will be served from http://localhost:3000")
    print("   Make sure to run: cd frontend && npm start")
    
    @app.get("/")
    async def serve_dev_frontend():
        # Redirect to React dev server or show a message
        return JSONResponse({
            "message": "Development mode active",
            "react_dev_server": "http://localhost:3000",
            "api_server": "http://localhost:8000"
        })
    
    @app.get("/{full_path:path}")
    async def serve_dev_fallback(full_path: str):
        # For API routes, let them through
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        # For other routes, return API info
        return JSONResponse({
            "message": "Development mode - Please use React dev server at http://localhost:3000",
            "path": full_path
        })

else:
    # Production mode - serve React build
    REACT_BUILD_DIR = Path(__file__).resolve().parent / "frontend" / "build"
    
    if REACT_BUILD_DIR.exists() and (REACT_BUILD_DIR / "index.html").exists():
        print("✅ Serving React build from:", REACT_BUILD_DIR)
        
        from fastapi.staticfiles import StaticFiles
        
        # Mount static files
        static_dir = REACT_BUILD_DIR / "static"
        if static_dir.exists():
            app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
        
        # Serve React app for all non-API routes
        @app.get("/{full_path:path}")
        async def serve_react(full_path: str):
            # Skip API routes
            if full_path.startswith("api/") or full_path.startswith("_next/"):
                raise HTTPException(status_code=404)
            
            # Serve index.html for all other routes
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
        # Fallback to original index.html
        print("⚠️ React build not found, using original index.html")
        
        @app.get("/")
        async def serve_frontend():
            index_path = BASE_DIR / "index.html"
            if index_path.exists():
                return FileResponse(str(index_path))
            return JSONResponse({"error": "index.html not found"}, status_code=404)