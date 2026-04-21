import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft, Smartphone, Landmark, Banknote, WifiOff } from 'lucide-react';
import Layout from '../components/Layout';
import DropdownDatePicker from '../components/DropdownDatePicker';
import { customerService, voucherService } from '../services/api';
import { cacheBalance, getOfflineBalance, syncAll } from '../services/syncService';
import db, { generateUUID } from '../lib/db';
import { useLanguage } from '../context/LanguageContext';

const Voucher = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [customer] = useState(location.state?.customer || null);
  const [balance, setBalance] = useState(0);
  const [balanceIsEstimate, setBalanceIsEstimate] = useState(false);

  const [voucherNumber, setVoucherNumber] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toLocaleDateString('en-GB').split('/').join('-'));
  const [items, setItems] = useState([{ lb: '', plastic_size: '', plastic_price: '', color: '', color_price: '', total_price: 0 }]);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [note, setNote] = useState('');
  const [extraChargeNote, setExtraChargeNote] = useState('');
  const [extraChargeAmount, setExtraChargeAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customer) {
      navigate('/');
      return;
    }
    fetchBalance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  const fetchBalance = async () => {
    const serverId = customer.server_id ?? customer.id;

    if (navigator.onLine && typeof serverId === 'number') {
      try {
        const response = await customerService.getBalance(serverId);
        const bal = response.data.balance;
        try { cacheBalance(serverId, bal); } catch (_) {}
        setBalance(bal);
        setBalanceIsEstimate(false);
        return;
      } catch (_) {}
    }

    // Offline fallback — best effort
    try {
      const estimated = await getOfflineBalance(customer.client_id, serverId);
      setBalance(estimated);
      setBalanceIsEstimate(true);
    } catch (_) {
      setBalance(0);
      setBalanceIsEstimate(true);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    const lb = parseFloat(newItems[index].lb) || 0;
    const pPrice = parseFloat(newItems[index].plastic_price) || 0;
    const cPrice = parseFloat(newItems[index].color_price) || 0;
    newItems[index].total_price = lb * (pPrice + cPrice);
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { lb: '', plastic_size: '', plastic_price: '', color: '', color_price: '', total_price: 0 }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const itemsTotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const extraCharge = parseFloat(extraChargeAmount) || 0;
  const finalTotal = itemsTotal + extraCharge + balance;
  const remainingBalance = finalTotal - (parseFloat(paidAmount) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!voucherNumber) return alert(t('enter_voucher_number'));

    setLoading(true);

    const clientId = generateUUID();
    const now = new Date().toISOString();
    const paid = parseFloat(paidAmount) || 0;
    const serverId = customer.server_id ?? (typeof customer.id === 'number' ? customer.id : null);

    const mappedItems = items.map(item => ({
      lb: parseFloat(item.lb),
      plastic_size: item.plastic_size,
      plastic_price: parseFloat(item.plastic_price) || 0,
      color: item.color,
      color_price: parseFloat(item.color_price) || 0,
    }));

    const apiPayload = {
      customer_id: serverId,
      customer_client_id: customer.client_id ?? null,
      voucher_number: voucherNumber,
      voucher_date: voucherDate,
      paid_amount: paid,
      payment_method: paid > 0 ? paymentMethod : null,
      note: note,
      extra_charge_note: extraChargeNote || null,
      extra_charge_amount: parseFloat(extraChargeAmount) || 0,
      items: mappedItems,
      client_id: clientId,
    };

    // ── ONLINE PATH: call API first; IndexedDB is best-effort ──────────
    if (navigator.onLine && serverId) {
      try {
        await voucherService.create(apiPayload);

        // Save to IndexedDB in background (non-blocking, don't fail if Dexie broken)
        db.vouchers.add({
          client_id: clientId,
          server_id: null,
          customer_client_id: customer.client_id ?? `server_${serverId}`,
          customer_server_id: serverId,
          voucher_number: voucherNumber,
          voucher_date: voucherDate,
          items_total: itemsTotal,
          extra_charge_note: extraChargeNote || null,
          extra_charge_amount: extraCharge,
          paid_amount: paid,
          payment_method: paid > 0 ? paymentMethod : null,
          note: note,
          items: mappedItems,
          sync_status: 'synced',
          created_at: now,
        }).catch(() => {});

        alert(t('voucher_saved_successfully'));
        setLoading(false);
        navigate('/', { state: { customer } });
        return;
      } catch (apiErr) {
        // Server returned a structured error (validation, duplicate, etc.) — stop here
        if (apiErr.response) {
          setLoading(false);
          return alert(apiErr.response.data?.detail || t('error_saving_voucher'));
        }
        // Network error (tunnel down, server unreachable) — fall through to offline save
        console.warn('[Voucher] API unreachable, saving offline...');
      }
    }

    // ── OFFLINE PATH: IndexedDB is required ────────────────────────────
    try {
      // Wrap both writes in one transaction — either both succeed or neither does
      await db.transaction('rw', db.vouchers, db.sync_queue, async () => {
        await db.vouchers.add({
          client_id: clientId,
          server_id: null,
          customer_client_id: customer.client_id ?? `server_${serverId}`,
          customer_server_id: serverId,
          voucher_number: voucherNumber,
          voucher_date: voucherDate,
          items_total: itemsTotal,
          extra_charge_note: extraChargeNote || null,
          extra_charge_amount: extraCharge,
          paid_amount: paid,
          payment_method: paid > 0 ? paymentMethod : null,
          note: note,
          items: mappedItems,
          sync_status: 'pending',
          created_at: now,
          updated_at: now,
        });
        await db.sync_queue.add({
          client_id: clientId,
          type: 'voucher',
          action: 'create',
          payload: apiPayload,
          status: 'pending',
          retries: 0,
          depends_on_client_id: serverId ? null : (customer.client_id ?? null),
          created_at: now,
        });
      });

      syncAll(); // attempt immediate sync — SyncStatus badge shows pending state
      setLoading(false);
      navigate('/', { state: { customer } });
    } catch (offlineErr) {
      setLoading(false);
      alert(t('could_not_save') + offlineErr.message);
    }
  };

  const paymentMethods = [
    { id: 'CASH', label: t('cash'), icon: Banknote, active: 'bg-green-600 text-white' },
    { id: 'KBZPAY', label: t('kbzpay'), icon: Smartphone, active: 'bg-blue-600 text-white' },
    { id: 'BANK_TRANSFER', label: t('bank_transfer'), icon: Landmark, active: 'bg-purple-600 text-white' },
  ];

  return (
    <Layout>
      <div className="space-y-6 pb-12 animate-in slide-in-from-right-4 duration-500">
        <header className="flex items-center gap-4">
          <button onClick={() => navigate('/', { state: { customer } })} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-all">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <h2 className="text-2xl font-black text-gray-800">{t('create_voucher')}</h2>
        </header>

        {!navigator.onLine && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs font-bold px-4 py-3 rounded-xl">
            <WifiOff size={14} />
            {t('offline_voucher_notice')}
          </div>
        )}

        {customer && (
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex justify-between items-center">
            <span className="font-bold text-blue-800 text-lg">{customer.name}</span>
            <div className="text-right">
              <span className="text-xs text-blue-600 uppercase font-bold block">
                {t('previous_balance')}{balanceIsEstimate ? ` ${t('est')}` : ''}
              </span>
              <span className="text-lg font-black text-blue-700">{balance.toLocaleString()} MMK</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-600 uppercase px-1">{t('voucher_number')}</label>
              <input
                required
                type="text"
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all font-bold text-lg"
                placeholder="V-001"
                value={voucherNumber}
                onChange={(e) => setVoucherNumber(e.target.value)}
              />
            </div>
            <DropdownDatePicker
              label={t('voucher_date')}
              value={voucherDate}
              onChange={setVoucherDate}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-black text-gray-700 flex justify-between items-center px-1">
              {t('items')}
              <button type="button" onClick={addItem} className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
                <Plus size={20} />
              </button>
            </h3>

            {items.map((item, index) => (
              <div key={index} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 space-y-4 relative overflow-hidden">
                <div className="flex justify-between items-center">
                  <span className="bg-gray-100 px-3 py-1 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('item')} {index + 1}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">{t('weight_lb')}</label>
                    <input
                      autoFocus={index === items.length - 1}
                      type="number" step="any" required min="0"
                      className="w-full p-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      value={item.lb}
                      onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                      onChange={(e) => handleItemChange(index, 'lb', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">{t('size')}</label>
                    <input
                      type="text" required placeholder="e.g. 10x15"
                      className="w-full p-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold"
                      value={item.plastic_size}
                      onChange={(e) => handleItemChange(index, 'plastic_size', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">{t('plastic_price')}</label>
                    <input
                      type="number" required min="0" step="any"
                      className="w-full p-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      value={item.plastic_price}
                      onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                      onChange={(e) => handleItemChange(index, 'plastic_price', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">{t('color')}</label>
                    <input
                      type="text" required placeholder="e.g. Blue"
                      className="w-full p-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold"
                      value={item.color}
                      onChange={(e) => handleItemChange(index, 'color', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">{t('color_price')}</label>
                    <input
                      type="number" required min="0" step="any"
                      className="w-full p-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      value={item.color_price}
                      onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                      onChange={(e) => handleItemChange(index, 'color_price', e.target.value)}
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="text-[11px] font-bold text-gray-500">
                    <span className="block uppercase text-[9px] mb-0.5 tracking-tighter">{t('plastic')}: {item.lb || 0} × {item.plastic_price || 0}</span>
                    <div className="text-blue-600 font-black">{((item.lb || 0) * (item.plastic_price || 0)).toLocaleString()}</div>
                  </div>
                  <div className="text-[11px] font-bold text-gray-500">
                    <span className="block uppercase text-[9px] mb-0.5 tracking-tighter">{t('color')}: {item.lb || 0} × {item.color_price || 0}</span>
                    <div className="text-blue-600 font-black">{((item.lb || 0) * (item.color_price || 0)).toLocaleString()}</div>
                  </div>
                  <div className="text-right flex flex-col justify-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase block tracking-widest">{t('total')}</span>
                    <span className="text-lg font-black text-blue-700">{(item.total_price || 0).toLocaleString()} <span className="text-xs">MMK</span></span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1 px-1">
            <label className="text-sm font-bold text-gray-600 uppercase">{t('voucher_note')}</label>
            <textarea
              className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold"
              placeholder={t('add_note_placeholder')}
              rows="2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="bg-white p-4 rounded-3xl border-2 border-dashed border-gray-200 space-y-3">
            <label className="text-sm font-black text-gray-500 uppercase tracking-widest">Extra Charge <span className="text-gray-300 font-bold normal-case">(optional)</span></label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase px-1">Label</label>
                <input
                  type="text"
                  className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-orange-400 outline-none transition-all font-bold"
                  placeholder="e.g. Delivery Fee"
                  value={extraChargeNote}
                  onChange={(e) => setExtraChargeNote(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase px-1">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-orange-400 outline-none transition-all font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  placeholder="0"
                  value={extraChargeAmount}
                  onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                  onChange={(e) => setExtraChargeAmount(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-3xl shadow-xl text-white space-y-4">
            <div className="flex justify-between items-center opacity-70">
              <span className="font-bold">{t('previous_balance')}{balanceIsEstimate ? ` ${t('est')}` : ''}</span>
              <span className="font-bold">{balance.toLocaleString()} MMK</span>
            </div>
            <div className="flex justify-between items-center opacity-70">
              <span className="font-bold">{t('items_total')}</span>
              <span className="font-bold">{itemsTotal.toLocaleString()} MMK</span>
            </div>
            {extraCharge > 0 && (
              <div className="flex justify-between items-center opacity-70">
                <span className="font-bold">{extraChargeNote || 'Extra Charge'}</span>
                <span className="font-bold text-orange-300">+{extraCharge.toLocaleString()} MMK</span>
              </div>
            )}
            <div className="border-t border-gray-700 pt-4 flex justify-between items-center">
              <span className="text-xl font-black">{t('final_total')}</span>
              <span className="text-3xl font-black text-blue-400">{finalTotal.toLocaleString()} MMK</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border-2 border-blue-100 shadow-sm space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-600 uppercase px-1">{t('paid_amount')}</label>
              <input
                type="number"
                min="0"
                step="any"
                className="w-full p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl outline-none focus:border-blue-500 transition-all text-2xl font-black text-blue-700 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                placeholder="0"
                value={paidAmount}
                onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
              <span className="font-bold text-gray-500 uppercase text-xs">{t('remaining_balance')}</span>
              <span className={`text-2xl font-black ${remainingBalance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {remainingBalance.toLocaleString()} MMK
              </span>
            </div>
          </div>

          {parseFloat(paidAmount) > 0 && (
            <div className="space-y-2 px-1 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-sm font-bold text-gray-600 uppercase">{t('payment_method')}</label>
              <div className="grid grid-cols-3 gap-3">
                {paymentMethods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1 ${
                      paymentMethod === m.id
                        ? `${m.active} border-transparent shadow-md transform scale-105`
                        : `bg-white border-gray-100 text-gray-400 hover:border-gray-200`
                    }`}
                  >
                    <m.icon size={20} />
                    <span className="text-[10px] font-black uppercase">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full p-5 rounded-3xl text-white text-xl font-black shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-4 ${
              loading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            }`}
          >
            <Save size={28} />
            {loading ? t('saving') : t('save_voucher')}
          </button>
        </form>
      </div>
    </Layout>
  );
};

export default Voucher;
