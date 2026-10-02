const CACHE = "mmdreza-hub-v2"; // bump this whenever you change the file list
const START = "./landing.html";

const CORE = [
  "./",
  START,
  "./index.html",
  "./indexFa.html",
  "./qa.html",
  "./backend-qa.html",
  "./frontend-qa.html",
  "./devops-qa.html",
  "./Game.html",
  "./solar_system_dark.html",
  "./manifest.json",
  "./favicon.ico",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      // add one by one so a single missing file can't break the whole install
      .then((c) =>
        Promise.allSettled(
          CORE.map((url) =>
            c.add(url).catch((err) => console.warn("SW skip:", url, err)),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // let external requests pass through

  // Page navigations: network first, then cache, then landing page
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches
            .match(req, { ignoreSearch: true })
            .then((hit) => hit || caches.match(START)),
        ),
    );
    return;
  }

  // Everything else (css, js, images, Unity TemplateData…): stale-while-revalidate
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
