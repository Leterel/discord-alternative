# SofaFunk

Erster eigener Test: [Kurzanleitung](ERSTTEST.md).

Windows 0.1.4 ergänzt eine lokale Absturzdiagnose (`--diagnose-app`).
Build und geprüfte Grenzen: [VERIFICATION-0.1.4.md](VERIFICATION-0.1.4.md).
Die unten verlinkte GitHub-Veröffentlichung bleibt 0.1.3; 0.1.4 wurde noch
nicht als GitHub-Release veröffentlicht.

Ein privater Gesprächsraum für zwei Freunde: Textchat, Mikrofon, Kamera und
Bildschirmfreigabe. Windows 11 und Linux x64, mit eigener Server-Konfiguration.

## Installieren und starten

[Windows- und Linux-Downloads](https://github.com/Leterel/discord-alternative/releases/tag/v0.1.3)
(öffentliches Repository).

**Windows:** `SofaFunk Setup 0.1.3-fresh-20261007.exe` ausführen, Installationsordner wählen
und SofaFunk über das Startmenü öffnen. Der Prototyp hat kein
Codesigning-Zertifikat.

**Linux:** `SofaFunk-0.1.3.AppImage` ausführbar machen und starten:

```bash
chmod +x SofaFunk-0.1.3.AppImage
./SofaFunk-0.1.3.AppImage
```

Alternativ `sofa-funk-0.1.3.tar.gz` in einen eigenen Ordner entpacken und darin
`./sofa-funk` starten. Beide Linux-Pakete wurden unter Ubuntu 24.04 in WSL
gebaut. Das Fenster der gebauten Linux-Binary wurde dort geöffnet und geprüft.
Ein vollständiger Test auf CachyOS/Wayland steht aus.

**Für euch beide:** dieselbe Serveradresse (`wss://…`), denselben Raumnamen und
denselben Raumschlüssel eintragen, dann „Rein da“. Mikrofon, Kamera und Teilen
starten jeweils erst per Klick. Freigabe beenden oder Raum verlassen stoppt
die aktiven Aufnahmen.

## Server

Es ist kein öffentlicher SofaFunk-Dienst eingerichtet. Ihr benötigt einen
Signalisierungsserver und für zuverlässige Verbindungen zwischen Heimnetzen
einen TURN-Relay. Der vorbereitete Docker-Stack kombiniert Node.js, Caddy/TLS
und coturn. Einrichtung, DNS, Ports und Betrieb: [SERVER.md](SERVER.md).
Einen vorhandenen Server von beiden Rechnern aus pruefen:
[SERVER-CHECK.md](SERVER-CHECK.md). Der Check startet keinen oeffentlichen Dienst.

Der Signalisierungsserver vermittelt den Verbindungsaufbau; Chat und Medien
laufen über WebRTC, direkt oder über TURN. Der Server speichert keine
Nachrichten. Nachrichten bleiben im App-Fenster bis zum Schließen der App.
Der Serverbetreiber und der gemeinsame Raumschlüssel sind eure
Vertrauensgrenze; es gibt keine zusätzliche Identitätsprüfung.

## Lokal entwickeln

Node.js 24 LTS empfohlen; mindestens 22.12 für die Build-Werkzeuge.

```powershell
npm ci
$env:ROOM_SECRET = 'eigene-lange-test-passphrase'
npm run server
```

In einem zweiten Terminal `npm start`. Auf demselben Rechner funktioniert
`ws://127.0.0.1:8787`. Für einen anderen Rechner akzeptiert die App ausschließlich
`wss://` mit gültigem Zertifikat, auch im LAN. Ein Signalisierungsserver allein
garantiert keine Verbindung zwischen zwei Heimnetzen.

## Prüfen und bauen

```powershell
npm test
npm run test:desktop
npm run test:desktop-rtc
npm run test:desktop-media
$env:TEST_CHROME = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:e2e
npm run test:picker
npm run test:connection
npm run dist:win -- --publish never
```

Auf Linux: `npm ci`, `npm test`, `npm run dist:linux -- --publish never`.
Ergebnisse landen in `dist/`. Die Linux- und Windows-Abhängigkeiten müssen
jeweils auf ihrem Zielsystem installiert werden; `node_modules` nicht teilen.
`npm run pack:win-portable -- --publish never` erzeugt optional ein Windows-ZIP.

Tests prüfen Server/Authentifizierung, TURN-Credentials, isolierte Räume,
sauberes Schließen sowie Abbruch und veraltete Antworten bei Bildschirmwahl.
Der Integrationstest verbindet zwei echte WebRTC-Peers mit synthetischem Audio,
Kamera- und Bildschirmmaterial. Er prüft Chat, RTP-Übertragung, Stop und Rejoin.
Der Fenstertest prüft das echte Electron-Fenster und die isolierte
Preload-Brücke. Details und offene Gerätetests: [PROGRESS.md](PROGRESS.md).

`test:desktop-media` prüft zwei echte Desktop-Prozesse mit erzeugtem Audio und
Canvas-Bildern: RTP-Empfang, Kamera, parallele Bildschirmübertragung, Stop und
Neuverbinden. Keine physischen Aufnahmegeräte oder Desktopinhalte werden
verwendet. Mit `TEST_DESKTOP_EXE` lässt sich der Test gegen eine gebaute App
ausführen; jeder Test erhält eigene Profile. Der frische Windows-Installer
wurde installiert, geprüft und wieder deinstalliert. Aktueller Nachweis mit
exaktem Paket-Hash: [Prüfung vom 07.10.2026](VERIFICATION-20261007.md).

Zusätzlich wurde am 23.09. eine Verbindung über einen echten lokalen coturn-Relay
erzwungen und für beide Peers nachgewiesen. Das prüft Relay und temporäre
Zugangsdaten; öffentliches Hosting und Verbindungen zwischen Heimnetzen bleiben
separate Praxistests.

Relay-Test auf Linux mit vorhandenem coturn und Chromium:
`bash test/turn-relay.sh`. Er bindet nur Loopback, verwendet einen zufälligen
Testschlüssel und beendet coturn anschließend. Optional `TURN_BIN` und
`TEST_CHROME` auf vorhandene Binaries setzen. Die Belege landen in
`test-results/turn/`; direkte Verbindungen können diesen Test nicht bestehen.
`bash test/turn-relay.sh --external` prueft zusaetzlich den Server-Checker und
den externen Clientmodus gegen einen getrennten lokalen Server. Auch dieser
Test belegt keine oeffentliche TLS-Verbindung oder zwei Heimnetze.

## Neu in 0.1.3

Wenn der Browser die Tonwiedergabe blockiert, bleibt ein eigener Hinweis mit
**Ton freigeben** sichtbar. Ein Klick oder Enter auf dem Knopf versucht die
Wiedergabe erneut. Verlassen entfernt den Hinweis; verspätete Antworten einer
alten Verbindung können ihn nicht wieder einblenden.

Die Servervorbereitung kann mit `node deploy/configure.mjs` sichere, getrennte
Schlüssel erzeugen und die Eingaben prüfen. Vorhandene Konfigurationen bleiben
unangetastet. Anleitung: [SERVER.md](SERVER.md).

Der Audio-Regressionstest verwendet einen absichtlich erzeugten Browserfehler
und synthetischen Ton: `node test/audio-recovery.mjs`. Die normalen WebRTC-Tests
warten ausdrücklich auf tatsächlich empfangene RTP-Daten und dekodierte
Videobilder. Desktop-Smoke-Tests verwenden jeweils ein eigenes Testprofil.

Windows-Installation und Deinstallation sowie zwei gebaute App-Instanzen auf
Windows und Ubuntu/WSL wurden geprüft. Ergebnisse und genaue Grenzen:
[Prüfbericht 0.1.3](VERIFICATION-0.1.3.md).

## Vorherige Verbesserungen in 0.1.2

- Die Verbindungsanzeige prüft den tatsächlich gewählten WebRTC-Weg: direkt
  oder über einen TURN-Vermittlungsserver. Wenn verfügbar, zeigt sie die
  gemessene Hin-und-zurück-Laufzeit in Millisekunden. IP-Adressen und
  Zugangsdaten werden dafür nicht angezeigt oder protokolliert.
- „Neu verbinden“ baut Raum-/Medienverbindungen neu auf. Aktive Aufnahmen
  enden sofort; Mikrofon, Kamera und Bildschirm bleiben anschließend aus,
  bis ihr sie ausdrücklich wieder startet.
- Mit Server 0.1.2 kann dabei die eigene hängen gebliebene Sitzung ersetzt
  werden, ohne den Platz des Kollegen zu belegen. Dafür verwendet die App ein
  zufälliges Sitzungstoken nur im Arbeitsspeicher; der Raumschlüssel bleibt
  erforderlich. Beim ausdrücklichen Verlassen wird das Token vergessen.
- Serveraufbau und Anmeldung haben jeweils ein Zeitlimit von zwölf Sekunden.
  Danach ist ein neuer Versuch möglich. Falscher Schlüssel und voller Raum
  bekommen verständliche Meldungen.
- „Wenn die Verbindung hakt“ erklärt den aktuellen Weg und ob euer Server
  einen TURN-Vermittler anbietet. Ein angebotener TURN-Server allein ist noch
  kein Beweis, dass er aus eurem Netz erreichbar ist.

Für die verbesserte Wiederverbindung auch den selbst gehosteten Server auf
0.1.2 aktualisieren. Alte Server bieten diesen Sitzungsaustausch noch nicht an.

## Vorherige Verbesserungen in 0.1.1

- Bei mehreren Bildschirmquellen unter Wayland ist eine ausdrueckliche
  Auswahl noetig; die erste Quelle wird nicht automatisch freigegeben.
- Abgebrochene oder abgelaufene Freigaben schliessen den Auswahldialog,
  damit erneutes Teilen und Verlassen funktionieren.
- `./SofaFunk-0.1.1.AppImage --diagnose-linux` prueft Linux-Voraussetzungen
  ohne Aufnahme oder Systemaenderungen. Einzelheiten und ein kurzer
  Funktionstest: [LINUX-SCREENSHARING.md](LINUX-SCREENSHARING.md).
- Neue Serverpruefung fuer Health, Anmeldung, Signalisierung und
  TURN-Konfiguration; optionaler Medientest mit erzwungenem Relay.

## Grenzen

Keine Konten, Nachrichtenhistorie auf dem Server, Dateiuploads oder
Systemaudio-Freigabe. Bildschirmfreigabe überträgt Bild; Mikrofon läuft separat.
Für Wayland benötigt der Desktop PipeWire und ein passendes xdg-desktop-portal-
Backend. Der echte Portal-Picker auf CachyOS und zwei reale Heimnetze müssen
noch getestet werden. Der Docker-Stack wurde konfigurationsgeprüft und nicht
öffentlich bereitgestellt.

MIT-Lizenz. Änderungen sollen die Verbindungs- und Freigabe-Abbruchtests
erhalten. Abhängigkeiten bleiben per Lockfile fixiert.

## Einfacher lokaler Ersttest (23.10.2026)

Für einen reinen Browser-Test im Quellordner einmal `npm ci --omit=dev`
ausführen, dann `Start-Testserver.cmd` öffnen oder `npm run demo` starten.
Mit bereits vorhandenen Abhängigkeiten entfällt der Installationsschritt.
Das Terminal zeigt Browseradresse, WebSocket-Adresse, Raum und frischen
Testschlüssel. Zwei Browserfenster mit unterschiedlichen Namen öffnen und die
angezeigten Werte eintragen; alternativ die installierte SofaFunk-App verwenden.
Text benötigt keine Kamera-/Mikrofonfreigabe. Strg+C beendet den Testserver.

Der Demo-Start bindet ausschließlich 127.0.0.1 an einen freien Port. Er erzeugt
für jeden Start einen eigenen Schlüssel im Speicher und ignoriert HOST, PORT,
ROOM_SECRET und TURN-Konfiguration aus der Umgebung. Kein öffentliches Hosting,
kein Relay, keine Datei mit Schlüsseln. Andere Geräte erreichen diesen Modus
nicht. Für einen tatsächlichen Fernanruf weiterhin SERVER.md beachten.
