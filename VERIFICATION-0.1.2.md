# SofaFunk 0.1.2 — Prüfung am 23./24.09.2026

## Was geändert wurde

Die App zeigt den tatsächlich gewählten Übertragungsweg an. Eine TURN-Verbindung
wird nicht mehr als Direktverbindung ausgegeben. Unbeantwortete Serveranfragen
geben nach zwölf Sekunden einen verständlichen Fehler und den Startknopf frei.

„Neu verbinden“ beendet aktive Aufnahmen und baut die Verbindung neu auf. Der
Server kann anhand eines zufälligen Sitzungstokens ausschließlich den eigenen
noch offenen Socket ersetzen; der Platz des Kollegen bleibt bestehen. Das
Token benötigt weiterhin den richtigen Raumschlüssel, ist an Raum/Server
gebunden und wird nur im Fensterspeicher gehalten. Für diese Verbesserung muss
auch der selbst gehostete Server auf 0.1.2 aktualisiert werden.

## Tatsächlich geprüft

| Prüfung | Ergebnis |
| --- | --- |
| Unit-Tests auf Windows und Ubuntu/WSL | 35/35 bestanden |
| Offener alter Socket beim Neuverbinden | Eigene Sitzung ersetzt, zweite Person bleibt; spätes Schließen entfernt nicht den Nachfolger |
| Falscher Schlüssel, fremdes/ungültiges Sitzungstoken | Kein fremder Platz wird ersetzt |
| Anmeldung im Browser | Echte HTTP-/WebSocket-Verbindungen; Handshake-/Bestätigungsstillstand, Abbruch, falscher Schlüssel und erfolgreicher neuer Versuch bestanden |
| Direkter WebRTC-Test | Chat, synthetisches Audio/Video/Screen, Stop, Wiederbeitritt, Neuverbinden; Anzeige erkennt direkte Verbindung |
| Echter coturn, erzwungener Relay | Beide ICE-Paare relay/relay; Chat und RTP übertragen; Anzeige erkennt Vermittlungsserver; Neuverbinden funktioniert |
| Externer Clientmodus gegen separaten lokalen Server | Servercheck und derselbe Relay-Ablauf bestanden |
| Gebaute Windows-App, zwei Instanzen | Echter bidirektionaler Chat und Neuverbinden, getrennte Testprofile |
| Gebaute Linux-App, zwei Instanzen unter Ubuntu/WSL | Derselbe echte Desktop-Ablauf bestanden |
| Bildschirmwahldialog im Browser | Timeout, erneuter Versuch, Abbruch und Verlassen des Kollegen bestanden |

Die beiden Desktop-Tests öffnen **keine** Kamera, kein Mikrofon und keine
Bildschirmaufnahme. Sie verwenden die wirklichen App-Berechtigungseinstellungen.
Die Browser-Medientests verwenden ausschließlich synthetische Quellen; dafür
werden Kamera-/Mikrofonberechtigungen im Testprofil gesetzt. Der Dialogtest
nutzt dieselbe Testumgebung für verlässliche lokale ICE-Kandidaten, ersetzt nur
die Aufnahme-Anfrage und macht keine Bildschirmaufnahme. Die Timeout-UI-Tests
beschleunigen Browser-Timer; Netzwerkverbindungen und Serverantworten sind echt.

## Wiederholen

Im Repository mit den installierten Abhängigkeiten:

```sh
npm test
npm run test:connection
npm run test:picker
npm run test:e2e
npm run test:desktop-rtc
```

`TEST_CHROME` kann auf einen vorhandenen Chromium/Chrome zeigen. Für die
gebauten Programme `TEST_DESKTOP_EXE` auf die entpackte EXE bzw. Linux-Binary
setzen. `TEST_OUTPUT_DIR` wählt einen eigenen Ergebnisordner. Der Desktop-Test
erzeugt dort getrennte Wegwerfprofile, öffnet nur die eigenen Testfenster und
schließt sie anschließend. Nicht die Profilordner veröffentlichen.

Unter Linux mit vorhandenem coturn: `bash test/turn-relay.sh` sowie
`bash test/turn-relay.sh --external`. Beide binden ausschließlich Loopback und
beenden ihren eigenen Relay-Prozess. Für einen tatsächlichen entfernten Server
die Anleitung [SERVER-CHECK.md](SERVER-CHECK.md) verwenden.

## Installationsdateien und Belege

- `SofaFunk Setup 0.1.2.exe`: Windows x64, NSIS, nicht signiert.
- `SofaFunk-0.1.2.AppImage` und `sofa-funk-0.1.2.tar.gz`: Linux x64.
- JSON-Nachweise, nur App-Fensterbilder und Buildnachweis im Verification-ZIP.
- Quellcode und SHA-256-Prüfsummen liegen neben der Release.

## Weiter offen

Kein öffentlicher Server wurde angegeben oder bereitgestellt. Alle automatischen
Clients verwenden denselben Rechner. Zwei Heimnetze, öffentliches TLS/TURN,
native CachyOS-/Wayland-Bildschirmwahl sowie echte Mikrofone/Kameras bleiben
Praxistests. Ubuntu/WSL ist kein CachyOS-Test. Die gebauten App-Binaries wurden
gestartet; ein vollständiger Installerlauf auf den Zielrechnern ist nicht belegt.
