import React, { useState, useEffect } from "react";

// Use localhost backend API directly
const API_BASE_URL = "https://digital-unity-bot.onrender.com";

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState("pending");
  const [stats, setStats] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementText, setAnnouncementText] = useState("");
  const [winnerResult, setWinnerResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [numPlaces, setNumPlaces] = useState(3);
  const [winnerLeaderboard, setWinnerLeaderboard] = useState({
    winners: [],
    total_winners: 0,
    total_prize_distributed: 0,
  });
  const [prizeAmounts, setPrizeAmounts] = useState({
    1: 5000,
    2: 3000,
    3: 2000,
    4: 1000,
    5: 500,
  });

  // Game management states
  const [showGameCreator, setShowGameCreator] = useState(false);
  const [showGameEditor, setShowGameEditor] = useState(false);
  const [newGamePrice, setNewGamePrice] = useState(100);
  const [newGameMinNumber, setNewGameMinNumber] = useState(1);
  const [newGameMaxNumber, setNewGameMaxNumber] = useState(16);
  const [activeGame, setActiveGame] = useState(null);
  const [hasActiveGame, setHasActiveGame] = useState(true);

  // Edit game states
  const [editPrice, setEditPrice] = useState(100);
  const [editMinNumber, setEditMinNumber] = useState(1);
  const [editMaxNumber, setEditMaxNumber] = useState(999);
  const [editIsActive, setEditIsActive] = useState(true);

  const ADMIN_ID = 1296141395;

  const apiCall = async (endpoint, method = "GET", body = null) => {
    const url = `${API_BASE_URL}${endpoint}${method === "GET" ? `?admin_id=${ADMIN_ID}` : ""}`;
    console.log("API Call URL:", url);
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body) options.body = JSON.stringify({ admin_id: ADMIN_ID, ...body });

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      console.log("API Call Response:", result);
      return result;
    } catch (error) {
      console.error("API Call Failed:", error);
      throw error;
    }
  };

  useEffect(() => {
    loadStats();
    loadPendingPayments();
    loadAllUsers();
    loadAnnouncements();
    loadWinnerLeaderboard();
    loadActiveGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadActiveGame = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/game/config`);
      const data = await response.json();
      console.log("Active game data:", data);

      if (data && data.game_id !== undefined && data.game_id !== null) {
        setActiveGame(data);
        setHasActiveGame(data.is_active === true);
        // Set edit form values
        setEditPrice(data.price_per_number || 100);
        setEditMinNumber(data.min_number || 1);
        setEditMaxNumber(data.max_number || 999);
        setEditIsActive(data.is_active === true);
        console.log(
          "Game loaded - ID:",
          data.game_id,
          "Active:",
          data.is_active,
        );
      } else {
        console.log("No game data received");
        setHasActiveGame(false);
        setActiveGame(null);
      }
    } catch (error) {
      console.error("Error loading active game:", error);
      setHasActiveGame(false);
      setActiveGame(null);
    }
  };

  const loadStats = async () => {
    try {
      const data = await apiCall("/api/admin/stats");
      console.log("Stats response:", data);
      setStats(data);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadPendingPayments = async () => {
    try {
      const data = await apiCall("/api/admin/pending-payments");
      console.log("Pending payments response:", data);
      console.log("Pending payments count:", data.pending_payments?.length);
      console.log("Pending payments:", data.pending_payments);
      setPendingPayments(data.pending_payments || []);
    } catch (error) {
      console.error("Error loading pending payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const data = await apiCall("/api/admin/all-users");
      console.log("All users response:", data);
      setAllUsers(data.users || []);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const loadAnnouncements = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/announcements`);
      const data = await response.json();
      setAnnouncements(data.items || []);
    } catch (error) {
      console.error("Error loading announcements:", error);
    }
  };

  const loadWinnerLeaderboard = async () => {
    try {
      const data = await apiCall("/api/admin/winner-leaderboard");
      setWinnerLeaderboard(data);
    } catch (error) {
      console.error("Error loading winner leaderboard:", error);
    }
  };

  const approvePayment = async (paymentId) => {
    if (!window.confirm("Approve this payment?")) return;
    const result = await apiCall("/api/admin/approve-payment", "POST", {
      payment_id: paymentId,
    });
    alert(result.message);
    loadPendingPayments();
    loadStats();
    loadAllUsers();
  };

  const rejectPayment = async (paymentId) => {
    const reason = window.prompt("Enter rejection reason:");
    if (reason === null) return;
    const result = await apiCall("/api/admin/reject-payment", "POST", {
      payment_id: paymentId,
      reason,
    });
    alert(result.message);
    loadPendingPayments();
    loadStats();
    loadAllUsers();
  };

  const selectMultiWinners = async () => {
    if (!window.confirm(`Select ${numPlaces} winners randomly?`)) return;
    const result = await apiCall("/api/admin/select-multi-winners", "POST", {
      num_places: numPlaces,
      prize_amounts: prizeAmounts,
    });
    if (result.success) {
      setWinnerResult(result.winners);
      alert(
        `${result.winners.length} winners selected! Non-winners have been reset for next round.`,
      );
      loadStats();
      loadWinnerLeaderboard();
      loadActiveGame();
      window.dispatchEvent(new Event("gameCreated"));
    } else {
      alert(result.message);
    }
  };

  const createNewGame = async () => {
    if (
      !window.confirm(
        `Create new game round with price ${newGamePrice} ETB per number?`,
      )
    )
      return;

    const result = await apiCall("/api/admin/create-game", "POST", {
      price_per_number: newGamePrice,
      min_number: newGameMinNumber,
      max_number: newGameMaxNumber,
    });

    if (result.success) {
      alert(
        `✅ New game round #${result.game_id} created! Price: ${result.price_per_number} ETB per number`,
      );
      setShowGameCreator(false);
      loadStats();
      loadActiveGame();
      window.dispatchEvent(new Event("gameCreated"));
      setNewGamePrice(100);
      setNewGameMinNumber(1);
      setNewGameMaxNumber(16);
    } else {
      alert(result.message || "Failed to create new game");
    }
  };

  const updateCurrentGame = async () => {
    if (
      !window.confirm(
        `Update current game settings?\n\nPrice: ${editPrice} ETB\nNumbers: ${editMinNumber} - ${editMaxNumber}\nActive: ${editIsActive ? "Yes" : "No"}`,
      )
    )
      return;

    const result = await apiCall("/api/admin/update-game", "POST", {
      game_id: activeGame?.game_id,
      price_per_number: editPrice,
      min_number: editMinNumber,
      max_number: editMaxNumber,
      is_active: editIsActive,
    });

    if (result.success) {
      alert(`✅ Game settings updated!`);
      setShowGameEditor(false);
      loadActiveGame();
      loadStats();
      window.dispatchEvent(new Event("gameCreated"));
    } else {
      alert(result.message || "Failed to update game");
    }
  };

  const createAnnouncement = async () => {
    if (!announcementText.trim()) {
      alert("Please enter announcement text");
      return;
    }
    const result = await apiCall("/api/admin/announcement", "POST", {
      text: announcementText,
    });
    if (result.success) {
      alert("Announcement posted!");
      setAnnouncementText("");
      loadAnnouncements();
    }
  };

  const filteredUsers = allUsers.filter(
    (user) =>
      user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.telegram_id?.toString().includes(searchQuery),
  );

  const getPlaceBadge = (place) => {
    const badges = {
      1: "bg-yellow-500",
      2: "bg-gray-400",
      3: "bg-orange-600",
      4: "bg-blue-500",
      5: "bg-green-500",
    };
    return badges[place] || "bg-purple-500";
  };

  const getPlaceEmoji = (place) => {
    const emojis = {
      1: "🥇",
      2: "🥈",
      3: "🥉",
      4: "🏅",
      5: "🎖️",
    };
    return emojis[place] || "🏆";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            🎮 Digital Unity Admin Panel
          </h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowGameEditor(!showGameEditor)}
              className="bg-yellow-600 text-white px-4 py-2 rounded-xl hover:bg-yellow-700 transition-all"
            >
              ✏️ Edit Current Game
            </button>
            <button
              onClick={() => setShowGameCreator(!showGameCreator)}
              className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-all"
            >
              🎮 Create New Game
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="bg-gray-700 text-white px-4 py-2 rounded-xl hover:bg-gray-600 transition-all"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {!hasActiveGame && (
          <div className="bg-red-500/20 border border-red-500 rounded-2xl p-4 mb-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">⚠️</span>
                <div>
                  <div className="text-white font-bold text-lg">
                    No Active Game Round!
                  </div>
                  <div className="text-red-200 text-sm">
                    Players cannot select numbers or make payments until a new
                    game is created.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowGameCreator(true)}
                className="bg-green-600 text-white px-6 py-2 rounded-xl hover:bg-green-700 transition-all font-bold"
              >
                🎮 Create Game Now
              </button>
            </div>
          </div>
        )}

        {activeGame && hasActiveGame && (
          <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-2xl p-4 mb-6 text-white">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <div className="text-sm opacity-80">Active Game Round</div>
                <div className="text-2xl font-bold">
                  #{activeGame.round || activeGame.game_id}
                </div>
              </div>
              <div>
                <div className="text-sm opacity-80">Price per Number</div>
                <div className="text-xl font-bold">
                  {activeGame.price_per_number} ETB
                </div>
              </div>
              <div>
                <div className="text-sm opacity-80">Numbers Range</div>
                <div className="text-lg font-bold">
                  {activeGame.min_number} - {activeGame.max_number}
                </div>
              </div>
              <div>
                <div className="text-sm opacity-80">Total Numbers</div>
                <div className="text-xl font-bold">
                  {activeGame.total_numbers}
                </div>
              </div>
              <div className="text-green-400 text-sm">✅ Game Active</div>
            </div>
          </div>
        )}

        {/* Edit Game Modal */}
        {showGameEditor && activeGame && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-white mb-4">
                ✏️ Edit Current Game (Round #{activeGame.game_id})
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-gray-300 block mb-2">
                    Price per Number (ETB):
                  </label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(parseInt(e.target.value))}
                    className="w-full px-4 py-2 rounded-xl bg-gray-700 text-white border border-gray-600"
                    min="10"
                    step="10"
                  />
                </div>

                <div>
                  <label className="text-gray-300 block mb-2">
                    Minimum Number:
                  </label>
                  <input
                    type="number"
                    value={editMinNumber}
                    onChange={(e) => setEditMinNumber(parseInt(e.target.value))}
                    className="w-full px-4 py-2 rounded-xl bg-gray-700 text-white border border-gray-600"
                    min="1"
                  />
                </div>

                <div>
                  <label className="text-gray-300 block mb-2">
                    Maximum Number:
                  </label>
                  <input
                    type="number"
                    value={editMaxNumber}
                    onChange={(e) => setEditMaxNumber(parseInt(e.target.value))}
                    className="w-full px-4 py-2 rounded-xl bg-gray-700 text-white border border-gray-600"
                    min={editMinNumber + 1}
                  />
                </div>

                <div>
                  <label className="text-gray-300 block mb-2">
                    Game Status:
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-white">
                      <input
                        type="radio"
                        value="true"
                        checked={editIsActive === true}
                        onChange={() => setEditIsActive(true)}
                        className="w-4 h-4"
                      />
                      Active
                    </label>
                    <label className="flex items-center gap-2 text-white">
                      <input
                        type="radio"
                        value="false"
                        checked={editIsActive === false}
                        onChange={() => setEditIsActive(false)}
                        className="w-4 h-4"
                      />
                      Inactive
                    </label>
                  </div>
                </div>

                <div className="bg-gray-700 rounded-xl p-3">
                  <div className="text-gray-300 text-sm">Preview:</div>
                  <div className="text-white font-bold">
                    {editPrice} ETB per number
                  </div>
                  <div className="text-gray-400 text-xs">
                    Numbers: {editMinNumber} to {editMaxNumber}
                  </div>
                  <div className="text-gray-400 text-xs">
                    Total numbers: {editMaxNumber - editMinNumber + 1}
                  </div>
                  <div className="text-gray-400 text-xs">
                    Status: {editIsActive ? "Active" : "Inactive"}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={updateCurrentGame}
                  className="flex-1 bg-yellow-600 text-white py-2 rounded-xl hover:bg-yellow-700 transition-all"
                >
                  💾 Save Changes
                </button>
                <button
                  onClick={() => setShowGameEditor(false)}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-xl hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Game Modal */}
        {showGameCreator && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-white mb-4">
                🎮 Create New Game Round
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-gray-300 block mb-2">
                    Price per Number (ETB):
                  </label>
                  <input
                    type="number"
                    value={newGamePrice}
                    onChange={(e) => setNewGamePrice(parseInt(e.target.value))}
                    className="w-full px-4 py-2 rounded-xl bg-gray-700 text-white border border-gray-600"
                    min="10"
                    step="10"
                  />
                </div>
                <div>
                  <label className="text-gray-300 block mb-2">
                    Minimum Number:
                  </label>
                  <input
                    type="number"
                    value={newGameMinNumber}
                    onChange={(e) =>
                      setNewGameMinNumber(parseInt(e.target.value))
                    }
                    className="w-full px-4 py-2 rounded-xl bg-gray-700 text-white border border-gray-600"
                    min="1"
                  />
                </div>
                <div>
                  <label className="text-gray-300 block mb-2">
                    Maximum Number:
                  </label>
                  <input
                    type="number"
                    value={newGameMaxNumber}
                    onChange={(e) =>
                      setNewGameMaxNumber(parseInt(e.target.value))
                    }
                    className="w-full px-4 py-2 rounded-xl bg-gray-700 text-white border border-gray-600"
                    min={newGameMinNumber + 1}
                  />
                </div>
                <div className="bg-gray-700 rounded-xl p-3">
                  <div className="text-gray-300 text-sm">Preview:</div>
                  <div className="text-white font-bold">
                    {newGamePrice} ETB per number
                  </div>
                  <div className="text-gray-400 text-xs">
                    Numbers: {newGameMinNumber} to {newGameMaxNumber}
                  </div>
                  <div className="text-gray-400 text-xs">
                    Total numbers: {newGameMaxNumber - newGameMinNumber + 1}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={createNewGame}
                  className="flex-1 bg-green-600 text-white py-2 rounded-xl hover:bg-green-700 transition-all"
                >
                  ✅ Create Game
                </button>
                <button
                  onClick={() => setShowGameCreator(false)}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-xl hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Total Users</div>
            <div className="text-3xl font-bold">{stats?.total_users || 0}</div>
          </div>
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Pending Payments</div>
            <div className="text-3xl font-bold">
              {pendingPayments.length || 0}
            </div>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Approved Payments</div>
            <div className="text-3xl font-bold">
              {stats?.approved_payments || 0}
            </div>
          </div>
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Total Winners</div>
            <div className="text-3xl font-bold">
              {winnerLeaderboard.total_winners || 0}
            </div>
          </div>
          <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Total Prize</div>
            <div className="text-2xl font-bold">
              {winnerLeaderboard.total_prize_distributed || 0} ETB
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-6 py-2 rounded-xl font-semibold transition-all ${activeTab === "pending" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
          >
            📋 Pending Payments
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-6 py-2 rounded-xl font-semibold transition-all ${activeTab === "users" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
          >
            👥 All Users
          </button>
          <button
            onClick={() => setActiveTab("winner")}
            className={`px-6 py-2 rounded-xl font-semibold transition-all ${activeTab === "winner" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
          >
            🏆 Select Winners
          </button>
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`px-6 py-2 rounded-xl font-semibold transition-all ${activeTab === "leaderboard" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
          >
            📊 Winner Leaderboard
          </button>
          <button
            onClick={() => setActiveTab("announcements")}
            className={`px-6 py-2 rounded-xl font-semibold transition-all ${activeTab === "announcements" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
          >
            📢 Announcements
          </button>
        </div>

        {activeTab === "pending" && (
          <div className="bg-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              📋 Pending Payments
            </h2>
            {pendingPayments.length === 0 ? (
              <div className="text-gray-400 text-center">
                No pending payments
              </div>
            ) : (
              <div className="space-y-4">
                {pendingPayments.map((payment) => (
                  <div
                    key={payment.payment_id}
                    className="bg-gray-700 rounded-xl p-4"
                  >
                    <div className="flex justify-between items-start flex-wrap gap-4">
                      <div className="flex-1">
                        <div className="font-bold text-white">
                          @{payment.user_name || payment.username}
                        </div>
                        <div className="text-sm text-gray-400">
                          User ID: {payment.telegram_id}
                        </div>
                        <div className="text-sm text-gray-400">
                          📱 {payment.phone_number}
                        </div>
                        <div className="text-sm text-gray-400">
                          🎲 Number: {payment.number}
                        </div>
                        <div className="text-xs text-gray-400">
                          Payment ID: {payment.payment_id}
                        </div>
                        <div className="text-xs text-gray-400">
                          Amount: {payment.amount} ETB
                        </div>
                      </div>

                      {payment.image_url && (
                        <div className="flex-shrink-0">
                          <img
                            src={payment.image_url}
                            alt="Payment proof"
                            className="w-20 h-20 rounded-lg object-cover border border-gray-500 cursor-pointer hover:opacity-80 transition-all hover:scale-105"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(payment.image_url, "_blank");
                            }}
                          />
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => approvePayment(payment.payment_id)}
                          className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-all"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => rejectPayment(payment.payment_id)}
                          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-all"
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "users" && (
          <div className="bg-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">👥 All Users</h2>
            <input
              type="text"
              placeholder="Search by username or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full mb-4 px-4 py-2 rounded-xl bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredUsers.map((user) => (
                <div
                  key={user.telegram_id}
                  className="bg-gray-700 rounded-lg p-3"
                >
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <span className="font-bold text-white">
                        @{user.username}
                      </span>
                      <span className="text-gray-400 text-sm ml-2">
                        ID: {user.telegram_id}
                      </span>
                      <div className="text-xs text-gray-500">
                        📱 {user.phone_number}
                      </div>
                      <div className="text-xs text-gray-500">
                        🎲 Numbers:{" "}
                        {user.selected_numbers?.length > 0
                          ? user.selected_numbers.join(", ")
                          : "None"}
                        {user.selected_numbers?.length > 0 && (
                          <span className="text-green-400 ml-1">
                            (Approved)
                          </span>
                        )}
                      </div>
                      {user.pending_numbers?.length > 0 && (
                        <div className="text-xs text-yellow-500">
                          ⏳ Pending: {user.pending_numbers.join(", ")}
                        </div>
                      )}
                    </div>
                    <div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          user.payment_status === "approved"
                            ? "bg-green-500"
                            : user.payment_status === "pending"
                              ? "bg-orange-500"
                              : user.payment_status === "rejected"
                                ? "bg-red-500"
                                : "bg-gray-500"
                        } text-white`}
                      >
                        {user.payment_status?.toUpperCase() || "NONE"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "winner" && (
          <div className="bg-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              🏆 Select Winners
            </h2>
            <div className="mb-4">
              <label className="text-gray-300 block mb-2">
                Number of Winners to Select:
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={numPlaces}
                onChange={(e) => setNumPlaces(parseInt(e.target.value))}
                className="w-full px-4 py-2 rounded-xl bg-gray-700 text-white border border-gray-600"
              />
            </div>
            <div className="mb-6">
              <label className="text-gray-300 block mb-2">
                Prize Amounts (ETB):
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {[...Array(numPlaces)].map((_, index) => (
                  <div key={index} className="flex gap-4 items-center">
                    <div className="w-24 text-gray-400">
                      Place #{index + 1}:
                    </div>
                    <input
                      type="number"
                      placeholder="Prize amount"
                      value={prizeAmounts[index + 1] || ""}
                      onChange={(e) => {
                        const newAmounts = {
                          ...prizeAmounts,
                          [index + 1]: parseInt(e.target.value),
                        };
                        setPrizeAmounts(newAmounts);
                      }}
                      className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-xl border border-gray-600"
                    />
                    <span className="text-gray-400">ETB</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={selectMultiWinners}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-bold text-lg hover:scale-105 transition-all"
            >
              🎲 SELECT {numPlaces} WINNER{numPlaces > 1 ? "S" : ""} RANDOMLY
            </button>
            {winnerResult && (
              <div className="mt-6">
                <h3 className="text-white font-bold text-lg mb-3">
                  🎉 WINNERS SELECTED! 🎉
                </h3>
                <div className="space-y-3">
                  {winnerResult.map((winner) => (
                    <div
                      key={winner.place}
                      className={`${getPlaceBadge(winner.place)} rounded-xl p-4 text-white`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">
                            {getPlaceEmoji(winner.place)}
                          </span>
                          <div>
                            <div className="font-bold text-xl">
                              Place #{winner.place}
                            </div>
                            <div>👤 @{winner.username}</div>
                            <div className="text-sm opacity-90">
                              🎲 Number: {winner.winning_number}
                            </div>
                            {winner.telegram_id && (
                              <div className="text-xs opacity-70">
                                ID: {winner.telegram_id}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            {winner.prize_amount} ETB
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary Section */}
                <div className="mt-4 bg-gray-700 rounded-xl p-3">
                  <div className="text-gray-300 text-sm">📊 Summary:</div>
                  <div className="text-white text-sm">
                    Total entries: {winnerResult.length} | Unique winners:{" "}
                    {new Set(winnerResult.map((w) => w.telegram_id)).size} users
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div className="bg-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              📊 Winner Leaderboard
            </h2>
            <div className="space-y-3">
              {winnerLeaderboard.winners?.map((winner, idx) => (
                <div
                  key={idx}
                  className={`${getPlaceBadge(winner.place)} rounded-xl p-4 text-white`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {getPlaceEmoji(winner.place)}
                      </span>
                      <div>
                        <div className="font-bold">@{winner.username}</div>
                        <div className="text-sm opacity-90">
                          Number: {winner.winning_number}
                        </div>
                        <div className="text-xs opacity-75">
                          Round {winner.game_id}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">
                        {winner.prize_amount} ETB
                      </div>
                      <div className="text-xs opacity-75">
                        {new Date(winner.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {winnerLeaderboard.winners?.length === 0 && (
                <div className="text-gray-400 text-center">No winners yet</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "announcements" && (
          <div className="bg-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              📢 Create Announcement
            </h2>
            <textarea
              rows="3"
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
              placeholder="Enter announcement..."
            />
            <button
              onClick={createAnnouncement}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 rounded-xl font-bold hover:scale-105 transition-all"
            >
              Post Announcement
            </button>
            <h3 className="text-lg font-bold text-white mt-6 mb-3">
              Recent Announcements
            </h3>
            <div className="space-y-2">
              {announcements.slice(0, 10).map((ann, idx) => (
                <div key={idx} className="bg-gray-700 rounded-lg p-3">
                  <div className="text-white">📢 {ann.text}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(ann.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
