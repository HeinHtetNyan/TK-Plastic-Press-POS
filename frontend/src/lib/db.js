import Dexie from 'dexie';
import { isDemo } from './demoMode';

/**
 * UUID generator that works in both secure (HTTPS) and non-secure (HTTP LAN)
 * contexts. Android Chrome over a local IP does NOT have crypto.randomUUID().
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 v4 using Math.random()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Local IndexedDB database for offline-first support.
 *
 * Naming convention:
 *   client_id  — UUID generated on the client. Always present. Primary key locally.
 *   server_id  — Integer assigned by the backend after a successful sync. Null until synced.
 *   sync_status — 'synced' | 'pending' | 'failed'
 *
 * For customers that already exist on the server, client_id = 'server_<server_id>'.
 * For records created while offline, client_id = crypto.randomUUID().
 */
const db = new Dexie(isDemo() ? 'TKPlasticPress-demo' : 'TKPlasticPress');

db.version(1).stores({
  customers: '&client_id, server_id, name, sync_status, created_at',
  vouchers:
    '&client_id, server_id, customer_client_id, customer_server_id, voucher_number, sync_status, created_at',
  payments:
    '&client_id, server_id, customer_client_id, customer_server_id, sync_status, created_at',
  sync_queue:
    '++localId, client_id, type, action, status, depends_on_client_id, created_at',
});

db.version(2).stores({
  // Offline-created spending/outcome entries (admin only)
  spendings: '&client_id, server_id, spending_date, sync_status, created_at',
});

export default db;
