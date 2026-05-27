# Pension Planner Schweiz – Requirements (MVP)

## 1. Vision & Strategie

Eine modular aufgebaute PWA zur präzisen Simulation der Pensionierung in der Schweiz.
Der Fokus liegt auf einer seriösen, semi-professionellen Schätzung (Level B), die über einfache
Faustregeln hinausgeht, aber die Komplexität einer vollen Finanzberatung vermeidet.

Ziel: Schneller MVP mit klarer Erweiterbarkeit. Der User soll in unter 5 Minuten ein
aussagekräftiges Resultat sehen.

---

## 2. Zielgruppe (MVP)

- Privatpersonen in der Schweiz (Alter 30–60)
- Angestellte (keine Selbstständigen im MVP)
- Fokus auf einfache, aber seriöse Nutzung – kein Finanzberater-Ersatz

---

## 3. Kernentscheidungen (getroffen)

| Thema | Entscheidung |
|---|---|
| Präzisionslevel | B (semi-professionell) |
| Berechnungs-Paradigma | Jahr-für-Jahr Projektion (iterativ) |
| Modularität | Technisch (kein User-Schalter im UI) |
| Säule 3a Output | Kapitalausweis (kein Verzehr im MVP) |
| AHV-Modell | Level B (Beitragsjahre + Durchschnittseinkommen) |
| BVG-Beiträge | Prozentuale Staffelung nach Alter |
| Koordinationsabzug | Einfacher Schalter (Standard / Kein / Eigener Betrag) |
| Inflation | Konstante Rate, nominale Rechnung intern |
| Einkommen bis Rente | Statisch + Inflation (vorbereitet für Meilensteine) |
| Erwerbsunterbrüche | Bereits im MVP vorgesehen |
| Persistenz | Cloud (Supabase) |
| User-Profil | Single-Person (kein Paar im MVP) |
| Szenarien | Mehrere Szenarien pro User (verschiedene Pfade) |

---

## 4. Kernfunktionen (MVP)

### 4.1 User Management
- Registrierung / Login (via Supabase Auth)
- Persönliches Profil (eine Person pro Account)
- Mehrere Szenarien pro User

### 4.2 Basisdaten erfassen

**User-Profil (fix, nicht szenario-spezifisch):**
- Geburtsdatum
- Geschlecht (für AHV-Referenzalter)
- Jahr des Erwerbsbeginns

**Szenario-spezifische Inputs:**
- Gewünschtes Pensionierungsalter
- Aktuelles Bruttojahreseinkommen
- Geplante Erwerbsunterbrüche (Jahre)
- BVG: aktuelles Altersguthaben, Koordinationsabzug-Einstellung
- Säule 3a: aktuelles Kapital, jährlicher Beitrag
- Freies Vermögen: aktueller Bestand, erwartete Rendite
- Annahmen: Inflationsrate, BVG-Zins, 3a-Rendite

### 4.3 Berechnungs-Engine (modular)

Alle Module sind technisch unabhängig und einzeln testbar.
Der User steuert die Aktivierung implizit durch Dateneingabe (kein UI-Schalter).

**Module MVP:**
1. BaseIncome-Modul
2. AHV-Modul (Level B)
3. BVG-Modul
4. Säule 3a-Modul
5. FreeAssets-Modul (inkl. investmentIncome)
6. Ergebnis-Aggregations-Modul

### 4.4 Szenario-Simulation
- Pensionierungsalter per Slider ändern
- Sparraten anpassen
- Live-Update der Ergebnisse

### 4.5 Ergebnisdarstellung
- Monatliches Renteneinkommen (AHV + BVG) vs. Wunscheinkommen
- Kapitalstand bei Pensionierung (3a + freies Vermögen)
- Rentenlücke (CHF + %)
- Einfache Charts (Zeitreihe Kapitalentwicklung)

---

## 5. Nicht-Ziele (MVP)

- Steueroptimierung / Kapitalbezugssteuer
- Immobilien / Wohneigentum
- Selbstständige
- Komplexe BVG-Pläne (Überobligatorium detailliert)
- Paar-Planung / AHV-Plafonierung
- Kapitalverzehr-Logik (Langlebigkeits-Simulation)
- Präzise AHV-Historie (Level C: Einkommensliste pro Jahr)
- Beratung / Empfehlungen

---

## 6. Post-MVP Backlog

- Kapitalverzehr-Logik (Langlebigkeits-Simulation)
- AHV Level C (historische Einkommensliste)
- Paar-Planung (Verheirateten-AHV, gemeinsames Budget)
- Steuer-Modul (Kapitalbezugssteuer & Einkommenssteuer)
- Hauskauf / Wohneigentum-Modul
- Einkommen-Meilensteine (manuelle Gehaltssprünge)
- API für Berater
- Import von PK-Ausweisen

---

## 7. Erfolgskriterien (MVP)

- User sieht in unter 5 Minuten ein aussagekräftiges Resultat
- Verständliche Darstellung ohne Finanzwissen
- Stabile, nachvollziehbare Berechnungen
- Daten sind geräteübergreifend verfügbar (Cloud-Sync)
