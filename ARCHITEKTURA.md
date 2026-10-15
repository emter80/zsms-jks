# Architektura strony JKS SMS Jastrzębie

Strona statyczna (HTML, CSS, czysty JavaScript, bez budowania) z tabelami ligowymi i wynikami
meczów. Dane pobiera na żywo z API systemu SZPS. Jest publikowana równolegle na GitHub Pages i na
Cloudflare Pages.

> **Stan wdrożenia.** Cache po stronie serwera (Cloudflare Pages Function) został scalony do `main`
> w pull requeście [#1](https://github.com/emter80/zsms-jks/pull/1). Działa na Cloudflare; na GitHub
> Pages funkcji nie ma, więc tam strona pyta API SZPS bezpośrednio i polega na cache w przeglądarce.

## 1. Architektura i warstwy cache

```mermaid
flowchart TB
  dev["Autor zmian<br/>lokalne repo"]

  subgraph GH["GitHub"]
    repo["Repozytorium emter80/zsms-jks<br/>main, feature/cache, pull request"]
    ghp["GitHub Pages<br/>emter80.github.io/zsms-jks<br/>tylko pliki statyczne, bez funkcji"]
  end

  subgraph CF["Cloudflare"]
    cfb["Cloudflare Pages<br/>build z Git, bez komendy budowania"]
    prod["Produkcja<br/>zsms-jks.pages.dev<br/>gałąź main"]
    prev["Podglądy gałęzi<br/>hash.zsms-jks.pages.dev"]
    subgraph EDGE["Brzeg sieci Cloudflare"]
      cdn["Cache CDN<br/>Cache-Control: max-age 60 s<br/>Cf-Cache-Status, Age"]
      fn["Pages Function<br/>functions/api/name.js<br/>api/standings, api/matches"]
      kv["Cache API (caches.default)<br/>świeża 10 min<br/>stara do 7 dni = STALE"]
    end
  end

  szps["system.szps.pl<br/>webapi.php standings i matches, club=9<br/>CORS: *"]
  fonts["Google Fonts<br/>fonts.googleapis.com, gstatic"]

  subgraph BR["Przeglądarka odwiedzającego"]
    page["index.html, style.css, league.css<br/>kleby i jks SVG, ciemne i jasne"]
    logic["Logika strony<br/>HAS_OWN_ENDPOINTS"]
    ls["localStorage<br/>jks-sms-standings, jks-sms-matches: 10 min<br/>jks-theme: wybór motywu"]
  end

  dev -->|"git push"| repo
  repo -->|"publikacja main"| ghp
  repo -->|"integracja GitHub"| cfb
  cfb --> prod
  cfb --> prev

  ghp -->|"pliki statyczne"| page
  prod -->|"pliki statyczne"| page
  prev -->|"pliki statyczne"| page
  fonts -->|"fonty"| page

  page --- logic
  logic <-->|"kopia 10 min"| ls
  logic -->|"Cloudflare: najpierw api/*"| cdn
  logic -->|"GitHub Pages i fallback: bezpośrednio"| szps

  prod --> cdn
  prev --> cdn
  cdn -->|"MISS"| fn
  fn <-->|"match / put"| kv
  fn -->|"brak lub stara kopia, timeout 8 s"| szps
  kv -.->|"awaria SZPS: oddaje starą kopię"| fn
```

## 2. Przebieg jednego wejścia (Cloudflare)

```mermaid
sequenceDiagram
  autonumber
  participant B as Przeglądarka
  participant LS as localStorage
  participant CDN as Cache CDN (60 s)
  participant F as Funkcja Pages (api)
  participant C as Cache API (10 min)
  participant S as system.szps.pl

  B->>LS: czy jest kopia młodsza niż 10 min?
  alt tak
    LS-->>B: dane i czas zapisu (zero zapytań sieciowych)
  else nie
    B->>CDN: GET api/standings
    alt CDN HIT (kopia młodsza niż 60 s)
      CDN-->>B: 200, X-Cached-At
    else CDN MISS
      CDN->>F: żądanie
      F->>C: match
      alt kopia świeża (młodsza niż 10 min)
        C-->>F: kopia
        F-->>B: X-Cache HIT
      else brak lub stara kopia
        F->>S: GET standings club=9 (timeout 8 s)
        alt odpowiedź poprawna (JSON, tables)
          S-->>F: JSON
          F->>C: zapis kopii i X-Cached-At
          F-->>B: X-Cache MISS
        else awaria lub zły kształt
          alt jest stara kopia
            F-->>B: X-Cache STALE
          else brak kopii
            F-->>B: 502
            B->>S: fallback: bezpośrednie zapytanie
          end
        end
      end
    end
    B->>LS: zapis kopii (czas z X-Cached-At)
  end
```

## 3. Warstwy cache

| Warstwa | Czas | Kto ją trzyma | Wpływ na stronę |
|---------|------|---------------|-----------------|
| `localStorage` | 10 min | przeglądarka | brak zapytań sieciowych; czas „pobrane” bez zmian |
| Cache CDN | 60 s | brzeg Cloudflare | funkcja w ogóle się nie uruchamia |
| Cache API (funkcja) | 10 min, stara do 7 dni | brzeg Cloudflare | jedno zapytanie do SZPS na wszystkich odwiedzających |
| Bezpośrednie API | zawsze świeże | `system.szps.pl` | GitHub Pages oraz awaria funkcji |

## 4. Zasady działania

- **GitHub Pages** nie ma funkcji, więc strona od razu pyta `system.szps.pl` (reguła
  `HAS_OWN_ENDPOINTS`: host `*.github.io` oraz protokół inny niż http(s) pomijają własny endpoint),
  a jedynym cache jest `localStorage`.
- **Cloudflare**: najpierw `api/standings` i `api/matches` (własny endpoint z cache), a przy jego
  awarii (404, 502, zły kształt danych) bezpośrednie API.
- **Czas w stopce** („pobrane …”) to `X-Cached-At`, czyli moment, w którym kopia powstała, a nie chwila
  otwarcia strony. Bez tego nagłówka (bezpośrednie API) jest to bieżący czas.
- **Awaria API**: stara kopia (z funkcji lub z `localStorage`) jest pokazywana z komunikatem
  „API chwilowo niedostępne”, zamiast strony błędu.
- **Bezpieczeństwo funkcji**: klub (`club=9`) jest wpisany na sztywno, więc to nie jest otwarte proxy;
  parametry zapytania są ignorowane, nieznane nazwy dają 404, zapytanie do API ma limit 8 s.
- **Motyw** (jasny/ciemny) jest wyłącznie po stronie przeglądarki: `localStorage` (`jks-theme`),
  na telefonie domyślnie według ustawień systemu, na komputerze ciemny.

## 5. Pliki

| Plik | Rola |
|------|------|
| `index.html` | markup i cały JavaScript (menu, motyw, pobieranie danych, rozwijanie meczów) |
| `style.css`, `league.css` | style bazowe oraz tabele, karty, lista meczów, tło, motywy |
| `kleby.svg`, `kleby-light.svg` | tło: miękki dym (ciemny i jasny motyw) |
| `jks.svg`, `jks-light.svg` | obrys napisu JKS (złoty i zielony) |
| `functions/api/[name].js` | Cloudflare Pages Function: cache po stronie serwera (`/api/standings`, `/api/matches`) |
| `PROMPT.md` | pełny opis strony do odtworzenia przez AI |
| `ARCHITEKTURA.md` | ten dokument |
