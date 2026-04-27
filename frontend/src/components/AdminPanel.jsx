import React, { useState, useEffect } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL || window.location.origin;

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [stats, setStats] = useState(null);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementText, setAnnouncementText] = useState('');
  const [winnerResult, setWinnerResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [numPlaces, setNumPlaces] = useState(3);
  const [winnerLeaderboard, setWinnerLeaderboard] = useState({ winners: [], total_winners: 0, total_prize_distributed: 0 });

  const ADMIN_ID = 1296141395;

  const apiCall = async (endpoint, method = 'GET', body = null) => {
    const url = `${API_BASE_URL}${endpoint}${method === 'GET' ? `?admin_id=${ADMIN_ID}` : ''}`;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify({ admin_id: ADMIN_ID, ...body });
    
    const response = await fetch(url, options);
    return response.json();
  };

  useEffect(() => {
    loadStats();
    loadPendingPayments();
    loadAllUsers();
    loadAnnouncements();
    loadWinnerLeaderboard();
  }, []);

  const loadStats = async () => {
    try {
      const data = await apiCall('/api/admin/stats');
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadPendingPayments = async () => {
    try {
      const data = await apiCall('/api/admin/pending-payments');
      setPendingUsers(data.pending_users || []);
    } catch (error) {
      console.error('Error loading pending payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const data = await apiCall('/api/admin/all-users');
      setAllUsers(data.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadAnnouncements = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/announcements`);
      const data = await response.json();
      setAnnouncements(data.items || []);
    } catch (error) {
      console.error('Error loading announcements:', error);
    }
  };

  const loadWinnerLeaderboard = async () => {
    try {
      const data = await apiCall('/api/admin/winner-leaderboard');
      setWinnerLeaderboard(data);
    } catch (error) {
      console.error('Error loading winner leaderboard:', error);
    }
  };

  const approvePayment = async (userId) => {
    if (!window.confirm('Approve this payment?')) return;
    const result = await apiCall('/api/admin/approve-payment', 'POST', { user_id: userId });
    alert(result.message);
    loadPendingPayments();
    loadStats();
  };

  const rejectPayment = async (userId) => {
    const reason = window.prompt('Enter rejection reason:');
    if (reason === null) return;
    const result = await apiCall('/api/admin/reject-payment', 'POST', { user_id: userId, reason });
    alert(result.message);
    loadPendingPayments();
    loadStats();
  };

  const selectMultiWinners = async () => {
    if (!window.confirm(`Select ${numPlaces} winners randomly?`)) return;
    const result = await apiCall('/api/admin/select-multi-winners', 'POST', { num_places: numPlaces });
    if (result.success) {
      setWinnerResult(result.winners);
      alert(`${result.winners.length} winners selected!`);
      loadStats();
      loadWinnerLeaderboard();
    } else {
      alert(result.message);
    }
  };

  const createAnnouncement = async () => {
    if (!announcementText.trim()) {
      alert('Please enter announcement text');
      return;
    }
    const result = await apiCall('/api/admin/announcement', 'POST', { text: announcementText });
    if (result.success) {
      alert('Announcement posted!');
      setAnnouncementText('');
      loadAnnouncements();
    }
  };

  const filteredUsers = allUsers.filter(user =>
    user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.telegram_id?.toString().includes(searchQuery)
  );

  const getPlaceBadge = (place) => {
    const badges = {
      1: 'bg-yellow-500',
      2: 'bg-gray-400',
      3: 'bg-orange-600',
      4: 'bg-blue-500',
      5: 'bg-green-500'
    };
    return badges[place] || 'bg-purple-500';
  };

  const getPlaceEmoji = (place) => {
    const emojis = {
      1: '🥇',
      2: '🥈',
      3: '🥉',
      4: '🏅',
      5: '🎖️'
    };
    return emojis[place] || '🏆';
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
          <h1 className="text-3xl font-bold text-white">🎮 Digital Unity Admin Panel</h1>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-gray-700 text-white px-4 py-2 rounded-xl hover:bg-gray-600 transition-all"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Total Users</div>
            <div className="text-3xl font-bold">{stats?.total_users || 0}</div>
          </div>
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Pending Payments</div>
            <div className="text-3xl font-bold">{stats?.pending_payments || 0}</div>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Approved Payments</div>
            <div className="text-3xl font-bold">{stats?.approved_payments || 0}</div>
          </div>
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Total Winners</div>
            <div className="text-3xl font-bold">{winnerLeaderboard.total_winners || 0}</div>
          </div>
          <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Total Prize</div>
            <div className="text-2xl font-bold">{winnerLeaderboard.total_prize_distributed || 0} ETB</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all ${activeTab === 'pending' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            📋 Pending Payments
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all ${activeTab === 'users' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            👥 All Users
          </button>
          <button
            onClick={() => setActiveTab('winner')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all ${activeTab === 'winner' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            🏆 Select Winners
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all ${activeTab === 'leaderboard' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            📊 Winner Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-6 py-2 rounded-xl font-semibold transition-all ${activeTab === 'announcements' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            📢 Announcements
          </button>
        </div>

        {/* Pending Payments Tab */}
        {activeTab === 'pending' && (
          <div className="bg-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">📋 Pending Payments</h2>
            {pendingUsers.length === 0 ? (
              <div className="text-gray-400 text-center">No pending payments</div>
            ) : (
              <div className="space-y-4">
                {pendingUsers.map((user) => (
                  <div key={user.telegram_id} className="bg-gray-700 rounded-xl p-4">
                    <div className="flex justify-between items-start flex-wrap gap-4">
                      <div>
                        <div className="font-bold text-white">@{user.username}</div>
                        <div className="text-sm text-gray-400">ID: {user.telegram_id}</div>
                        <div className="text-sm text-gray-400">📱 {user.phone_number}</div>
                        <div className="text-sm text-gray-400">🎲 Number: {user.selected_number || 'Not selected'}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => approvePayment(user.telegram_id)}
                          className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-all"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => rejectPayment(user.telegram_id)}
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

        {/* All Users Tab */}
        {activeTab === 'users' && (
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
                <div key={user.telegram_id} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <span className="font-bold text-white">@{user.username}</span>
                      <span className="text-gray-400 text-sm ml-2">ID: {user.telegram_id}</span>
                      <div className="text-xs text-gray-500">📱 {user.phone_number}</div>
                      <div className="text-xs text-gray-500">🎲 Number: {user.selected_number || '-'}</div>
                    </div>
                    <div>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        user.payment_status === 'approved' ? 'bg-green-500' :
                        user.payment_status === 'pending' ? 'bg-orange-500' :
                        user.payment_status === 'rejected' ? 'bg-red-500' : 'bg-gray-500'
                      } text-white`}>
                        {user.payment_status?.toUpperCase() || 'NONE'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Select Winners Tab */}
        {activeTab === 'winner' && (
          <div className="bg-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">🏆 Select Winners</h2>
            
            <div className="mb-6">
              <label className="text-gray-300 block mb-2">Number of Winners to Select:</label>
              <select
                value={numPlaces}
                onChange={(e) => setNumPlaces(parseInt(e.target.value))}
                className="bg-gray-700 text-white px-4 py-2 rounded-xl border border-gray-600"
              >
                <option value={1}>1 Winner</option>
                <option value={2}>2 Winners</option>
                <option value={3}>3 Winners</option>
                <option value={4}>4 Winners</option>
                <option value={5}>5 Winners</option>
              </select>
            </div>

            <div className="bg-gray-700 rounded-xl p-4 mb-6">
              <h3 className="text-white font-bold mb-2">💰 Prize Structure:</h3>
              <div className="space-y-1 text-gray-300">
                <div>🥇 1st Place: 5,000 ETB</div>
                <div>🥈 2nd Place: 3,000 ETB</div>
                <div>🥉 3rd Place: 2,000 ETB</div>
                <div>🏅 4th Place: 1,000 ETB</div>
                <div>🎖️ 5th Place: 500 ETB</div>
              </div>
            </div>

            <button
              onClick={selectMultiWinners}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-bold text-lg hover:scale-105 transition-all"
            >
              🎲 SELECT {numPlaces} WINNER{numPlaces > 1 ? 'S' : ''} RANDOMLY
            </button>

            {winnerResult && (
              <div className="mt-6">
                <h3 className="text-white font-bold text-lg mb-3">🎉 WINNERS SELECTED! 🎉</h3>
                <div className="space-y-3">
                  {winnerResult.map((winner) => (
                    <div key={winner.place} className={`${getPlaceBadge(winner.place)} rounded-xl p-4 text-white`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{getPlaceEmoji(winner.place)}</span>
                          <div>
                            <div className="font-bold text-xl">Place #{winner.place}</div>
                            <div>@{winner.username}</div>
                            <div className="text-sm opacity-90">Number: {winner.winning_number}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{winner.prize_amount} ETB</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Winner Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="bg-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">📊 Winner Leaderboard</h2>
            <div className="space-y-3">
              {winnerLeaderboard.winners?.map((winner, idx) => (
                <div key={idx} className={`${getPlaceBadge(winner.place)} rounded-xl p-4 text-white`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getPlaceEmoji(winner.place)}</span>
                      <div>
                        <div className="font-bold">@{winner.username}</div>
                        <div className="text-sm opacity-90">Number: {winner.winning_number}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">{winner.prize_amount} ETB</div>
                      <div className="text-xs opacity-75">{new Date(winner.created_at).toLocaleDateString()}</div>
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

        {/* Announcements Tab */}
        {activeTab === 'announcements' && (
          <div className="bg-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">📢 Create Announcement</h2>
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
            <h3 className="text-lg font-bold text-white mt-6 mb-3">Recent Announcements</h3>
            <div className="space-y-2">
              {announcements.slice(0, 10).map((ann, idx) => (
                <div key={idx} className="bg-gray-700 rounded-lg p-3">
                  <div className="text-white">📢 {ann.text}</div>
                  <div className="text-xs text-gray-400 mt-1">{new Date(ann.created_at).toLocaleString()}</div>
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