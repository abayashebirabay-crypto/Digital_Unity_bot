import React, { useState } from 'react';

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
  const [tempSelected,] = useState([]);
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
      return 'bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-lg';
    }
    if (status === 'pending') {
      return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white';
    }
    if (status === 'temp') {
      return 'bg-gradient-to-r from-blue-500 to-purple-500 text-white';
    }
    if (status === 'disabled') {
      return 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60';
    }
    return 'bg-white text-gray-800 hover:scale-105 hover:shadow-xl cursor-pointer';
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
      <h2 className="text-center text-white font-bold text-lg mb-4">🎲 SELECT YOUR LUCKY NUMBERS</h2>

      <div className="flex justify-center gap-4 mb-4 text-xs text-white/80">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Approved</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>In Cart</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>Taken</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-white"></div>
          <span>Available</span>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="number"
          placeholder={`Search number (${minNumber}-${maxNumber})...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={() => setPage(1)}
          className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-xl hover:scale-105 transition-all"
        >
          🔍
        </button>
      </div>

      {!gameActive && (
        <div className="bg-red-500/20 border border-red-500 rounded-xl p-3 mb-4 text-center">
          <div className="text-yellow-300 font-bold text-sm">⚠️ NO ACTIVE GAME ROUND</div>
          <div className="text-white/80 text-xs mt-1">Please wait for admin to start a new game</div>
        </div>
      )}

      {gameActive && (
        <div className="text-center text-white/60 text-xs mb-2">
          Numbers: {minNumber} to {maxNumber} | Total: {allNumbers.length} numbers
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 mb-4">
        {paginatedNumbers.map(num => {
          const status = getNumberStatus(num);
          return (
            <div
              key={num}
              onClick={() => handleNumberClick(num, status)}
              className={`rounded-xl p-4 text-center transition-all duration-200 ${getNumberStyle(status)}`}
            >
              <div className="text-2xl font-bold">{num}</div>
              <div className="text-xs mt-1">{pricePerNumber} ETB</div>
              <div className="text-xs mt-1 font-semibold">
                {getNumberLabel(status)}
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${page <= 1
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:scale-105'
              }`}
          >
            ◀ Prev
          </button>
          <span className="text-white font-medium">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${page >= totalPages
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:scale-105'
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