import React, { useState, useEffect, useCallback } from 'react';
import { getUserDashboard, getLuckyNumbers, getWinners, getAnnouncements, getReferralStats, getGameConfig } from '../services/api';
import PaymentCard from '../components/PaymentCard';
import ReferralCard from '../components/ReferralCard';
import ProfileCard from '../components/ProfileCard';
import NumberGrid from '../components/NumberGrid';

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
  
  const botUsername = 'DigitalUnity_bot';

  // Define loadDashboard with useCallback to prevent recreation
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

  // Listen for game creation events from admin panel
  useEffect(() => {
    const handleGameCreated = () => {
      console.log('Game created event received, refreshing...');
      setRefreshTrigger(prev => prev + 1);
    };
  
    window.addEventListener('gameCreated', handleGameCreated);
    return () => window.removeEventListener('gameCreated', handleGameCreated);
  }, []);

  // Watch for payment rejection
  useEffect(() => {
    if (userData?.payment_status === 'rejected') {
      setPaymentRejected(true);
      setRejectionMessage(userData?.rejection_reason || 'Your payment was rejected. Please select a new number and upload payment again.');
      setCurrentSelectedNumber(null);
      
      const timer = setTimeout(() => {
        setPaymentRejected(false);
        setRejectionMessage('');
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [userData?.payment_status, userData?.rejection_reason]);

  // Reload when game config changes
  useEffect(() => {
    if (gameConfig) {
      loadDashboard();
    }
  }, [gameConfig, loadDashboard]);

  // Initial load and refresh triggers
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
      alert(`You already own number ${number}! You can buy more numbers.`);
      return;
    }

    if (pendingNumbers.includes(number)) {
      alert(`You already have a pending payment for number ${number}. Please wait for approval.`);
      return;
    }

    if (window.takenNumbers[number] && window.takenNumbers[number] !== userId) {
      alert(`Number ${number} is already taken by another user.`);
      return;
    }

    setPaymentRejected(false);
    setRejectionMessage('');
    setCurrentSelectedNumber(number);
    alert(`Number ${number} selected! Please upload payment to confirm this number.`);
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

  const AdminButton = () => {
    if (!isAdmin) return null;
    return (
      <button
        onClick={() => window.location.href = '/admin'}
        className="fixed top-4 right-4 bg-purple-600 text-white px-4 py-2 rounded-xl shadow-lg hover:bg-purple-700 transition-all z-50"
      >
        👑 Admin Panel
      </button>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md text-center">
          <p className="text-red-500 mb-4">❌ {error}</p>
          <button onClick={loadDashboard} className="bg-purple-600 text-white px-6 py-2 rounded-xl">Retry</button>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md text-center">
          <p className="text-gray-700">❌ Please send /start to bot first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 p-4 relative">
      <AdminButton />

      <div className="max-w-md mx-auto space-y-4">
        <ProfileCard
          userData={userData}
          selectedNumber={selectedNumbers.length > 0 ? selectedNumbers.join(', ') : 'None'}
          referralStats={referralStats}
        />

        <div className={`rounded-2xl p-3 text-center ${gameActive ? 'bg-white/20 text-white' : 'bg-red-500/80 text-white'}`}>
          <div className="text-xs opacity-80">Current Game Round</div>
          <div className="text-2xl font-bold">#{getGameRound()}</div>
          <div className="text-xs opacity-80 mt-1">Price per number: {getNumberPrice()} ETB</div>
          {!gameActive && (
            <div className="mt-2 text-sm font-bold bg-yellow-500 text-black px-2 py-1 rounded-lg">
              ⚠️ NO ACTIVE GAME - Waiting for admin to start new round
            </div>
          )}
        </div>

        {(selectedNumbers.length > 0 || pendingNumbers.length > 0) && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3">
            <div className="text-white text-xs font-semibold mb-2">📌 MY NUMBERS</div>
            <div className="flex flex-wrap gap-2">
              {selectedNumbers.map(num => (
                <span key={num} className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">✅ {num}</span>
              ))}
              {pendingNumbers.map(num => (
                <span key={num} className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-bold">⏳ {num}</span>
              ))}
            </div>
            <div className="text-white/60 text-xs mt-2">
              {selectedNumbers.length} approved | {pendingNumbers.length} pending
            </div>
          </div>
        )}

        {paymentRejected && (
          <div className="bg-red-500/20 backdrop-blur-sm rounded-2xl p-4 text-center text-red-200 border border-red-500 animate-pulse">
            <div className="text-sm font-bold mb-1">❌ PAYMENT REJECTED</div>
            <div className="text-sm">{rejectionMessage}</div>
            <div className="text-xs mt-2">Please select a new number and upload payment again.</div>
          </div>
        )}

        {currentSelectedNumber && !paymentRejected && (
          <div className="bg-yellow-500/20 backdrop-blur-sm rounded-2xl p-3 text-center text-yellow-200 border border-yellow-500">
            <div className="text-sm font-bold">⏳ Pending Selection</div>
            <div>You have selected number <strong>{currentSelectedNumber}</strong></div>
            <div className="text-xs mt-1">Upload payment to confirm this number</div>
          </div>
        )}

        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-6 text-center text-white shadow-lg">
          <div className="text-sm opacity-90">💰 Total Referral Points</div>
          <div className="text-5xl font-bold">{referralStats?.referral_points || userData?.referral_points || 0}</div>
        </div>

        {/* Winners Board Section */}
        <div className="bg-white rounded-2xl p-5 shadow-lg">
          <h2 className="text-lg font-bold text-center text-purple-700 mb-3">🏆 Winners Board</h2>
          
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
                  <div className="text-xs font-semibold text-gray-500 mb-2">🏅 ALL PLACES - ROUND #{winners.current_round_winners[0]?.game_id}</div>
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

          {winners?.recent_winners?.length > 0 && winners.current_round_winners?.length > 0 && (
            <div className="border-t border-gray-200 pt-3 mt-3">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">📜 Previous Rounds History</h3>
            </div>
          )}
          
          {winners?.recent_winners?.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {winners.recent_winners.map((winner, idx) => (
                (!winners.current_round_winners?.some(w => w.telegram_id === winner.telegram_id && w.game_id === winner.game_id)) && (
                  <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                        {winner.winning_number}
                      </span>
                      <div>
                        <div>@{winner.username}</div>
                        <div className="flex gap-2 text-xs">
                          <span className="text-gray-400">Round #{winner.game_id}</span>
                          <span className="text-purple-500 font-semibold">{winner.place_display}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-600 font-semibold">{winner.prize_amount} ETB</div>
                      <div className="text-xs text-gray-400">{new Date(winner.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
          
          {(!winners?.recent_winners || winners.recent_winners.length === 0) && (
            <div className="text-center text-gray-400 py-4">No winners yet. First round starting soon!</div>
          )}
        </div>

        {announcements.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-lg">
            <h2 className="text-lg font-bold text-center text-purple-700 mb-3">📢 Announcements</h2>
            <div className="space-y-2">
              {announcements.slice(0, 5).map((ann, idx) => (
                <div key={idx} className="text-sm text-gray-600 border-b border-gray-100 pb-2">📢 {ann.text}</div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Search number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button onClick={handleSearch} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-xl hover:scale-105 transition-all">🔍</button>
        </div>

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

        {!gameActive && (
          <div className="bg-yellow-500/20 backdrop-blur-sm rounded-2xl p-4 text-center text-yellow-200 border border-yellow-500">
            <div className="font-bold mb-2">🎮 Game Not Active</div>
            <div className="text-sm">A new game round hasn't started yet.</div>
            <div className="text-xs mt-2">Please check back later or contact admin.</div>
          </div>
        )}

        {userData?.payment_status === 'rejected' && !currentSelectedNumber && !paymentRejected && (
          <div className="bg-red-500/20 backdrop-blur-sm rounded-2xl p-4 text-center text-red-200 border border-red-500">
            <div className="font-bold mb-2">❌ Payment Rejected</div>
            <div className="text-sm mb-3">Your payment was rejected. Please select a new number.</div>
            <button onClick={handleRetrySelection} className="bg-yellow-500 text-black px-4 py-2 rounded-lg font-semibold hover:bg-yellow-400 transition-all">🔄 Select New Number</button>
          </div>
        )}

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