import React, { useState, useEffect } from 'react';

const DropdownDatePicker = ({ value, onChange, label }) => {
  // value format: DD-MM-YYYY
  const parts = value ? value.split('-') : ['', '', ''];
  const [day, setDay] = useState(parts[0] || '');
  const [month, setMonth] = useState(parts[1] || '');
  const [year, setYear] = useState(parts[2] || '');

  useEffect(() => {
    if (day && month && year) {
      onChange(`${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`);
    } else {
      onChange('');
    }
  }, [day, month, year]);

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  return (
    <div className="space-y-1">
      {label && <label className="text-[10px] font-black text-gray-400 uppercase px-1">{label}</label>}
      <div className="flex gap-1">
        <select 
          className="flex-1 p-2 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-sm outline-none focus:border-blue-500"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        >
          <option value="">Day</option>
          {days.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select 
          className="flex-1 p-2 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-sm outline-none focus:border-blue-500"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          <option value="">Month</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select 
          className="flex-1 p-2 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-sm outline-none focus:border-blue-500"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="">Year</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  );
};

export default DropdownDatePicker;
