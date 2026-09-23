# Fortschritt — 2026-09-23

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
