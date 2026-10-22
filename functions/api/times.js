// Cloudflare Pages Function: /api/times
//
// The SZPS API has no start time, but each match page on system.szps.pl shows "godzina meczu".
// This function reads that line for the club's upcoming matches and returns { times: { match_id: "GG:MM" } }.
//
// All times live in one cache entry shared by every visitor:
//   younger than FRESH_SECONDS          -> served as is
//   older                               -> pages of matches with no time or an old time are read again,
//                                          at most MAX_PAGES per request, so SZPS is never hit in bulk
// A failed page keeps the time read before; matches already played drop out of the entry.

const UPSTREAM = "https://system.szps.pl/webapi.php?matches&club=9";
const MATCH_PAGE = (id) => `https://system.szps.pl/mecz/${encodeURIComponent(id)}/`;
const FRESH_SECONDS = 600;        // 10 minutes: same as the other endpoints
const RECHECK_SECONDS = 6 * 3600; // a time can still change, so each match page is read again after 6 h
const AHEAD_DAYS = 45;            // only matches this close need a time
const MAX_PAGES = 15;             // match pages read per request (stays far below the subrequest limit)
const KEEP_SECONDS = 7 * 86400;
const TIMEOUT_MS = 8000;

const json = (body, extra = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// "godzina meczu:</td><td>18:30" -> "18:30"; "" when the page has no time (or 00:00)
function parseTime(html) {
  const m = /godzina\s+meczu:?\s*(?:<[^>]*>\s*)*(\d{1,2})[:.](\d{2})/i.exec(html);
  if (!m || +m[1] > 23 || +m[2] > 59 || (+m[1] === 0 && +m[2] === 0)) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export async function onRequestGet({ request, waitUntil }) {
  const cache = caches.default;
  const origin = new URL(request.url).origin;
  const key = new Request(`${origin}/api/times`);

  const cached = await cache.match(key);
  const cachedAt = cached ? Number(cached.headers.get("X-Cached-At")) || 0 : 0;
  if (cached && (Date.now() - cachedAt) / 1000 < FRESH_SECONDS) return withHeaders(cached, "HIT");

  // { match_id: { time, at } }   at = when that match page was last read
  const known = cached ? (await cached.clone().json()).entries || {} : {};

  let matches;
  try {
    // the matches endpoint's cached copy saves an API call; the API itself when there is none
    const copy = await cache.match(new Request(`${origin}/api/matches`));
    matches = copy ? (await copy.json()).matches : JSON.parse(await fetchText(UPSTREAM)).matches;
    if (!Array.isArray(matches)) throw new Error("unexpected response");
  } catch (err) {
    if (cached) return withHeaders(cached, "STALE");
    return json({ times: {} }, { "Cache-Control": "no-store" });
  }

  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const until = new Date(now + AHEAD_DAYS * 86400000).toISOString().slice(0, 10);
  const upcoming = matches.filter((m) =>
    !m.score && String(m.visitor || "").trim() && String(m.home || "").trim() &&
    m.match_date >= today && m.match_date <= until);

  const entries = {};
  const due = [];
  for (const m of upcoming) {
    const old = known[m.match_id];
    if (old) entries[m.match_id] = old;
    if (!old || now - old.at > RECHECK_SECONDS * 1000) due.push(m.match_id);
  }
  // matches never read first, then the oldest reads
  due.sort((a, b) => (entries[a] ? entries[a].at : 0) - (entries[b] ? entries[b].at : 0));

  await Promise.all(due.slice(0, MAX_PAGES).map(async (id) => {
    try {
      entries[id] = { time: parseTime(await fetchText(MATCH_PAGE(id))), at: now };
    } catch (err) { /* keep the old time, try again next time */ }
  }));

  const times = {};
  for (const [id, e] of Object.entries(entries)) if (e.time) times[id] = e.time;
  const stored = json({ times, entries }, {
    "Cache-Control": `public, max-age=${KEEP_SECONDS}`,
    "X-Cached-At": String(now),
  });
  waitUntil(cache.put(key, stored.clone()));
  return withHeaders(stored, "MISS");
}

// visitors get only the times, with a short browser cache
async function withHeaders(res, state) {
  const { times } = await res.json();
  return json({ times }, {
    "Cache-Control": "public, max-age=60",
    "X-Cached-At": res.headers.get("X-Cached-At") || "",
    "X-Cache": state,
  });
}
