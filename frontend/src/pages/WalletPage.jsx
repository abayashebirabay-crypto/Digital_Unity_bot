import React, { useCallback, useEffect, useState } from "react";
import Wallet from "../components/Wallet";
import { claimChannelBonus, getWallet, requestWithdrawal } from "../services/api";

const WalletPage = ({ userId }) => {
  const [walletData, setWalletData] = useState({});
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);

  const loadWallet = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getWallet(userId);
      setWalletData(res.data || {});
    } catch (err) {
      console.error("Wallet page load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const handleWithdraw = async () => {
    try {
      setWithdrawing(true);
      const res = await requestWithdrawal(userId, 100);
      alert(res.data?.message || "Withdrawal request submitted.");
      await loadWallet();
    } catch (err) {
      alert(err?.response?.data?.message || "Withdrawal failed.");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleJoinChannel = async () => {
    try {
      setChannelLoading(true);
      window.open("https://t.me/Unity_J", "_blank");
      const res = await claimChannelBonus(userId);
      alert(res.data?.message || "Done");
      await loadWallet();
    } catch (err) {
      alert(err?.response?.data?.message || "Channel bonus failed.");
    } finally {
      setChannelLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A192F] via-[#1E3A8A] to-[#3B82F6] text-white flex items-center justify-center">
        Loading wallet...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A192F] via-[#1E3A8A] to-[#3B82F6] pb-20">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <button
          onClick={() => (window.location.href = `/?user_id=${userId}`)}
          className="text-white/80 text-sm"
        >
          Back to Home
        </button>
        <Wallet
          wallet={walletData}
          onWithdraw={handleWithdraw}
          withdrawing={withdrawing}
          onJoinChannel={handleJoinChannel}
          channelLoading={channelLoading}
        />
      </div>
    </div>
  );
};

export default WalletPage;
