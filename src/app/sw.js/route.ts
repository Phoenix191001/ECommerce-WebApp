// F-109: service worker that shows store notifications. Served at /sw.js on every host.
const SW = `
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || "Update", { body: d.body || "", data: { url: d.url || "/" }, icon: d.icon }));
});
// F-85: the POS page (and the scripts it needs) keep working without a connection.
const CACHE = "pos-v1";
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }))));
  } else if (req.mode === "navigate" && /\/manage\/pos\/?$/.test(url.pathname)) {
    e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }).catch(() => caches.match(req).then((hit) => hit || Response.error())));
  }
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.endsWith(url) && "focus" in c) return c.focus();
    return clients.openWindow(url);
  }));
});
`;

export function GET() {
  return new Response(SW, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=3600", "service-worker-allowed": "/" } });
}

export const dynamic = "force-static";
