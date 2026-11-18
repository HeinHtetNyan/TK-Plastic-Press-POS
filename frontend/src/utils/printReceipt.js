// A5 voucher -> PDF -> hand-off to the printer app (Android) or download (browser).
// The voucher is drawn as HTML (so the browser/WebView shapes Myanmar text correctly),
// turned into an image, and placed on one exact A5 page. Layout copies the paper voucher
// book. It NEVER prints core weight, damage, cost or profit.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
const lbfmt = (n) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

// Shop details printed in the header. EDIT HERE (text from the paper voucher book).
// Leave a line empty ('') to hide it.
export const SHOP = {
  title: 'သန်းကြွယ်',
  subtitle: 'ပလတ်စတစ်ပုံနှိပ်လုပ်ငန်း',
  homeLine: 'အနန္တမေတ္တာတိုက်၊ ဘူတာလမ်း၊ ရုံးကြီးရပ်၊ မုံရွာမြို့။',
  homePhone: '၀၇၁-၂၀၂၂၄၆၈',
  factoryLine: 'အ၀ေးပြေးလမ်း၊ စက်မှုဇုန်(၁)၊ မုံရွာမြို့။',
  factoryPhone: '၀၇၁-၂၀၂၅၀၇၉',
  factoryMobile: '၀၉-၂၁၃၀၇၉၀',
};

export const RECEIPT_TEXT = {
  home: 'အိမ်',
  factory: 'စက်ရုံ',
  name: 'အမည်',
  date: 'နေ့စွဲ',
  item: 'အမည်',
  weight: 'ပေါင်ချိန်',
  rate: 'နှုန်း',
  amount: 'သင့်ငွေ',
  total: 'စုစုပေါင်း',
  paid: 'ပေးငွေ',
  remaining: 'ကျန်ငွေ',
  due: 'ရမည့်နေ့',
  sign: 'လက်မှတ်',
  previous: 'ယခင်ကျန်ငွေ',
  overall: 'အလုံးစုံကျန်ငွေ',
  discount: 'လျှော့ငွေ',
  extra: 'ထပ်ဆောင်းစရိတ်',
};

// Rows like the paper book: each item = one line for the plastic and one line for the
// print colour (when it has a price or a name).
export function receiptRows(voucher) {
  const T = RECEIPT_TEXT;
  const rows = [];
  (voucher.items || []).forEach((it) => {
    const lb = Number(it.lb) || 0;
    const pp = Number(it.plastic_price) || 0;
    const cp = Number(it.color_price) || 0;
    const size = [it.plastic_size, it.gate].filter(Boolean).join(' ');
    rows.push({ d: [size, it.color].filter(Boolean).join(' '), w: lbfmt(lb) + ' lb', r: money(pp), a: money(lb * pp) });
    if (cp > 0 || it.print_color) {
      rows.push({ d: [it.plastic_size, it.print_color].filter(Boolean).join(' '), w: lbfmt(lb) + ' lb', r: money(cp), a: money(lb * cp) });
    }
  });
  const extra = Number(voucher.extra_charge_amount) || 0;
  const disc = Number(voucher.discount_amount) || 0;
  if (extra > 0) rows.push({ d: voucher.extra_charge_note || T.extra, w: '', r: '', a: money(extra) });
  if (disc > 0) rows.push({ d: T.discount, w: '', r: '', a: '-' + money(disc) });
  // The voucher note is deliberately NOT printed (user, 11-18).
  return rows;
}

export function receiptHtml(voucher, customerName) {
  const T = RECEIPT_TEXT;
  const rows = receiptRows(voucher);
  const bodyH = 372;
  const count = Math.max(12, rows.length);
  const rowH = Math.max(22, Math.floor(bodyH / count));
  const fs = rowH >= 30 ? 18 : rowH >= 26 ? 16 : 14;
  const body = Array.from({ length: count }, (_, i) => {
    const r = rows[i] || { d: '', w: '', r: '', a: '' };
    return `<div class="tr" style="height:${rowH}px;line-height:${rowH}px;font-size:${fs}px"><span class="c1">${esc(r.d)}</span><span class="c2">${esc(r.w)}</span><span class="c3">${esc(r.r)}</span><span class="c4">${esc(r.a)}</span></div>`;
  }).join('');
  const extra = Number(voucher.extra_charge_amount) || 0;
  const disc = Number(voucher.discount_amount) || 0;
  const total = (Number(voucher.items_total) || 0) + extra - disc;
  const paid = Number(voucher.paid_amount) || 0;
  const left = total - paid;
  const prev = Number(voucher.previous_balance) || 0;
  const line = (label, text, tail) => (text || tail)
    ? `<div class="ad"><b>&#9654;</b> ${label} - ${esc(text)}${tail || ''}</div>` : '';
  const ph = (p) => (p ? ` &#160;&#9742; ${esc(p)}` : '');
  const homeLine = line(T.home, SHOP.homeLine, ph(SHOP.homePhone));
  const factLine = line(T.factory, SHOP.factoryLine, ph(SHOP.factoryPhone) + (SHOP.factoryMobile ? ` &#160;&#9990; ${esc(SHOP.factoryMobile)}` : ''));
  const box = (label, val) => `<div class="bx"><span class="bl">${label} &#8594;</span><span class="bv">${val}</span></div>`;
  return `
<div class="page">
  <style>
    .page{width:559px;height:794px;box-sizing:border-box;padding:22px 26px;background:#fff;color:#000;position:relative;overflow:hidden;
      font-family:'Noto Sans Myanmar','Padyauk','Myanmar Text',Roboto,Arial,sans-serif;line-height:1.35}
    .hd{background-color:#9f9c5c;border-radius:10px;padding:8px 10px 2px}
    .top{position:relative;text-align:center;padding-bottom:4px}
    .tk{position:absolute;top:0;width:84px;height:46px;background:#0f4a17;color:#fff;font-weight:900;font-size:36px;line-height:46px;text-align:center;font-family:'Arial Black',Impact,Arial,sans-serif;letter-spacing:-2px}
    .tk.l{left:0;border-radius:23px 0 0 23px}.tk.r{right:0;border-radius:0 23px 23px 0}
    .no{position:absolute;right:0;top:46px;font-size:19px;font-weight:700;letter-spacing:2px;font-family:Arial,sans-serif}
    .t1{font-size:38px;font-weight:900;line-height:1.5;color:#06280a}
    .t2{font-size:23px;font-weight:800;color:#06280a;line-height:1.5;display:inline-block;position:relative;padding:0 30px}
    .t2:before,.t2:after{content:'';position:absolute;top:8px;width:30px;height:22px;background:repeating-linear-gradient(115deg,#0f4a17 0 8px,transparent 8px 11px)}
    .t2:before{left:0}.t2:after{right:0}
    .ad{background:#fff;border-radius:6px;padding:0 6px;font-size:12.5px;line-height:1.7;text-align:left;margin-top:7px;white-space:nowrap;overflow:hidden}
    .ad b{font-size:11px;color:#2e7d32}
    .nm{background:#fff;border-radius:6px;padding:0 8px;display:flex;gap:10px;margin:8px 0 8px;line-height:1.7;font-size:18px;font-weight:700;color:#1a237e}
    .nm .a{flex:1;border-bottom:1.5px solid #2e7d32;display:flex;gap:8px;min-width:0}
    .nm .a span:last-child{overflow:hidden;white-space:nowrap}
    .nm .d{width:150px;border-bottom:1.5px solid #2e7d32;display:flex;gap:8px}
    .th{display:flex;font-size:15px;font-weight:800;color:#fff}
    .th span{background:#2e7d32;border-radius:7px;padding:6px 4px;text-align:center;box-sizing:border-box;border-right:3px solid #fff}
    .c1{width:39%}.c2{width:21%}.c3{width:16%}.c4{width:24%}
    .grid{position:relative;border:2px solid #2e7d32;margin-top:8px}
    .wm{position:absolute;left:0;right:0;top:34%;text-align:center;font-size:78px;font-weight:900;color:#7d7830;opacity:.5}
    .grid .tr{display:flex;border-bottom:1px solid #2e7d32;position:relative}
    .grid .tr:last-child{border-bottom:0}
    .grid .tr span{box-sizing:border-box;padding:0 6px;border-left:1.5px solid #2e7d32;overflow:hidden;white-space:nowrap}
    .grid .tr span:first-child{border-left:0}
    .grid .c2{text-align:center}.grid .c3,.grid .c4{text-align:right}
    .bot{display:flex;justify-content:space-between;margin-top:8px}
    .lf{width:46%;font-size:15px;font-weight:700}
    .lf .ln{display:flex;gap:6px;border-bottom:1.5px solid #2e7d32;margin-top:24px;min-height:20px}
    .lf .pv{font-size:13px;margin-top:6px}
    .rt{width:52%}
    .bx{display:flex;margin-bottom:5px;gap:4px;height:36px}
    .bl{width:44%;background:#2e7d32;color:#fff;border-radius:7px;font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center}
    .bv{flex:1;border:2px solid #2e7d32;border-radius:5px;font-size:21px;font-weight:800;display:flex;align-items:center;justify-content:flex-end;padding:0 8px}
  </style>
  <div class="hd">
  <div class="top">
    <span class="tk l">TK</span><span class="tk r">TK</span>
    <div class="no">${esc(voucher.voucher_number)}</div>
    <div class="t1">${esc(SHOP.title)}</div>
    <div class="t2">${esc(SHOP.subtitle)}</div>
    ${homeLine}${factLine}
  </div>
  <div class="nm"><div class="a"><span>${T.name}</span><span>${esc(customerName)}</span></div><div class="d"><span>${T.date}</span><span>${esc(voucher.voucher_date)}</span></div></div>
  </div>
  <div class="th"><span class="c1">${T.item}</span><span class="c2">${T.weight}</span><span class="c3">${T.rate}</span><span class="c4" style="border-right:0">${T.amount}</span></div>
  <div class="grid"><div class="wm">${esc(SHOP.title)}</div>${body}</div>
  <div class="bot">
    <div class="lf">
      <div class="ln"><span>${T.due}</span></div>
      <div class="ln"><span>${T.sign}</span></div>
      ${prev !== 0 ? `<div class="pv">${T.previous}: ${money(prev)} &#160;|&#160; ${T.overall}: ${money(voucher.remaining_balance)}</div>` : ''}
    </div>
    <div class="rt">${box(T.total, money(total))}${box(T.paid, money(paid))}${box(T.remaining, money(left))}</div>
  </div>
</div>`;
}

// Draws the voucher with the browser's own layout engine (HTML inside an SVG image), so the
// text lands exactly where the preview shows it, whatever the app's page styles are.
async function renderToCanvas(html, w = 559, h = 794, scale = 3) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml">${html}</div></foreignObject></svg>`;
  const img = new Image();
  img.width = w;
  img.height = h;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('voucher image failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

// Returns { base64, blob, canvas } of an exact A5 PDF.
export async function buildReceiptPdf(voucher, customerName) {
  const { jsPDF } = await import('jspdf');
  const canvas = await renderToCanvas(receiptHtml(voucher, customerName));
  const pdf = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait', compress: true });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 148, 210);
  const dataUri = pdf.output('datauristring');
  return { base64: dataUri.split(',')[1], blob: pdf.output('blob'), canvas };
}

// Android app exposes window.TKAndroid.sharePdf(base64, fileName); a browser just downloads.
export async function printVoucher(voucher, customerName) {
  const safe = String(voucher.voucher_number || 'voucher').replace(/[^\w.-]+/g, '_');
  const fileName = `TK-voucher-${safe}.pdf`;
  const { base64, blob } = await buildReceiptPdf(voucher, customerName);
  if (window.TKAndroid && typeof window.TKAndroid.sharePdf === 'function') {
    window.TKAndroid.sharePdf(base64, fileName);
    return 'android';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'download';
}
