import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Table2, List, CreditCard, ChevronDown, ChevronUp, Printer, Trash2, ArrowUpDown, Pencil, Plus, Save, X } from 'lucide-react';
import Layout from '../components/Layout';
import DropdownDatePicker from '../components/DropdownDatePicker';
import HistorySheet from '../components/HistorySheet';
import RowActions from '../components/RowActions';
import MethodPicker from '../components/MethodPicker';
import SplitPicker from '../components/SplitPicker';
import MethodTags from '../components/MethodTags';
import Combo from '../components/Combo';
import SizeInput from '../components/SizeInput';
import WasteBox from '../components/WasteBox';
import { wastesFromServer, wastesToPayload, coreTotal, wasteError } from '../utils/waste';
import Pager from '../components/Pager';
import { paginate } from '../utils/paginate';
import { usePlasticOptions } from '../hooks/usePlasticOptions';
import { paidLaterIds } from '../utils/paidLater';
import { emptyParts, splitsToParts, partsToSplits, splitError, primaryMethod } from '../utils/paymentSplits';
import { voucherService, paymentService } from '../services/api';
import { printVoucher } from '../utils/printReceipt';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import db from '../lib/db';
import { syncAll, cacheVouchers, cachePayments, loadCachedVouchers, loadCachedPayments } from '../services/syncService';

const PAYMENT_METHODS = ['CASH', 'KBZPAY', 'BANK_TRANSFER'];

const parseDateStr = (str) => {
  if (!str) return 0;
  const parts = str.split('-');
  if (parts.length === 3) {
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
  }
  return new Date(str).getTime();
};

const emptyItem = () => ({ lb: '', plastic_size: '', gate: '', plastic_price: '', color: '', print_color: '', color_price: '' });

const History = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const [printingId, setPrintingId] = useState(null);
  const handlePrint = async (e, v) => {
    e.stopPropagation();
    setPrintingId(v.id);
    try { await printVoucher(v, customer?.name || ''); }
    catch (err) { console.error('[print]', err); alert(t('x3_print_fail')); }
    finally { setPrintingId(null); }
  };
  const { options, addOption } = usePlasticOptions();
  const customer = location.state?.customer || null;
  const openVoucherId = location.state?.openVoucherId ?? null;

  const [vouchers, setVouchers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedVoucher, setExpandedVoucher] = useState(openVoucherId);
  const [pageState, setPageState] = useState({ page: 1, key: '' });
  const [expandedPayment, setExpandedPayment] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedDate, setSelectedDate] = useState('');
  // Coming from a link to one voucher: show the list view (not remembered) with that voucher open.
  const [viewMode, setViewMode] = useState(() => {
    if (location.state?.openVoucherId != null) return 'list';
    try { return localStorage.getItem('history_view') || 'sheet'; } catch { return 'sheet'; }
  });
  const changeView = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem('history_view', mode); } catch { /* storage unavailable */ }
  };
  const canEditItem = (item) => !!(item.server_id ?? (typeof item.id === 'number' ? item.id : null));

  // Edit payment modal state
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPaymentSaving, setEditPaymentSaving] = useState(false);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [editPaymentDiscountAmount, setEditPaymentDiscountAmount] = useState('');
  const [editPmtMethod, setEditPmtMethod] = useState('');
  const [editPmtSplit, setEditPmtSplit] = useState(false);
  const [editPmtParts, setEditPmtParts] = useState(emptyParts());
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [editPaymentNote, setEditPaymentNote] = useState('');

  // Edit voucher modal state
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editVoucherNumber, setEditVoucherNumber] = useState('');
  const [editVoucherDate, setEditVoucherDate] = useState('');
  const [editItems, setEditItems] = useState([emptyItem()]);
  const [editExtraChargeNote, setEditExtraChargeNote] = useState('');
  const [editExtraChargeAmount, setEditExtraChargeAmount] = useState('');
  const [editDiscountAmount, setEditDiscountAmount] = useState('');
  const [editPaidAmount, setEditPaidAmount] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('');
  const [editSplit, setEditSplit] = useState(false);
  const [editParts, setEditParts] = useState(emptyParts());
  const [editNote, setEditNote] = useState('');
  const [editWastes, setEditWastes] = useState([]);

  const loadFromCache = useCallback(async () => {
    if (!customer) return;
    const [vData, pData] = await Promise.all([
      loadCachedVouchers(customer.client_id),
      loadCachedPayments(customer.client_id),
    ]);
    setVouchers(vData);
    setPayments(pData);
  }, [customer]);

  const fetchHistory = useCallback(async () => {
    if (!customer) return;
    const serverId = customer.server_id ?? (typeof customer.id === 'number' ? customer.id : null);

    if (!serverId || !navigator.onLine) {
      await loadFromCache();
      return;
    }

    setLoading(true);
    try {
      const [vRes, pRes] = await Promise.all([
        voucherService.getCustomerVouchers(serverId),
        paymentService.getCustomerPayments(serverId),
      ]);
      const serverVouchers = (vRes.data || []).map(v => ({ ...v, client_id: v.client_id ?? `server_${v.id}` }));
      const serverPayments = (pRes.data || []).map(p => ({ ...p, client_id: p.client_id ?? `server_${p.id}` }));
      setVouchers(serverVouchers);
      setPayments(serverPayments);
      cacheVouchers(customer.client_id, vRes.data || []).catch(() => {});
      cachePayments(customer.client_id, pRes.data || []).catch(() => {});
    } catch (error) {
      console.error('Fetch history error:', error);
      await loadFromCache();
    } finally {
      setLoading(false);
    }
  }, [customer, loadFromCache]);

  // Scroll the linked voucher into view once the list has loaded.
  useEffect(() => {
    if (openVoucherId == null || loading) return;
    const el = document.getElementById(`voucher-row-${openVoucherId}`);
    if (el) el.scrollIntoView({ block: 'center' });
  }, [openVoucherId, loading, vouchers]);

  useEffect(() => {
    if (!customer) {
      navigate('/');
    } else {
      fetchHistory();
    }
  }, [customer, navigate, fetchHistory]);

  // one delete at a time: while it is on its way, further taps do nothing
  const deleting = useRef(false);
  const deleteOnce = async (job) => {
    if (deleting.current) return;
    deleting.current = true;
    try { await job(); } finally { deleting.current = false; }
  };

  const handleDeleteVoucher = (e, item) => {
    e.stopPropagation();
    return deleteOnce(() => deleteVoucher(item));
  };

  const deleteVoucher = async (item) => {
    if (!window.confirm(t('are_you_sure_delete_voucher'))) return;

    const clientId = item.client_id;
    const serverId = item.server_id ?? (typeof item.id === 'number' ? item.id : null);

    if (!serverId) {
      await db.vouchers.delete(clientId).catch(() => {});
      await db.sync_queue.where('client_id').equals(clientId).delete().catch(() => {});
      setVouchers(prev => prev.filter(v => v.client_id !== clientId));
      return;
    }

    if (!navigator.onLine) {
      try {
        await db.transaction('rw', db.vouchers, db.sync_queue, async () => {
          await db.vouchers.delete(clientId);
          await db.sync_queue.add({
            client_id: clientId,
            type: 'voucher',
            action: 'delete',
            payload: { server_id: serverId },
            status: 'pending',
            retries: 0,
            created_at: new Date().toISOString(),
          });
        });
        syncAll();
      } catch {
        // Keep the local deletion visible when sync queue cleanup fails.
      }
      setVouchers(prev => prev.filter(v => v.client_id !== clientId));
      return;
    }

    try {
      await voucherService.delete(serverId);
      db.vouchers.delete(clientId).catch(() => {});
      await fetchHistory();
    } catch {
      alert(t('error_deleting_voucher'));
    }
  };

  const handleDeletePayment = (item) => deleteOnce(() => deletePayment(item));

  const deletePayment = async (item) => {
    if (!window.confirm(t('are_you_sure_delete_payment'))) return;

    const clientId = item.client_id;
    const serverId = item.server_id ?? (typeof item.id === 'number' ? item.id : null);

    if (!serverId) {
      await db.payments.delete(clientId).catch(() => {});
      await db.sync_queue.where('client_id').equals(clientId).delete().catch(() => {});
      setPayments(prev => prev.filter(p => p.client_id !== clientId));
      return;
    }

    if (!navigator.onLine) {
      try {
        await db.transaction('rw', db.payments, db.sync_queue, async () => {
          await db.payments.delete(clientId);
          await db.sync_queue.add({
            client_id: clientId,
            type: 'payment',
            action: 'delete',
            payload: { server_id: serverId },
            status: 'pending',
            retries: 0,
            created_at: new Date().toISOString(),
          });
        });
        syncAll();
      } catch {
        // Keep the local deletion visible when sync queue cleanup fails.
      }
      setPayments(prev => prev.filter(p => p.client_id !== clientId));
      return;
    }

    try {
      await paymentService.delete(serverId);
      db.payments.delete(clientId).catch(() => {});
      await fetchHistory();
    } catch {
      alert(t('error_deleting_payment'));
    }
  };

  const openEditPaymentModal = (e, item) => {
    e.stopPropagation();
    setEditingPayment(item);
    setEditPaymentAmount(String(item.amount_paid));
    setEditPaymentDiscountAmount(item.discount_amount > 0 ? String(item.discount_amount) : '');
    setEditPmtMethod(item.payment_method || '');
    setEditPmtSplit(!!item.payment_splits?.length);
    setEditPmtParts(splitsToParts(item.payment_splits));
    setEditPaymentDate(item.payment_date || '');
    setEditPaymentNote(item.note || '');
  };

  const closeEditPaymentModal = () => setEditingPayment(null);

  const handleSavePaymentEdit = async () => {
    if (!editingPayment) return;
    const serverId = editingPayment.server_id ?? (typeof editingPayment.id === 'number' ? editingPayment.id : null);
    if (!serverId) {
      alert('This payment has not been synced yet. Edit is only available for synced payments.');
      return;
    }
    if (!navigator.onLine) {
      alert('You are offline. Please connect to the internet to edit a payment.');
      return;
    }
    const amount = parseFloat(editPaymentAmount);
    if (!amount || amount <= 0) {
      alert('Amount must be greater than 0.');
      return;
    }
    if ((parseFloat(editPaymentDiscountAmount) || 0) < 0) {
      alert(t('x2_no_negative'));
      return;
    }
    let pmtSplits = [];
    let pmtMethod = editPmtMethod || null;
    if (editPmtSplit) {
      const err = splitError(editPmtParts, amount);
      if (err) {
        alert(t(err));
        return;
      }
      pmtSplits = partsToSplits(editPmtParts);
      pmtMethod = primaryMethod(pmtSplits);
    }
    const payload = {
      amount_paid: amount,
      discount_amount: parseFloat(editPaymentDiscountAmount) || 0,
      payment_method: pmtMethod,
      payment_splits: pmtSplits,
      payment_date: editPaymentDate || null,
      note: editPaymentNote || null,
    };
    setEditPaymentSaving(true);
    try {
      await paymentService.update(serverId, payload);
      closeEditPaymentModal();
      fetchHistory();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      alert(detail || 'Failed to save payment. Please try again.');
    } finally {
      setEditPaymentSaving(false);
    }
  };

  const openEditModal = (e, item) => {
    e.stopPropagation();
    setEditingVoucher(item);
    setEditVoucherNumber(item.voucher_number || '');
    setEditVoucherDate(item.voucher_date || '');
    setEditItems(
      item.items && item.items.length > 0
        ? item.items.map(it => ({
            lb: String(it.lb),
            plastic_size: it.plastic_size,
            gate: it.gate || '',
            print_color: it.print_color || '',
            plastic_price: String(it.plastic_price),
            color: it.color,
            color_price: String(it.color_price),
          }))
        : [emptyItem()]
    );
    setEditExtraChargeNote(item.extra_charge_note || '');
    setEditExtraChargeAmount(item.extra_charge_amount > 0 ? String(item.extra_charge_amount) : '');
    setEditDiscountAmount(item.discount_amount > 0 ? String(item.discount_amount) : '');
    setEditPaidAmount(item.paid_amount > 0 ? String(item.paid_amount) : '');
    setEditPaymentMethod(item.payment_method || '');
    setEditSplit(!!item.payment_splits?.length);
    setEditParts(splitsToParts(item.payment_splits));
    setEditNote(item.note || '');
    // an old voucher (made before core/damage took stock) only has the core number: show it as a core entry to fill in
    setEditWastes(item.wastes?.length ? wastesFromServer(item.wastes)
      : (item.core_weight_lb > 0 ? [{ kind: 'CORE', lb: String(item.core_weight_lb), size: '', color: '', gate: '' }] : []));
  };

  const closeEditModal = () => {
    setEditingVoucher(null);
  };

  const handleEditItemChange = (idx, field, value) => {
    setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const addEditItem = () => setEditItems(prev => [...prev, emptyItem()]);

  const removeEditItem = (idx) => {
    if (editItems.length === 1) return;
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveEdit = async () => {
    if (!editingVoucher) return;
    const serverId = editingVoucher.server_id ?? (typeof editingVoucher.id === 'number' ? editingVoucher.id : null);
    if (!serverId) {
      alert('This voucher has not been synced yet. Edit is only available for synced vouchers.');
      return;
    }
    if (!navigator.onLine) {
      alert('You are offline. Please connect to the internet to edit a voucher.');
      return;
    }

    const parsedItems = editItems.map(it => ({
      lb: parseFloat(it.lb) || 0,
      plastic_size: it.plastic_size,
      gate: it.gate || null,
      print_color: it.print_color || null,
      plastic_price: parseFloat(it.plastic_price) || 0,
      color: it.color,
      color_price: parseFloat(it.color_price) || 0,
    }));

    if (parsedItems.some(it => it.lb <= 0)) {
      alert('Each item must have a weight (LB) greater than 0.');
      return;
    }

    const wErr = (editingVoucher.wastes?.length || editWastes.length) ? wasteError(editWastes) : null;
    if (wErr) {
      alert(t(wErr));
      return;
    }

    const paidNow = parseFloat(editPaidAmount) || 0;
    let voucherSplits = [];
    let voucherMethod = editPaymentMethod || null;
    if (editSplit && paidNow > 0) {
      const err = splitError(editParts, paidNow);
      if (err) {
        alert(t(err));
        return;
      }
      voucherSplits = partsToSplits(editParts);
      voucherMethod = primaryMethod(voucherSplits);
    }
    const payload = {
      voucher_number: editVoucherNumber,
      voucher_date: editVoucherDate || null,
      items: parsedItems,
      extra_charge_note: editExtraChargeNote || null,
      extra_charge_amount: parseFloat(editExtraChargeAmount) || 0,
      discount_amount: parseFloat(editDiscountAmount) || 0,
      paid_amount: parseFloat(editPaidAmount) || 0,
      payment_method: voucherMethod,
      payment_splits: voucherSplits,
      note: editNote || null,
      core_weight_lb: coreTotal(editWastes),
      wastes: wastesToPayload(editWastes),
    };

    setEditSaving(true);
    try {
      const saved = await voucherService.update(serverId, payload);
      closeEditModal();
      const warnings = saved?.data?.stock_warnings || [];
      if (warnings.length) alert(`${t('stock_warning_title')}\n\n${warnings.join('\n')}`);
      fetchHistory();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      alert(detail || 'Failed to save voucher. Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  const editItemsTotal = editItems.reduce((sum, it) => {
    const lb = parseFloat(it.lb) || 0;
    const pp = parseFloat(it.plastic_price) || 0;
    const cp = parseFloat(it.color_price) || 0;
    return sum + lb * (pp + cp);
  }, 0);
  const editExtraCharge = parseFloat(editExtraChargeAmount) || 0;
  const editDiscount = parseFloat(editDiscountAmount) || 0;
  const editPaid = parseFloat(editPaidAmount) || 0;
  const editPrevBalance = editingVoucher?.previous_balance || 0;
  const editFinalTotal = editItemsTotal + editExtraCharge - editDiscount + editPrevBalance;
  const editRemaining = editFinalTotal - editPaid;

  // Same rule as the backend customer balance: all vouchers minus all payments (date filter does not apply).
  const owesNow =
    vouchers.reduce((a, v) => a + (v.items_total || 0) + (v.extra_charge_amount || 0) - (v.discount_amount || 0) - (v.paid_amount || 0), 0) -
    payments.reduce((a, p) => a + (p.amount_paid || 0) + (p.discount_amount || 0), 0);
  const owesRounded = Math.round(owesNow * 100) / 100;
  const paidLater = paidLaterIds(vouchers, payments);

  const filteredData = [
    ...vouchers.map(v => ({ ...v, type: 'voucher' })),
    ...payments.map(p => ({ ...p, type: 'payment' }))
  ].filter(item => {
    if (!selectedDate) return true;
    const itemDate = item.type === 'voucher' ? item.voucher_date : item.payment_date;
    return itemDate === selectedDate;
  }).sort((a, b) => {
    const aDate = parseDateStr(a.type === 'voucher' ? a.voucher_date : a.payment_date);
    const bDate = parseDateStr(b.type === 'voucher' ? b.voucher_date : b.payment_date);
    return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
  });

  // Page resets to 1 whenever the date filter or sort order changes; a link to one voucher opens the page that holds it.
  const HIST_PAGE = 25;
  const pageKey = `${selectedDate}|${sortOrder}`;
  const linkedIndex = openVoucherId != null ? filteredData.findIndex(r => r.type === 'voucher' && r.id === openVoucherId) : -1;
  const wantedPage = pageState.key === pageKey ? pageState.page : (linkedIndex >= 0 && !pageState.key ? Math.floor(linkedIndex / HIST_PAGE) + 1 : 1);
  const paged = paginate(filteredData, wantedPage, HIST_PAGE);
  const goPage = (p) => setPageState({ page: p, key: pageKey });

  return (
    <Layout wide={viewMode === 'sheet'}>
      <div className="space-y-4 pb-12 animate-in slide-in-from-right-4 duration-500">
        {/* One grouped panel: customer header, the three totals, then the filters. Thin lines divide the parts. */}
        {(() => {
          const hasRecords = !loading && (vouchers.length > 0 || payments.length > 0);
          const billedAll = filteredData.reduce((a, r) => a + (r.type === 'voucher' ? r.items_total || 0 : 0), 0);
          const paidAll = filteredData.reduce((a, r) => a + (r.type === 'voucher' ? r.paid_amount || 0 : r.amount_paid || 0), 0);
          const f = (n) => Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
          return (
            <section className="bg-row rounded-2xl shadow-sm overflow-hidden">
              <header className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => navigate('/', { state: { customer: customer } })} aria-label={t('back') || 'Back'} className="w-12 h-12 flex items-center justify-center bg-row rounded-lg border border-line-strong hover:bg-band transition-all">
              <ArrowLeft size={20} className="text-muted" />
            </button>
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-muted block leading-tight">{customer ? `${t('history')} \u00b7 ${t('customer')}` : t('history')}</span>
                  <h2 className="text-xl font-semibold text-ink truncate leading-snug">{customer ? customer.name : t('history')}</h2>
                </div>
              </header>
              {hasRecords && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line border-t border-line">
                  <div className="bg-row px-4 sm:px-5 py-3 min-w-0 flex items-baseline justify-between gap-3 sm:block"><span className="block text-sm text-muted">{t('voucher_total')}</span><span className="block text-xl sm:text-2xl font-semibold text-ink tabular-nums leading-tight">{f(billedAll)}</span></div>
                  <div className="bg-row px-4 sm:px-5 py-3 min-w-0 flex items-baseline justify-between gap-3 sm:block"><span className="block text-sm text-muted">{t('x2_paid')}</span><span className="block text-xl sm:text-2xl font-semibold text-ok tabular-nums leading-tight">{f(paidAll)}</span></div>
                  <div className={`px-4 sm:px-5 py-3 min-w-0 flex items-baseline justify-between gap-3 sm:block ${owesRounded > 0 ? 'bg-debt-bg' : 'bg-row'}`}><span className="block text-sm text-muted">{owesRounded < 0 ? t('credit') : t('owes_now')}</span><span className={`block text-xl sm:text-2xl font-semibold tabular-nums leading-tight ${owesRounded > 0 ? 'text-debt' : 'text-ok'}`}>{f(owesRounded)}</span></div>
                </div>
              )}
              <div className="border-t border-line px-4 py-3 flex flex-wrap items-end gap-3">
                <div className="flex items-end gap-2 flex-1 min-w-[min(100%,320px)]">
                  <div className="flex-1 min-w-0">
                    <DropdownDatePicker
                      label={t('specific_date_search')}
                      value={selectedDate}
                      onChange={(val) => { setSelectedDate(val); if (val) setExpandedVoucher(null); }}
                    />
                  </div>
                  {selectedDate && (
                    <button
                      onClick={() => setSelectedDate('')}
                      className="flex items-center gap-1 text-base font-semibold text-debt bg-debt-bg px-3 min-h-[48px] rounded-lg border border-debt/30 hover:opacity-80 transition-all"
                    >
                      <X size={14} /> {t('clear') || 'Clear'}
                    </button>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap max-[599px]:w-full max-[599px]:flex-col">
                  <div className="flex rounded-xl overflow-hidden border border-line-strong bg-row max-[599px]:w-full">
                    <button onClick={() => changeView('sheet')} className={`flex items-center justify-center gap-2 text-base font-semibold px-4 min-h-[48px] transition-all max-[599px]:flex-1 min-w-[96px] ${viewMode === 'sheet' ? 'bg-accent text-on-accent' : 'text-ink hover:bg-band'}`}>
                      <Table2 size={18} /> {t('x2_sheet')}
                    </button>
                    <button onClick={() => changeView('list')} className={`flex items-center justify-center gap-2 text-base font-semibold px-4 min-h-[48px] transition-all max-[599px]:flex-1 min-w-[96px] ${viewMode === 'list' ? 'bg-accent text-on-accent' : 'text-ink hover:bg-band'}`}>
                      <List size={18} /> {t('x2_list')}
                    </button>
                  </div>
                  <button
                    onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center justify-center gap-2 text-base font-semibold text-ink bg-row px-4 min-h-[48px] rounded-xl border border-line-strong hover:bg-band transition-all max-[599px]:w-full"
                  >
                    <ArrowUpDown size={18} />
                    {sortOrder === 'asc' ? t('oldest_first') : t('newest_first')}
                  </button>
                </div>
              </div>
            </section>
          );
        })()}

        {viewMode === 'sheet' && !loading && filteredData.length > 0 ? (
          <HistorySheet
            rows={paged.rows}
            allRows={filteredData}
            paidLater={paidLater}
            isAdmin={isAdmin()}
            canEdit={canEditItem}
            onEditVoucher={openEditModal}
            onDeleteVoucher={handleDeleteVoucher}
            onEditPayment={openEditPaymentModal}
            onDeletePayment={handleDeletePayment}
          onPrint={handlePrint}
            printingId={printingId}
            />
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
          {loading ? (
            <div className="col-span-full text-center py-12 text-muted font-bold text-base uppercase tracking-widest animate-pulse">{t('refreshing_records')}</div>
          ) : filteredData.length > 0 ? (
            paged.rows.map((item) => (
              <div key={`${item.type}-${item.id}`} id={`${item.type}-row-${item.id}`} className="bg-row rounded-2xl shadow-sm overflow-hidden animate-in fade-in transition-all">
                {item.type === 'voucher' ? (
                  <>
                    <div
                      onClick={() => setExpandedVoucher(expandedVoucher === item.id ? null : item.id)}
                      className="px-3 py-3 min-h-[68px] flex justify-between items-center gap-2 cursor-pointer hover:bg-zebra"
                    >
                      <div className="flex gap-3 items-center min-w-0">
                        <div className="w-9 h-9 flex items-center justify-center bg-band text-accent rounded-xl shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-black text-ink text-base">{item.voucher_number}</span>
                            <span className="text-sm bg-band px-2 py-0.5 rounded-lg font-semibold text-muted whitespace-nowrap">{item.voucher_date}</span>
                            {item.sync_status === 'pending' && (
                              <span className="text-base bg-extra-bg text-extra px-1.5 py-0.5 rounded font-black uppercase">{t('x2_pending')}</span>
                            )}
                            {item.paid_amount > 0 && item.payment_method && <MethodTags row={item} className="!text-base" />}
                          </div>
                          <p className="text-base text-muted">{item.items?.length || 0} {t('products')}</p>
                          
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div className="block text-right">
                          <span className="text-sm text-muted block leading-tight">{t('remaining')}</span>
                          <span className={`text-base font-semibold tabular-nums ${item.remaining_balance > 0 ? 'text-debt' : 'text-ok'}`}>
                            {item.remaining_balance.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 items-end sm:flex-row sm:items-center sm:gap-2 ml-2">
                          <div className="order-1 sm:order-2">
                            <span className="inline-flex items-center gap-1 text-sm text-muted"><span className="hidden sm:inline">{t('x_details')}</span>{expandedVoucher === item.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="px-3 pb-3">
                      <button
                        type="button"
                        disabled={printingId === item.id}
                        onClick={(e) => handlePrint(e, item)}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent text-on-accent text-lg font-black disabled:opacity-60"
                      >
                        <Printer size={22} /> {printingId === item.id ? t('x3_print_wait') : t('x3_print')}
                      </button>
                    </div>
                    {isAdmin() && (
                      <div className="px-3 pb-3">
                        <RowActions
                          horizontal
                          onEdit={canEditItem(item) ? (e) => openEditModal(e, item) : null}
                          onDelete={(e) => handleDeleteVoucher(e, item)}
                        />
                      </div>
                    )}
                    {expandedVoucher === item.id && (
                      <div className="bg-zebra p-3 border-t border-line space-y-3 animate-in slide-in-from-top-2">
                        {item.wastes?.length > 0 ? item.wastes.map((w) => (
                          <div key={w.id} className={`${w.kind === 'CORE' ? 'bg-extra-bg border-extra/30' : 'bg-debt-bg border-debt/30'} p-2 rounded-xl border flex justify-between items-center gap-2`}>
                            <span className={`text-base font-black uppercase ${w.kind === 'CORE' ? 'text-extra' : 'text-debt'}`}>{w.kind === 'CORE' ? t('core_weight') : t('damage_weight')}
                              <span className="block text-sm font-bold normal-case text-muted">{[w.size, w.color, w.gate].filter(Boolean).join(' / ')}</span></span>
                            <span className={`text-lg font-black ${w.kind === 'CORE' ? 'text-extra' : 'text-debt'}`}>{w.lb} <span className="text-base text-muted">lb</span></span>
                          </div>
                        )) : item.core_weight_lb > 0 && (
                          <div className="bg-extra-bg p-2 rounded-xl border border-extra/30 flex justify-between items-center">
                            <span className="text-base font-black text-extra uppercase">{t('core_weight')}</span>
                            <span className="text-lg font-black text-extra">{item.core_weight_lb} <span className="text-base text-muted">lb</span></span>
                          </div>
                        )}
                        {item.note && (
                          <div className="bg-band/50 p-2 rounded-xl border border-line">
                            <span className="text-base font-black text-accent uppercase block leading-none mb-1">{t('note')}</span>
                            <p className="text-base font-bold text-accent leading-tight italic">"{item.note}"</p>
                          </div>
                        )}
                        <div className="bg-row rounded-xl border border-line overflow-hidden divide-y divide-line">
                          {item.items?.map((it, idx) => (
                            <div key={idx} className="p-3 space-y-1.5 font-bold text-ink">
                              <div className="text-base text-accent break-words">{it.lb} {t('weight_lb').split(' ')[1] || 'LB'} - {it.plastic_size}{it.gate ? ` / ${it.gate}` : ''} ({it.color}{it.print_color ? ` + ${it.print_color}` : ''})</div>
                              <div className="text-sm sm:text-base text-muted uppercase flex justify-between items-start gap-3">
                                <span className="min-w-0 break-words">{t('plastic')}: {it.lb} {t('weight_lb').split(' ')[1] || 'LB'} × {it.plastic_price} {t('price')}</span>
                                <span className="font-black text-ink whitespace-nowrap shrink-0">{(it.lb * it.plastic_price).toLocaleString()}</span>
                              </div>
                              <div className="text-sm sm:text-base text-muted uppercase flex justify-between items-start gap-3">
                                <span className="min-w-0 break-words">{t('color')}: {it.lb} {t('weight_lb').split(' ')[1] || 'LB'} × {it.color_price} {t('price')}</span>
                                <span className="font-black text-ink whitespace-nowrap shrink-0">{(it.lb * it.color_price).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-baseline gap-3 pt-1.5 border-t border-line uppercase">
                                <span className="text-sm text-muted font-medium">{t('price')}: {it.plastic_price + it.color_price}</span>
                                <span className="text-lg text-accent font-black whitespace-nowrap">{t('total')}: {(it.total_price || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className={`grid gap-2 text-base font-black uppercase text-center ${(item.extra_charge_amount > 0 ? 1 : 0) + (item.discount_amount > 0 ? 1 : 0) === 2 ? 'grid-cols-2 sm:grid-cols-5' : (item.extra_charge_amount > 0 || item.discount_amount > 0) ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                          <div className="bg-row p-2 rounded-lg border border-line shadow-sm">
                            <span className="text-muted block mb-1">{t('voucher_total')}</span>
                            <span className="text-ink text-base">{item.items_total.toLocaleString()}</span>
                          </div>
                          {item.extra_charge_amount > 0 && (
                            <div className="bg-extra-bg p-2 rounded-lg border border-extra/30 shadow-sm">
                              <span className="text-muted block mb-1 tracking-tighter truncate">{item.extra_charge_note || 'Extra'}</span>
                              <span className="text-extra text-base">+{item.extra_charge_amount.toLocaleString()}</span>
                            </div>
                          )}
                          {item.discount_amount > 0 && (
                            <div className="bg-debt-bg p-2 rounded-lg border border-debt/30 shadow-sm">
                              <span className="text-muted block mb-1 tracking-tighter truncate">{t('discount')}</span>
                              <span className="text-debt text-base">-{item.discount_amount.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="bg-row p-2 rounded-lg border border-extra/30 shadow-sm">
                            <span className="text-muted block mb-1 tracking-tighter">{t('previous_balance')}</span>
                            <span className={`text-base ${item.previous_balance > 0 ? 'text-extra' : 'text-muted'}`}>
                              {item.previous_balance.toLocaleString()}
                            </span>
                          </div>
                          <div className="bg-row p-2 rounded-lg border border-line shadow-sm">
                            <span className="text-muted block mb-1 tracking-tighter">{t('paid_at_site')}</span>
                            <span className="text-ok text-base">{item.paid_amount.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-base font-black uppercase ${item.remaining_balance > 0 ? 'bg-debt-bg border-debt/30' : 'bg-ok-bg border-ok/30'}`}>
                          <span className="text-muted tracking-widest">{t('overall_total')}</span>
                          <span className="text-base flex items-center gap-1 text-muted font-bold normal-case tracking-normal">
                            {item.items_total.toLocaleString()}
                            {item.extra_charge_amount > 0 && <> + {item.extra_charge_amount.toLocaleString()}</>}
                            {item.discount_amount > 0 && <> − {item.discount_amount.toLocaleString()}</>}
                            {' '}+ {item.previous_balance.toLocaleString()} − {item.paid_amount.toLocaleString()} =
                            <span className={`font-black text-base ${item.remaining_balance > 0 ? 'text-debt' : 'text-ok'}`}>
                              {item.remaining_balance.toLocaleString()}
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div
                      onClick={() => setExpandedPayment(expandedPayment === item.id ? null : item.id)}
                      className="px-3 py-3 min-h-[68px] flex justify-between items-center gap-2 cursor-pointer hover:bg-zebra"
                    >
                      <div className="flex gap-3 items-center min-w-0">
                        <div className="w-9 h-9 flex items-center justify-center bg-ok-bg text-ok rounded-xl shrink-0">
                          <CreditCard size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-black text-ok text-base">{t('direct_payment')}</span>
                            <span className="text-sm bg-band px-2 py-0.5 rounded-lg font-semibold text-muted whitespace-nowrap">{item.payment_date}</span>
                            {item.sync_status === 'pending' && (
                              <span className="text-base bg-extra-bg text-extra px-1.5 py-0.5 rounded font-black uppercase">{t('x2_pending')}</span>
                            )}
                            {item.payment_method && <MethodTags row={item} className="!text-base" />}
                          </div>
                          {item.note && <p className="text-base text-muted italic truncate max-w-[200px]">"{item.note}"</p>}
                          
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right block">
                          <span className="text-sm text-muted block leading-tight mb-0.5">{t('amount_paid')}</span>
                          <span className="font-black text-ok text-xl leading-none whitespace-nowrap">
                            {item.amount_paid.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="inline-flex items-center gap-1 text-sm text-muted"><span className="hidden sm:inline">{t('x_details')}</span>{expandedPayment === item.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
                        </div>
                      </div>
                    </div>
                    {isAdmin() && (
                      <div className="px-3 pb-3">
                        <RowActions
                          horizontal
                          accent="green"
                          onEdit={canEditItem(item) ? (e) => openEditPaymentModal(e, item) : null}
                          onDelete={(e) => { e.stopPropagation(); handleDeletePayment(item); }}
                        />
                      </div>
                    )}
                    {expandedPayment === item.id && (
                      <div className="bg-zebra p-3 border-t border-line space-y-3 animate-in slide-in-from-top-2">
                        {item.note && (
                          <div className="bg-ok-bg/50 p-2 rounded-xl border border-ok/30">
                            <span className="text-base font-black text-ok uppercase block leading-none mb-1">{t('note')}</span>
                            <p className="text-base font-bold text-ok leading-tight italic">"{item.note}"</p>
                          </div>
                        )}
                        <div className={`grid gap-2 text-base font-black uppercase text-center ${item.discount_amount > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                          <div className="bg-row p-2 rounded-lg border border-line shadow-sm">
                            <span className="text-muted block mb-1">{t('payment_method') || 'METHOD'}</span>
                            <span className="flex flex-wrap justify-center gap-1">{item.payment_method ? <MethodTags row={item} className="!text-base" /> : '-'}</span>
                          </div>
                          <div className="bg-row p-2 rounded-lg border border-line shadow-sm">
                            <span className="text-muted block mb-1">{t('amount_paid')}</span>
                            <span className="text-ok text-base">{item.amount_paid.toLocaleString()}</span>
                          </div>
                          {item.discount_amount > 0 && (
                            <div className="bg-debt-bg p-2 rounded-lg border border-debt/30 shadow-sm">
                              <span className="text-muted block mb-1">{t('discount')}</span>
                              <span className="text-debt text-base">-{item.discount_amount.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 rounded-lg border bg-ok-bg border-ok/30 text-xs font-black uppercase">
                          <span className="text-muted tracking-widest">{t('amount_paid')}</span>
                          <span className="font-black text-base text-ok">
                            {item.discount_amount > 0
                              ? `${item.amount_paid.toLocaleString()} + ${item.discount_amount.toLocaleString()} = ${(item.amount_paid + item.discount_amount).toLocaleString()}`
                              : item.amount_paid.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-muted bg-row rounded-3xl border-2 border-dashed border-line text-base font-bold animate-in zoom-in duration-300">
              {t('no_activity_found')}
            </div>
          )}
        </div>
        )}

        {!loading && (
          <div className="space-y-1">
            {filteredData.length > HIST_PAGE && <p className="text-center text-sm font-bold text-muted">{filteredData.length} records</p>}
            <Pager page={paged.page} pages={paged.pages} onChange={goPage} />
          </div>
        )}
      </div>

      {/* Edit Payment Modal */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center lg:items-stretch justify-center lg:justify-end bg-[var(--scrim)] p-0 sm:p-4 lg:p-0">
          <div className="bg-row w-full h-[92dvh] rounded-t-3xl shadow-xl flex flex-col sm:h-auto sm:max-w-md sm:rounded-2xl sm:max-h-[92vh] lg:max-w-[440px] lg:h-[100dvh] lg:max-h-none lg:rounded-none lg:rounded-l-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-line shrink-0">
              <div>
                <h3 className="text-base font-black text-ink">{t('x2_edit_payment')}</h3>
                <p className="text-sm text-muted font-bold uppercase tracking-widest">{editingPayment.payment_date}</p>
              </div>
              <button onClick={closeEditPaymentModal} className="p-3 rounded-xl bg-band text-muted transition-all">
                <X size={22} />
              </button>
            </div>

            <div className="overflow-y-auto overflow-x-hidden flex-1 px-4 sm:px-5 py-4 space-y-5">
              {/* Amount */}
              <div>
                <label className="text-base font-black text-muted uppercase tracking-widest block mb-1">{t('amount_paid')}</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={editPaymentAmount}
                  onChange={e => setEditPaymentAmount(e.target.value)}
                  className="w-full min-h-[48px] px-3 bg-row border border-line-strong rounded-lg font-bold text-lg leading-normal outline-none focus:border-ok"
                />
              </div>

              {/* Discount */}
              <div>
                <label className="text-sm font-black text-debt uppercase tracking-widest block mb-1">{t('discount')} ({t('optional')})</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={editPaymentDiscountAmount}
                  onChange={e => setEditPaymentDiscountAmount(e.target.value)}
                  className="w-full p-2.5 bg-debt-bg border border-debt/40 rounded-xl font-bold text-base outline-none focus:border-debt"
                />
              </div>

              {/* Method & Date */}
              <div className="space-y-4">
                <div>
                  <label className="text-base font-black text-muted uppercase tracking-widest block mb-2">{t('payment_method') || 'Method'}</label>
                  <SplitPicker total={editPaymentAmount} split={editPmtSplit} onSplitChange={setEditPmtSplit} parts={editPmtParts} onParts={setEditPmtParts} method={editPmtMethod}
                    single={<MethodPicker value={editPmtMethod} onChange={setEditPmtMethod} />} />
                </div>
                <DropdownDatePicker
                  label={t('date') || 'Date'}
                  value={editPaymentDate}
                  onChange={setEditPaymentDate}
                />
              </div>

              {/* Note */}
              <div>
                <label className="text-base font-black text-muted uppercase tracking-widest block mb-1">{t('note') || 'Note'}</label>
                <textarea
                  value={editPaymentNote}
                  onChange={e => setEditPaymentNote(e.target.value)}
                  rows={3}
                  className="w-full min-h-[48px] px-3 bg-row border border-line-strong rounded-lg font-bold text-lg leading-normal outline-none focus:border-ok resize-none"
                />
              </div>

              {/* Summary */}
              <div className="bg-ok-bg rounded-xl p-3 border border-ok/30 text-sm font-black uppercase space-y-1">
                <div className="flex justify-between text-ok">
                  <span>{t('amount_paid')}</span>
                  <span className="text-base">{(parseFloat(editPaymentAmount) || 0).toLocaleString()}</span>
                </div>
                {parseFloat(editPaymentDiscountAmount) > 0 && (
                  <div className="flex justify-between text-debt">
                    <span>{t('discount')}</span>
                    <span className="text-base">-{(parseFloat(editPaymentDiscountAmount) || 0).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-line flex gap-4 shrink-0">
              <button onClick={closeEditPaymentModal} className="flex-1 py-4 rounded-lg border border-line-strong font-semibold text-ink text-base hover:bg-zebra transition-all">
                Cancel
              </button>
              <button
                onClick={handleSavePaymentEdit}
                disabled={editPaymentSaving || !editPaymentAmount}
                className="flex-1 py-4 rounded-2xl bg-ok text-on-accent font-black text-base flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={15} />
                {editPaymentSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Voucher Modal */}
      {editingVoucher && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center lg:items-stretch justify-center lg:justify-end bg-[var(--scrim)] p-0 sm:p-4 lg:p-0">
          <div className="bg-row w-full h-[92dvh] rounded-t-3xl shadow-xl flex flex-col sm:h-auto sm:max-w-lg sm:rounded-2xl sm:max-h-[92vh] lg:max-w-[520px] lg:h-[100dvh] lg:max-h-none lg:rounded-none lg:rounded-l-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-line shrink-0">
              <div>
                <h3 className="text-base font-black text-ink">{t('x2_edit_voucher')}</h3>
                <p className="text-sm text-muted font-bold uppercase tracking-widest">{editingVoucher.voucher_number}</p>
              </div>
              <button onClick={closeEditModal} className="p-3 rounded-xl bg-band text-muted transition-all">
                <X size={22} />
              </button>
            </div>

            <div className="overflow-y-auto overflow-x-hidden flex-1 px-4 sm:px-5 py-4 space-y-5">
              {/* Voucher Number & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-base font-black text-muted uppercase tracking-widest block mb-1">{t('x2_voucher_no')}</label>
                  <input
                    type="text"
                    value={editVoucherNumber}
                    onChange={e => setEditVoucherNumber(e.target.value)}
                    className="w-full min-h-[48px] px-3 bg-row border border-line-strong rounded-lg font-bold text-lg leading-normal outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <DropdownDatePicker
                    label={t('date') || 'Date'}
                    value={editVoucherDate}
                    onChange={setEditVoucherDate}
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-base font-black text-muted uppercase tracking-widest">{t('products') || 'Items'}</label>
                  <button onClick={addEditItem} className="flex items-center gap-1 text-sm font-black text-accent bg-band px-2 py-1 rounded-lg border border-line hover:opacity-80 transition-all">
                    <Plus size={10} /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {editItems.map((it, idx) => (
                    <div key={idx} className="bg-zebra rounded-xl p-2.5 border border-line space-y-2 relative">
                      {editItems.length > 1 && (
                        <button onClick={() => removeEditItem(idx)} className="absolute top-2 right-2 p-2 text-muted hover:text-debt transition-all">
                          <X size={20} />
                        </button>
                      )}
                      <div>
                        <label className="text-sm font-black text-muted uppercase block mb-0.5">{t('size')}</label>
                        <SizeInput placeholder={t('pick_or_type')} addLabel={t('add_new')} secondPlaceholder={t('size_second')} sizes={options.sizes} value={it.plastic_size}
                          onChange={v => handleEditItemChange(idx, 'plastic_size', v)} addOption={addOption} className="!p-3 !bg-row !border-line text-lg" />
                      </div>
                      <div>
                        <label className="text-sm font-black text-muted uppercase block mb-0.5">{t('gate')}</label>
                        <Combo placeholder={t('pick_or_type')} addLabel={t('add_new')} options={options.gates} value={it.gate}
                          onChange={v => handleEditItemChange(idx, 'gate', v)} onAdd={n => addOption('GATE', n)} className="!p-3 !bg-row !border-line text-lg" />
                      </div>
                      <div>
                        <label className="text-sm font-black text-muted uppercase block mb-0.5">{t('plastic_color')}</label>
                        <Combo placeholder={t('pick_or_type')} addLabel={t('add_new')} options={options.colors} value={it.color}
                          onChange={v => handleEditItemChange(idx, 'color', v)} onAdd={n => addOption('COLOR', n)} className="!p-3 !bg-row !border-line text-lg" />
                      </div>
                      <div>
                        <label className="text-xs font-black text-muted uppercase block mb-0.5">{t('print_color')}</label>
                        <Combo placeholder={t('pick_or_type')} addLabel={t('add_new')} options={options.prints || []} value={it.print_color}
                          onChange={v => handleEditItemChange(idx, 'print_color', v)} onAdd={n => addOption('PRINT', n)} className="!p-3 !bg-row !border-line text-lg" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="min-w-0">
                          <label className="text-sm font-black text-muted uppercase block mb-0.5">{t('x_lb')}</label>
                          <input type="number" step="any" inputMode="decimal" value={it.lb} onChange={e => handleEditItemChange(idx, 'lb', e.target.value)}
                            className="w-full p-3 bg-row border border-line-strong rounded-xl text-lg font-bold outline-none focus:border-accent" />
                        </div>
                        <div className="min-w-0">
                          <label className="text-sm font-black text-muted uppercase block mb-0.5">{t('plastic_price')}</label>
                          <input type="number" step="any" inputMode="decimal" value={it.plastic_price} onChange={e => handleEditItemChange(idx, 'plastic_price', e.target.value)}
                            className="w-full p-3 bg-row border border-line-strong rounded-xl text-lg font-bold outline-none focus:border-accent" />
                        </div>
                        <div className="min-w-0">
                          <label className="text-sm font-black text-muted uppercase block mb-0.5">{t('color_price')}</label>
                          <input type="number" step="any" inputMode="decimal" value={it.color_price} onChange={e => handleEditItemChange(idx, 'color_price', e.target.value)}
                            className="w-full p-3 bg-row border border-line-strong rounded-xl text-lg font-bold outline-none focus:border-accent" />
                        </div>
                      </div>
                      {(parseFloat(it.lb) > 0) && (
                        <div className="text-right text-base font-black text-accent">
                          = {((parseFloat(it.lb) || 0) * ((parseFloat(it.plastic_price) || 0) + (parseFloat(it.color_price) || 0))).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Extra Charge */}
              <div className="border-2 border-dashed border-extra/30 rounded-xl p-3 space-y-2">
                <label className="text-sm font-black text-extra uppercase tracking-widest block">{t('x2_extra_charge')} ({t('optional')})</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-black text-muted uppercase block mb-0.5">{t('x2_label')}</label>
                    <input type="text" value={editExtraChargeNote} onChange={e => setEditExtraChargeNote(e.target.value)}
                      placeholder={t('x2_ph_delivery')}
                      className="w-full p-3 bg-row border border-extra/40 rounded-xl text-lg leading-normal font-bold outline-none focus:border-extra" />
                  </div>
                  <div>
                    <label className="text-sm font-black text-muted uppercase block mb-0.5">{t('amount')}</label>
                    <input type="number" step="any" value={editExtraChargeAmount} onChange={e => setEditExtraChargeAmount(e.target.value)}
                      placeholder="0"
                      className="w-full p-3 bg-row border border-extra/40 rounded-xl text-lg leading-normal font-bold outline-none focus:border-extra" />
                  </div>
                </div>
              </div>

              {/* Cardboard core / damage */}
              <WasteBox compact wastes={editWastes} onChange={setEditWastes} options={options} addOption={addOption} firstItem={editItems[0]} />
              {/* Discount */}
              <div className="border-2 border-dashed border-debt/30 rounded-xl p-3 space-y-2">
                <label className="text-sm font-black text-debt uppercase tracking-widest block">{t('discount')} ({t('optional')})</label>
                <div>
                  <label className="text-sm font-black text-muted uppercase block mb-0.5">{t('amount')}</label>
                  <input type="number" step="any" value={editDiscountAmount} onChange={e => setEditDiscountAmount(e.target.value)}
                    placeholder="0"
                    className="w-full p-3 bg-row border border-debt/40 rounded-xl text-lg leading-normal font-bold outline-none focus:border-debt" />
                </div>
              </div>

              {/* Payment */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-base font-black text-muted uppercase tracking-widest block mb-1">{t('paid_amount') || 'Paid Amount'}</label>
                  <input type="number" step="any" value={editPaidAmount} onChange={e => setEditPaidAmount(e.target.value)}
                    placeholder="0"
                    className="w-full min-h-[48px] px-3 bg-row border border-line-strong rounded-lg font-bold text-lg leading-normal outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-base font-black text-muted uppercase tracking-widest block mb-2">{t('payment_method') || 'Method'}</label>
                  <SplitPicker total={editPaidAmount} split={editSplit} onSplitChange={setEditSplit} parts={editParts} onParts={setEditParts} method={editPaymentMethod}
                    single={<MethodPicker value={editPaymentMethod} onChange={setEditPaymentMethod} />} />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-base font-black text-muted uppercase tracking-widest block mb-1">{t('note') || 'Note'}</label>
                <textarea value={editNote} onChange={e => setEditNote(e.target.value)}
                  rows={2}
                  className="w-full min-h-[48px] px-3 bg-row border border-line-strong rounded-lg font-bold text-lg leading-normal outline-none focus:border-accent resize-none" />
              </div>

              {/* Live summary */}
              <div className="bg-zebra rounded-xl p-3 border border-line text-sm font-black uppercase space-y-1.5">
                <div className="flex justify-between text-muted">
                  <span>{t('items_total')}</span><span className="text-ink">{editItemsTotal.toLocaleString()}</span>
                </div>
                {editExtraCharge > 0 && (
                  <div className="flex justify-between text-extra">
                    <span>{editExtraChargeNote || 'Extra'}</span><span>+{editExtraCharge.toLocaleString()}</span>
                  </div>
                )}
                {editDiscount > 0 && (
                  <div className="flex justify-between text-debt">
                    <span>{t('discount')}</span><span>-{editDiscount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted">
                  <span>{t('previous_balance')}</span><span className={editPrevBalance > 0 ? 'text-extra' : 'text-muted'}>{editPrevBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-ink border-t border-line pt-1.5">
                  <span>{t('final_total')}</span><span>{editFinalTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-ok">
                  <span>{t('x2_paid')}</span><span>−{editPaid.toLocaleString()}</span>
                </div>
                <div className={`flex justify-between text-base border-t border-line pt-1.5 ${editRemaining > 0 ? 'text-debt' : 'text-ok'}`}>
                  <span>{t('remaining')}</span><span>{editRemaining.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className={`shrink-0 flex items-center justify-between px-5 py-3 border-t-2 ${editRemaining > 0 ? 'bg-debt-bg border-debt/30' : 'bg-ok-bg border-ok/30'}`}>
              <span className="text-sm font-black uppercase tracking-widest text-muted">{t('remaining')}</span>
              <span className={`text-2xl font-black tabular-nums ${editRemaining > 0 ? 'text-debt' : 'text-ok'}`}>{editRemaining.toLocaleString()}</span>
            </div>

            {/* Modal footer */}
            <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-line flex gap-4 shrink-0">
              <button onClick={closeEditModal} className="flex-1 py-4 rounded-lg border border-line-strong font-semibold text-ink text-base hover:bg-zebra transition-all">
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving || !editVoucherNumber.trim()}
                className="flex-1 py-4 rounded-2xl bg-accent text-on-accent font-black text-base flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={15} />
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default History;
