const CACHE_NAME = 'bible-reading-v1.1.26';
const ASSETS = [
    './',
    './index.html',
    './guide.html',
    './summary.html',
    './css/style.css',
    './css/guide.css',
    './css/summary.css',
    './css/theme-light.css',
    './css/theme-dark.css',
    './js/app.js',
    './js/i18n.js',
    './js/summary.js',
    './js/pwa-handler.js',
    '../data/bible.js',
    '../data/bible_en.js'
];


const EXTERNAL_WHITELIST = [
    'huggingface.co',
    'cdn.jsdelivr.net',
    'huggingface.cloud'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        ))
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip external AI assets from caching to avoid CORS/401 complexities
    if (EXTERNAL_WHITELIST.some(domain => url.hostname.includes(domain))) {
        return; // Let it go to network directly
    }

    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
