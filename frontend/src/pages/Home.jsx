import React, { useState, useEffect, useCallback } from "react";
import {
  getUserDashboard,
  getLuckyNumbers,
  getWinners,
  getAnnouncements,
  getReferralStats,
  getGameConfig,
} from "../services/api";
import PaymentCard from "../components/PaymentCard";
import ReferralCard from "../components/ReferralCard";
import NumberGrid from "../components/NumberGrid";
import { motion, AnimatePresence } from "framer-motion";

const MIN_LUCKY_NUMBER = 1;
const MAX_LUCKY_NUMBER = 999;

// Logo Component
const Logo = ({ size = "md" }) => {
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  return (
    <div
      className={`${sizeClasses[size]} bg-gradient-to-br from-[#1E3A8A] to-[#3B82F6] rounded-2xl flex items-center justify-center shadow-xl`}
    >
      <span className="text-white font-bold text-2xl">DU</span>
    </div>
  );
};

// Loading Spinner
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-[#0A192F] via-[#1E3A8A] to-[#3B82F6] flex items-center justify-center">
    <div className="text-center">
      <div className="animate-pulse mb-6">
        <Logo size="lg" />
      </div>
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-white mx-auto mb-4"></div>
      <p className="text-white text-lg font-medium">Loading Dashboard...</p>
    </div>
  </div>
);

// Payment Methods Toggle Component
const PaymentMethods = () => {
  const [activeMethod, setActiveMethod] = useState("cbe");
  const [copied, setCopied] = useState(false);

  const methods = {
    cbe: {
      name: "Commercial Bank of Ethiopia",
      account: "1000304777633",
      name_on_account: "Abay Ashebir",
      icon: "🏦",
    },
    telebirr: {
      name: "Telebirr",
      account: "0934478593",
      name_on_account: "Abay Ashebir",
      icon: "📱",
    },
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4">
      <h3 className="text-white text-sm font-semibold mb-3 text-center">
        💳 Payment Methods
      </h3>

      {/* Toggle Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveMethod("cbe")}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
            activeMethod === "cbe"
              ? "bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white shadow-lg"
              : "bg-white/10 text-white/70 hover:bg-white/20"
          }`}
        >
          🏦 CBE
        </button>
        <button
          onClick={() => setActiveMethod("telebirr")}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
            activeMethod === "telebirr"
              ? "bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white shadow-lg"
              : "bg-white/10 text-white/70 hover:bg-white/20"
          }`}
        >
          📱 Telebirr
        </button>
      </div>

      {/* Active Method Details */}
      <div className="bg-[#0A192F]/50 rounded-xl p-4 text-center">
        <div className="text-3xl mb-2">{methods[activeMethod].icon}</div>
        <div className="text-white/70 text-xs mb-1">
          {methods[activeMethod].name}
        </div>
        <div className="text-white/70 text-sm mb-2">
          {methods[activeMethod].name_on_account}
        </div>
        <div className="text-white font-bold text-lg mb-2">
          {methods[activeMethod].account}
        </div>
        <button
          onClick={() => copyToClipboard(methods[activeMethod].account)}
          className="bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white px-4 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105"
        >
          {copied ? "✓ Copied!" : "📋 Copy Account"}
        </button>
      </div>
    </div>
  );
};

const Home = ({ userId, isAdmin }) => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [pendingNumbers, setPendingNumbers] = useState([]);
  const [currentSelectedNumber, setCurrentSelectedNumber] = useState(null);
  const [winners, setWinners] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [error, setError] = useState(null);
  const [referralStats, setReferralStats] = useState(null);
  const [gameConfig, setGameConfig] = useState(null);
  const [gameActive, setGameActive] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [paymentRejected, setPaymentRejected] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState("");
  const [minNumber, setMinNumber] = useState(MIN_LUCKY_NUMBER);
  const [maxNumber, setMaxNumber] = useState(MAX_LUCKY_NUMBER);
  const [showShareModal, setShowShareModal] = useState(false);

  const botUsername = "DigitalUnity_bot";
  const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setPaymentRejected(false);
      setRejectionMessage("");

      const userRes = await getUserDashboard(userId);
      if (!userRes.data.user) {
        setError("Not registered. Please send /start to bot first.");
        setLoading(false);
        return;
      }

      setUserData(userRes.data.user);
      setSelectedNumbers(userRes.data.user.selected_numbers || []);
      setPendingNumbers(userRes.data.user.pending_numbers || []);

      try {
        const referralRes = await getReferralStats(userId);
        setReferralStats(referralRes.data);
      } catch (err) {}

      const numbersRes = await getLuckyNumbers(userId, 1, 16, "");
      window.takenNumbers = numbersRes.data.taken_numbers || {};

      const winnersRes = await getWinners();
      setWinners(winnersRes.data);

      const announcementsRes = await getAnnouncements();
      setAnnouncements(announcementsRes.data.items || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadGameConfig = useCallback(async () => {
    try {
      const configRes = await getGameConfig();
      const configData = configRes.data;
      setGameConfig(configData);
      setGameActive(configData?.is_active === true);
      setMinNumber(configData?.min_number || MIN_LUCKY_NUMBER);
      setMaxNumber(configData?.max_number || MAX_LUCKY_NUMBER);
    } catch (err) {
      console.error(err);
      setGameActive(false);
    }
  }, []);

  useEffect(() => {
    const handleGameCreated = () => setRefreshTrigger((prev) => prev + 1);
    window.addEventListener("gameCreated", handleGameCreated);
    return () => window.removeEventListener("gameCreated", handleGameCreated);
  }, []);

  useEffect(() => {
    if (userData?.payment_status === "rejected") {
      setPaymentRejected(true);
      setRejectionMessage(
        userData?.rejection_reason || "Payment rejected. Select a new number.",
      );
      setCurrentSelectedNumber(null);
      const timer = setTimeout(() => {
        setPaymentRejected(false);
        setRejectionMessage("");
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [userData?.payment_status, userData?.rejection_reason]);

  useEffect(() => {
    if (gameConfig) loadDashboard();
  }, [gameConfig, loadDashboard]);

  useEffect(() => {
    loadDashboard();
    loadGameConfig();
  }, [loadDashboard, loadGameConfig, refreshTrigger]);

  const handleSelectNumber = async (number) => {
    if (!gameActive) {
      alert("No active game round.");
      return;
    }
    if (selectedNumbers.includes(number)) {
      alert(`You already own number ${number}!`);
      return;
    }
    if (pendingNumbers.includes(number)) {
      alert(`Pending payment for number ${number}.`);
      return;
    }
    if (window.takenNumbers[number] && window.takenNumbers[number] !== userId) {
      alert(`Number ${number} is taken.`);
      return;
    }
    setPaymentRejected(false);
    setCurrentSelectedNumber(number);
    alert(`Number ${number} selected! Upload payment.`);
  };

  const getNumberPrice = () => gameConfig?.price_per_number || 100;
  const getGameRound = () => gameConfig?.round || gameConfig?.game_id || "?";
  const handleRetrySelection = () => {
    setCurrentSelectedNumber(null);
    setPaymentRejected(false);
  };

  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      alert("Referral link copied!");
    } catch (err) {
      console.error(err);
    }
  };

  const AdminButton = () => {
    if (!isAdmin) return null;
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => (window.location.href = "/admin")}
        className="fixed top-4 right-4 bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white px-3 py-1.5 rounded-full shadow-lg z-50 text-xs font-semibold"
      >
        👑 Admin
      </motion.button>
    );
  };

  if (loading) return <LoadingSpinner />;
  if (error)
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A192F] to-[#3B82F6] flex items-center justify-center p-4 text-white text-center">
        {error}
      </div>
    );
  if (!userData)
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A192F] to-[#3B82F6] flex items-center justify-center p-4 text-white text-center">
        Send /start to bot first
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A192F] via-[#1E3A8A] to-[#3B82F6] pb-20">
      <AdminButton />

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#0A192F] rounded-2xl p-5 max-w-sm w-full border border-[#3B82F6]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-3">
                <Logo size="sm" />
                <h3 className="text-white text-lg font-bold mt-2">
                  Invite Friends
                </h3>
              </div>
              <div className="bg-[#1E3A8A]/50 rounded-xl p-2 mb-3">
                <p className="text-[#60A5FA] text-xs break-all">
                  {referralLink}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyReferralLink}
                  className="flex-1 bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white py-2 rounded-full font-semibold text-sm"
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="flex-1 bg-gray-700 text-white py-2 rounded-full font-semibold text-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        {/* Logo */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex justify-center"
        >
          <Logo size="md" />
        </motion.div>

        {/* Welcome Card */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] rounded-2xl p-4 text-white shadow-xl"
        >
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs opacity-80">Welcome,</div>
              <div className="text-lg font-bold">
                @{userData?.username || "User"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-80">Round</div>
              <div className="text-2xl font-bold">#{getGameRound()}</div>
            </div>
          </div>
        </motion.div>

        {/* Game Status */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`rounded-2xl p-3 text-center ${
            gameActive
              ? "bg-emerald-500/20 border border-emerald-500/50"
              : "bg-red-500/20 border border-red-500/50"
          }`}
        >
          <div className="flex justify-between items-center">
            <div>
              <div className="text-white/70 text-xs">Price</div>
              <div className="text-white font-bold text-lg">
                {getNumberPrice()} ETB
              </div>
            </div>
            <div className="text-2xl">🎲</div>
            <div>
              <div className="text-white/70 text-xs">Status</div>
              <div
                className={`font-bold ${gameActive ? "text-emerald-400" : "text-red-400"}`}
              >
                {gameActive ? "ACTIVE" : "INACTIVE"}
              </div>
            </div>
          </div>
        </motion.div>

        {/* My Numbers */}
        {(selectedNumbers.length > 0 || pendingNumbers.length > 0) && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-3"
          >
            <div className="text-white text-xs font-semibold mb-2">
              📌 MY NUMBERS
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedNumbers.map((num) => (
                <span
                  key={num}
                  className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold"
                >
                  ✅ {num}
                </span>
              ))}
              {pendingNumbers.map((num) => (
                <span
                  key={num}
                  className="bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold"
                >
                  ⏳ {num}
                </span>
              ))}
            </div>
            <div className="text-white/40 text-xs mt-2">
              {selectedNumbers.length} approved | {pendingNumbers.length}{" "}
              pending
            </div>
          </motion.div>
        )}

        {/* Payment Rejected Alert */}
        {paymentRejected && (
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-red-500/20 rounded-2xl p-3 text-center border border-red-500"
          >
            <div className="text-red-300 text-sm font-bold">
              ❌ {rejectionMessage}
            </div>
          </motion.div>
        )}

        {/* Pending Selection */}
        {currentSelectedNumber && !paymentRejected && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-amber-500/20 rounded-2xl p-3 text-center border border-amber-500"
          >
            <div className="text-amber-300 text-sm font-bold">
              Selected: {currentSelectedNumber}
            </div>
            <div className="text-white/70 text-xs">
              Upload payment to confirm
            </div>
          </motion.div>
        )}

        {/* Payment Methods Toggle */}
        <PaymentMethods />

        {/* Referral Points */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] rounded-2xl p-4 text-center text-white shadow-xl cursor-pointer hover:scale-105 transition-all"
          onClick={() => setShowShareModal(true)}
        >
          <div className="text-xs opacity-90">💰 Referral Points</div>
          <div className="text-3xl font-bold">
            {referralStats?.referral_points || userData?.referral_points || 0}
          </div>
          <div className="text-xs mt-1 opacity-80">👇 Tap to invite</div>
        </motion.div>

        {/* Winners Board - Organized by Round */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-4"
        >
          <h2 className="text-white text-sm font-bold text-center mb-3">
            🏆 Winners Board
          </h2>

          {winners?.winners_by_round &&
          Object.keys(winners.winners_by_round).length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {Object.entries(winners.winners_by_round)
                .sort((a, b) => Number(b[0]) - Number(a[0]))
                .map(([round, roundWinners]) => (
                  <div key={round} className="bg-[#0A192F]/50 rounded-xl p-3">
                    <div className="text-[#60A5FA] text-xs font-semibold mb-2 text-center border-b border-[#3B82F6]/30 pb-1">
                      🎮 Round #{round}
                    </div>
                    <div className="space-y-1.5">
                      {roundWinners.map((winner, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-xs"
                        >
                          <div className="flex items-center gap-2 w-1/3">
                            <span
                              className={`font-bold ${
                                winner.place === 1
                                  ? "text-yellow-400"
                                  : winner.place === 2
                                    ? "text-gray-300"
                                    : winner.place === 3
                                      ? "text-amber-600"
                                      : "text-white/60"
                              }`}
                            >
                              {winner.place === 1
                                ? "🥇"
                                : winner.place === 2
                                  ? "🥈"
                                  : winner.place === 3
                                    ? "🥉"
                                    : `#${winner.place}`}
                            </span>
                            <span className="text-white/80 truncate">
                              @{winner.username}
                            </span>
                          </div>
                          <div className="text-emerald-400 font-bold w-1/4 text-center">
                            {winner.winning_number}
                          </div>
                          <div className="text-white/50 text-right w-1/4">
                            {winner.prize_amount} ETB
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center text-white/40 py-4 text-sm">
              No winners yet. First round starting soon!
            </div>
          )}
        </motion.div>

        {/* Announcements */}
        {announcements.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-3"
          >
            <div className="text-white/70 text-xs font-semibold mb-1">
              📢 Announcements
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {announcements.slice(0, 3).map((ann, idx) => (
                <div key={idx} className="text-white/60 text-xs">
                  📢 {ann.text}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Number Grid */}
        <NumberGrid
          selectedNumbers={selectedNumbers}
          pendingNumbers={pendingNumbers}
          takenNumbers={window.takenNumbers || {}}
          userId={userId}
          paymentStatus={userData?.payment_status}
          onSelectNumber={handleSelectNumber}
          gameActive={gameActive}
          pricePerNumber={getNumberPrice()}
          minNumber={minNumber}
          maxNumber={maxNumber}
        />

        {/* Game Not Active */}
        {!gameActive && (
          <div className="bg-amber-500/20 rounded-2xl p-3 text-center border border-amber-500">
            <div className="text-amber-300 text-sm">🎮 Game Not Active</div>
          </div>
        )}

        {/* Rejected Payment Reset */}
        {userData?.payment_status === "rejected" &&
          !currentSelectedNumber &&
          !paymentRejected && (
            <div className="bg-red-500/20 rounded-2xl p-3 text-center border border-red-500">
              <button
                onClick={handleRetrySelection}
                className="bg-amber-500 text-black px-4 py-1.5 rounded-full text-sm font-semibold"
              >
                🔄 Select New Number
              </button>
            </div>
          )}

        {/* Payment Card */}
        {gameActive &&
          currentSelectedNumber &&
          gameConfig &&
          !paymentRejected && (
            <PaymentCard
              userId={userId}
              selectedNumber={currentSelectedNumber}
              gameConfig={gameConfig}
              onPaymentSuccess={() => {
                loadDashboard();
                setCurrentSelectedNumber(null);
              }}
            />
          )}

        <ReferralCard userId={userId} botUsername={botUsername} />
      </div>
    </div>
  );
};

export default Home;
