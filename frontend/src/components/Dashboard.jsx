import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, CreditCard, Users, DollarSign, Banknote, Smartphone, Landmark, TrendingDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Dashboard = ({ data }) => {
  const { t } = useLanguage();
  if (!data) return null;

  const periodLabel =
    data.period === '3months' ? 'Last 3 Months' :
    data.period === '6months' ? 'Last 6 Months' :
    data.period === '1year'   ? 'Last 1 Year'   :
    'This Month';
  const totalSpending = data.total_spending ?? 0;
  const netIncome = (data.total_revenue ?? 0) - totalSpending;

  const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

  const paymentMethods = [
    { id: 'CASH', label: 'Cash', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
    { id: 'KBZPAY', label: 'KBZPay', icon: Smartphone, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'BANK_TRANSFER', label: 'Bank', icon: Landmark, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <DollarSign size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase block tracking-wider">Total Revenue <span className="text-blue-300 normal-case font-bold">({periodLabel})</span></span>
            <span className="text-xl font-black text-gray-800">
              {data.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              <span className="text-xs ml-1 font-bold opacity-40">MMK</span>
            </span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
            <CreditCard size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase block tracking-wider">Total Debt</span>
            <span className="text-xl font-black text-red-600">
              {data.total_debt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              <span className="text-xs ml-1 font-bold opacity-40">MMK</span>
            </span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${netIncome >= 0 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
            <TrendingDown size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase block tracking-wider">
              {t('net_income')} <span className="text-blue-300 normal-case font-bold">({periodLabel})</span>
            </span>
            <span className={`text-xl font-black ${netIncome >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
              {netIncome.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              <span className="text-xs ml-1 font-bold opacity-40">MMK</span>
            </span>
            <span className="text-[10px] text-gray-400 font-bold block">
              {t('total_spending')}: {totalSpending.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MMK
            </span>
          </div>
        </div>
      </div>

      {/* Income by Payment Method Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {paymentMethods.map((method) => {
          const income = data.income_by_method?.find(m => m.method === method.id)?.amount || 0;
          return (
            <div key={method.id} className={`${method.bg} p-5 rounded-3xl border border-white shadow-sm flex items-center gap-4 transition-all hover:scale-[1.02]`}>
              <div className={`p-3 rounded-2xl bg-white ${method.color} shadow-sm`}>
                <method.icon size={24} />
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase block tracking-widest">{method.label} Income <span className="text-blue-300 normal-case font-bold">({periodLabel})</span></span>
                <span className={`text-xl font-black ${method.color}`}>
                  {income.toLocaleString()}
                  <span className="text-xs ml-1 font-bold opacity-40">MMK</span>
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
            <h3 className="text-lg font-black text-gray-800">Daily Sales (Last 30 Days)</h3>
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
            <h3 className="text-lg font-black text-gray-800">Top Customers <span className="text-sm text-blue-400 font-bold normal-case">({periodLabel})</span></h3>
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
          <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Customer Outstanding Debts</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.debt_list && data.debt_list.map((c, index) => (
            <div 
              key={index} 
              className={`p-5 rounded-3xl border transition-all duration-300 flex flex-col justify-between ${
                c.debt > 0 
                  ? 'bg-red-50/50 border-red-100 hover:bg-red-50' 
                  : 'bg-green-50/30 border-green-50 hover:bg-green-50/60 opacity-60'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-lg font-black text-gray-800 leading-tight truncate mr-2">{c.name}</span>
                {c.debt > 0 && (
                  <span className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase whitespace-nowrap">
                    Pending
                  </span>
                )}
                {c.debt <= 0 && (
                  <span className="bg-green-100 text-green-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase whitespace-nowrap">
                    Clear
                  </span>
                )}
              </div>
              <div>
                <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${c.debt > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {c.debt > 0 ? 'Outstanding Debt' : 'Account Balance'}
                </span>
                <span className={`text-2xl font-black tabular-nums ${c.debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {c.debt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-xs ml-1 font-bold opacity-60">MMK</span>
                </span>
              </div>
            </div>
          ))}
          {(!data.debt_list || data.debt_list.length === 0) && (
            <div className="col-span-full py-12 text-center text-gray-400 font-bold bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
              No customers found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
