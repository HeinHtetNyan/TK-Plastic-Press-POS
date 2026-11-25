import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft, Smartphone, Landmark, Banknote, WifiOff } from 'lucide-react';
import Layout from '../components/Layout';
import DropdownDatePicker from '../components/DropdownDatePicker';
import { customerService, voucherService } from '../services/api';
import { cacheBalance, getOfflineBalance, syncAll } from '../services/syncService';
import db, { generateUUID } from '../lib/db';
import { shopNow, shopToday } from '../utils/shopTime';
import { useLanguage } from '../context/LanguageContext';
import SplitPicker from '../components/SplitPicker';
import Combo from '../components/Combo';
import SizeInput from '../components/SizeInput';
import WasteBox from '../components/WasteBox';
import { wastesToPayload, coreTotal, wasteError } from '../utils/waste';
import { usePlasticOptions } from '../hooks/usePlasticOptions';
import { emptyParts, partsToSplits, splitError, primaryMethod } from '../utils/paymentSplits';

// Shared look for number / text boxes and small labels on this page
const inp = 'w-full px-3 h-[var(--ctl)] bg-row border border-line-strong rounded-xl focus:border-accent focus:ring-1 focus:ring-accent outline-none text-right font-medium tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const inpL = inp.replace('text-right', 'text-left');
const lab = 'block truncate text-sm font-medium text-muted';

const Voucher = () => {
  const { t } = useLanguage();
  const { options, addOption } = usePlasticOptions();
  const location = useLocation();
  const navigate = useNavigate();
  const [customer] = useState(location.state?.customer || null);
  const [balance, setBalance] = useState(0);
  const [balanceIsEstimate, setBalanceIsEstimate] = useState(false);

  const [voucherNumber, setVoucherNumber] = useState('');
  // Number mode: 'custom' = typed by hand, 'auto' = the server picks the next number when the voucher is saved.
  const [numCfg, setNumCfg] = useState(() => {
    const base = { mode: 'custom', kind: 'YEAR', prefix: 'TK-', digits: 6 };
    try { return { ...base, ...JSON.parse(localStorage.getItem('tk_voucher_number_cfg') || '{}') }; } catch { return base; }
  });
  const setCfg = (patch) => setNumCfg(prev => {
    const next = { ...prev, ...patch };
    try { localStorage.setItem('tk_voucher_number_cfg', JSON.stringify(next)); } catch { /* remembered choice is optional */ }
    return next;
  });
  const isAuto = numCfg.mode === 'auto';
  const autoNumber = isAuto
    ? { kind: numCfg.kind, prefix: numCfg.kind === 'PREFIX' ? String(numCfg.prefix || '').trim() : '', digits: Math.min(9, Math.max(1, parseInt(numCfg.digits) || 4)) }
    : null;
  const autoExample = autoNumber
    ? (autoNumber.kind === 'YEAR' ? `${shopNow().getFullYear()}-0001` : `${autoNumber.prefix}${String(1).padStart(autoNumber.digits, '0')}`)
    : '';
  const [voucherDate, setVoucherDate] = useState(shopToday());
  const [items, setItems] = useState([{ lb: '', plastic_size: '', gate: '', plastic_price: '', color: '', print_color: '', color_price: '', total_price: 0 }]);
  const [wastes, setWastes] = useState([]);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [splitMode, setSplitMode] = useState(false);
  const [parts, setParts] = useState(emptyParts());
  const [note, setNote] = useState('');
  const [extraChargeNote, setExtraChargeNote] = useState('');
  const [extraChargeAmount, setExtraChargeAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
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
        try { cacheBalance(serverId, bal); } catch { /* cache is best effort */ }
        setBalance(bal);
        setBalanceIsEstimate(false);
        return;
      } catch { /* server may be unavailable */ }
    }

    // Offline fallback — best effort
    try {
      const estimated = await getOfflineBalance(customer.client_id, serverId);
      setBalance(estimated);
      setBalanceIsEstimate(true);
    } catch {
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
    setItems([...items, { lb: '', plastic_size: '', gate: '', plastic_price: '', color: '', print_color: '', color_price: '', total_price: 0 }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const itemsTotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const extraCharge = parseFloat(extraChargeAmount) || 0;
  const discount = parseFloat(discountAmount) || 0;
  const finalTotal = itemsTotal + extraCharge - discount + balance;
  const remainingBalance = finalTotal - (parseFloat(paidAmount) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuto && !voucherNumber.trim()) return alert(t('enter_voucher_number'));

    const wErr = wasteError(wastes);
    if (wErr) return alert(t(wErr));

    const paidNow = parseFloat(paidAmount) || 0;
    let splits = null;
    let method = paymentMethod;
    if (splitMode && paidNow > 0) {
      const err = splitError(parts, paidNow);
      if (err) return alert(t(err));
      splits = partsToSplits(parts);
      method = primaryMethod(splits);
    }

    setLoading(true);

    const clientId = generateUUID();
    const now = new Date().toISOString();
    const paid = parseFloat(paidAmount) || 0;
    const serverId = customer.server_id ?? (typeof customer.id === 'number' ? customer.id : null);

    const mappedItems = items.map(item => ({
      lb: parseFloat(item.lb),
      plastic_size: item.plastic_size,
      gate: item.gate || null,
      print_color: item.print_color || null,
      plastic_price: parseFloat(item.plastic_price) || 0,
      color: item.color,
      color_price: parseFloat(item.color_price) || 0,
    }));

    const apiPayload = {
      customer_id: serverId,
      customer_client_id: customer.client_id ?? null,
      voucher_number: isAuto ? null : voucherNumber.trim(),
      auto_number: autoNumber,
      voucher_date: voucherDate,
      paid_amount: paid,
      payment_method: paid > 0 ? method : null,
      payment_splits: paid > 0 ? splits : null,
      note: note,
      extra_charge_note: extraChargeNote || null,
      extra_charge_amount: parseFloat(extraChargeAmount) || 0,
      discount_amount: discount,
      core_weight_lb: coreTotal(wastes),
      wastes: wastesToPayload(wastes),
      items: mappedItems,
      client_id: clientId,
    };

    // ONLINE PATH: call API first; IndexedDB is best-effort
    if (navigator.onLine && serverId) {
      try {
        const created = await voucherService.create(apiPayload);
        const warnings = created?.data?.stock_warnings || [];
        const createdNumber = created?.data?.voucher_number;

        // Save to IndexedDB in background (non-blocking, don't fail if Dexie broken)
        db.vouchers.add({
          client_id: clientId,
          server_id: null,
          customer_client_id: customer.client_id ?? `server_${serverId}`,
          customer_server_id: serverId,
          voucher_number: isAuto ? (createdNumber || t('auto_number_pending')) : voucherNumber.trim(),
          voucher_date: voucherDate,
          items_total: itemsTotal,
          extra_charge_note: extraChargeNote || null,
          extra_charge_amount: extraCharge,
          discount_amount: discount,
          paid_amount: paid,
          payment_method: paid > 0 ? method : null,
      payment_splits: paid > 0 ? splits : null,
          note: note,
          core_weight_lb: apiPayload.core_weight_lb,
          wastes: apiPayload.wastes,
          items: mappedItems,
          sync_status: 'synced',
          created_at: now,
        }).catch(() => {});

        const savedMsg = isAuto && createdNumber ? `${t('voucher_saved_successfully')} (#${createdNumber})` : t('voucher_saved_successfully');
        alert(warnings.length ? `${t('stock_warning_title')}\n\n${warnings.join('\n')}\n\n${savedMsg}` : savedMsg);
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

    // OFFLINE PATH: IndexedDB is required
    try {
      // Wrap both writes in one transaction — either both succeed or neither does
      await db.transaction('rw', db.vouchers, db.sync_queue, async () => {
        await db.vouchers.add({
          client_id: clientId,
          server_id: null,
          customer_client_id: customer.client_id ?? `server_${serverId}`,
          customer_server_id: serverId,
          voucher_number: isAuto ? t('auto_number_pending') : voucherNumber.trim(),
          voucher_date: voucherDate,
          items_total: itemsTotal,
          extra_charge_note: extraChargeNote || null,
          extra_charge_amount: extraCharge,
          discount_amount: discount,
          paid_amount: paid,
          payment_method: paid > 0 ? method : null,
      payment_splits: paid > 0 ? splits : null,
          note: note,
          core_weight_lb: apiPayload.core_weight_lb,
          wastes: apiPayload.wastes,
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
    { id: 'CASH', label: t('cash'), icon: Banknote, active: 'bg-ok text-on-accent' },
    { id: 'KBZPAY', label: t('kbzpay'), icon: Smartphone, active: 'bg-accent text-on-accent' },
    { id: 'BANK_TRANSFER', label: t('bank_transfer'), icon: Landmark, active: 'bg-m-bank text-on-accent' },
  ];

  return (
    <Layout>
      <div className="space-y-4 pb-36 xl:pb-12 max-w-[1280px] mx-auto">
        <header className="flex items-center gap-3">
          <button onClick={() => navigate('/', { state: { customer } })} aria-label="Back" className="w-[var(--ctl)] h-[var(--ctl)] flex items-center justify-center bg-row shadow-sm rounded-xl hover:bg-band transition-all">
            <ArrowLeft size={22} className="text-ink" />
          </button>
          <h2 className="text-xl sm:text-2xl font-semibold text-ink">{t('create_voucher')}</h2>
        </header>

        {!navigator.onLine && (
          <div className="flex items-center gap-2 bg-extra-bg text-extra text-base font-medium px-4 py-3 rounded-xl">
            <WifiOff size={14} />
            {t('offline_voucher_notice')}
          </div>
        )}

        {customer && (
          <form onSubmit={handleSubmit} className="space-y-4 xl:space-y-0 xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-6 xl:items-start">
            <div className="space-y-4 min-w-0">
              {/* Who, and what they owed before this voucher */}
              <section className="bg-row rounded-2xl shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-4">
                  <div className="min-w-0">
                    <span className="block text-sm text-muted">{t('customer')}</span>
                    <span className="block text-xl font-semibold text-ink break-words">{customer.name}</span>
                  </div>
                  <div className="sm:text-right">
                    <span className="block text-sm text-muted">{t('previous_balance')}{balanceIsEstimate ? ` ${t('est')}` : ''}</span>
                    <span className={`block text-xl font-semibold tabular-nums ${balance > 0 ? 'text-debt' : 'text-ok'}`}>{balance.toLocaleString()} <span className="text-sm font-medium text-muted">MMK</span></span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-line border-t border-line">
                  <div className="bg-row px-5 py-4 space-y-2 min-w-0">
                    <label className={lab}>{t('voucher_number')}</label>
                    <div className="grid grid-cols-2 rounded-xl overflow-hidden border border-line-strong">
                      {[['custom', t('vn_custom')], ['auto', t('vn_auto')]].map(([m, label]) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setCfg({ mode: m })}
                          className={`h-[var(--ctl)] font-medium text-base transition-all ${numCfg.mode === m ? 'bg-accent text-on-accent' : 'bg-row text-ink hover:bg-band'}`}
                        >{label}</button>
                      ))}
                    </div>
                    {!isAuto ? (
                      <input
                        required
                        type="text"
                        className={`${inpL} text-lg`}
                        placeholder="V-001"
                        value={voucherNumber}
                        onChange={(e) => setVoucherNumber(e.target.value)}
                      />
                    ) : (
                      <div className="space-y-2 p-3 bg-band rounded-xl">
                        <select
                          className={`${inpL} text-base`}
                          value={numCfg.kind}
                          onChange={(e) => setCfg({ kind: e.target.value })}
                        >
                          <option value="YEAR">{t('vn_pattern_year')}</option>
                          <option value="PREFIX">{t('vn_pattern_prefix')}</option>
                        </select>
                        {numCfg.kind === 'PREFIX' && (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-sm font-medium text-muted">{t('vn_prefix')}
                              <input type="text" maxLength={12} className={`${inpL} mt-1`} value={numCfg.prefix} onChange={(e) => setCfg({ prefix: e.target.value })} />
                            </label>
                            <label className="text-sm font-medium text-muted">{t('vn_digits')}
                              <input type="number" min={1} max={9} className={`${inp} mt-1`} value={numCfg.digits} onChange={(e) => setCfg({ digits: e.target.value })} />
                            </label>
                          </div>
                        )}
                        <p className="text-sm text-muted">{t('vn_example')}: {autoExample} &middot; {t('vn_auto_hint')}</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-row px-5 py-4 min-w-0">
                    <DropdownDatePicker
                      label={t('voucher_date')}
                      value={voucherDate}
                      onChange={setVoucherDate}
                    />
                  </div>
                </div>
              </section>

              {/* Items */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <h3 className="text-lg font-semibold text-ink">{t('items')} <span className="text-muted font-medium">({items.length})</span></h3>
                <button type="button" onClick={addItem} aria-label="Add item" className="h-[var(--ctl)] w-[var(--ctl)] bg-accent text-on-accent rounded-full hover:opacity-90 transition-opacity flex items-center justify-center">
                  <Plus size={22} />
                </button>
              </div>

              {items.map((item, index) => (
                <section key={index} className="bg-row rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex justify-between items-center px-5 py-3 border-b border-line">
                    <span className="inline-flex items-center px-3 py-0.5 rounded-full bg-band text-sm font-semibold text-ink">{t('item')} {index + 1}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(index)} aria-label="Remove item" className="w-10 h-10 flex items-center justify-center rounded-xl text-debt hover:bg-debt-bg transition-colors">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>

                  <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-12 gap-x-3 gap-y-3">
                    <div className="space-y-1 col-span-2 md:col-span-6">
                      <label className={lab}>{t('size')}</label>
                      <SizeInput
                        autoFocus={index > 0 && index === items.length - 1}
                        required
                        placeholder={t('pick_or_type')}
                        addLabel={t('add_new')}
                        secondPlaceholder={t('size_second')}
                        sizes={options.sizes}
                        value={item.plastic_size}
                        onChange={(v) => handleItemChange(index, 'plastic_size', v)}
                        addOption={addOption}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <label className={lab}>{t('gate')}</label>
                      <Combo
                        placeholder={t('pick_or_type')}
                        addLabel={t('add_new')}
                        options={options.gates}
                        value={item.gate}
                        onChange={(v) => handleItemChange(index, 'gate', v)}
                        onAdd={(name) => addOption('GATE', name)}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <label className={lab}>{t('plastic_color')}</label>
                      <Combo
                        required
                        placeholder={t('pick_or_type')}
                        addLabel={t('add_new')}
                        options={options.colors}
                        value={item.color}
                        onChange={(v) => handleItemChange(index, 'color', v)}
                        onAdd={(name) => addOption('COLOR', name)}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <label className={lab}>{t('print_color')}</label>
                      <Combo
                        placeholder={t('pick_or_type')}
                        addLabel={t('add_new')}
                        options={options.prints || []}
                        value={item.print_color}
                        onChange={(v) => handleItemChange(index, 'print_color', v)}
                        onAdd={(name) => addOption('PRINT', name)}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <label className={lab}>{t('weight_lb')}</label>
                      <input
                        type="number" step="any" required min="0"
                        className={inp}
                        value={item.lb}
                        onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                        onChange={(e) => handleItemChange(index, 'lb', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <label className={lab}>{t('plastic_price')}</label>
                      <input
                        type="number" required min="0" step="any"
                        className={inp}
                        value={item.plastic_price}
                        onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                        onChange={(e) => handleItemChange(index, 'plastic_price', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <label className={lab}>{t('color_price')}</label>
                      <input
                        type="number" required min="0" step="any"
                        className={inp}
                        value={item.color_price}
                        onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                        onChange={(e) => handleItemChange(index, 'color_price', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Live working-out for this item: plastic + colour = total, as a ruled strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-line border-t border-line">
                    <div className="bg-band px-5 py-3 min-w-0">
                      <span className="block text-sm text-muted">{t('plastic')}: {item.lb || 0} × {item.plastic_price || 0}</span>
                      <span className="block font-semibold text-ink tabular-nums">{((item.lb || 0) * (item.plastic_price || 0)).toLocaleString()}</span>
                    </div>
                    <div className="bg-band px-5 py-3 min-w-0">
                      <span className="block text-sm text-muted">{t('color')}: {item.lb || 0} × {item.color_price || 0}</span>
                      <span className="block font-semibold text-ink tabular-nums">{((item.lb || 0) * (item.color_price || 0)).toLocaleString()}</span>
                    </div>
                    <div className="bg-band px-5 py-3 col-span-2 sm:col-span-1 flex sm:block items-baseline justify-between">
                      <span className="block text-sm text-muted">{t('total')}</span>
                      <span className="block text-xl font-semibold text-accent tabular-nums">{(item.total_price || 0).toLocaleString()} <span className="text-sm font-medium text-muted">MMK</span></span>
                    </div>
                  </div>
                </section>
              ))}

              <WasteBox wastes={wastes} onChange={setWastes} options={options} addOption={addOption} firstItem={items[0]} />

              {/* Note, extra charge and discount grouped in one card */}
              <section className="bg-row rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 space-y-1">
                  <label className={lab}>{t('voucher_note')}</label>
                  <textarea
                    className="w-full p-3 bg-row border border-line-strong rounded-xl focus:border-accent focus:ring-1 focus:ring-accent outline-none font-medium"
                    placeholder={t('add_note_placeholder')}
                    rows="2"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-line border-t border-line">
                  <div className="bg-row px-5 py-4 space-y-3 min-w-0">
                    <span className="block text-base font-semibold text-ink">{t('x2_extra_charge')} <span className="text-muted font-normal">({t('optional')})</span></span>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className={lab}>{t('x2_label')}</label>
                        <input
                          type="text"
                          className={inpL}
                          placeholder={t('x2_ph_delivery')}
                          value={extraChargeNote}
                          onChange={(e) => setExtraChargeNote(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className={lab}>{t('amount')}</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className={inp}
                          placeholder="0"
                          value={extraChargeAmount}
                          onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                          onChange={(e) => setExtraChargeAmount(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="bg-row px-5 py-4 space-y-3 min-w-0">
                    <span className="block text-base font-semibold text-ink">{t('discount')} <span className="text-muted font-normal">({t('optional')})</span></span>
                    <div className="space-y-1">
                      <label className={lab}>{t('amount')}</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className={inp}
                        placeholder="0"
                        value={discountAmount}
                        onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Summary: one ruled card. Sticky on wide screens; below the form on tablet and phone. */}
            <aside className="min-w-0 xl:sticky xl:top-4">
              <section className="bg-row rounded-2xl shadow-sm overflow-hidden">
                <div className="flex justify-between items-center px-5 py-3 border-b border-line text-muted">
                  <span>{t('items_total')}</span>
                  <span className="font-semibold text-ink tabular-nums">{itemsTotal.toLocaleString()}</span>
                </div>
                {extraCharge > 0 && (
                  <div className="flex justify-between items-center gap-3 px-5 py-3 border-b border-line text-muted">
                    <span className="min-w-0 break-words">{extraChargeNote || t('x2_extra_charge')}</span>
                    <span className="font-semibold text-extra tabular-nums">+{extraCharge.toLocaleString()}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between items-center px-5 py-3 border-b border-line text-muted">
                    <span>{t('discount')}</span>
                    <span className="font-semibold text-debt tabular-nums">-{discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center px-5 py-3 border-b border-line text-muted">
                  <span>{t('previous_balance')}{balanceIsEstimate ? ` ${t('est')}` : ''}</span>
                  <span className="font-semibold text-ink tabular-nums">{balance.toLocaleString()}</span>
                </div>
                <div className="px-5 py-4 bg-band border-b border-line">
                  <span className="block text-sm text-muted">{t('final_total')}</span>
                  <span className="block text-3xl font-semibold text-ink tabular-nums">{finalTotal.toLocaleString()} <span className="text-sm font-medium text-muted">MMK</span></span>
                </div>
                <div className="px-5 py-4 space-y-1 border-b border-line">
                  <label className={lab}>{t('paid_amount')}</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={`${inp} !h-14 text-2xl font-semibold`}
                    placeholder="0"
                    value={paidAmount}
                    onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                    onChange={(e) => setPaidAmount(e.target.value)}
                  />
                </div>
                <div className={`px-5 py-4 ${remainingBalance > 0 ? 'bg-debt-bg' : 'bg-ok-bg'}`}>
                  <span className="block text-sm text-muted">{t('remaining_balance')}</span>
                  <span className={`block text-2xl font-semibold tabular-nums ${remainingBalance > 0 ? 'text-debt' : 'text-ok'}`}>
                    {remainingBalance.toLocaleString()} <span className="text-sm font-medium text-muted">MMK</span>
                  </span>
                </div>

                {parseFloat(paidAmount) > 0 && (
                  <div className="px-5 py-4 space-y-2 border-t border-line">
                    <label className={lab}>{t('payment_method')}</label>
                    <SplitPicker
                      total={paidAmount}
                      split={splitMode}
                      onSplitChange={setSplitMode}
                      parts={parts}
                      onParts={setParts}
                      method={paymentMethod}
                      single={(
                        <div className="grid grid-cols-3 gap-3">
                          {paymentMethods.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setPaymentMethod(m.id)}
                              className={`flex flex-col items-center justify-center min-h-[var(--ctl)] p-2 rounded-xl border transition-all gap-1 ${
                                paymentMethod === m.id
                                  ? `${m.active} border-transparent`
                                  : 'bg-row border-line-strong text-ink hover:bg-band'
                              }`}
                            >
                              <m.icon size={20} />
                              <span className="text-sm font-semibold">{m.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    />
                  </div>
                )}

                <div className="hidden xl:block p-5 border-t border-line">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full h-14 rounded-xl text-on-accent text-lg font-semibold transition-all flex items-center justify-center gap-3 ${
                      loading ? 'bg-accent/40' : 'bg-accent hover:opacity-90'
                    }`}
                  >
                    <Save size={22} />
                    {loading ? t('saving') : t('save_voucher')}
                  </button>
                </div>
              </section>
            </aside>

            {/* Phone and tablet: total and Save stay on screen (above the phone tab bar, beside the tablet/laptop sidebar) */}
            <div className="xl:hidden fixed left-0 min-[600px]:left-24 lg:left-60 right-0 bottom-[calc(4.4rem+env(safe-area-inset-bottom))] min-[600px]:bottom-0 z-30 bg-row border-t border-line-strong px-4 py-2 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <span className="block text-sm text-muted leading-tight">{t('final_total')}</span>
                <span className="block text-xl font-semibold text-ink whitespace-nowrap tabular-nums">{finalTotal.toLocaleString()} <span className="text-sm">MMK</span></span>
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`shrink-0 flex items-center gap-2 px-5 h-[var(--ctl)] rounded-xl text-on-accent text-base font-semibold transition-all ${
                  loading ? 'bg-accent/40' : 'bg-accent'
                }`}
              >
                <Save size={20} />
                {loading ? t('saving') : t('save_voucher')}
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
};

export default Voucher;
