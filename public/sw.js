/* Service Worker — cacheo del app-shell para operación offline.
 * Los datos de inspección se persisten aparte en IndexedDB (Dexie);
 * este SW solo asegura que la app cargue sin conexión. */

// v3: el nombre del caché SOLO cambia cuando hace falta forzar que todos
// los dispositivos bajen el app-shell de nuevo — el "activate" de abajo
// borra cualquier caché con OTRO nombre, así que subir esta versión es lo
// que realmente limpia lo viejo (antes de este cambio, el nombre llevaba
// mucho tiempo fijo en "v2", así que ese borrado nunca se disparaba en la
// práctica). No hace falta subirla por cada deploy normal (los archivos
// .js de Next.js ya llevan hash en el nombre, así que un cambio de código
// normal ya se sirve solo, fresco) — solo cuando se sospecha que algún
// dispositivo quedó "pegado" en una versión vieja.
const CACHE = "arandanos-qc-v3";
const APP_SHELL = ["/", "/login", "/inspector", "/dashboard", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // No interceptar llamadas a Supabase u orígenes externos.
  if (url.origin !== self.location.origin) return;

  // Navegación: network-first con fallback a cache (SPA offline).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Estáticos: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
