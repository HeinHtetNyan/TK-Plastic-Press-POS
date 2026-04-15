import React, { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, X, Pencil } from 'lucide-react';
import { customerService } from '../services/api';
import db from '../lib/db';
import { useLanguage } from '../context/LanguageContext';

const CustomerSearch = ({ onSelect, onAdd, onEdit, selectedCustomer }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await customerService.search(query);
        setResults(response.data);
        setShowResults(true);
      } catch (_) {
        // API unavailable (offline or tunnel down) — search IndexedDB
        try {
          const lower = query.toLowerCase();
          const cached = await db.customers
            .filter(c => c.name.toLowerCase().includes(lower))
            .limit(20)
            .toArray();
          setResults(cached);
          setShowResults(true);
        } catch (__) {
          setResults([]);
        }
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleQueryChange = (e) => {
    setQuery(e.target.value);
  };

  const handleSelect = (customer) => {
    onSelect(customer);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  if (selectedCustomer) {
    return (
      <div className="bg-white p-4 rounded-2xl shadow-sm border-2 border-blue-100 flex justify-between items-center">
        <div className="flex-grow">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('selected_customer')}</p>
          <div className="flex items-center gap-2">
            <p className="text-xl font-black text-blue-700">{selectedCustomer.name}</p>
            {selectedCustomer.phone_numbers && (
              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                {selectedCustomer.phone_numbers}
              </span>
            )}
          </div>
          {selectedCustomer.address && (
            <p className="text-[10px] text-gray-400 font-medium truncate max-w-xs">{selectedCustomer.address}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={(e) => onEdit(e, selectedCustomer)}
            className="p-2 text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-full transition-all"
            title="Edit Customer"
          >
            <Pencil size={20} />
          </button>
          <button
            onClick={handleClear}
            className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-full transition-all"
            title="Clear Selection"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="flex gap-2">
        <div className="relative flex-grow">
          <input
            type="text"
            className="w-full pl-11 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-blue-500 outline-none transition-all text-lg font-bold"
            placeholder={t('search_customer')}
            value={query}
            onChange={handleQueryChange}
            onFocus={() => query && setShowResults(true)}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        </div>
        <button
          onClick={onAdd}
          className="bg-blue-600 text-white px-5 rounded-2xl hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 font-black shadow-md shadow-blue-100"
        >
          <UserPlus size={20} />
          <span className="hidden sm:inline text-sm uppercase tracking-wide">{t('add')}</span>
        </button>
      </div>

      {showResults && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-100 rounded-2xl shadow-xl max-h-64 overflow-y-auto animate-in fade-in zoom-in duration-200">
          {results.map((customer) => (
            <li
              key={customer.client_id || customer.id}
              className="p-4 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 border-gray-50 transition-colors flex justify-between items-center"
              onClick={() => handleSelect(customer)}
            >
              <span className="font-black text-gray-800 text-lg">{customer.name}</span>
              <span className="text-[10px] font-black text-gray-400 uppercase">
                {customer.server_id ? `${t('id')}: ${customer.server_id}` : customer.id ? `${t('id')}: ${customer.id}` : t('local')}
              </span>
            </li>
          ))}
        </ul>
      )}

      {showResults && results.length === 0 && query.trim().length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-100 rounded-2xl shadow-xl p-4 text-center text-gray-400 font-bold text-sm animate-in fade-in duration-200">
          {t('no_customers_found')} "{query}"
        </div>
      )}
    </div>
  );
};

export default CustomerSearch;
