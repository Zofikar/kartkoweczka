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
