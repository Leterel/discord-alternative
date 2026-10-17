# Einen vorhandenen SofaFunk-Server prüfen

Diese Prüfungen vom Windows-PC und später auch vom Rechner des Kollegen aus
starten. Sie ändern keine Serverkonfiguration und brauchen keine Adminrechte.
Sie betreten kurz einen zufälligen eigenen Testraum und verlassen ihn wieder.
Vorhandene Gespräche bleiben unberührt. Es werden keine echten Kameras,
Mikrofone oder Desktop-Inhalte aufgenommen.

Voraussetzungen: dieses Repository, Node.js 22.12 oder neuer und `npm ci`.
Der echte Server muss vorher nach [SERVER.md](SERVER.md) eingerichtet sein.
Es wird dadurch kein Server gemietet oder automatisch öffentlich gestartet.

## 1. HTTPS, Anmeldung und Signalisierung

Im Repository, PowerShell:

```powershell
$env:SERVER_URL = 'wss://sofa.example.net'
$env:ROOM_SECRET = [System.Net.NetworkCredential]::new('', (Read-Host -AsSecureString 'Raumschluessel')).Password
node deploy/check-server.mjs
```

Linux/Bash:

```bash
export SERVER_URL='wss://sofa.example.net'
read -rsp 'Raumschluessel: ' ROOM_SECRET; printf '\n'
export ROOM_SECRET
node deploy/check-server.mjs
```

`sofa.example.net` durch den eigenen Server ersetzen. Den Raumschlüssel nicht
als Kommandozeilenargument verwenden. Das Werkzeug druckt keine Schlüssel oder
temporären TURN-Zugangsdaten. TLS-Zertifikate werden normal geprüft;
Zertifikatsfehler werden nicht übergangen. HTTP-Weiterleitungen im Health-Check
gelten als Fehler, damit ein anderes Login-Portal keinen Erfolg vortäuscht.

Vor der Anmeldung prüft ein zusätzlicher Client in einem eigenen Testraum,
dass ein absichtlich falscher Schlüssel mit dem SofaFunk-Code `4003` abgelehnt
wird. Ein Server, der jeden Schlüssel akzeptiert, besteht die Prüfung nicht.
Auch fehlende Antworten und andere Verbindungsabbrüche gelten als Fehler.

Exitcode 0 bestätigt `/health`, die Ablehnung des falschen Schlüssels,
zwei authentifizierte WSS-Verbindungen,
Signalisierung in beide Richtungen und ausgelieferte, noch gültige temporäre
TURN-Zugangsdaten. Das allein beweist **keinen TURN-Datentransport**.
Fehler brechen mit Exitcode 1 ab. Einzelne Netzwerkwartezeiten sind begrenzt.

## 2. Echten Chat, Audio, Video und TURN prüfen

Der vorhandene Integrationstest kann den angegebenen Server benutzen. In
diesem Modus erzwingt er TURN für beide WebRTC-Peers. Eine direkte Verbindung
kann den Test nicht bestehen. Er benutzt nur die zeitlich begrenzten
Zugangsdaten, die der Server nach der Anmeldung ausliefert; `TURN_SECRET` wird
auf dem Client weder benötigt noch eingetragen.

PowerShell, im selben Terminal wie oben:

```powershell
$env:TEST_SERVER_URL = $env:SERVER_URL
$env:TEST_ROOM_SECRET = $env:ROOM_SECRET
$env:TEST_CHROME = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:TEST_OUTPUT_DIR = 'test-results/external-server'
node test/rtc.mjs
```

Linux/Bash mit einem vorhandenen Chromium:

```bash
export TEST_SERVER_URL="$SERVER_URL"
export TEST_ROOM_SECRET="$ROOM_SECRET"
export TEST_CHROME=/usr/bin/chromium
export TEST_OUTPUT_DIR=test-results/external-server
node test/rtc.mjs
```

Den Browserpfad passend zum installierten Browser wählen. Alternativ ohne
`TEST_CHROME` die zu Playwright passende Chromium-Version verwenden
(`npx playwright install chromium`, kostenloser Download).
`TEST_TURN_URLS` und `TEST_TURN_SECRET` aus lokalen Relay-Tests vorher entfernen;
beide Modi können nicht vermischt werden.

Der Test sendet synthetisches Audio, Testkamerabilder und eine erzeugte
Bildschirmfläche über echte WebRTC-Verbindungen. Geprüft werden Textchat in
beide Richtungen, empfangene RTP-Daten, decodiertes Video, Screen-Stream,
Aufnahmestopp, Verlassen und Wiederbeitritt. Die Datei `relay-pairs.json` muss
auf beiden Seiten `localType: "relay"` und `remoteType: "relay"` ausweisen.
`rtc-results.json` nennt den Zeitpunkt, erfolgreiche Schritte und Grenzen.
Ein fehlgeschlagener Test ist auch bei vorhandener Ergebnisdatei kein Erfolg;
Exitcode und alle Schritte prüfen. Ergebnisse sind durch `.gitignore` lokal.

Nach Abschluss die Schlüssel aus dem Terminal entfernen:

```powershell
Remove-Item Env:ROOM_SECRET, Env:TEST_ROOM_SECRET, Env:TEST_SERVER_URL
```

```bash
unset ROOM_SECRET TEST_ROOM_SECRET TEST_SERVER_URL
```

## Was danach noch ein Praxistest braucht

Beide automatischen Peers laufen auf demselben Rechner. Ein Erfolg gegen einen
öffentlichen Server beweist den WSS-/TURN-Weg aus diesem einen Netz. Er beweist
keine Verbindung zwischen zwei unterschiedlichen Heimnetzen und keine native
Wayland-Bildschirmwahl. Dafür beide installierten Apps gleichzeitig benutzen:
Text in beide Richtungen, Audio, Kamera und Teilen/Abbrechen/erneut Teilen.
Die Serverprüfung getrennt aus beiden Netzen hilft, Fehler einzugrenzen.

## Lokal tatsächlich geprüft, 2026-09-23

- Der Checker wurde mit echten lokalen HTTP-/WebSocket-Verbindungen geprüft:
  erfolgreicher Ablauf, falscher Schlüssel, fehlende TURN-Konfiguration,
  ungültige Endpunkte, falsche Health-Antwort und Zeitlimit.
- Der erweiterte RTC-Test besteht weiterhin seinen vollständigen lokalen
  Ablauf mit synthetischen Medien und echten WebRTC-Verbindungen.
- Auch der externe Clientmodus wurde gegen einen getrennten lokalen Server
  mit echtem coturn bestanden: `bash test/turn-relay.sh --external`.
  Der Checker bestaetigt Health/Anmeldung/Signalisierung/Credentials; die
  anschliessende RTC-Pruefung weist auf beiden Seiten Relay-Paare und echte
  Medienpakete nach. Das bleibt ein Loopback-Test ohne oeffentliches TLS.
- Der vorhandene Docker-Desktop-Start wurde einmal versucht. Das Backend
  beendete sich nach wenigen Sekunden; die Linux-Engine blieb unerreichbar.
  Deshalb wurden weiterhin keine Compose-Container gestartet. Keine
  Router-/Firewallregeln oder Systemeinstellungen wurden geändert.
- Ein öffentlicher Server wurde bisher nicht angegeben. Der externe
  WSS-/TURN-Weg und öffentlich gültige TLS-Zertifikate sind somit noch nicht
  als getestet zu verstehen.
