/**
 * Habitune · PWA Registration
 * src/hooks/usePWA.ts
 *
 * Handles:
 *  - SW registration
 *  - Update prompt (new version available)
 *  - Install prompt (Add to Home Screen)
 *  - Offline queue flush via Background Sync
 */

import { useEffect, useRef, useState } from 'react';

interface PWAState {
  isInstallable: boolean;
  isUpdateReady: boolean;
  isOffline: boolean;
  install: () => Promise<void>;
  applyUpdate: () => void;
  queueOfflineLog: (data: unknown) => Promise<void>;
}

export function usePWA(): PWAState {
  const [isInstallable, setInstallable] = useState(false);
  const [isUpdateReady, setUpdateReady] = useState(false);
  const [isOffline, setOffline] = useState(!navigator.onLine);
  const deferredPrompt = useRef<any>(null);
  const waitingWorker = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    // Register SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // Listen for a new SW waiting to take over
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                waitingWorker.current = newWorker;
                setUpdateReady(true);
              }
            });
          });
        })
        .catch(console.error);

      // Reload page after SW takes control (after applyUpdate)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }

    // Install prompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Online/offline
    const onOnline  = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') {
      setInstallable(false);
      deferredPrompt.current = null;
    }
  };

  const applyUpdate = () => {
    waitingWorker.current?.postMessage({ type: 'SKIP_WAITING' });
  };

  /**
   * Queue a habit/water log for background sync when offline.
   * Falls through to a direct POST when online.
   */
  const queueOfflineLog = async (data: unknown) => {
    if (navigator.onLine) {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return;
    }

    // Store in IndexedDB; SW will flush on next 'sync' event
    const db = await openDB();
    await addPending(db, data);

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      await (reg as any).sync.register('habitune-sync-logs');
    }
  };

  return { isInstallable, isUpdateReady, isOffline, install, applyUpdate, queueOfflineLog };
}

// ── Tiny IndexedDB helpers (mirrors sw.js) ────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('habitune-offline', 1);
    req.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore('pending', {
        keyPath: 'id',
        autoIncrement: true,
      });
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror   = () => reject(req.error);
  });
}

function addPending(db: IDBDatabase, data: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('pending', 'readwrite');
    const req = tx.objectStore('pending').add({ data, ts: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}
