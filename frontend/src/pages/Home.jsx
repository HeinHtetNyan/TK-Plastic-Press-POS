import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FilePlus, CreditCard, History, UserPlus, Users, Search as SearchIcon, Pencil, Trash2, Phone, MapPin, X } from 'lucide-react';
import Layout from '../components/Layout';
import Pager from '../components/Pager';
import { paginate } from '../utils/paginate';
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
  const [customersLoadError, setCustomersLoadError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [browsePage, setBrowsePage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone_numbers: '',
    address: ''
  });
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardPeriod, setDashboardPeriod] = useState('month');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const navigate = useNavigate();

  const resetForm = () => {
    setCustomerForm({ name: '', phone_numbers: '', address: '' });
    setEditingCustomer(null);
  };

  // Customer loading
  // Rule: always show API data first; Dexie caching is best-effort.
  const fetchAllCustomers = useCallback(async () => {
    setCustomersLoadError(null);
    try {
      const response = await customerService.list();
      const enriched = response.data.map(enrichCustomer);
      setAllCustomers(enriched.sort((a, b) => (a.server_id ?? a.id) - (b.server_id ?? b.id)));
      cacheCustomers(response.data).catch(() => {});
    } catch (err) {
      const status = err?.response?.status;
      const errorMsg = status ? `Server error (HTTP ${status})` : 'Server unreachable';
      try {
        const cached = await loadCachedCustomers();
        if (cached.length > 0) {
          setAllCustomers(cached.sort((a, b) => (a.server_id ?? a.id) - (b.server_id ?? b.id)));
        } else {
          setAllCustomers([]);
          setCustomersLoadError(errorMsg);
        }
      } catch {
        setAllCustomers([]);
        setCustomersLoadError(errorMsg);
      }
    }
  }, []);

  // Balance
  const fetchBalance = useCallback(async (customer) => {
    if (!customer) return;
    const serverId = customer.server_id ?? customer.id;
    if (typeof serverId !== 'number') return;

    try {
      const response = await customerService.getBalance(serverId);
      const bal = response.data.balance;
      // Cache in background
      try { cacheBalance(serverId, bal); } catch { /* cache is best effort */ }
      setBalance(bal);
      setBalanceIsEstimate(false);
    } catch {
      // Offline fallback
      try {
        const estimated = await getOfflineBalance(customer.client_id, serverId);
        setBalance(estimated);
        setBalanceIsEstimate(true);
      } catch {
        setBalance(0);
        setBalanceIsEstimate(true);
      }
    }
  }, []);

  const fetchDashboardData = useCallback(async (period) => {
    try {
      const response = await analyticsService.getDashboard(period);
      setDashboardData(response.data);
    } catch {
      // Dashboard data is optional while offline.
    }
  }, []);

  useEffect(() => {
    fetchAllCustomers();
    fetchDashboardData(dashboardPeriod);
  }, [fetchAllCustomers, fetchDashboardData, dashboardPeriod]);

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

  // Customer creation / update
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!customerForm.name.trim() || isCreatingCustomer) return;

    setIsCreatingCustomer(true);

    // ONLINE PATH: try the API first
    if (navigator.onLine) {
      // Generate client_id before the request so we can use it for idempotent
      // recovery on 5xx — the backend stores it and we can look it up by it.
      const onlineClientId = generateUUID();
      try {
        const response = await customerService.create({ ...customerForm, client_id: onlineClientId });
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

          // 5xx = server crashed AFTER the DB commit. Use client_id for exact
          // idempotent lookup — avoids race conditions and case-sensitivity issues.
          if (apiErr.response.status >= 500) {
            try {
              const listRes = await customerService.list();
              const saved = listRes.data.find(c => c.client_id === onlineClientId);
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
            } catch {
              // Cache cleanup is best effort.
            }
          }

          setIsCreatingCustomer(false);
          return alert(apiErr.response.data?.detail || 'Error creating customer');
        }
        // Network error (backend unreachable) — fall through to offline save
        console.warn('[Create Customer] API unreachable, saving offline...');
      }
    }

    // OFFLINE PATH: save locally and queue for sync
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
          payload: {
            name: customerForm.name.trim(),
            phone_numbers: customerForm.phone_numbers.trim() || null,
            address: customerForm.address.trim() || null,
          },
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
        [...prev, enriched].sort((a, b) => (a.server_id ?? a.id) - (b.server_id ?? b.id))
      );
      syncAll(); // attempt immediate sync — no alert needed, SyncStatus badge shows pending state
    } catch (err) {
      console.error('[Create Customer] IndexedDB error:', err);
      alert('Error saving customer: ' + err.message);
    }

    setIsCreatingCustomer(false);
  };

  const handleEditClick = (e, customer) => {
    e.stopPropagation();
    if (!customer.server_id) {
      alert('This customer has not synced yet. Please wait for sync before editing.');
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

    const serverId = editingCustomer.server_id;
    const clientId = editingCustomer.client_id;
    const updateFields = {
      name: customerForm.name.trim(),
      phone_numbers: customerForm.phone_numbers || null,
      address: customerForm.address || null,
    };

    // ONLINE PATH
    if (navigator.onLine) {
      try {
        const response = await customerService.update(serverId, updateFields);
        const enriched = enrichCustomer(response.data);

        db.customers.put({
          client_id: enriched.client_id,
          server_id: enriched.server_id,
          name: enriched.name,
          phone_numbers: enriched.phone_numbers ?? null,
          address: enriched.address ?? null,
          created_at: enriched.created_at,
          sync_status: 'synced',
        }).catch(() => {});

        if (selectedCustomer?.server_id === enriched.server_id) {
          setSelectedCustomer(enriched);
        }

        setShowEditModal(false);
        resetForm();
        fetchAllCustomers();
        return;
      } catch (error) {
        if (error.response) {
          return alert(error.response?.data?.detail || 'Error updating customer');
        }
        // Network error — fall through to offline queue
      }
    }

    // OFFLINE PATH: queue update
    try {
      await db.transaction('rw', db.customers, db.sync_queue, async () => {
        await db.customers.update(clientId, { ...updateFields, sync_status: 'pending' });
        await db.sync_queue.add({
          client_id: clientId,
          type: 'customer',
          action: 'update',
          payload: { server_id: serverId, ...updateFields },
          status: 'pending',
          retries: 0,
          created_at: new Date().toISOString(),
        });
      });

      const updatedCustomer = { ...editingCustomer, ...updateFields, sync_status: 'pending' };
      if (selectedCustomer?.client_id === clientId) setSelectedCustomer(updatedCustomer);

      setShowEditModal(false);
      resetForm();
      fetchAllCustomers();
      syncAll();
    } catch (err) {
      alert('Error saving customer: ' + err.message);
    }
  };

  const handleDeleteCustomer = (e, id) => {
    e.stopPropagation();
    const c = allCustomers.find((x) => x.server_id === id || x.id === id);
    setDeleteTarget({ id, name: c?.name || '' });
  };

  const confirmDeleteCustomer = async () => {
    const id = deleteTarget?.id;
    setDeleteTarget(null);
    if (id == null) return;
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
    { label: t('create_voucher'), icon: FilePlus, color: 'bg-accent text-on-accent border border-accent', path: '/voucher' },
    { label: t('add_payment'), icon: CreditCard, color: 'bg-ok text-on-accent border border-ok', path: '/payment' },
    { label: t('history'), icon: History, color: 'bg-row text-ink border border-line-strong hover:bg-band', path: '/history' },
  ];

  return (
    <Layout>
      <div className="space-y-4 animate-in fade-in duration-300">
        <section className="space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-semibold text-ink">{t('select_customer')}</h2>
              {allCustomers.length > 0 && (
                <span className="text-sm font-semibold text-ok bg-ok-bg px-2.5 py-0.5 rounded-full">
                  {allCustomers.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-ink font-medium text-base underline underline-offset-4 flex items-center gap-2 min-h-[var(--ctl)] px-1 hover:text-accent transition-colors"
            >
              {showAll ? <SearchIcon size={18} /> : <Users size={18} />}
              {showAll ? t('search_mode') : t('browse_all')}
            </button>
          </div>

          {!showAll ? (
            selectedCustomer ? null : (
              <CustomerSearch
                onSelect={(c) => setSelectedCustomer(c ? ((c.server_id || !c.id) ? c : enrichCustomer(c)) : null)}
                onAdd={() => setShowAddModal(true)}
                onEdit={handleEditClick}
                selectedCustomer={selectedCustomer}
              />
            )
          ) : (
            <div className="bg-row rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <span className="text-lg font-semibold text-ink">{t('browse_all')}</span>
                <span className="text-sm font-medium text-muted bg-band px-3 py-1 rounded-full">
                  {allCustomers.length} {allCustomers.length === 1 ? 'customer' : 'customers'}
                </span>
              </div>
              {allCustomers.length > 0 && (
                <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.1fr)] gap-x-4 px-5 py-2 bg-band border-y border-line text-sm font-semibold text-muted">
                  <span>{t('customer')}</span>
                  <span>{t('x2_phone')}</span>
                  <span className="text-right pr-1">{t('x2_actions')}</span>
                </div>
              )}
              <div className="max-h-[32rem] overflow-y-auto border-t border-line md:border-t-0">
                {allCustomers.length > 0 ? paginate(allCustomers, browsePage, 20).rows.map(c => {
                  const isSel = selectedCustomer?.client_id === c.client_id || selectedCustomer?.id === c.id;
                  return (
                    <div
                      key={c.client_id || c.id}
                      onClick={() => { setSelectedCustomer(c); setShowAll(false); }}
                      className={`grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.1fr)] items-center gap-x-4 gap-y-0.5 pl-5 pr-3 py-2 min-h-[var(--row-h)] cursor-pointer border-b border-line last:border-b-0 border-l-4 transition-colors ${
                        isSel ? 'bg-band border-l-accent' : 'border-l-transparent hover:bg-zebra'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-base font-semibold text-ink break-words block">{c.name}</span>
                        {c.phone_numbers && <span className="md:hidden text-sm text-muted block truncate">{c.phone_numbers}</span>}
                      </div>
                      <span className="hidden md:block text-base text-muted truncate">{c.phone_numbers || '—'}</span>
                      <div className="flex items-center justify-end gap-1.5 shrink-0">
                        {c.sync_status === 'pending' && (
                          <span className="text-sm bg-extra-bg text-extra px-2 py-0.5 rounded-full font-medium">{t('offline_notice')}</span>
                        )}
                        <span className="text-sm text-muted tabular-nums whitespace-nowrap hidden sm:inline">
                          {c.server_id ? `ID: ${c.server_id}` : 'Local'}
                        </span>
                        <button
                          onClick={(e) => handleEditClick(e, c)}
                          className="min-h-[var(--ctl)] min-w-[var(--ctl)] flex items-center justify-center rounded-xl text-muted hover:text-accent hover:bg-row transition-colors"
                          aria-label={t('edit')}
                        >
                          <Pencil size={18} />
                        </button>
                        {isAdmin() && c.server_id && (
                          <button
                            onClick={(e) => handleDeleteCustomer(e, c.server_id)}
                            className="min-h-[var(--ctl)] min-w-[var(--ctl)] flex items-center justify-center rounded-xl text-muted hover:text-debt hover:bg-debt-bg transition-colors"
                            aria-label={t('delete')}
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }) : customersLoadError ? (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-debt font-semibold text-base">{t('x2_load_fail')}</p>
                    <p className="text-muted text-base">{customersLoadError} — no offline cache available.</p>
                    <button
                      onClick={fetchAllCustomers}
                      className="text-accent font-semibold text-base bg-band px-4 min-h-[var(--ctl)] rounded-xl hover:opacity-90 transition-colors"
                    >
                      {t('x2_retry')}
                    </button>
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted">{t('x_no_customers')}</p>
                )}
              </div>
              <div className="border-t border-line py-2">
                <Pager page={paginate(allCustomers, browsePage, 20).page} pages={paginate(allCustomers, browsePage, 20).pages} onChange={setBrowsePage} className="px-4" />
              </div>
              <div className="p-3 border-t border-line bg-page">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="block w-full min-h-[var(--ctl)] bg-row text-accent font-semibold text-base hover:bg-band transition-colors rounded-xl border-2 border-dashed border-line-strong"
                >
                  + {t('add_new_customer')}
                </button>
              </div>
            </div>
          )}
        </section>

        {selectedCustomer && !showAll && (
          <section className="bg-row rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-px bg-line">
              <div className="bg-row p-5 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted">{t('selected_customer')}</p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={(e) => handleEditClick(e, selectedCustomer)}
                      className="min-h-[var(--ctl)] min-w-[var(--ctl)] flex items-center justify-center text-muted hover:text-accent bg-row border border-line-strong hover:bg-band rounded-xl transition-colors"
                      title="Edit Customer"
                      aria-label="Edit Customer"
                    >
                      <Pencil size={20} />
                    </button>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="min-h-[var(--ctl)] min-w-[var(--ctl)] flex items-center justify-center text-muted hover:text-debt bg-row border border-line-strong hover:bg-debt-bg rounded-xl transition-colors"
                      title="Clear Selection"
                      aria-label="Clear Selection"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <h3 className="text-2xl font-semibold text-ink break-words leading-snug -mt-1">{selectedCustomer.name}</h3>
                {selectedCustomer.phone_numbers && (
                  <p className="mt-3 text-base text-ink flex items-start gap-2.5">
                    <Phone size={18} className="mt-0.5 text-muted shrink-0" aria-hidden="true" />
                    <span className="break-words min-w-0">{selectedCustomer.phone_numbers}</span>
                  </p>
                )}
                {selectedCustomer.address && (
                  <p className="mt-1.5 text-base text-muted flex items-start gap-2.5">
                    <MapPin size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span className="break-words min-w-0">{selectedCustomer.address}</span>
                  </p>
                )}
              </div>
              <div className="bg-row min-w-0">
                <BalanceDisplay balance={balance} embedded />
              </div>
            </div>
            {balanceIsEstimate && (
              <p className="text-sm text-extra bg-extra-bg px-5 py-2.5 border-t border-line">
                {t('balance_estimate_notice')}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-band border-t border-line">
              {actions.map((action) => (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path, { state: { customer: selectedCustomer } })}
                  className={`${action.color} min-h-14 px-4 py-3 rounded-xl transition-opacity hover:opacity-90 flex items-center justify-center gap-3 text-base font-semibold`}
                >
                  <action.icon size={20} />
                  {action.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {!selectedCustomer && !showAll && (
          <div className="space-y-4 animate-in fade-in duration-700">
            <div className="grid grid-cols-4 gap-2 lg:flex lg:flex-wrap lg:items-center lg:justify-end">
              {[
                { value: 'month', label: t('x_p_month') },
                { value: '3months', label: t('x_p_3m') },
                { value: '6months', label: t('x_p_6m') },
                { value: '1year', label: t('x_p_1y') },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setDashboardPeriod(p.value)}
                  className={`px-1 lg:px-5 min-h-[var(--ctl)] rounded-full border text-sm lg:text-base leading-tight font-semibold transition-colors ${
                    dashboardPeriod === p.value
                      ? 'bg-accent text-on-accent border-accent'
                      : 'bg-row text-ink border-line-strong hover:bg-band'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Dashboard data={dashboardData} />

            <div className="py-8 text-center text-muted bg-row rounded-2xl border-2 border-dashed border-line-strong">
              <UserPlus size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-base">{t('x2_begin')}</p>
            </div>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-[var(--scrim)] flex items-end sm:items-center justify-center sm:p-4 z-50 animate-in fade-in">
            <div className="bg-row rounded-t-3xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full sm:max-w-md max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200">
              <h3 className="text-xl font-semibold mb-4 text-ink">{t('x2_new_customer')}</h3>
              {!navigator.onLine && (
                <div className="mb-4 bg-extra-bg border border-extra/40 rounded-lg px-3 py-2 text-sm text-extra">
                  {t('x2_offline_cust')}
                </div>
              )}
              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted block">{t('x2_cust_name')}</label>
                  <input
                    autoFocus
                    type="text"
                    required
                    className="w-full px-3 min-h-[var(--ctl)] bg-row border border-line-strong rounded-xl outline-none focus:border-accent text-base transition-colors"
                    placeholder={t('x2_ph_name')}
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted block">{t('x2_phone')}</label>
                  <input
                    type="text"
                    className="w-full px-3 min-h-[var(--ctl)] bg-row border border-line-strong rounded-xl outline-none focus:border-accent text-base transition-colors"
                    placeholder={t('x2_ph_phone')}
                    value={customerForm.phone_numbers}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone_numbers: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted block">{t('x2_address')}</label>
                  <textarea
                    className="w-full px-3 py-2 bg-row border border-line-strong rounded-xl outline-none focus:border-accent text-base transition-colors resize-none"
                    rows="2"
                    placeholder={t('x2_ph_addr')}
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); resetForm(); }}
                    className="flex-1 px-4 min-h-[var(--ctl)] bg-row border border-line-strong rounded-xl font-semibold text-ink text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingCustomer}
                    className={`flex-1 px-4 min-h-[var(--ctl)] rounded-xl font-semibold text-base transition-opacity ${
                      isCreatingCustomer
                        ? 'bg-accent/40 text-on-accent cursor-not-allowed'
                        : 'bg-accent text-on-accent'
                    }`}
                  >
                    {isCreatingCustomer ? 'Saving...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div className="fixed inset-0 bg-[var(--scrim)] flex items-end sm:items-center justify-center sm:p-4 z-50 animate-in fade-in" onClick={() => setDeleteTarget(null)}>
            <div className="bg-row rounded-t-3xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full sm:max-w-md animate-in slide-in-from-bottom-4 duration-200" onClick={(e) => e.stopPropagation()}>
              <span className="block mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
              <h3 className="text-xl font-semibold mb-2 text-ink">Delete customer?</h3>
              <p className="text-base text-muted mb-5">
                {deleteTarget.name ? `Delete customer "${deleteTarget.name}"? ` : 'Delete this customer? '}This will also affect their history and cannot be undone.
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 px-4 min-h-[var(--ctl)] bg-row border border-line-strong rounded-xl font-semibold text-ink text-base">Cancel</button>
                <button type="button" onClick={confirmDeleteCustomer} className="flex-1 px-4 min-h-[var(--ctl)] bg-danger text-on-danger rounded-xl font-semibold text-base flex items-center justify-center gap-2"><Trash2 size={18} />Delete</button>
              </div>
            </div>
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 bg-[var(--scrim)] flex items-end sm:items-center justify-center sm:p-4 z-50 animate-in fade-in">
            <div className="bg-row rounded-t-3xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full sm:max-w-md max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200">
              <h3 className="text-xl font-semibold mb-4 text-ink">{t('x2_edit_customer')}</h3>
              <form onSubmit={handleUpdateCustomer} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted block">{t('x2_cust_name')}</label>
                  <input
                    autoFocus
                    type="text"
                    required
                    className="w-full px-3 min-h-[var(--ctl)] bg-row border border-line-strong rounded-xl outline-none focus:border-accent text-base transition-colors"
                    placeholder={t('x2_ph_name')}
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted block">{t('x2_phone')}</label>
                  <input
                    type="text"
                    className="w-full px-3 min-h-[var(--ctl)] bg-row border border-line-strong rounded-xl outline-none focus:border-accent text-base transition-colors"
                    placeholder={t('x2_ph_phone')}
                    value={customerForm.phone_numbers}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone_numbers: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted block">{t('x2_address')}</label>
                  <textarea
                    className="w-full px-3 py-2 bg-row border border-line-strong rounded-xl outline-none focus:border-accent text-base transition-colors resize-none"
                    rows="2"
                    placeholder={t('x2_ph_addr')}
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); resetForm(); }}
                    className="flex-1 px-4 min-h-[var(--ctl)] bg-row border border-line-strong rounded-xl font-semibold text-ink text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 min-h-[var(--ctl)] bg-accent text-on-accent rounded-xl font-semibold text-base"
                  >
                    {t('x2_save_changes')}
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
