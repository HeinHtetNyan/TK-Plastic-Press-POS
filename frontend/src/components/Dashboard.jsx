import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import Pager from './Pager';
import { paginate } from '../utils/paginate';
import { stockService } from '../services/api';

const fmt = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const TIP = { borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--row)', color: 'var(--ink)', boxShadow: 'none', fontWeight: 600 };

const Note = ({ children }) => <span className="text-sm text-muted block mt-1">{children}</span>;

const Panel = ({ title, icon: Icon, children }) => (
  <section className="bg-row rounded-2xl shadow-sm overflow-hidden min-w-0">
    <h3 className="bg-row px-4 py-3 text-base font-semibold text-ink flex items-center gap-2 border-b border-line">
      {Icon && <Icon size={18} className="text-accent" />}{title}
    </h3>
    <div className="p-4">{children}</div>
  </section>
);

// One figure inside a grouped panel: label, big number, notes under it. Cells are separated by thin lines (gap-px on a line-coloured grid).
const Cell = ({ label, tone = 'text-ink', value, unit = 'MMK', big = false, children }) => (
  <div className="bg-row px-5 py-4 min-w-0 flex flex-col gap-0.5">
    <span className="text-[length:var(--sfs)] text-muted">{label}</span>
    <span className={`${big ? 'text-[1.7rem]' : 'text-2xl'} font-semibold tabular-nums leading-tight flex flex-wrap items-baseline gap-x-1.5 ${tone}`}>
      <span className="whitespace-nowrap">{value}</span>{unit && <span className="text-sm font-medium text-muted whitespace-nowrap">{unit}</span>}
    </span>
    {children}
  </div>
);

const Dashboard = ({ data }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [debtPage, setDebtPage] = useState(1);
  const [alerts, setAlerts] = useState(null);
  useEffect(() => {
    let alive = true;
    stockService.alerts().then((r) => alive && setAlerts(r.data)).catch(() => alive && setAlerts(null));
    return () => { alive = false; };
  }, []);
  if (!data) return null;
  const debts = paginate(data.debt_list || [], debtPage, 18);

  const periodLabel =
    data.period === '3months' ? t('x_last_3m') :
    data.period === '6months' ? t('x_last_6m') :
    data.period === '1year'   ? t('x_last_1y') :
    t('x_p_month');
  const totalSpending = data.total_spending ?? 0;
  const netIncome = (data.total_revenue ?? 0) - totalSpending;

  const paymentMethods = [
    { id: 'CASH', label: t('cash'), tone: 'bg-m-cash' },
    { id: 'KBZPAY', label: t('kbzpay'), tone: 'bg-m-kbz' },
    { id: 'BANK_TRANSFER', label: t('x_bank'), tone: 'bg-m-bank' },
  ];
  const methodIncome = paymentMethods.map((m) => ({ ...m, income: data.income_by_method?.find(x => x.method === m.id)?.amount || 0 }));
  const methodTotal = methodIncome.reduce((a, m) => a + m.income, 0);

  const hasMoney = !!data.cash;
  const hasProfit = !!data.profit;
  const moneyCols = 2 + (hasMoney ? 1 : 0) + (hasProfit ? 1 : 0);
  const stockCells = 1 + (data.stock_value != null ? 1 : 0) + (alerts && alerts.total === 0 ? 1 : 0);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Panel 1: money for the chosen period. Cells share one rounded card, divided by thin lines. */}
      <section className="bg-row rounded-2xl shadow-sm overflow-hidden min-w-0">
        <h3 className="px-5 pt-4 text-[length:var(--sfs)] font-semibold text-muted">{periodLabel}</h3>
        <div className={`mt-3 grid grid-cols-1 sm:grid-cols-2 ${moneyCols >= 4 ? 'xl:grid-cols-4' : moneyCols === 3 ? 'xl:grid-cols-3' : ''} gap-px bg-line border-t border-line`}>
          <Cell label={t('x_total_revenue')} big value={fmt(data.total_revenue)} />
          <Cell label={t('net_income')} tone={netIncome >= 0 ? 'text-ok' : 'text-extra'} value={fmt(netIncome)}>
            <Note>{t('total_spending')}: {fmt(totalSpending)} MMK</Note>
            <Note>{t('x3_net_note')}</Note>
          </Cell>
          {hasMoney && (
            <Cell label={t('x4_cash_title')} tone={data.cash.cash >= 0 ? 'text-ok' : 'text-extra'} value={Math.round(data.cash.cash).toLocaleString()}>
              <Note>{t('x4_cash_in')} {Math.round(data.cash.money_in).toLocaleString()} &minus; {t('x4_cash_factory')} {Math.round(data.cash.factory_out).toLocaleString()} &minus; {t('x4_cash_spending')} {Math.round(data.cash.spending).toLocaleString()}</Note>
              <Note>{t('x4_cash_note')}</Note>
            </Cell>
          )}
          {hasProfit && (
            <Cell label={t('x3_profit_title')} tone={data.profit.gross_profit >= 0 ? 'text-ok' : 'text-debt'} value={data.profit.gross_profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}>
              <Note>{t('x3_plastic_sales')} {Math.round(data.profit.sales).toLocaleString()} &minus; {t('x3_plastic_cost')} {Math.round(data.profit.cost).toLocaleString()}</Note>
              <span className="text-sm text-ink font-semibold block mt-1">
                {t('x3_after_spending')}: <span className={data.profit.net_profit >= 0 ? 'text-ok' : 'text-debt'}>{Math.round(data.profit.net_profit).toLocaleString()}</span> MMK
              </span>
              {data.profit.items_without_cost > 0 && (
                <span className="text-sm text-extra block mt-1">{t('x3_no_cost_warn').replace('{n}', data.profit.items_without_cost)}</span>
              )}
            </Cell>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 min-[900px]:grid-cols-2 gap-4 items-start">
        {/* Panel 2: what is owed and what is in stock */}
        <section className="bg-row rounded-2xl shadow-sm overflow-hidden min-w-0">
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-px bg-line ${stockCells === 1 ? 'sm:grid-cols-1' : ''}`}>
            <Cell label={t('x_total_debt')} tone="text-debt" value={fmt(data.total_debt)}>
              <Note>{t('x_outstanding_debts')}</Note>
            </Cell>
            {data.stock_value != null && (
              <Cell label={t('x_stock_value')} tone="text-accent" value={Math.round(data.stock_value).toLocaleString()}>
                {alerts && alerts.total === 0 && (
                  <span className="inline-flex items-center gap-1.5 self-start mt-1 px-2.5 py-0.5 rounded-full bg-ok-bg text-ok text-sm font-medium">
                    <AlertTriangle size={14} aria-hidden="true" />{t('x3_alerts_ok')}
                  </span>
                )}
              </Cell>
            )}
            {alerts && alerts.total > 0 && (
              <div className="bg-extra-bg px-5 py-4 min-w-0 sm:col-span-2">
                <span className="text-[length:var(--sfs)] text-muted flex items-center gap-2"><AlertTriangle size={16} className="text-extra" /> {t('x3_alerts_title')}</span>
                <span className="text-sm text-muted block mt-1">
                  {alerts.negative > 0 && <span className="text-debt">{alerts.negative} {t('x3_negative')}</span>}
                  {alerts.negative > 0 && alerts.low > 0 && ' · '}
                  {alerts.low > 0 && <span className="text-extra">{alerts.low} {t('x3_low')} (&le; {alerts.low_lb} lb)</span>}
                </span>
                <div className="mt-2 space-y-1">
                  {alerts.items.slice(0, 6).map((i) => (
                    <div key={i.id} className="flex justify-between gap-2 text-base">
                      <span className="min-w-0 break-words text-ink">{i.size} / {i.color}{i.gate ? ` / ${i.gate}` : ''}</span>
                      <span className={`whitespace-nowrap font-semibold ${i.kind === 'NEGATIVE' ? 'text-debt' : 'text-extra'}`}>{Math.round(i.qty_lb * 100) / 100} lb</span>
                    </div>
                  ))}
                  {alerts.total > 6 && <div className="text-sm text-muted">+ {alerts.total - 6} {t('x3_more')}</div>}
                </div>
                <button type="button" onClick={() => navigate('/stock')} className="mt-3 px-4 min-h-[var(--ctl)] rounded-xl bg-row border border-extra/40 text-extra font-semibold text-base hover:bg-extra-bg">{t('x3_open_stock')}</button>
              </div>
            )}
          </div>
        </section>

        {/* Panel 3: income by payment method, with one stacked bar showing the split */}
        <section className="bg-row rounded-2xl shadow-sm overflow-hidden min-w-0">
          <h3 className="px-5 pt-4 text-[length:var(--sfs)] font-semibold text-muted">{t('x_income_by_method')} · {periodLabel}</h3>
          <div className="flex h-2.5 mx-5 mt-3 mb-3 rounded-full overflow-hidden bg-band" role="img" aria-label={t('x_income_by_method')}>
            {methodIncome.map((m) => (
              <span key={m.id} className={m.tone} style={{ width: `${methodTotal > 0 ? (m.income / methodTotal) * 100 : 0}%` }} />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line border-t border-line">
            {methodIncome.map((m) => (
              <div key={m.id} className="bg-row px-5 py-3 min-w-0">
                <span className="text-[length:var(--sfs)] text-muted flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${m.tone}`} />{m.label}</span>
                <span className="text-xl font-semibold text-ink tabular-nums flex flex-wrap items-baseline gap-x-1.5"><span className="whitespace-nowrap">{m.income.toLocaleString()}</span><span className="text-sm font-medium text-muted whitespace-nowrap">MMK</span></span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title={t('x_daily_sales')} icon={TrendingUp}>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.daily_sales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="date" hide={true} />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={TIP} formatter={(value) => [value.toLocaleString() + ' MMK', 'Revenue']} />
                <Line type="monotone" dataKey="amount" stroke="var(--accent)" strokeWidth={2.5}
                  dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title={<>{t('x_top_customers')} <span className="font-normal text-muted">({periodLabel})</span></>} icon={Users}>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top_customers} layout="vertical" margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line)" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12, fill: 'var(--ink)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TIP} formatter={(value) => [value.toLocaleString() + ' MMK', 'Revenue']} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]} fill="var(--accent)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Customer debts */}
      <section className="bg-row rounded-2xl shadow-sm overflow-hidden">
        <h3 className="bg-row px-4 py-3 text-base font-semibold text-ink border-b border-line">{t('x_outstanding_debts')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
          {debts.rows.map((c, index) => (
            <div key={index} className={`rounded-xl px-4 py-3 min-w-0 flex justify-between items-center gap-3 ${c.debt > 0 ? 'bg-debt-bg' : 'bg-ok-bg/50'}`}>
              <div className="min-w-0">
                <span className="text-base font-semibold text-ink block truncate">{c.name}</span>
                <span className={`text-sm ${c.debt > 0 ? 'text-debt' : 'text-ok'}`}>
                  <span className="font-semibold">{c.debt > 0 ? t('x_pending') : t('x_clear')}</span> &middot; {c.debt > 0 ? t('x_outstanding_debt') : t('x_account_balance')}
                </span>
              </div>
              <span className={`text-base font-semibold tabular-nums text-right ${c.debt > 0 ? 'text-debt' : 'text-ok'}`}>
                {c.debt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-medium text-muted">MMK</span>
              </span>
            </div>
          ))}
          {(!data.debt_list || data.debt_list.length === 0) && (
            <div className="col-span-full py-8 text-center text-muted">{t('x_no_customers')}</div>
          )}
        </div>
        <div className="px-4"><Pager page={debts.page} pages={debts.pages} onChange={setDebtPage} /></div>
      </section>
    </div>
  );
};

export default Dashboard;
