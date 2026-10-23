import React, { useState, useEffect } from 'react';

const DropdownDatePicker = ({ value, onChange, label }) => {
  const splitValue = (v) => {
    const parts = v ? v.split('-') : [];
    return {
      d: parts[0] || '',
      m: parts[1] || '',
      y: parts[2] || '',
    };
  };

  const initial = splitValue(value);
  const [localDay, setLocalDay] = useState(initial.d);
  const [localMonth, setLocalMonth] = useState(initial.m);
  const [localYear, setLocalYear] = useState(initial.y);

  // Sync from parent only when value changes externally (e.g. reset)
  useEffect(() => {
    const { d, m, y } = splitValue(value);
    setLocalDay(d);
    setLocalMonth(m);
    setLocalYear(y);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (d, m, y) => {
    if (d && m && y) {
      onChange(`${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`);
    }
    // If incomplete, don't call onChange — keep parent value as-is
    // so other fields stay intact when user accidentally picks the placeholder
  };

  const handleDay = (d) => {
    setLocalDay(d);
    emit(d, localMonth, localYear);
  };

  const handleMonth = (m) => {
    setLocalMonth(m);
    emit(localDay, m, localYear);
  };

  const handleYear = (y) => {
    setLocalYear(y);
    emit(localDay, localMonth, y);
  };

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => String(currentYear - i));

  return (
    <div className="space-y-1">
      {label && <label className="text-sm font-black text-gray-400 uppercase px-1">{label}</label>}
      <div className="flex gap-1">
        <select
          className="flex-1 min-w-0 p-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-base outline-none focus:border-blue-500"
          value={localDay}
          onChange={(e) => handleDay(e.target.value)}
        >
          <option value="">Day</option>
          {days.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          className="flex-1 min-w-0 p-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-base outline-none focus:border-blue-500"
          value={localMonth}
          onChange={(e) => handleMonth(e.target.value)}
        >
          <option value="">Month</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          className="flex-1 min-w-0 p-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-base outline-none focus:border-blue-500"
          value={localYear}
          onChange={(e) => handleYear(e.target.value)}
        >
          <option value="">Year</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  );
};

export default DropdownDatePicker;
