// Saved times are the shop's own clock (Myanmar, Asia/Yangon), but the server sends them marked as UTC.
// So the clock reading is shown exactly as it was saved, with no time zone conversion: every device sees Myanmar time.
const parse = (v) => new Date(`${String(v).slice(0, 19)}Z`);

export const shopDateTime = (v) =>
  parse(v).toLocaleString('en-GB', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

export const shopDate = (v) => parse(v).toLocaleDateString('en-GB', { timeZone: 'UTC' });

// "Now" at the shop: a Date whose year / month / day / hour read as Myanmar time (UTC+6:30, no summer time).
export const shopNow = () => {
  const d = new Date(Date.now() + 6.5 * 60 * 60 * 1000);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
};

// Today's date at the shop as dd-mm-yyyy, the format the app sends.
export const shopToday = () => shopNow().toLocaleDateString('en-GB').split('/').join('-');
