# SofaFunk 0.1.1 — Testnachweis, 23.09.2026

## Gebaut

- Windows x64: `SofaFunk Setup 0.1.1.exe` (NSIS, ohne Codesigning-Zertifikat).
- Linux x64: `SofaFunk-0.1.1.AppImage` und `sofa-funk-0.1.1.tar.gz`.
- Electron 44.4.0, electron-builder 26.15.3, Abhaengigkeiten per Lockfile.
- Linux-Build in Ubuntu 24.04 unter WSL, kein CachyOS-Buildrechner.

## Tatsaechlich bestanden

| Pruefung | Ergebnis |
| --- | --- |
| `npm test` auf Windows und Ubuntu/WSL | 27/27; Capture, Diagnose, Server, Authentifizierung und TURN-Credentials |
| `test/picker-ui.mjs` unter Chrome/Windows | Echter App-Dialog und WebRTC; Timeout, erneuter Versuch, Abbruch und Verlassen des Kollegen |
| `test/rtc.mjs` unter Chrome/Windows | Zwei Kontexte, echter Chat, RTP-Audio in beide Richtungen, decodierte Kamera, Screen-Stream, Stop und Wiederbeitritt |
| `test/turn-relay.sh` unter Ubuntu/WSL | Echter coturn; beide ICE-Paare relay/relay, Medienpakete und Chat |
| `test/turn-relay.sh --external` unter Ubuntu/WSL | Externer Clientmodus gegen getrennten lokalen Server: Checker und vollstaendiger RTC-Relay-Ablauf bestanden |
| `test/desktop-smoke.mjs` mit den gebauten Windows-/Linux-Binaries | Eigenes App-Fenster laedt; Preload-Bruecke vorhanden; Node-Integration im Renderer aus |
| Gebaute Linux-Binary mit `--diagnose-linux` | Exitcode 2 und `needs-attention` fuer fehlenden PipeWire-Socket und ScreenCast-Portal; kein falsches Erfolgsergebnis |

Alle Browser-Medien sind synthetisch: Testmikrofon, Testkamera und erzeugtes
Canvas-Bild. Der Dialogtest ersetzt nur die scheiternde Aufnahme-Anfrage.
Kein persoenlicher Desktop, echtes Mikrofon oder echte Kamera wurde aufgenommen.
Fensterbilder zeigen ausschliesslich die neu gestartete SofaFunk-App.

Die direkte RTC-Ergebnisdatei enthaelt `passed: true`, acht Schritte und keine
JavaScript-Fehler. Beide Relay-Ergebnisse enthalten `passed: true`, neun Schritte
und dokumentierte `relay`/`relay`-Paare. Der Servercheck belegt zwei angemeldete
Teilnehmer, Signalisierung in beide Richtungen und gueltige temporaere
TURN-Credentials. Seine TLS-Angabe ist **false**, da der Test Loopback nutzt.

Belege liegen lokal unter `outputs/discord-alternative/verification-0.1.1/`
und als versioniertes Verification-ZIP neben den Installationsdateien.

## Grenzen

- Kein erreichbarer Server angegeben: kein oeffentliches TLS/TURN getestet
  oder Hosting eingerichtet. [SERVER.md](SERVER.md) beschreibt den Stack,
  [SERVER-CHECK.md](SERVER-CHECK.md) die Pruefung aus beiden Netzen.
- Beide automatischen WebRTC-Peers laufen auf demselben Rechner. Zwei
  verschiedene Heimnetze bleiben ein gemeinsamer Praxistest.
- WSL bietet hier kein ScreenCast-Portal/PipeWire. Der native CachyOS-/Wayland-
  Picker ist deshalb nicht als getestet zu verstehen. Diagnose und Anleitung:
  [LINUX-SCREENSHARING.md](LINUX-SCREENSHARING.md).
- Echte Kameras/Mikrofone, die vollstaendige Installer-Installation und
  Systemaudio-Freigabe wurden nicht getestet; Systemaudio ist kein Feature.
- Docker-Desktop-Backend blieb beim einmaligen Startversuch nicht aktiv.
  Der Compose-Stack wurde nicht gestartet und keine Systemeinstellung geaendert.
