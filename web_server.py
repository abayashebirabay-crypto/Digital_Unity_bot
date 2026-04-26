from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from datetime import datetime
from typing import Optional, Dict, List
import uuid
import os
import asyncio
from contextlib import asynccontextmanager
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration class for better management
class Config:
    MONGODB_URI = "mongodb+srv://abeyashebir:pOv4fI2dlf4j4UnM@cluster0.mryt6.mongodb.net/digital_unity"
    DATABASE_NAME = "digital_unity"
    UPLOAD_DIR = "uploads"
    HOST = "0.0.0.0"
    PORT = 80
    
    # Game configuration
    NUMBER_PRICES = {
        1: 100, 2: 100, 3: 100, 4: 100,
        5: 200, 6: 200, 7: 200, 8: 200,
        9: 500, 10: 500, 11: 500, 12: 500,
        13: 1000, 14: 1000, 15: 1000, 16: 1000
    }
    
    # Prize structure (you can modify this)
    WINNER_PRIZES = {
        1: 5000, 2: 3000, 3: 2000
    }

config = Config()

# Database connection manager
class DatabaseManager:
    def __init__(self):
        self.client = None
        self.db = None
        self.users_collection = None
        self.payments_collection = None
        self.winners_collection = None
        
    async def connect(self):
        """Establish MongoDB connection"""
        try:
            self.client = MongoClient(config.MONGODB_URI, serverSelectionTimeoutMS=5000)
            # Verify connection
            self.client.admin.command('ping')
            self.db = self.client[config.DATABASE_NAME]
            self.users_collection = self.db["users"]
            self.payments_collection = self.db["payments"]
            self.winners_collection = self.db["winners"]
            
            # Create indexes for better performance
            self.users_collection.create_index("telegram_id", unique=True)
            self.payments_collection.create_index("telegram_id")
            self.payments_collection.create_index("status")
            self.winners_collection.create_index("declared_at", unique=True)
            
            logger.info("✅ MongoDB connected successfully")
            return True
        except ConnectionFailure as e:
            logger.error(f"❌ MongoDB connection failed: {e}")
            return False
    
    def disconnect(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")

# Global database instance
db_manager = DatabaseManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events"""
    # Startup
    await db_manager.connect()
    os.makedirs(config.UPLOAD_DIR, exist_ok=True)
    logger.info(f"🚀 Server starting on http://{config.HOST}:{config.PORT}")
    yield
    # Shutdown
    db_manager.disconnect()

# Initialize FastAPI app
app = FastAPI(lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper functions
def get_number_price(number: int) -> int:
    """Get price for a specific number"""
    return config.NUMBER_PRICES.get(number, 0)

def get_available_numbers(telegram_id: int) -> List[int]:
    """Get list of available numbers"""
    if not db_manager.users_collection:
        return list(config.NUMBER_PRICES.keys())
    
    taken_numbers = db_manager.users_collection.find(
        {"payment_status": "approved", "selected_number": {"$ne": None}},
        {"selected_number": 1}
    )
    taken = {user.get('selected_number') for user in taken_numbers if user.get('selected_number')}
    
    return [num for num in config.NUMBER_PRICES.keys() if num not in taken]

async def get_user_data(telegram_id: int) -> dict:
    """Get user data with default values"""
    if db_manager.users_collection is None:
        return {
            "telegram_id": telegram_id,
            "name": "User",
            "email": "Not provided",
            "phone_number": "Not provided",
            "payment_status": "none",
            "balance": 0,
            "selected_number": None
        }
    
    user = db_manager.users_collection.find_one(
        {"telegram_id": telegram_id},
        {"_id": 0}
    )
    
    if user is None:
        return {
            "telegram_id": telegram_id,
            "name": "User",
            "email": "Not provided",
            "phone_number": "Not provided",
            "payment_status": "none",
            "balance": 0,
            "selected_number": None
        }
    
    return user

async def get_winners() -> List[dict]:
    """Get all winners"""
    if db_manager.winners_collection is None:
        return []
    
    winners = list(db_manager.winners_collection.find(
        {},
        {"_id": 0}
    ).sort("declared_at", -1))
    
    return winners

async def declare_winner(number: int, telegram_id: int, prize_amount: int):
    """Declare a winner"""
    if db_manager.winners_collection is None or db_manager.users_collection is None:
        return False
    
    try:
        winner_data = {
            "number": number,
            "telegram_id": telegram_id,
            "prize_amount": prize_amount,
            "declared_at": datetime.now(),
            "claimed": False
        }
        
        db_manager.winners_collection.insert_one(winner_data)
        
        # Update user's balance
        db_manager.users_collection.update_one(
            {"telegram_id": telegram_id},
            {"$inc": {"balance": prize_amount}}
        )
        
        return True
    except Exception as e:
        logger.error(f"Error declaring winner: {e}")
        return False

# HTML Content with improved profile section and winner board
HTML_CONTENT = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
    <title>Digital Unity - Number Game</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 500px;
            margin: 0 auto;
        }

        /* Profile Card */
        .profile-card {
            background: white;
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            position: relative;
            overflow: hidden;
        }

        .profile-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 15px;
        }

        .profile-avatar {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            color: white;
        }

        .profile-info {
            flex: 1;
        }

        .user-name {
            font-size: 24px;
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }

        .user-detail {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #666;
            font-size: 14px;
            margin-bottom: 5px;
        }

        .status-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }

        .status-pending { background: #ff9800; color: white; }
        .status-approved { background: #4caf50; color: white; }
        .status-rejected { background: #f44336; color: white; }
        .status-none { background: #9e9e9e; color: white; }

        /* Balance Card */
        .balance-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 20px;
            padding: 25px;
            margin-bottom: 20px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        .balance-label {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 10px;
        }

        .balance-amount {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 5px;
        }

        /* Winner Board */
        .winner-board {
            background: white;
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        .winner-title {
            font-size: 20px;
            font-weight: bold;
            color: #764ba2;
            text-align: center;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        .winner-list {
            max-height: 200px;
            overflow-y: auto;
        }

        .winner-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            border-bottom: 1px solid #eee;
            transition: background 0.3s;
        }

        .winner-item:hover {
            background: #f8f9ff;
        }

        .winner-number {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 18px;
        }

        .winner-info {
            flex: 1;
            margin-left: 15px;
        }

        .winner-name {
            font-weight: bold;
            color: #333;
        }

        .winner-date {
            font-size: 12px;
            color: #999;
        }

        .winner-prize {
            font-weight: bold;
            color: #4caf50;
        }

        .no-winners {
            text-align: center;
            color: #999;
            padding: 20px;
        }

        /* Number Grid */
        .section-title {
            font-size: 18px;
            font-weight: bold;
            color: white;
            margin-bottom: 15px;
            margin-top: 20px;
            text-align: center;
        }

        .number-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        }

        .number-card {
            background: white;
            border-radius: 15px;
            padding: 20px 10px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            position: relative;
        }

        .number-card:hover:not(.disabled) {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }

        .number-card.selected {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .number-card.selected::after {
            content: "✓";
            position: absolute;
            top: 5px;
            right: 10px;
            font-size: 18px;
            font-weight: bold;
        }

        .number-card.disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background: #e0e0e0;
        }

        .number-card.disabled::after {
            content: "🔒";
            position: absolute;
            top: 5px;
            right: 10px;
            font-size: 14px;
        }

        .number-value {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .number-price {
            font-size: 12px;
            color: #666;
        }

        .number-card.selected .number-price {
            color: rgba(255,255,255,0.8);
        }

        /* Payment Section */
        .payment-card {
            background: white;
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        .payment-info {
            background: #f5f5f5;
            border-radius: 10px;
            padding: 15px;
            margin: 15px 0;
        }

        .payment-method {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid #eee;
        }

        .btn {
            width: 100%;
            padding: 15px;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 10px;
        }

        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102,126,234,0.4);
        }

        .btn-success {
            background: #4caf50;
            color: white;
        }

        .btn-danger {
            background: #f44336;
            color: white;
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .selected-number {
            text-align: center;
            padding: 10px;
            background: #f0f0f0;
            border-radius: 10px;
            margin-top: 15px;
            font-weight: bold;
        }

        .upload-area {
            border: 2px dashed #ddd;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            cursor: pointer;
            margin: 15px 0;
            transition: all 0.3s;
        }

        .upload-area:hover {
            border-color: #667eea;
            background: #f8f9ff;
        }

        /* Message and Toast */
        .message-card {
            background: white;
            border-radius: 20px;
            padding: 15px;
            margin-bottom: 20px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        .message-warning { background: #fff3e0; border-left: 4px solid #ff9800; color: #e65100; }
        .message-success { background: #e8f5e9; border-left: 4px solid #4caf50; color: #1b5e20; }
        .message-error { background: #ffebee; border-left: 4px solid #f44336; color: #c62828; }
        .message-info { background: #e3f2fd; border-left: 4px solid #2196f3; color: #0d47a1; }

        .toast {
            visibility: hidden;
            min-width: 250px;
            background-color: #333;
            color: #fff;
            text-align: center;
            border-radius: 8px;
            padding: 12px;
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1000;
        }

        .toast.show {
            visibility: visible;
            animation: fadein 0.5s, fadeout 0.5s 2.5s;
        }

        @keyframes fadein {
            from { bottom: 0; opacity: 0; }
            to { bottom: 30px; opacity: 1; }
        }

        @keyframes fadeout {
            from { bottom: 30px; opacity: 1; }
            to { bottom: 0; opacity: 0; }
        }

        .loading {
            text-align: center;
            padding: 20px;
            color: white;
        }

        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .loading-text {
            margin-top: 10px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div id="loadingScreen" class="loading">
            <div class="spinner"></div>
            <p class="loading-text">Loading your game dashboard...</p>
        </div>

        <div id="mainContent" style="display: none;">
            <!-- Profile Section -->
            <div class="profile-card">
                <div class="profile-header">
                    <div class="profile-avatar" id="userAvatar">👤</div>
                    <div class="profile-info">
                        <div class="user-name" id="userName">Loading...</div>
                        <div class="user-detail" id="userEmail">📧 Loading...</div>
                        <div class="user-detail" id="userPhone">📱 Loading...</div>
                    </div>
                </div>
                <div style="text-align: center;">
                    <span class="status-badge" id="statusBadge">Loading...</span>
                </div>
            </div>

            <!-- Balance Card -->
            <div class="balance-card">
                <div class="balance-label">Your Balance</div>
                <div class="balance-amount" id="userBalance">0</div>
                <div class="balance-currency">ETB</div>
            </div>

            <!-- Winner Board -->
            <div class="winner-board">
                <div class="winner-title">
                    🏆 Winners Board 🏆
                </div>
                <div id="winnerList" class="winner-list">
                    <div class="loading">Loading winners...</div>
                </div>
            </div>

            <div id="messageCard" style="display: none;"></div>

            <div class="section-title">🎲 SELECT YOUR LUCKY NUMBER 🎲</div>
            <div class="number-grid" id="numberGrid"></div>

            <div class="payment-card">
                <h3 style="margin-bottom: 15px; color: #667eea;">💳 Make Payment</h3>
                
                <div id="selectedDisplay" class="selected-number" style="display: none;">
                    Selected Number: <strong id="selectedNumber">-</strong>
                    <br>Amount to Pay: <strong id="selectedAmount">-</strong> ETB
                </div>
                
                <div id="paymentInstructions">
                    <div class="payment-info">
                        <div class="payment-method">
                            <span>🏦 Bank:</span>
                            <span><strong>Commercial Bank of Ethiopia</strong></span>
                        </div>
                        <div class="payment-method">
                            <span>📋 Account:</span>
                            <span><strong>100013456789</strong></span>
                        </div>
                        <div class="payment-method">
                            <span>👤 Name:</span>
                            <span><strong>Digital Unity</strong></span>
                        </div>
                    </div>
                    
                    <button class="btn btn-primary" id="showUploadBtn" onclick="showUpload()">📸 Upload Payment Screenshot</button>
                    
                    <div id="uploadSection" style="display: none;">
                        <div class="upload-area" onclick="document.getElementById('fileInput').click()">
                            📸 Click to upload screenshot
                        </div>
                        <input type="file" id="fileInput" accept="image/*" style="display: none;">
                        <div id="fileName" style="font-size: 12px; color: #666; text-align: center; margin: 10px 0;"></div>
                        <button class="btn btn-success" onclick="submitPayment()">✅ Confirm Payment</button>
                        <button class="btn btn-danger" onclick="hideUpload()">❌ Cancel</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-primary" onclick="checkStatus()">📊 Check Payment Status</button>
        </div>
    </div>

    <div id="toast" class="toast"></div>

    <script>
        let userId = null;
        let selectedNumberData = null;
        let userData = null;
        let allNumbers = {};
        let numberPrices = {
            1: 100, 2: 100, 3: 100, 4: 100,
            5: 200, 6: 200, 7: 200, 8: 200,
            9: 500, 10: 500, 11: 500, 12: 500,
            13: 1000, 14: 1000, 15: 1000, 16: 1000
        };

        // Get user ID from Telegram or use test ID
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.ready();
            Telegram.WebApp.expand();
            if (Telegram.WebApp.initDataUnsafe.user) {
                userId = Telegram.WebApp.initDataUnsafe.user.id;
            }
        }

        if (!userId) {
            userId = 1296141395; // Test user ID
        }

        async function loadUserData() {
            try {
                const response = await fetch(`/api/user/${userId}`);
                userData = await response.json();
                
                // Update profile information with real data
                document.getElementById('userName').textContent = userData.name || 'User';
                document.getElementById('userAvatar').textContent = userData.name ? userData.name.charAt(0).toUpperCase() : '👤';
                document.getElementById('userEmail').innerHTML = `📧 ${userData.email || 'Not provided'}`;
                document.getElementById('userPhone').innerHTML = `📱 ${userData.phone_number || 'Not provided'}`;
                
                // Update status badge
                const status = userData.payment_status || 'none';
                const statusBadge = document.getElementById('statusBadge');
                statusBadge.textContent = status.toUpperCase();
                statusBadge.className = `status-badge status-${status}`;
                
                // Update balance
                document.getElementById('userBalance').textContent = userData.balance || 0;
                
                // Load taken numbers
                await loadTakenNumbers();
                
                // Show appropriate messages based on status
                if (status === 'pending') {
                    showMessage('warning', '⏳ You have a pending payment! Please wait for admin approval.');
                    document.getElementById('showUploadBtn').disabled = true;
                } else if (status === 'approved') {
                    showMessage('success', '✅ Your payment has been approved! Your number is locked.');
                    if (userData.selected_number) {
                        document.getElementById('selectedDisplay').style.display = 'block';
                        document.getElementById('selectedNumber').textContent = userData.selected_number;
                        document.getElementById('selectedAmount').textContent = numberPrices[userData.selected_number];
                        selectedNumberData = userData.selected_number;
                    }
                    document.getElementById('showUploadBtn').disabled = true;
                } else if (status === 'rejected') {
                    showMessage('error', '❌ Your payment was rejected. Please submit again.');
                    document.getElementById('showUploadBtn').disabled = false;
                } else {
                    document.getElementById('showUploadBtn').disabled = false;
                }
                
                if (userData.selected_number && status !== 'approved') {
                    selectedNumberData = userData.selected_number;
                    document.getElementById('selectedDisplay').style.display = 'block';
                    document.getElementById('selectedNumber').textContent = selectedNumberData;
                    document.getElementById('selectedAmount').textContent = numberPrices[selectedNumberData];
                }
                
            } catch (error) {
                console.error('Error loading user:', error);
                showToast('Error loading user data', 'error');
            }
        }

        async function loadTakenNumbers() {
            try {
                const response = await fetch(`/api/taken-numbers`);
                allNumbers = await response.json();
            } catch (error) {
                console.error('Error loading taken numbers:', error);
            }
        }

        async function loadWinners() {
            try {
                const response = await fetch('/api/winners');
                const winners = await response.json();
                
                const winnerList = document.getElementById('winnerList');
                
                if (!winners || winners.length === 0) {
                    winnerList.innerHTML = '<div class="no-winners">No winners yet. Be the first! 🎯</div>';
                    return;
                }
                
                winnerList.innerHTML = winners.map(winner => `
                    <div class="winner-item">
                        <div class="winner-number">${winner.number}</div>
                        <div class="winner-info">
                            <div class="winner-name">Winner #${winner.number}</div>
                            <div class="winner-date">${new Date(winner.declared_at).toLocaleDateString()}</div>
                        </div>
                        <div class="winner-prize">${winner.prize_amount} ETB</div>
                    </div>
                `).join('');
                
            } catch (error) {
                console.error('Error loading winners:', error);
                document.getElementById('winnerList').innerHTML = '<div class="no-winners">Failed to load winners</div>';
            }
        }

        function generateNumberGrid() {
            const grid = document.getElementById('numberGrid');
            grid.innerHTML = '';
            
            for (let num = 1; num <= 16; num++) {
                const price = numberPrices[num];
                const isSelected = userData && userData.selected_number === num;
                const isTaken = allNumbers[num] && allNumbers[num] !== userId;
                const isPending = userData && userData.payment_status === 'pending';
                const isDisabled = isTaken || (isPending && !isSelected);
                
                const card = document.createElement('div');
                card.className = `number-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`;
                
                if (!isDisabled && !userData?.selected_number) {
                    card.onclick = () => selectNumber(num);
                }
                
                card.innerHTML = `
                    <div class="number-value">${num}</div>
                    <div class="number-price">${price} ETB</div>
                    ${isTaken ? '<div style="font-size: 10px; color: #999;">Taken</div>' : ''}
                    ${isSelected ? '<div style="font-size: 10px;">Your Number</div>' : ''}
                `;
                grid.appendChild(card);
            }
        }

        async function selectNumber(number) {
            if (userData && userData.selected_number) {
                showToast(`You already selected number ${userData.selected_number}`, 'error');
                return;
            }
            
            if (userData && userData.payment_status === 'pending') {
                showToast('You have a pending payment. Please wait.', 'error');
                return;
            }
            
            if (allNumbers[number] && allNumbers[number] !== userId) {
                showToast(`Number ${number} is already taken!`, 'error');
                return;
            }
            
            selectedNumberData = number;
            const amount = numberPrices[number];
            
            document.getElementById('selectedDisplay').style.display = 'block';
            document.getElementById('selectedNumber').textContent = number;
            document.getElementById('selectedAmount').textContent = amount;
            
            showToast(`Selected number ${number}. Amount: ${amount} ETB`, 'success');
            
            try {
                const response = await fetch('/api/select-number', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, number: number })
                });
                const result = await response.json();
                
                if (result.success) {
                    userData.selected_number = number;
                    generateNumberGrid();
                } else {
                    showToast('Failed to save selection', 'error');
                }
            } catch (error) {
                console.error('Error saving selection:', error);
                showToast('Network error', 'error');
            }
        }

        function showUpload() {
            if (!selectedNumberData && !(userData && userData.selected_number)) {
                showToast('Please select a number first!', 'error');
                return;
            }
            
            if (userData && userData.payment_status === 'pending') {
                showToast('You already have a pending payment!', 'error');
                return;
            }
            
            if (userData && userData.payment_status === 'approved') {
                showToast('Your payment is already approved!', 'error');
                return;
            }
            
            document.getElementById('uploadSection').style.display = 'block';
            document.getElementById('showUploadBtn').style.display = 'none';
        }

        function hideUpload() {
            document.getElementById('uploadSection').style.display = 'none';
            document.getElementById('showUploadBtn').style.display = 'block';
            document.getElementById('fileInput').value = '';
            document.getElementById('fileName').textContent = '';
        }

        document.getElementById('fileInput').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('fileName').textContent = `Selected: ${file.name}`;
            }
        });

        async function submitPayment() {
            const file = document.getElementById('fileInput').files[0];
            const selectedNum = selectedNumberData || (userData ? userData.selected_number : null);
            
            if (!selectedNum) {
                showToast('Please select a number first!', 'error');
                return;
            }
            
            if (!file) {
                showToast('Please upload a screenshot!', 'error');
                return;
            }
            
            const amount = numberPrices[selectedNum];
            
            const formData = new FormData();
            formData.append('user_id', userId);
            formData.append('amount', amount);
            formData.append('number', selectedNum);
            formData.append('file', file);
            
            showToast('Submitting payment...', 'info');
            
            try {
                const response = await fetch('/api/submit-payment-web', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                
                if (result.success) {
                    showToast('Payment submitted! Waiting for approval.', 'success');
                    setTimeout(() => {
                        location.reload();
                    }, 2000);
                } else {
                    showToast('Error: ' + result.message, 'error');
                }
            } catch (error) {
                showToast('Network error. Please try again.', 'error');
            }
        }

        async function checkStatus() {
            try {
                const response = await fetch(`/api/user/${userId}`);
                const user = await response.json();
                const status = user.payment_status || 'none';
                
                const statusMessages = {
                    'none': '📭 No payment submitted yet.',
                    'pending': '⏳ Your payment is pending approval.',
                    'approved': '✅ Your payment has been approved!',
                    'rejected': '❌ Your payment was rejected.'
                };
                
                showMessage('info', statusMessages[status]);
                showToast(`Status: ${status.toUpperCase()}`, 'info');
                
                await loadUserData();
                generateNumberGrid();
                await loadWinners();
                
            } catch (error) {
                showToast('Error checking status', 'error');
            }
        }

        function showMessage(type, message) {
            const messageCard = document.getElementById('messageCard');
            messageCard.className = `message-card message-${type}`;
            messageCard.innerHTML = `<p>${message}</p>`;
            messageCard.style.display = 'block';
            
            setTimeout(() => {
                messageCard.style.display = 'none';
            }, 5000);
        }

        function showToast(message, type) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.style.background = type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#333';
            toast.className = 'toast show';
            setTimeout(() => {
                toast.className = 'toast';
            }, 3000);
        }

        async function init() {
            await loadUserData();
            await loadWinners();
            generateNumberGrid();
            document.getElementById('loadingScreen').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
        }
        
        init();
    </script>
</body>
</html>
"""

# API Endpoints
@app.get("/")
async def serve_frontend():
    """Serve the main game dashboard"""
    return HTMLResponse(content=HTML_CONTENT)

@app.get("/api/user/{user_id}")
async def get_user(user_id: int):
    """Get user profile with all details"""
    user_data = await get_user_data(user_id)
    return JSONResponse(user_data)

@app.get("/api/taken-numbers")
async def get_taken_numbers():
    """Get all taken numbers with user IDs"""
    taken = {}
    if db_manager.users_collection is not None:
        approved_users = db_manager.users_collection.find(
            {"payment_status": "approved", "selected_number": {"$ne": None}},
            {"selected_number": 1, "telegram_id": 1}
        )
        for user in approved_users:
            num = user.get('selected_number')
            if num:
                taken[num] = user['telegram_id']
    return JSONResponse(taken)
@app.post("/api/select-number")
async def select_number(data: dict):
    """Select a number for the user"""
    try:
        user_id = data.get('user_id')
        number = data.get('number')
        
        if not user_id or not number:
            return JSONResponse({"success": False, "message": "Missing user_id or number"})
        
        # Check if number is available
        taken_numbers = await get_taken_numbers()
        if number in taken_numbers and taken_numbers[number] != user_id:
            return JSONResponse({"success": False, "message": "Number already taken"})
        
        if db_manager.users_collection is not None:
            db_manager.users_collection.update_one(
                {"telegram_id": user_id},
                {"$set": {"selected_number": number}},
                upsert=True
            )
        return JSONResponse({"success": True})
    except Exception as e:
        logger.error(f"Error selecting number: {e}")
        return JSONResponse({"success": False, "message": str(e)})

@app.post("/api/submit-payment-web")
async def submit_payment_web(
    user_id: int = Form(...),
    amount: float = Form(...),
    number: int = Form(...),
    file: UploadFile = File(...)
):
    """Submit payment with screenshot"""
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            return JSONResponse({"success": False, "message": "Only image files are allowed"})
        
        # Create uploads directory if not exists
        os.makedirs(config.UPLOAD_DIR, exist_ok=True)
        
        # Save file with unique name
        file_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1] or '.jpg'
        file_path = os.path.join(config.UPLOAD_DIR, f"{file_id}{file_extension}")
        
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Create payment record
        payment_data = {
            "payment_id": str(uuid.uuid4()),
            "telegram_id": user_id,
            "amount": amount,
            "selected_number": number,
            "file_path": file_path,
            "status": "pending",
            "created_at": datetime.now()
        }
        
        if db_manager.payments_collection is not None:
            db_manager.payments_collection.insert_one(payment_data)
        
        if db_manager.users_collection is not None:
            db_manager.users_collection.update_one(
                {"telegram_id": user_id},
                {"$set": {
                    "payment_status": "pending",
                    "payment_image": file_path,
                    "selected_number": number
                }},
                upsert=True
            )
        
        return JSONResponse({"success": True, "message": "Payment submitted successfully"})
    except Exception as e:
        logger.error(f"Error submitting payment: {e}")
        return JSONResponse({"success": False, "message": str(e)})

@app.get("/api/winners")
async def get_winners_list():
    """Get all winners"""
    winners = await get_winners()
    return JSONResponse(winners)

@app.post("/api/declare-winner")
async def declare_winner_endpoint(data: dict):
    """Admin endpoint to declare a winner"""
    try:
        number = data.get('number')
        telegram_id = data.get('telegram_id')
        prize_amount = data.get('prize_amount')
        
        if not all([number, telegram_id, prize_amount]):
            return JSONResponse({"success": False, "message": "Missing required fields"})
        
        success = await declare_winner(number, telegram_id, prize_amount)
        return JSONResponse({"success": success})
    except Exception as e:
        logger.error(f"Error declaring winner: {e}")
        return JSONResponse({"success": False, "message": str(e)})

@app.get("/api/available-numbers")
async def get_available_numbers_list():
    """Get list of available numbers"""
    available = get_available_numbers(0)  # Pass dummy ID, function will handle
    return JSONResponse({"available_numbers": available})

if __name__ == "__main__":
    import uvicorn
    
    # Run the server
    uvicorn.run(
        app,
        host=config.HOST,
        port=config.PORT,
        log_level="info"
    )