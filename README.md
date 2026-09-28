# Olympiade

Bis zu 16 Leute spielen die Spiele der Swimming-Lions-Sammlung als Disziplinen – mit Punkten (15/12/10/8/7/6/5/4/3/2/1, ab Platz 12 keine), Joker, doppelt zählendem Finale, Medaillen und Siegerehrung.

## So funktioniert es

1. Jemand erstellt eine Olympiade, die anderen treten mit dem 4-stelligen Code bei. Wer erstellt, leitet: Disziplinen auswählen, Reihenfolge und Einstellungen festlegen, starten.
2. Pro Disziplin holt sich jeder mit „Jetzt spielen“ ein **signiertes Ticket** und landet damit direkt im richtigen Raum des Spiels, ohne dort das Passwort einzugeben.
3. Das Spiel meldet das Ergebnis selbst an `/api/ergebnis` zurück. Sobald alle Ergebnisse da sind, gibt es die Wertung.

Signiert wird mit einem Schlüssel aus `ZUGANG_PASSWORT`. **Alle Dienste brauchen deshalb dasselbe Passwort.**

| Disziplin | Modus im Spiel | Wertung |
|---|---|---|
| Löwen-Kart | ein Rennen, freie Plätze fahren Bots, ab 9 Leuten Vorläufe | Reihenfolge, über Vorläufe die Zielzeit |
| Weltenbummler | gemeinsame Runden | Punkte → Reihenfolge |
| Blaue Stunde | eigene Lobby, 3-Minuten-Rennen, ohne Fahrernamen | Punkte → Reihenfolge |
| Weltreiche | Vorläufe à max. 4 Reiche, Zeitlimit, danach gewinnt das größte Reich | über Vorläufe: Größe am Ende bzw. wie lange durchgehalten |
| Iron Horizon | Gefechts-Challenge mit festem Startwert, ein Versuch | Punktzahl |
| LifeSim | Vermögens-Sprint mit frischer Figur | Vermögenszuwachs |

## Dateien

- `server.js` – Lobby, Ablauf, Wertung, WebSocket `/ws`, Meldungen `/api/ergebnis` und `/api/status`
- `spiele.js` – Katalog der Disziplinen (Adressen, Regeln, Einstellungen)
- `hub.js`, `hub.css`, `index.html` – die Seite
- `geteilt/olymp.js`, `geteilt/zugang.js` – Vorlagen, die in jedem Spiel liegen (bei Änderungen überall hinkopieren)

## Lokal

Startbefehl „olympiade“ in `.claude/launch.json` (Port 10500). Ohne Passwort sind lokal alle Tickets mit einem festen Testschlüssel signiert. Spiele auf anderen Ports: in `.env.lokal` z. B. `SPIEL_URL_REICHE=http://localhost:50062` eintragen.

## Render

Docker-Dienst per `render.yaml`, Umgebungsvariable `ZUGANG_PASSWORT` (dasselbe wie bei den Spielen). Alles liegt nur im Arbeitsspeicher; die Spieleserver halten die Olympiade während einer Disziplin durch ihre Statusmeldungen wach.
