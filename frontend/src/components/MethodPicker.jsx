import React from 'react';

const METHODS = [
  { value: 'CASH', label: 'CASH', on: 'bg-green-600 border-green-700 text-white' },
  { value: 'KBZPAY', label: 'KBZPAY', on: 'bg-blue-600 border-blue-700 text-white' },
  { value: 'BANK_TRANSFER', label: 'BANK', on: 'bg-purple-600 border-purple-700 text-white' },
];

// Three big tap targets instead of a drop-down. Tapping the chosen one again clears it.
const MethodPicker = ({ value, onChange }) => (
  <div className="grid grid-cols-3 gap-3">
    {METHODS.map((m) => {
      const active = value === m.value;
      return (
        <button
          key={m.value}
          type="button"
          onClick={() => onChange(active ? '' : m.value)}
          className={`min-h-[52px] rounded-xl border-2 text-base font-black transition-all active:scale-95 ${
            active ? m.on : 'bg-white border-gray-300 text-gray-500'
          }`}
        >
          {m.label}
        </button>
      );
    })}
  </div>
);

export default MethodPicker;
