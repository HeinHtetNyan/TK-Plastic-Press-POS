import React, { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { customerService } from '../services/api';

const CustomerSearch = ({ onSelect, onAdd, selectedCustomer }) => {
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
    if (query.trim().length > 0) {
      const fetchCustomers = async () => {
        try {
          const response = await customerService.search(query);
          setResults(response.data);
          setShowResults(true);
        } catch (error) {
          console.error('Error searching customers:', error);
        }
      };
      const timeoutId = setTimeout(fetchCustomers, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [query]);

  const handleSelect = (customer) => {
    onSelect(customer);
    setQuery('');
    setShowResults(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery('');
  };

  if (selectedCustomer) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200 flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-500 font-medium">Selected Customer</p>
          <p className="text-xl font-bold text-blue-700">{selectedCustomer.name}</p>
        </div>
        <button
          onClick={handleClear}
          className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 rounded-full"
        >
          <X size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="flex gap-2">
        <div className="relative flex-grow">
          <input
            type="text"
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-lg"
            placeholder="Search Customer Name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query && setShowResults(true)}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        </div>
        <button
          onClick={onAdd}
          className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center gap-2"
        >
          <UserPlus size={20} />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>

      {showResults && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in duration-200">
          {results.map((customer) => (
            <li
              key={customer.id}
              className="p-4 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 border-gray-100 transition-colors flex flex-col"
              onClick={() => handleSelect(customer)}
            >
              <span className="font-bold text-gray-800 text-lg">{customer.name}</span>
              <span className="text-xs text-gray-400">ID: {customer.id}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CustomerSearch;
