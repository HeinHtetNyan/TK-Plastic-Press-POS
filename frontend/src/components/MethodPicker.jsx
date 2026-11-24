import React from 'react';

const METHODS = [
  { value: 'CASH', label: 'CASH', on: 'bg-ok border-ok/30 text-on-accent' },
  { value: 'KBZPAY', label: 'KBZPAY', on: 'bg-accent border-line text-on-accent' },
  { value: 'BANK_TRANSFER', label: 'BANK', on: 'bg-m-bank border-m-bank/40 text-on-accent' },
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
          className={`min-h-[52px] rounded-lg border text-base font-semibold transition-all ${
            active ? m.on : 'bg-row border-line text-muted'
          }`}
        >
          {m.label}
        </button>
      );
    })}
  </div>
);

export default MethodPicker;
