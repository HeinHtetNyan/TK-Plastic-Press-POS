/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FilePlus, CreditCard, History, UserPlus, Users, Search as SearchIcon, Pencil, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import CustomerSearch from '../components/CustomerSearch';
import BalanceDisplay from '../components/BalanceDisplay';
import Dashboard from '../components/Dashboard';
import { customerService, analyticsService } from '../services/api';
import {
  enrichCustomer,
  cacheCustomers,
  loadCachedCustomers,
  cacheBalance,
  getOfflineBalance,
  syncAll,
} from '../services/syncService';
import db, { generateUUID } from '../lib/db';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';

const Home = () => {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const location = useLocation();

  const [selectedCustomer, setSelectedCustomer] = useState(
    location.state?.customer || null
  );
  const isInitialMount = useRef(true);
  const [balance, setBalance] = useState(0);
  const [balanceIsEstimate, setBalanceIsEstimate] = useState(false);
  const [allCustomers, setAllCustomers] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone_numbers: '',
    address: ''
  });
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  const navigate = useNavigate();

  const resetForm = () => {
    setCustomerForm({ name: '', phone_numbers: '', address: '' });
    setEditingCustomer(null);
  };

  // ------------------------------------------------------------------
  // Customer loading
  // Rule: always show API data first; Dexie caching is best-effort.
  // ------------------------------------------------------------------
  const fetchAllCustomers = useCallback(async () => {
    try {
      const response = await customerService.list();
      const enriched = response.data.map(enrichCustomer);
      // Show data IMMEDIATELY — never wait for IndexedDB
      setAllCustomers(enriched.sort((a, b) => a.name.localeCompare(b.name)));
      // Cache in background; if Dexie fails it must not affect the UI
      cacheCustomers(response.data).catch(() => {});
    } catch (_) {
      // API unavailable (offline) — load from IndexedDB fallback
      try {
        const cached = await loadCachedCustomers();
        setAllCustomers(cached.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (__) {
        setAllCustomers([]);
      }
    }
  }, []);

  // ------------------------------------------------------------------
  // Balance
  // ------------------------------------------------------------------
  const fetchBalance = useCallback(async (customer) => {
    if (!customer) return;
    const serverId = customer.server_id ?? customer.id;
    if (typeof serverId !== 'number') return;

    try {
      const response = await customerService.getBalance(serverId);
      const bal = response.data.balance;
      // Cache in background
      try { cacheBalance(serverId, bal); } catch (_) {}
      setBalance(bal);
      setBalanceIsEstimate(false);
    } catch (_) {
      // Offline fallback
      try {
        const estimated = await getOfflineBalance(customer.client_id, serverId);
        setBalance(estimated);
        setBalanceIsEstimate(true);
      } catch (__) {
        setBalance(0);
        setBalanceIsEstimate(true);
      }
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await analyticsService.getDashboard();
      setDashboardData(response.data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchAllCustomers();
    fetchDashboardData();
  }, [fetchAllCustomers, fetchDashboardData]);

  // Reset customer selection whenever we navigate to Home.
  // location.key changes on every navigation (including replace), so pressing
  // the Home button from any page — or while already on Home — resets state.
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setSelectedCustomer(location.state?.customer || null);
    setBalance(0);
    setBalanceIsEstimate(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useEffect(() => {
    if (selectedCustomer) {
      fetchBalance(selectedCustomer);
    } else {
      setBalance(0);
      setBalanceIsEstimate(false);
    }
  }, [selectedCustomer, fetchBalance]);

  // ------------------------------------------------------------------
  // Customer creation / update
  // ------------------------------------------------------------------
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!customerForm.name.trim() || isCreatingCustomer) return;

    setIsCreatingCustomer(true);

    // ── ONLINE PATH: try the API first ────────────────────────────────
    if (navigator.onLine) {
      try {
        const response = await customerService.create(customerForm);
        const enriched = enrichCustomer(response.data);
        // Cache in background
        db.customers.put({
          client_id: enriched.client_id,
          server_id: enriched.server_id,
          name: enriched.name,
          phone_numbers: enriched.phone_numbers ?? null,
          address: enriched.address ?? null,
          created_at: enriched.created_at,
          sync_status: 'synced',
        }).catch(() => {});

        setSelectedCustomer(enriched);
        setShowAddModal(false);
        resetForm();
        fetchAllCustomers();
        setIsCreatingCustomer(false);
        return;
      } catch (apiErr) {
        if (apiErr.response) {
          console.error('[Create Customer] API error:', apiErr.response.status, apiErr.response.data);

          // 5xx = server crashed AFTER the DB commit (the customer was saved but
          // something else broke, e.g. audit logging). Verify by fetching the list.
          if (apiErr.response.status >= 500) {
            try {
              const listRes = await customerService.list();
              const nameLower = customerForm.name.trim().toLowerCase();
              const saved = listRes.data.find(
                c => c.name.trim().toLowerCase() === nameLower
              );
              if (saved) {
                const enriched = enrichCustomer(saved);
                db.customers.put({
                  client_id: enriched.client_id,
                  server_id: enriched.server_id,
                  name: enriched.name,
                  phone_numbers: enriched.phone_numbers ?? null,
                  address: enriched.address ?? null,
                  created_at: enriched.created_at,
                  sync_status: 'synced',
                }).catch(() => {});
                setSelectedCustomer(enriched);
                setShowAddModal(false);
                resetForm();
                fetchAllCustomers();
                setIsCreatingCustomer(false);
                return;
              }
            } catch (_) {}
          }

          setIsCreatingCustomer(false);
          return alert(apiErr.response.data?.detail || 'Error creating customer');
        }
        // Network error (backend unreachable) — fall through to offline save
        console.warn('[Create Customer] API unreachable, saving offline...');
      }
    }

    // ── OFFLINE PATH: save locally and queue for sync ─────────────────
    const clientId = generateUUID();
    const now = new Date().toISOString();

    try {
      await db.transaction('rw', db.customers, db.sync_queue, async () => {
        await db.customers.add({
          client_id: clientId,
          server_id: null,
          name: customerForm.name.trim(),
          phone_numbers: customerForm.phone_numbers.trim() || null,
          address: customerForm.address.trim() || null,
          created_at: now,
          sync_status: 'pending',
        });
        await db.sync_queue.add({
          client_id: clientId,
          type: 'customer',
          action: 'create',
          payload: { ...customerForm },
          status: 'pending',
          retries: 0,
          depends_on_client_id: null,
          created_at: now,
        });
      });

      const enriched = {
        id: clientId,
        client_id: clientId,
        server_id: null,
        name: customerForm.name.trim(),
        phone_numbers: customerForm.phone_numbers.trim() || null,
        address: customerForm.address.trim() || null,
        created_at: now,
        sync_status: 'pending',
      };

      setSelectedCustomer(enriched);
      setShowAddModal(false);
      resetForm();
      setAllCustomers(prev =>
        [...prev, enriched].sort((a, b) => a.name.localeCompare(b.name))
      );
      syncAll(); // attempt immediate sync in case backend is reachable now
      alert('Customer saved offline. Will sync when internet is available.');
    } catch (err) {
      console.error('[Create Customer] IndexedDB error:', err);
      alert('Error saving customer: ' + err.message);
    }

    setIsCreatingCustomer(false);
  };

  const handleEditClick = (e, customer) => {
    e.stopPropagation();
    if (!navigator.onLine) {
      alert(t('online_only'));
      return;
    }
    setEditingCustomer(customer);
    setCustomerForm({
      name: customer.name || '',
      phone_numbers: customer.phone_numbers || '',
      address: customer.address || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!editingCustomer || !customerForm.name.trim()) return;

    try {
      const serverId = editingCustomer.server_id || editingCustomer.id;
      const response = await customerService.update(serverId, customerForm);
      const enriched = enrichCustomer(response.data);
      
      // Update cache
      await db.customers.put({
        client_id: enriched.client_id,
        server_id: enriched.server_id,
        name: enriched.name,
        phone_numbers: enriched.phone_numbers ?? null,
        address: enriched.address ?? null,
        created_at: enriched.created_at,
        sync_status: 'synced',
      });

      if (selectedCustomer?.id === enriched.id || selectedCustomer?.server_id === enriched.server_id) {
        setSelectedCustomer(enriched);
      }
      
      setShowEditModal(false);
      resetForm();
      fetchAllCustomers();
    } catch (error) {
      alert(error.response?.data?.detail || 'Error updating customer');
    }
  };

  const handleDeleteCustomer = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this customer? This will also affect their history.')) return;

    try {
      await customerService.delete(id);
      if (selectedCustomer?.id === id || selectedCustomer?.server_id === id) {
        setSelectedCustomer(null);
      }
      fetchAllCustomers();
    } catch (error) {
      alert(error.response?.data?.detail || 'Error deleting customer');
    }
  };

  const actions = [
    { label: t('create_voucher'), icon: FilePlus, color: 'bg-blue-600', path: '/voucher' },
    { label: t('add_payment'), icon: CreditCard, color: 'bg-green-600', path: '/payment' },
    { label: t('history'), icon: History, color: 'bg-gray-600', path: '/history' },
  ];

  return (
    <Layout>
      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        <section className="space-y-4">
          <div className="flex justify-between items-end">
            <h2 className="text-2xl font-black text-gray-800">{t('select_customer')}</h2>
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-blue-600 font-bold text-xs uppercase flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-all"
            >
              {showAll ? <SearchIcon size={14} /> : <Users size={14} />}
              {showAll ? t('search_mode') : t('browse_all')}
            </button>
          </div>

          {!showAll ? (
            <CustomerSearch
              onSelect={(c) => setSelectedCustomer(c ? enrichCustomer(c) : null)}
              onAdd={() => setShowAddModal(true)}
              onEdit={handleEditClick}
              selectedCustomer={selectedCustomer}
            />
          ) : (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-2 space-y-2 animate-in fade-in zoom-in duration-200">
              <div className="max-h-64 overflow-y-auto px-2 space-y-1">
                {allCustomers.length > 0 ? allCustomers.map(c => (
                  <div
                    key={c.client_id || c.id}
                    onClick={() => { setSelectedCustomer(c); setShowAll(false); }}
                    className={`w-full text-left p-4 rounded-2xl transition-all flex justify-between items-center cursor-pointer ${
                      (selectedCustomer?.client_id === c.client_id || selectedCustomer?.id === c.id)
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'hover:bg-blue-50 text-gray-700 font-bold border-b border-gray-50 last:border-0'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-lg">{c.name}</span>
                      {c.phone_numbers && <span className={`text-[10px] font-medium ${(selectedCustomer?.client_id === c.client_id || selectedCustomer?.id === c.id) ? 'text-blue-100' : 'text-gray-400'}`}>{c.phone_numbers}</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.sync_status === 'pending' && (
                        <span className="text-[9px] bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full font-black uppercase">{t('offline_notice')}</span>
                      )}
                      <span className={`text-[10px] uppercase font-black ${
                        (selectedCustomer?.client_id === c.client_id || selectedCustomer?.id === c.id)
                          ? 'text-blue-200' : 'text-gray-400'
                      }`}>
                        {c.server_id ? `ID: ${c.server_id}` : 'Local'}
                      </span>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={(e) => handleEditClick(e, c)}
                          className={`p-1.5 rounded-lg transition-all ${
                            (selectedCustomer?.client_id === c.client_id || selectedCustomer?.id === c.id)
                              ? 'hover:bg-blue-700 text-blue-200 hover:text-white'
                              : 'hover:bg-blue-50 text-gray-300 hover:text-blue-600'
                          }`}
                        >
                          <Pencil size={16} />
                        </button>
                        {isAdmin() && c.server_id && (
                          <button
                            onClick={(e) => handleDeleteCustomer(e, c.server_id)}
                            className={`p-1.5 rounded-lg transition-all ${
                              (selectedCustomer?.client_id === c.client_id || selectedCustomer?.id === c.id)
                                ? 'hover:bg-blue-700 text-blue-200 hover:text-white'
                                : 'hover:bg-red-50 text-gray-300 hover:text-red-500'
                            }`}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="text-center py-8 text-gray-400 font-bold">No customers found</p>
                )}
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full py-4 bg-gray-50 text-blue-600 rounded-2xl font-black uppercase text-xs hover:bg-blue-50 transition-colors border-2 border-dashed border-blue-100"
              >
                + {t('add_new_customer')}
              </button>
            </div>
          )}
        </section>

        {selectedCustomer && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <BalanceDisplay balance={balance} />
            {balanceIsEstimate && (
              <p className="text-center text-[11px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 font-bold">
                {t('balance_estimate_notice')}
              </p>
            )}

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
          <div className="space-y-8 animate-in fade-in duration-700">
            <Dashboard data={dashboardData} />

            <div className="py-12 text-center text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-200">
              <UserPlus size={48} className="mx-auto mb-2 opacity-20" />
              <p className="text-lg font-bold">Search or click 'Browse All Customers' to begin</p>
            </div>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
              <h3 className="text-2xl font-black mb-6 text-gray-800">New Customer</h3>
              {!navigator.onLine && (
                <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 text-[11px] font-bold text-yellow-700">
                  You are offline. Customer will sync when internet is available.
                </div>
              )}
              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Customer Name *</label>
                  <input
                    autoFocus
                    type="text"
                    required
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-lg transition-all"
                    placeholder="e.g. Mg Mg"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Phone Number</label>
                  <input
                    type="text"
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-lg transition-all"
                    placeholder="e.g. 09..."
                    value={customerForm.phone_numbers}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone_numbers: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Address</label>
                  <textarea
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-lg transition-all resize-none"
                    rows="2"
                    placeholder="Customer address..."
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); resetForm(); }}
                    className="flex-1 px-4 py-4 bg-gray-100 rounded-2xl font-black text-gray-500 uppercase text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingCustomer}
                    className={`flex-1 px-4 py-4 rounded-2xl font-black shadow-lg uppercase text-xs transition-all ${
                      isCreatingCustomer
                        ? 'bg-blue-300 text-white cursor-not-allowed'
                        : 'bg-blue-600 text-white shadow-blue-200'
                    }`}
                  >
                    {isCreatingCustomer ? 'Saving...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
              <h3 className="text-2xl font-black mb-6 text-gray-800">Edit Customer</h3>
              <form onSubmit={handleUpdateCustomer} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Customer Name *</label>
                  <input
                    autoFocus
                    type="text"
                    required
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-lg transition-all"
                    placeholder="e.g. Mg Mg"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Phone Number</label>
                  <input
                    type="text"
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-lg transition-all"
                    placeholder="e.g. 09..."
                    value={customerForm.phone_numbers}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone_numbers: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Address</label>
                  <textarea
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-lg transition-all resize-none"
                    rows="2"
                    placeholder="Customer address..."
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); resetForm(); }}
                    className="flex-1 px-4 py-4 bg-gray-100 rounded-2xl font-black text-gray-500 uppercase text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 uppercase text-xs"
                  >
                    Save Changes
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
