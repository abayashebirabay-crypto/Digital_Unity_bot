import React, { useState, useEffect } from 'react';
import AdminPanel from './components/AdminPanel';
import { getUserDashboard, getLuckyNumbers, selectNumber, getWinners, getAnnouncements, getReferralStats } from './services/api';
import PaymentCard from './components/PaymentCard';
import ReferralCard from './components/ReferralCard';
import ProfileCard from './components/ProfileCard';

function App() {
  // Get Telegram user data (must be at the very top)
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }

  // Get user ID from URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const urlUserId = urlParams.get('user_id');
  const telegramUser = tg?.initDataUnsafe?.user;

  let userId = null;
  if (urlUserId) {
    userId = parseInt(urlUserId);
    console.log('✅ Using user_id from URL:', userId);
  } else if (telegramUser?.id) {
    userId = telegramUser.id;
    console.log('✅ Using user_id from Telegram:', userId);
  } else {
    userId = 1296141395;
    console.log('⚠️ Using default user_id:', userId);
  }

  const ADMIN_ID = 1296141395;
  const isAdmin = userId === ADMIN_ID;
  const path = window.location.pathname;
  const showAdmin = path === '/admin' && isAdmin;

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [winners, setWinners] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [referralStats, setReferralStats] = useState(null);

  const botUsername = 'DigitalUnity_bot';

  useEffect(() => {
    if (!showAdmin) {
      loadDashboard();
    }
  }, [userId, page, searchQuery, showAdmin]);

  // NOW conditional returns (after all hooks)
  if (showAdmin) {
    return <AdminPanel />;
  }

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Loading dashboard for user:', userId);

      const userRes = await getUserDashboard(userId);
      console.log('User response:', userRes.data);

      if (!userRes.data.user) {
        setError('Not registered. Please send /start to bot first.');
        setLoading(false);
        return;
      }

      setUserData(userRes.data.user);
      setSelectedNumber(userRes.data.user.selected_number);

      try {
        const referralRes = await getReferralStats(userId);
        setReferralStats(referralRes.data);
        console.log('Referral stats:', referralRes.data);
      } catch (err) {
        console.error('Error loading referral stats:', err);
      }

      const numbersRes = await getLuckyNumbers(userId, page, 16, searchQuery);
      setNumbers(numbersRes.data.items || []);

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
  };

  const handleSelectNumber = async (number) => {
    try {
      const response = await selectNumber(userId, number);
      if (response.data.success) {
        setSelectedNumber(number);
        await loadDashboard();
      } else {
        alert(response.data.message || 'Selection failed');
      }
    } catch (err) {
      console.error('Error selecting number:', err);
      alert('Network error');
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadDashboard();
  };

  const numberPrices = {
    1: 100, 2: 100, 3: 100, 4: 100,
    5: 200, 6: 200, 7: 200, 8: 200,
    9: 500, 10: 500, 11: 500, 12: 500,
    13: 1000, 14: 1000, 15: 1000, 16: 1000,
  };

  const getStatusClass = (status) => {
    const classes = {
      pending: 'bg-orange-500',
      approved: 'bg-green-500',
      rejected: 'bg-red-500',
      none: 'bg-gray-500',
    };
    return classes[status] || 'bg-gray-500';
  };

  // Admin button component
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
          selectedNumber={selectedNumber}
          referralStats={referralStats}
        />

        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-6 text-center text-white shadow-lg">
          <div className="text-sm opacity-90">💰 Total Referral Points</div>
          <div className="text-5xl font-bold">{referralStats?.referral_points || userData?.referral_points || 0}</div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-lg">
          <h2 className="text-lg font-bold text-center text-purple-700 mb-3">🏆 Winners Board</h2>
          <div className="bg-gradient-to-r from-pink-500 to-red-500 rounded-xl p-4 text-center text-white mb-3">
            {winners?.current_winner ? (
              <>
                <div className="text-sm">🏆 CURRENT WINNER 🏆</div>
                <div className="text-5xl font-bold my-2">{winners.current_winner.winning_number}</div>
                <div>@{winners.current_winner.username}</div>
              </>
            ) : (
              'No winner yet. Be the first!'
            )}
          </div>

          {winners?.recent_winners?.length > 0 && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Recent Winners</h3>
              <div className="space-y-2">
                {winners.recent_winners.slice(0, 5).map((winner, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                        {winner.winning_number}
                      </span>
                      <span>@{winner.username}</span>
                    </div>
                    <span className="text-gray-400 text-xs">{new Date(winner.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {announcements.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-lg">
            <h2 className="text-lg font-bold text-center text-purple-700 mb-3">📢 Announcements</h2>
            <div className="space-y-2">
              {announcements.slice(0, 5).map((ann, idx) => (
                <div key={idx} className="text-sm text-gray-600 border-b border-gray-100 pb-2">
                  📢 {ann.text}
                </div>
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
          <button
            onClick={handleSearch}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-xl hover:scale-105 transition-all"
          >
            🔍
          </button>
        </div>

        <h2 className="text-center text-white font-bold text-lg">🎲 SELECT YOUR LUCKY NUMBER</h2>

        <div className="grid grid-cols-4 gap-3">
          {numbers.map((item) => {
            const isDisabled = item.is_taken || (userData.payment_status === 'pending' && !item.is_mine);
            return (
              <div
                key={item.number}
                onClick={() => !isDisabled && !selectedNumber && handleSelectNumber(item.number)}
                className={`bg-white rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
                  item.is_mine ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white' : ''
                } ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'hover:scale-105'}`}
              >
                <div className="text-2xl font-bold">{item.number}</div>
                <div className="text-xs mt-1">{numberPrices[item.number] || 100} ETB</div>
                {item.is_taken && <div className="text-xs mt-1 text-gray-500">Taken</div>}
                {item.is_mine && <div className="text-xs mt-1">Your Number</div>}
              </div>
            );
          })}
        </div>

        {numbers.length > 0 && (
          <div className="flex justify-center items-center gap-4">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                page <= 1
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:scale-105'
              }`}
            >
              ◀ Prev
            </button>
            <span className="text-white font-medium">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-xl hover:scale-105 transition-all"
            >
              Next ▶
            </button>
          </div>
        )}

        <PaymentCard
          userId={userId}
          selectedNumber={selectedNumber}
          numberPrices={numberPrices}
          onPaymentSuccess={loadDashboard}
        />

        <ReferralCard userId={userId} botUsername={botUsername} />
      </div>
    </div>
  );
}

export default App;