import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, TrendingDown, Save, X, WifiOff } from 'lucide-react';
import Layout from '../components/Layout';
import DropdownDatePicker from '../components/DropdownDatePicker';
import { spendingService } from '../services/api';
import { syncAll } from '../services/syncService';
import db, { generateUUID } from '../lib/db';
import { useLanguage } from '../context/LanguageContext';

const today = () => new Date().toLocaleDateString('en-GB').split('/').join('-');

const Spending = () => {
  const { t } = useLanguage();
  const [spendings, setSpendings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingClientId, setEditingClientId] = useState(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [spendingDate, setSpendingDate] = useState(today());

  const resetForm = () => {
    setEditingId(null);
    setEditingClientId(null);
    setDescription('');
    setAmount('');
    setSpendingDate(today());
    setShowForm(false);
  };

  const fetchSpendings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await spendingService.list();
      setSpendings(res.data);
    } catch (_) {
      // Offline: load from IndexedDB
      try {
        const rows = await db.spendings.orderBy('spending_date').reverse().toArray();
        setSpendings(rows.map(r => ({
          id: r.server_id,
          client_id: r.client_id,
          description: r.description,
          amount: r.amount,
          spending_date: r.spending_date,
          sync_status: r.sync_status,
        })));
      } catch (__) {
        setSpendings([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpendings();
  }, [fetchSpendings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return alert(t('spending_desc_required'));
    if (!amount || parseFloat(amount) <= 0) return alert(t('spending_amount_required'));

    setSaving(true);
    const now = new Date().toISOString();

    if (editingId) {
      // Update existing
      if (navigator.onLine) {
        try {
          await spendingService.update(editingId, {
            description: description.trim(),
            amount: parseFloat(amount),
            spending_date: spendingDate,
          });
          await fetchSpendings();
          resetForm();
        } catch (err) {
          alert(err.response?.data?.detail || t('spending_save_error'));
        }
        setSaving(false);
        return;
      } else {
        // Offline update
        try {
          await db.transaction('rw', db.spendings, db.sync_queue, async () => {
            await db.spendings.update(editingClientId, {
              description: description.trim(),
              amount: parseFloat(amount),
              spending_date: spendingDate,
              sync_status: 'pending',
            });
            await db.sync_queue.add({
              client_id: editingClientId,
              type: 'spending',
              action: 'update',
              payload: {
                server_id: editingId,
                description: description.trim(),
                amount: parseFloat(amount),
                spending_date: spendingDate,
              },
              status: 'pending',
              retries: 0,
              depends_on_client_id: null,
              created_at: now,
            });
          });
          syncAll();
          await fetchSpendings();
          resetForm();
        } catch (err) {
          alert(t('spending_save_error'));
        }
        setSaving(false);
        return;
      }
    }

    // Create new
    const clientId = generateUUID();
    const payload = {
      description: description.trim(),
      amount: parseFloat(amount),
      spending_date: spendingDate,
      client_id: clientId,
    };

    if (navigator.onLine) {
      try {
        await spendingService.create(payload);
        // cache locally
        db.spendings.add({
          client_id: clientId,
          server_id: null,
          description: payload.description,
          amount: payload.amount,
          spending_date: payload.spending_date,
          sync_status: 'synced',
          created_at: now,
        }).catch(() => {});
        await fetchSpendings();
        resetForm();
      } catch (err) {
        setSaving(false);
        alert(err.response?.data?.detail || t('spending_save_error'));
      }
    } else {
      try {
        await db.transaction('rw', db.spendings, db.sync_queue, async () => {
          await db.spendings.add({
            client_id: clientId,
            server_id: null,
            description: payload.description,
            amount: payload.amount,
            spending_date: payload.spending_date,
            sync_status: 'pending',
            created_at: now,
          });
          await db.sync_queue.add({
            client_id: clientId,
            type: 'spending',
            action: 'create',
            payload,
            status: 'pending',
            retries: 0,
            depends_on_client_id: null,
            created_at: now,
          });
        });
        syncAll();
        await fetchSpendings();
        resetForm();
      } catch (err) {
        alert(t('spending_save_error'));
      }
    }
    setSaving(false);
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setEditingClientId(s.client_id);
    setDescription(s.description);
    setAmount(String(s.amount));
    setSpendingDate(s.spending_date || today());
    setShowForm(true);
  };

  const handleDelete = async (s) => {
    if (!window.confirm(t('spending_delete_confirm'))) return;
    const now = new Date().toISOString();

    if (navigator.onLine && s.id) {
      try {
        await spendingService.delete(s.id);
        await fetchSpendings();
        return;
      } catch (err) {
        return alert(err.response?.data?.detail || t('spending_delete_error'));
      }
    }

    // Offline delete
    if (s.client_id) {
      try {
        await db.transaction('rw', db.spendings, db.sync_queue, async () => {
          if (s.id) {
            await db.sync_queue.add({
              client_id: s.client_id,
              type: 'spending',
              action: 'delete',
              payload: { server_id: s.id },
              status: 'pending',
              retries: 0,
              depends_on_client_id: null,
              created_at: now,
            });
          }
          await db.spendings.delete(s.client_id);
        });
        syncAll();
        await fetchSpendings();
      } catch (err) {
        alert(t('spending_delete_error'));
      }
    }
  };

  const [expandedIds, setExpandedIds] = useState(new Set());
  const toggleExpand = (key) =>
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const totalSpending = spendings.reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <Layout>
      <div className="space-y-6 pb-12 animate-in fade-in duration-500">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
              <TrendingDown size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-800">{t('spending')}</h2>
              <p className="text-base font-bold text-gray-400 uppercase tracking-wider">{t('spending_subtitle')}</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-2xl font-black text-base hover:bg-orange-600 active:scale-95 transition-all shadow-lg shadow-orange-100"
          >
            <Plus size={18} />
            {t('add_spending')}
          </button>
        </header>

        {!navigator.onLine && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 text-base font-bold px-4 py-3 rounded-xl">
            <WifiOff size={14} />
            {t('offline_spending_notice')}
          </div>
        )}

        {/* Summary card */}
        <div className="bg-orange-50 border border-orange-100 p-5 rounded-3xl flex items-center gap-4">
          <div className="p-3 bg-orange-500 text-white rounded-2xl">
            <TrendingDown size={22} />
          </div>
          <div>
            <span className="text-base font-black text-orange-400 uppercase block tracking-wider">{t('total_spending')}</span>
            <span className="text-2xl font-black text-orange-600">
              {totalSpending.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              <span className="text-base ml-1 font-bold opacity-50">MMK</span>
            </span>
          </div>
        </div>

        {/* Add / Edit Form */}
        {showForm && (
          <div className="bg-white p-5 rounded-3xl border-2 border-orange-200 shadow-sm space-y-4 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-gray-700 uppercase text-base tracking-widest">
                {editingId ? t('edit_spending') : t('add_spending')}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-black text-gray-400 uppercase px-1 tracking-widest">{t('spending_description')}</label>
                  <textarea
                    required
                    rows={3}
                    className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-orange-400 outline-none transition-all font-bold resize-y"
                    placeholder={t('spending_desc_placeholder')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-black text-gray-400 uppercase px-1 tracking-widest">{t('spending_amount')}</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-orange-400 outline-none transition-all font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="0"
                    value={amount}
                    onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
              <DropdownDatePicker
                label={t('spending_date')}
                value={spendingDate}
                onChange={setSpendingDate}
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full p-4 rounded-2xl text-white font-black bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={20} />
                {saving ? t('saving') : t('save_spending')}
              </button>
            </form>
          </div>
        )}

        {/* Spending list */}
        {loading ? (
          <div className="py-12 text-center text-gray-400 font-bold">{t('loading')}...</div>
        ) : spendings.length === 0 ? (
          <div className="py-16 text-center text-gray-400 font-bold bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
            {t('no_spendings')}
          </div>
        ) : (
          <div className="space-y-3">
            {spendings.map((s, i) => {
              const key = s.client_id || s.id || i;
              const isExpanded = expandedIds.has(key);
              return (
                <div
                  key={key}
                  className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
                  onClick={() => toggleExpand(key)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span className={`font-black text-gray-800 text-lg leading-tight break-words whitespace-pre-wrap ${isExpanded ? 'block' : 'line-clamp-2'}`}>
                        {s.description}
                      </span>
                      <span className="text-sm font-black text-gray-400 uppercase tracking-wider mt-1 block">
                        {s.spending_date}
                        {s.sync_status === 'pending' && (
                          <span className="ml-2 text-yellow-500">(pending sync)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xl font-black text-orange-600 tabular-nums">
                        {(s.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        <span className="text-base ml-1 font-bold opacity-50">MMK</span>
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(s); }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(s); }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Spending;
