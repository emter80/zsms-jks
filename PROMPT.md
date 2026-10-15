# Zadanie: strona z tabelami ligowymi i wynikami klubu siatkarskiego JKS SMS Jastrzębie

Zbuduj jednostronicową, statyczną stronę (HTML + CSS + trochę czystego JavaScript, bez frameworków i bez
kroku budowania), hostowaną na GitHub Pages. Strona pobiera dane na żywo z publicznego API systemu SZPS
i pokazuje tabele ligowe oraz wyniki meczów wszystkich drużyn klubu. Interfejs po polsku, ciemny motyw
w barwach klubowych (zieleń + złoto), działa dobrze na telefonie.

## 1. Pliki

- `index.html` (markup + cały JavaScript w tagach `<script>`)
- `style.css` (bazowy motyw, nagłówek, menu, typografia, hamburger na telefonie)
- `league.css` (tabele, karty zwijane, lista meczów, tło, nadpisania)
- `kleby.svg` (tło: miękki dym)
- `jks.svg` (kontur napisu JKS)

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
- Wiersze drużyn klubu mają podświetlone tło (szmaragd 16%), zielony pasek z lewej i złoty numer
  pozycji. Nazwa jest przyciskiem `<button>` (`aria-expanded`) ze strzałką. Klikalny jest
  **cały wiersz** (kursor pointer, rozjaśnienie przy hover, złote podkreślenie nazwy). Przycisk
  zostaje dla klawiatury i czytników ekranu, a klik w sam przycisk przełącza tylko raz.
- Klik rozwija pod wierszem dodatkowy wiersz z listą meczów tej drużyny w tej grupie.
- Dwie sekcje: **Wyniki** (najnowsze na górze) i **Najbliższe mecze** (rosnąco po dacie, bez terminu
  na końcu).
- Pozycja meczu: data `dd.mm.rrrr`, gospodarz i gość (nasza drużyna pogrubiona, rywale w kolorze
  tekstu), po prawej znacznik **W** lub **P** (wygrana/przegrana, nie polegaj tylko na kolorze)
  i wynik w setach, pod spodem małym drukiem punkty w setach. Lewy pasek zielony przy wygranej
  i czerwonawy przy przegranej. Dla nierozegranych brak wyniku.
- Na telefonie (≤560 px): data w osobnej linii, gospodarz nad gościem, wyniki setów w osobnej linii
  pod spodem, żeby nazwy miały pełną szerokość. Powyżej 560 px: „Gospodarz – Gość” w jednej linii.
- Mecze pobieraj leniwie dopiero przy pierwszym rozwinięciu i trzymaj w pamięci strony (jedno
  zapytanie na sesję).

### Menu i stopka
- Sticky pasek u góry: logo tekstowe `ZSMS   JKS` w kroju Monoton z gradientem złoto → szmaragd
  oraz linki do kategorii (generowane z danych). Pod linkami złote podkreślenie rośnie od lewej
  przy hover, a przed linkiem jest mała zielona kropka. Poniżej 820 px menu zwija się do
  hamburgera (przycisk z `aria-expanded`, zamyka się po wyborze linku i po Esc).
- Stopka: `Dane: system.szps.pl · pobrane <data i godzina>`.
- Brak osobnego nagłówka „Kategoria” nad kartami: nazwa kategorii jest częścią tytułu każdej tabeli.
- Przy braku danych/awarii bez kopii: komunikat „Nie udało się pobrać danych z API: …”.
- Podczas ładowania: „Ładowanie danych…”.

## 4. Cache i odporność

- `localStorage`, osobne klucze dla tabel i meczów, ważność **10 minut** (`CACHE_SECONDS = 600`).
- Gdy cache jest starszy, spróbuj pobrać dane. Jeśli się nie uda (offline, awaria API),
  pokaż **ostatnią zapisaną kopię** z żółto-złotym komunikatem „API chwilowo niedostępne. Pokazuję
  zapisane dane z …” nad kartami, w liście meczów i w stopce.
- Waliduj kształt danych (`tables` i `matches` mają być tablicami); uszkodzony cache ignoruj.
- `localStorage` może być zablokowany (tryb prywatny). Opakuj odczyt i zapis w `try/catch`, a bez
  cache pobieraj za każdym razem.

## 5. Wygląd

### Kolory
Tło `#0F1210`, panel/karta `#161B18` (karty z kryciem 90%), tekst `#ffffff`, tekst główny `#c9cbcf`,
przygaszony `#8b8f96`, linie `#222B25`, akcent szmaragd `#10B981`, złoto `#E6B75A`, mięta `#6EE7B7`.
Wygrana: szmaragd; przegrana: `#e0736a` (pasek) / `#f0a3a3` (tekst).

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
telefonach skacze przy chowaniu paska adresu), `translateZ(0)`, za całą treścią:
1. obraz `kleby.svg`: około 20 rozmytych obłoków dymu (szmaragd, mięta, kilka złotych) na ciemnym
   tle, rysowanych kołami z filtrami SVG (`feTurbulence` + `feDisplacementMap` + `feGaussianBlur`),
   `background-size: cover`;
2. `jks.svg`: napis **JKS** krojem Monoton, **sam obrys**, złoty, grubość 1 px
   (`vector-effect: non-scaling-stroke`), płasko (bez perspektywy), biegnący po przekątnej od lewego
   dolnego do prawego górnego rogu ekranu (obrót o `atan2(-100vh, 100vw)`, długość ≈ 74% przekątnej,
   zapas `-32deg` dla przeglądarek bez funkcji trygonometrycznych), krycie ≈ 35%.
   Kontury wygeneruj z pliku fontu Monoton jako ścieżki SVG.

### Detale
- Karty: lewy zielony pasek 3–4 px, `border-bottom` 1 px, odstęp między kartami 14 px.
- Przyciski i linki: wyraźny `:focus-visible` (kontur w kolorze akcentu).
- `prefers-reduced-motion`: wyłącz przejścia.

## 6. Dostępność i jakość

- Semantyczny HTML (`header`, `nav`, `main`, `section`, `footer`, `details/summary`, `table`).
- Kontrast tekstu ≥ 4,5:1, cele dotykowe nazw drużyn ≥ 44 px na urządzeniach dotykowych (ujemny
  margines, żeby wiersze nie rosły).
- Brak przewijania poziomego od 360 px szerokości.
- Brak zależności zewnętrznych poza fontami i API; pliki w katalogu głównym, względne ścieżki.
- Dodaj `meta description` obejmujący wszystkie kategorie (seniorki, juniorki, juniorki młodsze,
  młodziczki) oraz `theme-color: #0F1210`.

## 7. Kryteria akceptacji

1. Po wejściu widać 6 zwiniętych kart (przy aktualnych danych: Seniorki – Grupa 1; Juniorki – 1 Liga,
   2 Liga A, 2 Liga B; Juniorki Młodsze – Grupa 1 – I Liga; Młodziczki – Grupa 6), każda z miejscem
   naszych drużyn.
2. Klik w dowolne miejsce paska naszej drużyny rozwija jej mecze (z W/P, wynikami i setami); mecz
   z datą 2000-01-01 pokazuje „termin do ustalenia” na końcu najbliższych.
3. Po drugim wejściu w ciągu 10 minut nie ma nowych zapytań do API; przy wyłączonej sieci i starym
   cache widać dane z komunikatem.
4. Na telefonie 375 px: bez przewijania w bok, tło nie przesuwa się przy przewijaniu, tabele i
   listy meczów czytelne.
5. Cała strona działa z lokalnego serwera plików lub GitHub Pages bez budowania.
