import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, CreditCard, ChevronDown, ChevronUp, Filter, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import DropdownDatePicker from '../components/DropdownDatePicker';
import { voucherService, paymentService } from '../services/api';

const History = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(location.state?.customer || null);
  const [vouchers, setVouchers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedVoucher, setExpandedVoucher] = useState(null);
  
  const now = new Date();
  const currentMonthStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedDate, setSelectedDate] = useState(''); 

  useEffect(() => {
    if (!customer) {
      navigate('/');
    } else {
      fetchHistory();
    }
  }, [customer]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const [vRes, pRes] = await Promise.all([
        voucherService.getCustomerVouchers(customer.id),
        paymentService.getCustomerPayments(customer.id)
      ]);
      setVouchers(vRes.data || []);
      setPayments(pRes.data || []);
    } catch (error) {
      console.error('Fetch history error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVoucher = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this voucher?')) {
      try {
        await voucherService.delete(id);
        fetchHistory();
      } catch (error) {
        alert('Error deleting voucher');
      }
    }
  };

  const handleDeletePayment = async (id) => {
    if (window.confirm('Are you sure you want to delete this payment?')) {
      try {
        await paymentService.delete(id);
        fetchHistory();
      } catch (error) {
        alert('Error deleting payment');
      }
    }
  };

  const getMonthFromDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[1]}-${parts[2]}` : "";
  };

  const filteredData = [
    ...vouchers.map(v => ({ ...v, type: 'voucher' })),
    ...payments.map(p => ({ ...p, type: 'payment' }))
  ].filter(item => {
    const itemDate = item.type === 'voucher' ? item.voucher_date : item.payment_date;
    if (selectedDate) return itemDate === selectedDate;
    return getMonthFromDate(itemDate) === selectedMonth;
  }).sort((a, b) => b.id - a.id);

  const months = Array.from(new Set([
    ...vouchers.map(v => getMonthFromDate(v.voucher_date)),
    ...payments.map(p => getMonthFromDate(p.payment_date))
  ].filter(m => m !== ""))).sort().reverse();

  return (
    <Layout>
      <div className="space-y-4 pb-12 animate-in slide-in-from-right-4 duration-500">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/', { state: { customer: customer } })} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-all">
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <h2 className="text-xl font-black text-gray-800">History</h2>
          </div>
          {customer && (
            <div className="bg-blue-50 px-3 py-1 rounded-xl border border-blue-100 text-right">
              <span className="text-[9px] font-black text-blue-400 uppercase block tracking-tighter leading-none mb-1">Customer</span>
              <p className="text-sm font-black text-blue-700 truncate max-w-[120px] leading-none">{customer.name}</p>
            </div>
          )}
        </header>

        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-1">
              <Filter size={10} /> Monthly Group
            </label>
            <select 
              className="w-full p-2 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-sm outline-none focus:border-blue-500"
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(e.target.value); setSelectedDate(''); }}
            >
              <option value={currentMonthStr}>Current ({currentMonthStr})</option>
              {months.filter(m => m !== currentMonthStr).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <DropdownDatePicker 
            label="Specific Date Search" 
            value={selectedDate} 
            onChange={(val) => { setSelectedDate(val); if(val) setExpandedVoucher(null); }} 
          />
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-400 font-bold text-sm uppercase tracking-widest animate-pulse">Refreshing Records...</div>
          ) : filteredData.length > 0 ? (
            filteredData.map((item) => (
              <div key={`${item.type}-${item.id}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in transition-all">
                {item.type === 'voucher' ? (
                  <>
                    <div 
                      onClick={() => setExpandedVoucher(expandedVoucher === item.id ? null : item.id)}
                      className="p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                    >
                      <div className="flex gap-3 items-center min-w-0">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-gray-800 text-sm truncate">{item.voucher_number}</span>
                            <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded font-black text-gray-500 whitespace-nowrap">{item.voucher_date}</span>
                          </div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.items?.length || 0} Products</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div className="hidden sm:block">
                          <span className="text-[9px] text-gray-400 font-black uppercase block tracking-tighter">Remaining</span>
                          <span className={`text-sm font-black ${item.remaining_balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {item.remaining_balance.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 items-end sm:flex-row sm:items-center sm:gap-3 ml-2">
                           <button 
                             onClick={(e) => handleDeleteVoucher(e, item.id)}
                             className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all order-2 sm:order-1"
                           >
                             <Trash2 size={16} />
                           </button>
                           <div className="order-1 sm:order-2">
                             {expandedVoucher === item.id ? <ChevronUp size={16} className="text-gray-300" /> : <ChevronDown size={16} className="text-gray-300" />}
                           </div>
                        </div>
                      </div>
                    </div>
                    {expandedVoucher === item.id && (
                      <div className="bg-gray-50 p-3 border-t border-gray-100 space-y-3 animate-in slide-in-from-top-2">
                        {item.note && (
                          <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100/50">
                             <span className="text-[8px] font-black text-blue-400 uppercase block leading-none mb-1">Note</span>
                             <p className="text-xs font-bold text-blue-700 leading-tight italic">"{item.note}"</p>
                          </div>
                        )}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                          <table className="w-full text-[10px] text-left">
                            <thead className="bg-gray-100 font-black text-gray-500 uppercase">
                              <tr><th className="p-2">Details</th><th className="p-2 text-right">Price</th><th className="p-2 text-right">Total</th></tr>
                            </thead>
                            <tbody className="font-bold text-gray-700">
                              {item.items?.map((it, idx) => (
                                <React.Fragment key={idx}>
                                  <tr className="border-t border-gray-100">
                                    <td className="p-2 align-top">
                                      <div className="text-blue-600">{it.lb} LB - {it.plastic_size} ({it.color})</div>
                                      <div className="mt-1 space-y-0.5">
                                        <div className="text-[9px] text-gray-500 uppercase flex justify-between">
                                          <span>Plastic: {it.lb} LB × {it.plastic_price} Price</span>
                                          <span className="font-black">{(it.lb * it.plastic_price).toLocaleString()}</span>
                                        </div>
                                        <div className="text-[9px] text-gray-500 uppercase flex justify-between border-b border-gray-50 pb-0.5">
                                          <span>Color: {it.lb} LB × {it.color_price} Price</span>
                                          <span className="font-black">{(it.lb * it.color_price).toLocaleString()}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-2 text-right align-top text-gray-400 font-medium">
                                      {it.plastic_price + it.color_price}
                                    </td>
                                    <td className="p-2 text-right align-top text-blue-700 font-black">
                                      {(it.total_price || 0).toLocaleString()}
                                    </td>
                                  </tr>
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase text-center">
                           <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                              <span className="text-gray-400 block mb-1">Voucher Total</span>
                              <span className="text-gray-700 text-xs">{item.items_total.toLocaleString()}</span>
                           </div>
                           <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                              <span className="text-gray-400 block mb-1 tracking-tighter">Paid at Site</span>
                              <span className="text-green-600 text-xs">{item.paid_amount.toLocaleString()}</span>
                           </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-3 flex justify-between items-center bg-white hover:bg-gray-50 group">
                    <div className="flex gap-3 items-center min-w-0">
                      <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                        <CreditCard size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-green-700 text-sm">Direct Payment</span>
                          <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded font-black text-gray-500 whitespace-nowrap">{item.payment_date}</span>
                        </div>
                        {item.note && <p className="text-[10px] text-gray-500 italic truncate max-w-[150px]">"{item.note}"</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[9px] text-gray-400 font-black uppercase block tracking-tighter leading-none mb-1">Amount Paid</span>
                        <span className="font-black text-green-600 text-base leading-none whitespace-nowrap">
                          {item.amount_paid.toLocaleString()}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleDeletePayment(item.id)}
                        className="p-1.5 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all group-hover:text-gray-300"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-100 text-sm font-bold animate-in zoom-in duration-300">
              No activity found for this selection
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default History;
