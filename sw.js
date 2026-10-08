const CACHE = 'cosmomath-v8';
const ASSETS = ['./', './index.html', './css/style.css', './js/tasks.js', './js/speech.js', './js/curriculum.js', './js/app.js', './manifest.webmanifest', './icons/icon.svg'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// сеть в приоритете, кэш как запасной вариант (офлайн)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return r;
    }).catch(err => caches.match(e.request).then(hit => {
      if (hit) return hit;
      if (e.request.mode === 'navigate') return caches.match('./index.html');
      throw err; // не подменяем ресурсы: пусть ошибка сети уйдёт как есть
    }))
  );
});
