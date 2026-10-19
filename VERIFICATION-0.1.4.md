# SofaFunk 0.1.4 — Windows-Diagnose, 19.10.2026

## Änderung

Die App speichert jetzt lokale Lifecycle-Ereignisse und von Electron gemeldete
Renderer-/Unterprozessabbrüche. Ein Bericht über `--diagnose-app` nennt Version,
System und maximal 100 bereinigte Ereignisse. Bekannte Ereignisse, Ursachen und
Prozesstypen werden ausdrücklich zugelassen; beliebige Fehlertexte, URLs,
Umgebungsvariablen und Gesprächsinhalte werden nicht serialisiert. Zwei
rotierende Dateien begrenzen das Protokoll auf zusammen etwa 128 KiB.
Schreibfehler verhindern den Start nicht. Es gibt keinen Upload.

## Nachweise

- 44 ausführbare Node-Tests bestanden; ein Linux-Symlinkfall unter Windows
  ausgelassen (45 insgesamt). Neue Tests prüfen Feldfilter auch beim Lesen,
  beschädigte Zeilen, Rotation, maximal 100 Ereignisse und Dateisystemfehler.
- Echter Electron-Smoke aus dem Quelltext und aus `dist-0.1.4/win-unpacked`
  bestanden. Getrennte Testprofile, isolierter Renderer und Preload geprüft.
  Ein simuliertes `render-process-gone`-Ereignis gelangt mit Ursache und Exitcode
  in das Log; absichtlich mitgegebene private Felder fehlen. Kein echter
  Absturz wurde provoziert. Der separate Diagnose-CLI-Prozess liest die
  Ereignisse einschließlich regulärem Ende und beendet sich mit Exitcode 0.
- Zwei echte Prozesse der **gepackten Version 0.1.4**, Electron 44.4.0,
  bestanden alle acht Desktop-Medienschritte: Chat, bidirektionales Audio-RTP,
  dekodierte Kamera, paralleler Screen-Stream, Stop/Rückkehr zur Kamera,
  Track-Stopp bei Neuverbindung, erneuter Chat/Audio und Verlassen.
  Ausschließlich erzeugte Medien, stumme Ausgabe, keine physischen Geräte
  und keine Desktopinhalte. Ergebnisse in
  `test-results/0.1.4-packaged-media/desktop-media-results.json`.
- Windows-NSIS-Installer neu in separatem Ordner gebaut. SHA256:
  `64FBEECF722EB3CDC0F2FB6C750084B8733BA22DD41195609D930BE9255C3E64`.
  Dateiname: `SofaFunk Setup 0.1.4.exe`. Authenticode-Status: `NotSigned`.

Die Windows-Sandbox blockierte Loopback und Dateiumbenennungen. Die genannten
erfolgreichen Tests liefen mit normalen lokalen Prozessrechten.

## Grenzen

Der alte Windows-Absturz ist nicht reproduziert und nicht als behoben belegt.
Ein harter Hauptprozessabbruch kann ohne abschließenden Logeintrag bleiben.
Der Installer wurde gebaut; ein erneuter vollständiger Installations- und
Deinstallationslauf von 0.1.4 wurde nicht durchgeführt. Die Laufzeittests
betreffen seine gepackte App im `win-unpacked`-Ordner.
Kein neues Linux-Paket gebaut, kein CachyOS-/Wayland-Test, kein öffentlicher
TLS-/TURN-Server und kein Test zwischen zwei Heimnetzen. Frühere Artefakte
bleiben erhalten. Kein neuer GitHub-Release veröffentlicht.
