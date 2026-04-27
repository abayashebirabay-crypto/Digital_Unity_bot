import React, { useState, useEffect } from 'react';
import { getUserDashboard, getLuckyNumbers, selectNumber, getWinners, getAnnouncements } from './services/api';
import './App.css';

function App() {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [winners, setWinners] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [error, setError] = useState(null);

  // Get Telegram user data
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }
  
  // Get user ID from URL parameter FIRST (passed from bot)
  const urlParams = new URLSearchParams(window.location.search);
  const urlUserId = urlParams.get('user_id');
  
  // Get from Telegram WebApp as fallback
  const telegramUser = tg?.initDataUnsafe?.user;
  
  // Priority: URL parameter > Telegram user > default test ID
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
  
  console.log('Final User ID:', userId);
  console.log('Full URL:', window.location.href);

  useEffect(() => {
    loadDashboard();
  }, [userId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading dashboard for user:', userId);
      console.log('API URL:', process.env.REACT_APP_API_URL);
      
      // Load user data
      const userRes = await getUserDashboard(userId);
      console.log('User response:', userRes.data);
      
      if (!userRes.data.user) {
        setError('Not registered. Please send /start to bot first.');
        setLoading(false);
        return;
      }
      
      setUserData(userRes.data.user);
      setSelectedNumber(userRes.data.user.selected_number);
      
      // Load numbers
      const numbersRes = await getLuckyNumbers(userId);
      setNumbers(numbersRes.data.items || []);
      
      // Load winners
      const winnersRes = await getWinners();
      setWinners(winnersRes.data);
      
      // Load announcements
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
        await loadDashboard(); // Reload to update UI
      } else {
        alert(response.data.message || 'Selection failed');
      }
    } catch (err) {
      console.error('Error selecting number:', err);
      alert('Network error');
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading">
        <p>❌ {error}</p>
        <button onClick={loadDashboard}>Retry</button>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="loading">
        <p>❌ Please send /start to bot first</p>
      </div>
    );
  }

  const numberPrices = {
    1: 100, 2: 100, 3: 100, 4: 100,
    5: 200, 6: 200, 7: 200, 8: 200,
    9: 500, 10: 500, 11: 500, 12: 500,
    13: 1000, 14: 1000, 15: 1000, 16: 1000,
  };

  return (
    <div className="container">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            {userData.username?.charAt(0)?.toUpperCase() || '👤'}
          </div>
          <div className="profile-info">
            <div className="user-name">@{userData.username || 'user'}</div>
            <div className="user-detail">📱 {userData.phone_number || 'Not provided'}</div>
            <div className="user-detail">📍 {userData.location_text || 'Not provided'}</div>
          </div>
        </div>
        <div className="profile-stats">
          <span>Selected Number: <strong>{selectedNumber || '-'}</strong></span>
          <span className={`status-badge status-${userData.payment_status || 'none'}`}>
            {userData.payment_status?.toUpperCase() || 'NONE'}
          </span>
        </div>
      </div>

      <div className="balance-card">
        <div>💰 Referral Points</div>
        <div className="balance-amount">{userData.referral_points || 0}</div>
      </div>

      <div className="winner-board">
        <div className="winner-title">🏆 Winners Board</div>
        <div className="winner-current">
          {winners?.current_winner ? (
            <>
              🏆 CURRENT WINNER 🏆
              <div className="winner-current-number">{winners.current_winner.winning_number}</div>
              <div>@{winners.current_winner.username}</div>
            </>
          ) : (
            'No winner yet. Be the first!'
          )}
        </div>
      </div>

      <div className="section-title">🎲 SELECT YOUR LUCKY NUMBER</div>
      <div className="number-grid">
        {numbers.map((item) => {
          const isDisabled = item.is_taken || (userData.payment_status === 'pending' && !item.is_mine);
          return (
            <div
              key={item.number}
              className={`number-card ${item.is_mine ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => !isDisabled && !selectedNumber && handleSelectNumber(item.number)}
            >
              <div className="number-value">{item.number}</div>
              <div className="number-price">{numberPrices[item.number] || 100} ETB</div>
              {item.is_taken && <div className="status-label">Taken</div>}
              {item.is_mine && <div className="status-label">Your Number</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;