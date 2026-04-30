import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NumberGrid = ({
  selectedNumbers,      // Array of approved numbers
  pendingNumbers,       // Array of pending numbers
  takenNumbers,         // Numbers taken by other users
  userId,
  paymentStatus,
  onSelectNumber,
  gameActive = true,
  pricePerNumber = 100,
  minNumber = 1,
  maxNumber = 16
}) => {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [tempSelected] = useState([]);
  const itemsPerPage = 16;

  const generateNumbers = () => {
    const numbers = [];
    for (let i = minNumber; i <= maxNumber; i++) {
      numbers.push(i);
    }
    return numbers;
  };

  const getNumberStatus = (num) => {
    if (!gameActive) return 'disabled';

    if (selectedNumbers?.includes(num)) return 'approved';
    if (pendingNumbers?.includes(num)) return 'pending';
    if (takenNumbers[num] && takenNumbers[num] !== userId) return 'disabled';
    if (tempSelected.includes(num)) return 'temp';

    return 'available';
  };

  const getNumberStyle = (status) => {
    if (status === 'approved') {
      return 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg border border-emerald-400/30';
    }
    if (status === 'pending') {
      return 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md border border-amber-400/30';
    }
    if (status === 'temp') {
      return 'bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white shadow-md border border-[#60A5FA]/30';
    }
    if (status === 'disabled') {
      return 'bg-gray-800/50 text-gray-500 cursor-not-allowed backdrop-blur-sm border border-gray-700';
    }
    return 'bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 hover:scale-105 hover:shadow-xl cursor-pointer border border-white/20 transition-all duration-200';
  };

  const getNumberLabel = (status) => {
    if (status === 'approved') return '✓ Approved';
    if (status === 'pending') return '⏳ Pending';
    if (status === 'temp') return '📦 In Cart';
    if (status === 'disabled') return 'Taken';
    return 'Available';
  };

  const allNumbers = generateNumbers();

  const filteredNumbers = allNumbers.filter(num =>
    !searchQuery || num.toString().includes(searchQuery)
  );

  const paginatedNumbers = filteredNumbers.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(filteredNumbers.length / itemsPerPage);

  const handleNumberClick = (num, status) => {
    if (status === 'disabled') return;
    if (status === 'approved' || status === 'pending') {
      alert(`Number ${num} is already ${status}`);
      return;
    }
    onSelectNumber(num);
  };

  return (
    <div className="mb-6">
      <h2 className="text-center text-white font-bold text-lg mb-4 bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] bg-clip-text text-transparent">
        🎲 SELECT YOUR LUCKY NUMBERS
      </h2>

      {/* Legend */}
      <div className="flex justify-center gap-3 mb-4 text-xs text-white/70 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-green-500"></div>
          <span>Approved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500"></div>
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6]"></div>
          <span>In Cart</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>Taken</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-white/50"></div>
          <span>Available</span>
        </div>
      </div>

      {/* Search Box */}
      <div className="flex gap-2 mb-4">
        <input
          type="number"
          placeholder={`Search number (${minNumber}-${maxNumber})...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white placeholder-white/50 border border-white/20 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
        />
        <button
          onClick={() => setPage(1)}
          className="bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white px-5 py-2 rounded-full hover:scale-105 transition-all shadow-lg"
        >
          🔍
        </button>
      </div>

      {/* No Active Game Warning */}
      {!gameActive && (
        <div className="bg-red-500/20 border border-red-500 rounded-2xl p-3 mb-4 text-center backdrop-blur-sm">
          <div className="text-amber-300 font-bold text-sm">⚠️ NO ACTIVE GAME ROUND</div>
          <div className="text-white/70 text-xs mt-1">Please wait for admin to start a new game</div>
        </div>
      )}

      {/* Game Info */}
      {gameActive && (
        <div className="text-center text-white/40 text-xs mb-3">
          Numbers: {minNumber} to {maxNumber} | Total: {allNumbers.length} numbers
        </div>
      )}

      {/* Numbers Grid */}
      <div className="grid grid-cols-4 gap-3">
        <AnimatePresence>
          {paginatedNumbers.map((num, idx) => {
            const status = getNumberStatus(num);
            return (
              <motion.div
                key={num}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: idx * 0.01 }}
                whileTap={{ scale: status === 'available' ? 0.95 : 1 }}
                onClick={() => handleNumberClick(num, status)}
                className={`rounded-xl p-3 text-center transition-all duration-200 cursor-pointer ${getNumberStyle(status)}`}
              >
                <div className="text-xl font-bold">{num}</div>
                <div className="text-[10px] mt-1 opacity-80">{pricePerNumber} ETB</div>
                <div className="text-[10px] mt-1 font-semibold">
                  {getNumberLabel(status)}
                </div>
                {status === 'pending' && (
                  <div className="text-[9px] mt-1 text-amber-200/80">Awaiting Approval</div>
                )}
                {status === 'approved' && (
                  <div className="text-[9px] mt-1 text-emerald-200/80">✓ Locked</div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-5">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className={`px-4 py-2 rounded-full font-semibold transition-all ${
              page <= 1
                ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white hover:scale-105 shadow-lg'
            }`}
          >
            ◀ Prev
          </button>
          <span className="text-white/70 font-medium text-sm">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className={`px-4 py-2 rounded-full font-semibold transition-all ${
              page >= totalPages
                ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] text-white hover:scale-105 shadow-lg'
            }`}
          >
            Next ▶
          </button>
        </div>
      )}
    </div>
  );
};

export default NumberGrid;