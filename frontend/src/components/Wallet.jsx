import React from "react";
import WithdrawButton from "./WithdrawButton";

const Wallet = ({ wallet, onWithdraw, withdrawing, onJoinChannel, channelLoading }) => {
  const balance = wallet?.wallet_balance || 0;
  const totalEarned = wallet?.total_earned || 0;
  const remaining = Math.max(100 - balance, 0);
  const progress = Math.min((balance / 100) * 100, 100);
  const history = wallet?.earning_history || [];
  const regClaimed = wallet?.registration_bonus_claimed;
  const channelClaimed = wallet?.channel_bonus_claimed;

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 space-y-3">
      <div className="text-white text-sm font-bold">Wallet</div>
      <div className="bg-[#0A192F]/50 rounded-xl p-3">
        <div className="text-white/60 text-xs">Current Balance</div>
        <div className="text-2xl font-bold text-emerald-400">{balance} ETB</div>
        <div className="text-white/60 text-xs mt-1">Total Earned: {totalEarned} ETB</div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-white/70">
          <span>Withdrawal Progress</span>
          <span>{Math.floor(progress)}%</span>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6]" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-[11px] text-white/60">
          {remaining === 0 ? "You can withdraw now." : `Need ${remaining} ETB more for withdrawal.`}
        </div>
      </div>

      <WithdrawButton canWithdraw={balance >= 100} onWithdraw={onWithdraw} loading={withdrawing} />

      <button
        onClick={onJoinChannel}
        disabled={channelLoading || channelClaimed}
        className={`w-full py-2 rounded-full text-sm font-semibold ${
          channelClaimed
            ? "bg-emerald-500/30 text-emerald-200"
            : "bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white"
        }`}
      >
        {channelLoading ? "Checking channel..." : channelClaimed ? "Channel bonus claimed" : "Join Channel Bonus (5 ETB)"}
      </button>

      <div className="text-xs text-white/70">
        Registration bonus: {regClaimed ? "Claimed" : "Pending"}
      </div>

      <div className="bg-[#0A192F]/50 rounded-xl p-3">
        <div className="text-white/70 text-xs mb-2">Recent Earnings</div>
        <div className="space-y-1 max-h-36 overflow-y-auto">
          {history.length === 0 && <div className="text-white/40 text-xs">No earnings yet.</div>}
          {history.slice(0, 10).map((item, idx) => (
            <div key={`${item.type}-${idx}`} className="text-xs text-white/80">
              +{item.amount || 0} ETB - {item.description || item.type}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Wallet;
