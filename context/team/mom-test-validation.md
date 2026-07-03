# Mom Test Validation Plan

## Input Idea

Skrypt `gh` CLI (`gh-issue-audit`) wykrywający PR-y bez powiązanego issue i issue otwarte po zmergowanym PR — docelowo GitHub Action jako PR check i scheduled closer.

## Hypotheses

- **User/role**: Single contributor (Maciej) — sam jest zarówno deweloperem jak i "użytkownikiem" procesu
- **Friction**: Trzy ręczne kroki przy każdym zadaniu: utwórz issue → zlinkuj w PR → zamknij po merge. Kroki się gubią — backlog zaśmiecony, brak kontekstu w PR
- **Current workaround**: Nieznany — prawdopodobnie brak; tarcie istnieje bo konwencja nie jest stosowana konsekwentnie
- **Risky assumptions**:
  1. Problem powtarza się często
  2. Zaśmiecony backlog powoduje realny koszt, nie tylko estetyczny dyskomfort
  3. Maciej chce używać GitHub Issues jako systemu śledzenia (vs commitowanie bez issues)
  4. Narzędzie zmieni zachowanie (vs zostanie zignorowane jak ostrzeżenie CI)
- **Evidence already present**: Wyłącznie self-report. Zero danych z logów, historii issues, ani częstotliwości.

## Critique

**Największe ryzyko:** problem może nie istnieć dla single contributora. GitHub Issues ma sens jako narzędzie komunikacji w zespole — dokumentuje decyzje dla innych. Przy jednej osobie issue jest notatką dla siebie. Jeśli Maciej pamięta co robi, issue tracking może być narzutem, nie wartością.

**GitHub już to rozwiązuje.** Keyword `Closes #X` w opisie PR automatycznie zamyka issue po merge. Jeśli konwencja nie jest stosowana — prawdziwym problemem może być to, że tworzenie issue nie ma wartości, a nie że brakuje narzędzia.

**Co liczyłoby się jako mocny dowód:** konkretny incident — "szukałem dlaczego coś zrobiłem i nie mogłem znaleźć kontekstu" lub "zmarnowałem X minut na sprawdzanie co jest otwarte".

## Interview Guide

*(Self-interview — odpowiedzi najlepiej oparte na historii repo, nie intuicji)*

**Rozgrzewka**
1. Ile tasków/PR-ów robisz tygodniowo średnio?
2. Dla jakich zadań tworzysz issue, a dla jakich commitować bezpośrednio bez issue?

**Ostatnia konkretna historia**
3. Przypomnij sobie ostatni PR, który zmergowałeś. Czy miał powiązane issue? Jeśli nie — dlaczego nie stworzyłeś?
4. Kiedy ostatnio szukałeś kontekstu "dlaczego to zrobiłem" i nie mogłeś go znaleźć — co wtedy zrobiłeś?

**Obecny workaround**
5. Jak dzisiaj sprawdzasz co jest "do zrobienia" — issues, notatki, pamięć, coś innego?
6. Co robisz z otwartym issue po tym jak PR się merguje — sprawdzasz ręcznie, zostawiasz, zapominasz?

**Koszt bólu**
7. Ile czasu w miesiącu poświęcasz na "sprzątanie" backlogu?
8. Czy był kiedyś moment gdy zaśmiecony backlog spowodował błędną decyzję lub zmarnowany czas?

**Istniejące alternatywy**
9. Czy próbowałeś używać `Closes #X` w opisach PR? Co działało/nie działało?
10. Czy rozważałeś rzucenie GitHub Issues na rzecz prostszego systemu (TODO.md, Linear, notatki)?

**Sygnał decyzyjny**
11. Jakie narzędzie zmieniłoby twoje zachowanie — to które ostrzega, czy to które robi za ciebie?

## Survey

*(6 pytań do self-oceny na podstawie historii repo)*

1. Ile jest obecnie otwartych issues w repo? *(screener — czy w ogóle używasz issues)*
2. Ile PR-ów z ostatnich 30 dni ma `Closes #X` w opisie?
3. Ile otwartych issues ma powiązany zmergowany PR?
4. Ile razy w ostatnim miesiącu ręcznie zamknąłeś issue po merge?
5. Jak często tworzysz issue dla nowego zadania: zawsze / często / czasem / rzadko / nigdy?
6. Opisz ostatni raz gdy brak issue lub niezamknięte issue spowodowało konkretny problem.

## Decision Criteria

- **Proceed**: ≥3 z ostatnich 10 PR-ów bez `Closes #X` ORAZ ≥5 otwartych issues z powiązanym zmergowanym PR ORAZ ≥1 konkretny incident (zły kontekst, zmarnowany czas)
- **Narrow scope**: Issues otwarte po merge ale bez realnego kosztu — zrób tylko skrypt diagnostyczny, nie CI gate
- **Do not build yet**: <5 otwartych issues łącznie — problem jest zbyt mały
- **Try existing tool/process first**: Nie stosujesz `Closes #X` konsekwentnie — 2-tygodniowy eksperyment z tą konwencją przed budowaniem czegokolwiek. GitHub robi to za darmo.
