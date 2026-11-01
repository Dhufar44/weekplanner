// Service worker : garde l'appli en cache pour qu'elle fonctionne hors ligne.
// Pour publier une mise à jour, change le numéro de version ci-dessous.
const VERSION = 'mes-recettes-v6';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache d'abord, réseau sinon : pour les fichiers qui ne changent jamais à une adresse donnée.
function cacheFirst(event) {
  event.respondWith(
    caches.open(VERSION).then(cache => cache.match(event.request).then(hit => hit || fetch(event.request).then(res => {
      if (res.ok || res.type === 'opaque') cache.put(event.request, res.clone());
      return res;
    })))
  );
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Polices Google et kit Firebase (version fixée dans l'adresse).
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return cacheFirst(event);
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) return cacheFirst(event);

  // Tout le reste hors du site (base Firestore, connexion Google) passe directement au réseau.
  if (url.origin !== self.location.origin) return;

  // Fichiers de l'appli (dont firebase-config.js) : réponse immédiate depuis le cache, mise à jour en arrière-plan.
  event.respondWith(
    caches.open(VERSION).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(hit => {
        const network = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; })
          .catch(() => hit || cache.match('./index.html'));
        return hit || network;
      })
    )
  );
});
