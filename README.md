# SofaFunk

Ein privater Gesprächsraum für zwei Freunde: Textchat, Mikrofon, Kamera und
Bildschirmfreigabe. Windows 11 und Linux x64, mit eigener Server-Konfiguration.

## Installieren und starten

**Windows:** `SofaFunk Setup 0.1.0.exe` ausführen, Installationsordner wählen
und SofaFunk über das Startmenü öffnen. Der Prototyp hat kein
Codesigning-Zertifikat.

**Linux:** `SofaFunk-0.1.0.AppImage` ausführbar machen und starten:

```bash
chmod +x SofaFunk-0.1.0.AppImage
./SofaFunk-0.1.0.AppImage
```

Alternativ `sofa-funk-0.1.0.tar.gz` in einen eigenen Ordner entpacken und darin
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
$env:TEST_CHROME = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:e2e
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

## Grenzen

Keine Konten, Nachrichtenhistorie auf dem Server, Dateiuploads oder
Systemaudio-Freigabe. Bildschirmfreigabe überträgt Bild; Mikrofon läuft separat.
Für Wayland benötigt der Desktop PipeWire und ein passendes xdg-desktop-portal-
Backend. Der echte Portal-Picker auf CachyOS und zwei reale Heimnetze müssen
noch getestet werden. Der Docker-Stack wurde konfigurationsgeprüft und nicht
öffentlich bereitgestellt.

MIT-Lizenz. Änderungen sollen die Verbindungs- und Freigabe-Abbruchtests
erhalten. Abhängigkeiten bleiben per Lockfile fixiert.
