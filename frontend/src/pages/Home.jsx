import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FilePlus, CreditCard, History, UserPlus, Users, Search as SearchIcon } from 'lucide-react';
import Layout from '../components/Layout';
import CustomerSearch from '../components/CustomerSearch';
import BalanceDisplay from '../components/BalanceDisplay';
import { customerService } from '../services/api';

const Home = () => {
  const location = useLocation();
  const [selectedCustomer, setSelectedCustomer] = useState(location.state?.customer || null);
  const [balance, setBalance] = useState(0);
  const [allCustomers, setAllCustomers] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchBalance(selectedCustomer.id);
    } else {
      setBalance(0);
    }
  }, [selectedCustomer]);

  const fetchAllCustomers = async () => {
    try {
      const response = await customerService.list();
      setAllCustomers(response.data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchBalance = async (id) => {
    setLoading(true);
    try {
      const response = await customerService.getBalance(id);
      setBalance(response.data.balance);
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    
    try {
      const response = await customerService.create({ name: newCustomerName });
      setSelectedCustomer(response.data);
      setShowAddModal(false);
      setNewCustomerName('');
      fetchAllCustomers(); // Refresh list
    } catch (error) {
      alert('Error creating customer');
      console.error(error);
    }
  };

  const actions = [
    { label: 'Create Voucher', icon: FilePlus, color: 'bg-blue-600', path: '/voucher' },
    { label: 'Add Payment', icon: CreditCard, color: 'bg-green-600', path: '/payment' },
    { label: 'View History', icon: History, color: 'bg-gray-600', path: '/history' },
  ];

  return (
    <Layout>
      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        <section className="space-y-4">
          <div className="flex justify-between items-end">
            <h2 className="text-2xl font-black text-gray-800">Select Customer</h2>
            <button 
              onClick={() => setShowAll(!showAll)}
              className="text-blue-600 font-bold text-xs uppercase flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-all"
            >
              {showAll ? <SearchIcon size={14} /> : <Users size={14} />}
              {showAll ? 'Search Mode' : 'Browse All Customers'}
            </button>
          </div>

          {!showAll ? (
            <CustomerSearch 
              onSelect={setSelectedCustomer} 
              onAdd={() => setShowAddModal(true)}
              selectedCustomer={selectedCustomer}
            />
          ) : (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-2 space-y-2 animate-in fade-in zoom-in duration-200">
               <div className="max-h-64 overflow-y-auto px-2 space-y-1">
                  {allCustomers.length > 0 ? allCustomers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCustomer(c); setShowAll(false); }}
                      className={`w-full text-left p-4 rounded-2xl transition-all flex justify-between items-center ${
                        selectedCustomer?.id === c.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-blue-50 text-gray-700 font-bold border-b border-gray-50 last:border-0'
                      }`}
                    >
                      <span className="text-lg">{c.name}</span>
                      <span className={`text-[10px] uppercase font-black ${selectedCustomer?.id === c.id ? 'text-blue-200' : 'text-gray-400'}`}>ID: {c.id}</span>
                    </button>
                  )) : (
                    <p className="text-center py-8 text-gray-400 font-bold">No customers created yet</p>
                  )}
               </div>
               <button 
                 onClick={() => setShowAddModal(true)}
                 className="w-full py-4 bg-gray-50 text-blue-600 rounded-2xl font-black uppercase text-xs hover:bg-blue-50 transition-colors border-2 border-dashed border-blue-100"
               >
                 + Add New Customer
               </button>
            </div>
          )}
        </section>

        {selectedCustomer && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <BalanceDisplay balance={balance} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {actions.map((action) => (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path, { state: { customer: selectedCustomer } })}
                  className={`${action.color} text-white p-4 rounded-2xl shadow-md hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 text-lg font-bold`}
                >
                  <action.icon size={24} />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!selectedCustomer && !showAll && (
          <div className="py-12 text-center text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <UserPlus size={48} className="mx-auto mb-2 opacity-20" />
            <p className="text-lg font-bold">Search or click 'Browse All Customers' to begin</p>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
              <h3 className="text-2xl font-black mb-6 text-gray-800">New Customer</h3>
              <form onSubmit={handleAddCustomer} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Customer Name</label>
                  <input
                    autoFocus
                    type="text"
                    required
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-lg transition-all"
                    placeholder="e.g. Mg Mg"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-4 bg-gray-100 rounded-2xl font-black text-gray-500 uppercase text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 uppercase text-xs"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Home;
