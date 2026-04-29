import React, { useState, useEffect } from 'react';
import { getReferralStats } from '../services/api';

const ReferralCard = ({ userId, botUsername }) => {
  const [referralData, setReferralData] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    loadReferralStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadReferralStats = async () => {
    try {
      const response = await getReferralStats(userId);
      setReferralData(response.data);
    } catch (error) {
      console.error('Error loading referral stats:', error);
    }
  };

  const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!referralData) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-lg text-center text-gray-500">
        <div className="animate-pulse">Loading referral stats...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-lg mb-4">
      <h3 className="text-lg font-bold text-purple-700 mb-4">🔗 Invite Friends & Earn Points</h3>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">Your Referral Code</div>
          <div className="font-bold text-gray-800 text-sm break-all">{referralData.referral_code || 'N/A'}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">Friends Joined</div>
          <div className="font-bold text-gray-800 text-xl">{referralData.referral_count || 0}</div>
        </div>
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-3 text-center">
          <div className="text-xs text-white/80 mb-1">Points Earned</div>
          <div className="font-bold text-white text-xl">{referralData.referral_points || 0}</div>
        </div>
      </div>

      {/* Referral Link */}
      <div className="flex gap-2 mb-4">
        <input 
          type="text" 
          className="flex-1 px-3 py-2 bg-gray-100 rounded-xl text-sm text-gray-600 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={referralLink} 
          readOnly 
        />
        <button 
          onClick={copyToClipboard}
          className={`px-4 py-2 rounded-xl font-semibold transition-all ${
            copySuccess 
              ? 'bg-green-500 text-white' 
              : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:scale-105'
          }`}
        >
          {copySuccess ? '✓ Copied!' : '📋 Copy'}
        </button>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 rounded-xl p-4">
        <p className="font-semibold text-gray-800 mb-2">🎁 How it works:</p>
        <ul className="space-y-1 text-sm text-gray-600">
          <li>• Share your unique link with friends</li>
          <li>• When they register via your link, you earn points</li>
          <li>• Points can be redeemed for prizes and bonuses!</li>
          <li>• Top referrers get special rewards</li>
        </ul>
      </div>

      {/* Share Button */}
      <button 
        onClick={() => {
          if (navigator.share) {
            navigator.share({
              title: 'Join Digital Unity',
              text: 'Join me on Digital Unity Campus Voting!',
              url: referralLink,
            });
          } else {
            copyToClipboard();
          }
        }}
        className="w-full mt-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:scale-105 transition-all"
      >
        📤 Share Link
      </button>
    </div>
  );
};

export default ReferralCard;