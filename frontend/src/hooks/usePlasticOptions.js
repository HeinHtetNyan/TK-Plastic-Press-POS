import { useState, useEffect, useCallback } from 'react';
import { optionService } from '../services/api';

// Size / Color / Gate pick-lists. Cached in localStorage so the Create Voucher form still shows the
// choices offline; a choice typed while offline is kept locally and sent to the server later.
const CACHE_KEY = 'plastic_options_v1';
const PENDING_KEY = 'plastic_options_pending_v1';

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};

const empty = { sizes: [], colors: [], gates: [], prints: [] };
const LIST_OF = { SIZE: 'sizes', COLOR: 'colors', GATE: 'gates', PRINT: 'prints' };

export const usePlasticOptions = () => {
  const [options, setOptions] = useState(() => ({ ...empty, ...read(CACHE_KEY, empty) }));

  const refresh = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      // Send anything typed while offline first, then reload the lists.
      const pending = read(PENDING_KEY, []);
      const stillPending = [];
      for (const p of pending) {
        try { await optionService.add(p.kind, p.name); } catch (e) { if (!e.response) stillPending.push(p); }
      }
      write(PENDING_KEY, stillPending);
      const { data } = await optionService.list();
      write(CACHE_KEY, data);
      setOptions({ ...empty, ...data });
    } catch { /* keep cached lists */ }
  }, []);

  useEffect(() => {
    const initialRefresh = setTimeout(refresh, 0);
    window.addEventListener('online', refresh);
    return () => {
      clearTimeout(initialRefresh);
      window.removeEventListener('online', refresh);
    };
  }, [refresh]);

  /** Add a new choice. Resolves to the saved name. Works offline (kept locally, sent later). */
  const addOption = useCallback(async (kind, rawName) => {
    const name = rawName.split(/\s+/).filter(Boolean).join(' ');
    if (!name) return '';
    const key = LIST_OF[kind];
    const addLocal = (id) => setOptions((prev) => {
      if ((prev[key] || []).some((o) => o.name === name)) return prev;
      const next = { ...prev, [key]: [...(prev[key] || []), { id, kind, name }].sort((a, b) => a.name.localeCompare(b.name)) };
      write(CACHE_KEY, next);
      return next;
    });
    try {
      const { data } = await optionService.add(kind, name);
      addLocal(data.id);
    } catch (e) {
      if (e.response) throw e;
      write(PENDING_KEY, [...read(PENDING_KEY, []), { kind, name }]);
      addLocal(`local_${name}`);
    }
    return name;
  }, []);

  return { options, addOption, refresh };
};
