# Fortschritt — 2026-10-19

## 21.10.2026 — Linux 0.1.4 nachgezogen

- Bestehendes Ubuntu 24.04.4/WSL und getrennte Linux-Abhängigkeiten verwendet;
  keine Systeminstallation oder Änderung der Windows-`node_modules`.
- 45/45 Node-Tests einschließlich Linux-Symlinkfall bestanden.
- Neu gepackte 0.1.4-App: Desktop-Smoke, bereinigte Diagnose-CLI und alle acht
  RTC-Medienschritte mit zwei echten Prozessen unter eigenem Xvfb bestanden.
  Ausschließlich synthetische Medien, keine physischen Aufnahmen.
- AppImage und tar.gz fertig gebaut und mit SHA256 ausgeliefert. Direkter
  AppImage-Start ohne FUSE sowie acht Medienschritte aus dem entpackten tar.gz
  bestanden. Diagnoseprüfung benutzt beim AppImage einen separat extrahierten,
  per ASAR-Hash identischen Payload, weil der Runtime-Wrapper stdout verschmutzt.
- Details und Grenzen: [VERIFICATION-0.1.4-LINUX.md](VERIFICATION-0.1.4-LINUX.md).
  Ubuntu/Xvfb ist kein CachyOS-/Wayland- oder Heimnetz-Nachweis.

## 0.1.4 — lokale Absturzdiagnose und neues Windows-Paket

- Begrenztes, lokales Lifecycle-/Crashprotokoll mit strikter Feld-Whitelist
  implementiert. Keine Gesprächsinhalte, Adressen, Schlüssel oder Fehlertexte;
  kein Upload. `--diagnose-app` exportiert Systemversion und letzte Ereignisse.
- 44 Node-Tests bestanden, ein Linux-Symlinkfall unter Windows ausgelassen.
  Echter Desktop-Smoke einschließlich Diagnose-CLI aus Source und Paket bestanden.
- Neuer separater Windows-Installer 0.1.4 gebaut; die gepackte App besteht alle
  acht RTC-Medienschritte mit zwei echten Prozessen und synthetischen Medien.
  Frühere Installer unverändert, keine physischen Aufnahmen verwendet.
- Nachweise, Installer-Hash und Grenzen: [VERIFICATION-0.1.4.md](VERIFICATION-0.1.4.md).
  Öffentlicher Server, zwei Heimnetze und CachyOS/Wayland bleiben offen;
  der frühere Absturz wird nicht als behoben behauptet.

## Frischer Windows-Installer und echte Desktop-Medienübertragung

- Der frische Installer `SofaFunk Setup 0.1.3-fresh-20261007.exe` wurde jetzt
  tatsächlich in einem eigenen Testordner installiert. App-Version 0.1.3,
  installierte ASAR, Preload und Renderer-Isolation bestanden die Prüfung.
  Installieren und Deinstallieren jeweils Exitcode 0; Testverknüpfungen und
  Registrierung entfernt, ursprüngliches Benutzerprofil unverändert.
- Exakter Installer-SHA256:
  `9AA360B50509F1C295C4BEFD10D7CC9061052D0CAA4DF86841227D79D5F0B302`.
- Zwei Instanzen der gebauten Windows-App bestehen echten bidirektionalen
  WebRTC-Chat und Wiederverbindung mit getrennten Testprofilen.
- Neuer Test `npm run test:desktop-media`: acht Schritte mit erzeugtem Audio,
  Kamera- und Bildschirmmaterial bestanden. Audio-RTP in beide Richtungen,
  dekodiertes Video, parallele Kamera/Freigabe, Rückkehr zur Kamera, gestoppte
  Tracks beim Neuverbinden, danach wieder Chat und Audio sowie Verlassen geprüft.
  Medienquellen sind synthetisch und Ausgabe stumm; keine physischen Geräte
  und kein Desktopinhalt wurden aufgenommen.
- Automatischer GPU-Neustart ist entfernt. Normaler Start wurde geprüft;
  `--sofa-gpu-safe` bleibt eine bewusst gewählte Diagnoseoption. Der frühere
  `0x80000003`-Absturz ist weiterhin nicht reproduziert oder als behoben belegt.
- Installer bleibt unsigniert. Zwei Heimnetze, öffentliches TLS/TURN sowie
  native CachyOS-/Wayland-Freigabe sind noch offen.
- Aktuelle Nachweise: [VERIFICATION-20261007.md](VERIFICATION-20261007.md).

Die folgenden Abschnitte beschreiben ältere Prüfstände und ihre Grenzen.

## 0.1.3 — Ton freigeben und geprüfte Installationspakete

- Ein zwischenzeitlicher Versuch, den Windows-Absturz durch erzwungene
  Softwaredarstellung und einen automatischen Neustart zu umgehen, wurde
  verworfen. Dieser Versuch ist kein belegter Fix des ursprünglichen Fehlers.
- Der neu gebaute Installer ist `C8A853ABC6F0CB3912415B33AA96401DE0B2670E6BE122C6460EC52A946DEBA9`.
  Ein direkter Start der entpackten App blieb nach dem sicheren Neustart offen;
  der vollständige Install-/Deinstallationslauf gehört noch zum vorherigen
  Build und wird für diesen Hash nicht als bestanden behauptet.

- Blockierte Tonwiedergabe zeigt einen eigenen, dauerhaften Knopf. Klick oder
  Enter startet einen erneuten Versuch. Verlassen und ersetzte Verbindungen
  entwerten verspätete Antworten; sie können den Hinweis nicht zurückbringen.
- Audio-Regressionsprüfung mit echter lokaler WebRTC-Verbindung: zwei bewusst
  injizierte Ablehnungen, Tastaturbedienung, native Wiedergabe mit fortlaufender
  Medienzeit sowie verspätete Erfüllung/Ablehnung nach Verlassen bestanden.
- Die RTP-Prüfung wartet jetzt ausdrücklich auf ausgewertete Stats. Direkter
  Ablauf und beide echten coturn-Abläufe bestanden, mit empfangenen Audio-Bytes
  und dekodierten Videobildern. Medien ausschließlich synthetisch und stumm.
- Windows: 38 Unit-Tests bestanden, ein Linux-Symlinkfall ausgelassen.
  Ubuntu/WSL: alle 39 bestanden.
- Windows-Installer, Linux-AppImage und tar.gz 0.1.3 gebaut. Je zwei gebaute
  Windows- und Linux-Clients bestehen echten Chat und Neuverbinden, ohne
  Aufnahmegeräte oder künstliche Browser-Berechtigungsfreigaben.
- Der neue Windows-Installer wurde tatsächlich installiert, die installierte
  App-Version/ASAR/Renderer-Isolation geprüft und die Testinstallation wieder
  deinstalliert. Bestehendes Benutzerprofil unverändert; keine Testverknüpfung
  oder Installationsregistrierung blieb zurück. Signatur weiterhin nicht vorhanden.
- Der erste Windows-Desktop-Test scheiterte im eingeschränkten Prozess am
  GPU-Unterprozess. Derselbe unveränderte Test bestand mit normalen Prozessrechten.
- Details: VERIFICATION-0.1.3.md und WINDOWS-INSTALLER-VERIFICATION.md.
- Kein erreichbarer öffentlicher Server vorhanden. Zwei Heimnetze, öffentliche
  TLS-/TURN-Erreichbarkeit, physische Medien und native CachyOS-/Wayland-Auswahl
  bleiben ungetestet. WSL ist kein CachyOS-Nachweis.

Die folgenden Einträge beschreiben frühere Zwischenstände.

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

### Servercheck: Zugangsschutz tatsächlich prüfen

- Der portable Servercheck prüft vor seinem regulären Teilnehmerpaar mit
  einer echten zusätzlichen WebSocket-Verbindung, dass ein falscher
  Raumschlüssel mit Code `4003` abgelehnt wird. Bisher konnte ein Server ohne
  funktionierenden Schlüsselvergleich als authentifiziert erscheinen.
- Die sechs gezielten Tests in `test/remote-server.test.mjs` bestehen mit
  lokalen HTTP-/WebSocket-Servern. Dazu gehören ein Server, der falsche
  Schlüssel akzeptiert, ein stummer Server und ein uneindeutiger Abbruch.
- Kein öffentlicher Server, keine echte Medienaufnahme und keine Änderung
  an Router, DNS oder Hosting wurden dafür benötigt.

### Ausstehende Zielsystemtests

- Physische Mikrofone/Kameras und zwei verschiedene Heimnetze.
- TURN über das öffentliche Internet und öffentlich gültige TLS-Konfiguration.
- CachyOS/Wayland-Portal-Picker und Vollinstallation auf beiden Zielrechnern.

## 19.10.2026 — Einfacher Ersttest und erneute Regression

ERSTTEST.md ergänzt: lokaler Windows-Testserver auf Loopback, zufälliger
Testschlüssel, Zwei-Fenster-Chat und separater Weg zum CachyOS-/Heimnetztest.
Alle 41 ausführbaren Node-Tests bestanden; ein Linux-Symlinktest unter Windows
ausgelassen (42 insgesamt). Der erste Sandbox-Lauf blockierte lokale Verbindungen;
der unveränderte Lauf außerhalb bestand. Keine öffentliche Bereitstellung.


Zusätzlich acht Desktop-Medienschritte mit zwei echten Electron-Prozessen bestanden:
Chat, bidirektionales Audio-RTP, dekodierte Kamera, paralleler Bildschirmstream,
Stop/Rückkehr zur Kamera, Neuverbinden mit Track-Stopp, erneuter Chat/Audio und
Verlassen. Nur synthetische Medien, stumme Ausgabe und getrennte Testprofile.
Keine physischen Aufnahmegeräte und keine Desktopinhalte verwendet.

## 23.10.2026 — lokaler Demo-Server mit einem Startbefehl

Start-Testserver.cmd / npm run demo erzeugt freien Loopbackport und frischen
zufälligen Schlüssel ausschließlich im Speicher. Ignoriert produktive HOST-/
PORT-/ROOM_SECRET-/TURN-Variablen; keine bestehende Konfiguration verändert.
Mit Browser oder vorhandenem Client testbar, ohne neue Clientbinärdatei.
45/45 ausführbare Windows-Node-Checks bestanden; ein Linux-Symlinkcheck wie zuvor
plattformbedingt übersprungen. Neuer Integrationstest verbindet echte WebSockets,
prüft falschen Schlüssel, Signalweitergabe, getrennte Demo-Instanzen und doppeltes
Schließen. Kein neuer Fernverbindungs- oder Mediennachweis.
