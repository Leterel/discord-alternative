# Fortschritt — 2026-09-21

## Umgesetzt

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

- Windows: echtes Electron-Fenster, Preload-Brücke und ausgeschaltete
  Node-Integration im Renderer geprüft.
- Ubuntu 24.04 unter WSL: Linux-App gebaut; Fenster der gebauten Linux-Binary
  geöffnet und dieselben Desktop-Prüfungen bestanden.
- Zwei getrennte Chromium-Kontexte: echte WebSocket-/WebRTC-Verbindungen mit
  bidirektionalem Chat/RTP-Audio, Kamera, Screen-Stream, Stop, Leave, Rejoin.
- Server- und Capture-Regressionssuite; Ergebnisdateien im Ausgabeordner.
- Docker-Compose-Schema, Pflichtvariablen, Port-/Secret-Zuordnung und
  Startskript-Syntax geprüft. Keine Container gestartet.

## Noch offen

- Physische Mikrofone/Kameras und zwei verschiedene Heimnetze.
- Echte TURN-Relay-Verbindung und öffentlich gültige TLS-Konfiguration.
- CachyOS/Wayland-Portal-Picker und Vollinstallation auf beiden Zielrechnern.
- GitHub-Push benötigt lokalen Git-Zugang; kein Geheimnis ist eingecheckt.
