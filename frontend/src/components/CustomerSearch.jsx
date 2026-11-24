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
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await customerService.search(query);
        setResults(response.data);
        setShowResults(true);
      } catch {
        // API unavailable (offline or tunnel down) — search IndexedDB
        try {
          const lower = query.toLowerCase();
          const cached = await db.customers
            .filter(c => c.name.toLowerCase().includes(lower))
            .limit(20)
            .toArray();
          setResults(cached);
          setShowResults(true);
        } catch {
          setResults([]);
        }
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleQueryChange = (e) => {
    const nextQuery = e.target.value;
    setQuery(nextQuery);
    if (nextQuery.trim().length === 0) {
      setResults([]);
      setShowResults(false);
    }
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
      <div className="bg-row rounded-2xl shadow-sm p-4 flex justify-between items-start gap-3">
        <div className="min-w-0 flex-grow">
          <p className="text-sm text-muted">{t('selected_customer')}</p>
          <p className="text-xl font-semibold text-ink break-words">{selectedCustomer.name}</p>
          {selectedCustomer.phone_numbers && (
            <p className="text-base text-muted">{selectedCustomer.phone_numbers}</p>
          )}
          {selectedCustomer.address && (
            <p className="text-sm text-muted truncate max-w-xs">{selectedCustomer.address}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={(e) => onEdit(e, selectedCustomer)}
            className="min-h-[var(--ctl)] min-w-[var(--ctl)] flex items-center justify-center text-muted hover:text-accent bg-row border border-line-strong hover:bg-band rounded-xl transition-colors"
            title="Edit Customer"
          >
            <Pencil size={20} />
          </button>
          <button
            onClick={handleClear}
            className="min-h-[var(--ctl)] min-w-[var(--ctl)] flex items-center justify-center text-muted hover:text-debt bg-row border border-line-strong hover:bg-debt-bg rounded-xl transition-colors"
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
            className="w-full pl-11 pr-4 min-h-[var(--ctl)] bg-row border border-line-strong rounded-xl focus:border-accent outline-none transition-colors text-base"
            placeholder={t('search_customer')}
            value={query}
            onChange={handleQueryChange}
            onFocus={() => query && setShowResults(true)}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
        </div>
        <button
          onClick={onAdd}
          className="bg-accent text-on-accent px-5 min-h-[var(--ctl)] rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 font-semibold"
        >
          <UserPlus size={20} />
          <span className="hidden sm:inline text-base">{t('add')}</span>
        </button>
      </div>

      {showResults && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-2 bg-row shadow-md border border-line-strong rounded-2xl max-h-72 overflow-y-auto overflow-x-hidden animate-in fade-in duration-200">
          {results.map((customer) => (
            <li
              key={customer.client_id || customer.id}
              className="px-5 py-3 min-h-[var(--row-h)] hover:bg-band cursor-pointer border-b last:border-b-0 border-line transition-colors flex justify-between items-center gap-3"
              onClick={() => handleSelect(customer)}
            >
              <span className="font-semibold text-ink text-base break-words min-w-0">{customer.name}</span>
              <span className="text-sm text-muted bg-band rounded-full px-2.5 py-0.5 whitespace-nowrap tabular-nums shrink-0">
                {customer.server_id ? `${t('id')}: ${customer.server_id}` : customer.id ? `${t('id')}: ${customer.id}` : t('local')}
              </span>
            </li>
          ))}
        </ul>
      )}

      {showResults && results.length === 0 && query.trim().length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-row shadow-md border border-line-strong rounded-2xl p-5 text-center text-muted text-base animate-in fade-in duration-200">
          {t('no_customers_found')} "{query}"
        </div>
      )}
    </div>
  );
};

export default CustomerSearch;
