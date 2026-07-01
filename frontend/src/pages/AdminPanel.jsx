import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_BASE_URL = (process.env.REACT_APP_API_URL || (isLocalhost ? "http://localhost:8000" : "https://digitalunitybot-production.up.railway.app")).replace(/\/$/, "");

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

  const [showGameCreator, setShowGameCreator] = useState(false);
  const [showGameEditor, setShowGameEditor] = useState(false);
  const [newGamePrice, setNewGamePrice] = useState(100);
  const [newGameMinNumber, setNewGameMinNumber] = useState(1);
  const [newGameMaxNumber, setNewGameMaxNumber] = useState(16);
  const [activeGame, setActiveGame] = useState(null);
  const [hasActiveGame, setHasActiveGame] = useState(true);
  const [editPrice, setEditPrice] = useState(100);
  const [editMinNumber, setEditMinNumber] = useState(1);
  const [editMaxNumber, setEditMaxNumber] = useState(999);
  const [editIsActive, setEditIsActive] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  const ADMIN_ID = 1296141395;

  const apiCall = async (endpoint, method = "GET", body = null) => {
    const url = `${API_BASE_URL}${endpoint}${method === "GET" ? `?admin_id=${ADMIN_ID}` : ""}`;
    const options = { method, headers: { "Content-Type": "application/json" } };
    if (body) options.body = JSON.stringify({ admin_id: ADMIN_ID, ...body });
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
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

  const loadActiveGame = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/game/config`);
      const data = await response.json();
      if (data && data.game_id) {
        setActiveGame(data);
        setHasActiveGame(data.is_active === true);
        setEditPrice(data.price_per_number || 100);
        setEditMinNumber(data.min_number || 1);
        setEditMaxNumber(data.max_number || 999);
        setEditIsActive(data.is_active === true);
      } else {
        setHasActiveGame(false);
        setActiveGame(null);
      }
    } catch (error) {
      setHasActiveGame(false);
      setActiveGame(null);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiCall("/api/admin/stats");
      setStats(data);
    } catch (error) {}
  }, []);

  const loadPendingPayments = useCallback(async () => {
    try {
      const data = await apiCall("/api/admin/pending-payments");
      setPendingPayments(data.pending_payments || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllUsers = useCallback(async () => {
    try {
      const data = await apiCall("/api/admin/all-users");
      setAllUsers(data.users || []);
    } catch (error) {}
  }, []);

  const loadAnnouncements = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/announcements`);
      const data = await response.json();
      setAnnouncements(data.items || []);
    } catch (error) {}
  }, []);

  const loadWinnerLeaderboard = useCallback(async () => {
    try {
      const data = await apiCall("/api/admin/winner-leaderboard");
      setWinnerLeaderboard(data);
    } catch (error) {}
  }, []);

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
      alert(`${result.winners.length} winners selected!`);
      loadStats();
      loadWinnerLeaderboard();
      loadActiveGame();
      window.dispatchEvent(new Event("gameCreated"));
    } else {
      alert(result.message);
    }
  };

  const createNewGame = async () => {
    if (!window.confirm(`Create new game with price ${newGamePrice} ETB?`))
      return;
    const result = await apiCall("/api/admin/create-game", "POST", {
      price_per_number: newGamePrice,
      min_number: newGameMinNumber,
      max_number: newGameMaxNumber,
    });
    if (result.success) {
      alert(`✅ New game round #${result.game_id} created!`);
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
    if (!window.confirm(`Update game settings?`)) return;
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
    if (!announcementText.trim())
      return alert("Please enter announcement text");
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
      1: "from-yellow-500 to-amber-500",
      2: "from-gray-400 to-gray-500",
      3: "from-orange-600 to-orange-700",
      4: "from-blue-500 to-blue-600",
      5: "from-green-500 to-green-600",
    };
    return badges[place] || "from-[#1E3A8A] to-[#3B82F6]";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A192F] via-[#1E3A8A] to-[#3B82F6] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#3B82F6] mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A192F] via-[#1E3A8A] to-[#3B82F6]">
      {/* Image Preview Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Full size"
            className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">DU</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] bg-clip-text text-transparent">
              Admin Panel
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowGameEditor(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm font-semibold shadow-lg transition-all flex items-center gap-1"
            >
              <span>✏️</span>
              <span className="hidden sm:inline">Edit</span>
            </button>
            <button
              onClick={() => setShowGameCreator(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm font-semibold shadow-lg transition-all flex items-center gap-1"
            >
              <span>🎮</span>
              <span className="hidden sm:inline">New</span>
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm transition-all flex items-center gap-1"
            >
              <span>←</span>
              <span className="hidden sm:inline">Back</span>
            </button>
          </div>
        </div>

        {/* No Active Game Banner */}
        <AnimatePresence>
          {!hasActiveGame && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-500/20 border border-red-500 rounded-2xl p-4 mb-6 backdrop-blur-sm"
            >
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">⚠️</span>
                  <div>
                    <div className="text-white font-bold text-base sm:text-lg">
                      No Active Game Round!
                    </div>
                    <div className="text-red-200 text-xs sm:text-sm">
                      Create a new game to start the round
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowGameCreator(true)}
                  className="bg-emerald-600 text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-sm font-bold"
                >
                  🎮 Create
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Game Info */}
        {activeGame && hasActiveGame && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] rounded-2xl p-4 mb-6 shadow-xl"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-white text-center sm:text-left">
              <div>
                <div className="text-xs opacity-80">Game</div>
                <div className="text-lg sm:text-2xl font-bold">
                  #{activeGame.round || activeGame.game_id}
                </div>
              </div>
              <div>
                <div className="text-xs opacity-80">Price</div>
                <div className="text-base sm:text-xl font-bold">
                  {activeGame.price_per_number} ETB
                </div>
              </div>
              <div>
                <div className="text-xs opacity-80">Range</div>
                <div className="text-sm sm:text-lg font-bold">
                  {activeGame.min_number} - {activeGame.max_number}
                </div>
              </div>
              <div>
                <div className="text-xs opacity-80">Total</div>
                <div className="text-base sm:text-xl font-bold">
                  {activeGame.total_numbers}
                </div>
              </div>
              <div className="text-emerald-400 font-semibold text-sm sm:text-base">
                ✅ Active
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
          {[
            {
              label: "Users",
              value: stats?.total_users || 0,
              icon: "👥",
              color: "from-blue-500 to-[#1E3A8A]",
            },
            {
              label: "Pending",
              value: pendingPayments.length || 0,
              icon: "⏳",
              color: "from-orange-500 to-red-500",
            },
            {
              label: "Approved",
              value: stats?.approved_payments || 0,
              icon: "✅",
              color: "from-green-500 to-teal-500",
            },
            {
              label: "Winners",
              value: winnerLeaderboard.total_winners || 0,
              icon: "🏆",
              color: "from-yellow-500 to-orange-500",
            },
            {
              label: "Prize",
              value: `${winnerLeaderboard.total_prize_distributed || 0}`,
              icon: "💰",
              color: "from-pink-500 to-[#1E3A8A]",
            },
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-gradient-to-r ${stat.color} rounded-xl p-3 text-white shadow-lg`}
            >
              <div className="text-xs opacity-80 flex items-center gap-1">
                {stat.icon} {stat.label}
              </div>
              <div className="text-xl sm:text-2xl font-bold truncate">
                {stat.value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tabs - Responsive */}
        <div className="flex gap-1.5 sm:gap-2 mb-6 flex-wrap">
          {[
            { id: "pending", label: "📋 Pending", icon: "📋" },
            { id: "users", label: "👥 Users", icon: "👥" },
            { id: "winner", label: "🏆 Winners", icon: "🏆" },
            { id: "leaderboard", label: "📊 Leaderboard", icon: "📊" },
            { id: "announcements", label: "📢 Announce", icon: "📢" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-sm font-semibold transition-all ${activeTab === tab.id ? "bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white shadow-lg" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.icon}</span>
            </button>
          ))}
        </div>

        {/* Edit Game Modal */}
        <AnimatePresence>
          {showGameEditor && activeGame && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowGameEditor(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-gray-900 rounded-2xl p-5 max-w-md w-full border border-[#3B82F6] max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-xl font-bold text-white mb-4">
                  ✏️ Edit Game #{activeGame.game_id}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-300 block mb-2 text-sm">
                      Price (ETB):
                    </label>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(parseInt(e.target.value))}
                      className="w-full px-4 py-2 rounded-xl bg-gray-800 text-white border border-gray-700"
                      min="10"
                      step="10"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-2 text-sm">
                      Number Range:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={editMinNumber}
                        onChange={(e) =>
                          setEditMinNumber(parseInt(e.target.value))
                        }
                        className="w-1/2 px-4 py-2 rounded-xl bg-gray-800 text-white border border-gray-700"
                        min="1"
                      />
                      <input
                        type="number"
                        value={editMaxNumber}
                        onChange={(e) =>
                          setEditMaxNumber(parseInt(e.target.value))
                        }
                        className="w-1/2 px-4 py-2 rounded-xl bg-gray-800 text-white border border-gray-700"
                        min={editMinNumber + 1}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-2 text-sm">
                      Status:
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-white">
                        <input
                          type="radio"
                          checked={editIsActive === true}
                          onChange={() => setEditIsActive(true)}
                        />{" "}
                        Active
                      </label>
                      <label className="flex items-center gap-2 text-white">
                        <input
                          type="radio"
                          checked={editIsActive === false}
                          onChange={() => setEditIsActive(false)}
                        />{" "}
                        Inactive
                      </label>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={updateCurrentGame}
                    className="flex-1 bg-amber-600 text-white py-2 rounded-full font-bold"
                  >
                    💾 Save
                  </button>
                  <button
                    onClick={() => setShowGameEditor(false)}
                    className="flex-1 bg-gray-700 text-white py-2 rounded-full font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Game Modal */}
        <AnimatePresence>
          {showGameCreator && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowGameCreator(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-gray-900 rounded-2xl p-5 max-w-md w-full border border-emerald-500 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-xl font-bold text-white mb-4">
                  🎮 Create New Game
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-300 block mb-2 text-sm">
                      Price (ETB):
                    </label>
                    <input
                      type="number"
                      value={newGamePrice}
                      onChange={(e) =>
                        setNewGamePrice(parseInt(e.target.value))
                      }
                      className="w-full px-4 py-2 rounded-xl bg-gray-800 text-white border border-gray-700"
                      min="10"
                      step="10"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 block mb-2 text-sm">
                      Number Range:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={newGameMinNumber}
                        onChange={(e) =>
                          setNewGameMinNumber(parseInt(e.target.value))
                        }
                        className="w-1/2 px-4 py-2 rounded-xl bg-gray-800 text-white border border-gray-700"
                        min="1"
                      />
                      <input
                        type="number"
                        value={newGameMaxNumber}
                        onChange={(e) =>
                          setNewGameMaxNumber(parseInt(e.target.value))
                        }
                        className="w-1/2 px-4 py-2 rounded-xl bg-gray-800 text-white border border-gray-700"
                        min={newGameMinNumber + 1}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={createNewGame}
                    className="flex-1 bg-emerald-600 text-white py-2 rounded-full font-bold"
                  >
                    ✅ Create
                  </button>
                  <button
                    onClick={() => setShowGameCreator(false)}
                    className="flex-1 bg-gray-700 text-white py-2 rounded-full font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rest of the tabs remain the same but with blue accents */}
        {/* Pending Payments Tab */}
        {activeTab === "pending" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4"
          >
            <h2 className="text-lg font-bold text-white mb-4">
              📋 Pending Payments
            </h2>
            {pendingPayments.length === 0 ? (
              <div className="text-gray-400 text-center py-8">
                No pending payments
              </div>
            ) : (
              <div className="space-y-3">
                {pendingPayments.map((payment, idx) => (
                  <motion.div
                    key={payment.payment_id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className="bg-gray-700/50 rounded-xl p-3"
                  >
                    <div className="flex flex-col sm:flex-row justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-bold text-white break-all">
                          @{payment.user_name || payment.username}
                        </div>
                        <div className="text-xs text-gray-400">
                          ID: {payment.telegram_id} | 📱 {payment.phone_number}
                        </div>
                        <div className="text-sm text-[#60A5FA] font-bold mt-1">
                          Number: {payment.number} | {payment.amount} ETB
                        </div>
                        <div className="text-[10px] text-gray-500 break-all">
                          Payment ID: {payment.payment_id}
                        </div>
                      </div>
                      {payment.image_url && (
                        <img
                          src={payment.image_url}
                          alt="Payment proof"
                          className="w-14 h-14 rounded-lg object-cover border border-gray-600 cursor-pointer hover:opacity-80 flex-shrink-0"
                          onClick={() => setSelectedImage(payment.image_url)}
                        />
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => approvePayment(payment.payment_id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full text-xs font-semibold"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => rejectPayment(payment.payment_id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-full text-xs font-semibold"
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* All Users Tab */}
        {activeTab === "users" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4"
          >
            <h2 className="text-lg font-bold text-white mb-4">👥 All Users</h2>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full mb-4 px-4 py-2 rounded-xl bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-sm"
            />
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredUsers.map((user) => (
                <div
                  key={user.telegram_id}
                  className="bg-gray-700/50 rounded-lg p-3"
                >
                  <div className="flex flex-col sm:flex-row justify-between gap-2">
                    <div className="break-all">
                      <span className="font-bold text-white text-sm">
                        @{user.username}
                      </span>
                      <span className="text-gray-400 text-xs ml-2">
                        ID: {user.telegram_id}
                      </span>
                      <div className="text-xs text-gray-400">
                        📱 {user.phone_number}
                      </div>
                      <div className="text-xs text-emerald-400 break-all">
                        ✅ {user.selected_numbers?.join(", ") || "None"}
                      </div>
                      {user.pending_numbers?.length > 0 && (
                        <div className="text-xs text-amber-400 break-all">
                          ⏳ Pending: {user.pending_numbers.join(", ")}
                        </div>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold text-center whitespace-nowrap self-start ${user.payment_status === "approved" ? "bg-emerald-600" : user.payment_status === "pending" ? "bg-amber-600" : "bg-gray-600"} text-white`}
                    >
                      {user.payment_status?.toUpperCase() || "NONE"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Select Winners Tab */}
        {activeTab === "winner" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4"
          >
            <h2 className="text-lg font-bold text-white mb-4">
              🏆 Select Winners
            </h2>
            <div className="mb-4">
              <label className="text-gray-300 block mb-2 text-sm">
                Number of Winners:
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
              <label className="text-gray-300 block mb-2 text-sm">
                Prize Amounts (ETB):
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {[...Array(numPlaces)].map((_, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row gap-2 items-center"
                  >
                    <div className="w-full sm:w-32 text-gray-400 text-sm">
                      Place #{index + 1}:
                    </div>
                    <input
                      type="number"
                      value={prizeAmounts[index + 1] || ""}
                      onChange={(e) =>
                        setPrizeAmounts({
                          ...prizeAmounts,
                          [index + 1]: parseInt(e.target.value),
                        })
                      }
                      className="flex-1 w-full bg-gray-700 text-white px-4 py-2 rounded-xl border border-gray-600"
                    />
                    <span className="text-gray-400 text-sm">ETB</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={selectMultiWinners}
              className="w-full bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white py-3 rounded-full font-bold text-base hover:scale-105 transition-all"
            >
              🎲 SELECT {numPlaces} WINNER{numPlaces > 1 ? "S" : ""}
            </button>
            {winnerResult && (
              <div className="mt-6">
                <h3 className="text-white font-bold text-base mb-3">
                  🎉 WINNERS SELECTED!
                </h3>
                <div className="space-y-2">
                  {winnerResult.map((winner) => (
                    <div
                      key={winner.place}
                      className={`bg-gradient-to-r ${getPlaceBadge(winner.place)} rounded-xl p-3 text-white`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between gap-2">
                        <div>
                          <div className="font-bold text-lg">
                            Place #{winner.place}
                          </div>
                          <div className="break-all text-sm">
                            @{winner.username}
                          </div>
                          <div className="text-xs opacity-90">
                            Number: {winner.winning_number}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold">
                            {winner.prize_amount} ETB
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 bg-gray-700 rounded-xl p-2">
                  <div className="text-gray-300 text-xs">
                    📊 {winnerResult.length} entries |{" "}
                    {new Set(winnerResult.map((w) => w.telegram_id)).size}{" "}
                    unique winners
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Winner Leaderboard Tab */}
        {activeTab === "leaderboard" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4"
          >
            <h2 className="text-lg font-bold text-white mb-4">
              📊 Winner Leaderboard
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {winnerLeaderboard.winners?.map((winner, idx) => (
                <div
                  key={idx}
                  className={`bg-gradient-to-r ${getPlaceBadge(winner.place)} rounded-xl p-2 text-white`}
                >
                  <div className="flex flex-col sm:flex-row justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm break-all">
                        @{winner.username}
                      </div>
                      <div className="text-xs opacity-90">
                        Number: {winner.winning_number} | Round {winner.game_id}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold">
                        {winner.prize_amount} ETB
                      </div>
                      <div className="text-[10px] opacity-75">
                        {new Date(winner.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {winnerLeaderboard.winners?.length === 0 && (
                <div className="text-gray-400 text-center py-8">
                  No winners yet
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Announcements Tab */}
        {activeTab === "announcements" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4"
          >
            <h2 className="text-lg font-bold text-white mb-4">
              📢 Create Announcement
            </h2>
            <textarea
              rows="3"
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] mb-4 text-sm"
              placeholder="Enter announcement..."
            ></textarea>
            <button
              onClick={createAnnouncement}
              className="w-full bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white py-2 rounded-full font-bold"
            >
              Post Announcement
            </button>
            <h3 className="text-white font-bold mt-5 mb-3 text-sm">
              Recent Announcements
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {announcements.slice(0, 10).map((ann, idx) => (
                <div key={idx} className="bg-gray-700 rounded-lg p-2">
                  <div className="text-white text-xs break-words">
                    📢 {ann.text}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    {new Date(ann.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
