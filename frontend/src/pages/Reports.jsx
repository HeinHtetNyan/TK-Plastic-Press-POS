import React, { useState, useEffect } from 'react';
import { FileText, BarChart3, Filter, User, ChevronDown, ChevronUp, Calendar, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import DropdownDatePicker from '../components/DropdownDatePicker';
import { voucherService, customerService } from '../services/api';

const Reports = () => {
  const [vouchers, setVouchers] = useState([]);
  const [customerBalances, setCustomerBalances] = useState({});
  const [loading, setLoading] = useState(false);
  const [expandedVoucher, setExpandedVoucher] = useState(null);
  
  const now = new Date();
  const currentMonthStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const today = new Date().toLocaleDateString('en-GB').split('/').join('-');
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedDate, setSelectedDate] = useState(''); 

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const response = await voucherService.listAll();
      const allVouchers = response.data || [];
      setVouchers(allVouchers.sort((a, b) => b.id - a.id));
      
      const uniqueCustomerIds = [...new Set(allVouchers.map(v => v.customer_id))];
      const balanceMap = {};
      await Promise.all(uniqueCustomerIds.map(async (id) => {
        try {
          const res = await customerService.getBalance(id);
          balanceMap[id] = res.data.balance;
        } catch (e) { console.error(e); }
      }));
      setCustomerBalances(balanceMap);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVoucher = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this voucher?')) {
      try {
        await voucherService.delete(id);
        fetchVouchers();
      } catch (error) {
        alert('Error deleting voucher');
      }
    }
  };

  const getMonthFromDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[1]}-${parts[2]}` : "";
  };

  const filteredVouchers = vouchers.filter(v => {
    if (selectedDate) return v.voucher_date === selectedDate;
    return getMonthFromDate(v.voucher_date) === selectedMonth;
  });

  const months = Array.from(new Set(vouchers.map(v => getMonthFromDate(v.voucher_date)).filter(m => m !== "")))
    .sort().reverse();

  const totalSales = filteredVouchers.reduce((sum, v) => sum + v.items_total, 0);

  return (
    <Layout>
      <div className="space-y-3 pb-12 animate-in slide-in-from-bottom-4 duration-500">
        <header className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 text-white rounded-lg">
              <BarChart3 size={18} />
            </div>
            <h2 className="text-lg font-black text-gray-800">Reports</h2>
          </div>
          <div className="text-right">
             <span className="text-[8px] font-black text-gray-400 uppercase block leading-none mb-0.5">Total Sales</span>
             <span className="text-sm font-black text-blue-600 leading-none">{totalSales.toLocaleString()} <span className="text-[10px]">MMK</span></span>
          </div>
        </header>

        <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2">
          <div className="flex gap-2">
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
                onChange={(val) => { setSelectedDate(val); if(val) setExpandedVoucher(null); }} 
              />
            </div>
          </div>
          <button 
            onClick={() => { setSelectedDate(today); setSelectedMonth(getMonthFromDate(today)); }} 
            className="w-full py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-blue-100"
          >
            Show Today's Records
          </button>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-12 text-gray-400 font-bold animate-pulse text-sm">Refreshing Records...</div>
          ) : filteredVouchers.length > 0 ? (
            filteredVouchers.map((v) => (
              <div key={v.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all animate-in fade-in">
                <div 
                  onClick={() => setExpandedVoucher(expandedVoucher === v.id ? null : v.id)}
                  className="p-3 flex justify-between items-center cursor-pointer active:bg-gray-50"
                >
                  <div className="flex gap-3 items-center min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-blue-700 truncate pr-2 uppercase leading-tight">{v.customer_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-1 rounded">{v.voucher_number}</span>
                        <span className="text-[9px] font-black text-gray-400">{v.voucher_date}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <div>
                      <span className="text-[8px] text-gray-400 font-black uppercase block tracking-tighter leading-none mb-0.5">Balance</span>
                      <span className={`font-black text-sm leading-none ${v.customer_balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {(v.customer_balance || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 ml-1">
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
                          <tr><th className="p-2 text-left">Details</th><th className="p-2 text-right">Total</th></tr>
                        </thead>
                        <tbody className="font-bold text-gray-700">
                          {v.items?.map((item, idx) => (
                            <React.Fragment key={idx}>
                              <tr className="border-t border-gray-100">
                                <td className="p-2 align-top">
                                  <div className="text-blue-600">{item.lb} LB - {item.plastic_size} ({item.color})</div>
                                  <div className="mt-1 space-y-0.5">
                                    <div className="text-[9px] text-gray-500 uppercase flex justify-between">
                                      <span>Plastic: {item.lb} LB × {item.plastic_price} Price</span>
                                      <span className="font-black">{(item.lb * item.plastic_price).toLocaleString()}</span>
                                    </div>
                                    <div className="text-[9px] text-gray-500 uppercase flex justify-between border-b border-gray-50 pb-0.5">
                                      <span>Color: {item.lb} LB × {item.color_price} Price</span>
                                      <span className="font-black">{(item.lb * item.color_price).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-2 text-right align-top text-blue-700 font-black">
                                  {item.total_price.toLocaleString()}
                                </td>
                              </tr>
                            </React.Fragment>
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
                         <span className="text-gray-400 block mb-0.5 tracking-tighter">Paid Amount</span>
                         <span className="text-green-600 text-xs">{v.paid_amount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-16 text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-100">
              <p className="font-bold text-xs">No records found</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Reports;
