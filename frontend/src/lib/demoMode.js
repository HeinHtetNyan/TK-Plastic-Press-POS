// Demo mode for app reviewers (Google Play): a separate server with FAKE data, separate local
// storage and a separate offline database, so the real shop data is never touched.
// Switched on from the login screen ("App reviewer? Try the demo"), switched off by "Exit demo".
export const DEMO_API_URL = import.meta.env.VITE_DEMO_API_URL || 'https://tk-demo.heinh.dev/api';
export const DEMO_LOGIN = { username: 'demo', password: 'TKDemo2026' };

export const isDemo = () => {
  try { return localStorage.getItem('tk-demo-mode') === '1'; } catch { return false; }
};

// Every demo value lives under its own key so it can never mix with the real ones.
export const k = (key) => (isDemo() ? `demo:${key}` : key);

export const enterDemo = () => {
  try { localStorage.setItem('tk-demo-mode', '1'); } catch { /* storage unavailable */ }
  window.location.replace('/login');
};

export const exitDemo = () => {
  try { localStorage.removeItem('tk-demo-mode'); } catch { /* storage unavailable */ }
  window.location.replace('/login');
};
