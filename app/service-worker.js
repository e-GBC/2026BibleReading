const CACHE_NAME = 'bible-reading-v1';
const ASSETS = [
    './',
    './index.html',
    './guide.html',
    './css/style.css',
    './css/guide.css',
    './js/app.js',
    './js/i18n.js',
    './js/pwa-handler.js',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png',
    './ref/tut01_tool.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
