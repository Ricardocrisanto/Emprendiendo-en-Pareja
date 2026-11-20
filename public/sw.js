const CACHE = 'boutique-shell-v8';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/ads.js', '/core.js', '/firebase-config.js', '/manifest.webmanifest', '/assets/icon.svg', '/assets/icon-192.png', '/assets/icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('boutique-shell-')&&k!==CACHE).map(k => caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', e => {
 const url = new URL(e.request.url);
 if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/__/') || (!SHELL.includes(url.pathname) && e.request.mode !== 'navigate')) return;
 e.respondWith(fetch(e.request).then(r=>{
   if(r.ok) { const clone=r.clone(); caches.open(CACHE).then(c=>c.put(e.request, clone)); }
   return r;
 }).catch(async ()=>await caches.match(e.request) || (e.request.mode==='navigate' && await caches.match('/index.html')) || Response.error()));
});
