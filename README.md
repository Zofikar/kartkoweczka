<a id="english"></a>

# 📝 Kartkóweczka

**English** | [Polski — przejdź do polskiej wersji](#polski)

**Less time preparing and checking tests. More time teaching.**

Kartkóweczka helps teachers, lecturers and trainers create tests, print student answer
sheets and check them using a camera or a photo. It is designed to work **offline-first**,
keep your work **private** and leave you in control of your data.

## Why Kartkóweczka?

- **Work without a constant internet connection.** Once installed and ready, you can
  prepare, print and check tests offline.
- **Your work stays on your device.** Questions, tests and saved test versions are stored
  locally, not remotely in an application cloud database.
- **No account required.** There is no login and no automatic cloud synchronization.
- **Share only when you choose.** Export a test to a file or deliberately send it to
  another device through direct transfer.

Internet access is needed to download/install the app, check for updates and establish
optional direct-transfer connections. Offline-first does not mean the app never connects
to the internet; it means your everyday test workflow does not depend on a cloud service.

## What can you do?

- Build a reusable **question bank** with tags and filtering.
- Create **single-choice and true/false questions**, including images and mathematical formulas.
- Organize questions into tests and save **different versions**, with optional shuffled
  question and answer order.
- Preview and **print A4 tests and answer sheets**, or save them as PDF through your
  device's print dialog where supported.
- **Scan answer sheets** with a camera or an uploaded photo and see the number of correct
  answers and the percentage score.
- **Export and import tests**, including their saved versions, to move them between devices.
- Use the app in **English or Polish**.

## Install the app

Choose one of two separate ways to use Kartkóweczka. For safer long-term storage, we
recommend keeping at least one native installation with copies of all your tests.

### Option 1: Web app (PWA)

1. Open **[Kartkóweczka in your browser](https://zofikar.github.io/kartkoweczka)**.
2. Follow the installation instructions shown on the page. Depending on your browser,
   choose **Install app** or **Add to Home Screen**.
3. Open the installed app from your home screen or desktop.

This version is installed **by your browser**, without downloading a native installer.
Its data is kept locally in that browser's storage. Allow the initial installation to
finish while online before relying on it offline.

### Option 2: Native app

Download an installer using the links on the
**[application website](https://zofikar.github.io/kartkoweczka)** or directly from
**[GitHub Releases](https://github.com/Zofikar/kartkoweczka/releases)**.

Choose a download matching your device, install it and launch it like any other application.
Availability depends on the files included in the release. This is a **separate installation**
from the web app and keeps its own local data; your browser's tests do not automatically
appear in it. Use export/import to move your work between installations.

## Your first test

1. Add questions and mark the correct answers.
2. Create a test using questions from your bank.
3. Save a test version and print its test and answer sheets.
4. Have students fill in the answer sheets.
5. Open the scanner and use your camera or select a photo to check a sheet.

**Scanning on a different device?** Import the test and its saved versions there first.
The code printed on a sheet identifies its version; it does not contain the answer key.
Avoid editing a version after printing it if you will use it to check those sheets.
Camera scanning requires camera permission.

## Keep a backup of your work

**Do not keep your only copy of important tests in the PWA.** Browser actions such as
clearing site data can delete them. A browser can also refuse a persistent-storage request;
without that protection, it may automatically remove stored data under its storage policies.
Installing the PWA does not guarantee permanent storage.

**Keep at least one device with the native app and transfer all your tests there, or
frequently export every test to files kept somewhere safe.** Native storage is outside
the browser's cleanup policies, but uninstalling the app, losing the device or disk failure
can still lose data — keep exported copies too.

Exports currently work **one test at a time**. There is no single-file full backup, so
backing up all your work means exporting each test separately. File export/import works
without internet; optional direct transfer needs a network connection to connect devices.

## Current scope

### Known shortcomings being worked on

- **Camera handling varies by device and can be unreliable.** Your phone's own camera app
  may produce better results. If live scanning struggles, take a clear photo with **all
  sheet markers visible**, then upload it from your gallery instead.
- **Transfer is test-wide and limited to one test at a time.** Import/export does not
  handle conflicts: the incoming copy is treated as authoritative, rather than asking
  which changes to keep. Export your local copy before importing a potentially conflicting test.
- **There is no full backup to a single file yet.** You must export tests individually;
  do not assume one test export includes your entire question bank or all other tests.

### Other limitations

The scanner reports correct-answer counts and percentages. Multiple-choice questions
with several selected answers, custom grade scales, weighted scoring and manual answer
entry are not currently supported. Print-to-PDF availability depends on your device.

For the detailed feature checklist, see [FEATURE_LIST.md](FEATURE_LIST.md).
For architecture, developer setup, testing and releases, see
[DEVELOPMENT.md](DEVELOPMENT.md).

---

## Polski

[English — back to top](#english)

**Mniej czasu na układanie i sprawdzanie testów. Więcej czasu na nauczanie.**

Kartkóweczka pomaga nauczycielom, wykładowcom i szkoleniowcom tworzyć testy, drukować
karty odpowiedzi i sprawdzać je aparatem lub ze zdjęcia. Powstała z myślą o **pracy offline**,
**prywatności** i zachowaniu kontroli nad własnymi danymi.

### Dlaczego Kartkóweczka?

- **Pracuj bez stałego dostępu do internetu.** Po instalacji i przygotowaniu aplikacji
  możesz tworzyć, drukować i sprawdzać testy offline.
- **Twoja praca zostaje na Twoim urządzeniu.** Pytania, testy i zapisane wersje są
  przechowywane lokalnie, a nie zdalnie w chmurowej bazie aplikacji.
- **Bez konta.** Nie ma logowania ani automatycznej synchronizacji z chmurą.
- **Udostępniaj tylko wtedy, gdy chcesz.** Wyeksportuj test do pliku albo świadomie
  prześlij go bezpośrednio na inne urządzenie.

Internet jest potrzebny do pobrania i instalacji aplikacji, sprawdzania aktualizacji oraz
zestawiania opcjonalnych połączeń do bezpośredniego przesyłania. Offline-first nie oznacza
braku jakichkolwiek połączeń z internetem — oznacza, że codzienna praca z testami nie
zależy od usługi chmurowej.

### Co możesz zrobić?

- Tworzyć **bank pytań** z tagami i filtrowaniem.
- Dodawać pytania **jednokrotnego wyboru i prawda/fałsz**, także z obrazami i wzorami matematycznymi.
- Układać testy i zapisywać **różne wersje**, opcjonalnie losując kolejność pytań i odpowiedzi.
- Przeglądać i **drukować testy oraz karty odpowiedzi A4**, a także zapisywać je jako PDF
  przez okno drukowania, jeśli urządzenie to umożliwia.
- **Skanować karty odpowiedzi** aparatem lub ze zdjęcia i odczytywać liczbę poprawnych
  odpowiedzi oraz wynik procentowy.
- **Eksportować i importować testy** wraz z wersjami, aby przenosić je między urządzeniami.
- Korzystać z aplikacji **po polsku lub angielsku**.

### Instalacja

Wybierz jeden z dwóch osobnych sposobów korzystania z Kartkóweczki. Dla bezpieczniejszego
przechowywania zalecamy co najmniej jedną instalację natywną z kopiami wszystkich testów.

#### Opcja 1: Aplikacja webowa (PWA)

1. Otwórz **[Kartkóweczkę w przeglądarce](https://zofikar.github.io/kartkoweczka)**.
2. Postępuj zgodnie z instrukcją instalacji na stronie. Zależnie od przeglądarki wybierz
   **Zainstaluj aplikację** lub **Dodaj do ekranu początkowego**.
3. Uruchamiaj zainstalowaną aplikację z ekranu głównego lub pulpitu.

Tę wersję instaluje **przeglądarka**, bez pobierania natywnego instalatora. Dane zostają
lokalnie w pamięci tej przeglądarki. Przed rozpoczęciem pracy offline poczekaj na zakończenie
pierwszej instalacji przy aktywnym połączeniu z internetem.

#### Opcja 2: Aplikacja natywna

Pobierz instalator przez linki na **[stronie aplikacji](https://zofikar.github.io/kartkoweczka)**
lub bezpośrednio z **[GitHub Releases](https://github.com/Zofikar/kartkoweczka/releases)**.

Wybierz plik odpowiedni dla urządzenia, zainstaluj go i uruchamiaj jak zwykły program.
Dostępność zależy od plików dołączonych do wydania. To **osobna instalacja** względem
wersji webowej, z własnymi lokalnymi danymi. Testy z przeglądarki nie pojawią się w niej
automatycznie — przenieś je przez eksport/import.

### Twój pierwszy test

1. Dodaj pytania i wskaż poprawne odpowiedzi.
2. Utwórz test z pytań ze swojego banku.
3. Zapisz wersję testu i wydrukuj test oraz karty odpowiedzi.
4. Poproś uczniów o wypełnienie kart.
5. Otwórz skaner i użyj aparatu lub wybierz zdjęcie, aby sprawdzić kartę.

**Skanujesz na innym urządzeniu?** Najpierw zaimportuj tam test wraz z zapisanymi wersjami.
Kod na karcie identyfikuje wersję, ale nie zawiera klucza odpowiedzi. Nie zmieniaj wydrukowanej
wersji, jeśli zamierzasz używać jej do sprawdzania tych kart. Skanowanie aparatem wymaga
zgody na dostęp do kamery.

### Zadbaj o kopię swojej pracy

**Nie przechowuj jedynej kopii ważnych testów w PWA.** Usunięcie danych witryny przez
przeglądarkę może je skasować. Przeglądarka może też odmówić przyznania trwałego miejsca
na dane; bez tej ochrony może automatycznie usuwać zapisane dane zgodnie ze swoimi zasadami.
Sama instalacja PWA nie gwarantuje trwałości zapisu.

**Zachowaj co najmniej jedno urządzenie z aplikacją natywną i przenoś na nie wszystkie
testy albo często eksportuj każdy test do plików przechowywanych w bezpiecznym miejscu.**
Zapis natywny nie podlega czyszczeniu przez przeglądarkę, ale odinstalowanie aplikacji,
utrata urządzenia lub awaria dysku nadal mogą oznaczać utratę danych — zachowuj też eksporty.

Eksport działa obecnie **dla jednego testu naraz**. Nie ma pełnej kopii zapasowej w jednym
pliku, więc zabezpieczenie całej pracy wymaga osobnego eksportu każdego testu.
Eksport/import plikowy działa bez internetu; przesyłanie bezpośrednie wymaga sieci
do połączenia urządzeń.

### Obecny zakres

#### Znane niedoskonałości, nad którymi pracujemy

- **Obsługa aparatu zależy od urządzenia i bywa zawodna.** Systemowa aplikacja aparatu
  może dawać lepsze wyniki. Jeśli skanowanie na żywo sprawia problemy, zrób wyraźne zdjęcie
  z **wszystkimi znacznikami arkusza w kadrze**, a następnie wczytaj je z galerii.
- **Przesyłanie obejmuje cały test i działa dla jednego testu naraz.** Import/eksport nie
  rozwiązuje konfliktów: przychodząca kopia jest uznawana za nadrzędną, bez pytania o to,
  które zmiany zachować. Przed importem potencjalnie konfliktowego testu wyeksportuj lokalną kopię.
- **Nie ma jeszcze pełnej kopii zapasowej w jednym pliku.** Testy trzeba eksportować
  osobno; eksport jednego testu nie oznacza kopii całego banku pytań ani pozostałych testów.

#### Pozostałe ograniczenia

Skaner pokazuje liczbę poprawnych odpowiedzi i wynik procentowy. Pytania wielokrotnego wyboru
z kilkoma zaznaczeniami, własne skale ocen, punktacja ważona i ręczne wprowadzanie odpowiedzi
nie są obecnie obsługiwane. Zapis do PDF zależy od możliwości urządzenia.

Szczegółową listę funkcji znajdziesz w [FEATURE_LIST.md](FEATURE_LIST.md).
Architekturę, konfigurację deweloperską, testy i wydania opisuje
[DEVELOPMENT.md](DEVELOPMENT.md) (po angielsku).
