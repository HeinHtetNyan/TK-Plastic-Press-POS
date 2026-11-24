import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft as ArrowLeftIcon, CreditCard as CreditCardIcon, Smartphone, Landmark, Banknote, WifiOff } from 'lucide-react';
import Layout from '../components/Layout';
import DropdownDatePicker from '../components/DropdownDatePicker';
import { customerService, paymentService } from '../services/api';
import { cacheBalance, getOfflineBalance, syncAll } from '../services/syncService';
import db, { generateUUID } from '../lib/db';
import { useLanguage } from '../context/LanguageContext';
import SplitPicker from '../components/SplitPicker';
import { emptyParts, partsToSplits, splitError, primaryMethod } from '../utils/paymentSplits';

const Payment = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [customer] = useState(location.state?.customer || null);
  const [balance, setBalance] = useState(0);
  const [balanceIsEstimate, setBalanceIsEstimate] = useState(false);

  const [amount, setAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [splitMode, setSplitMode] = useState(false);
  const [parts, setParts] = useState(emptyParts());
  const [paymentDate, setPaymentDate] = useState(new Date().toLocaleDateString('en-GB').split('/').join('-'));
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
    const serverId = customer.server_id ?? (typeof customer.id === 'number' ? customer.id : null);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return alert(t('enter_valid_amount'));

    let splits = null;
    let method = paymentMethod;
    if (splitMode) {
      const err = splitError(parts, amount);
      if (err) return alert(t(err));
      splits = partsToSplits(parts);
      method = primaryMethod(splits);
    }

    setLoading(true);

    const clientId = generateUUID();
    const now = new Date().toISOString();
    const paid = parseFloat(amount);
    const discount = parseFloat(discountAmount) || 0;
    const serverId = customer.server_id ?? (typeof customer.id === 'number' ? customer.id : null);

    const apiPayload = {
      customer_id: serverId,
      customer_client_id: customer.client_id ?? null,
      amount_paid: paid,
      discount_amount: discount,
      payment_method: method,
      payment_splits: splits,
      payment_date: paymentDate,
      note: note,
      client_id: clientId,
    };

    // ONLINE PATH: call API first; IndexedDB is best-effort
    if (navigator.onLine && serverId) {
      try {
        await paymentService.create(apiPayload);

        // Save to IndexedDB in background
        db.payments.add({
          client_id: clientId,
          server_id: null,
          customer_client_id: customer.client_id ?? `server_${serverId}`,
          customer_server_id: serverId,
          amount_paid: paid,
          discount_amount: discount,
          payment_method: method,
      payment_splits: splits,
          payment_date: paymentDate,
          note: note,
          sync_status: 'synced',
          created_at: now,
        }).catch(() => {});

        alert(t('payment_saved_successfully'));
        setLoading(false);
        navigate('/', { state: { customer } });
        return;
      } catch (apiErr) {
        // Server returned a structured error — stop here
        if (apiErr.response) {
          setLoading(false);
          return alert(apiErr.response.data?.detail || t('error_saving_payment'));
        }
        // Network error (tunnel down, server unreachable) — fall through to offline save
        console.warn('[Payment] API unreachable, saving offline...');
      }
    }

    // OFFLINE PATH: IndexedDB is required
    try {
      // Wrap both writes in one transaction — either both succeed or neither does
      await db.transaction('rw', db.payments, db.sync_queue, async () => {
        await db.payments.add({
          client_id: clientId,
          server_id: null,
          customer_client_id: customer.client_id ?? `server_${serverId}`,
          customer_server_id: serverId,
          amount_paid: paid,
          discount_amount: discount,
          payment_method: method,
      payment_splits: splits,
          payment_date: paymentDate,
          note: note,
          sync_status: 'pending',
          created_at: now,
        });
        await db.sync_queue.add({
          client_id: clientId,
          type: 'payment',
          action: 'create',
          payload: { ...apiPayload },
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
    { id: 'CASH', label: t('cash'), icon: Banknote, color: 'text-ok', bg: 'bg-ok-bg', border: 'border-ok/30', active: 'bg-ok text-on-accent' },
    { id: 'KBZPAY', label: t('kbzpay'), icon: Smartphone, color: 'text-accent', bg: 'bg-band', border: 'border-line', active: 'bg-accent text-on-accent' },
    { id: 'BANK_TRANSFER', label: t('bank_transfer'), icon: Landmark, color: 'text-m-bank', bg: 'bg-band', border: 'border-m-bank/40', active: 'bg-m-bank text-on-accent' },
  ];

  const payNow = parseFloat(amount) || 0;
  const payDiscount = parseFloat(discountAmount) || 0;
  const debtAfter = balance - payNow - payDiscount;

  return (
    <Layout>
      <div className="space-y-4 pb-36 xl:pb-12 max-w-[1100px] mx-auto">
        <header className="flex items-center gap-3">
          <button onClick={() => navigate('/', { state: { customer } })} aria-label="Back" className="w-[var(--ctl)] h-[var(--ctl)] flex items-center justify-center bg-row shadow-sm rounded-xl hover:bg-band transition-all">
            <ArrowLeftIcon size={22} className="text-ink" />
          </button>
          <h2 className="text-xl sm:text-2xl font-semibold text-ink">{t('add_payment')}</h2>
        </header>

        {!navigator.onLine && (
          <div className="flex items-center gap-2 bg-extra-bg text-extra text-base font-medium px-4 py-3 rounded-xl">
            <WifiOff size={14} />
            {t('offline_payment_notice')}
          </div>
        )}

        {customer && (
          <form onSubmit={handleSubmit} className="space-y-4 xl:space-y-0 xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-6 xl:items-start">
            {/* Who pays and what they owe. On wide screens this sits on the right and stays in view. */}
            <aside className="min-w-0 xl:col-start-2 xl:row-start-1 xl:sticky xl:top-4">
              <section className="bg-row rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4">
                  <span className="block text-sm text-muted">{t('customer')}</span>
                  <p className="text-xl font-semibold text-ink break-words">{customer.name}</p>
                </div>
                <div className={`px-5 py-4 border-t border-line ${balance > 0 ? 'bg-debt-bg' : 'bg-ok-bg'}`}>
                  <span className="block text-sm text-muted">{balanceIsEstimate ? t('current_debt_est') : t('current_debt')}</span>
                  <span className={`block text-3xl font-semibold tabular-nums ${balance > 0 ? 'text-debt' : 'text-ok'}`}>{balance.toLocaleString()} <span className="text-sm font-medium text-muted">MMK</span></span>
                </div>
                <div className="flex justify-between items-center gap-3 px-5 py-3 border-t border-line text-muted">
                  <span>{t('payment_amount')} + {t('discount')}</span>
                  <span className="font-semibold text-ink tabular-nums">{(payNow + payDiscount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center gap-3 px-5 py-3 border-t border-line bg-band">
                  <span className="font-semibold text-ink">{t('remaining_balance')}</span>
                  <span className={`text-xl font-semibold tabular-nums ${debtAfter > 0 ? 'text-debt' : 'text-ok'}`}>{debtAfter.toLocaleString()} <span className="text-sm font-medium text-muted">MMK</span></span>
                </div>
                <div className="hidden xl:block p-5 border-t border-line">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full h-14 rounded-xl text-on-accent text-lg font-semibold transition-all flex items-center justify-center gap-3 ${
                      loading ? 'bg-ok/50' : 'bg-ok hover:opacity-90'
                    }`}
                  >
                    <CreditCardIcon size={22} />
                    {loading ? t('saving') : t('save_payment')}
                  </button>
                </div>
              </section>
            </aside>

            <div className="space-y-4 min-w-0 xl:col-start-1 xl:row-start-1">
              {/* Amount is the one thing the owner types every time, so it gets the big green box; discount sits beside it */}
              <section className="bg-row rounded-2xl shadow-sm px-5 py-5 grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted">{t('payment_amount')}</label>
                  <input
                    autoFocus type="number" step="any"
                    className="w-full px-3 h-16 bg-ok-bg border border-transparent rounded-xl outline-none focus:border-ok focus:ring-1 focus:ring-ok text-3xl font-semibold text-ok text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="0"
                    value={amount}
                    onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted">{t('discount')} <span className="font-normal">({t('optional')})</span></label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="w-full px-3 h-16 bg-row border border-line-strong rounded-xl outline-none focus:border-accent focus:ring-1 focus:ring-accent text-xl font-semibold text-ink text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="0"
                    value={discountAmount}
                    onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                  />
                </div>
              </section>

              <section className="bg-row rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 space-y-2">
                  <label className="text-sm font-medium text-muted">{t('payment_method')}</label>
                  <SplitPicker
                    total={amount}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-line border-t border-line">
                  <div className="bg-row px-5 py-4 min-w-0">
                    <DropdownDatePicker
                      label={t('payment_date')}
                      value={paymentDate}
                      onChange={setPaymentDate}
                    />
                  </div>
                  <div className="bg-row px-5 py-4 space-y-1 min-w-0">
                    <label className="text-sm font-medium text-muted">{t('note_optional')}</label>
                    <textarea
                      className="w-full p-3 bg-row border border-line-strong rounded-xl outline-none focus:border-accent focus:ring-1 focus:ring-accent font-medium"
                      rows="2"
                      placeholder={t('note_placeholder')}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* Phone and tablet: the Save button stays on screen (above the phone tab bar, beside the tablet/laptop sidebar) */}
            <div className="xl:hidden fixed left-0 min-[600px]:left-24 lg:left-60 right-0 bottom-[calc(4.4rem+env(safe-area-inset-bottom))] min-[600px]:bottom-0 z-30 bg-row border-t border-line-strong px-4 py-2 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <span className="block text-sm text-muted leading-tight">{t('remaining_balance')}</span>
                <span className={`block text-xl font-semibold whitespace-nowrap tabular-nums ${debtAfter > 0 ? 'text-debt' : 'text-ok'}`}>{debtAfter.toLocaleString()} <span className="text-sm">MMK</span></span>
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`shrink-0 flex items-center gap-2 px-5 h-[var(--ctl)] rounded-xl text-on-accent text-base font-semibold transition-all ${
                  loading ? 'bg-ok/50' : 'bg-ok'
                }`}
              >
                <CreditCardIcon size={20} />
                {loading ? t('saving') : t('save_payment')}
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
};

export default Payment;
