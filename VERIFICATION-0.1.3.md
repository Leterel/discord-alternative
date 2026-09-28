# SofaFunk 0.1.3 — Prüfung am 28.09.2026

## Änderung

Wenn `play()` für eingehenden Ton scheitert, zeigt die App **Ton freigeben**
als eigenen Hinweis. Er bleibt auch dann sichtbar, wenn eine Statusmeldung
danach die erfolgreiche Verbindung meldet. Klick oder Enter versucht die
Wiedergabe erneut. Ausstehende Antworten werden gegen Verbindung, Stream und
Versuch geprüft; Verlassen entfernt den Hinweis dauerhaft.

Die Version enthält außerdem das lokale Werkzeug `deploy/configure.mjs` für
die Servervorbereitung. Es erzeugt unabhängige Schlüssel, prüft Adressen und
überschreibt keine vorhandene Konfiguration. Es stellt keinen Server bereit.

Unter Windows startet die App bei problematischer Chromium-GPU-Umgebung einmal
mit erzwungenem Software-Compositing neu. Dadurch wird der GPU-DLL-Abbruch aus
dem ursprünglichen Screenshot umgangen; der neue Prozess läuft mit Exit-Code 0
und bleibt geöffnet. Dieser direkte Starttest wurde mit einem separaten Profil
aus der entpackten 0.1.3-App ausgeführt. Der Playwright-Smoke-Test, der den
ersten Launcherprozess selbst überwacht, sieht diesen absichtlichen Neustart
als Prozesswechsel und ist dafür kein passender Nachweis.

## Tatsächlich geprüft

| Prüfung | Ergebnis |
| --- | --- |
| Windows Unit-Tests | 38 bestanden; Linux-Symlinkfall ausgelassen |
| Ubuntu/WSL Unit-Tests | 39/39 bestanden, einschließlich Dateimodus 600 und Symlinkschutz |
| Audio-Recovery im Chromium-Browser | Sechs Schritte bestanden: zwei abgelehnte Versuche, Enter, native Wiedergabe, Leave und beide verspäteten Promise-Ausgänge |
| Direkte WebRTC-Verbindung | Chat in beide Richtungen, Audio-RTP, Kamera-Decoding, synthetischer Screen, Stop, Leave, Rejoin und Reconnect bestanden |
| Echter lokaler coturn | Beide ICE-Paare relay/relay; Medien und Chat übertragen, Reconnect bestanden |
| Externer Clientmodus gegen separaten lokalen Server | Server-Check plus echte coturn-Übertragung bestanden |
| Zwei gebaute Windows-Clients | Echter bidirektionaler Chat, direkter ICE-Weg und Neuverbinden bestanden |
| Zwei gebaute Linux-Clients unter Ubuntu/WSL | Derselbe Desktop-Ablauf bestanden |
| Windows-Installer 0.1.3 | Installieren, installierte App starten/prüfen, deinstallieren bestanden |
| Linux-Pakete | AppImage und tar.gz gebaut; entpackte Linux-Binary gestartet/geprüft |

Die Browser-Medientests verwenden nur synthetische Mikrofon-, Kamera- und
Screen-Quellen; Audioausgabe ist stumm. Beim Recovery-Test werden zwei
`NotAllowedError`-Antworten absichtlich injiziert. Automatisches Abspielen per
HTML-Attribut ist auf dem Empfänger deaktiviert, damit es den Test nicht umgeht.
Der erfolgreiche dritte Versuch ruft das echte Chromium-`play()` auf. Ein
`playing`-Ereignis, nicht pausierter Zustand und fortschreitende Medienzeit
belegen die Wiedergabe. Das ist kein Nachweis, dass die natürliche
Autoplay-Richtlinie genau diesen Ablauf auf jedem Rechner erzeugt.

Die RTP-Prüfung wartet ausdrücklich auf ausgewertete `getStats()`-Ergebnisse:
mehr als 500 empfangene Bytes pro geprüftem Stream und bei Kamera-Video
mindestens ein dekodiertes Bild. Der Screen-Test prüft zusätzlich die
erwarteten Videomaße; der Relay-Test speichert die gewählten Kandidatenpaare
und eingehenden RTP-Statistiken.

Desktop-Tests haben separate Testprofile und öffnen keine Aufnahmegeräte.
Der erste Windows-Test im eingeschränkten Prozess scheiterte beim Laden von
GPU-Unterprozessen. Derselbe Test mit normalen Prozessrechten bestand ohne
Codeänderung. Der erfolgreiche Installer-Test verwendete ebenfalls normale
Windows-Prozessrechte. Details: [Installer-Prüfung](WINDOWS-INSTALLER-VERIFICATION.md).

## Downloads und Prüfsummen

| Datei | Bytes | SHA-256 |
| --- | ---: | --- |
| SofaFunk Setup 0.1.3.exe | 111508761 | `c8a853abc6f0cb3912415b33aa96401de0b2670e6be122c6460ec52a946deba9` |
| SofaFunk-0.1.3.AppImage | 125002111 | `91e39a8b31ba85a0719a2d4306d4921862d58a9026788fcc8fa047c9ec317818` |
| sofa-funk-0.1.3.tar.gz | 118917342 | `59cd1138783cd7ab33e5636894c941d6ccb8f9c2bfb2caa38a045e7f4fbcf4e6` |

Windows-Installer: x64 NSIS, **nicht signiert** (`NotSigned` geprüft). Dieser
Build enthält den GPU-Startfix; der vorherige Installer-Beleg gehört zum
Quellstand vor diesem Fix.
Linux: x64, unter Ubuntu/WSL gebaut. Der tatsächliche Start des AppImage-Launchers
auf CachyOS ist nicht belegt; getestet wurde die gebaute Linux-Binary.

Im Verification-ZIP stehen ausgewählte JSON-Ergebnisse und Bilder ausschließlich
der App-Fenster. Keine Browser-/App-Profilordner, Zugangsdaten oder coturn-Logs
sind darin enthalten. Der fehlgeschlagene eingeschränkte Windows-Start bleibt
lokal separat erhalten und wird nicht als bestandener Test gezählt.

## Wiederholen

Mit installierten Abhängigkeiten im Repository:

```sh
npm test
node test/audio-recovery.mjs
npm run test:e2e
npm run test:desktop-rtc
```

`TEST_CHROME` wählt ein vorhandenes Chromium. `TEST_OUTPUT_DIR` wählt einen
eigenen Ergebnisordner. Für gebaute Desktop-Tests `TEST_DESKTOP_EXE` auf die
entpackte Windows-EXE oder Linux-Binary setzen. Unter Linux mit coturn:
`bash test/turn-relay.sh` und `bash test/turn-relay.sh --external`.
Für den Installerlauf beide erwarteten Werte an `test/windows-installer.ps1`
übergeben: `-ExpectedVersion 0.1.3 -ExpectedSHA256 <Hash aus der Tabelle>`.
Das Skript verweigert vorhandene Installationen, Profile verwendet es getrennt.

## Weiter offen

Ein öffentlicher Server fehlt weiterhin. Kein Test zwischen zwei echten
Heimnetzen, kein öffentliches TLS/TURN und keine physische Kamera-/Mikrofonprüfung.
Native CachyOS-/Wayland-Bildschirmwahl sowie Systemaudio-Freigabe sind nicht
nachgewiesen; Systemaudio ist keine implementierte Funktion. Ubuntu/WSL ersetzt
keinen CachyOS-Test. Der Docker-Stack wurde vorbereitet, aber nicht erfolgreich
auf einem erreichbaren Server gestartet. Es wurden keine Dienste gebucht.
