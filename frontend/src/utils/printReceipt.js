// A5 voucher -> PDF -> hand-off to the printer app (Android) or download (browser).
// The page background is the shop's own artwork (src/assets/voucher-template.jpg, A5 at
// 300 dpi = 1748 x 2480 px); the voucher details are written into its boxes at exact
// positions. It NEVER prints core weight, damage, cost or profit, nor the voucher note.
import templateUrl from '../assets/voucher-template.jpg';

const W = 1748;
const H = 2480;
const FONT = "'Noto Sans Myanmar','Padauk','Myanmar Text',Roboto,Arial,sans-serif";

// Positions measured on the template (pixels).
const POS = {
  voucherNo: { right: 1655, y: 175 }, // free corner of the grey header (the artwork has no number field)
  name: { x: 240, y: 784, maxW: 880 },
  date: { x: 1306, y: 784, maxW: 360 },
  rows: { top: 933, h: 89, count: 13 },
  cols: [
    { x: 80, w: 615, align: 'left' }, // အမည် (item)
    { x: 695, w: 222, align: 'center' }, // ပေါင်ချိန် (weight)
    { x: 917, w: 279, align: 'right' }, // နှုန်း (rate)
    { x: 1196, w: 476, align: 'right' }, // သင့်ငွေ (amount)
  ],
  boxes: { right: 1648, ys: [2166, 2268, 2370] }, // စုစုပေါင်း / ပေးငွေ / ကျန်ငွေ baselines
  prev: { x: 80, y: 2132, maxW: 800 },
};

const T = {
  discount: 'လျှော့ငွေ',
  extra: 'ထပ်ဆောင်းစရိတ်',
  previous: 'ယခင်ကျန်ငွေ',
  overall: 'အလုံးစုံကျန်ငွေ',
};

const money = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
const lbfmt = (n) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

// Rows like the paper book: each item = one line for the plastic and one line for the
// print colour (when it has a price or a name); extra charge and discount as lines.
export function receiptRows(voucher) {
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
  return rows;
}

let templatePromise = null;
function loadTemplate() {
  if (!templatePromise) {
    templatePromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { templatePromise = null; reject(new Error('voucher template failed to load')); };
      img.src = templateUrl;
    });
  }
  return templatePromise;
}

// Draw text that is shrunk (down to a minimum) until it fits maxW.
function text(ctx, str, x, y, { size = 44, bold = false, align = 'left', maxW = 9999, min = 24 } = {}) {
  const s = String(str ?? '');
  if (!s) return;
  let px = size;
  const set = () => { ctx.font = `${bold ? '700 ' : '400 '}${px}px ${FONT}`; };
  set();
  while (px > min && ctx.measureText(s).width > maxW) { px -= 2; set(); }
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

function drawPage(ctx, tpl, voucher, customerName, rows, isLast) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(tpl, 0, 0, W, H);
  ctx.fillStyle = '#000000';

  text(ctx, voucher.voucher_number, POS.voucherNo.right, POS.voucherNo.y, { size: 60, bold: true, align: 'right', maxW: 300 });
  text(ctx, customerName, POS.name.x, POS.name.y, { size: 50, bold: true, maxW: POS.name.maxW });
  text(ctx, voucher.voucher_date, POS.date.x, POS.date.y, { size: 50, bold: true, maxW: POS.date.maxW });

  rows.forEach((r, i) => {
    const y = POS.rows.top + i * POS.rows.h + 60;
    const cells = [r.d, r.w, r.r, r.a];
    cells.forEach((v, c) => {
      const col = POS.cols[c];
      const pad = 16;
      const x = col.align === 'left' ? col.x + pad : col.align === 'center' ? col.x + col.w / 2 : col.x + col.w - pad;
      text(ctx, v, x, y, { size: 46, bold: c === 3, align: col.align, maxW: col.w - pad * 2 });
    });
  });

  if (isLast) {
    const extra = Number(voucher.extra_charge_amount) || 0;
    const disc = Number(voucher.discount_amount) || 0;
    const total = (Number(voucher.items_total) || 0) + extra - disc;
    const paid = Number(voucher.paid_amount) || 0;
    [total, paid, total - paid].forEach((v, i) => {
      text(ctx, money(v), POS.boxes.right, POS.boxes.ys[i], { size: 60, bold: true, align: 'right', maxW: 440 });
    });
    const prev = Number(voucher.previous_balance) || 0;
    if (prev !== 0) {
      text(ctx, `${T.previous}: ${money(prev)}  |  ${T.overall}: ${money(voucher.remaining_balance)}`, POS.prev.x, POS.prev.y, { size: 34, bold: true, maxW: POS.prev.maxW, min: 24 });
    }
  }
}

// Returns { base64, blob, pages } of an exact A5 PDF (13 rows per page, totals on the last page).
export async function buildReceiptPdf(voucher, customerName) {
  const [{ jsPDF }, tpl] = await Promise.all([import('jspdf'), loadTemplate()]);
  const rows = receiptRows(voucher);
  const per = POS.rows.count;
  const chunks = [];
  for (let i = 0; i < Math.max(rows.length, 1); i += per) chunks.push(rows.slice(i, i + per));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const pdf = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait', compress: true });
  chunks.forEach((chunk, i) => {
    if (i > 0) pdf.addPage('a5', 'portrait');
    drawPage(ctx, tpl, voucher, customerName, chunk, i === chunks.length - 1);
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 148, 210);
  });
  const dataUri = pdf.output('datauristring');
  return { base64: dataUri.split(',')[1], blob: pdf.output('blob'), canvas, pages: chunks.length };
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
