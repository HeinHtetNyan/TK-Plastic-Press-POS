// Size = FRONT number + "x" + SECOND number, stored as one text like "4½ x 6" (same format as the old sizes).
const SPLIT = /\s*[x×*]\s*/i;
export const parseSize = (v) => {
  const s = (v || '').trim();
  const m = s.match(SPLIT);
  if (!m) return { front: s, back: '' };
  return { front: s.slice(0, m.index).trim(), back: s.slice(m.index + m[0].length).trim() };
};
export const joinSize = (front, back) => (front ? (back ? `${front} x ${back}` : front) : '');

// the front numbers = every first number in the existing size list (4, 4½, 5 ...), each once
export const frontOptions = (sizes, current) => {
  const seen = new Map();
  (sizes || []).forEach((o) => {
    const f = parseSize(o.name).front;
    if (f && !seen.has(f)) seen.set(f, { id: `f_${f}`, name: f });
  });
  if (current && !seen.has(current)) seen.set(current, { id: `f_${current}`, name: current });
  const num = (s) => parseFloat(s.replace('½', '.5')) || 0;
  return [...seen.values()].sort((a, b) => num(a.name) - num(b.name) || a.name.localeCompare(b.name));
};
