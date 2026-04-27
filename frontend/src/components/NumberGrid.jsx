import React, { useState } from 'react';

const numberPrices = {
  1: 100, 2: 100, 3: 100, 4: 100,
  5: 200, 6: 200, 7: 200, 8: 200,
  9: 500, 10: 500, 11: 500, 12: 500,
  13: 1000, 14: 1000, 15: 1000, 16: 1000,
};

const NumberGrid = ({ selectedNumber, takenNumbers, userId, paymentStatus, onSelectNumber }) => {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const itemsPerPage = 16;

  const getNumberStatus = (num) => {
    if (selectedNumber === num) return 'selected';
    if (takenNumbers[num] && takenNumbers[num] !== userId) return 'disabled';
    if (paymentStatus === 'pending' && selectedNumber !== num) return 'disabled';
    return 'available';
  };

  const getNumberStyle = (status) => {
    if (status === 'selected') {
      return 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg';
    }
    if (status === 'disabled') {
      return 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60';
    }
    return 'bg-white text-gray-800 hover:scale-105 hover:shadow-xl cursor-pointer';
  };

  const filteredNumbers = [...Array(17).keys()].slice(1).filter(num => 
    !searchQuery || num.toString().includes(searchQuery)
  );

  const paginatedNumbers = filteredNumbers.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="mb-6">
      <h2 className="text-center text-white font-bold text-lg mb-4">🎲 SELECT YOUR LUCKY NUMBER</h2>
      
      {/* Search Box */}
      <div className="flex gap-2 mb-4">
        <input
          type="number"
          placeholder="Search number..."
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

      {/* Numbers Grid */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {paginatedNumbers.map(num => {
          const status = getNumberStatus(num);
          const isDisabled = status === 'disabled';
          const isSelected = status === 'selected';
          
          return (
            <div
              key={num}
              onClick={() => !isDisabled && !selectedNumber && onSelectNumber(num)}
              className={`rounded-xl p-4 text-center transition-all duration-200 ${getNumberStyle(status)}`}
            >
              <div className="text-2xl font-bold">{num}</div>
              <div className="text-xs mt-1">{numberPrices[num]} ETB</div>
              {status === 'disabled' && <div className="text-xs mt-1 text-gray-500">Taken</div>}
              {isSelected && <div className="text-xs mt-1 text-white/80">Your Number</div>}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex justify-center items-center gap-4 mt-4">
        <button 
          disabled={page <= 1} 
          onClick={() => setPage(p => p - 1)}
          className={`px-4 py-2 rounded-xl font-semibold transition-all ${
            page <= 1 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:scale-105'
          }`}
        >
          ◀ Prev
        </button>
        <span className="text-white font-medium">Page {page}</span>
        <button 
          disabled={page * itemsPerPage >= filteredNumbers.length} 
          onClick={() => setPage(p => p + 1)}
          className={`px-4 py-2 rounded-xl font-semibold transition-all ${
            page * itemsPerPage >= filteredNumbers.length 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:scale-105'
          }`}
        >
          Next ▶
        </button>
      </div>
    </div>
  );
};

export default NumberGrid;