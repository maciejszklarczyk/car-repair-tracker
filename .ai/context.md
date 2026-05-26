# Kontekst projektu — Car Repair Tracker

## Projekt

**Nazwa:** Car Repair Tracker  
**Kurs:** 10xDevs (edycja 3)  
**Deadline:** 5 lipca 2026 (1. termin)

## Problem

Brak jednego miejsca do śledzenia historii napraw, kosztów eksploatacji i terminów przeglądów auta.

## Logika biznesowa

Użytkownik dodaje naprawę (tekst lub faktura) → AI klasyfikuje typ naprawy → system oblicza koszty eksploatacji na km i przypomina o zbliżających się przeglądach.

## MVP (pierwszy tydzień)

1. Dodaj naprawę (opis tekstowy)
2. AI klasyfikuje typ (silnik / hamulce / elektryka / ogumienie / przegląd / inne)
3. Oblicz koszt/km na podstawie przebiegu
4. Pokaż nadchodzące terminy serwisowe

## Stack

- **Backend:** PHP
- **Frontend:** web
- **AI:** Groq API lub Google Gemini Flash (darmowy tier)
- **DB:** do ustalenia w PRD

## Wymagania certyfikacyjne

- [ ] Kontrola dostępu (logowanie)
- [ ] CRUD napraw, kosztów, pojazdów
- [ ] Logika biznesowa: klasyfikacja AI + koszty/km + alerty terminów
- [ ] Artefakty: PRD, specyfikacja techniczna, kontekst AI
- [ ] Test e2e kluczowego przepływu
- [ ] CI/CD pipeline

## Dane domenowe

| Encja   | Pola                                          |
| ------- | --------------------------------------------- |
| Pojazd  | marka, model, rok, aktualny przebieg          |
| Naprawa | data, opis, typ (AI), koszt, przebieg, pojazd |
| Termin  | typ serwisu, data, przebieg-próg, pojazd      |

## Decyzje

- AI nie zastępuje MVP — klasyfikacja to warstwa na prostym CRUD
- Semantic search odpada (ryzyko) — klasyfikacja przez LLM wystarczy
- Darmowy tier AI: Groq (14k req/dzień) lub Gemini Flash (1500 req/dzień)
