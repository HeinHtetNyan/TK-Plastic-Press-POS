// Per-device display preferences (text size, theme). Saved in localStorage and applied to <html>.
// index.html applies the saved values before first paint; these helpers do the same at runtime.
const KEYS = { theme: 'tk-theme', size: 'tk-text-size' };

const read = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};

export const getTheme = () => (read(KEYS.theme) === 'dark' ? 'dark' : 'light');
export const getTextSize = () => (read(KEYS.size) === 'large' ? 'large' : 'normal');

export const setTheme = (theme) => {
  const root = document.documentElement;
  if (theme === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
  try { localStorage.setItem(KEYS.theme, theme); } catch { /* storage unavailable */ }
};

export const setTextSize = (size) => {
  const root = document.documentElement;
  if (size === 'large') root.setAttribute('data-text-size', 'large');
  else root.removeAttribute('data-text-size');
  try { localStorage.setItem(KEYS.size, size); } catch { /* storage unavailable */ }
};
