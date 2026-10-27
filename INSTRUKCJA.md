# latajzgorylem.pl v9 – instrukcja wdrożenia

> **v6 – motyw „tropikalny zachód słońca”:** niebieskie tło z przejściem do żółci, kremowe karty zamiast białych, żółte przyciski,
> sekcja powitalna z zachodem słońca, morzem i palmami, pas z palmami nad stopką. Zmiana dotyczy tylko pliku `public/index.html` –
> podmień go w GitHubie (pozostałe pliki bez zmian względem v5). Strona jest teraz zawsze w jednym, kolorowym motywie
> (bez automatycznego trybu ciemnego).
> Po wdrożeniu odśwież stronę z Ctrl+Shift+R (Cmd+Shift+R).

> **Poprzednia wersja (v5):**

> **v5 – nowa szata graficzna z Twoim logo:** paleta z logo (granat, niebieski, słoneczny pomarańcz), logo i wordmark w nagłówku,
> nowa sekcja powitalna, ikona strony, czcionka Poppins (dołączona do paczki, bez Google Fonts), obrazy na Facebooka/Instagram
> i podgląd linków z logo, nazwa **latajzgorylem.pl** w całym serwisie.
> **Aktualizacja:** w GitHubie podmień cały folder `public` (nowe pliki: `logo.png`, `logo-mark.png`, `favicon-64.png`,
> `apple-touch-icon.png`, `og-default.png`, folder `fonts/`, nowy `index.html`) oraz `netlify/functions/seo.js`.
> Nazwa „TravelDeals” zapisana wcześniej w bazie jest automatycznie zastępowana nazwą latajzgorylem.pl.
> Miniaturki istniejących ofert odświeżą się w nowym stylu po ponownym zapisie oferty albo po kliknięciu „📣 Promuj”.
> Po wdrożeniu odśwież stronę z Ctrl+Shift+R (lub Cmd+Shift+R), żeby przeglądarka pobrała nowe pliki.

> **Poprzednie wersje (v4.3):**

> **v4.3:** roboty Facebooka/WhatsAppa/Messengera dostają lekką stronę z samym podglądem, a funkcja zapisuje w logu Netlify każde
> żądanie. Podmień `netlify/functions/seo.js` (reszta bez zmian). Co zrobić, gdy Debugger nadal pokazuje „bad HTTP response code” –
> patrz „Debugger Facebooka nadal pokazuje błąd”.

> **v4.2:** strona główna i `/linki` też mają podgląd na Facebooku (tytuł, opis, obrazek). Podmień `netlify/functions/seo.js` i `netlify.toml`.
> **W Sharing Debuggerze wklejaj adres STRONY oferty (`…/oferta/nazwa`), nigdy adres samego obrazka** – dla obrazka Facebook zawsze
> pokaże „This URL hasn't been shared on Facebook before”.

> **v4.1 (poprawka podglądu na Facebooku):** podmień w GitHubie `netlify/functions/seo.js` i `netlify.toml`. Funkcja ma teraz adres
> diagnostyczny – patrz „Podgląd na Facebooku nie działa – diagnoza w 2 minuty”.

> **Aktualizacja z v3 → v4:** podmień w GitHubie `public/index.html` i `netlify.toml`, dodaj folder `.autopost/` oraz plik
> `.github/workflows/facebook.yml` i podmień `scripts/facebook-autopost.js` (szczegóły: sekcja „Automatyczne wpisy na Facebooku”).
> Baza i funkcje Supabase bez zmian.
>
> **Co nowego w v4:** obrazy na Instagram (post 4:5 i Stories 9:16) do pobrania, strona „link w bio” (`/linki`),
> 5 wariantów opisu posta z hashtagami, znaczniki UTM i statystyka „skąd wchodzą odwiedzający”, automatyczne wpisy na Facebooku.

> **Aktualizacja z v2 → v3:** podmień w GitHubie pliki `public/index.html`, `netlify/functions/seo.js` (Netlify wdroży sam), a w Supabase → Edge Functions → `flights` wklej nowy `supabase/functions/flights/index.ts` i kliknij Deploy. Nic więcej (baza bez zmian).

Co nowego: szybkie dodawanie ofert, wklejanie zrzutu ekranu (Ctrl+V), duplikowanie, ceny lotów z Travelpayouts,
osobne adresy ofert z podglądem na Facebooku, zapis na powiadomienia, statystyki kliknięć oraz data dodania oferty
zamiast terminu ważności.

Plik `config.js` jest już uzupełniony Twoim adresem Supabase i kluczem publicznym.

## Struktura paczki
```
public/                  ← strona (index.html, config.js, logo*.png, favicon, og-default.png, fonts/)
netlify/functions/seo.js ← meta tagi dla każdej oferty, sitemap.xml, robots.txt
netlify.toml             ← ustawienia Netlify (adresy /oferta/..., publikowany folder)
supabase/setup.sql       ← konfiguracja bazy (uruchom ponownie – to bezpieczne)
supabase/functions/flights/index.ts ← funkcja z cenami lotów (Travelpayouts)
supabase/import-ofert.sql← opcjonalny import 4 dawnych ofert
scripts/facebook-autopost.js ← automatyczne wpisy na Facebooku
.github/workflows/facebook.yml ← uruchamia skrypt co godzinę (GitHub Actions)
.autopost/               ← lista już opublikowanych ofert (zapisuje się sama)
```

## Krok 1. Zaktualizuj bazę (2 minuty)
1. Supabase → **SQL Editor** → **New query**.
2. Wklej całą zawartość `supabase/setup.sql` → **Run**. Dodaje tabele zapisów i statystyk. Poprzednie dane zostają.
3. (opcjonalnie) wklej i uruchom `supabase/import-ofert.sql`, jeśli chcesz mieć 4 dawne oferty.

## Krok 2. Hosting z funkcjami – Netlify przez GitHub (ok. 10 minut, jednorazowo)
Osobne adresy ofert z podglądem na Facebooku wymagają małej funkcji serwerowej. Netlify obsługuje ją tylko wtedy,
gdy strona jest wdrażana z GitHuba (przeciąganie plików na Netlify Drop jej nie uruchamia).

1. Załóż darmowe konto na https://github.com i kliknij **New repository** (nazwa np. `traveldeals`, może być prywatne).
2. W repozytorium: **Add file → Upload files**. Przeciągnij **zawartość rozpakowanego folderu** (foldery `public`,
   `netlify`, `supabase`, `scripts` oraz pliki `netlify.toml` i `INSTRUKCJA.md`) → **Commit changes**.
3. Wejdź na https://app.netlify.com → **Add new project → Import an existing project → GitHub** i wybierz repozytorium.
   Ustawienia zostaw domyślne (Netlify odczyta `netlify.toml`) → **Deploy**.
4. Po minucie dostaniesz adres `https://nazwa.netlify.app`. Sprawdź: otwórz `adres/admin`, zaloguj się.
   Strona działa na głównym adresie (nie w podfolderze).
5. Od teraz każda zmiana plików w GitHubie wdraża się sama. Oferty zmieniasz w panelu – bez GitHuba.

## Krok 3. Ceny lotów z Travelpayouts (ok. 10 minut)
Wymaga konta Travelpayouts (darmowe) – tam znajdziesz **token API** (Profil → API token) oraz swój **marker**
(identyfikator partnera, widoczny w panelu partnera).

1. Supabase → **Edge Functions** → **Deploy a new function → Via Editor**. Nazwa: `flights`.
2. Wklej całą zawartość `supabase/functions/flights/index.ts` → **Deploy**.
3. W ustawieniach funkcji `flights` **wyłącz „Verify JWT”** (Details/Settings) i zapisz – funkcja sama sprawdza, czy jesteś zalogowany. Bez tego Supabase często zwraca 401.
4. Supabase → **Edge Functions → Secrets** → dodaj:
   - `TRAVELPAYOUTS_TOKEN` = Twój token API
   - `TRAVELPAYOUTS_MARKER` = Twój marker
   - (opcjonalnie) `TP_LINK_TEMPLATE` – gdy chcesz własny format linku, np.
     `https://tp.media/r?marker={marker}&trs=TWOJE_TRS&p=4114&u={url}` (wartości trs i p wygeneruje Ci Travelpayouts
     w narzędziu do tworzenia linków).
5. Test: panel `/admin` → „✈️ Znajdź tani lot” → kliknij **Sprawdź połączenie** (pokaże, co jest nie tak: sekret, token, logowanie). Potem wpisz miasta, miesiąc → **Szukaj lotów** → **Użyj**.
6. **Sprawdź pierwszy wygenerowany link** w panelu Travelpayouts (czy widać go jako Twój). Format linku
   Aviasales mogłem zweryfikować tylko w dokumentacji, nie na Twoim koncie – jeśli kliknięcia nie są liczone,
   użyj `TP_LINK_TEMPLATE` z linkiem wygenerowanym przez Travelpayouts.
   Dane o cenach pochodzą z pamięci podręcznej (do 48 h) – cena u partnera może się różnić.

## Krok 3b. Automatyczna zamiana zwykłego linku na Twój link Travelpayouts (opcjonalnie)
Wklejasz zwykły link do oferty (np. z Trip.com), a strona sama zamienia go na Twój link partnerski
(przez oficjalne API Travelpayouts „links/v1/create”). Zamiast ręcznej konwersji w panelu Travelpayouts.

1. W Travelpayouts: **Projekty** (Twoja strona) → zapisz **ID projektu** (to jest „trs”) i upewnij się, że projekt
   jest zapisany do programów, z których chcesz linki (np. Trip.com, Booking.com) – **Programy partnerskie → Dołącz**.
2. Supabase → **Edge Functions → Secrets** → dodaj `TRAVELPAYOUTS_TRS` = ID projektu (obok istniejących
   `TRAVELPAYOUTS_TOKEN` i `TRAVELPAYOUTS_MARKER`).
3. Wklej na nowo zawartość `supabase/functions/flights/index.ts` do funkcji `flights` → **Deploy**
   (to ta sama funkcja co w kroku 3 – dostała nową akcję „convert”).
4. W panelu: **Szybkie dodawanie** → wklej zwykły link → zaznacz **„Zamień na mój link Travelpayouts (automatycznie)”**
   (zamieni przy zapisie) albo kliknij **„Zamień teraz”** (zobaczysz wynik w polu przed zapisem).
   W pełnym formularzu i w wierszach propozycji jest przycisk **„🔗 Travelpayouts”** przy każdym linku.
5. Jeśli zobaczysz komunikat, że program nie jest włączony – dołącz do niego w Travelpayouts (krok 1).
   Linki, które już są linkami Travelpayouts (tp.media itp.), nie są zamieniane drugi raz.
6. Pierwszy link sprawdź w panelu Travelpayouts (Statystyki → kliknięcia) – czy widać go jako Twój. API nie obsługuje
   kilku marek (m.in. Kiwi.com, Expedia UK, Ticketmaster). Limit: 100 zapytań na minutę.

## Jak teraz dodajesz ofertę
**Szybko:** `/admin` → karta „Szybkie dodawanie”: rodzaj, kierunek, link afiliacyjny, cena (+ zrzut ekranu:
kliknij ramkę i wciśnij **Ctrl+V**). Tytuł, opis, kategoria i partner uzupełniają się same.
**Loty:** „Znajdź tani lot” uzupełnia kierunek, cenę i link jednym kliknięciem.
**Podobna oferta:** „Duplikuj” przy ofercie, zmień cenę i zapisz.
**Zmiana ceny:** edytuj ofertę i zaznacz „Zaktualizuj datę dodania”.

## Data dodania zamiast terminu
Karty, strona oferty i wpisy w social media pokazują, kiedy oferta została dodana, oraz że cena obowiązywała
w tym dniu. Pole „ważna do” zostało usunięte.

## Podgląd na Facebooku
**Miniaturka powstaje automatycznie:** przy każdym zapisie oferty panel rysuje obrazek 1200×630 (zdjęcie lub grafika
kierunku + tytuł + cena + data) i wgrywa go do Supabase. Klik „📣 Promuj” pokazuje podgląd miniaturki z krótkim opisem
i sprawdza, czy adres oferty faktycznie zwraca podgląd dla Facebooka.
**Zrzuty ekranu:** w pełnym formularzu każda propozycja (lot/nocleg/auto) ma pole „Ctrl+V” – kliknij w nie i wklej zrzut;
kliknięcie zrzutu na stronie prowadzi na link tej propozycji.
Link `adres/oferta/nazwa` ma tytuł, cenę, opis i zdjęcie. Zdjęcie bierze się z zdjęcia oferty albo ze zrzutu ekranu;
gdy ich nie ma, pokazuje się obrazek `og-default.png`. Facebook zapamiętuje podgląd – po zmianach odśwież go
w narzędziu https://developers.facebook.com/tools/debug/ (przycisk „Scrape Again”).
Wygenerowane są też `/sitemap.xml` i `/robots.txt` (zgłoś sitemapę w Google Search Console).

## Zapis na powiadomienia
Formularz jest na stronie głównej i pod każdą ofertą (zgoda + link do polityki prywatności `/prywatnosc`).
W panelu admina: lista, liczba zapisanych, pobranie CSV, kopiowanie adresów i gotowy tekst newslettera z ofert
z ostatnich 7 dni. Do wysyłki użyj darmowego narzędzia (MailerLite, Brevo) – zaimportuj tam CSV.
Uzupełnij „E-mail kontaktowy” w ustawieniach panelu. Tekst polityki prywatności to szablon – dostosuj go do swojej
działalności (nie jest poradą prawną).

## Statystyki
W panelu: wyświetlenia stron ofert i kliknięcia w linki partnerów (30 dni), klikalność oraz ranking. Liczby są
anonimowe (bez cookies). Twoje wizyty po zalogowaniu nie są liczone. Boty mogą nieco zawyżać wyświetlenia.

## Instagram, Stories i „link w bio”
Przy każdej ofercie kliknij **📣 Promuj**:
- **Wariant opisu** – wybierz jeden z 5 gotowych tekstów (klasyczny, krótki, pytanie, pilność, Instagram) i kliknij „Kopiuj opis”.
- **Obrazy Instagram** – dostajesz gotowy obraz posta 1080×1350 i Stories 1080×1920 (przycisk **Pobierz**; na telefonie także
  „Udostępnij z telefonu”, który otwiera arkusz udostępniania z obrazem i opisem).
- Instagram nie pozwala klikać linków w opisie posta. Dlatego wpisz **raz** w profilu Instagrama jako „link w bio” adres
  `https://TWOJA-STRONA/linki` – to lista najnowszych ofert, każda kliknięta oferta liczy się jako wejście z Instagrama.
  W Stories użyj naklejki „Link” z adresem podanym w panelu (przycisk „Kopiuj link do Stories”).
- Linki z panelu mają znaczniki UTM (`utm_source=facebook` / `instagram`). W panelu głównym zobaczysz kartę
  „Skąd wchodzą odwiedzający (30 dni)”.

## Automatyczne wpisy na Facebooku (GitHub Actions, darmowe)
Co godzinę GitHub sprawdza, czy w bazie jest nowa oferta, i publikuje ją na Twojej stronie na Facebooku z linkiem do tej
oferty na Twojej stronie (Facebook sam pokaże miniaturkę i opis). Każda oferta jest publikowana tylko raz.
**Bezpieczniki:** przy pierwszym uruchomieniu istniejące oferty są tylko oznaczane jako „już było” (nic się nie publikuje);
na jedno uruchomienie max 3 wpisy; oferty starsze niż 7 dni są pomijane.

**1. Pliki w GitHubie.** Folder `.github/workflows/facebook.yml` jest ukryty (zaczyna się od kropki) – przeciąganie folderów
może go pominąć. Najpewniej: w repozytorium kliknij **Add file → Create new file**, w nazwie wpisz
`.github/workflows/facebook.yml`, wklej zawartość pliku z paczki i **Commit**. Podobnie pliki `scripts/facebook-autopost.js`
oraz `.autopost/README.txt` (możesz je też wgrać przyciskiem Upload files).

**2. Token strony Facebook** (jednorazowo, ok. 15 min; musisz być administratorem strony):
1. https://developers.facebook.com → **My Apps → Create App** → typ „Business” (lub „Other”).
2. W aplikacji: **Tools → Graph API Explorer**. Wybierz swoją aplikację, w „User or Page” → **Get User Access Token** i zaznacz
   uprawnienia: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`. Zatwierdź.
3. Kliknij **Generate Access Token** → skopiuj token.
4. Zamień go na długoterminowy: w narzędziu https://developers.facebook.com/tools/debug/accesstoken/ wklej token →
   **Extend Access Token** → skopiuj nowy token.
5. W Graph API Explorer wstaw ten długi token i wykonaj zapytanie `GET me/accounts`. W odpowiedzi znajdź swoją stronę:
   `id` = **FB_PAGE_ID**, `access_token` = **FB_PAGE_TOKEN** (token strony uzyskany z długiego tokena nie wygasa).
Aplikacja może zostać w trybie deweloperskim – wystarczy to do publikowania na własnej stronie, jeśli jesteś jej administratorem.

**3. Sekrety w GitHubie:** repozytorium → **Settings → Secrets and variables → Actions → New repository secret**. Dodaj 5:
`SUPABASE_URL`, `SUPABASE_ANON_KEY` (te z `config.js`), `SITE_URL` (adres Twojej strony bez końcowego ukośnika,
np. `https://twoja-strona.netlify.app`), `FB_PAGE_ID`, `FB_PAGE_TOKEN`.

**4. Pierwsze uruchomienie:** zakładka **Actions → Auto-post na Facebooku → Run workflow**. W logu zobaczysz
„Pierwsze uruchomienie: oznaczono … ofert jako już opublikowane”. Potem dodaj w panelu nową ofertę, poczekaj do pełnej godziny
(albo znów kliknij Run workflow) – wpis pojawi się na stronie. W logu błąd z kodem `190` = zły/wygasły token,
`200` = brak uprawnień `pages_manage_posts`.
**Chcesz, żeby stare oferty też poszły na Facebooka?** Dodaj do workflow w sekcji `env:` linię `POST_EXISTING: "1"`
na jedno uruchomienie (potem ją usuń).
**Nie chcesz publikować jakiejś oferty?** Wstrzymaj automat (Actions → ⋯ → Disable workflow) albo dodaj do danych oferty
pole `noAutoPost` (na razie ręcznie w bazie).
Netlify nie wdraża strony ponownie po zapisie listy `.autopost` (ustawione w `netlify.toml`).

## Podgląd na Facebooku nie działa – diagnoza w 2 minuty
Komunikat „URL returned a bad HTTP response code” lub klik z Facebooka prowadzący na stronę główną oznacza prawie zawsze, że
adres `/oferta/nazwa` nie jest obsługiwany przez funkcję `seo`. Sprawdź:

1. Otwórz w przeglądarce: `https://TWOJA-STRONA/.netlify/functions/seo?ping=1`
   - **Widzisz tekst `"funkcja": "seo działa"` i `"baza": "ok…"`** → funkcja działa; przejdź do punktu 2. Przy `"ok": false`
     przeczytaj, który wiersz ma „BŁĄD”.
   - **Strona „Page not found” (404)** → funkcja nie jest wdrożona. Strona musi być wdrożona z GitHuba (Netlify → Add new site →
     Import an existing project → GitHub), a plik `netlify.toml` musi leżeć w **głównym** katalogu repozytorium (obok folderu
     `public`, nie w podfolderze). Wgranie ZIP-a/folderu przez „Deploys → drag and drop” nie uruchamia funkcji.
     Po poprawce w Netlify: **Deploys → Trigger deploy → Clear cache and deploy site**, a w zakładce **Functions** powinna być `seo`.
2. Otwórz adres jednej oferty (`przykladowyAdres` z kroku 1 podaje gotowy). Kliknij prawym przyciskiem → „Wyświetl źródło strony”
   → Ctrl+F → `og:image`. Powinna być dokładnie jedna linia z adresem obrazka (https://…supabase.co/storage/…).
3. Skopiuj adres obrazka i otwórz w nowej karcie – ma się wyświetlić obrazek. Jeśli nie: Supabase → Storage → `offer-images`
   musi być bucketem publicznym (`setup.sql` go tworzy).
4. Dopiero teraz: https://developers.facebook.com/tools/debug/ → wklej adres oferty → **Debug** → **Scrape Again** (2–3 razy).
   Jeśli komunikat „bad HTTP response code” zostaje mimo punktów 1–3, napisz mi dokładny tekst ze szczegółów (sekcja
   „Response Code” i „Fetched URL / Canonical URL”).
5. Oferta musi mieć miniaturkę: otwórz ją w panelu i zapisz ponownie lub kliknij „📣 Promuj”.

## Debugger Facebooka nadal pokazuje błąd
1. Po wdrożeniu v4.3 (Netlify → Deploys → status „Published”) wejdź w Debugger, wklej adres oferty i kliknij **Debug**, a potem
   **Scrape Again**.
2. Od razu wejdź w Netlify → **Logs → Functions → seo** (ustaw „Real-time”). Zobaczysz linie w stylu:
   `[seo] GET https://…/oferta/nazwa -> 200 | bot=true | ua=facebookexternalhit/1.1 …`
   - **Jest linia z `bot=true` i `-> 200`:** strona odpowiada Facebookowi poprawnie. Wtedy po stronie Facebooka jest blokada lub
     pamięć podręczna – patrz punkt 3.
   - **Linia z `-> 4xx/5xx`:** przepisz mi ją w całości.
   - **Brak jakiejkolwiek linii z `bot=true`:** żądanie Facebooka w ogóle nie dochodzi do funkcji, tylko jest odrzucane wcześniej
     (np. blokada domeny `*.netlify.app` przez Facebooka). Przejdź do punktu 3.
3. **Własna domena.** Facebook czasem odrzuca darmowe subdomeny (`*.netlify.app`) jako „bad HTTP response code” lub pokazuje samą
   domenę bez podglądu. Najpewniejsze rozwiązanie: własna domena (ok. 40–60 zł/rok, np. w OVH, home.pl, Cloudflare). W Netlify:
   **Domain management → Add a domain**, potem dopisz rekordy DNS, które Netlify pokaże. Po zmianie domeny zaktualizuj sekret
   `SITE_URL`, link w bio na Instagramie i używaj nowego adresu w Debuggerze.
4. Test bez Facebooka: otwórz `https://TWOJA-STRONA/oferta/NAZWA?bot=1` – zobaczysz dokładnie tę lekką stronę, którą dostaje robot
   (tytuł, opis, obrazek).

## Gdy coś nie działa
- „Nie udało się wczytać ofert” → uruchom ponownie `setup.sql`.
- Brak podglądu na Facebooku → strona musi być wdrożona przez GitHub (Krok 2) i oferta musi być zapisana w bazie.
- „Funkcja lotów nie jest wdrożona” → Krok 3.
- „401/403 w funkcji lotów” → wyloguj się i zaloguj ponownie; w ustawieniach funkcji spróbuj wyłączyć „Verify JWT”.


## Nowości v7 (wygląd i nazwa)
- Nazwa serwisu: **latajzgorylem.pl** (nagłówek, stopka, podglądy linków, obrazy na Facebook/Instagram). Stara nazwa zapisana w bazie jest ignorowana.
- Nowe logo i baner: `public/logo.png`, `public/logo-mark.png`, `public/banner.jpg`, `public/og-default.png`, ikony `favicon-64.png` i `apple-touch-icon.png`. Aby zmienić baner, podmień plik `public/banner.jpg` (najlepiej ok. 1800×670 px).
- Układ strony głównej: baner → wyszukiwarka i kategorie (Wszystkie, Loty, Noclegi…) → oferta dnia → lista ofert. Kafelek z liczbą ofert usunięto.
- Oferta dnia ma żółto-pomarańczowe tło promocyjne i pojawia się tylko, gdy zaznaczysz „oferta dnia” przy ofercie.
- Uwaga: sama nazwa w serwisie to napis; adres strony (domena) zmieniasz osobno w Netlify (Domain management).

## Nowości v8 (wyszukiwarka lotów, sortowanie, przypięty pasek)

- **Wyszukiwanie lotów z konkretnymi datami.** Wyszukiwarka lotów jest teraz w szybkim dodawaniu oraz w „Pełnym formularzu”. W polu „Termin” wybierz „Najtańszy w wybranym miesiącu” albo „Konkretne daty wylotu i powrotu”. Przy konkretnych datach możesz dodać elastyczność (± 1–3 dni, z tym samym czasem pobytu). Po kliknięciu „Użyj” uzupełnia się cena, link partnerski, kierunek **oraz terminy wyjazdu** (a więc i linijka „🗓 Termin wyjazdu”). Funkcja `flights` w Supabase się **nie zmieniła** — nic nie trzeba wdrażać ponownie.
- **Uwaga:** Travelpayouts pokazuje ceny, które ostatnio znaleźli użytkownicy. Dla dokładnej daty bywa ich brak — wtedy użyj elastyczności ± 2 dni albo trybu miesiąca.
- **Najnowsze oferty na górze.** Domyślne sortowanie: oferta dnia, potem od najnowszej. Oferta zaplanowana do publikacji liczy się od momentu publikacji (nie od chwili utworzenia szkicu), więc po opublikowaniu ląduje na samej górze.
- **Przypięty pasek.** Górny pasek z logo oraz wyszukiwarka, sortowanie i kategorie zostają na wierzchu podczas przewijania — także na telefonie (kategorie przesuwasz palcem w bok).

## Nowości v9 (dodatkowe terminy lotów)

- **Dostępne terminy przy ofercie.** W „Pełnym formularzu” jest pole „Dodatkowe dostępne terminy lotów”: data wylotu, data powrotu, cena i (opcjonalnie) własny link. Puste pole linku oznacza główny link oferty. W szybkim dodawaniu to samo jest pod datami wyjazdu.
- **Z wyszukiwarki lotów jednym kliknięciem.** Przy każdym wyniku jest przycisk „+ Termin”, a pod listą „+ Dodaj wszystkie jako terminy”. Termin z wyszukiwarki zachowuje własną cenę i własny link partnerski. Przycisk „Użyj” nadal ustawia główny termin oferty.
- **Co widzi odwiedzający.** Na stronie oferty sekcja „📅 Dostępne terminy” (z głównym terminem, z oznaczeniem „najtaniej” i przyciskiem „Sprawdź termin”), a na kafelku informacja „N terminów do wyboru”. Minione terminy znikają same. Terminy trafiają też do opisu podglądu na Facebooku.
- Funkcja `flights` w Supabase się nie zmieniła. Wdrażasz tylko pliki strony (przez GitHub, jak dotychczas).
