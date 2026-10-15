// Cloudflare Pages Function: /api/standings and /api/matches
//
// A small server-side cache in front of system.szps.pl. All visitors share one copy at the edge,
// so the SZPS API is asked about once per FRESH_SECONDS, however many people open the page.
//
//   fresh copy (younger than FRESH_SECONDS)  -> served from cache, X-Cache: HIT
//   no / old copy                            -> fetched from the API, stored,    X-Cache: MISS
//   API failed but an older copy exists      -> older copy is served,            X-Cache: STALE
//   API failed and there is no copy          -> 502 with a JSON error
//
// The club id is fixed here, so this is not an open proxy.

const UPSTREAM = "https://system.szps.pl/webapi.php";
const ENDPOINTS = {
  standings: { query: "standings&club=9", valid: (d) => Array.isArray(d && d.tables) },
  matches: { query: "matches&club=9", valid: (d) => Array.isArray(d && d.matches) },
};
const FRESH_SECONDS = 600;      // 10 minutes: matches the browser-side cache
const KEEP_SECONDS = 7 * 86400; // how long an old copy is kept to bridge API outages
const TIMEOUT_MS = 8000;        // do not hang on a slow API

const json = (body, status, extra = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });

export async function onRequestGet(context) {
  const { params, request, waitUntil } = context;
  const name = String(params.name || "").replace(/\.json$/, "");
  const endpoint = ENDPOINTS[name];
  if (!endpoint) return json({ error: "not found" }, 404, { "Cache-Control": "no-store" });

  // cache key is the bare path: query strings from visitors must not create separate entries
  const cache = caches.default;
  const url = new URL(request.url);
  const key = new Request(`${url.origin}/api/${name}`);

  const cached = await cache.match(key);
  const cachedAt = cached ? Number(cached.headers.get("X-Cached-At")) || 0 : 0;
  const age = cached ? (Date.now() - cachedAt) / 1000 : Infinity;

  if (cached && age < FRESH_SECONDS) {
    return withHeaders(cached, { "X-Cache": "HIT" });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const upstream = await fetch(`${UPSTREAM}?${endpoint.query}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
    const text = await upstream.text();
    if (!endpoint.valid(JSON.parse(text))) throw new Error("unexpected response");

    const now = Date.now();
    const stored = json(text, 200, {
      "Cache-Control": `public, max-age=${KEEP_SECONDS}`,   // keeps the entry; freshness uses X-Cached-At
      "X-Cached-At": String(now),
    });
    waitUntil(cache.put(key, stored.clone()));
    return withHeaders(stored, { "X-Cache": "MISS" });
  } catch (err) {
    if (cached) return withHeaders(cached, { "X-Cache": "STALE" });
    return json({ error: "upstream unavailable" }, 502, { "Cache-Control": "no-store" });
  }
}

// what visitors' browsers get: short browser cache, so the page itself decides when to ask again
function withHeaders(res, extra) {
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "public, max-age=60");
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}
