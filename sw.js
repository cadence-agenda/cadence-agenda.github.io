/* Cadence : service worker (hors ligne + notifications) */
const CACHE = 'cadence-v6';
const SB = 'https://brxynzbajlemciybghzw.supabase.co', SBK = 'sb_publishable_dgho_oVTcyYlD0Ve2Qvbzw_4yBNsO0r';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'badge-96.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.startsWith('cadence-')).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin === location.origin) {
    e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request).then((m) => m || caches.match('index.html'))));
  } else if (u.hostname.endsWith('googleapis.com') || u.hostname.endsWith('gstatic.com')) {
    e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; })));
  }
});
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  const o = { body: d.body || '', icon: 'icon-192.png', badge: 'badge-96.png', data: { url: d.url || './', tok: d.tok || '' }, vibrate: [120, 60, 120], timestamp: Date.now() };
  if (d.tag) { o.tag = d.tag; o.renotify = true; }
  if (d.actions && d.tok) o.actions = [{ action: 'done', title: '✅ Fait' }, { action: 'snooze', title: '⏰ Dans 10 min' }];
  e.waitUntil(self.registration.showNotification(d.title || 'Cadence', o));
});
function tellClients() { return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => cs.forEach((c) => c.postMessage({ cadence: 'sync' }))); }
self.addEventListener('notificationclick', (e) => {
  const n = e.notification, d = n.data || {}; n.close();
  if ((e.action === 'done' || e.action === 'snooze') && d.tok) {
    e.waitUntil(fetch(SB + '/rest/v1/rpc/cadence_push_act', { method: 'POST', headers: { apikey: SBK, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_tok: d.tok, p_op: e.action }) })
      .then((r) => r.ok ? r.json() : 'err').catch(() => 'err').then((res) => tellClients().then(() => {
        if (res !== 'ok') return self.registration.showNotification('Cadence', { body: 'Action impossible pour le moment : ouvre l’appli pour la faire.', icon: 'icon-192.png', badge: 'badge-96.png', tag: 'cadence-err' });
      })));
    return;
  }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ('focus' in c) { c.postMessage({ cadence: 'sync' }); return c.focus(); } }
    return self.clients.openWindow(d.url || './');
  }));
});
