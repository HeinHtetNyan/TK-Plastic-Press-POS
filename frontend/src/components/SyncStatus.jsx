import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Wifi, WifiOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { getPendingCount, syncAll } from '../services/syncService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useLanguage } from '../context/LanguageContext';

/**
 * Compact pill shown in the Layout header.
 * - Green  + "Online"  — connected, nothing pending
 * - Blue   + spinning  — currently syncing
 * - Yellow + count     — online, items waiting
 * - Red    + "Offline" — no connection
 */
const SyncStatus = () => {
  const { t } = useLanguage();
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
    const initialRefresh = setTimeout(refreshCount, 0);
    const id = setInterval(refreshCount, 5_000);
    return () => {
      clearTimeout(initialRefresh);
      clearInterval(id);
    };
  }, [refreshCount]);

  // Offline
  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-debt-bg text-debt text-[.87em] font-medium whitespace-nowrap select-none">
        <WifiOff size={14} strokeWidth={2} />
        <span>{t('x2_offline')}</span>
        {pendingCount > 0 && (
          <span className="font-semibold">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  // Syncing
  if (syncing) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-band text-accent text-[.87em] font-medium whitespace-nowrap select-none">
        <RefreshCw size={14} strokeWidth={2} className="animate-spin" />
        <span>{t('x2_syncing')}</span>
      </div>
    );
  }

  // Pending items
  if (pendingCount > 0) {
    return (
      <button
        onClick={handleSync}
        title={t('x2_tap_sync')}
        className="flex items-center gap-1.5 px-2.5 min-h-8 rounded-full bg-extra-bg text-extra text-[.87em] font-medium whitespace-nowrap"
      >
        <AlertCircle size={14} strokeWidth={2} />
        <span>{t('x2_pending')}</span>
        <span className="font-semibold">
          {pendingCount}
        </span>
      </button>
    );
  }

  // All synced
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-ok-bg text-ok text-[.87em] font-medium whitespace-nowrap select-none">
      <CheckCircle2 size={14} strokeWidth={2} />
      <span>{t('x2_online')}</span>
    </div>
  );
};

export default SyncStatus;
