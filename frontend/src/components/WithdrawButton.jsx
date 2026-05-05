import React from "react";

const WithdrawButton = ({ canWithdraw, onWithdraw, loading }) => {
  return (
    <button
      onClick={onWithdraw}
      disabled={!canWithdraw || loading}
      className={`w-full py-2 rounded-full font-semibold text-sm transition-all ${
        canWithdraw && !loading
          ? "bg-gradient-to-r from-emerald-500 to-green-400 text-black hover:scale-[1.01]"
          : "bg-white/10 text-white/50 cursor-not-allowed"
      }`}
    >
      {loading ? "Processing..." : canWithdraw ? "Withdraw 100 ETB" : "Need 100 ETB to withdraw"}
    </button>
  );
};

export default WithdrawButton;
