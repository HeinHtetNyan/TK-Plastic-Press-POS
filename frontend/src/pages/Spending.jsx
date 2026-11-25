import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, TrendingDown, Save, X, WifiOff } from 'lucide-react';
import Layout from '../components/Layout';
import DropdownDatePicker from '../components/DropdownDatePicker';
import { spendingService } from '../services/api';
import Pager from '../components/Pager';
import { paginate } from '../utils/paginate';
import { syncAll } from '../services/syncService';
import db, { generateUUID } from '../lib/db';
import { shopToday } from '../utils/shopTime';
import { useLanguage } from '../context/LanguageContext';

const today = shopToday;

const Spending = () => {
  const { t } = useLanguage();
  const [spendings, setSpendings] = useState([]);
  const [spPage, setSpPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingClientId, setEditingClientId] = useState(null);
  // Several lines (what for + amount) are saved as ONE record: the description is built from the lines
  // and the amount is their sum (same shape as the existing records, so lists/totals/reports are unchanged).
  const [lines, setLines] = useState([{ what: '', amount: '' }]);
  const [spendingDate, setSpendingDate] = useState(today());
  const filledLines = lines.filter((l) => l.what.trim() || l.amount !== '');
  const lineSum = lines.reduce((a, l) => a + (parseFloat(l.amount) || 0), 0);
  const description = filledLines.length > 1
    ? filledLines.map((l) => `${l.what.trim()} = ${l.amount}`).join('\n')
    : (filledLines[0]?.what.trim() || '');
  const amount = lineSum > 0 ? String(Math.round(lineSum * 100) / 100) : '';
  const setLine = (i, patch) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const resetForm = () => {
    setEditingId(null);
    setEditingClientId(null);
    setLines([{ what: '', amount: '' }]);
    setSpendingDate(today());
    setShowForm(false);
  };

  const fetchSpendings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await spendingService.list();
      setSpendings(res.data);
    } catch {
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
      } catch {
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
    if (filledLines.length === 0 || filledLines.some((l) => !l.what.trim())) return alert(t('spending_desc_required'));
    if (filledLines.some((l) => !(parseFloat(l.amount) > 0))) return alert(t('spending_amount_required'));

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
        } catch {
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
      } catch {
        alert(t('spending_save_error'));
      }
    }
    setSaving(false);
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setEditingClientId(s.client_id);
    setLines([{ what: s.description || '', amount: String(s.amount) }]);
    setSpendingDate(s.spending_date || today());
    setShowForm(true);
  };

  // delete = confirm pop-up first (was window.confirm); the delete logic itself is unchanged
  const [confirmDel, setConfirmDel] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async (s) => {
    setDeleting(true);
    try { await doDelete(s); } finally { setDeleting(false); setConfirmDel(null); }
  };

  const doDelete = async (s) => {
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
      } catch {
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

  const inputBase = 'w-full px-3 py-3 min-h-[var(--ctl)] bg-row border border-line-strong rounded-xl focus:border-accent outline-none transition-all';
  const paged = paginate(spendings, spPage, 20);

  return (
    <Layout>
      <div className="space-y-4 pb-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-base text-muted">{t('spending_subtitle')}</p>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 bg-accent text-on-accent px-5 min-h-[52px] rounded-xl font-semibold text-base hover:opacity-90 transition-all"
          >
            <Plus size={20} />
            {t('add_spending')}
          </button>
        </div>

        {!navigator.onLine && (
          <div className="flex items-center gap-2 bg-extra-bg text-extra text-base font-medium px-4 py-3 rounded-xl">
            <WifiOff size={16} />
            {t('offline_spending_notice')}
          </div>
        )}

        {/* Total panel: total spending and the number of records, one card divided by a thin line */}
        <section className="bg-row rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-px bg-line">
            <div className="bg-row px-5 py-4 min-w-0">
              <span className="text-[length:var(--sfs)] text-muted block">{t('total_spending')}</span>
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-2xl font-semibold text-ink tabular-nums">
                  {totalSpending.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
                <span className="text-sm font-medium text-muted">MMK</span>
              </span>
            </div>
            <div className="bg-row px-5 py-4 text-right min-w-[7rem]">
              <span className="text-[length:var(--sfs)] text-muted block">{t('x_records')}</span>
              <span className="text-2xl font-semibold text-ink tabular-nums">{spendings.length.toLocaleString()}</span>
            </div>
          </div>
        </section>

        {/* Spending list */}
        {loading ? (
          <div className="py-12 text-center text-muted">{t('loading')}...</div>
        ) : spendings.length === 0 ? (
          <div className="py-16 text-center text-muted bg-row rounded-2xl shadow-sm">
            {t('no_spendings')}
          </div>
        ) : (
          <div className="bg-row rounded-2xl shadow-sm overflow-hidden divide-y divide-line">
            {paged.rows.map((s, i) => {
              const key = s.client_id || s.id || i;
              const isExpanded = expandedIds.has(key);
              return (
                <div
                  key={key}
                  className="px-4 py-2 min-h-[var(--row-h)] hover:bg-zebra transition-colors cursor-pointer"
                  onClick={() => toggleExpand(key)}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0 sm:flex-nowrap sm:grid sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:gap-x-4">
                    <span className="hidden sm:block text-sm text-muted tabular-nums">
                      {s.spending_date}
                      {s.sync_status === 'pending' && <span className="block text-extra">(pending sync)</span>}
                    </span>
                    <div className="basis-full sm:basis-auto sm:flex-1 min-w-0 py-1">
                      <span className={`font-semibold text-ink text-base leading-snug break-words whitespace-pre-wrap ${isExpanded ? 'block' : 'line-clamp-2'}`}>
                        {s.description}
                      </span>
                      <span className="sm:hidden text-sm text-muted mt-0.5 block">
                        {s.spending_date}
                        {s.sync_status === 'pending' && (
                          <span className="ml-2 text-extra">(pending sync)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
                      <span className="text-lg font-semibold text-ink tabular-nums mr-1 text-right min-w-[6.5rem]">
                        {(s.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        <span className="text-sm ml-1 font-medium text-muted">MMK</span>
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(s); }}
                        aria-label={t('edit_spending')}
                        className="w-11 h-11 flex items-center justify-center text-muted hover:text-accent hover:bg-band rounded-xl transition-all"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDel(s); }}
                        aria-label={t('delete')}
                        className="w-11 h-11 flex items-center justify-center text-debt hover:bg-debt-bg rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <Pager page={paged.page} pages={paged.pages} onChange={setSpPage} className="p-3" />
          </div>
        )}
      </div>

      {/* Add / Edit pop-up: bottom sheet on phone, centred dialog on tablet / PC */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-[var(--scrim)] flex items-end sm:items-center justify-center sm:p-4" onClick={resetForm}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? t('edit_spending') : t('add_spending')}
            className="bg-row w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-lg p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-line-strong mx-auto mb-3 sm:hidden" aria-hidden="true" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-ink text-lg">
                {editingId ? t('edit_spending') : t('add_spending')}
              </h3>
              <button onClick={resetForm} aria-label={t('x_cancel')} className="w-11 h-11 -mr-2 flex items-center justify-center text-muted hover:text-ink hover:bg-band rounded-xl">
                <X size={20} />
              </button>
            </div>
            {!navigator.onLine && (
              <p className="text-sm text-extra bg-extra-bg rounded-xl px-3 py-2 mb-3">{t('offline_spending_notice')}</p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_7.5rem_2.75rem] sm:grid-cols-[1fr_10rem_2.75rem] gap-2 px-1 text-sm font-medium text-muted">
                  <span>{t('spending_what_for')}</span><span className="text-right">{t('spending_amount')}</span><span />
                </div>
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_7.5rem_2.75rem] sm:grid-cols-[1fr_10rem_2.75rem] gap-2 items-start">
                    <textarea
                      rows={1}
                      autoFocus={i === 0}
                      aria-label={t('spending_what_for')}
                      className={`${inputBase} resize-y font-medium`}
                      placeholder={t('spending_desc_placeholder')}
                      value={l.what}
                      onChange={(e) => setLine(i, { what: e.target.value })}
                    />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      aria-label={t('spending_amount')}
                      className={`${inputBase} font-medium text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      placeholder="0"
                      value={l.amount}
                      onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                      onChange={(e) => setLine(i, { amount: e.target.value })}
                    />
                    {lines.length > 1 ? (
                      <button type="button" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} aria-label={t('x_cancel')} className="w-11 h-12 flex items-center justify-center text-debt hover:bg-debt-bg rounded-xl"><Trash2 size={18} /></button>
                    ) : <span />}
                  </div>
                ))}
                <button type="button" onClick={() => setLines((ls) => [...ls, { what: '', amount: '' }])} className="flex items-center gap-2 min-h-[48px] px-4 rounded-xl font-medium bg-row border border-line-strong text-ink">
                  <Plus size={18} /> {t('spending_add_more')}
                </button>
                <div className="flex items-baseline justify-between gap-3 rounded-xl bg-band px-4 py-3">
                  <span className="text-muted font-medium">{t('spending_sum')}</span>
                  <span className="text-2xl font-semibold tabular-nums text-ink">{lineSum.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm font-medium text-muted">MMK</span></span>
                </div>
              </div>
              <DropdownDatePicker
                label={t('spending_date')}
                value={spendingDate}
                onChange={setSpendingDate}
              />
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 min-h-[52px] px-4 rounded-xl font-medium bg-row border border-line-strong text-ink"
                >
                  {t('x_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-[1.4] min-h-[52px] px-4 rounded-xl text-on-accent font-semibold bg-ok hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save size={20} />
                  {saving ? t('saving') : t('save_spending')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm pop-up (replaces window.confirm) */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 bg-[var(--scrim)] flex items-end sm:items-center justify-center sm:p-4" onClick={() => !deleting && setConfirmDel(null)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={t('delete')}
            className="bg-row w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-lg p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-line-strong mx-auto mb-3 sm:hidden" aria-hidden="true" />
            <h3 className="font-semibold text-ink text-lg mb-1">{t('delete')}</h3>
            <p className="text-ink font-medium break-words line-clamp-2">{confirmDel.description}</p>
            <p className="text-muted tabular-nums mb-3">
              {confirmDel.spending_date} &middot; {(confirmDel.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MMK
            </p>
            <p className="text-muted mb-4">{t('spending_delete_confirm')}</p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDel(null)}
                className="flex-1 min-h-[52px] px-4 rounded-xl font-medium bg-row border border-line-strong text-ink"
              >
                {t('x_cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(confirmDel)}
                className="flex-1 min-h-[52px] px-4 rounded-xl font-semibold bg-danger text-on-danger flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Trash2 size={18} />
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Spending;
