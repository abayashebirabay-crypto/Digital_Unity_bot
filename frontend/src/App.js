import React, { useState, useEffect } from 'react';
import './App.css';
import ReferralCard from './components/ReferralCard';
import { getUserDashboard, getLuckyNumbers, selectNumber, getWinners, getAnnouncements } from './services/api';

function App() {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [winners, setWinners] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  // Get Telegram user data
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }
  
  // Get user ID from multiple sources
  const telegramUser = tg?.initDataUnsafe?.user;
  
  // Check URL parameters for user_id (passed from bot)
  const urlParams = new URLSearchParams(window.location.search);
  const urlUserId = urlParams.get('user_id');
  
  // Priority: Telegram user ID > URL parameter > default test ID
  const userId = telegramUser?.id || (urlUserId ? parseInt(urlUserId) : null) || 1296141395;
  const botUsername = 'DigitalUnity_bot';

  // Debug log to see where userId is coming from
  console.log('User ID source:', {
    telegramId: telegramUser?.id,
    urlUserId: urlUserId,
    finalUserId: userId
  });

  const numberPrices = {
    1: 100, 2: 100, 3: 100, 4: 100,
    5: 200, 6: 200, 7: 200, 8: 200,
    9: 500, 10: 500, 11: 500, 12: 500,
    13: 1000, 14: 1000, 15: 1000, 16: 1000,
  };

  useEffect(() => {
    loadDashboard();
  }, [userId, page, searchQuery]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading dashboard for user:', userId);
      
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
      
      // Load numbers with pagination
      const numbersRes = await getLuckyNumbers(userId, page, 16, searchQuery);
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

  const getStatusClass = (status) => {
    const classes = {
      pending: 'status-pending',
      approved: 'status-approved',
      rejected: 'status-rejected',
      none: 'status-none',
    };
    return classes[status] || 'status-none';
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

  return (
    <div className="container">
      {/* Profile Card */}
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
          <span className={`status-badge ${getStatusClass(userData.payment_status)}`}>
            {userData.payment_status?.toUpperCase() || 'NONE'}
          </span>
        </div>
      </div>

      {/* Balance Card */}
      <div className="balance-card">
        <div>💰 Referral Points</div>
        <div className="balance-amount">{userData.referral_points || 0}</div>
      </div>

      {/* Winners Board */}
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
        <div className="winner-list">
          {winners?.recent_winners?.slice(0, 5).map((winner, idx) => (
            <div key={idx} className="winner-item">
              <div className="winner-number">{winner.winning_number}</div>
              <div>@{winner.username}</div>
              <div className="winner-date">{new Date(winner.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Announcements */}
      <div className="announcement-board">
        <div className="announcement-title">📢 Announcements</div>
        <div className="announcement-list">
          {announcements.length > 0 ? (
            announcements.slice(0, 5).map((ann, idx) => (
              <div key={idx} className="announcement-item">
                📢 {ann.text}
              </div>
            ))
          ) : (
            <div className="announcement-item">No announcements yet</div>
          )}
        </div>
      </div>

      {/* Lucky Numbers Section */}
      <div className="section-title">🎲 SELECT YOUR LUCKY NUMBER</div>
      
      {/* Search Box */}
      <div className="search-box">
        <input 
          type="number" 
          placeholder="Search number..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch}>🔍</button>
      </div>

      {/* Numbers Grid */}
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

      {/* Pagination */}
      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>◀ Prev</button>
        <span>Page {page}</span>
        <button onClick={() => setPage(p => p + 1)}>Next ▶</button>
      </div>

      {/* Referral Card */}
      <ReferralCard userId={userId} botUsername={botUsername} />

      {/* Payment Section */}
      <div className="payment-card">
        <h3>💳 Make Payment</h3>
        {selectedNumber && (
          <div className="selected-display">
            Selected: <strong>{selectedNumber}</strong> | 
            Amount: <strong>{numberPrices[selectedNumber]} ETB</strong>
          </div>
        )}
        <div className="payment-info">
          <div className="payment-method"><span>🏦 Bank:</span><strong>Commercial Bank of Ethiopia</strong></div>
          <div className="payment-method"><span>📋 Account:</span><strong>100013456789</strong></div>
          <div className="payment-method"><span>👤 Name:</span><strong>Digital Unity</strong></div>
        </div>
        <div className="upload-area" onClick={() => document.getElementById('fileInput').click()}>
          📸 Click to upload payment screenshot
        </div>
        <input id="fileInput" type="file" accept="image/*" style={{ display: 'none' }} />
        <button className="btn btn-primary">Submit Payment</button>
      </div>
    </div>
  );
}

export default App;