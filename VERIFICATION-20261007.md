# Windows-Build vom 07.10.2026

Frischer Installer aus Quellstand 562930a, Ausgabe dist-oct07.
SofaFunk Setup 0.1.3.exe: 111425488 Bytes.
SHA256: 9AA360B50509F1C295C4BEFD10D7CC9061052D0CAA4DF86841227D79D5F0B302

Die entpackte App dieses Builds besteht den normalen Electron-Fenstertest:
Fenster geladen, Preload verfügbar, Node-Integration im Renderer aus.
Separates Testprofil, keine Kamera oder Mikrofone geöffnet. Außerhalb der Sandbox.
40 Unit-Tests bestanden, ein Linux-spezifischer Test ausgelassen.

## Vollständiger Installerlauf

Am 07.10.2026 um 12:38:54–12:39:09 UTC bestand dieser exakte Installer einen
echten Installationslauf auf Windows 11. Der Kollisionsschutz fand keine
vorhandene Installation, Verknüpfungen, Registrierung oder laufende App.
Die stille Installation erfolgte in einen neu angelegten Testordner.

- Installer und nativer Uninstaller: Exitcode 0.
- Installierte App meldet Version 0.1.3 und lädt die installierte `app.asar`.
- Eigenes Testprofil, Preload vorhanden, Node-Integration aus,
  Context Isolation und Renderer-Sandbox eingeschaltet.
- Testverknüpfungen, Registrierung, Installationsordner und ausschließlich die
  per Hash identifizierte Installer-Cachekopie nachher entfernt.
- Metadaten des vorhandenen Benutzerprofils mit 68 Einträgen identisch.
  Profilinhalte wurden nicht gelesen, kein Aufnahmegerät angefragt.

Der Installer ist weiterhin **nicht signiert** (`NotSigned`). Ein Upgrade einer
vorhandenen Installation und der interaktive Installationsdialog wurden nicht
geprüft. Der reproduzierbare Ablauf steht in
[WINDOWS-INSTALLER-VERIFICATION.md](WINDOWS-INSTALLER-VERIFICATION.md).

## Gebaute Desktop-App: Chat und Medien

Die zum frischen Installer gehörende entpackte App besteht jetzt zusätzlich
zwei Tests mit jeweils zwei getrennten Profilen:

1. `test:desktop-rtc`: echter bidirektionaler Chat, direkter ICE-Weg und
   Neuverbinden; alle Aufnahmefunktionen bleiben aus.
2. `test:desktop-media`: acht Schritte mit ausschließlich erzeugten Quellen.
   Audio erreicht beide Richtungen über echte RTP-Pakete; das Kamera-Video
   wird im anderen Desktop dekodiert. Ein separat erzeugter Bildschirmstream
   wird parallel übertragen; Beenden stellt die weiterhin laufende Kamera
   wieder dar. Neuverbinden beendet sämtliche Tracks auf beiden Clients,
   anschließend funktionieren Chat und erneut eingeschaltetes Audio. Verlassen
   beendet auch die neuen Tracks.

Der neue Test ersetzt `getUserMedia` und `getDisplayMedia` vollständig durch
AudioContext-/Canvas-Generatoren, bevor ein Raum betreten wird. Keine
ursprüngliche Capture-Funktion wird aufgerufen, kein Gerätezugriff freigegeben.
Desktop-Audioausgabe ist stumm. Die eigentliche WebRTC-Verbindung und
Videodekodierung laufen unverändert in zwei echten Electron-Prozessen.

Gemessene erste Empfangsschwellen: Audio 855 Bytes/12 Pakete in jeder Richtung;
Kamera 3.472 Bytes/12 Pakete und ein dekodiertes Bild; nach Wiederverbindung
Audio 797 Bytes/11 Pakete. Kein Renderer-JavaScript-Fehler. Runtime jeweils
Electron 44.4.0 / Chromium 152.0.7977.78; App-Version 0.1.3, `packaged: true`.

Ergebnisdateien im Workspace unter `outputs/discord-alternative/20261007-complete/`:
`installer/installer.json`, `installer/smoke.json`,
`desktop-rtc/desktop-rtc-results.json` und `desktop-media/desktop-media-results.json`.
Testprofilordner gehören nicht in Veröffentlichungen.

## Grenzen

Der ursprüngliche Screenshot-Absturz ist nicht reproduziert und deshalb nicht
als behoben bestätigt. Beide Clients und Server liefen auf demselben Rechner.
Öffentlicher Server, zwei Heimnetze, physische Medien und der native
CachyOS-/Wayland-Picker bleiben offen. Alte Build-Hashes in
VERIFICATION-0.1.3.md gehören zu älteren Paketen.
