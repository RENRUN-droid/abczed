// ABCZed — service worker minimal, volontairement conservateur.
//
// Rôle unique : rendre l'app installable (icône + plein écran sur l'écran d'accueil) et
// laisser les pages déjà visitées se recharger même en cas de coupure réseau passagère.
// Ce service worker ne met JAMAIS en cache les appels vers Supabase (auth, données,
// Realtime) — seulement les fichiers statiques du build (JS/CSS/police/icônes) et une page
// de secours hors-ligne. Une donnée d'agenda/message vue hier ne doit jamais s'afficher comme
// si elle était fraîche aujourd'hui : la source de vérité reste toujours le réseau pour tout
// ce qui vient de Supabase, ce service worker ne s'en mêle pas.
const CACHE_NAME = 'abczed-shell-v1';
const OFFLINE_URL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  return /\.(?:js|css|woff2?|png|svg|jpg|jpeg|ico|webmanifest)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // jamais de POST/PUT/DELETE (mutations Supabase) — passthrough natif
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // jamais l'API Supabase (autre origine) — passthrough natif

  // Navigation (ouverture/rechargement d'une page) : réseau d'abord, secours cache hors-ligne.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Fichiers statiques du build uniquement : cache d'abord, réseau en secours + mise à jour
  // silencieuse du cache pour la prochaine visite.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
  // Tout le reste (appels Supabase inclus) : navigateur natif, ce service worker n'intervient pas.
});
