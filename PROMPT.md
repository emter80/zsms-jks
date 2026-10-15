# Zadanie: strona z tabelami ligowymi i wynikami klubu siatkarskiego JKS SMS Jastrzębie

Zbuduj jednostronicową, statyczną stronę (HTML + CSS + trochę czystego JavaScriptu, bez frameworków i bez
kroku budowania), hostowaną na GitHub Pages. Strona pobiera dane na żywo z publicznego API systemu SZPS
i pokazuje tabele ligowe oraz wyniki meczów wszystkich drużyn klubu. Interfejs po polsku, w barwach
klubowych (zieleń + złoto), dwa motywy (ciemny i jasny), działa dobrze na telefonie.

## 1. Pliki

- `index.html` (markup + cały JavaScript w tagach `<script>`)
- `style.css` (bazowy motyw, nagłówek, menu, typografia, hamburger na telefonie)
- `league.css` (tabele, karty zwijane, lista meczów, tło, motywy, nadpisania)
- `kleby.svg`, `kleby-light.svg` (tło: miękki dym, ciemny i jasny)
- `jks.svg`, `jks-light.svg` (kontur napisu JKS, złoty i zielony)

Fonty z Google Fonts: Montserrat (500/600/700), Inter (400/500/600/700), Poppins (300/400/500/600),
Monoton (400). Użyj `font-display: swap`.

## 2. Dane (API, bez klucza, CORS otwarty)

Dwa żądania GET:

1. `https://system.szps.pl/webapi.php?standings&club=9` zwraca
   `{ club_id, club_name, tables: [ { competition, group_name, phase, finals, total_teams,
   club_teams: [ { team, position, points, matches_played, wins, sets_won, sets_lost,
   points_scored, points_conceded } ], full_standings: [ ...ten sam kształt wiersza... ] } ] }`.
2. `https://system.szps.pl/webapi.php?matches&club=9` zwraca
   `{ matches: [ { match_id, home, visitor, match_date: "RRRR-MM-DD", competition_name,
   group_name, phase: "1", score } ] }`, gdzie `score` to `null` (mecz nierozegrany)
   albo tekst w stylu `"<b>3:1</b> (25:16, 25:20, 16:25, 25:21)"`.

Dopasowanie meczu do tabeli: ta sama `competition_name == competition` i `group_name`, a drużyna
występuje jako `home` lub `visitor`.

### Pułapki w danych (obsłuż je)

- Nazwy drużyn mają zbędne spacje na końcu i podwójne spacje. Normalizuj: rozbij po białych znakach
  i złącz pojedynczą spacją.
- `match_date = "2000-01-01"` oznacza „brak terminu”. Pokaż „termin do ustalenia”, a na liście
  najbliższych meczów umieść takie mecze na końcu.
- Puste `visitor` (spacja) to wolny los. Nie pokazuj takiego meczu na liście najbliższych.
- Pole `phase` to etap rozgrywek. Pokazuj tylko etap 1 (stała `ACTIVE_PHASE = 1`; `null` pokazuje
  wszystkie etapy). Tego samego filtra użyj dla tabel i dla meczów.
- Wynik rozbijaj regexem: `(\d+):(\d+)` w pogrubieniu, potem punkty setów w nawiasie. Pomijaj sety
  `0:0`. Nie wstawiaj danych z API przez `innerHTML`, tylko `textContent`.
- Ten sam klub może mieć kilka drużyn w jednej tabeli (JKS, JKS II, JKS III).

## 3. Struktura i zachowanie strony

### Kategorie
Grupuj tabele po `competition`. Kolejność: `I Liga Śląska Kobiet` (wyświetlana jako **Seniorki**),
`Juniorki`, `Juniorki Młodsze`, `Młodziczki`; nieznane kategorie na końcu w kolejności z API.
Nowa liga w API ma pojawiać się sama, bez zmian w kodzie. W obrębie kategorii sortuj grupy
naturalnie (numerycznie) po `group_name`. Każda kategoria to `<section id="...">` ze slugiem
(bez polskich znaków).

### Karta tabeli (zwinięta domyślnie)
Każda tabela to karta z elementem `<details>` i `<summary>`. Domyślnie wszystkie zwinięte.
Zawartość `summary`:
- tytuł `h3`: `Nazwa kategorii – nazwa grupy` (np. „Seniorki – Grupa 1”, „Juniorki – 2 Liga A”);
  grupy zapisane samym numerem/skrótem (`1`, `6`, `11M`) pokazuj jako „Grupa 1” itd.;
- linia meta: `Rozgrywki · drużyn: N` (np. „Juniorki · drużyn: 6”);
- złota linia z naszymi drużynami: `JKS SMS Jastrzębie: 4. miejsce, 6 pkt` (kilka drużyn
  oddzielonych `·`);
- strzałka (chevron) po prawej, obracana po otwarciu; złote podkreślenie tytułu rośnie od lewej
  przy najechaniu, fokusie i w stanie otwartym.

Po rozwinięciu tabela ma kolumny: Poz, Drużyna, M, W, Pkt, Sety (`wygrane:przegrane`),
Małe pkt (`zdobyte:stracone`). Na ekranach ≤560 px ukryj „Małe pkt”, tabela ma się mieścić
bez przewijania w bok.

### Wiersze naszych drużyn i lista meczów
- Wiersze drużyn klubu mają podświetlone tło (akcent 16%), pasek akcentu z lewej i numer pozycji
  w kolorze złota (tekstowego). Nazwa jest przyciskiem `<button>` (`aria-expanded`) ze strzałką.
  Klikalny jest **cały wiersz** (kursor pointer, rozjaśnienie przy hover, złote podkreślenie nazwy).
  Przycisk zostaje dla klawiatury i czytników ekranu, a klik w sam przycisk przełącza tylko raz.
- Klik rozwija pod wierszem dodatkowy wiersz z listą meczów tej drużyny w tej grupie. Nadaj mu własną
  klasę (np. `matches-row`), **nie `detail`**: ta nazwa koliduje ze starą regułą szablonu
  (półprzezroczyste ciemne tło) i w jasnym motywie dawała ciemny pas.
- Dwie sekcje: **Wyniki** (najnowsze na górze) i **Najbliższe mecze** (rosnąco po dacie, bez terminu
  na końcu).
- Pozycja meczu: data `dd.mm.rrrr`, gospodarz i gość (nasza drużyna pogrubiona, rywale w kolorze
  tekstu), po prawej znacznik **W** lub **P** (wygrana/przegrana, nie polegaj tylko na kolorze)
  i wynik w setach, pod spodem małym drukiem punkty w setach. Lewy pasek w kolorze akcentu przy
  wygranej i czerwonawy przy przegranej. Dla nierozegranych brak wyniku.
- Na telefonie (≤560 px): data w osobnej linii, gospodarz nad gościem, wyniki setów w osobnej linii
  pod spodem, żeby nazwy miały pełną szerokość. Powyżej 560 px: „Gospodarz – Gość” w jednej linii.
- Mecze pobieraj leniwie dopiero przy pierwszym rozwinięciu i trzymaj w pamięci strony (jedno
  zapytanie na sesję).

### Menu, przełącznik motywu i stopka
- Sticky pasek u góry: logo tekstowe `ZSMS   JKS` w kroju Monoton z gradientem (ciemny motyw:
  złoto → szmaragd, jasny: ciemne złoto `#8A6200` → zieleń `#0B6B3A`) oraz linki do kategorii
  (generowane z danych). Pod linkami złote podkreślenie rośnie od lewej przy hover, a przed linkiem
  jest mała kropka w kolorze akcentu. Poniżej 820 px menu zwija się do hamburgera (przycisk
  z `aria-expanded`, zamyka się po wyborze linku i po Esc).
- **Przełącznik motywu**: okrągły przycisk 40 px z ikoną księżyca (motyw ciemny) lub słońca (jasny),
  zawsze widoczny w pasku (po prawej na komputerze, obok hamburgera na telefonie). `aria-label`
  zmienia się z motywem („Przełącz na motyw jasny/ciemny”).
- **Skoki z menu do kategorii**: sekcja ma lądować dokładnie pod paskiem, tak żeby nie wystawał
  dół poprzedniej karty. `scroll-padding-top` ma być równe zmierzonej wysokości paska
  (zmienna `--bar-h`, mierzona skryptem po załadowaniu fontów, przy zmianie rozmiaru i po zamknięciu
  menu; nie mierz, gdy menu na telefonie jest otwarte, bo pasek jest wtedy wyższy). Ostatnia sekcja
  ma `min-height` równe wysokości ekranu minus pasek (`100svh − --bar-h`), inaczej przy zwiniętych
  kartach strona jest za krótka i do ostatniej kategorii nie da się przewinąć. Sekcja wybrana
  z menu (`:target`) na 1,6 s podświetla pierwszą kartę złotą ramką (wyłączone przy
  `prefers-reduced-motion`).
- Stopka: `Dane: system.szps.pl · pobrane <data i godzina>`.
- Brak osobnego nagłówka „Kategoria” nad kartami: nazwa kategorii jest częścią tytułu każdej tabeli.
- Przy braku danych/awarii bez kopii: komunikat „Nie udało się pobrać danych z API: …”.
- Podczas ładowania: „Ładowanie danych…”.

## 4. Cache i odporność

- **Cache po stronie serwera** (Cloudflare Pages Functions, plik `functions/api/[name].js`): endpointy
  `/api/standings` i `/api/matches` pobierają dane z `system.szps.pl` i trzymają **jedną wspólną kopię
  dla wszystkich odwiedzających** (`caches.default`, 10 minut, klub na sztywno `club=9`, więc to nie jest
  otwarte proxy). Odpowiedź ma nagłówki `X-Cache: HIT | MISS | STALE` i `X-Cached-At` (czas kopii w ms).
  Gdy API nie odpowiada, a stara kopia istnieje, serwer oddaje ją z `X-Cache: STALE` (do 7 dni); bez kopii
  zwraca 502. Zła odpowiedź API (nie-JSON, zły kształt) nie nadpisuje dobrej kopii.
- **Strona** pyta najpierw własnego endpointu (`api/standings`, ścieżka względna), a gdy zawiedzie
  (404, 502, zły kształt danych), to bezpośrednio API SZPS. Na hostach, które nie mogą mieć funkcji
  (`*.github.io` oraz każda strona nie serwowana przez http(s), np. plik lokalny), własny endpoint jest
  pomijany od razu, żeby nie robić zbędnego zapytania z 404 przy każdym wejściu (stała
  `HAS_OWN_ENDPOINTS`; dopasowanie hosta po kropce lub początku nazwy, więc `evilgithub.io` nie jest
  traktowane jak GitHub Pages). Czas „pobrane” bierze z `X-Cached-At`, a `X-Cache: STALE` włącza komunikat
  o awarii API.
- `localStorage`, osobne klucze dla tabel i meczów, ważność **10 minut** (`CACHE_SECONDS = 600`).
- Gdy cache jest starszy, spróbuj pobrać dane. Jeśli się nie uda (offline, awaria API),
  pokaż **ostatnią zapisaną kopię** z żółto-złotym komunikatem „API chwilowo niedostępne. Pokazuję
  zapisane dane z …” nad kartami, w liście meczów i w stopce.
- Waliduj kształt danych (`tables` i `matches` mają być tablicami); uszkodzony cache ignoruj.
- `localStorage` może być zablokowany (tryb prywatny). Opakuj odczyt i zapis w `try/catch`, a bez
  cache pobieraj za każdym razem.

## 5. Motywy (ciemny i jasny)

### Który motyw jest wybierany
Kolejność reguł, rozstrzygana małym skryptem w `<head>`, **zanim strona się narysuje** (bez błysku
złego motywu):
1. zapisany wybór odwiedzającego (`localStorage`, klucz `jks-theme`: `light` lub `dark`);
2. na **telefonie** motyw z ustawień telefonu (`prefers-color-scheme`), także gdy zmieni się w trakcie
   (nasłuch `change`), dopóki nie ma zapisanego wyboru;
3. na komputerze i tablecie zawsze **ciemny**, niezależnie od ustawień systemu.

Telefon = `matchMedia("(pointer: coarse)")` i `Math.min(screen.width, screen.height) < 600`.
Wybrany motyw ustawia `data-theme="light|dark"` na `<html>`, `color-scheme` oraz meta `theme-color`
(`#0F1210` / `#FFFDF5`). Wszystkie kolory strony biorą się ze zmiennych CSS (`:root` = ciemny,
`:root[data-theme="light"]` = jasny), bez kolorów wpisanych na sztywno w regułach (jako zapas
dopuszczalna wartość ciemna we `var()`).

### Paleta ciemna
Tło `#0F1210`, karta `#161B18` (krycie 90%), kafel meczu `#1B211D`, tekst `#ffffff`, tekst główny
`#c9cbcf`, przygaszony `#8b8f96`, opis `#b5b8be`, linie `#222B25`, akcent szmaragd `#10B981`,
złoto `#E6B75A` (także tekstowe), mięta `#6EE7B7`. Przegrana: pasek `#e0736a`, tekst `#f0a3a3`.

### Paleta jasna
Tło `#FFFDF5`, karta biała (krycie 92%), kafel meczu `#F1F5EA`, tekst `#14261C`, tekst główny
`#2E4237`, przygaszony `#5F7266`, opis `#4F6258`, linie `#DCE3D3`, akcent zieleń `#0B6B3A`,
złoto dekoracyjne `#E0A800`, **złoto tekstowe `#7A5A00`** (jasne złoto na bieli ma kontrast ok. 2:1,
więc nigdy nie używaj go na tekst), pasek górny `rgba(255,253,245,.92)`. Przegrana: pasek `#C94A3F`,
tekst `#B3362B`. Zaznaczenie tekstu: złote tło, ciemny tekst.

### Przełączanie
Klik w przełącznik zmienia motyw, zapisuje wybór w `localStorage` (w `try/catch`) i od tego momentu
wybór wygrywa ze wszystkim. Zmiana kolorów może mieć krótkie przejście (ok. 0,15 s).

## 6. Wygląd

### Typografia
- Montserrat 700: tytuły kart, h3.
- Poppins: tekst ogólny, linie meta, podtytuły.
- **Inter** (waga 400, 600 dla punktów i naszych drużyn, 700 dla wyniku): tabele i listy meczów,
  z `font-variant-numeric: tabular-nums`.
- Monoton: logo w pasku i obrys JKS w tle.
- Rozmiary: tabela ≈ 0,94 rem (≈ 0,86 rem na telefonie), nagłówki kolumn nie mniejsze niż 11 px
  (wielkie litery, rozstrzelone), zapis setów ≥ 12 px.

### Tło (statyczne, bez animacji)
Jedna warstwa `position: fixed` o wysokości `100lvh` (nie `background-attachment: fixed`, bo na
telefonach skacze przy chowaniu paska adresu, a iOS Safari go ignoruje), `translateZ(0)`, za całą
treścią. Zawiera dwie rzeczy:
1. **Dym** (`kleby.svg` / `kleby-light.svg`, `background-size: cover`): 20 rozmytych obłoków
   rysowanych kołami z filtrami SVG (`feTurbulence` + `feDisplacementMap` + `feGaussianBlur`),
   wyraziste, nie pastelowe:
   - ciemny: kolory `#12C98C`, `#4FF0B5`, `#F2C25C`, krycie 0,28–0,62, rozmycie 17, poświata
     szmaragdowa pośrodku i ciepła złota w prawym górnym rogu;
   - jasny: kremowe tło `#FFFDF5`, kolory `#0A9460`, `#2CC98E`, `#E0A100`, krycie do 0,66,
     rozmycie 15, zielona poświata i złota w prawym górnym rogu.
2. **Napis JKS** (`jks.svg` ciemny złoty `#E6B75A`, `jks-light.svg` zielony `#0B6B3A`): krojem
   Monoton, **sam obrys**, grubość 1 px (`vector-effect: non-scaling-stroke`), płasko (bez
   perspektywy), biegnący po przekątnej od lewego dolnego do prawego górnego rogu ekranu (obrót
   o `atan2(-100vh, 100vw)`, długość ≈ 74% przekątnej, zapas `-32deg` dla przeglądarek bez funkcji
   trygonometrycznych), krycie 50%. Kontury wygeneruj z pliku fontu Monoton jako ścieżki SVG
   (obraz jako `<div>` z `background-image: var(--jks)`, żeby kolor szedł za motywem).

### Detale
- Karty: lewy pasek akcentu 3–4 px, `border-bottom` 1 px, odstęp między kartami 14 px, pierwsza
  karta 32 px pod paskiem.
- Przyciski i linki: wyraźny `:focus-visible` (kontur w kolorze akcentu).
- `prefers-reduced-motion`: wyłącz przejścia i animację podświetlenia celu.

## 7. Dostępność i jakość

- Semantyczny HTML (`header`, `nav`, `main`, `section`, `footer`, `details/summary`, `table`).
- Kontrast tekstu ≥ 4,5:1 w obu motywach, cele dotykowe nazw drużyn ≥ 44 px na urządzeniach
  dotykowych (ujemny margines, żeby wiersze nie rosły).
- Brak przewijania poziomego od 360 px szerokości.
- Brak zależności zewnętrznych poza fontami i API; pliki w katalogu głównym, względne ścieżki.
- Dodaj `meta description` obejmujący wszystkie kategorie (seniorki, juniorki, juniorki młodsze,
  młodziczki) oraz `theme-color` zgodny z motywem.
- Podnoś numer wersji w linkach do CSS (`style.css?v=N`) przy każdej zmianie, bo GitHub Pages
  i przeglądarki mobilne trzymają stare pliki.

## 8. Kryteria akceptacji

1. Po wejściu widać 6 zwiniętych kart (przy aktualnych danych: Seniorki – Grupa 1; Juniorki – 1 Liga,
   2 Liga A, 2 Liga B; Juniorki Młodsze – Grupa 1 – I Liga; Młodziczki – Grupa 6), każda z miejscem
   naszych drużyn.
2. Klik w dowolne miejsce paska naszej drużyny rozwija jej mecze (z W/P, wynikami i setami); mecz
   z datą 2000-01-01 pokazuje „termin do ustalenia” na końcu najbliższych.
3. Po drugim wejściu w ciągu 10 minut nie ma nowych zapytań do API; przy wyłączonej sieci i starym
   cache widać dane z komunikatem.
4. Na telefonie 375 px: bez przewijania w bok, tło nie przesuwa się przy przewijaniu, tabele i
   listy meczów czytelne.
5. Motyw: na komputerze strona startuje ciemna nawet przy jasnym systemie; na telefonie z jasnym
   trybem startuje jasna; przełącznik zmienia motyw i wybór zostaje po odświeżeniu.
6. Każdy link menu (w tym ostatni, Młodziczki) ustawia sekcję tuż pod paskiem, na telefonie,
   tablecie i komputerze, ze zwiniętymi i rozwiniętymi kartami, bez widocznego dołu poprzedniej karty.
7. Cała strona działa z lokalnego serwera plików lub GitHub Pages bez budowania.
