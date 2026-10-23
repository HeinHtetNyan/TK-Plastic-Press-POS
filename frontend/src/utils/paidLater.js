// Display-only helper for the history sheet. Nothing here is saved or sent anywhere.
//
// A voucher's "Remaining" is saved once, when the voucher is made, and later payments never change it.
// So an old voucher can keep showing a red Remaining after the customer paid everything.
// A voucher counts as "paid later" when it was saved with Remaining > 0 and, replaying this customer's
// vouchers and direct payments in the order they were entered, the customer's balance is back to 0
// (or below) at some later entry.

const net = (v) => (v.items_total || 0) + (v.extra_charge_amount || 0) - (v.discount_amount || 0);

const dayOf = (s) => {
  const parts = String(s || '').split('-');
  return parts.length === 3 ? new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime() : NaN;
};

// When the entry was typed in; falls back to the voucher/payment date if there is no usable timestamp.
const enteredAt = (row, dateField) => {
  const t = Date.parse(row.created_at);
  return Number.isNaN(t) ? dayOf(row[dateField]) : t;
};

const idNum = (row) => (typeof row.id === 'number' ? row.id : Number.MAX_SAFE_INTEGER);

export const paidLaterIds = (vouchers, payments) => {
  const events = [
    ...vouchers.map((v) => ({ kind: 'v', row: v, at: enteredAt(v, 'voucher_date') })),
    ...payments.map((p) => ({ kind: 'p', row: p, at: enteredAt(p, 'payment_date') })),
  ].sort((a, b) => (a.at - b.at) || (a.kind === b.kind ? idNum(a.row) - idNum(b.row) : a.kind === 'v' ? -1 : 1));

  let balance = 0;
  const after = events.map((e) => {
    balance += e.kind === 'v'
      ? net(e.row) - (e.row.paid_amount || 0)
      : -((e.row.amount_paid || 0) + (e.row.discount_amount || 0));
    return balance;
  });

  const ids = new Set();
  events.forEach((e, i) => {
    if (e.kind === 'v' && (e.row.remaining_balance || 0) > 0.5 && after.slice(i + 1).some((b) => b <= 0.5)) {
      ids.add(e.row.id);
    }
  });
  return ids;
};
