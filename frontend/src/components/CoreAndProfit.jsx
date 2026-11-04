import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, TrendingUp, X, ChevronRight } from 'lucide-react';
import { stockService } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import Pager from './Pager';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const periodRange = (p) => {
  const now = new Date();
  if (p === 'today') return [iso(now), iso(now)];
  if (p === 'week') { const s = new Date(now); s.setDate(s.getDate() - 6); return [iso(s), iso(now)]; }
  if (p === 'month') return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(now)];
  return [undefined, undefined];
};

const PERIODS = [['today', 'x_period_today'], ['week', 'x_period_week'], ['month', 'x_period_month'], ['all', 'x_period_all']];
const money = (v) => Math.round(v || 0).toLocaleString();
const lbFmt = (v) => Math.round((v || 0) * 100) / 100;

/** Reports cards: Cardboard Core total (everyone) and profit on plastic sold (admin only). */
const CoreAndProfit = ({ admin }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [period, setPeriod] = useState('month');
  const [core, setCore] = useState(null);
  const [profit, setProfit] = useState(null);
  const [history, setHistory] = useState(null); // all-time core history, loaded when the card is opened
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [coreView, setCoreView] = useState('vouchers'); // vouchers | customers
  const [byCust, setByCust] = useState(null);
  const [pbBy, setPbBy] = useState('customer');
  const [pbPage, setPbPage] = useState(1);
  const [pb, setPb] = useState(null);
  const [pbLoading, setPbLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const [start, end] = periodRange(period);
    stockService.coreWeight(start, end, 1, 1).then((r) => alive && setCore(r.data)).catch(() => alive && setCore(null));
    if (admin) stockService.profit(start, end).then((r) => alive && setProfit(r.data)).catch(() => alive && setProfit(null));
    return () => { alive = false; };
  }, [period, admin]);

  useEffect(() => {
    if (!admin) return undefined;
    let alive = true;
    const [start, end] = periodRange(period);
    setPbLoading(true);
    stockService.profitBreakdown(pbBy, start, end, pbPage)
      .then((r) => { if (alive) { setPb(r.data); if (r.data.page !== pbPage) setPbPage(r.data.page); } })
      .catch(() => alive && setPb(null))
      .finally(() => alive && setPbLoading(false));
    return () => { alive = false; };
  }, [admin, period, pbBy, pbPage]);

  const loadByCustomer = async (page) => {
    setHistoryLoading(true);
    try { setByCust((await stockService.coreByCustomer(page)).data); } catch { setByCust(null); } finally { setHistoryLoading(false); }
  };

  const loadHistory = async (page) => {
    setHistoryLoading(true);
    try {
      setHistory((await stockService.coreWeight(undefined, undefined, page, 20)).data);
    } catch {
      setHistoryOpen(false);
      alert('Could not load the cardboard core history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = () => {
    setHistory(null);
    setByCust(null);
    setCoreView('vouchers');
    setHistoryOpen(true);
    loadHistory(1);
  };

  const openVoucher = (v) => {
    navigate('/history', {
      state: {
        customer: { id: v.customer_id, server_id: v.customer_id, client_id: `server_${v.customer_id}`, name: v.customer },
        openVoucherId: v.id,
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 lg:flex lg:flex-wrap">
        {PERIODS.map(([id, key]) => (
          <button key={id} onClick={() => setPeriod(id)}
            className={`px-1 lg:px-3 py-2.5 lg:py-2 rounded-xl font-black text-sm leading-tight uppercase tracking-wide ${period === id ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border-2 border-gray-100'}`}>
            {t(key)}
          </button>
        ))}
      </div>

      <div className={`grid gap-3 ${admin ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        <button type="button" onClick={openHistory}
          className="text-left bg-white p-4 rounded-2xl shadow-sm border border-amber-100 hover:border-amber-300 hover:shadow-md active:scale-[0.99] transition-all">
          <span className="text-sm font-black text-amber-500 uppercase block tracking-widest mb-1 flex items-center gap-1"><Package size={12} /> {t('core_weight')}</span>
          <span className="text-2xl font-black text-amber-700">{lbFmt(core?.total_lb)}</span> <span className="text-gray-400 font-bold">lb</span>
          <span className="mt-1 flex items-center justify-between text-base font-black text-blue-600">
            <span>{core?.count || 0} {t('x_vouchers')} &middot; {t('x_see_all_history')}</span>
            <ChevronRight size={18} />
          </span>
        </button>

        {admin && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-green-100">
            <span className="text-sm font-black text-green-600 uppercase block tracking-widest mb-1 flex items-center gap-1"><TrendingUp size={12} /> {t('x_profit')}</span>
            <span className={`text-2xl font-black ${(profit?.profit || 0) < 0 ? 'text-red-600' : 'text-green-700'}`}>{money(profit?.profit)}</span> <span className="text-gray-400 font-bold">MMK</span>
            {profit && (
              <div className="mt-1 text-base font-bold text-gray-500 space-y-0.5">
                <div>{t('x_sales')} {money(profit.sales)} &minus; {t('x_cost_word')} {money(profit.cost)}{profit.margin_pct != null ? ` (${profit.margin_pct}%)` : ''}</div>
                {profit.items_without_cost > 0 && (
                  <div className="text-orange-600">{t('x3_no_cost_warn').replace('{n}', profit.items_without_cost)} ({money(profit.sales_without_cost)} MMK)</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {admin && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-green-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-black text-green-600 uppercase tracking-widest flex items-center gap-1"><TrendingUp size={12} /> {t('x3_profit_by')}</span>
            <div className="flex gap-2">
              {[['customer', 'x3_by_customer'], ['size', 'x3_by_size']].map(([id, key]) => (
                <button key={id} onClick={() => { setPbBy(id); setPbPage(1); }}
                  className={`px-3 py-2 rounded-xl font-black text-base ${pbBy === id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{t(key)}</button>
              ))}
            </div>
          </div>
          {pbLoading && !pb && <div className="py-6 text-center text-gray-400 font-bold animate-pulse">{t('x_loading')}</div>}
          {pb && pb.rows.length === 0 && <div className="py-6 text-center text-gray-400 font-bold">{t('x3_no_profit_data')}</div>}
          {pb && pb.rows.length > 0 && (
            <div className="divide-y divide-gray-100">
              {pb.rows.map((r) => (
                <div key={r.name} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black text-gray-800 break-words">{r.name}</div>
                    <div className="text-sm font-bold text-gray-500">{t('x_sales')} {money(r.sales)} &minus; {t('x_cost_word')} {money(r.cost)} &middot; {r.items} {t('x3_items')}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-lg font-black ${r.profit < 0 ? 'text-red-600' : 'text-green-700'}`}>{money(r.profit)}</div>
                    {r.margin_pct != null && <div className="text-sm font-bold text-gray-500">{t('x3_margin')} {r.margin_pct}%</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {pb && <Pager page={pb.page} pages={pb.pages} onChange={setPbPage} disabled={pbLoading} />}
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={() => setHistoryOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-black text-gray-800">{t('core_weight')} - {t('x_all_history')}</h3>
                <p className="text-base font-bold text-amber-700">{history ? `${t('total')} ${lbFmt(history.total_lb)} lb \u00b7 ${history.count} ${t('x_vouchers')}` : '...'}</p>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="p-3 bg-gray-100 rounded-xl"><X size={20} /></button>
            </div>
            <div className="flex gap-2 p-3 border-b border-gray-100">
              <button onClick={() => setCoreView('vouchers')} className={`px-3 py-2 rounded-xl font-black text-base ${coreView === 'vouchers' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{t('x3_core_vouchers')}</button>
              <button onClick={() => { setCoreView('customers'); if (!byCust) loadByCustomer(1); }} className={`px-3 py-2 rounded-xl font-black text-base ${coreView === 'customers' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{t('x3_core_by_customer')}</button>
            </div>
            <div className="overflow-auto divide-y divide-gray-100">
              {historyLoading && <div className="p-8 text-center text-gray-400 font-bold animate-pulse">{t('x_loading')}</div>}
              {!historyLoading && coreView === 'vouchers' && history && history.vouchers.length === 0 && <div className="p-8 text-center text-gray-400 font-bold">{t('x2_no_core')}</div>}
              {coreView === 'vouchers' && history?.vouchers.map((v) => (
                <button key={v.id} type="button" onClick={() => openVoucher(v)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-blue-50 active:bg-blue-100">
                  <span className="min-w-0">
                    <span className="block font-black text-gray-800 break-words">{v.customer}</span>
                    <span className="block text-base font-bold text-gray-500">{v.date} &middot; #{v.voucher_number}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xl font-black text-amber-700">{v.core_weight_lb} <span className="text-base text-gray-400">lb</span></span>
                    <ChevronRight size={20} className="text-gray-300" />
                  </span>
                </button>
              ))}
              {coreView === 'customers' && byCust?.customers.map((c) => (
                <button key={c.customer_id} type="button"
                  onClick={() => navigate('/history', { state: { customer: { id: c.customer_id, server_id: c.customer_id, client_id: `server_${c.customer_id}`, name: c.customer } } })}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-blue-50 active:bg-blue-100">
                  <span className="min-w-0">
                    <span className="block font-black text-gray-800 break-words">{c.customer}</span>
                    <span className="block text-base font-bold text-gray-500">{c.vouchers} {t('x_vouchers')}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xl font-black text-amber-700">{lbFmt(c.lb)} <span className="text-base text-gray-400">lb</span></span>
                    <ChevronRight size={20} className="text-gray-300" />
                  </span>
                </button>
              ))}
              {coreView === 'customers' && !historyLoading && byCust && byCust.customers.length === 0 && <div className="p-8 text-center text-gray-400 font-bold">{t('x2_no_core')}</div>}
            </div>
            {coreView === 'vouchers'
              ? <Pager page={history?.page || 1} pages={history?.pages || 1} onChange={loadHistory} disabled={historyLoading} className="p-3 border-t border-gray-100" />
              : <Pager page={byCust?.page || 1} pages={byCust?.pages || 1} onChange={loadByCustomer} disabled={historyLoading} className="p-3 border-t border-gray-100" />}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoreAndProfit;
