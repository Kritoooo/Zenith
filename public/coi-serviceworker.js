const COOP_HEADER = "Cross-Origin-Opener-Policy";
const COEP_HEADER = "Cross-Origin-Embedder-Policy";
const COOP_VALUE = "same-origin";
const COEP_VALUE = "require-corp";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const withIsolationHeaders = (response) => {
  const headers = new Headers(response.headers);
  headers.set(COOP_HEADER, COOP_VALUE);
  headers.set(COEP_HEADER, COEP_VALUE);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(request).then((response) => {
      if (!response || response.status === 0) return response;
      return withIsolationHeaders(response);
    })
  );
});
