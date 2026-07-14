import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Wifi, WifiOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { getPendingCount, syncAll } from '../services/syncService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

/**
 * Compact pill shown in the Layout header.
 * - Green  + "Online"  — connected, nothing pending
 * - Blue   + spinning  — currently syncing
 * - Yellow + count     — online, items waiting
 * - Red    + "Offline" — no connection
 */
const SyncStatus = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    await syncAll();
    await refreshCount();
    setSyncing(false);
  }, [syncing, refreshCount]);

  const { isOnline } = useNetworkStatus({
    onReconnect: handleSync,
  });

  // Poll pending count every 5 s so the badge stays accurate
  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, 5_000);
    return () => clearInterval(id);
  }, [refreshCount]);

  // Offline
  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-[11px] font-black uppercase tracking-wider select-none">
        <WifiOff size={13} />
        <span>Offline</span>
        {pendingCount > 0 && (
          <span className="bg-red-600 text-white rounded-full px-1.5 py-0.5 text-[10px] leading-none">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  // Syncing
  if (syncing) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-black uppercase tracking-wider select-none">
        <RefreshCw size={13} className="animate-spin" />
        <span>Syncing…</span>
      </div>
    );
  }

  // Pending items
  if (pendingCount > 0) {
    return (
      <button
        onClick={handleSync}
        title="Tap to sync now"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-800 text-[11px] font-black uppercase tracking-wider hover:bg-yellow-200 active:scale-95 transition-all"
      >
        <AlertCircle size={13} />
        <span>Pending</span>
        <span className="bg-yellow-600 text-white rounded-full px-1.5 py-0.5 text-[10px] leading-none">
          {pendingCount}
        </span>
      </button>
    );
  }

  // All synced
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-[11px] font-black uppercase tracking-wider select-none">
      <CheckCircle2 size={13} />
      <span>Online</span>
    </div>
  );
};

export default SyncStatus;
