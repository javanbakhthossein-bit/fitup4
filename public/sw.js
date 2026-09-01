/* FitUp Service Worker
 * - Caches the app shell for offline use
 * - Network-first for HTML navigations, cache-first for static assets
 * - Handles push notifications (display them, RTL Persian)
 * - Handles notification clicks (focus the app + navigate to deep-link)
 * - Periodic sync for background updates (Chrome Android only)
 * - Keepalive: SW را زنده نگه می‌دارد برای دریافت push حتی با بسته بودن اپ
 *
 * FIX (نوتیف الکی): در نسخه‌های قدیمی SW، periodicsync نوتیف‌های قدیمی را
 * دوباره نمایش می‌داد (به‌صورت «اعلان الکی» — مثلاً «برنامه آماده شد» چند
 * ساعت بعد از رویداد). حالا periodicsync فقط صفحات باز را به‌روز می‌کند؛
 * نمایش اعلان سیستم فقط از طریق push واقعی سرور (رویداد همزمان) انجام می‌شود.
 * FIX (کلیک نوتیف): مقصد کلیک با اعتبارسنجی سخت‌گیرانه فقط مسیرهای داخلی
 * اپ است — هرگز فایل sw.js یا /api باز نمی‌شود.
 *
 * IMPORTANT: This SW is disabled in development (localhost) to prevent
 * stale cache issues during HMR. It only runs in production.
 */

const CACHE_NAME = 'fitup-v9-2026-09'; // bumped: v9 — فیکس نوتیف الکی + سخت‌گیری کلیک نوتیف (بمپ = آپدیت SW روی دستگاه‌های کاربران)
const APP_SHELL = ['/', '/manifest.json', '/logo.svg', '/favicon.png'];

// Skip caching in development (localhost only)
// fitup.space-z.ai is treated as production
const isDev =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1';

self.addEventListener('install', (event) => {
  if (isDev) {
    // In dev: skip caching entirely, activate immediately
    self.skipWaiting();
    return;
  }
  // Precache app shell into the NEW versioned cache.
  // ⚠️ skipWaiting صدا زده نمی‌شود: SW جدید در حالت waiting می‌ماند تا کاربر
  // از طریق PwaUpdatePrompt پیام SKIP_WAITING را تأیید کند. با skipWaiting
  // خودکار، کش قدیمی بلافاصله حذف می‌شد و تب‌های باز chunkهای 404 می‌گرفتند.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        // Delete ALL old caches (including fitup-v1)
        const deletePromises = keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k));
        // In dev, delete ALL caches
        if (isDev) {
          deletePromises.push(...keys.map((k) => caches.delete(k)));
        }
        return Promise.all(deletePromises);
      })
      // FE-M11: clients.claim داخل waitUntil — قبلاً بیرون از آن صدا زده می‌شد
      // و race جزئی با کنترل صفحات باز وجود داشت.
      // نکته (safe update flow): این claim فقط در «نصب اول» صفحات بدون controller
      // را می‌گیرد. به‌روزرسانی واقعی فقط وقتی فعال می‌شود که کاربر پیام
      // SKIP_WAITING را بفرستد (کامپوننت PwaUpdatePrompt) — قبلاً install
      // خودش skipWaiting می‌زد و تب‌های باز می‌شکستند.
      .then(() => self.clients.claim())
  );
});

// ─── Periodic Sync — برای اجرای همیشگی در پس‌زمینه (Chrome Android) ───
// این event هر ۱۲ ساعت (یا کمتر) توسط Chrome fire می‌شود تا SW را زنده نگه دارد.
// نیاز به permission 'periodic-background-sync' دارد.
//
// ⚠️ FIX (نوتیف الکی): در نسخه قدیمی، این‌جا نوتیف‌های سرور fetch می‌شد و
// showNotification صدا زده می‌شد — بی‌خبر از read/shown بودن → اعلان‌های قدیمی
// (مثلاً «برنامه پیشرفته شما آماده شد» چند ساعت/روز بعد از رویداد) دوباره
// نمایش داده می‌شد و برای کاربر «الکی» بود. اکنون فقط صفحات باز را به‌روز
// می‌کند؛ نمایش اعلان سیستم فقط وقتی است که سرور push واقعی بفرستد (لحظه
// رویداد). اگر اپ بسته باشد، web-push که همراه createNotification ارسال
// می‌شود همان لحظه اعلان سیستم را نشان می‌دهد.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'fitup-content-sync') {
    event.waitUntil(
      (async () => {
        try {
          const res = await fetch('/api/notifications?_t=' + Date.now(), {
            cache: 'no-store',
          });
          if (res.ok) {
            const data = await res.json();
            // اگر نوتیف جدید هست، به صفحات باز اطلاع بده (فقط refresh داخلی —
            // هیچ showNotification انجام نمی‌شود)
            const unread = (data.notifications || []).some((n) => !n?.read);
            if (unread) {
              const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
              for (const client of clientList) {
                client.postMessage({ type: 'PUSH_RECEIVED', payload: data });
              }
            }
          }
        } catch (e) {
          // ignore — شبکه ممکن است در دسترس نباشد
        }
      })()
    );
  }
});

// ─── message handler — برای نگه‌داشتن SW زنده ───
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'KEEPALIVE') {
    // پاسخ به keepalive ping — SW را زنده نگه می‌دارد
    if (event.ports[0]) event.ports[0].postMessage({ type: 'ALIVE' });
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Only handle same-origin GET requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  // ⚠️ NEVER cache API responses — always go to network.
  // این مهم است: API‌ها همیشه باید از network خوانده شوند تا داده‌های تازه نمایش داده شوند.
  // بدون این، کاربر مقالات جدید، برنامه‌های جدید، کاربران جدید و ... را تا Ctrl+Shift+R نمی‌بیند.
  if (event.request.url.includes('/api/')) {
    return; // Let the browser handle it normally (no SW caching)
  }

  // In dev: bypass cache entirely (network-only)
  if (isDev) {
    return; // Let the browser handle it normally
  }

  // Production: network-first for navigations (always get latest version)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          // Cache successful navigation responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // For static assets: stale-while-revalidate (but with short cache time)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          if (response.ok && event.request.url.startsWith(self.location.origin)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Push notifications — handles both server push AND local notifications
self.addEventListener('push', (event) => {
  let data = { title: 'فیتاپ', body: 'یادآوری از فیتاپ', url: '/' };
  try {
    if (event.data) data = JSON.parse(event.data.text());
  } catch (e) {
    data.body = event.data ? event.data.text() : data.body;
  }
  // Notify all open pages that a push arrived — so they can refresh the
  // in-app notification list immediately (without waiting for the next poll).
  // این پیام در main-app.tsx توسط navigator.serviceWorker.addEventListener('message')
  // دریافت می‌شود و یک fetch فوری روی /api/notifications را trigger می‌کند.
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      client.postMessage({ type: 'PUSH_RECEIVED', payload: data });
    }
  });
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      lang: 'fa',
      vibrate: [100, 50, 100],
      data: { url: sanitizeNotificationUrl(data.url || '/') },
      tag: data.tag || 'fitup-notification',
      requireInteraction: data.requireInteraction || false,
    })
  );
});

// Handle messages from the page (for local notifications + keepalive)
// (merged with the keepalive handler above — but this one handles SHOW_NOTIFICATION too)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const data = event.data.payload || {};
    self.registration.showNotification(data.title || 'فیتاپ', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      lang: 'fa',
      vibrate: [100, 50, 100],
      data: { url: sanitizeNotificationUrl(data.url || '/') },
      tag: data.tag || 'fitup-notification',
    });
  }
});

// ─── pushsubscriptionchange: وقتی مرورگر subscription را تجدید می‌کند ───
// این برای پایداری بلندمدت حیاتی است — بدون این، پس از مدتی subscription
// منقضی می‌شود و نوتیف‌ها دیگر ارسال نمی‌شوند.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const reg = await self.registration;
      // درخواست subscription جدید با همان کلید VAPID
      const vapidKey = await fetch('/api/push/vapid-key')
        .then(r => r.json())
        .then(d => d.publicKey)
        .catch(() => null);
      if (!vapidKey) return;
      const newSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      // ثبت subscription جدید در سرور
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSub),
      });
    })()
  );
});

// تبدیل base64url به Uint8Array (برای VAPID key)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = self.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ─── Notification click ───
// FIX (باز شدن سورس sw.js): در نسخه قدیمی، مقصد نوتیف بدون اعتبارسنجی
// بود و در برخی حالت‌ها آدرس فایل خود service worker (/sw.js) باز می‌شد و
// کاربر سورس‌کد را به‌جای صفحه اپ می‌دید. اکنون مقصد قبل از ناوبری
// اعتبارسنجی می‌شود:
//   • فقط same-origin
//   • هرگز مسیر /sw.js یا /api/* یا فایل‌های داخلی
//   • مسیرهای نسبی (مثل «?tab=programs») در برابر origin حل می‌شوند
// اگر نامعتبر بود → صفحه اصلی اپ باز می‌شود.
function sanitizeNotificationUrl(raw) {
  try {
    const u = new URL(String(raw || '/'), self.location.origin);
    if (u.origin !== self.location.origin) return '/';
    if (
      u.pathname === '/sw.js' ||
      u.pathname.startsWith('/api/') ||
      u.pathname.startsWith('/_next/') ||
      u.pathname.startsWith('/src/')
    ) {
      return '/';
    }
    return u.pathname + u.search + u.hash;
  } catch (e) {
    return '/';
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // FE-M11: مقصد deep-link نوتیف — اگر پنجره‌ای باز است، علاوه بر focus
  // به مقصد هم ناوبری کن (قبلاً فقط focus می‌شد و url نادیده گرفته می‌شد)
  const targetUrl = sanitizeNotificationUrl(
    (event.notification.data && event.notification.data.url) || '/'
  );
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            if (
              typeof client.navigate === 'function' &&
              targetUrl &&
              targetUrl !== '/'
            ) {
              // ناوبری به مقصد نوتیف؛ خطا (مثلاً scope) بی‌صدا نادیده گرفته می‌شود
              client.navigate(targetUrl).catch(() => {});
            }
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});
