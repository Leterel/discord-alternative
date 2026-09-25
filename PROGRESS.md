# Fortschritt — 2026-09-24

## Server-Einrichtung — 2026-09-25

- Neues `deploy/configure.mjs`: gefuehrte lokale Vorbereitung und `--check`.
  Erzeugt getrennte 256-Bit-Schluessel ohne Terminalausgabe, schreibt `.env`
  exklusiv (kein Ueberschreiben) und unter Linux mit Dateimodus 600.
- Prueft die Eingaben vor dem Schreiben: Domains, Kontaktadresse, IPv4,
  Beispielwerte, Raumschluessel und TURN-Geheimnis. Fehlermeldungen geben
  geheime Werte nicht wieder. Keine Netzwerk- oder Docker-Aufrufe.
- Windows: 38 Tests bestanden; der Linux-Symlinktest wurde gezielt ausgelassen.
- Ubuntu/WSL: alle vier neuen Konfigurationstests bestanden, einschliesslich
  Modus 600 und abgelehntem Schreiben durch einen vorhandenen Symlink.
- Ein oeffentlicher Server ist weiterhin nicht vorhanden. Lokale
  Konfigurationspruefung ersetzt keinen Internet-/TURN-Test.
- Die App-Binaries bleiben 0.1.2; diese Aenderung betrifft nur Serverwerkzeuge.

## 0.1.2 — Verbindungsstatus und Wiederverbindung

- Ausgewähltes ICE-Kandidatenpaar wird ausgewertet: direkte Verbindung oder
  TURN-Vermittler, zusätzlich gemessene Laufzeit, sofern verfügbar. Keine IPs
  oder Zugangsdaten in dieser Anzeige.
- Serveraufbau und Anmeldebestätigung warten jeweils höchstens zwölf Sekunden.
  Fehlversuche geben den Startknopf wieder frei; Verlassen löscht alte Timer.
- Neuverbinden stoppt lokale Medien sofort. Ein zufälliges, raumgebundenes
  Sitzungstoken ersetzt nur den eigenen alten Socket, auch wenn dieser noch
  offen ist. Der Raumschlüssel bleibt Pflicht, der zweite Platz bleibt erhalten.
  Das Token bleibt nur im Fensterspeicher und wird beim Verlassen vergessen.
- 35/35 Unit-Tests auf Windows und Ubuntu/WSL. Echte Socket-Tests schließen
  falsche Token, fremde Räume und fehlende Authentifizierung aus.
- Browser-UI: echte Handshake-/Anmelde-Stillstände, Fehler und erneuter Versuch
  bestanden; nur die Wartezeit wird im Test künstlich beschleunigt.
- Direkter WebRTC-Test sowie zwei coturn-Läufe (normal und externer Clientmodus)
  bestanden. Anzeige stimmt mit tatsächlichem ICE-Weg überein; Neuverbinden
  liefert wieder Chat, alle vorherigen Capture-Tracks sind beendet.
- Zwei gebaute Desktop-Instanzen jeweils auf Windows und Linux/Ubuntu-WSL:
  echter Chat in beide Richtungen und Neuverbinden bestanden. Dabei keine
  Aufnahme und keine künstliche Browser-Berechtigungsfreigabe.
- Windows-Installer, Linux-AppImage und tar.gz 0.1.2 gebaut. Weiterhin unsigned;
  kompletter Installerlauf, CachyOS/Wayland und zwei Heimnetze bleiben offen.
- Ausführlicher Nachweis und Grenzen: VERIFICATION-0.1.2.md.

Die folgenden Abschnitte dokumentieren den vorherigen Stand 0.1.1.

## Umgesetzt

- Version 0.1.1: mehrere Quellen in Wayland-Umgebungen brauchen eine bewusste
  Auswahl. Timeout/Fehler der Freigabe schliesst den App-Auswahldialog.
- Schreibgeschuetzte Linux-Diagnose im Paket (`--diagnose-linux`) sowie
  Anleitung fuer CachyOS/Wayland in `LINUX-SCREENSHARING.md`.
- `deploy/check-server.mjs` prueft einen angegebenen Server auf HTTPS/WSS,
  Anmeldung, Signalisierung in beide Richtungen und temporaere TURN-Credentials.
  `SERVER-CHECK.md` beschreibt den anschliessenden erzwungenen RTC-Relay-Test.

- Electron-App: Textchat, Audio, Video und parallele Bildschirmfreigabe.
- Echter WebRTC-Verbindungsaufbau, serialisierte SDP/ICE-Verarbeitung und
  abgesicherte Callbacks nach Verlassen/Wiederbetreten.
- Bildschirmwahl ist an Fenster und Anfrage gebunden; Abbruch während der
  Quellen-Ermittlung, veraltete Auswahl und Fensterschließen werden abgefangen.
- Node-Server mit Zwei-Personen-Räumen, Raumschlüssel, Limits und Heartbeat.
- Geprüfte TURN-Konfiguration und zeitlich begrenzte coturn-Zugangsdaten.
- Server-Shutdown wartet auf WebSocket- und Raum-Aufräumen.
- Docker-Stack für selbst gehostetes WSS/Caddy/coturn vorbereitet.
- Windows-NSIS-Installer sowie Linux-AppImage und tar.gz gebaut.

## Nachgewiesen

- 0.1.1: 27/27 Tests auf Windows und Ubuntu/WSL. Neue Faelle decken mehrere
  Wayland-Quellen, Portalabbruch, verspätete Antworten, Diagnose und
  Server-Erreichbarkeit/-Fehler ab.
- Echter App-Dialog mit zwei WebRTC-Teilnehmern: Timeout, erneuter Versuch,
  Abbrechen und Verlassen des Kollegen bestanden, ohne Desktopaufnahme.
- Der externe Clientmodus wurde gegen einen getrennten lokalen Server und
  echten coturn getestet: Servercheck erfolgreich; beide ICE-Paare relay/relay,
  Chat, Audio, Kamera, Screen, Stop und Wiederbeitritt bestanden. Das ist kein
  Test von oeffentlichem TLS oder von zwei verschiedenen Heimnetzen.
- Diagnose der gebauten Linux-App meldet korrekt `needs-attention`: WSL hat
  Wayland, aber hier fehlen PipeWire-Socket und ScreenCast-Portal. Keine Dienste
  installiert oder Systemeinstellungen geaendert.

- Windows: echtes Electron-Fenster, Preload-Brücke und ausgeschaltete
  Node-Integration im Renderer geprüft.
- Ubuntu 24.04 unter WSL: Linux-App gebaut; Fenster der gebauten Linux-Binary
  geöffnet und dieselben Desktop-Prüfungen bestanden.
- Zwei getrennte Chromium-Kontexte: echte WebSocket-/WebRTC-Verbindungen mit
  bidirektionalem Chat/RTP-Audio, Kamera, Screen-Stream, Stop, Leave, Rejoin.
- Server- und Capture-Regressionssuite; Ergebnisdateien im Ausgabeordner.
- Docker-Compose-Schema, Pflichtvariablen, Port-/Secret-Zuordnung und
  Startskript-Syntax geprüft. Keine Container gestartet.
- Am 23.09.: echter coturn-Relay unter Ubuntu/WSL, produktive temporäre
  HMAC-Zugangsdaten, beide WebRTC-Peers ausschließlich über TURN verbunden.
  Ausgewählte ICE-Paare auf beiden Seiten `relay`/`relay`, Chat, RTP-Audio,
  Videodecoding, Bildschirmstream und Wiederbeitritt bestanden.
- Alle Quelltexte und Windows/Linux-Downloads am 23.09. im privaten GitHub-Repo
  veröffentlicht: https://github.com/Leterel/discord-alternative/releases/tag/v0.1.0.

## Noch offen

- Physische Mikrofone/Kameras und zwei verschiedene Heimnetze.
- TURN über das öffentliche Internet und öffentlich gültige TLS-Konfiguration.
- CachyOS/Wayland-Portal-Picker und Vollinstallation auf beiden Zielrechnern.
