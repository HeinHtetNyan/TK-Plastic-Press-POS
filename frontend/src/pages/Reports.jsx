import { useState, useEffect } from 'react';
import { FileText, BarChart3, ChevronDown, ChevronUp, Users, ArrowUpDown } from 'lucide-react';
import Layout from '../components/Layout';
import CoreAndProfit from '../components/CoreAndProfit';
import Pager from '../components/Pager';
import { paginate } from '../utils/paginate';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import DropdownDatePicker from '../components/DropdownDatePicker';
import { voucherService, analyticsService } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const Reports = () => {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const [vouchers, setVouchers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [expandedVoucher, setExpandedVoucher] = useState(null);

  const now = new Date();
  const currentMonthStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const today = new Date().toLocaleDateString('en-GB').split('/').join('-');

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedDate, setSelectedDate] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = newest first
  const [page, setPage] = useState(1);
  const [debtPage, setDebtPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ pages: 1, total: 0, items_total_sum: 0, months: [] });

  useEffect(() => {
    fetchVouchers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedDate, sortOrder, page]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const response = await voucherService.listPage({
        ...(selectedDate ? { date: selectedDate } : { month: selectedMonth }),
        sort: sortOrder, page, page_size: 20,
      });
      setVouchers(response.data.items || []);
      setPageInfo(response.data);
      if (response.data.page !== page) setPage(response.data.page);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const response = await analyticsService.getDashboard('3months');
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const getMonthFromDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[1]}-${parts[2]}` : "";
  };

  const filteredVouchers = vouchers;
  const months = pageInfo.months || [];
  const totalSales = pageInfo.items_total_sum || 0;

  // Format daily sales chart data — dates come as YYYY-MM-DD from analytics
  const chartData = (analytics?.daily_sales || []).map(d => ({
    date: d.date.slice(5).replace('-', '/'), // "MM/DD"
    amount: Math.round(d.amount),
  }));

  const formatMMK = (val) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
    return val.toLocaleString();
  };

  const methodRows = [
    { id: 'CASH', label: t('cash'), tone: 'bg-m-cash' },
    { id: 'KBZPAY', label: t('kbzpay'), tone: 'bg-m-kbz' },
    { id: 'BANK_TRANSFER', label: t('x_bank'), tone: 'bg-m-bank' },
  ].map((m) => ({ ...m, income: analytics?.income_by_method?.find(x => x.method === m.id)?.amount || 0 }));
  const methodTotal = methodRows.reduce((acc, m) => acc + m.income, 0);

  return (
    <Layout>
      <div className="space-y-4 pb-12 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start">

        {/* Panel 1: revenue and debt, one rounded card divided by a thin line */}
        <section className="bg-row rounded-2xl shadow-sm overflow-hidden min-w-0">
          <div className="grid grid-cols-2 gap-px bg-line h-full">
            <div className="bg-row px-5 py-4 min-w-0">
              <span className="text-[length:var(--sfs)] text-muted block">{t('x_total_revenue')}</span>
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-2xl font-semibold text-ink tabular-nums">{formatMMK(analytics?.total_revenue || 0)}</span>
                <span className="text-sm text-muted font-medium">MMK</span>
              </span>
            </div>
            <div className="bg-row px-5 py-4 min-w-0">
              <span className="text-[length:var(--sfs)] text-muted block">{t('x_total_debt')}</span>
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-2xl font-semibold text-debt tabular-nums">{formatMMK(analytics?.total_debt || 0)}</span>
                <span className="text-sm text-muted font-medium">MMK</span>
              </span>
            </div>
          </div>
        </section>

        {/* Panel 2: income by payment method, one stacked bar for the split + three divided cells */}
        <section className="bg-row rounded-2xl shadow-sm overflow-hidden min-w-0">
          <h3 className="px-5 pt-4 text-[length:var(--sfs)] font-semibold text-muted">{t('x_income_by_method')}</h3>
          <div className="flex h-2.5 mx-5 mt-3 mb-3 rounded-full overflow-hidden bg-band" role="img" aria-label={t('x_income_by_method')}>
            {methodRows.map((m) => (
              <span key={m.id} className={m.tone} style={{ width: `${methodTotal > 0 ? (m.income / methodTotal) * 100 : 0}%` }} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-px bg-line border-t border-line">
            {methodRows.map((m) => (
              <div key={m.id} className="bg-row px-4 py-3 min-w-0">
                <span className="text-[length:var(--sfs)] text-muted flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${m.tone}`} />{m.label}</span>
                <span className="text-lg font-semibold tabular-nums text-ink block">{formatMMK(m.income)}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="lg:col-span-2"><CoreAndProfit admin={isAdmin()} /></div>

        {/* Daily Sales Chart */}
        <div className="bg-row rounded-2xl shadow-sm overflow-hidden">
          <h3 className="px-4 py-3 border-b border-line text-base font-semibold text-ink flex items-center gap-2">
            <BarChart3 size={16} /> {t('x_daily_sales')}
          </h3>
          <div className="p-3">
          {analyticsLoading ? (
            <div className="h-40 flex items-center justify-center text-muted text-base font-bold animate-pulse">{t('x_loading')}</div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fontWeight: 600, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} interval="preserveStartEnd" />
                <YAxis domain={[0, 'auto']} width={48} tick={{ fontSize: 12, fontWeight: 600, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={formatMMK} />
                <Tooltip
                  formatter={(val) => [`${val.toLocaleString()} MMK`, 'Sales']}
                  contentStyle={{ fontSize: 13, fontWeight: 600, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--row)', color: 'var(--ink)' }}
                  cursor={{ fill: 'var(--band)' }}
                />
                <Bar dataKey="amount" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted text-base font-bold">{t('x_no_sales')}</div>
          )}
          </div>
        </div>

        {/* Customer Debts */}
        <div className="bg-row rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <Users size={16} className="text-muted" />
            <h3 className="text-base font-semibold text-ink">{t('x_customer_debts')}</h3>
          </div>
          {analyticsLoading ? (
            <div className="p-6 text-center text-muted text-base font-bold animate-pulse">{t('x_loading')}</div>
          ) : analytics?.debt_list?.length > 0 ? (
            <div className="divide-y divide-line">
              {paginate(analytics.debt_list, debtPage, 15).rows.map((c) => (
                <div key={c.name} className="flex items-center justify-between px-4 py-3">
                  <span className="font-medium text-ink text-base min-w-0 break-words mr-2">{c.name}</span>
                  <span className={`font-semibold text-base tabular-nums ${c.debt > 0 ? 'text-debt' : 'text-ok'}`}>
                    {c.debt.toLocaleString()} <span className="text-sm text-muted font-medium">MMK</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-muted text-base font-bold">{t('x_no_customers')}</div>
          )}
          <Pager page={paginate(analytics?.debt_list || [], debtPage, 15).page} pages={paginate(analytics?.debt_list || [], debtPage, 15).pages} onChange={setDebtPage} className="p-3" />
        </div>

        {/* Voucher List */}
        <div className="bg-row rounded-2xl shadow-sm overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line">
            <h3 className="text-base font-semibold text-ink flex items-center gap-2"><FileText size={16} /> {t('x_vouchers_title')}</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ok bg-ok-bg px-2.5 py-1 rounded-full tabular-nums">{totalSales.toLocaleString()} MMK</span>
              <button
                onClick={() => { setSortOrder(s => s === 'desc' ? 'asc' : 'desc'); setPage(1); }}
                className="flex items-center gap-1.5 text-sm font-medium text-ink bg-row px-3 min-h-[40px] rounded-xl border border-line-strong hover:border-accent hover:text-accent transition-all"
              >
                <ArrowUpDown size={14} />
                {sortOrder === 'desc' ? t('x_newest') : t('x_oldest')}
              </button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 p-3">
            <div className="flex-1">
              <select
                className="w-full px-3 py-2 min-h-[var(--ctl)] bg-row border border-line-strong rounded-xl font-medium text-base outline-none focus:border-accent"
                value={selectedMonth}
                onChange={(e) => { setSelectedMonth(e.target.value); setSelectedDate(''); setPage(1); }}
              >
                <option value={currentMonthStr}>{t('x_month')}: {currentMonthStr}</option>
                {months.filter(m => m !== currentMonthStr).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex-[1.5]">
              <DropdownDatePicker
                value={selectedDate}
                onChange={(val) => { setSelectedDate(val); setPage(1); if (val) setExpandedVoucher(null); }}
              />
            </div>
          </div>
          <button
            onClick={() => { setSelectedDate(today); setSelectedMonth(getMonthFromDate(today)); setPage(1); }}
            className="mx-3 mb-3 w-[calc(100%-1.5rem)] min-h-[var(--ctl)] bg-row border border-line-strong text-ink rounded-xl text-sm font-medium hover:bg-band"
          >
            {t('x_show_today')}
          </button>

          <div className="divide-y divide-line border-t border-line">
            {loading ? (
              <div className="text-center py-12 text-muted animate-pulse text-base">{t('x_loading')}</div>
            ) : filteredVouchers.length > 0 ? (
              filteredVouchers.map((v) => (
                <div key={v.id} className="overflow-hidden">
                  <div
                    onClick={() => setExpandedVoucher(expandedVoucher === v.id ? null : v.id)}
                    className="px-4 py-3 min-h-[var(--row-h)] flex justify-between items-center cursor-pointer active:bg-zebra"
                  >
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-accent truncate pr-2 leading-tight">{v.customer_name}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="text-sm font-semibold text-ink bg-band px-1.5 rounded-md">{v.voucher_number}</span>
                        <span className="text-sm font-medium text-muted">{v.voucher_date}</span>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <span className="text-sm text-muted font-medium block leading-none mb-1">{t('balance')}</span>
                        <span className={`font-semibold text-base leading-none tabular-nums ${v.customer_balance > 0 ? 'text-debt' : 'text-ok'}`}>
                          {(v.customer_balance || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 ml-1">
                        {expandedVoucher === v.id ? <ChevronUp size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
                      </div>
                    </div>
                  </div>

                  {expandedVoucher === v.id && (
                    <div className="bg-zebra px-4 py-3 border-t border-line space-y-3">
                      {v.core_weight_lb > 0 && (
                        <div className="bg-extra-bg px-3 py-2 rounded-xl flex justify-between items-center">
                          <span className="text-base font-semibold text-extra">{t('core_weight')}</span>
                          <span className="text-lg font-semibold text-extra">{v.core_weight_lb} <span className="text-base text-muted">lb</span></span>
                        </div>
                      )}
                      {v.note && (
                        <div className="bg-band px-3 py-2 rounded-xl">
                          <span className="text-sm font-semibold text-muted block leading-none mb-1">{t('note')}</span>
                          <p className="text-base font-medium text-ink leading-tight italic">"{v.note}"</p>
                        </div>
                      )}
                      <div className="bg-row rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-band font-semibold text-muted">
                            <tr><th className="p-2">{t('x_details')}</th><th className="p-2 text-right">{t('total')}</th></tr>
                          </thead>
                          <tbody className="font-medium text-ink">
                            {v.items?.map((item, idx) => (
                              <tr key={idx} className="border-t border-line">
                                <td className="p-2 align-top">
                                  <div className="text-accent">{item.lb} LB - {item.plastic_size}{item.gate ? ` / ${item.gate}` : ''} ({item.color}{item.print_color ? ` + ${item.print_color}` : ''})</div>
                                  <div className="mt-1 space-y-0.5">
                                    <div className="text-sm text-muted flex justify-between">
                                      <span>{t('plastic')}: {item.lb} LB × {item.plastic_price}</span>
                                      <span className="font-semibold text-ink">{(item.lb * item.plastic_price).toLocaleString()}</span>
                                    </div>
                                    <div className="text-sm text-muted flex justify-between">
                                      <span>{t('color')}: {item.lb} LB × {item.color_price}</span>
                                      <span className="font-semibold text-ink">{(item.lb * item.color_price).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-2 text-right align-top text-accent font-semibold">
                                  {item.total_price.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex gap-2 text-sm font-semibold">
                        <div className="flex-1 bg-row px-3 py-2 rounded-xl shadow-sm">
                          <span className="text-muted block mb-0.5">{t('x_voucher_total')}</span>
                          <span className="text-ink text-base">{v.items_total.toLocaleString()}</span>
                        </div>
                        <div className="flex-1 bg-row px-3 py-2 rounded-xl shadow-sm">
                          <span className="text-muted block mb-0.5">{t('paid_amount')}</span>
                          <span className="text-ok text-base">{v.paid_amount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-muted border-dashed">
                <p className="text-base">{t('x_no_records')}</p>
              </div>
            )}
          </div>
          <p className="text-center text-sm text-muted mt-3">{pageInfo.total} {t('x_vouchers')}</p>
          <Pager page={page} pages={pageInfo.pages} onChange={setPage} disabled={loading} className="mt-2" />
        </div>

      </div>
    </Layout>
  );
};

export default Reports;
