# Követelményspecifikáció – SecAudit Monitoring Portál

| Dokumentum tulajdonság | Érték |
| :--- | :--- |
| **Projekt megnevezése** | SecAudit – Weboldal Biztonsági és Uptime Monitoring Portál |
| **Verzió** | 1.0.0 |
| **Készítette (Draft)** | AI-Planner (Gemini) |
| **Lektorálta és Jóváhagyta** | Lénárt Gábor – Vezető Fejlesztő (Lead-Dev & QA) |
| **Státusz** | Elfogadva / Aláírva |

---

## 1. Áttekintés és a projekt célja
A **SecAudit** egy modern, konténerizált, full-stack webalkalmazás, amely lehetővé teszi weboldalak és webes API-k rendelkezésre állásának (uptime), válaszidejének, valamint kritikus HTTP biztonsági fejléceinek (HSTS, CSP, X-Frame-Options) és HTTPS titkosításának automatizált vagy eseti ellenőrzését. A rendszer az ellenőrzések alapján egy 0–100 pontos skálán értékeli a céloldalt, és **A–F biztonsági osztályzatot** állapít meg.

## 2. Jelenlegi helyzet és üzleti igény
A kis- és középvállalkozások, valamint egyéni fejlesztők gyakran úgy üzemeltetnek éles weboldalakat, hogy nincsenek tisztában a hiányzó biztonsági HTTP fejlécek (pl. kattintáseltérítés vagy XSS elleni védelem) kockázataival, illetve csak a felhasználói panaszokból értesülnek a szerverleállásokról. A SecAudit egyetlen átlátható műszerfalon (Dashboard) egyesíti az elérhetőségi és a passzív kiberbiztonsági auditálást.

## 3. Felhasználói szerepkörök
* **Regisztrált Felhasználó (`USER`):** Saját monitorozott weboldalak (URL-ek) felvétele, módosítása és törlése; manuális biztonsági ellenőrzés (Scan) indítása; korábbi mérések, pontszámok és incidensek megtekintése; incidensek lezárása.
* **Rendszeradminisztrátor (`ADMIN`):** Globális rendszerstatisztikák megtekintése, összes regisztrált felhasználó és rögzített weboldal áttekintése, szabálytalan vagy visszaélésszerű URL-ek moderálása/törlése.

## 4. Funkcionális követelmények
| Azonosító | Megnevezés | Leírás | Prioritás |
| :--- | :--- | :--- | :--- |
| **KÖV-01** | Hitelesítés és Jogosultság | Regisztráció, JWT-alapú bejelentkezés, bcrypt jelszó-hashelés, `USER` és `ADMIN` szerepkörök szétválasztása. | Kötelező (Must) |
| **KÖV-02** | Weboldalak (Targetek) kezelése | Monitorozandó URL-ek CRUD műveletei (létrehozás, listázás, aktiválás/inaktiválás, törlés). | Kötelező (Must) |
| **KÖV-03** | Aktív HTTP & Header Scanner | HTTP/HTTPS lekérés indítása a cél-URL-re, státuszkód, válaszidő (ms) és biztonsági fejlécek kiolvasása. | Kötelező (Must) |
| **KÖV-04** | Biztonsági Pontozó Motor | Determinisztikus algoritmus, amely 0–100 pontot és A–F érdemjegyet számol a fejlécek és válaszidő alapján. | Kötelező (Must) |
| **KÖV-05** | Incidensnapló (Incident Log) | Automatikus figyelmeztető vagy kritikus bejegyzés generálása leállás (5xx/timeout) vagy F osztályzat esetén. | Magas (Should) |
| **KÖV-06** | Adminisztrátori Műszerfal | Rendszerszintű mutatók (felhasználók száma, átlagos biztonsági szint, aktív incidensek) és moderáció. | Magas (Should) |

## 5. Nem-funkcionális követelmények
* **Hordozhatóság (Docker):** A teljes rendszer (MySQL adatbázis, Node.js/Express backend, React frontend) egyetlen `docker compose up` paranccsal elindítható.
* **Biztonság:** SSRF (Server-Side Request Forgery) alapvédelem a scannerben (lokális IP-címek, pl. `localhost`, `127.0.0.1` tiltása), JWT védett végpontok.
* **Tesztelhetőség:** A biztonsági pontozó algoritmus és az URL-validátor különálló, tiszta függvényként (pure function) valósul meg, legalább 90%-os Jest unit teszt lefedettséggel.
* **Reszponzivitás:** Bootstrap 5 alapú, mobilon és asztali gépen is átlátható felület.

## 6. Prompt és Emberi Validációs Napló (HITL)
* **AI-Planner (Gemini) eredeti tervezet:** Általános ping és port-scan funkciókat is javasolt.
* **Vezető Fejlesztő (Humán) korrekció:** A nyers TCP port-scanning jogi és szerveroldali tűzfal-korlátok miatt eltávolítva; a fókusz a szabványos, passzív HTTP/HTTPS válaszfejléc-elemzésre (HSTS, CSP, X-Frame-Options) és SSRF-szűrésre szűkítve.