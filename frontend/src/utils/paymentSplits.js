// Helpers for paying one amount with several methods (Cash + KBZPay + Bank).
// "parts" = { CASH: '500000', KBZPAY: '300000', BANK_TRANSFER: '' } as typed in the form.
// "splits" = [{ method, amount }] as sent to / read from the server (only for 2+ methods).

export const METHOD_IDS = ['CASH', 'KBZPAY', 'BANK_TRANSFER'];

export const emptyParts = () => ({ CASH: '', KBZPAY: '', BANK_TRANSFER: '' });

export const methodShort = (m) => (m === 'BANK_TRANSFER' ? 'BANK' : m);

export const methodTagClass = (m) =>
  m === 'KBZPAY' ? 'bg-blue-100 text-blue-600' :
  m === 'BANK_TRANSFER' ? 'bg-purple-100 text-purple-600' :
  'bg-green-100 text-green-600';

export const splitsToParts = (splits) => {
  const parts = emptyParts();
  (splits || []).forEach((s) => { if (s.method in parts) parts[s.method] = String(s.amount); });
  return parts;
};

export const partsToSplits = (parts) =>
  METHOD_IDS
    .map((m) => ({ method: m, amount: Math.round((parseFloat(parts[m]) || 0) * 100) / 100 }))
    .filter((s) => s.amount > 0);

export const partsSum = (parts) => partsToSplits(parts).reduce((a, s) => a + s.amount, 0);

// null when the split is usable, otherwise a translation key explaining what is wrong.
export const splitError = (parts, total) => {
  const splits = partsToSplits(parts);
  if (splits.length < 2) return 'split_need_two';
  if (Math.abs(partsSum(parts) - (parseFloat(total) || 0)) > 0.01) return 'split_mismatch';
  return null;
};

// Method to store next to the amount: the largest part is the main method (older screens only know one).
export const primaryMethod = (splits) =>
  splits.reduce((best, s) => (!best || s.amount > best.amount ? s : best), null)?.method || null;

// What to show for a saved voucher/payment row: its split parts, or its single method.
export const rowMethods = (row) =>
  row.payment_splits && row.payment_splits.length > 1
    ? row.payment_splits
    : row.payment_method ? [{ method: row.payment_method }] : [];
