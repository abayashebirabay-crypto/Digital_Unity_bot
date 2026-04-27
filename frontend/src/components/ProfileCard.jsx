import React from 'react';

const ProfileCard = ({ userData, selectedNumber, referralStats }) => {
  const getStatusClass = (status) => {
    const classes = {
      pending: 'bg-orange-500',
      approved: 'bg-green-500',
      rejected: 'bg-red-500',
      none: 'bg-gray-500',
    };
    return classes[status] || 'bg-gray-500';
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-lg">
      <div className="flex items-center gap-4 mb-4">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white text-2xl font-bold">
          {userData?.username?.charAt(0)?.toUpperCase() || '👤'}
        </div>
        
        {/* User Info */}
        <div className="flex-1">
          <div className="text-xl font-bold text-gray-800">
            @{userData?.username || 'user'}
          </div>
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <span>📱 {userData?.phone_number || 'Not provided'}</span>
          </div>
          <div className="text-sm text-gray-500">
            📍 {userData?.location_text || 'Not provided'}
          </div>
        </div>
      </div>

      {/* Stats Grid - Selected Number & Payment Status */}
      <div className="flex justify-between items-center pt-3 border-t border-gray-200 mb-3">
        <span className="text-gray-600">
          Selected Number: <strong className="text-purple-600">{selectedNumber || '-'}</strong>
        </span>
        <span className={`px-3 py-1 rounded-full text-white text-xs font-bold ${getStatusClass(userData?.payment_status)}`}>
          {userData?.payment_status?.toUpperCase() || 'NONE'}
        </span>
      </div>

      {/* Referral Stats Grid */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
        <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-xl p-3 text-center text-white">
          <div className="text-xs opacity-90">👥 Invited Friends</div>
          <div className="text-2xl font-bold">{referralStats?.referral_count || 0}</div>
        </div>
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl p-3 text-center text-white">
          <div className="text-xs opacity-90">⭐ Referral Points</div>
          <div className="text-2xl font-bold">{referralStats?.referral_points || 0}</div>
        </div>
      </div>

      {/* Referral Code Section */}
      {referralStats?.referral_code && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Your Referral Code</span>
            <span className="text-sm font-mono font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-lg">
              {referralStats.referral_code}
            </span>
          </div>
        </div>
      )}

      {/* Invited By (if referred by someone) */}
      {referralStats?.invited_by && (
        <div className="mt-2 text-center">
          <span className="text-xs text-gray-400">
            🎁 Joined via referral
          </span>
        </div>
      )}
    </div>
  );
};

export default ProfileCard;