import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, CreditCard, ChevronDown, ChevronUp, Trash2, ArrowUpDown, Pencil, Plus, Save, X } from 'lucide-react';
import Layout from '../components/Layout';
import DropdownDatePicker from '../components/DropdownDatePicker';
import { voucherService, paymentService } from '../services/api';
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

const emptyItem = () => ({ lb: '', plastic_size: '', plastic_price: '', color: '', color_price: '' });

const History = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const customer = location.state?.customer || null;

  const [vouchers, setVouchers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedVoucher, setExpandedVoucher] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedDate, setSelectedDate] = useState('');

  // Edit modal state
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editVoucherNumber, setEditVoucherNumber] = useState('');
  const [editVoucherDate, setEditVoucherDate] = useState('');
  const [editItems, setEditItems] = useState([emptyItem()]);
  const [editExtraChargeNote, setEditExtraChargeNote] = useState('');
  const [editExtraChargeAmount, setEditExtraChargeAmount] = useState('');
  const [editPaidAmount, setEditPaidAmount] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('');
  const [editNote, setEditNote] = useState('');

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

  useEffect(() => {
    if (!customer) {
      navigate('/');
    } else {
      fetchHistory();
    }
  }, [customer, navigate, fetchHistory]);

  const handleDeleteVoucher = async (e, item) => {
    e.stopPropagation();
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
      } catch {}
      setVouchers(prev => prev.filter(v => v.client_id !== clientId));
      return;
    }

    try {
      await voucherService.delete(serverId);
      db.vouchers.delete(clientId).catch(() => {});
      fetchHistory();
    } catch {
      alert(t('error_deleting_voucher'));
    }
  };

  const handleDeletePayment = async (item) => {
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
      } catch {}
      setPayments(prev => prev.filter(p => p.client_id !== clientId));
      return;
    }

    try {
      await paymentService.delete(serverId);
      db.payments.delete(clientId).catch(() => {});
      fetchHistory();
    } catch {
      alert(t('error_deleting_payment'));
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
            plastic_price: String(it.plastic_price),
            color: it.color,
            color_price: String(it.color_price),
          }))
        : [emptyItem()]
    );
    setEditExtraChargeNote(item.extra_charge_note || '');
    setEditExtraChargeAmount(item.extra_charge_amount > 0 ? String(item.extra_charge_amount) : '');
    setEditPaidAmount(item.paid_amount > 0 ? String(item.paid_amount) : '');
    setEditPaymentMethod(item.payment_method || '');
    setEditNote(item.note || '');
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
      plastic_price: parseFloat(it.plastic_price) || 0,
      color: it.color,
      color_price: parseFloat(it.color_price) || 0,
    }));

    if (parsedItems.some(it => it.lb <= 0)) {
      alert('Each item must have a weight (LB) greater than 0.');
      return;
    }

    const payload = {
      voucher_number: editVoucherNumber,
      voucher_date: editVoucherDate || null,
      items: parsedItems,
      extra_charge_note: editExtraChargeNote || null,
      extra_charge_amount: parseFloat(editExtraChargeAmount) || 0,
      paid_amount: parseFloat(editPaidAmount) || 0,
      payment_method: editPaymentMethod || null,
      note: editNote || null,
    };

    setEditSaving(true);
    try {
      await voucherService.update(serverId, payload);
      closeEditModal();
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
  const editPaid = parseFloat(editPaidAmount) || 0;
  const editPrevBalance = editingVoucher?.previous_balance || 0;
  const editFinalTotal = editItemsTotal + editExtraCharge + editPrevBalance;
  const editRemaining = editFinalTotal - editPaid;

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

  return (
    <Layout>
      <div className="space-y-4 pb-12 animate-in slide-in-from-right-4 duration-500">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/', { state: { customer: customer } })} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-all">
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <h2 className="text-xl font-black text-gray-800">{t('history')}</h2>
          </div>
          {customer && (
            <div className="bg-blue-50 px-3 py-1 rounded-xl border border-blue-100 text-right">
              <span className="text-[9px] font-black text-blue-400 uppercase block tracking-tighter leading-none mb-1">{t('customer')}</span>
              <p className="text-sm font-black text-blue-700 truncate max-w-[120px] leading-none">{customer.name}</p>
            </div>
          )}
        </header>

        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex items-end gap-3">
          <div className="flex-1">
            <DropdownDatePicker
              label={t('specific_date_search')}
              value={selectedDate}
              onChange={(val) => { setSelectedDate(val); if (val) setExpandedVoucher(null); }}
            />
          </div>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate('')}
              className="flex items-center gap-1 text-[10px] font-black text-red-400 bg-red-50 px-3 py-2 rounded-xl border border-red-100 hover:bg-red-100 transition-all mb-0.5"
            >
              <X size={10} /> {t('clear') || 'Clear'}
            </button>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1.5 text-[10px] font-black text-gray-500 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 hover:text-blue-600 transition-all"
          >
            <ArrowUpDown size={10} />
            {sortOrder === 'asc' ? t('oldest_first') : t('newest_first')}
          </button>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-400 font-bold text-sm uppercase tracking-widest animate-pulse">{t('refreshing_records')}</div>
          ) : filteredData.length > 0 ? (
            filteredData.map((item) => (
              <div key={`${item.type}-${item.id}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in transition-all">
                {item.type === 'voucher' ? (
                  <>
                    <div
                      onClick={() => setExpandedVoucher(expandedVoucher === item.id ? null : item.id)}
                      className="p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                    >
                      <div className="flex gap-3 items-center min-w-0">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-gray-800 text-sm truncate">{item.voucher_number}</span>
                            <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded font-black text-gray-500 whitespace-nowrap">{item.voucher_date}</span>
                            {item.sync_status === 'pending' && (
                              <span className="text-[8px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-black uppercase">Pending</span>
                            )}
                            {item.paid_amount > 0 && item.payment_method && (
                              <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${
                                item.payment_method === 'KBZPAY' ? 'bg-blue-100 text-blue-600' :
                                item.payment_method === 'BANK_TRANSFER' ? 'bg-purple-100 text-purple-600' :
                                'bg-green-100 text-green-600'
                              }`}>
                                {item.payment_method === 'BANK_TRANSFER' ? 'BANK' : item.payment_method}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.items?.length || 0} {t('products')}</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div className="hidden sm:block">
                          <span className="text-[9px] text-gray-400 font-black uppercase block tracking-tighter">{t('remaining')}</span>
                          <span className={`text-sm font-black ${item.remaining_balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {item.remaining_balance.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 items-end sm:flex-row sm:items-center sm:gap-2 ml-2">
                          {isAdmin() && (item.server_id ?? (typeof item.id === 'number' ? item.id : null)) && (
                            <button
                              onClick={(e) => openEditModal(e, item)}
                              className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all order-2 sm:order-1"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {isAdmin() && (
                            <button
                              onClick={(e) => handleDeleteVoucher(e, item)}
                              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all order-2 sm:order-1"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          <div className="order-1 sm:order-2">
                            {expandedVoucher === item.id ? <ChevronUp size={16} className="text-gray-300" /> : <ChevronDown size={16} className="text-gray-300" />}
                          </div>
                        </div>
                      </div>
                    </div>
                    {expandedVoucher === item.id && (
                      <div className="bg-gray-50 p-3 border-t border-gray-100 space-y-3 animate-in slide-in-from-top-2">
                        {item.note && (
                          <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100/50">
                            <span className="text-[8px] font-black text-blue-400 uppercase block leading-none mb-1">{t('note')}</span>
                            <p className="text-xs font-bold text-blue-700 leading-tight italic">"{item.note}"</p>
                          </div>
                        )}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                          <table className="w-full text-[10px] text-left">
                            <thead className="bg-gray-100 font-black text-gray-500 uppercase">
                              <tr><th className="p-2">{t('details')}</th><th className="p-2 text-right">{t('price')}</th><th className="p-2 text-right">{t('total')}</th></tr>
                            </thead>
                            <tbody className="font-bold text-gray-700">
                              {item.items?.map((it, idx) => (
                                <React.Fragment key={idx}>
                                  <tr className="border-t border-gray-100">
                                    <td className="p-2 align-top">
                                      <div className="text-blue-600">{it.lb} {t('weight_lb').split(' ')[1] || 'LB'} - {it.plastic_size} ({it.color})</div>
                                      <div className="mt-1 space-y-0.5">
                                        <div className="text-[9px] text-gray-500 uppercase flex justify-between">
                                          <span>{t('plastic')}: {it.lb} {t('weight_lb').split(' ')[1] || 'LB'} × {it.plastic_price} {t('price')}</span>
                                          <span className="font-black">{(it.lb * it.plastic_price).toLocaleString()}</span>
                                        </div>
                                        <div className="text-[9px] text-gray-500 uppercase flex justify-between border-b border-gray-50 pb-0.5">
                                          <span>{t('color')}: {it.lb} {t('weight_lb').split(' ')[1] || 'LB'} × {it.color_price} {t('price')}</span>
                                          <span className="font-black">{(it.lb * it.color_price).toLocaleString()}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-2 text-right align-top text-gray-400 font-medium">
                                      {it.plastic_price + it.color_price}
                                    </td>
                                    <td className="p-2 text-right align-top text-blue-700 font-black">
                                      {(it.total_price || 0).toLocaleString()}
                                    </td>
                                  </tr>
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className={`grid gap-2 text-[9px] font-black uppercase text-center ${item.extra_charge_amount > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                          <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                            <span className="text-gray-400 block mb-1">{t('voucher_total')}</span>
                            <span className="text-gray-700 text-xs">{item.items_total.toLocaleString()}</span>
                          </div>
                          {item.extra_charge_amount > 0 && (
                            <div className="bg-orange-50 p-2 rounded-lg border border-orange-100 shadow-sm">
                              <span className="text-gray-400 block mb-1 tracking-tighter truncate">{item.extra_charge_note || 'Extra'}</span>
                              <span className="text-orange-500 text-xs">+{item.extra_charge_amount.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="bg-white p-2 rounded-lg border border-orange-100 shadow-sm">
                            <span className="text-gray-400 block mb-1 tracking-tighter">{t('previous_balance')}</span>
                            <span className={`text-xs ${item.previous_balance > 0 ? 'text-orange-500' : 'text-gray-500'}`}>
                              {item.previous_balance.toLocaleString()}
                            </span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                            <span className="text-gray-400 block mb-1 tracking-tighter">{t('paid_at_site')}</span>
                            <span className="text-green-600 text-xs">{item.paid_amount.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-[9px] font-black uppercase ${item.remaining_balance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                          <span className="text-gray-500 tracking-widest">{t('overall_total')}</span>
                          <span className="text-[10px] flex items-center gap-1 text-gray-400 font-bold normal-case tracking-normal">
                            {item.items_total.toLocaleString()}
                            {item.extra_charge_amount > 0 && <> + {item.extra_charge_amount.toLocaleString()}</>}
                            {' '}+ {item.previous_balance.toLocaleString()} − {item.paid_amount.toLocaleString()} =
                            <span className={`font-black text-sm ${item.remaining_balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                              {item.remaining_balance.toLocaleString()}
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-3 flex justify-between items-center bg-white hover:bg-gray-50 group">
                    <div className="flex gap-3 items-center min-w-0">
                      <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                        <CreditCard size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-green-700 text-sm">{t('direct_payment')}</span>
                          <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded font-black text-gray-500 whitespace-nowrap">{item.payment_date}</span>
                          {item.sync_status === 'pending' && (
                            <span className="text-[8px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-black uppercase">Pending</span>
                          )}
                          {item.payment_method && (
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${
                              item.payment_method === 'KBZPAY' ? 'bg-blue-100 text-blue-600' :
                              item.payment_method === 'BANK_TRANSFER' ? 'bg-purple-100 text-purple-600' :
                              'bg-green-100 text-green-600'
                            }`}>
                              {item.payment_method === 'BANK_TRANSFER' ? 'BANK' : item.payment_method}
                            </span>
                          )}
                        </div>
                        {item.note && <p className="text-[10px] text-gray-500 italic truncate max-w-[150px]">"{item.note}"</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[9px] text-gray-400 font-black uppercase block tracking-tighter leading-none mb-1">{t('amount_paid')}</span>
                        <span className="font-black text-green-600 text-base leading-none whitespace-nowrap">
                          {item.amount_paid.toLocaleString()}
                        </span>
                      </div>
                      {isAdmin() && (
                        <button
                          onClick={() => handleDeletePayment(item)}
                          className="p-1.5 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all group-hover:text-gray-300"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-100 text-sm font-bold animate-in zoom-in duration-300">
              {t('no_activity_found')}
            </div>
          )}
        </div>
      </div>

      {/* Edit Voucher Modal */}
      {editingVoucher && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-base font-black text-gray-800">Edit Voucher</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{editingVoucher.voucher_number}</p>
              </div>
              <button onClick={closeEditModal} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {/* Voucher Number & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Voucher No.</label>
                  <input
                    type="text"
                    value={editVoucherNumber}
                    onChange={e => setEditVoucherNumber(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-sm outline-none focus:border-blue-400"
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
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('products') || 'Items'}</label>
                  <button onClick={addEditItem} className="flex items-center gap-1 text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 hover:bg-blue-100 transition-all">
                    <Plus size={10} /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {editItems.map((it, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-xl p-2.5 border border-gray-100 space-y-2 relative">
                      {editItems.length > 1 && (
                        <button onClick={() => removeEditItem(idx)} className="absolute top-2 right-2 text-gray-300 hover:text-red-400 transition-all">
                          <X size={13} />
                        </button>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-0.5">LB</label>
                          <input type="number" step="any" value={it.lb} onChange={e => handleEditItemChange(idx, 'lb', e.target.value)}
                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-0.5">Size</label>
                          <input type="text" value={it.plastic_size} onChange={e => handleEditItemChange(idx, 'plastic_size', e.target.value)}
                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-0.5">Plastic ฿</label>
                          <input type="number" step="any" value={it.plastic_price} onChange={e => handleEditItemChange(idx, 'plastic_price', e.target.value)}
                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-0.5">Color</label>
                          <input type="text" value={it.color} onChange={e => handleEditItemChange(idx, 'color', e.target.value)}
                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-0.5">Color ฿</label>
                          <input type="number" step="any" value={it.color_price} onChange={e => handleEditItemChange(idx, 'color_price', e.target.value)}
                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400" />
                        </div>
                      </div>
                      {(parseFloat(it.lb) > 0) && (
                        <div className="text-right text-[9px] font-black text-blue-600">
                          = {((parseFloat(it.lb) || 0) * ((parseFloat(it.plastic_price) || 0) + (parseFloat(it.color_price) || 0))).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Extra Charge */}
              <div className="border-2 border-dashed border-orange-200 rounded-xl p-3 space-y-2">
                <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest block">Extra Charge (Optional)</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-0.5">Label</label>
                    <input type="text" value={editExtraChargeNote} onChange={e => setEditExtraChargeNote(e.target.value)}
                      placeholder="e.g. Delivery fee"
                      className="w-full p-2 bg-white border border-orange-100 rounded-lg text-xs font-bold outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-0.5">Amount</label>
                    <input type="number" step="any" value={editExtraChargeAmount} onChange={e => setEditExtraChargeAmount(e.target.value)}
                      placeholder="0"
                      className="w-full p-2 bg-white border border-orange-100 rounded-lg text-xs font-bold outline-none focus:border-orange-400" />
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">{t('paid_amount') || 'Paid Amount'}</label>
                  <input type="number" step="any" value={editPaidAmount} onChange={e => setEditPaidAmount(e.target.value)}
                    placeholder="0"
                    className="w-full p-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-sm outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">{t('payment_method') || 'Method'}</label>
                  <select value={editPaymentMethod} onChange={e => setEditPaymentMethod(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-sm outline-none focus:border-blue-400">
                    <option value="">—</option>
                    {PAYMENT_METHODS.map(m => (
                      <option key={m} value={m}>{m === 'BANK_TRANSFER' ? 'BANK' : m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">{t('note') || 'Note'}</label>
                <textarea value={editNote} onChange={e => setEditNote(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-sm outline-none focus:border-blue-400 resize-none" />
              </div>

              {/* Live summary */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-[10px] font-black uppercase space-y-1.5">
                <div className="flex justify-between text-gray-500">
                  <span>Items Total</span><span className="text-gray-700">{editItemsTotal.toLocaleString()}</span>
                </div>
                {editExtraCharge > 0 && (
                  <div className="flex justify-between text-orange-500">
                    <span>{editExtraChargeNote || 'Extra'}</span><span>+{editExtraCharge.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-500">
                  <span>Prev. Balance</span><span className={editPrevBalance > 0 ? 'text-orange-500' : 'text-gray-500'}>{editPrevBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-700 border-t border-gray-200 pt-1.5">
                  <span>Final Total</span><span>{editFinalTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Paid</span><span>−{editPaid.toLocaleString()}</span>
                </div>
                <div className={`flex justify-between text-sm border-t border-gray-200 pt-1.5 ${editRemaining > 0 ? 'text-red-500' : 'text-green-600'}`}>
                  <span>Remaining</span><span>{editRemaining.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-3 shrink-0">
              <button onClick={closeEditModal} className="flex-1 py-3 rounded-2xl border-2 border-gray-100 font-black text-gray-500 text-sm hover:bg-gray-50 transition-all">
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving || !editVoucherNumber.trim()}
                className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
