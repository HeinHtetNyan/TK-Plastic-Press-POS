import { useState, useEffect } from 'react';
import { FileText, BarChart3, ChevronDown, ChevronUp, Trash2, TrendingUp, AlertCircle, Users, CreditCard as CreditCardIcon, Banknote, Smartphone, Landmark, ArrowUpDown } from 'lucide-react';
import Layout from '../components/Layout';
import DropdownDatePicker from '../components/DropdownDatePicker';
import { voucherService, analyticsService } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const Reports = () => {
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

  useEffect(() => {
    fetchVouchers();
    fetchAnalytics();
  }, []);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const response = await voucherService.listAll();
      setVouchers(response.data || []);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const response = await analyticsService.getDashboard();
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleDeleteVoucher = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this voucher?')) {
      try {
        await voucherService.delete(id);
        fetchVouchers();
        fetchAnalytics();
      } catch {
        alert('Error deleting voucher');
      }
    }
  };

  const getMonthFromDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[1]}-${parts[2]}` : "";
  };

  const filteredVouchers = vouchers
    .filter(v => {
      if (selectedDate) return v.voucher_date === selectedDate;
      return getMonthFromDate(v.voucher_date) === selectedMonth;
    })
    .sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
    });

  const months = Array.from(new Set(vouchers.map(v => getMonthFromDate(v.voucher_date)).filter(m => m !== "")))
    .sort().reverse();

  const totalSales = filteredVouchers.reduce((sum, v) => sum + v.items_total, 0);

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

  return (
    <Layout>
      <div className="space-y-4 pb-12 animate-in slide-in-from-bottom-4 duration-500">

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <span className="text-[9px] font-black text-gray-400 uppercase block tracking-widest mb-1 flex items-center gap-1"><TrendingUp size={9} /> Total Revenue</span>
            <span className="text-lg font-black text-blue-600">{formatMMK(analytics?.total_revenue || 0)}</span>
            <span className="text-[9px] text-gray-400 font-bold ml-1">MMK</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <span className="text-[9px] font-black text-gray-400 uppercase block tracking-widest mb-1 flex items-center gap-1"><AlertCircle size={9} /> Total Debt</span>
            <span className="text-lg font-black text-red-500">{formatMMK(analytics?.total_debt || 0)}</span>
            <span className="text-[9px] text-gray-400 font-bold ml-1">MMK</span>
          </div>
        </div>

        {/* Income by Payment Method */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1">
            <CreditCardIcon size={10} className="text-green-500" /> Income by Payment Method
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'CASH', label: 'Cash', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
              { id: 'KBZPAY', label: 'KBZPay', icon: Smartphone, color: 'text-blue-600', bg: 'bg-blue-50' },
              { id: 'BANK_TRANSFER', label: 'Bank', icon: Landmark, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map((method) => {
              const income = analytics?.income_by_method?.find(m => m.method === method.id)?.amount || 0;
              return (
                <div key={method.id} className={`${method.bg} p-3 rounded-xl border border-white shadow-sm flex flex-col items-center justify-center text-center`}>
                  <method.icon size={16} className={`${method.color} mb-1`} />
                  <span className="text-[8px] font-black text-gray-400 uppercase block leading-tight">{method.label}</span>
                  <span className={`text-[11px] font-black ${method.color}`}>{formatMMK(income)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Sales Chart */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1">
            <BarChart3 size={10} /> Daily Sales — Last 30 Days
          </h3>
          {analyticsLoading ? (
            <div className="h-40 flex items-center justify-center text-gray-300 text-xs font-bold animate-pulse">Loading chart...</div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 8, fontWeight: 700, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 8, fontWeight: 700, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={formatMMK} />
                <Tooltip
                  formatter={(val) => [`${val.toLocaleString()} MMK`, 'Sales']}
                  contentStyle={{ fontSize: 11, fontWeight: 700, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-300 text-xs font-bold">No sales data</div>
          )}
        </div>

        {/* Customer Debts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
            <Users size={12} className="text-blue-500" />
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer Debts</h3>
          </div>
          {analyticsLoading ? (
            <div className="p-6 text-center text-gray-300 text-xs font-bold animate-pulse">Loading...</div>
          ) : analytics?.debt_list?.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {analytics.debt_list.map((c) => (
                <div key={c.name} className="flex items-center justify-between px-4 py-3">
                  <span className="font-black text-gray-700 text-sm">{c.name}</span>
                  <span className={`font-black text-sm ${c.debt > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {c.debt.toLocaleString()} <span className="text-[9px] text-gray-400 font-bold">MMK</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-gray-400 text-xs font-bold">No customers</div>
          )}
        </div>

        {/* Voucher List */}
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><FileText size={10} /> Vouchers</h3>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{totalSales.toLocaleString()} MMK</span>
              <button
                onClick={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')}
                className="flex items-center gap-1 text-[9px] font-black text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200 hover:border-blue-300 hover:text-blue-600 transition-all"
              >
                <ArrowUpDown size={9} />
                {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
              </button>
            </div>
          </div>
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <select
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-[11px] outline-none focus:border-blue-500"
                value={selectedMonth}
                onChange={(e) => { setSelectedMonth(e.target.value); setSelectedDate(''); }}
              >
                <option value={currentMonthStr}>Month: {currentMonthStr}</option>
                {months.filter(m => m !== currentMonthStr).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex-[1.5]">
              <DropdownDatePicker
                value={selectedDate}
                onChange={(val) => { setSelectedDate(val); if (val) setExpandedVoucher(null); }}
              />
            </div>
          </div>
          <button
            onClick={() => { setSelectedDate(today); setSelectedMonth(getMonthFromDate(today)); }}
            className="w-full py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-blue-100 mb-3"
          >
            Show Today's Records
          </button>

          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-12 text-gray-400 font-bold animate-pulse text-sm">Loading...</div>
            ) : filteredVouchers.length > 0 ? (
              filteredVouchers.map((v) => (
                <div key={v.id} className="rounded-2xl border border-gray-100 overflow-hidden transition-all animate-in fade-in">
                  <div
                    onClick={() => setExpandedVoucher(expandedVoucher === v.id ? null : v.id)}
                    className="p-3 flex justify-between items-center cursor-pointer active:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black text-blue-700 truncate pr-2 uppercase leading-tight">{v.customer_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-1 rounded">{v.voucher_number}</span>
                        <span className="text-[9px] font-black text-gray-400">{v.voucher_date}</span>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <span className="text-[8px] text-gray-400 font-black uppercase block tracking-tighter leading-none mb-0.5">Balance</span>
                        <span className={`font-black text-sm leading-none ${v.customer_balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {(v.customer_balance || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          onClick={(e) => handleDeleteVoucher(e, v.id)}
                          className="p-1.5 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                        {expandedVoucher === v.id ? <ChevronUp size={14} className="text-gray-300" /> : <ChevronDown size={14} className="text-gray-300" />}
                      </div>
                    </div>
                  </div>

                  {expandedVoucher === v.id && (
                    <div className="bg-gray-50 p-3 border-t border-gray-100 space-y-3 animate-in slide-in-from-top-2">
                      {v.note && (
                        <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100/50">
                          <span className="text-[8px] font-black text-blue-400 uppercase block leading-none mb-1">Note</span>
                          <p className="text-xs font-bold text-blue-700 leading-tight italic">"{v.note}"</p>
                        </div>
                      )}
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left text-[10px]">
                          <thead className="bg-gray-100 font-black uppercase text-gray-500">
                            <tr><th className="p-2">Details</th><th className="p-2 text-right">Total</th></tr>
                          </thead>
                          <tbody className="font-bold text-gray-700">
                            {v.items?.map((item, idx) => (
                              <tr key={idx} className="border-t border-gray-100">
                                <td className="p-2 align-top">
                                  <div className="text-blue-600">{item.lb} LB - {item.plastic_size} ({item.color})</div>
                                  <div className="mt-1 space-y-0.5">
                                    <div className="text-[9px] text-gray-500 uppercase flex justify-between">
                                      <span>Plastic: {item.lb} LB × {item.plastic_price}</span>
                                      <span className="font-black">{(item.lb * item.plastic_price).toLocaleString()}</span>
                                    </div>
                                    <div className="text-[9px] text-gray-500 uppercase flex justify-between">
                                      <span>Color: {item.lb} LB × {item.color_price}</span>
                                      <span className="font-black">{(item.lb * item.color_price).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-2 text-right align-top text-blue-700 font-black">
                                  {item.total_price.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex gap-2 text-[9px] font-black uppercase">
                        <div className="flex-1 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                          <span className="text-gray-400 block mb-0.5">Voucher Total</span>
                          <span className="text-gray-800 text-xs">{v.items_total.toLocaleString()}</span>
                        </div>
                        <div className="flex-1 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                          <span className="text-gray-400 block mb-0.5">Paid Amount</span>
                          <span className="text-green-600 text-xs">{v.paid_amount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-gray-400 rounded-2xl border-2 border-dashed border-gray-100">
                <p className="font-bold text-xs">No records found</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default Reports;
