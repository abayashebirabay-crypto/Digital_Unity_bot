import React, { useState } from 'react';
import './NumberGrid.css';

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

  const filteredNumbers = [...Array(17).keys()].slice(1).filter(num => 
    !searchQuery || num.toString().includes(searchQuery)
  );

  const paginatedNumbers = filteredNumbers.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="number-section">
      <div className="section-title">🎲 SELECT YOUR LUCKY NUMBER</div>
      <div className="search-box">
        <input
          type="number"
          placeholder="Search number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button onClick={() => setPage(1)}>🔍</button>
      </div>
      <div className="number-grid">
        {paginatedNumbers.map(num => {
          const status = getNumberStatus(num);
          const isDisabled = status === 'disabled';
          const isSelected = status === 'selected';
          
          return (
            <div
              key={num}
              className={`number-card ${status}`}
              onClick={() => !isDisabled && !selectedNumber && onSelectNumber(num)}
            >
              <div className="number-value">{num}</div>
              <div className="number-price">{numberPrices[num]} ETB</div>
              {status === 'disabled' && <div className="status-label">Taken</div>}
              {isSelected && <div className="status-label">Your Number</div>}
            </div>
          );
        })}
      </div>
      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>◀ Prev</button>
        <span>Page {page}</span>
        <button disabled={page * itemsPerPage >= filteredNumbers.length} onClick={() => setPage(p => p + 1)}>Next ▶</button>
      </div>
    </div>
  );
};

export default NumberGrid;