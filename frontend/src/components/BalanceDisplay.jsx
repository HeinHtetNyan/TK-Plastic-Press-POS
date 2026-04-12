import React from 'react';

const BalanceDisplay = ({ balance, label = "Current Outstanding Balance" }) => {
  const isDebt = balance > 0;
  const isCredit = balance < 0;

  return (
    <div className={`p-6 rounded-xl shadow-lg border-2 ${
      isDebt ? 'bg-red-50 border-red-200' : isCredit ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
    }`}>
      <p className="text-gray-600 font-semibold mb-1 text-sm uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-4xl md:text-5xl font-black ${
          isDebt ? 'text-red-600' : isCredit ? 'text-green-600' : 'text-gray-700'
        }`}>
          {Math.abs(balance).toLocaleString()}
        </span>
        <span className="text-xl font-bold text-gray-400">MMK</span>
      </div>
      {isCredit && <p className="text-green-600 font-bold mt-1">(Credit Balance)</p>}
      {!isDebt && !isCredit && <p className="text-gray-500 font-bold mt-1">(No Balance Due)</p>}
    </div>
  );
};

export default BalanceDisplay;
