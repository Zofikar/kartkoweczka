# MVP 1.0 Features

- [ ] Polish(lang) UI
- [ ] Desktop & Mobile UI from a single code
- [ ] Ability to create a new test
- [ ] Ability to add a question to a test with at least a single correct answer
- [ ] Ability to save a test presistantly on device
- [ ] Ability to export test to printable format
- [x] Ability to generate answers sheet in printable format
- [ ] Ability to automatically detect what a test is sheeted for (possibly add QR code to an answer sheet that holds test ID)
- [ ] Ability to generate multiple test revisions (randomized questions and answers order, must be also saved or deterministic e.g., random seed used to generate revision and stable pRNG) and automatically detect revision on answers sheet (revision QR is printed; scanning still pending)
- [ ] Ability to transfer test to another device offline (another use case for QR code most likely)
- [ ] Ability to automatically scan an answers sheet and calculate the score(sheet would need to be deterministic where we can use come kind of computer vision or grayscale averaging to determine selected answers)
