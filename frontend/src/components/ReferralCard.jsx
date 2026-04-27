import React, { useState, useEffect } from 'react';
import { getReferralStats } from '../services/api';
import './ReferralCard.css';

const ReferralCard = ({ userId, botUsername }) => {
  const [referralData, setReferralData] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    loadReferralStats();
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
    return <div className="referral-card">Loading referral stats...</div>;
  }

  return (
    <div className="referral-card">
      <h3>🔗 Invite Friends & Earn Points</h3>
      
      <div className="referral-stats">
        <div className="stat-item">
          <span className="stat-label">Your Referral Code</span>
          <span className="stat-value">{referralData.referral_code || 'N/A'}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Friends Joined</span>
          <span className="stat-value">{referralData.referral_count || 0}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Points Earned</span>
          <span className="stat-value highlight">{referralData.referral_points || 0}</span>
        </div>
      </div>

      <div className="referral-link-container">
        <input 
          type="text" 
          className="referral-link-input" 
          value={referralLink} 
          readOnly 
        />
        <button 
          className={`copy-btn ${copySuccess ? 'success' : ''}`}
          onClick={copyToClipboard}
        >
          {copySuccess ? '✓ Copied!' : '📋 Copy'}
        </button>
      </div>

      <div className="referral-info">
        <p>🎁 <strong>How it works:</strong></p>
        <ul>
          <li>Share your unique link with friends</li>
          <li>When they register via your link, you earn <strong>{referralData.referral_points_per_user || 10} points</strong></li>
          <li>Points can be redeemed for prizes and bonuses!</li>
          <li>Top referrers get special rewards</li>
        </ul>
      </div>

      <button 
        className="share-btn"
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
      >
        📤 Share Link
      </button>
    </div>
  );
};

export default ReferralCard;