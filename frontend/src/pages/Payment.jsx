import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft as ArrowLeftIcon, CreditCard as CreditCardIcon, Smartphone, Landmark, Banknote, WifiOff } from 'lucide-react';
import Layout from '../components/Layout';
import DropdownDatePicker from '../components/DropdownDatePicker';
import { customerService, paymentService } from '../services/api';
import { cacheBalance, getOfflineBalance, syncAll } from '../services/syncService';
import BalanceDisplay from '../components/BalanceDisplay';
import db, { generateUUID } from '../lib/db';
import { useLanguage } from '../context/LanguageContext';

const Payment = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [customer] = useState(location.state?.customer || null);
  const [balance, setBalance] = useState(0);
  const [balanceIsEstimate, setBalanceIsEstimate] = useState(false);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return alert(t('enter_valid_amount'));

    setLoading(true);

    const clientId = generateUUID();
    const now = new Date().toISOString();
    const paid = parseFloat(amount);
    const serverId = customer.server_id ?? (typeof customer.id === 'number' ? customer.id : null);

    const apiPayload = {
      customer_id: serverId,
      amount_paid: paid,
      payment_method: paymentMethod,
      payment_date: paymentDate,
      note: note,
      client_id: clientId,
    };

    // ── ONLINE PATH: call API first; IndexedDB is best-effort ──────────
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
          payment_method: paymentMethod,
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

    // ── OFFLINE PATH: IndexedDB is required ────────────────────────────
    try {
      // Wrap both writes in one transaction — either both succeed or neither does
      await db.transaction('rw', db.payments, db.sync_queue, async () => {
        await db.payments.add({
          client_id: clientId,
          server_id: null,
          customer_client_id: customer.client_id ?? `server_${serverId}`,
          customer_server_id: serverId,
          amount_paid: paid,
          payment_method: paymentMethod,
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
    { id: 'CASH', label: t('cash'), icon: Banknote, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', active: 'bg-green-600 text-white' },
    { id: 'KBZPAY', label: t('kbzpay'), icon: Smartphone, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', active: 'bg-blue-600 text-white' },
    { id: 'BANK_TRANSFER', label: t('bank_transfer'), icon: Landmark, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', active: 'bg-purple-600 text-white' },
  ];

  return (
    <Layout>
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
        <header className="flex items-center gap-4">
          <button onClick={() => navigate('/', { state: { customer } })} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-all">
            <ArrowLeftIcon size={24} className="text-gray-600" />
          </button>
          <h2 className="text-2xl font-black text-gray-800">{t('add_payment')}</h2>
        </header>

        {!navigator.onLine && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs font-bold px-4 py-3 rounded-xl">
            <WifiOff size={14} />
            {t('offline_payment_notice')}
          </div>
        )}

        {customer && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <span className="text-xs font-bold text-gray-400 uppercase px-1">{t('customer')}</span>
              <p className="text-xl font-black text-blue-600 truncate">{customer.name}</p>
            </div>

            <BalanceDisplay balance={balance} label={balanceIsEstimate ? t('current_debt_est') : t('current_debt')} />

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-black text-gray-600 uppercase px-1">{t('payment_amount')}</label>
                  <input
                    autoFocus required type="number" min="1" step="1"
                    className="w-full p-4 bg-green-50 border-2 border-green-100 rounded-2xl outline-none focus:border-green-500 transition-all text-3xl font-black text-green-700 text-center"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <DropdownDatePicker
                    label={t('payment_date')}
                    value={paymentDate}
                    onChange={setPaymentDate}
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-600 uppercase px-1">{t('payment_method')}</label>
                    <div className="grid grid-cols-3 gap-2">
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

                  <div className="space-y-1">
                    <label className="text-sm font-bold text-gray-600 uppercase px-1">{t('note_optional')}</label>
                    <textarea
                      className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 font-bold transition-all"
                      rows="2"
                      placeholder={t('note_placeholder')}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full p-5 rounded-3xl text-white text-xl font-black shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-4 ${
                  loading ? 'bg-green-300' : 'bg-green-600 hover:bg-green-700 active:scale-95'
                }`}
              >
                <CreditCardIcon size={28} />
                {loading ? t('saving') : t('save_payment')}
              </button>
            </form>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Payment;
