import { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

const translations = {
  EN: {
    // Navigation
    home: 'Home',
    reports: 'Reports',
    users: 'Users',
    audit: 'Audit',
    logout: 'Logout',
    language: 'Language',
    
    // Customer Search & List
    select_customer: 'Select Customer',
    search_mode: 'Search Mode',
    search_customer: 'Search customer name...',
    add: 'Add',
    selected_customer: 'Selected Customer',
    no_customers_found: 'No customers found',
    browse_all: 'Browse All Customers',
    hide_all: 'Hide Customer List',
    total_customers: 'Total Customers',
    local: 'Local',
    id: 'ID',
    offline_notice: 'Offline',
    begin_prompt: "Search or click 'Browse All Customers' to begin",
    
    // Customer Modals
    add_new_customer: 'Add New Customer',
    edit_customer: 'Edit Customer',
    customer_name: 'Customer Name',
    phone_number: 'Phone Number',
    address: 'Address',
    cancel: 'Cancel',
    save_customer: 'Save Customer',
    save_changes: 'Save Changes',
    create: 'Create',
    updating: 'Updating...',
    creating: 'Creating...',
    offline_sync_notice: 'You are offline. Customer will sync when internet is available.',
    
    // Dashboard & Actions
    quick_actions: 'Quick Actions',
    new_voucher: 'New Voucher',
    payment: 'Payment',
    history: 'History',
    balance: 'Balance',
    estimate: 'Estimate',
    balance_estimate_notice: 'Estimated balance (offline) — actual balance may differ',
    
    // Voucher Page
    create_voucher: 'Create Voucher',
    offline_voucher_notice: 'Offline — voucher will be saved locally and synced when internet returns.',
    previous_balance: 'Previous Balance',
    est: '(est.)',
    voucher_number: 'Voucher #',
    voucher_date: 'Voucher Date',
    items: 'Items',
    item: 'Item',
    weight_lb: 'Weight (LB)',
    size: 'Size',
    plastic_price: 'Plastic Price',
    color: 'Color',
    color_price: 'Color Price',
    plastic: 'Plastic',
    total: 'Total',
    voucher_note: 'Voucher Note',
    add_note_placeholder: 'Add any specific details here...',
    items_total: 'Items Total',
    final_total: 'Final Total',
    paid_amount: 'Paid Amount',
    remaining_balance: 'Remaining Balance',
    payment_method: 'Payment Method',
    cash: 'Cash',
    kbzpay: 'KBZPay',
    bank_transfer: 'Bank Transfer',
    saving: 'Saving...',
    save_voucher: 'SAVE VOUCHER',
    enter_voucher_number: 'Enter Voucher Number',
    voucher_saved_successfully: 'Voucher Saved Successfully!',
    error_saving_voucher: 'Error saving voucher. Please try again.',
    saved_offline_auto_sync: 'Saved offline. Will sync automatically when internet is available.',
    could_not_save: 'Could not save. Please try again.\n',
    
    // Payment Page
    add_payment: 'Add Payment',
    offline_payment_notice: 'Offline — payment will be saved locally and synced when internet returns.',
    customer: 'Customer',
    current_debt: 'Current Debt',
    current_debt_est: 'Current Debt (est.)',
    payment_amount: 'Payment Amount',
    payment_date: 'Payment Date',
    settle_oldest: 'Settle Oldest Debts First (FIFO)',
    recommended_regular: 'Recommended for regular payments',
    note_optional: 'Note (Optional)',
    note_placeholder: 'e.g. Cash payment, Bank transfer...',
    save_payment: 'SAVE PAYMENT',
    enter_valid_amount: 'Enter a valid amount',
    payment_saved_successfully: 'Payment Saved Successfully!',
    error_saving_payment: 'Error saving payment. Please try again.',

    // History Page
    monthly_group: 'Monthly Group',
    current: 'Current',
    specific_date_search: 'Specific Date Search',
    refreshing_records: 'Refreshing Records...',
    products: 'Products',
    remaining: 'Remaining',
    note: 'Note',
    details: 'Details',
    price: 'Price',
    voucher_total: 'Voucher Total',
    previous_balance: 'Prev. Balance',
    paid_at_site: 'Paid at Site',
    overall_total: 'Overall Total',
    direct_payment: 'Direct Payment',
    amount_paid: 'Amount Paid',
    no_activity_found: 'No activity found for this selection',
    newest_first: 'Newest First',
    oldest_first: 'Oldest First',
    are_you_sure_delete_voucher: 'Are you sure you want to delete this voucher?',
    error_deleting_voucher: 'Error deleting voucher',
    are_you_sure_delete_payment: 'Are you sure you want to delete this payment?',
    error_deleting_payment: 'Error deleting payment',

    // General
    online_only: 'Online Only',
    required: 'Required',
  },
  MM: {
    // Navigation
    home: 'ပင်မစာမျက်နှာ',
    reports: 'မှတ်တမ်းများ',
    users: 'အသုံးပြုသူများ',
    audit: 'စစ်ဆေးချက်များ',
    logout: 'ထွက်ရန်',
    language: 'ဘာသာစကား',
    
    // Customer Search & List
    select_customer: 'ဝယ်ယူသူရွေးချယ်ပါ',
    search_mode: 'ရှာဖွေရန်',
    search_customer: 'ဝယ်ယူသူအမည်ဖြင့် ရှာဖွေရန်...',
    add: 'အသစ်ထည့်ရန်',
    selected_customer: 'ရွေးချယ်ထားသော ဝယ်ယူသူ',
    no_customers_found: 'ဝယ်ယူသူရှာမတွေ့ပါ',
    browse_all: 'ဝယ်ယူသူအားလုံးကြည့်ရန်',
    hide_all: 'စာရင်းပိတ်ရန်',
    total_customers: 'ဝယ်ယူသူစုစုပေါင်း',
    local: 'စက်တွင်း',
    id: 'နံပါတ်',
    offline_notice: 'အော့ဖ်လိုင်း',
    begin_prompt: 'ရှာဖွေရန် သို့မဟုတ် ဝယ်ယူသူအားလုံးကြည့်ရန် ကိုနှိပ်ပါ',
    
    // Customer Modals
    add_new_customer: 'ဝယ်ယူသူအသစ်ထည့်ရန်',
    edit_customer: 'အချက်အလက်ပြင်ဆင်ရန်',
    customer_name: 'ဝယ်ယူသူအမည်',
    phone_number: 'ဖုန်းနံပါတ်',
    address: 'လိပ်စာ',
    cancel: 'မလုပ်တော့ပါ',
    save_customer: 'သိမ်းဆည်းမည်',
    save_changes: 'ပြင်ဆင်မှုသိမ်းမည်',
    create: 'အသစ်ပြုလုပ်မည်',
    updating: 'ပြင်ဆင်နေသည်...',
    creating: 'အသစ်လုပ်နေသည်...',
    offline_sync_notice: 'အင်တာနက်မရှိပါ။ အင်တာနက်ရလျှင် အလိုအလျောက် သိမ်းဆည်းပေးပါမည်။',
    
    // Dashboard & Actions
    quick_actions: 'အမြန်လုပ်ဆောင်ချက်များ',
    new_voucher: 'ဘောက်ချာအသစ်',
    payment: 'ငွေပေးချေမှု',
    history: 'မှတ်တမ်း',
    balance: 'လက်ကျန်ငွေ',
    estimate: 'ခန့်မှန်းခြေ',
    balance_estimate_notice: 'ခန့်မှန်းခြေလက်ကျန်ငွေ (အော့ဖ်လိုင်း) - အမှန်တကယ်နှင့် ကွာခြားနိုင်သည်',
    
    // Voucher Page
    create_voucher: 'ဘောက်ချာအသစ်ဖန်တီးရန်',
    offline_voucher_notice: 'အော့ဖ်လိုင်း - ဘောက်ချာကို စက်တွင်း၌ သိမ်းဆည်းထားပြီး အင်တာနက်ရလျှင် အလိုအလျောက် ပေးပို့ပါမည်။',
    previous_balance: 'ယခင်လက်ကျန်ငွေ',
    est: '(ခန့်မှန်း)',
    voucher_number: 'ဘောက်ချာနံပါတ်',
    voucher_date: 'နေ့စွဲ',
    items: 'ပစ္စည်းများ',
    item: 'ပစ္စည်း',
    weight_lb: 'အလေးချိန် (ပေါင်)',
    size: 'အရွယ်အစား',
    plastic_price: 'ပလပ်စတစ်စျေး',
    color: 'အရောင်',
    color_price: 'အရောင်စျေး',
    plastic: 'ပလပ်စတစ်',
    total: 'စုစုပေါင်း',
    voucher_note: 'မှတ်ချက်',
    add_note_placeholder: 'အသေးစိတ်အချက်အလက်များရေးရန်...',
    items_total: 'ပစ္စည်းစုစုပေါင်း',
    final_total: 'ကျသင့်ငွေစုစုပေါင်း',
    paid_amount: 'ပေးချေငွေ',
    remaining_balance: 'လက်ကျန်ငွေ',
    payment_method: 'ငွေပေးချေမည့်နည်းလမ်း',
    cash: 'ငွေသား',
    kbzpay: 'KBZPay',
    bank_transfer: 'Bank Transfer',
    saving: 'သိမ်းဆည်းနေသည်...',
    save_voucher: 'ဘောက်ချာသိမ်းမည်',
    enter_voucher_number: 'ဘောက်ချာနံပါတ် ထည့်ပါ။',
    voucher_saved_successfully: 'ဘောက်ချာကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။',
    error_saving_voucher: 'သိမ်းဆည်းရာတွင် အမှားအယွင်းရှိနေပါသည်။ ကျေးဇူးပြု၍ ထပ်မံကြိုးစားပါ။',
    saved_offline_auto_sync: 'စက်တွင်း၌ သိမ်းဆည်းထားသည်။ အင်တာနက်ရလျှင် အလိုအလျောက် ပေးပို့ပါမည်။',
    could_not_save: 'သိမ်းဆည်း၍ မရပါ။ ကျေးဇူးပြု၍ ထပ်မံကြိုးစားပါ။\n',

    // Payment Page
    add_payment: 'ငွေပေးချေမှုထည့်ရန်',
    offline_payment_notice: 'အော့ဖ်လိုင်း - ငွေပေးချေမှုကို စက်တွင်း၌ သိမ်းဆည်းထားပြီး အင်တာနက်ရလျှင် အလိုအလျောက် ပေးပို့ပါမည်။',
    customer: 'ဝယ်ယူသူ',
    current_debt: 'လက်ရှိကြွေးကျန်',
    current_debt_est: 'လက်ရှိကြွေးကျန် (ခန့်မှန်း)',
    payment_amount: 'ပေးချေငွေ',
    payment_date: 'ပေးချေသည့်နေ့စွဲ',
    settle_oldest: 'အဟောင်းဆုံးကြွေးကျန်များကိုအရင်ရှင်းမည်',
    recommended_regular: 'ပုံမှန်ငွေပေးချေမှုများအတွက်အကြံပြုသည်',
    note_optional: 'မှတ်ချက် (ရွေးချယ်နိုင်သည်)',
    note_placeholder: 'ဥပမာ - ငွေသား၊ ဘဏ်လွှဲ...',
    save_payment: 'ငွေပေးချေမှုသိမ်းမည်',
    enter_valid_amount: 'မှန်ကန်သောပမာဏထည့်ပါ',
    payment_saved_successfully: 'ငွေပေးချေမှုကို အောင်မြင်စွာသိမ်းဆည်းပြီးပါပြီ။',
    error_saving_payment: 'ငွေပေးချေမှုသိမ်းဆည်းရာတွင် အမှားအယွင်းရှိနေပါသည်။',

    // History Page
    monthly_group: 'လအလိုက်',
    current: 'လက်ရှိလ',
    specific_date_search: 'ရက်စွဲဖြင့်ရှာရန်',
    refreshing_records: 'မှတ်တမ်းများကိုပြန်လည်ခေါ်ယူနေသည်...',
    products: 'ပစ္စည်းများ',
    remaining: 'ကျန်ငွေ',
    note: 'မှတ်ချက်',
    details: 'အသေးစိတ်',
    price: 'စျေးနှုန်း',
    voucher_total: 'ဘောက်ချာစုစုပေါင်း',
    previous_balance: 'ယခင်ကြွေးကျန်',
    paid_at_site: 'ပေးချေပြီးငွေ',
    overall_total: 'စုစုပေါင်းကျန်ငွေ',
    direct_payment: 'ငွေပေးချေမှု',
    amount_paid: 'ပေးချေငွေ',
    no_activity_found: 'ဤအချိန်အတွက် မှတ်တမ်းမရှိပါ',
    newest_first: 'အသစ်ဦးစွာ',
    oldest_first: 'အဟောင်းဦးစွာ',
    are_you_sure_delete_voucher: 'ဤဘောက်ချာကိုဖျက်ရန် သေချာပါသလား?',
    error_deleting_voucher: 'ဘောက်ချာဖျက်ရာတွင် အမှားအယွင်းရှိနေပါသည်',
    are_you_sure_delete_payment: 'ဤငွေပေးချေမှုကိုဖျက်ရန် သေချာပါသလား?',
    error_deleting_payment: 'ငွေပေးချေမှုဖျက်ရာတွင် အမှားအယွင်းရှိနေပါသည်',

    // General
    online_only: 'အွန်လိုင်းရှိမှရမည်',
    required: 'ဖြည့်ရန်လိုအပ်သည်',
  }
};

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'EN');

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  const t = (key) => {
    return translations[lang][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
