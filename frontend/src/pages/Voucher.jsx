import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import Layout from '../components/Layout';
import DropdownDatePicker from '../components/DropdownDatePicker';
import { customerService, voucherService } from '../services/api';

const Voucher = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(location.state?.customer || null);
  const [balance, setBalance] = useState(0);
  
  const [voucherNumber, setVoucherNumber] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toLocaleDateString('en-GB').split('/').join('-'));
  const [items, setItems] = useState([{ lb: '', plastic_size: '', plastic_price: '', color: '', color_price: '', total_price: 0 }]);
  const [paidAmount, setPaidAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customer) {
      navigate('/');
    } else {
      fetchBalance(customer.id);
    }
  }, [customer]);

  const fetchBalance = async (id) => {
    try {
      const response = await customerService.getBalance(id);
      setBalance(response.data.balance);
    } catch (error) {
      console.error(error);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    // Calculate item total
    const lb = parseFloat(newItems[index].lb) || 0;
    const pPrice = parseFloat(newItems[index].plastic_price) || 0;
    const cPrice = parseFloat(newItems[index].color_price) || 0;
    newItems[index].total_price = lb * (pPrice + cPrice);

    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { lb: '', plastic_size: '', plastic_price: '', color: '', color_price: '', total_price: 0 }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const itemsTotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const finalTotal = itemsTotal + balance;
  const remainingBalance = finalTotal - (parseFloat(paidAmount) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!voucherNumber) return alert('Enter Voucher Number');
    
    setLoading(true);
    try {
      const voucherData = {
        customer_id: customer.id,
        voucher_number: voucherNumber,
        voucher_date: voucherDate,
        paid_amount: parseFloat(paidAmount) || 0,
        note: note,
        items: items.map(item => ({
          lb: parseFloat(item.lb),
          plastic_size: item.plastic_size,
          plastic_price: parseFloat(item.plastic_price) || 0,
          color: item.color,
          color_price: parseFloat(item.color_price) || 0
        }))
      };

      await voucherService.create(voucherData);
      alert('Voucher Saved Successfully!');
      navigate('/', { state: { customer: customer } });
    } catch (error) {
      if (error.response?.data?.detail) {
        alert(error.response.data.detail);
      } else {
        alert('Error saving voucher');
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 pb-12 animate-in slide-in-from-right-4 duration-500">
        <header className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-all">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <h2 className="text-2xl font-black text-gray-800">Create Voucher</h2>
        </header>

        {customer && (
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex justify-between items-center">
            <span className="font-bold text-blue-800 text-lg">{customer.name}</span>
            <div className="text-right">
              <span className="text-xs text-blue-600 uppercase font-bold block">Previous Balance</span>
              <span className="text-lg font-black text-blue-700">{balance.toLocaleString()} MMK</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-600 uppercase px-1">Voucher #</label>
              <input
                required
                type="text"
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all font-bold text-lg"
                placeholder="V-001"
                value={voucherNumber}
                onChange={(e) => setVoucherNumber(e.target.value)}
              />
            </div>
            <DropdownDatePicker 
              label="Voucher Date" 
              value={voucherDate} 
              onChange={setVoucherDate} 
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-black text-gray-700 flex justify-between items-center px-1">
              Items
              <button type="button" onClick={addItem} className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
                <Plus size={20} />
              </button>
            </h3>

            {items.map((item, index) => (
              <div key={index} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 space-y-4 relative overflow-hidden">
                <div className="flex justify-between items-center">
                   <span className="bg-gray-100 px-3 py-1 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-widest">Item {index + 1}</span>
                   {items.length > 1 && (
                     <button type="button" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 transition-colors">
                       <Trash2 size={18} />
                     </button>
                   )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">Weight (LB)</label>
                    <input
                      autoFocus={index === items.length - 1}
                      type="number"
                      step="any"
                      required
                      className="w-full p-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold"
                      value={item.lb}
                      onChange={(e) => handleItemChange(index, 'lb', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">Size</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 10x15"
                      className="w-full p-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold"
                      value={item.plastic_size}
                      onChange={(e) => handleItemChange(index, 'plastic_size', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">Plastic Price</label>
                    <input
                      type="number"
                      required
                      className="w-full p-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold"
                      value={item.plastic_price}
                      onChange={(e) => handleItemChange(index, 'plastic_price', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">Color</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Blue"
                      className="w-full p-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold"
                      value={item.color}
                      onChange={(e) => handleItemChange(index, 'color', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">Color Price</label>
                    <input
                      type="number"
                      required
                      className="w-full p-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold"
                      value={item.color_price}
                      onChange={(e) => handleItemChange(index, 'color_price', e.target.value)}
                    />
                  </div>
                </div>

                {/* Calculation Breakdown */}
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                   <div className="text-[11px] font-bold text-gray-500">
                      <span className="block uppercase text-[9px] mb-0.5 tracking-tighter">Plastic: {item.lb || 0} × {item.plastic_price || 0}</span>
                      <div className="text-blue-600 font-black">{( (item.lb || 0) * (item.plastic_price || 0) ).toLocaleString()}</div>
                   </div>
                   <div className="text-[11px] font-bold text-gray-500">
                      <span className="block uppercase text-[9px] mb-0.5 tracking-tighter">Color: {item.lb || 0} × {item.color_price || 0}</span>
                      <div className="text-blue-600 font-black">{( (item.lb || 0) * (item.color_price || 0) ).toLocaleString()}</div>
                   </div>
                   <div className="text-right flex flex-col justify-center">
                      <span className="text-[9px] font-black text-gray-400 uppercase block tracking-widest">Total</span>
                      <span className="text-lg font-black text-blue-700">{(item.total_price || 0).toLocaleString()} <span className="text-xs">MMK</span></span>
                   </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1 px-1">
            <label className="text-sm font-bold text-gray-600 uppercase">Voucher Note</label>
            <textarea
              className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold"
              placeholder="Add any specific details here..."
              rows="2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            ></textarea>
          </div>

          <div className="bg-gray-800 p-6 rounded-3xl shadow-xl text-white space-y-4">
            <div className="flex justify-between items-center opacity-70">
              <span className="font-bold">Previous Balance</span>
              <span className="font-bold">{balance.toLocaleString()} MMK</span>
            </div>
            <div className="flex justify-between items-center opacity-70">
              <span className="font-bold">Items Total</span>
              <span className="font-bold">{itemsTotal.toLocaleString()} MMK</span>
            </div>
            <div className="border-t border-gray-700 pt-4 flex justify-between items-center">
              <span className="text-xl font-black">Final Total</span>
              <span className="text-3xl font-black text-blue-400">{finalTotal.toLocaleString()} MMK</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border-2 border-blue-100 shadow-sm space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-600 uppercase px-1">Paid Amount</label>
              <input
                type="number"
                className="w-full p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl outline-none focus:border-blue-500 transition-all text-2xl font-black text-blue-700 text-center"
                placeholder="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
            
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
              <span className="font-bold text-gray-500 uppercase text-xs">Remaining Balance</span>
              <span className={`text-2xl font-black ${remainingBalance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {remainingBalance.toLocaleString()} MMK
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full p-5 rounded-3xl text-white text-xl font-black shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-4 ${
              loading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            }`}
          >
            <Save size={28} />
            {loading ? 'Saving...' : 'SAVE VOUCHER'}
          </button>
        </form>
      </div>
    </Layout>
  );
};

export default Voucher;
