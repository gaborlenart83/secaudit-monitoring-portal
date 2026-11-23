# Funkcionális Specifikáció – SecAudit Monitoring Portál

| Dokumentum tulajdonság | Érték |
| :--- | :--- |
| **Verzió** | 1.0.0 |
| **Készítette (Draft)** | AI-Planner (Gemini) |
| **Lektorálta és Jóváhagyta** | Lénárt Gábor – Vezető Fejlesztő (Lead-Dev & QA) |
| **Státusz** | Elfogadva / Aláírva |

---

## 1. Használati Esetek (Use-Case Áttekintés)

### Szereplők és fő folyamatok:
1. **Vendég (Nem hitelesített):** Regisztráció, Bejelentkezés.
2. **Felhasználó (`USER`):**
   * **UC-01:** Új weboldal hozzáadása monitorozásra.
   * **UC-02:** Azonnali biztonsági és uptime ellenőrzés (Scan) futtatása.
   * **UC-03:** Korábbi ellenőrzések (Scan History) és részletes fejléc-elemzés megtekintése.
   * **UC-04:** Generált incidensek áttekintése és „Megoldva” (`isResolved`) státuszra állítása.
3. **Adminisztrátor (`ADMIN`):**
   * **UC-05:** Rendszerstatisztikák lekérése és felhasználói targetek moderálása.

---

## 2. Részletes Use-Case Leírások

### UC-02: Azonnali biztonsági és uptime ellenőrzés (Scan) futtatása
* **Előfeltétel:** A felhasználó be van jelentkezve, és rendelkezik legalább egy rögzített weboldallal.
* **Indító esemény:** A felhasználó a Dashboardon rákattint az adott weboldal kártyáján a „Vizsgálat indítása (Scan Now)” gombra.
* **Fő sikeres folyamat:**
  1. A frontend `POST /api/sites/:id/scan` kérést küld a backendnek a JWT tokennel.
  2. A backend ellenőrzi, hogy az URL érvényes-e és nem belső hálózati címre mutat.
  3. A backend HTTP `GET` kérést indít (5000 ms timeout mellett) és méri a válaszidőt.
  4. A backend kiolvassa a HTTP státuszkódot és a válaszfejléceket (`strict-transport-security`, `content-security-policy`, `x-frame-options`).
  5. A `securityScorer` modul kiszámítja a 0–100 közötti pontszámot és az `A–F` osztályzatot.
  6. Az eredmény bekerül a `SecurityScan` táblába.
  7. Ha a státuszkód 400 feletti, vagy az osztályzat `F`, a rendszer automatikusan létrehoz egy új rekordot az `IncidentLog` táblában.
  8. A frontend frissíti a kártyát az új érdemjeggyel (színes jelvénnyel) és válaszidővel.
* **Kivételes folyamat (Nem elérhető oldal / Timeout):**
  * Ha a céloldal nem válaszol 5 másodpercen belül, a `statusCode = 0`, a `score = 0`, a `grade = 'F'` értéket kapja, és egy `CRITICAL` szintű incidens jön létre („A céloldal nem elérhető vagy időtúllépés történt”).

---

## 3. Képernyőtervek és UI Felépítés
1. **Navigációs sáv (`Navbar.jsx`):** Projekt logó, linkek (Dashboard, Incidensek, Admin pult szerepkörtől függően), bejelentkezett felhasználó neve és Kijelentkezés gomb.
2. **Bejelentkező / Regisztrációs oldal (`AuthPage.jsx`):** Kétfülű vagy váltható Bootstrap űrlap kliensoldali validációval.
3. **Fő Műszerfal (`DashboardPage.jsx`):**
   * Felső sáv: „Új weboldal hozzáadása” űrlap (Név és URL mező).
   * Kártyás lista: Minden monitorozott oldal saját kártyát kap, rajta a legutóbbi **A–F jelvénnyel** (A=zöld, B=kék, C=sárga, D=narancs, F=piros), a válaszidővel (ms) és a „Scan Now” / „Részletek” / „Törlés” gombokkal.
4. **Részletes Elemző Oldal (`SiteDetailsPage.jsx`):**
   * Táblázat a legutóbbi ellenőrzésekről (időbélyeg, státuszkód, válaszidő, HSTS/CSP/X-Frame pipa vagy X, érdemjegy).
   * Az adott oldalhoz tartozó incidensek listája „Megoldva” gombbal.
5. **Adminisztrátori Oldal (`AdminPage.jsx`):** Összesítő számlálók és táblázat az összes rendszerben lévő weboldalról törlési lehetőséggel.

---

## 4. Bemeneti Validációs Szabályok
* **URL validáció:** Kizárólag `http://` vagy `https://` előtaggal rendelkező, érvényes domain nevet tartalmazó sztring fogadható el. Tiltott értékek: `localhost`, `127.0.0.1`, `0.0.0.0`, `192.168.*`, `10.*`.
* **Jelszó:** Minimum 6 karakter.

## 5. Prompt és Emberi Validációs Napló (HITL)
* **AI-Planner (Gemini) eredeti tervezet:** Külön cron-job ütemező felületet tervezett percenkénti beállítással.
* **Vezető Fejlesztő (Humán) korrekció:** A védésen történő azonnali bemutathatóság érdekében az elsődleges fókusz a gombnyomásra induló valós idejű „Scan Now” funkcióra került, elkerülve a háttérfolyamatok memóriaszivárgási kockázatait.