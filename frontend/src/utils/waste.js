// Cardboard core / damage entries on a voucher (helpers shared by Create Voucher and the History edit form).
export const emptyWaste = (kind, from) => ({ kind, lb: '', size: from?.plastic_size || '', color: from?.color || '', gate: from?.gate || '' });
export const wastesFromServer = (list) => (list || []).map((w) => ({ kind: w.kind, lb: String(w.lb), size: w.size || '', color: w.color || '', gate: w.gate || '' }));
export const wastesToPayload = (list) => (list || []).filter((w) => parseFloat(w.lb) > 0).map((w) => ({ kind: w.kind, lb: parseFloat(w.lb), size: w.size, color: w.color, gate: w.gate || null }));
export const coreTotal = (list) => {
  const n = (list || []).filter((w) => w.kind === 'CORE').reduce((s, w) => s + (parseFloat(w.lb) || 0), 0);
  return n > 0 ? Math.round(n * 10000) / 10000 : null;
};
/** Returns a translation key when an entry with lb is missing its size or color (so we know which stock to reduce). */
export const wasteError = (list) => ((list || []).some((w) => parseFloat(w.lb) > 0 && (!w.size || !w.color)) ? 'waste_pick_stock' : null);
