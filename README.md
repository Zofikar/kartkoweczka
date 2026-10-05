# 📝 Kartkóweczka

> **Nowoczesna aplikacja webowa (SPA) do błyskawicznego generowania, drukowania i automatycznego sprawdzania testów jedno- oraz wielokrotnego wyboru.**

---

## 🎯 O aplikacji

**Kartkóweczka** to lekka, intuicyjna aplikacja stworzona z myślą o nauczycielach, wykładowcach i szkoleniowcach, którzy chcą zaoszczędzić czas na układaniu kartkówek i – co najważniejsze – na ich sprawdzaniu.

Aplikacja działa w architekturze **SPA (Single Page Application)**, co oznacza pełną responsywność, płynność działania oraz **wsparcie dla pracy offline** (jako Progressive Web App – PWA). Możesz ją zainstalować na komputerze lub tablecie i korzystać z niej nawet bez dostępu do internetu w szkolnej sali!

---

## ✨ Kluczowe funkcje

- **Tworzenie testów (Kreator zadań):**
  - Obsługa pytań **jednokrotnego wyboru** (radio) oraz **wielokrotnego wyboru** (checkbox).
  - Elastyczne zarządzanie punktacją dla każdego pytania z osobna lub globalnie.
  - Losowa kolejność pytań i odpowiedzi (opcjonalnie), aby zminimalizować ryzyko ściągania.
- **Automatyczne arkusze odpowiedzi:**
  - Generowanie unikalnych, czytelnych kart odpowiedzi dla uczniów z czytelnymi polami do zaznaczania.
- **Błyskawiczne sprawdzanie przez skanowanie:**
  - **Szybkie sprawdzanie za pomocą aparatu w telefonie** – wystarczy zeskanować kartę odpowiedzi ucznia, aby system błyskawicznie zweryfikował poprawność.
  - Opcja alternatywnego, szybkiego wprowadzania manualnego.
  - Natychmiastowe obliczanie wyników procentowych i wystawianie ocen według konfigurowalnej skali.
- **Tryb Offline (PWA):**
  - Aplikacja zapisuje dane lokalnie w przeglądarce (`IndexedDB` / `LocalStorage`).
  - Możliwość instalacji na pulpicie komputera lub ekranie głównym telefonu jako aplikacja natywna.
- **Eksport i Druk:**
  - Generowanie gotowych do druku testów i kluczy odpowiedzi w formacie PDF.

---

## 🚀 Szybki start (Dla użytkowników)

1. Wejdź na stronę aplikacji (lub uruchom lokalnie).
2. Kliknij ikonę **„Zainstaluj aplikację”** na pasku adresu przeglądarki (Chrome/Edge/Safari), aby korzystać z niej offline na telefonie lub komputerze.
3. Utwórz nowy test, wprowadzając pytania i poprawne odpowiedzi.
4. Wydrukuj testy oraz arkusze odpowiedzi dla uczniów.
5. Po zebraniu kart **zeskanuj je aparatem w telefonie**, aby błyskawicznie uzyskać statystyki i oceny!

---

## 💻 Instalacja i Uruchomienie (Dla deweloperów)

Jeśli chcesz uruchomić projekt lokalnie lub go rozwinąć:

```bash
# 1. Sklonuj repozytorium
git clone [https://github.com/twoja-nazwa/kartkoweczka.git](https://github.com/twoja-nazwa/kartkoweczka.git)

# 2. Przejdź do katalogu projektu
cd kartkoweczka

# 3. Zainstaluj zależności
yarn install

# 4. Uruchom serwer deweloperski
yarn run dev

# 5. Zbuduj wersję produkcyjną
yarn run build
```

### Aplikacja desktopowa (Tauri)

Wymagane są Rust oraz zależności systemowe Tauri dla wybranego systemu operacyjnego.

```bash
# Uruchom aplikację desktopową w trybie deweloperskim
yarn tauri:dev

# Zbuduj natywną aplikację i instalator
yarn tauri:build
```

Build Tauri automatycznie ustawia natywny backend bazy danych. SQLite działa po stronie Rust i
zapisuje plik `kartkoweczka.sqlite3` w katalogu danych aplikacji. Browserowy OPFS i SQLite WASM nie
są dołączane do bundla desktopowego.

### Wydania natywne i aktualizacje

### PWA na GitHub Pages

Workflow `pages.yml` publikuje wersję przeglądarkową po udanym workflow `Native release`.
Można go również uruchomić ręcznie dla gałęzi, tagu lub commita. Puste pole `ref`
używa gałęzi wybranej w formularzu workflow, bez ponownego budowania instalatorów.
W Settings → Pages ustaw Source na **GitHub Actions**. Workflow Pages musi znajdować się
na domyślnej gałęzi repozytorium. Środowisko `github-pages` musi zezwalać na wdrożenia
z wybranych tagów i gałęzi.

Build używa backendu przeglądarkowego, generuje service worker i manifest PWA oraz
ustawia ścieżkę bazową z konfiguracji Pages. Dodaje też `404.html` dla tras SPA.
Adres witryny jest widoczny w podsumowaniu deploymentu oraz Settings → Pages.

### Publikacja instalatorów

Workflow `release.yml` buduje wydania dla Windows x64 (NSIS), Linux x64 i ARM64 (AppImage i `.deb`)
oraz Android ARM64 (APK). Uruchamia się po wypchnięciu stabilnego tagu `vX.Y.Z` albo ręcznie
dla istniejącego tagu. Publikacja następuje dopiero po powodzeniu wszystkich buildów.

Linux jest budowany w kontenerach Debian 12 na runnerach Ubuntu 24.04, aby nie wymagać
nowszego glibc z hosta. Pakiety `.deb` są przeznaczone dla Debian 12 i Ubuntu 24.04.
Obie architektury wymagają testów instalacji na tych systemach przed deklaracją pełnego wsparcia.
Web oferuje AppImage oraz osobny link `.deb`; updater wybiera format zainstalowanej aplikacji.
Manifest zachowuje stare linki `downloads` i dodaje warianty w `packages`.

Przed pierwszym wydaniem skonfiguruj w GitHub Actions:

- zmienną (lub sekret) `TAURI_UPDATER_PUBLIC_KEY` w Settings → Secrets and variables → Actions
  (zmienna ma pierwszeństwo, jeśli istnieją oba wpisy);
- sekrety `TAURI_SIGNING_PRIVATE_KEY` i `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`;
- sekrety `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_PASSWORD` i `ANDROID_KEY_ALIAS`.

Klucze updatera wygeneruj lokalnie przez `yarn tauri signer generate -w <ścieżka-klucza>`.
Do zmiennej i sekretu wstaw pełną zawartość odpowiednich plików. Klucze prywatne i keystore
przechowuj poza repozytorium. Android wymaga tego samego klucza podpisującego w kolejnych wydaniach.

Generowany `version_mainfest.json` zawiera `downloads` z linkami oraz `platforms` z podpisanymi
artefaktami updatera Tauri. Pisownia `mainfest` jest celowa. Web pobiera kopię tego samego JSON
z opisu najnowszego wydania przez API GitHub, wykrywa platformę i pozwala ją ręcznie zmienić.
Brak odpowiedniego wydania pozostawia możliwość instalacji PWA. Plik w `public` jest początkowym
przykładem bez opublikowanych plików, a nie źródłem bieżących wydań.

Desktop udostępnia sprawdzanie aktualizacji i osobne potwierdzenie instalacji z restartem.
Android aktualizuje się przez ręczną instalację APK. Podpis updatera nie zastępuje podpisu
Windows Authenticode. Pełny pipeline wymaga sprawdzenia na runnerach GitHub oraz testu instalacji
i aktualizacji na urządzeniach docelowych.

### Raporty licencji (FOSSA)

Workflow `update-license.yml` uruchamiany ręcznie wymaga sekretu `FOSSA_API_KEY`
z uprawnieniami do analizy projektu i pobierania raportów. Analizuje zależności Yarn
oraz Rust z `src-tauri`, a następnie tworzy PR aktualizujący `LICENSES.md` i
`public/licenses.html`. Niepowodzenie analizy zatrzymuje generowanie raportów;
wyniki kontroli polityk FOSSA nie blokują pobierania informacji o licencjach.

Zależności kompilowane przez OMR są zadeklarowane w `fossa-deps.yml`. Przy zmianie
wersji OpenCV, OpenCV contrib, FreeType lub HarfBuzz w `openOmr/docker/Dockerfile`
zaktualizuj również wersje i adresy archiwów w tym pliku.
