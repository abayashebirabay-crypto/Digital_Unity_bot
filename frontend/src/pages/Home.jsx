import React, { useState, useEffect, useCallback } from "react";
import {
  getUserDashboard,
  getLuckyNumbers,
  getWinners,
  getReferralStats,
  getGameConfig,
} from "../services/api";
import PaymentCard from "../components/PaymentCard";
import NumberGrid from "../components/NumberGrid";
import { motion, AnimatePresence } from "framer-motion";

const MIN_LUCKY_NUMBER = 1;
const MAX_LUCKY_NUMBER = 999;

// Logo Component
const Logo = ({ size = "md" }) => {
  const sizeClasses = { sm: "w-10 h-10", md: "w-14 h-14", lg: "w-20 h-20" };
  return (
    <div className={`${sizeClasses[size]} bg-gradient-to-br from-[#1E3A8A] to-[#3B82F6] rounded-2xl flex items-center justify-center shadow-xl`}>
      <span className="text-white font-bold text-xl">DU</span>
    </div>
  );
};

// Loading Spinner
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-[#0A192F] via-[#1E3A8A] to-[#3B82F6] flex items-center justify-center">
    <div className="text-center">
      <div className="animate-pulse mb-4"><Logo size="lg" /></div>
      <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-white mx-auto mb-3"></div>
      <p className="text-white text-sm">Loading...</p>
    </div>
  </div>
);

// 3-Dot Toggle Menu Component
const MenuToggle = ({ userId, botUsername }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("referral");
  
  const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;
  
  const paymentMethods = {
    cbe: { name: "CBE", account: "1000304777633", holder: "Abay Ashebir" },
    telebirr: { name: "Telebirr", account: "0934478593", holder: "Abay Ashebir" }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="relative">
      {/* 3-Dot Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all"
      >
        <span className="text-white text-lg font-bold">⋮</span>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute right-0 mt-2 w-72 bg-[#0A192F] rounded-2xl border border-[#3B82F6] shadow-xl z-50 overflow-hidden"
          >
            {/* Tabs */}
            <div className="flex border-b border-[#3B82F6]/30">
              <button
                onClick={() => setActiveTab("referral")}
                className={`flex-1 py-2 text-xs font-semibold transition-all ${activeTab === "referral" ? "bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white" : "text-white/60"}`}
              >
                🔗 Referral
              </button>
              <button
                onClick={() => setActiveTab("payment")}
                className={`flex-1 py-2 text-xs font-semibold transition-all ${activeTab === "payment" ? "bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white" : "text-white/60"}`}
              >
                💳 Payment
              </button>
            </div>

            {/* Content */}
            <div className="p-3">
              {activeTab === "referral" ? (
                <div>
                  <div className="text-white/70 text-xs mb-2 text-center">Your Referral Link</div>
                  <div className="bg-[#1E3A8A]/50 rounded-xl p-2 mb-2">
                    <p className="text-[#60A5FA] text-xs break-all">{referralLink}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(referralLink)}
                    className="w-full bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white py-1.5 rounded-full text-xs font-semibold"
                  >
                    {copied ? "✓ Copied!" : "📋 Copy Link"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(paymentMethods).map(([key, method]) => (
                    <div key={key} className="bg-[#1E3A8A]/30 rounded-xl p-2 text-center">
                      <div className="text-white/60 text-[10px]">{method.name}</div>
                      <div className="text-white font-bold text-sm">{method.account}</div>
                      <div className="text-white/40 text-[10px]">{method.holder}</div>
                      <button
                        onClick={() => copyToClipboard(method.account)}
                        className="mt-1 bg-white/10 text-white px-3 py-0.5 rounded-full text-[10px]"
                      >
                        Copy
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Payment History Component
const PaymentHistory = ({ payments = [] }) => {
  const [showHistory, setShowHistory] = useState(false);

  if (payments.length === 0) return null;

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden">
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="w-full flex justify-between items-center p-3 text-white text-xs font-semibold"
      >
        <span>📜 Payment History</span>
        <span className="text-white/60">{showHistory ? "▲" : "▼"}</span>
      </button>
      
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 p-2 space-y-1 max-h-32 overflow-y-auto">
              {payments.map((payment, idx) => (
                <div key={idx} className="flex justify-between text-[10px] text-white/60 py-1 border-b border-white/5">
                  <span>{payment.number}</span>
                  <span className="text-emerald-400">{payment.amount} ETB</span>
                  <span className={`${payment.status === "approved" ? "text-green-400" : payment.status === "pending" ? "text-yellow-400" : "text-red-400"}`}>
                    {payment.status}
                  </span>
                  <span>{new Date(payment.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const [error, setError] = useState(null);
  const [referralStats, setReferralStats] = useState(null);
  const [gameConfig, setGameConfig] = useState(null);
  const [gameActive, setGameActive] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [paymentRejected] = useState(false);
  const [minNumber, setMinNumber] = useState(MIN_LUCKY_NUMBER);
  const [maxNumber, setMaxNumber] = useState(MAX_LUCKY_NUMBER);
  const [paymentHistory, setPaymentHistory] = useState([]);

  const botUsername = "DigitalUnity_bot";

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const userRes = await getUserDashboard(userId);
      if (!userRes.data.user) {
        setError("Not registered. Send /start to bot");
        setLoading(false);
        return;
      }

      setUserData(userRes.data.user);
      setSelectedNumbers(userRes.data.user.selected_numbers || []);
      setPendingNumbers(userRes.data.user.pending_numbers || []);
      setPaymentHistory(userRes.data.user.payments || []);

      const referralRes = await getReferralStats(userId);
      setReferralStats(referralRes.data);

      const numbersRes = await getLuckyNumbers(userId, 1, 16, "");
      window.takenNumbers = numbersRes.data.taken_numbers || {};

      const winnersRes = await getWinners();
      setWinners(winnersRes.data);

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
      setGameActive(false);
    }
  }, []);

  useEffect(() => {
    const handleGameCreated = () => setRefreshTrigger(prev => prev + 1);
    window.addEventListener("gameCreated", handleGameCreated);
    return () => window.removeEventListener("gameCreated", handleGameCreated);
  }, []);

  useEffect(() => {
    if (gameConfig) loadDashboard();
  }, [gameConfig, loadDashboard]);

  useEffect(() => {
    loadDashboard();
    loadGameConfig();
  }, [loadDashboard, loadGameConfig, refreshTrigger]);

  const handleSelectNumber = async (number) => {
    if (!gameActive) return alert("No active game round.");
    if (selectedNumbers.includes(number)) return alert(`You own number ${number}!`);
    if (pendingNumbers.includes(number)) return alert(`Pending payment for ${number}.`);
    if (window.takenNumbers[number] && window.takenNumbers[number] !== userId) return alert(`Number ${number} is taken.`);
    setCurrentSelectedNumber(number);
    alert(`Number ${number} selected! Upload payment.`);
  };

  const getNumberPrice = () => gameConfig?.price_per_number || 100;
  const getGameRound = () => gameConfig?.round || gameConfig?.game_id || "?";

  const AdminButton = () => {
    if (!isAdmin) return null;
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => window.location.href = "/admin"}
        className="fixed top-4 right-4 bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white px-3 py-1.5 rounded-full shadow-lg z-50 text-xs font-semibold"
      >
        👑 Admin
      </motion.button>
    );
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="min-h-screen bg-gradient-to-br from-[#0A192F] to-[#3B82F6] flex items-center justify-center p-4 text-white text-center text-sm">{error}</div>;
  if (!userData) return <div className="min-h-screen bg-gradient-to-br from-[#0A192F] to-[#3B82F6] flex items-center justify-center p-4 text-white text-center text-sm">Send /start to bot</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A192F] via-[#1E3A8A] to-[#3B82F6] pb-16">
      <AdminButton />

      <div className="max-w-md mx-auto px-4 pt-4 space-y-3">
        {/* Header with Logo and Menu */}
        <div className="flex justify-between items-center">
          <Logo size="md" />
          <MenuToggle userId={userId} botUsername={botUsername} />
        </div>

        {/* Welcome Card */}
        <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] rounded-2xl p-3 text-white shadow-xl">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-[10px] opacity-80">Welcome,</div>
              <div className="text-base font-bold">@{userData?.username || "User"}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] opacity-80">Round</div>
              <div className="text-xl font-bold">#{getGameRound()}</div>
            </div>
          </div>
        </motion.div>

        {/* Game Status */}
        <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`rounded-2xl p-2 text-center ${gameActive ? "bg-emerald-500/20 border border-emerald-500/50" : "bg-red-500/20 border border-red-500/50"}`}>
          <div className="flex justify-between items-center text-sm">
            <div><div className="text-white/60 text-[10px]">Price</div><div className="text-white font-bold">{getNumberPrice()} ETB</div></div>
            <div className="text-xl">🎲</div>
            <div><div className="text-white/60 text-[10px]">Status</div><div className={`font-bold text-xs ${gameActive ? "text-emerald-400" : "text-red-400"}`}>{gameActive ? "ACTIVE" : "INACTIVE"}</div></div>
          </div>
        </motion.div>

        {/* My Numbers */}
        {(selectedNumbers.length > 0 || pendingNumbers.length > 0) && (
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white/10 backdrop-blur-sm rounded-2xl p-2">
            <div className="text-white text-[10px] font-semibold mb-1">📌 MY NUMBERS</div>
            <div className="flex flex-wrap gap-1">
              {selectedNumbers.map(num => (<span key={num} className="bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">✅ {num}</span>))}
              {pendingNumbers.map(num => (<span key={num} className="bg-amber-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">⏳ {num}</span>))}
            </div>
          </motion.div>
        )}

        {/* Pending Selection */}
        {currentSelectedNumber && !paymentRejected && (
          <div className="bg-amber-500/20 rounded-2xl p-2 text-center border border-amber-500">
            <div className="text-amber-300 text-xs">Selected: {currentSelectedNumber}</div>
          </div>
        )}

        {/* Referral Points */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] rounded-2xl p-3 text-center text-white shadow-xl cursor-pointer hover:scale-105 transition-all" onClick={() => document.querySelector('.menu-toggle')?.click()}>
          <div className="text-[10px] opacity-90">💰 Points</div>
          <div className="text-2xl font-bold">{referralStats?.referral_points || userData?.referral_points || 0}</div>
        </motion.div>

        {/* Winners Board - Compact */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white/10 backdrop-blur-sm rounded-2xl p-2">
          <h2 className="text-white text-xs font-bold text-center mb-2">🏆 Winners</h2>
          {winners?.winners_by_round && Object.keys(winners.winners_by_round).length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.entries(winners.winners_by_round).slice(0, 3).map(([round, roundWinners]) => (
                <div key={round} className="bg-[#0A192F]/50 rounded-xl p-2">
                  <div className="text-[#60A5FA] text-[10px] font-semibold text-center">Round #{round}</div>
                  {roundWinners.slice(0, 3).map((winner, idx) => (
                    <div key={idx} className="flex justify-between text-[10px] py-1">
                      <span className="text-white/70">@{winner.username}</span>
                      <span className="text-emerald-400">{winner.winning_number}</span>
                      <span className="text-white/50">{winner.prize_amount} ETB</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : <div className="text-center text-white/40 py-2 text-[10px]">No winners yet</div>}
        </motion.div>

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

        {/* Payment Card */}
        {gameActive && currentSelectedNumber && gameConfig && !paymentRejected && (
          <PaymentCard userId={userId} selectedNumber={currentSelectedNumber} gameConfig={gameConfig} onPaymentSuccess={() => { loadDashboard(); setCurrentSelectedNumber(null); }} />
        )}

        {/* Payment History */}
        <PaymentHistory payments={paymentHistory} />

        {/* Game Not Active */}
        {!gameActive && <div className="bg-amber-500/20 rounded-2xl p-2 text-center"><div className="text-amber-300 text-xs">🎮 Game Not Active</div></div>}
      </div>
    </div>
  );
};

export default Home;