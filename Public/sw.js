/**
 * Habitune · Service Worker
 * public/sw.js
 *
 * Strategy:
 *  - Shell (HTML/CSS/JS):  Cache-first, update in background
 *  - API calls:            Network-first, fall back to cached response
 *  - Images/fonts:         Cache-first, long TTL
 *  - Habit logs offline:   Background sync queue
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE   = `habitune-shell-${CACHE_VERSION}`;
const DATA_CACHE    = `habitune-data-${CACHE_VERSION}`;
const SYNC_TAG      = 'habitune-sync-logs';

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install: pre-cache shell ──────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// ── Activate: purge old caches ────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: route by type ──────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and browser-extension requests
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Google Fonts — cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // API calls — network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // App shell (HTML) — stale-while-revalidate so user never waits
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  // Static assets — cache-first
  event.respondWith(cacheFirst(request, SHELL_CACHE));
});

// ── Strategies ────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? offlineFallback();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  return cached ?? fetchPromise;
}

function offlineFallback() {
  return new Response(
    JSON.stringify({ error: 'offline', message: 'No connection. Log will sync when back online.' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

// ── Background Sync: offline habit logs ──────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushOfflineLogs());
  }
});

async function flushOfflineLogs() {
  const db = await openDB();
  const logs = await getAllPending(db);

  for (const log of logs) {
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log.data),
      });
      if (res.ok) await deletePending(db, log.id);
    } catch {
      // Will retry on next sync event
    }
  }
}

// ── Minimal IndexedDB wrapper for offline queue ───────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('habitune-offline', 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = () => reject(req.error);
  });
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending', 'readonly');
    const req = tx.objectStore('pending').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function deletePending(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending', 'readwrite');
    const req = tx.objectStore('pending').delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? 'Habitune';
  const options = {
    body: data.body ?? 'Aura is waiting for you.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: data.tag ?? 'habitune-nudge',
    renotify: true,
    data: { url: data.url ?? '/' },
    actions: [
      { action: 'log', title: '💧 Log water' },
      { action: 'dismiss', title: 'Later' },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'log') {
    event.waitUntil(clients.openWindow('/?action=water'));
  } else {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
