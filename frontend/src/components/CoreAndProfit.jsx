import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, TrendingUp, X, ChevronRight } from 'lucide-react';
import { stockService } from '../services/api';
import { shopNow } from '../utils/shopTime';
import { useLanguage } from '../context/LanguageContext';
import Pager from './Pager';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const periodRange = (p) => {
  const now = shopNow();
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
            className={`px-1 lg:px-5 min-h-[var(--ctl)] rounded-full font-medium text-sm lg:text-base leading-tight ${period === id ? 'bg-accent text-on-accent font-semibold' : 'bg-row text-ink border border-line-strong'}`}>
            {t(key)}
          </button>
        ))}
      </div>

      {/* Panel: cardboard core + profit share one card, divided by a thin line */}
      <section className="bg-row rounded-2xl shadow-sm overflow-hidden min-w-0">
        <div className={`grid gap-px bg-line ${admin ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
          <button type="button" onClick={openHistory}
            className="text-left bg-row px-5 py-4 hover:bg-zebra transition-colors min-w-0 flex flex-col gap-0.5">
            <span className="text-[length:var(--sfs)] text-muted flex items-center gap-1.5"><Package size={16} className="text-extra" /> {t('core_weight')}</span>
            <span className="flex items-baseline gap-1.5"><span className="text-2xl font-semibold text-ink tabular-nums">{lbFmt(core?.total_lb)}</span><span className="text-sm text-muted font-medium">lb</span></span>
            <span className="mt-1 flex items-center justify-between gap-2 text-[length:var(--sfs)] font-medium text-accent">
              <span>{core?.count || 0} {t('x_vouchers')} &middot; {t('x_see_all_history')}</span>
              <ChevronRight size={18} className="shrink-0" />
            </span>
          </button>

          {admin && (
            <div className="bg-row px-5 py-4 min-w-0 flex flex-col gap-0.5">
              <span className="text-[length:var(--sfs)] text-muted flex items-center gap-1.5"><TrendingUp size={16} className="text-ok" /> {t('x_profit')}</span>
              <span className="flex flex-wrap items-baseline gap-x-1.5"><span className={`text-2xl font-semibold tabular-nums ${(profit?.profit || 0) < 0 ? 'text-debt' : 'text-ok'}`}>{money(profit?.profit)}</span><span className="text-sm text-muted font-medium">MMK</span></span>
              {profit && (
                <div className="mt-1 text-sm text-muted space-y-0.5">
                  <div>{t('x_sales')} {money(profit.sales)} &minus; {t('x_cost_word')} {money(profit.cost)}{profit.margin_pct != null ? ` (${profit.margin_pct}%)` : ''}</div>
                  {profit.items_without_cost > 0 && (
                    <div className="text-extra">{t('x3_no_cost_warn').replace('{n}', profit.items_without_cost)} ({money(profit.sales_without_cost)} MMK)</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {admin && (
        <div className="bg-row p-4 rounded-2xl shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-base font-semibold text-ink flex items-center gap-2"><TrendingUp size={16} className="text-ok" /> {t('x3_profit_by')}</span>
            <div className="flex gap-2">
              {[['customer', 'x3_by_customer'], ['size', 'x3_by_size']].map(([id, key]) => (
                <button key={id} onClick={() => { setPbBy(id); setPbPage(1); }}
                  className={`px-4 min-h-[44px] rounded-full font-medium text-base ${pbBy === id ? 'bg-accent text-on-accent font-semibold' : 'bg-row text-ink border border-line-strong'}`}>{t(key)}</button>
              ))}
            </div>
          </div>
          {pbLoading && !pb && <div className="py-6 text-center text-muted animate-pulse">{t('x_loading')}</div>}
          {pb && pb.rows.length === 0 && <div className="py-6 text-center text-muted">{t('x3_no_profit_data')}</div>}
          {pb && pb.rows.length > 0 && (
            <div className="divide-y divide-line">
              {pb.rows.map((r) => (
                <div key={r.name} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink break-words">{r.name}</div>
                    <div className="text-sm text-muted">{t('x_sales')} {money(r.sales)} &minus; {t('x_cost_word')} {money(r.cost)} &middot; {r.items} {t('x3_items')}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-lg font-semibold tabular-nums ${r.profit < 0 ? 'text-debt' : 'text-ok'}`}>{money(r.profit)}</div>
                    {r.margin_pct != null && <div className="text-sm text-muted">{t('x3_margin')} {r.margin_pct}%</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {pb && <Pager page={pb.page} pages={pb.pages} onChange={setPbPage} disabled={pbLoading} />}
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-40 bg-[var(--scrim)] flex items-end sm:items-center justify-center sm:p-4" onClick={() => setHistoryOpen(false)}>
          <div className="bg-row rounded-t-3xl sm:rounded-3xl shadow-lg w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-line">
              <div>
                <h3 className="text-lg font-semibold text-ink">{t('core_weight')} - {t('x_all_history')}</h3>
                <p className="text-base font-medium text-extra">{history ? `${t('total')} ${lbFmt(history.total_lb)} lb \u00b7 ${history.count} ${t('x_vouchers')}` : '...'}</p>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="w-11 h-11 flex items-center justify-center text-muted hover:bg-band rounded-xl"><X size={20} /></button>
            </div>
            <div className="flex gap-2 p-3 border-b border-line">
              <button onClick={() => setCoreView('vouchers')} className={`px-4 min-h-[44px] rounded-full font-medium text-base ${coreView === 'vouchers' ? 'bg-accent text-on-accent font-semibold' : 'bg-row text-ink border border-line-strong'}`}>{t('x3_core_vouchers')}</button>
              <button onClick={() => { setCoreView('customers'); if (!byCust) loadByCustomer(1); }} className={`px-4 min-h-[44px] rounded-full font-medium text-base ${coreView === 'customers' ? 'bg-accent text-on-accent font-semibold' : 'bg-row text-ink border border-line-strong'}`}>{t('x3_core_by_customer')}</button>
            </div>
            <div className="overflow-auto divide-y divide-line">
              {historyLoading && <div className="p-8 text-center text-muted animate-pulse">{t('x_loading')}</div>}
              {!historyLoading && coreView === 'vouchers' && history && history.vouchers.length === 0 && <div className="p-8 text-center text-muted font-bold">{t('x2_no_core')}</div>}
              {coreView === 'vouchers' && history?.vouchers.map((v) => (
                <button key={v.id} type="button" onClick={() => openVoucher(v)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-band active:bg-band">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink break-words">{v.customer}</span>
                    <span className="block text-base text-muted">{v.date} &middot; #{v.voucher_number}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xl font-semibold text-ink tabular-nums">{v.core_weight_lb} <span className="text-base text-muted">lb</span></span>
                    <ChevronRight size={20} className="text-muted" />
                  </span>
                </button>
              ))}
              {coreView === 'customers' && byCust?.customers.map((c) => (
                <button key={c.customer_id} type="button"
                  onClick={() => navigate('/history', { state: { customer: { id: c.customer_id, server_id: c.customer_id, client_id: `server_${c.customer_id}`, name: c.customer } } })}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-band active:bg-band">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink break-words">{c.customer}</span>
                    <span className="block text-base text-muted">{c.vouchers} {t('x_vouchers')}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xl font-semibold text-ink tabular-nums">{lbFmt(c.lb)} <span className="text-base text-muted">lb</span></span>
                    <ChevronRight size={20} className="text-muted" />
                  </span>
                </button>
              ))}
              {coreView === 'customers' && !historyLoading && byCust && byCust.customers.length === 0 && <div className="p-8 text-center text-muted font-bold">{t('x2_no_core')}</div>}
            </div>
            {coreView === 'vouchers'
              ? <Pager page={history?.page || 1} pages={history?.pages || 1} onChange={loadHistory} disabled={historyLoading} className="p-3 border-t border-line" />
              : <Pager page={byCust?.page || 1} pages={byCust?.pages || 1} onChange={loadByCustomer} disabled={historyLoading} className="p-3 border-t border-line" />}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoreAndProfit;
