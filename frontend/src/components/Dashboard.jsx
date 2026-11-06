import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, CreditCard, Users, DollarSign, Banknote, Smartphone, Landmark, TrendingDown, Boxes, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import Pager from './Pager';
import { paginate } from '../utils/paginate';
import { stockService } from '../services/api';

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

  const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

  const paymentMethods = [
    { id: 'CASH', label: t('cash'), icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
    { id: 'KBZPAY', label: t('kbzpay'), icon: Smartphone, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'BANK_TRANSFER', label: t('x_bank'), icon: Landmark, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 min-w-0">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <DollarSign size={24} />
          </div>
          <div className="min-w-0">
            <span className="text-base font-bold text-gray-600 uppercase block tracking-wider">{t('x_total_revenue')} <span className="text-blue-300 normal-case font-bold">({periodLabel})</span></span>
            <span className="text-xl font-black text-gray-800">
              {data.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              <span className="text-base ml-1 font-bold opacity-40">MMK</span>
            </span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 min-w-0">
          <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
            <CreditCard size={24} />
          </div>
          <div className="min-w-0">
            <span className="text-base font-bold text-gray-600 uppercase block tracking-wider">{t('x_total_debt')}</span>
            <span className="text-xl font-black text-red-600 break-words">
              {data.total_debt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              <span className="text-base ml-1 font-bold opacity-40">MMK</span>
            </span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 min-w-0">
          <div className={`p-3 rounded-2xl ${netIncome >= 0 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
            <TrendingDown size={24} />
          </div>
          <div className="min-w-0">
            <span className="text-base font-bold text-gray-600 uppercase block tracking-wider">
              {t('net_income')} <span className="text-blue-300 normal-case font-bold">({periodLabel})</span>
            </span>
            <span className={`text-xl font-black ${netIncome >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
              {netIncome.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              <span className="text-base ml-1 font-bold opacity-40">MMK</span>
            </span>
            <span className="text-sm text-gray-400 font-bold block">
              {t('total_spending')}: {totalSpending.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MMK
            </span>
            <span className="text-sm text-gray-400 font-bold block">{t('x3_net_note')}</span>
          </div>
        </div>
        {data.cash && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 min-w-0">
            <div className={`p-3 rounded-2xl ${data.cash.cash >= 0 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
              <Banknote size={24} />
            </div>
            <div className="min-w-0">
              <span className="text-base font-bold text-gray-600 uppercase block tracking-wider">
                {t('x4_cash_title')} <span className="text-blue-300 normal-case font-bold">({periodLabel})</span>
              </span>
              <span className={`text-xl font-black break-words ${data.cash.cash >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                {Math.round(data.cash.cash).toLocaleString()}
                <span className="text-base ml-1 font-bold opacity-40">MMK</span>
              </span>
              <span className="text-sm text-gray-500 font-bold block">
                {t('x4_cash_in')} {Math.round(data.cash.money_in).toLocaleString()} &minus; {t('x4_cash_factory')} {Math.round(data.cash.factory_out).toLocaleString()} &minus; {t('x4_cash_spending')} {Math.round(data.cash.spending).toLocaleString()}
              </span>
              <span className="text-sm text-gray-400 font-bold block">{t('x4_cash_note')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Profit, stock value (admin) and stock alerts (everyone) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.profit && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 min-w-0">
            <span className="text-base font-bold text-gray-600 uppercase block tracking-wider">{t('x3_profit_title')} <span className="text-blue-300 normal-case font-bold">({periodLabel})</span></span>
            <span className={`text-2xl font-black break-words ${data.profit.gross_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.profit.gross_profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="text-base ml-1 font-bold opacity-40">MMK</span>
            </span>
            <span className="text-sm text-gray-500 font-bold block mt-1">
              {t('x3_plastic_sales')} {Math.round(data.profit.sales).toLocaleString()} &minus; {t('x3_plastic_cost')} {Math.round(data.profit.cost).toLocaleString()}
            </span>
            <span className="text-base text-gray-700 font-black block mt-1">
              {t('x3_after_spending')}: <span className={data.profit.net_profit >= 0 ? 'text-green-700' : 'text-red-600'}>{Math.round(data.profit.net_profit).toLocaleString()}</span> MMK
            </span>
            {data.profit.items_without_cost > 0 && (
              <span className="text-sm text-orange-600 font-bold block mt-1">{t('x3_no_cost_warn').replace('{n}', data.profit.items_without_cost)}</span>
            )}
          </div>
        )}
        {data.stock_value != null && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 min-w-0">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Boxes size={24} /></div>
            <div className="min-w-0">
              <span className="text-base font-bold text-gray-600 uppercase block tracking-wider">{t('x_stock_value')}</span>
              <span className="text-xl font-black text-indigo-700 break-words">{Math.round(data.stock_value).toLocaleString()}<span className="text-base ml-1 font-bold opacity-40">MMK</span></span>
            </div>
          </div>
        )}
        {alerts && (
          <div className={`p-6 rounded-3xl shadow-sm border min-w-0 ${alerts.total > 0 ? 'bg-orange-50/60 border-orange-100' : 'bg-white border-gray-100'}`}>
            <span className="text-base font-bold text-gray-600 uppercase flex items-center gap-2 tracking-wider"><AlertTriangle size={18} className={alerts.total > 0 ? 'text-orange-500' : 'text-green-500'} /> {t('x3_alerts_title')}</span>
            {alerts.total === 0 ? (
              <span className="text-base font-bold text-green-600 block mt-1">{t('x3_alerts_ok')}</span>
            ) : (
              <>
                <span className="text-sm font-bold text-gray-500 block mt-1">
                  {alerts.negative > 0 && <span className="text-red-600">{alerts.negative} {t('x3_negative')}</span>}
                  {alerts.negative > 0 && alerts.low > 0 && ' · '}
                  {alerts.low > 0 && <span className="text-orange-600">{alerts.low} {t('x3_low')} (&le; {alerts.low_lb} lb)</span>}
                </span>
                <div className="mt-2 space-y-1">
                  {alerts.items.slice(0, 6).map((i) => (
                    <div key={i.id} className="flex justify-between gap-2 text-base font-bold">
                      <span className="min-w-0 break-words text-gray-700">{i.size} / {i.color}{i.gate ? ` / ${i.gate}` : ''}</span>
                      <span className={`whitespace-nowrap font-black ${i.kind === 'NEGATIVE' ? 'text-red-600' : 'text-orange-600'}`}>{Math.round(i.qty_lb * 100) / 100} lb</span>
                    </div>
                  ))}
                  {alerts.total > 6 && <div className="text-sm font-bold text-gray-500">+ {alerts.total - 6} {t('x3_more')}</div>}
                </div>
                <button type="button" onClick={() => navigate('/stock')} className="mt-3 px-4 py-2 rounded-xl bg-white border-2 border-orange-200 text-orange-700 font-black text-base hover:bg-orange-100">{t('x3_open_stock')}</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Income by Payment Method Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {paymentMethods.map((method) => {
          const income = data.income_by_method?.find(m => m.method === method.id)?.amount || 0;
          return (
            <div key={method.id} className={`${method.bg} p-5 rounded-3xl border border-white shadow-sm flex items-center gap-4 transition-all hover:scale-[1.02]`}>
              <div className={`p-3 rounded-2xl bg-white ${method.color} shadow-sm`}>
                <method.icon size={24} />
              </div>
              <div>
                <span className="text-base font-black text-gray-600 uppercase block tracking-widest">{method.label} {t('x_income')} <span className="text-blue-300 normal-case font-bold">({periodLabel})</span></span>
                <span className={`text-xl font-black ${method.color}`}>
                  {income.toLocaleString()}
                  <span className="text-base ml-1 font-bold opacity-40">MMK</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Chart */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <TrendingUp size={20} className="text-blue-600" />
            <h3 className="text-lg font-black text-gray-800">{t('x_daily_sales')}</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.daily_sales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  hide={true}
                />
                <YAxis 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  formatter={(value) => [value.toLocaleString() + ' MMK', 'Revenue']}
                />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#2563eb" 
                  strokeWidth={4} 
                  dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Customers Chart */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Users size={20} className="text-blue-600" />
            <h3 className="text-lg font-black text-gray-800">{t('x_top_customers')} <span className="text-base text-blue-400 font-bold normal-case">({periodLabel})</span></h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top_customers} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  tick={{ fontSize: 11, fontWeight: 800, fill: '#475569' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  formatter={(value) => [value.toLocaleString() + ' MMK', 'Revenue']}
                />
                <Bar dataKey="revenue" radius={[0, 8, 8, 0]}>
                  {data.top_customers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Customer Debts Section */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
        <div className="flex items-center gap-2 px-1">
          <TrendingUp size={20} className="text-red-600 rotate-90" />
          <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">{t('x_outstanding_debts')}</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {debts.rows.map((c, index) => (
            <div 
              key={index} 
              className={`p-5 rounded-3xl border transition-all duration-300 flex flex-col justify-between min-w-0 ${
                c.debt > 0 
                  ? 'bg-red-50/50 border-red-100 hover:bg-red-50' 
                  : 'bg-green-50/30 border-green-50 hover:bg-green-50/60 opacity-60'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-lg font-black text-gray-800 leading-tight truncate mr-2">{c.name}</span>
                {c.debt > 0 && (
                  <span className="bg-red-100 text-red-600 text-sm font-black px-2 py-0.5 rounded-full uppercase whitespace-nowrap">
                    {t('x_pending')}
                  </span>
                )}
                {c.debt <= 0 && (
                  <span className="bg-green-100 text-green-600 text-sm font-black px-2 py-0.5 rounded-full uppercase whitespace-nowrap">
                    {t('x_clear')}
                  </span>
                )}
              </div>
              <div>
                <span className={`text-sm font-black uppercase tracking-widest block mb-1 ${c.debt > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {c.debt > 0 ? t('x_outstanding_debt') : t('x_account_balance')}
                </span>
                <span className={`text-xl xl:text-2xl font-black tabular-nums break-words ${c.debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {c.debt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-base ml-1 font-bold opacity-60">MMK</span>
                </span>
              </div>
            </div>
          ))}
          {(!data.debt_list || data.debt_list.length === 0) && (
            <div className="col-span-full py-12 text-center text-gray-400 font-bold bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
              {t('x_no_customers')}
            </div>
          )}
        </div>
        <Pager page={debts.page} pages={debts.pages} onChange={setDebtPage} />
      </div>
    </div>
  );
};

export default Dashboard;
