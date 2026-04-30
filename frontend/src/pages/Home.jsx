import React, { useState, useEffect, useCallback } from 'react';
import { getUserDashboard, getLuckyNumbers, getWinners, getAnnouncements, getReferralStats, getGameConfig } from '../services/api';
import PaymentCard from '../components/PaymentCard';
import ReferralCard from '../components/ReferralCard';
import NumberGrid from '../components/NumberGrid';
import { motion, AnimatePresence } from 'framer-motion';

const MIN_LUCKY_NUMBER = 1;
const MAX_LUCKY_NUMBER = 999;

const Home = ({ userId, isAdmin }) => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [pendingNumbers, setPendingNumbers] = useState([]);
  const [currentSelectedNumber, setCurrentSelectedNumber] = useState(null);
  const [winners, setWinners] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [referralStats, setReferralStats] = useState(null);
  const [gameConfig, setGameConfig] = useState(null);
  const [gameActive, setGameActive] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [paymentRejected, setPaymentRejected] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState('');
  const [minNumber, setMinNumber] = useState(MIN_LUCKY_NUMBER);
  const [maxNumber, setMaxNumber] = useState(MAX_LUCKY_NUMBER);
  const [showShareModal, setShowShareModal] = useState(false);
  
  const botUsername = 'DigitalUnity_bot';

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setPaymentRejected(false);
      setRejectionMessage('');

      const userRes = await getUserDashboard(userId);

      if (!userRes.data.user) {
        setError('Not registered. Please send /start to bot first.');
        setLoading(false);
        return;
      }

      setUserData(userRes.data.user);
      setSelectedNumbers(userRes.data.user.selected_numbers || []);
      setPendingNumbers(userRes.data.user.pending_numbers || []);

      try {
        const referralRes = await getReferralStats(userId);
        setReferralStats(referralRes.data);
      } catch (err) {
        console.error('Error loading referral stats:', err);
      }

      const numbersRes = await getLuckyNumbers(userId, page, 16, searchQuery);
      window.takenNumbers = numbersRes.data.taken_numbers || {};

      const winnersRes = await getWinners();
      setWinners(winnersRes.data);

      const announcementsRes = await getAnnouncements();
      setAnnouncements(announcementsRes.data.items || []);

    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, page, searchQuery]);

  const loadGameConfig = useCallback(async () => {
    try {
      const configRes = await getGameConfig();
      const configData = configRes.data;
      
      setGameConfig(configData);
      setGameActive(configData?.is_active === true);
      setMinNumber(configData?.min_number || MIN_LUCKY_NUMBER);
      setMaxNumber(configData?.max_number || MAX_LUCKY_NUMBER);
    } catch (err) {
      console.error('Error loading game config:', err);
      setGameActive(false);
    }
  }, []);

  useEffect(() => {
    const handleGameCreated = () => {
      setRefreshTrigger(prev => prev + 1);
    };
    window.addEventListener('gameCreated', handleGameCreated);
    return () => window.removeEventListener('gameCreated', handleGameCreated);
  }, []);

  useEffect(() => {
    if (userData?.payment_status === 'rejected') {
      setPaymentRejected(true);
      setRejectionMessage(userData?.rejection_reason || 'Your payment was rejected. Please select a new number.');
      setCurrentSelectedNumber(null);
      const timer = setTimeout(() => {
        setPaymentRejected(false);
        setRejectionMessage('');
      }, 10000);
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
      alert('No active game round. Please wait for admin to start a new game.');
      return;
    }
    if (selectedNumbers.includes(number)) {
      alert(`You already own number ${number}!`);
      return;
    }
    if (pendingNumbers.includes(number)) {
      alert(`You already have a pending payment for number ${number}.`);
      return;
    }
    if (window.takenNumbers[number] && window.takenNumbers[number] !== userId) {
      alert(`Number ${number} is already taken by another user.`);
      return;
    }
    setPaymentRejected(false);
    setRejectionMessage('');
    setCurrentSelectedNumber(number);
    alert(`Number ${number} selected! Please upload payment.`);
  };

  const handleSearch = () => {
    setPage(1);
    loadDashboard();
  };

  const getNumberPrice = () => gameConfig?.price_per_number || 100;
  const getGameRound = () => gameConfig?.round || gameConfig?.game_id || '?';

  const handleRetrySelection = () => {
    setCurrentSelectedNumber(null);
    setPaymentRejected(false);
    setRejectionMessage('');
    alert('Please select a new lucky number from the grid above.');
  };

  const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      alert('Referral link copied! Share it with friends.');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const AdminButton = () => {
    if (!isAdmin) return null;
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => window.location.href = '/admin'}
        className="fixed top-4 right-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all z-50 flex items-center gap-2"
      >
        👑 Admin Panel
      </motion.button>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-800 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-800 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 max-w-md text-center border border-white/20">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-white mb-4">{error}</p>
          <button onClick={loadDashboard} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-2 rounded-full font-semibold hover:scale-105 transition-all">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-800 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 max-w-md text-center border border-white/20">
          <div className="text-6xl mb-4">🤖</div>
          <p className="text-white mb-4">Please send /start to the bot first</p>
          <a href={`https://t.me/${botUsername}`} className="inline-block bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-2 rounded-full font-semibold hover:scale-105 transition-all">
            Open Bot
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-800 to-blue-900 pb-20">
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
              className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full border border-purple-500"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🎁</div>
                <h3 className="text-white text-xl font-bold">Invite Friends</h3>
                <p className="text-gray-400 text-sm mt-1">Share your referral link</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3 mb-4">
                <p className="text-gray-300 text-xs break-all">{referralLink}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={copyToClipboard}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-2 rounded-full font-semibold"
                >
                  📋 Copy Link
                </button>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="flex-1 bg-gray-700 text-white py-2 rounded-full font-semibold"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        {/* Header Card */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-5 text-white shadow-xl"
        >
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs opacity-80">Welcome back,</div>
              <div className="text-xl font-bold">@{userData?.username || 'User'}</div>
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
          transition={{ delay: 0.1 }}
          className={`rounded-2xl p-4 text-center ${
            gameActive 
              ? 'bg-green-500/20 backdrop-blur-sm border border-green-500/50' 
              : 'bg-red-500/20 backdrop-blur-sm border border-red-500/50'
          }`}
        >
          <div className="flex justify-between items-center">
            <div>
              <div className="text-white/80 text-xs">Price per Number</div>
              <div className="text-white font-bold text-xl">{getNumberPrice()} ETB</div>
            </div>
            <div className="text-3xl">🎲</div>
            <div>
              <div className="text-white/80 text-xs">Status</div>
              <div className={`font-bold text-lg ${gameActive ? 'text-green-400' : 'text-red-400'}`}>
                {gameActive ? 'ACTIVE' : 'INACTIVE'}
              </div>
            </div>
          </div>
        </motion.div>

        {/* My Numbers Section */}
        {(selectedNumbers.length > 0 || pendingNumbers.length > 0) && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-4"
          >
            <div className="text-white text-xs font-semibold mb-3 flex items-center gap-2">
              <span>📌</span> MY NUMBERS
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedNumbers.map(num => (
                <motion.span
                  key={num}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg"
                >
                  ✅ {num}
                </motion.span>
              ))}
              {pendingNumbers.map(num => (
                <motion.span
                  key={num}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg"
                >
                  ⏳ {num}
                </motion.span>
              ))}
            </div>
            <div className="text-white/50 text-xs mt-3">
              {selectedNumbers.length} approved | {pendingNumbers.length} pending
            </div>
          </motion.div>
        )}

        {/* Payment Rejected Alert */}
        {paymentRejected && (
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            className="bg-red-500/20 backdrop-blur-sm rounded-2xl p-4 text-center border border-red-500"
          >
            <div className="text-red-300 font-bold mb-1">❌ PAYMENT REJECTED</div>
            <div className="text-red-200 text-sm">{rejectionMessage}</div>
          </motion.div>
        )}

        {/* Pending Selection */}
        {currentSelectedNumber && !paymentRejected && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-yellow-500/20 backdrop-blur-sm rounded-2xl p-4 text-center border border-yellow-500"
          >
            <div className="text-yellow-300 font-bold">⏳ Pending Selection</div>
            <div className="text-white text-lg">Number <strong className="text-2xl">{currentSelectedNumber}</strong></div>
            <div className="text-yellow-200/80 text-xs mt-1">Upload payment to confirm</div>
          </motion.div>
        )}

        {/* Referral Points Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-6 text-center text-white shadow-xl cursor-pointer hover:scale-105 transition-all"
          onClick={() => setShowShareModal(true)}
        >
          <div className="text-sm opacity-90">💰 Total Referral Points</div>
          <div className="text-5xl font-bold">{referralStats?.referral_points || userData?.referral_points || 0}</div>
          <div className="text-xs mt-2 opacity-80">👇 Tap to invite friends</div>
        </motion.div>

        {/* Winners Board */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-5 shadow-xl"
        >
          <h2 className="text-lg font-bold text-center bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
            🏆 Winners Board
          </h2>
          
          {winners?.current_round_winners?.length > 0 && (
            <div className="mb-4">
              <div className="text-center mb-2">
                <span className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                  Round #{winners.current_round_winners[0]?.game_id || '?'} - COMPLETED
                </span>
              </div>
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-4 text-center text-white mb-3">
                {winners.current_winner ? (
                  <>
                    <div className="text-sm">🏆 GRAND WINNER 🏆</div>
                    <div className="text-5xl font-bold my-2">{winners.current_winner.winning_number}</div>
                    <div>@{winners.current_winner.username}</div>
                    <div className="text-xs mt-1">Round #{winners.current_winner.game_id}</div>
                    <div className="text-sm font-bold mt-1">Prize: {winners.current_winner.prize_amount} ETB</div>
                  </>
                ) : (
                  <div>No winner yet for this round</div>
                )}
              </div>
              
              {winners.current_round_winners.length > 1 && (
                <div className="mt-2">
                  <div className="text-xs font-semibold text-gray-500 mb-2">🏅 ALL PLACES</div>
                  <div className="space-y-1">
                    {winners.current_round_winners.slice(1).map((winner, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 rounded-lg p-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-center font-bold text-gray-600">{winner.place_display}</span>
                          <span>@{winner.username}</span>
                        </div>
                        <div>
                          <span className="font-medium text-purple-600">{winner.winning_number}</span>
                          <span className="text-xs text-gray-400 ml-2">{winner.prize_amount} ETB</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {winners?.recent_winners?.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {winners.recent_winners.slice(0, 10).map((winner, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                      {winner.winning_number}
                    </div>
                    <div>
                      <div>@{winner.username}</div>
                      <div className="text-xs text-gray-400">Round #{winner.game_id}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-600 font-semibold">{winner.prize_amount} ETB</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {(!winners?.recent_winners || winners.recent_winners.length === 0) && (
            <div className="text-center text-gray-400 py-4">
              No winners yet. First round starting soon!
            </div>
          )}
        </motion.div>

        {/* Announcements */}
        {announcements.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-4"
          >
            <h2 className="text-white text-sm font-semibold mb-2">📢 Announcements</h2>
            <div className="space-y-2">
              {announcements.slice(0, 5).map((ann, idx) => (
                <div key={idx} className="text-sm text-white/80 border-b border-white/10 pb-2">
                  📢 {ann.text}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Search */}
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Search number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white placeholder-white/50 border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button onClick={handleSearch} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-5 py-2 rounded-full hover:scale-105 transition-all">
            🔍
          </button>
        </div>

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

        {/* Game Not Active Message */}
        {!gameActive && (
          <div className="bg-yellow-500/20 backdrop-blur-sm rounded-2xl p-4 text-center border border-yellow-500">
            <div className="font-bold text-yellow-300 mb-2">🎮 Game Not Active</div>
            <div className="text-white/80 text-sm">Please check back later or contact admin.</div>
          </div>
        )}

        {/* Rejected Payment Button */}
        {userData?.payment_status === 'rejected' && !currentSelectedNumber && !paymentRejected && (
          <div className="bg-red-500/20 backdrop-blur-sm rounded-2xl p-4 text-center border border-red-500">
            <div className="font-bold text-red-300 mb-2">❌ Payment Rejected</div>
            <button onClick={handleRetrySelection} className="bg-yellow-500 text-black px-4 py-2 rounded-full font-semibold">
              🔄 Select New Number
            </button>
          </div>
        )}

        {/* Payment Card */}
        {gameActive && currentSelectedNumber && gameConfig && !paymentRejected && (
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