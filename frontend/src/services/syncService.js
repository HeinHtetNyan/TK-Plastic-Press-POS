import db from '../lib/db';
import api from './api';

const MAX_RETRIES = 3;
const SYNC_INTERVAL_MS = 15_000; // 15 seconds

let syncIntervalId = null;
let isSyncing = false;

// Pending-count helpers (used by SyncStatus component)

export async function getPendingCount() {
  return db.sync_queue.where('status').anyOf(['pending', 'processing', 'failed']).count();
}

// Balance cache helpers

/**
 * Persist the last-known server balance for a customer so we can
 * approximate it when offline.
 */
export function cacheBalance(customerServerId, balance) {
  try {
    localStorage.setItem(
      `balance_${customerServerId}`,
      JSON.stringify({ balance, ts: Date.now() })
    );
  } catch (err) {
    console.warn('[sync] Failed to write balance cache to localStorage:', err);
  }
}

export function getCachedBalance(customerServerId) {
  try {
    const raw = localStorage.getItem(`balance_${customerServerId}`);
    if (!raw) return null;
    return JSON.parse(raw).balance;
  } catch (_) {
    return null;
  }
}

/**
 * Compute an estimated balance when the server is unreachable.
 * Starts from the last cached server value and adds any local-pending
 * vouchers / payments that have not been synced yet.
 */
export async function getOfflineBalance(customerClientId, customerServerId) {
  const base = getCachedBalance(customerServerId) ?? 0;

  const [pendingVouchers, pendingPayments] = await Promise.all([
    db.vouchers
      .where({ customer_client_id: customerClientId, sync_status: 'pending' })
      .toArray(),
    db.payments
      .where({ customer_client_id: customerClientId, sync_status: 'pending' })
      .toArray(),
  ]);

  const voucherDelta = pendingVouchers.reduce(
    (sum, v) => sum + (v.items_total || 0) + (v.extra_charge_amount || 0) - (v.discount_amount || 0) - (v.paid_amount || 0),
    0
  );
  const paymentDelta = pendingPayments.reduce(
    (sum, p) => sum + (p.amount_paid || 0) + (p.discount_amount || 0),
    0
  );

  return base + voucherDelta - paymentDelta;
}

// Customer sync

async function syncCustomer(item) {
  const res = await api.post('/customers/', {
    ...item.payload,
    client_id: item.client_id,
  });

  const serverCustomer = res.data;

  // Update local record: set server_id and mark synced
  await db.customers.update(item.client_id, {
    server_id: serverCustomer.id,
    sync_status: 'synced',
  });

  // Re-point any vouchers / payments that were using the old offline customer_server_id
  // (they stored null because customer wasn't synced; now fill in the real server id)
  await db.vouchers
    .where('customer_client_id')
    .equals(item.client_id)
    .modify({ customer_server_id: serverCustomer.id });

  await db.payments
    .where('customer_client_id')
    .equals(item.client_id)
    .modify({ customer_server_id: serverCustomer.id });
}

// Voucher sync

async function syncVoucher(item) {
  const { customer_client_id, ...payload } = { ...item.payload };

  // Resolve customer_id if the customer was also created offline
  if (!payload.customer_id) {
    const customer = await db.customers.get(customer_client_id);
    if (!customer?.server_id) {
      throw new Error('Customer not yet synced — voucher deferred');
    }
    payload.customer_id = customer.server_id;
  }

  const res = await api.post('/vouchers', {
    ...payload,
    client_id: item.client_id,
  });

  await db.vouchers.update(item.client_id, {
    server_id: res.data.id,
    sync_status: 'synced',
    items_total: res.data.items_total,
    extra_charge_note: res.data.extra_charge_note ?? null,
    extra_charge_amount: res.data.extra_charge_amount ?? 0,
    discount_amount: res.data.discount_amount ?? 0,
    previous_balance: res.data.previous_balance,
    final_total: res.data.final_total,
    remaining_balance: res.data.remaining_balance,
  });
}

// Payment sync

async function syncPayment(item) {
  const { customer_client_id, ...payload } = { ...item.payload };

  if (!payload.customer_id) {
    const customer = await db.customers.get(customer_client_id);
    if (!customer?.server_id) {
      throw new Error('Customer not yet synced — payment deferred');
    }
    payload.customer_id = customer.server_id;
  }

  const res = await api.post('/payments', {
    ...payload,
    client_id: item.client_id,
  });

  await db.payments.update(item.client_id, {
    server_id: res.data.id,
    sync_status: 'synced',
  });
}

// Spending sync

async function syncSpending(item) {
  const res = await api.post('/spendings', {
    ...item.payload,
    client_id: item.client_id,
  });
  await db.spendings.update(item.client_id, {
    server_id: res.data.id,
    sync_status: 'synced',
  });
}

async function syncSpendingUpdate(item) {
  const { server_id, ...fields } = item.payload;
  await api.put(`/spendings/${server_id}`, fields);
  await db.spendings.update(item.client_id, {
    description: fields.description,
    amount: fields.amount,
    spending_date: fields.spending_date,
    sync_status: 'synced',
  });
}

async function syncSpendingDelete(item) {
  try {
    await api.delete(`/spendings/${item.payload.server_id}`);
  } catch (err) {
    if (err.response?.status !== 404) throw err;
  }
  await db.spendings.delete(item.client_id);
}

// Customer update sync

async function syncCustomerUpdate(item) {
  const { server_id, ...fields } = item.payload;
  const res = await api.put(`/customers/${server_id}`, fields);
  await db.customers.update(item.client_id, {
    name: res.data.name,
    phone_numbers: res.data.phone_numbers ?? null,
    address: res.data.address ?? null,
    sync_status: 'synced',
  });
}

// Voucher / Payment delete sync

async function syncVoucherDelete(item) {
  try {
    await api.delete(`/vouchers/${item.payload.server_id}`);
  } catch (err) {
    if (err.response?.status !== 404) throw err; // already deleted on server — treat as success
  }
  await db.vouchers.delete(item.client_id);
}

async function syncPaymentDelete(item) {
  try {
    await api.delete(`/payments/${item.payload.server_id}`);
  } catch (err) {
    if (err.response?.status !== 404) throw err;
  }
  await db.payments.delete(item.client_id);
}

// Core sync loop

async function processQueueItem(item) {
  // If this item depends on another, verify the dependency is done
  if (item.depends_on_client_id) {
    const dep = await db.sync_queue
      .where('client_id')
      .equals(item.depends_on_client_id)
      .first();
    if (dep && dep.status !== 'done') {
      if (dep.status === 'failed') {
        // Dependency permanently failed — escalate this item too so it doesn't block forever
        await db.sync_queue.update(item.localId, { status: 'failed', retries: MAX_RETRIES });
        console.warn(`[sync] ${item.type}:${item.action} ${item.client_id} → failed (dependency ${dep.client_id} permanently failed)`);
      }
      return;
    }
  }

  // Mark as processing so the UI can show it
  await db.sync_queue.update(item.localId, { status: 'processing' });

  try {
    if (item.type === 'customer' && item.action === 'create') await syncCustomer(item);
    else if (item.type === 'customer' && item.action === 'update') await syncCustomerUpdate(item);
    else if (item.type === 'voucher' && item.action === 'create') await syncVoucher(item);
    else if (item.type === 'voucher' && item.action === 'delete') await syncVoucherDelete(item);
    else if (item.type === 'payment' && item.action === 'create') await syncPayment(item);
    else if (item.type === 'payment' && item.action === 'delete') await syncPaymentDelete(item);
    else if (item.type === 'spending' && item.action === 'create') await syncSpending(item);
    else if (item.type === 'spending' && item.action === 'update') await syncSpendingUpdate(item);
    else if (item.type === 'spending' && item.action === 'delete') await syncSpendingDelete(item);

    await db.sync_queue.update(item.localId, { status: 'done' });
  } catch (err) {
    const retries = (item.retries || 0) + 1;
    const newStatus = retries >= MAX_RETRIES ? 'failed' : 'pending';
    await db.sync_queue.update(item.localId, { retries, status: newStatus });
    console.warn(`[sync] ${item.type}:${item.action} ${item.client_id} → ${newStatus} (attempt ${retries})`, err?.message);
  }
}

/**
 * Main sync function. Processes all pending queue items in insertion order.
 * Safe to call concurrently — a lock (isSyncing) prevents overlapping runs.
 */
export async function syncAll() {
  if (!navigator.onLine || isSyncing) return;

  isSyncing = true;

  try {
    // Process customers first (vouchers/payments may depend on them)
    const customers = await db.sync_queue
      .where({ type: 'customer', status: 'pending' })
      .sortBy('localId');
    for (const item of customers) {
      if (!navigator.onLine) break;
      await processQueueItem(item);
    }

    // Then vouchers and payments in creation order
    const rest = await db.sync_queue
      .where('status')
      .anyOf(['pending'])
      .and(item => item.type !== 'customer')
      .sortBy('localId');

    for (const item of rest) {
      if (!navigator.onLine) break;
      await processQueueItem(item);
    }
  } finally {
    isSyncing = false;
  }
}

// Interval / lifecycle

export async function startSyncEngine() {
  if (syncIntervalId) return; // already running
  // Reset failed/processing items — processing means the app was killed mid-sync
  await db.sync_queue
    .where('status').anyOf(['failed', 'processing'])
    .modify({ status: 'pending', retries: 0 });
  if (navigator.onLine) syncAll();
  syncIntervalId = setInterval(() => {
    if (navigator.onLine) syncAll();
  }, SYNC_INTERVAL_MS);
}

export function stopSyncEngine() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}

// Helpers for pages: enrich a server customer with client_id fields

/**
 * Converts a server customer object (from API) into the enriched shape
 * used throughout the app: adds client_id and server_id.
 */
export function enrichCustomer(serverCustomer) {
  return {
    ...serverCustomer,
    client_id: `server_${serverCustomer.id}`,
    server_id: serverCustomer.id,
    address: serverCustomer.address ?? null,
    sync_status: 'synced',
  };
}

/**
 * Cache an array of server customers into IndexedDB.
 * Safe to call on every API fetch — uses bulkPut so existing records
 * are updated rather than duplicated.
 */
export async function cacheCustomers(serverCustomers) {
  const rows = serverCustomers.map(c => ({
    client_id: `server_${c.id}`,
    server_id: c.id,
    name: c.name,
    phone_numbers: c.phone_numbers ?? null,
    address: c.address ?? null,
    created_at: c.created_at,
    sync_status: 'synced',
  }));
  await db.customers.bulkPut(rows);

  // Resolve stuck pending/failed creates whose customer is now confirmed on the server
  const pendingCreates = await db.sync_queue
    .where({ type: 'customer', action: 'create' })
    .filter(item => item.status === 'pending' || item.status === 'failed')
    .toArray();
  for (const item of pendingCreates) {
    const customer = await db.customers.get(item.client_id);
    if (customer?.server_id) {
      await db.sync_queue.update(item.localId, { status: 'done' });
    }
  }
}

/**
 * Load all customers from IndexedDB (used when offline).
 * Returns in the same enriched shape that enrichCustomer() produces.
 */
export async function loadCachedCustomers() {
  const rows = await db.customers.orderBy('name').toArray();
  return rows.map(r => ({
    id: r.server_id ?? r.client_id,
    client_id: r.client_id,
    server_id: r.server_id,
    name: r.name,
    phone_numbers: r.phone_numbers,
    address: r.address,
    created_at: r.created_at,
    sync_status: r.sync_status,
  }));
}

// Voucher / Payment cache helpers (used by History page)

export async function cacheVouchers(customerClientId, serverVouchers) {
  const rows = serverVouchers.map(v => ({
    client_id: v.client_id ?? `server_${v.id}`,
    server_id: v.id,
    customer_client_id: customerClientId,
    customer_server_id: v.customer_id,
    voucher_number: v.voucher_number,
    voucher_date: v.voucher_date,
    items_total: v.items_total,
    extra_charge_note: v.extra_charge_note ?? null,
    extra_charge_amount: v.extra_charge_amount ?? 0,
    discount_amount: v.discount_amount ?? 0,
    paid_amount: v.paid_amount,
    payment_method: v.payment_method,
    note: v.note,
    items: v.items,
    remaining_balance: v.remaining_balance,
    previous_balance: v.previous_balance,
    final_total: v.final_total,
    sync_status: 'synced',
    created_at: v.created_at,
  }));
  await db.vouchers.bulkPut(rows);
}

export async function cachePayments(customerClientId, serverPayments) {
  const rows = serverPayments.map(p => ({
    client_id: p.client_id ?? `server_${p.id}`,
    server_id: p.id,
    customer_client_id: customerClientId,
    customer_server_id: p.customer_id,
    amount_paid: p.amount_paid,
    discount_amount: p.discount_amount ?? 0,
    payment_method: p.payment_method,
    payment_date: p.payment_date,
    note: p.note,
    sync_status: 'synced',
    created_at: p.created_at,
  }));
  await db.payments.bulkPut(rows);
}

export async function loadCachedVouchers(customerClientId) {
  const rows = await db.vouchers
    .where('customer_client_id')
    .equals(customerClientId)
    .toArray();
  return rows.map(v => ({
    id: v.server_id ?? v.client_id,
    client_id: v.client_id,
    server_id: v.server_id,
    voucher_number: v.voucher_number,
    voucher_date: v.voucher_date,
    items_total: v.items_total ?? 0,
    extra_charge_note: v.extra_charge_note ?? null,
    extra_charge_amount: v.extra_charge_amount ?? 0,
    discount_amount: v.discount_amount ?? 0,
    paid_amount: v.paid_amount ?? 0,
    payment_method: v.payment_method,
    note: v.note,
    items: v.items ?? [],
    remaining_balance: v.remaining_balance ?? 0,
    previous_balance: v.previous_balance ?? 0,
    final_total: v.final_total ?? 0,
    sync_status: v.sync_status,
    created_at: v.created_at,
  }));
}

export async function loadCachedPayments(customerClientId) {
  const rows = await db.payments
    .where('customer_client_id')
    .equals(customerClientId)
    .toArray();
  return rows.map(p => ({
    id: p.server_id ?? p.client_id,
    client_id: p.client_id,
    server_id: p.server_id,
    amount_paid: p.amount_paid,
    discount_amount: p.discount_amount ?? 0,
    payment_method: p.payment_method,
    payment_date: p.payment_date,
    note: p.note,
    sync_status: p.sync_status,
    created_at: p.created_at,
  }));
}

export default { syncAll, startSyncEngine, stopSyncEngine, getPendingCount };
