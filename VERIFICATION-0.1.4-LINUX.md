# SofaFunk 0.1.4 — Linux-Paket und Laufzeit, 21.10.2026

## Umgebung

Ubuntu 24.04.4 unter WSL2, x64, Kernel 6.18.33.2, vorhandenes portables
Node.js 24.21.0, Electron 44.4.0 / Chromium 152.0.7977.78. Quellenstand vor dem
Build: `0f4c49121002a44fac741bdf2bc6b49c98f9e7bc`.

Windows-`node_modules` wurden nicht geändert. Der getrennte bestehende Linux-
Buildordner und dessen Linux-Abhängigkeiten, Electron-/Builder-Caches sowie
bereits vorhandene portable NSS/ALSA-Bibliotheken wurden verwendet. Keine
Ubuntu-Systempakete installiert, keine Desktop-Dienste gestartet oder geändert.
Die portablen Bibliotheken waren nur über das Prozess-`LD_LIBRARY_PATH` sichtbar.

## Bestandene Prüfungen

- **45/45 Node-Tests**, kein ausgelassener Fall. Der unter Windows ausgelassene
  Linux-Symlinkfall lief hier tatsächlich.
- Gepackte `linux-unpacked/sofa-funk`: Fenster, Preload-Brücke, ausgeschaltete
  Node-Integration im Renderer sowie bereinigte Lifecycle-/Crashdiagnose und
  Diagnose-CLI bestanden. Eine Crashmeldung wurde synthetisch injiziert; kein
  echter Absturz provoziert.
- Zwei echte Prozesse der gepackten Version **0.1.4** bestanden alle acht
  Desktop-Medienschritte: bidirektionaler Chat/Audio-RTP, dekodiertes Kameravideo,
  paralleler Screen-Stream, Stop/Rückkehr zur Kamera, Track-Stopp bei Reconnect,
  erneut Chat/Audio und Verlassen. JSON enthält tatsächliche RTP-Empfangsbytes
  und dekodierte Frames, `app.isPackaged: true` und die Laufzeitversionen.
- Ausschließlich Canvas-Video und Oszillator-Audio, stumme Desktopausgabe,
  getrennte Testprofile und eigener Xvfb-Server. `WAYLAND_DISPLAY` wurde für diese
  Prozesse entfernt und die Sitzung als X11 gesetzt. Keine physische Kamera,
  Mikrofonaufnahme oder Aufnahme fremder Desktopinhalte.
- Das fertige tar.gz wurde in einen eigenen Prüfunterordner entpackt. Zwei
  Prozesse aus genau dieser Auslieferung bestanden anschließend ebenfalls alle
  acht RTC-Medienschritte. Ihre ASAR stimmt per SHA256 mit `linux-unpacked` überein.
- Die fertige AppImage wurde ohne FUSE mit `APPIMAGE_EXTRACT_AND_RUN=1` direkt
  gestartet: Fenster, Preload und Renderer-Isolation bestanden. Die Diagnose-CLI
  wurde über separat extrahierten AppImage-Payload geprüft; der Test vergleicht
  dessen ASAR-Hash mit der tatsächlich laufenden AppImage vor dem Schließen.
  Dadurch bleibt die JSON-Prüfung strikt und die getestete Payload nachweisbar.

## Auslieferung und SHA256

| Datei | SHA256 |
| --- | --- |
| `SofaFunk-0.1.4.AppImage` | `7babb296ccd868b7bd7bcfeb3c13bbdc8cd008e24f7859518a0e8b7cd0b1d89b` |
| `sofa-funk-0.1.4.tar.gz` | `3b27452302fca3e026580662815d3248776b7c23555d5d4c3f3abed2ce4251d4` |

Die bestehenden älteren Pakete wurden beibehalten. Kein neuer GitHub-Release.

## Reproduktion

Auf einem vorbereiteten Linux-Desktop mit Node und Projektabhängigkeiten:

```sh
npm test
npm run dist:linux -- --publish never
TEST_DESKTOP_EXE="$PWD/dist/linux-unpacked/sofa-funk" npm run test:desktop
TEST_DESKTOP_EXE="$PWD/dist/linux-unpacked/sofa-funk" npm run test:desktop-media
```

Die lokale WSL-Prüfung verwendete vorhandene Linux-Abhängigkeiten ohne erneutes
`npm ci`. Gebaut wurde mit `--config.npmRebuild=false` in `dist-0.1.4`; die
synthetischen Tests liefen über `xvfb-run -a`, ohne WSLg-Fenster zu verwenden.
Die tatsächlichen Build-/Testprotokolle und das Medien-JSON liegen beim lokalen
Lieferpaket. Persönliche Testprofile werden nicht ausgeliefert.

AppImage ohne FUSE starten:

```sh
chmod +x SofaFunk-0.1.4.AppImage
APPIMAGE_EXTRACT_AND_RUN=1 ./SofaFunk-0.1.4.AppImage
```

AppImageKit mischt bei dieser Extraktionsart Dateilisten teilweise mitten in
stdout. Deshalb ist `--diagnose-app` direkt über diesen Wrapper nicht als reines
JSON parsebar. Statt beliebige Vorlogs herauszufiltern, kann die Payload einmal
über `--appimage-extract` entpackt und danach
`./squashfs-root/sofa-funk --diagnose-app` verwendet werden. Der Smoke-Test bietet
für genau diesen Fall `TEST_DIAGNOSTIC_EXE`; er akzeptiert das nur bei laufender
AppImage und identischer ASAR. Normale Binärstarts behalten striktes JSON-Parsing.

## Grenzen

Dies ist Ubuntu/WSL mit künstlichem X11-Server, **kein CachyOS-, Wayland- oder
Portal-Picker-Nachweis**. Beide Clients und Signalisierung liefen auf einem
Rechner. Öffentliche TLS-/TURN-Erreichbarkeit, zwei Heimnetze, physische Medien,
vollständige Desktopinstallation und der frühere Windows-Absturz bleiben offen.
Der native FUSE-Mountpfad wurde nicht geprüft; getestet ist der Extraktionsmodus.
Die Linux-Pakete sind unsigniert. Keine neue Veröffentlichung als GitHub-Release.
