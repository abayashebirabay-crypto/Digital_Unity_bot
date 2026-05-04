import React, { useState, useEffect } from 'react';
import { getReferralStats } from '../services/api';
import { motion } from 'framer-motion';

const ReferralCard = ({ userId, botUsername }) => {
  const [referralData, setReferralData] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

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
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-center border border-white/20">
        <div className="animate-pulse text-white/60">Loading referral stats...</div>
      </div>
    );
  }

  return (
    <>
      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full border border-purple-500" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-white font-bold text-2xl">DU</span>
              </div>
              <h3 className="text-white text-xl font-bold mt-2">Invite Friends</h3>
              <p className="text-gray-400 text-sm mt-1">Share your referral link</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 mb-4">
              <p className="text-gray-300 text-xs break-all">{referralLink}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={copyToClipboard} className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-2 rounded-full font-semibold">
                📋 Copy Link
              </button>
              <button onClick={() => setShowShareModal(false)} className="flex-1 bg-gray-700 text-white py-2 rounded-full font-semibold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-4 border border-white/20 shadow-xl"
      >
        <h3 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4 flex items-center gap-2">
          🔗 Invite Friends & Earn Points
        </h3>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
            <div className="text-xs text-white/50 mb-1">Your Code</div>
            <div className="font-bold text-white text-sm break-all">{referralData.referral_code || 'N/A'}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
            <div className="text-xs text-white/50 mb-1">Friends Joined</div>
            <div className="font-bold text-white text-xl">{referralData.referral_count || 0}</div>
          </div>
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-3 text-center shadow-lg">
            <div className="text-xs text-white/80 mb-1">Points Earned</div>
            <div className="font-bold text-white text-xl">{referralData.referral_points || 0}</div>
          </div>
        </div>

        {/* Referral Link Row */}
        <div className="flex gap-2 mb-4">
          <input 
            type="text" 
            className="flex-1 px-3 py-2 bg-white/5 rounded-xl text-sm text-white/80 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="font-semibold text-white mb-2 flex items-center gap-2">
            <span>🎁</span> How it works:
          </p>
          <ul className="space-y-2 text-sm text-white/60">
            <li className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              <span>Share your unique link with friends</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              <span>When they register via your link, you earn points</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              <span>Points can be redeemed for prizes and bonuses!</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              <span>Top referrers get special rewards</span>
            </li>
          </ul>
        </div> {/* Referral Points Info */}
        <div className="mt-3 text-center">
          <p className="text-xs text-white/30">
            💡 Earn {referralData.referral_points || 0} points for each friend who joins!
          </p>
        </div>
      </motion.div>
    </>
  );
};

export default ReferralCard;