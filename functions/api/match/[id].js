// Cloudflare Pages Function: /api/match/{match_id}
//
// The SZPS API has no match details (start time, venue), but each match page on system.szps.pl shows them.
// This function reads that page and returns { time, place: [lines], number }; any of them can be empty.
//
//   fresh copy (younger than FRESH_SECONDS)  -> served from cache, X-Cache: HIT
//   no / old copy                            -> page read again, stored,          X-Cache: MISS
//   page failed but an older copy exists     -> older copy is served,             X-Cache: STALE
//   page failed and there is no copy         -> 502 with a JSON error
//
// Only numeric ids are accepted and only system.szps.pl/mecz/{id}/ is read, so this is not an open proxy.

const MATCH_PAGE = (id) => `https://system.szps.pl/mecz/${id}/`;
const FRESH_SECONDS = 3600;     // 1 hour: time and venue rarely change, one page read per match per hour
const KEEP_SECONDS = 7 * 86400; // how long an old copy is kept to bridge outages
const TIMEOUT_MS = 8000;

const json = (body, status, extra = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });

// page HTML -> non-empty text lines, one per cell / line break
function textLines(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(td|th|tr|div|p|li|h\d|label|dt|dd)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

// The page is a list of "label:" lines, each followed by its value (or "label: value" on one line)
function parseMatch(html) {
  const lines = textLines(html);
  const find = (re) => lines.findIndex((l) => re.test(l));
  const sameLine = (i, re) => (i >= 0 ? lines[i].replace(re, "").trim() : "");

  const ti = find(/^godzina meczu:?/i);
  const rawTime = sameLine(ti, /^godzina meczu:?/i) || (ti >= 0 ? lines[ti + 1] || "" : "");
  const t = /^(\d{1,2})[:.](\d{2})$/.exec(rawTime);
  const time = t && +t[1] < 24 && +t[2] < 60 && (+t[1] || +t[2]) ? `${t[1].padStart(2, "0")}:${t[2]}` : "";

  // venue: every line after "Mecz rozgrywany w:" up to the next label
  const place = [];
  const pi = find(/^mecz rozgrywany w:?/i);
  if (pi >= 0) {
    const first = sameLine(pi, /^mecz rozgrywany w:?/i);
    if (first) place.push(first);
    for (let i = pi + 1; i < lines.length && !/:$/.test(lines[i]) && !/^obsada/i.test(lines[i]); i++) {
      place.push(lines[i]);
    }
  }

  const ni = find(/^mecz numer\b/i);
  const number = ni >= 0 ? lines[ni].replace(/^mecz numer:?/i, "").replace(/\s*rozgrywany dnia.*$/i, "").trim() : "";

  return { time, place: place.slice(0, 6), number };
}

export async function onRequestGet({ params, request, waitUntil }) {
  const id = String(params.id || "");
  if (!/^\d{1,9}$/.test(id)) return json({ error: "not found" }, 404, { "Cache-Control": "no-store" });

  const cache = caches.default;
  const key = new Request(`${new URL(request.url).origin}/api/match/${id}`);
  const cached = await cache.match(key);
  const cachedAt = cached ? Number(cached.headers.get("X-Cached-At")) || 0 : 0;
  if (cached && (Date.now() - cachedAt) / 1000 < FRESH_SECONDS) return withHeaders(cached, { "X-Cache": "HIT" });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const page = await fetch(MATCH_PAGE(id), { signal: ctrl.signal });
    clearTimeout(timer);
    if (!page.ok) throw new Error(`HTTP ${page.status}`);

    const stored = json(parseMatch(await page.text()), 200, {
      "Cache-Control": `public, max-age=${KEEP_SECONDS}`,   // keeps the entry; freshness uses X-Cached-At
      "X-Cached-At": String(Date.now()),
    });
    waitUntil(cache.put(key, stored.clone()));
    return withHeaders(stored, { "X-Cache": "MISS" });
  } catch (err) {
    if (cached) return withHeaders(cached, { "X-Cache": "STALE" });
    return json({ error: "upstream unavailable" }, 502, { "Cache-Control": "no-store" });
  }
}

// what visitors' browsers get: a short browser cache
function withHeaders(res, extra) {
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "public, max-age=300");
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}
