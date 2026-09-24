# Bildschirmfreigabe auf CachyOS / Wayland

## Voraussetzungen ohne Aufnahme pruefen

Im Terminal **der normalen grafischen Sitzung**, als derselbe Benutzer wie
SofaFunk, starten (nicht mit sudo und nicht ueber eine SSH-Sitzung):

```sh
./SofaFunk-0.1.2.AppImage --diagnose-linux
# Alternativ mit dem entpackten Linux-Paket:
./sofa-funk --diagnose-linux
# Aus dem Quellcode; Node >= 22.12 erforderlich:
bash scripts/check-cachyos.sh
```

Die Diagnose liest Wayland-Umgebungsmerkmale, das Vorhandensein des
PipeWire-Sockets, installierte ScreenCast-Backend-Beschreibungen und die
Eigenschaften des bereits laufenden Desktop-Portals. Sie startet keine
Dienste und nimmt kein Bild, Mikrofon oder Kamera auf. Der Bericht enthaelt
keine Fenster-/Geraetenamen, privaten Pfade oder Zugangsdaten.

- `prerequisites-present` / Exitcode 0: benoetigte Merkmale sind vorhanden.
  Das bestaetigt **noch keine funktionierende Bildschirmuebertragung**.
- `needs-attention` / Exitcode 2: ein Check fehlt oder war nicht moeglich.
  `checks[].detail` nennt den naechsten Ansatz.
- `portal.window: false`: das Portal bietet keine einzelnen Fenster an;
  die vom Desktop angebotene Bildschirmfreigabe kann trotzdem funktionieren.

Auf CachyOS gehoeren PipeWire, `xdg-desktop-portal`, `busctl` (systemd) und
ein zum Desktop passendes ScreenCast-Backend dazu. Beispiele: Plasma/KDE
nutzt `xdg-desktop-portal-kde`, GNOME `xdg-desktop-portal-gnome`, Hyprland
`xdg-desktop-portal-hyprland`, Sway `xdg-desktop-portal-wlr`. Installierte
Backend-Dateien allein beweisen nicht, dass das richtige Backend aktiv ist.
Fehlt der Check, zuerst in der Paketverwaltung und Sitzungs-Konfiguration
des verwendeten Desktops nachsehen. Die Diagnose aendert diese nicht.

## Kurzer echter Funktionstest mit dem Kollegen

1. Beide oeffnen SofaFunk und treten demselben Server/Raum bei. Chat testen.
2. Auf Linux ein Testfenster mit unkritischem Inhalt oeffnen, z.B. ein leeres
   Dokument mit einer laufenden Uhr. Im SofaFunk-Fenster **Bildschirm** druecken.
3. Im Portal zuerst **Abbrechen**. Es darf kein Bild beim Kollegen erscheinen;
   danach muss ein zweiter Versuch moeglich sein.
4. Erneut **Bildschirm** druecken und bewusst nur das Testfenster waehlen.
   Falls das Portal nur Monitore unterstuetzt: vor dem Test alle persoenlichen
   Inhalte vom gewaehlten Monitor entfernen. Bei Mehrfachauswahl im
   SofaFunk-Dialog ebenfalls bewusst die Quelle waehlen.
5. Der Kollege prueft, dass sich das uebertragene Testbild tatsaechlich aendert.
   Mikrofon/Kamera duerfen parallel funktionieren; Bildschirmton ist in
   diesem Prototyp nicht vorgesehen.
6. **Bildschirm aus** bzw. die Stop-Schaltflaeche des Portals betaetigen.
   Das Bild beim Kollegen muss enden. Freigabe erneut starten und danach
   **Verlassen** druecken: die Aufnahme muss ebenfalls enden.
7. Fuer das Ergebnis Betriebssystem, Desktop, Paketversion, Diagnose-JSON und
   Erfolg/Fehler dieser Schritte festhalten; keine privaten Screenshots noetig.

## Stand der Pruefung (23.09.2026)

- Capture-Handler automatisiert geprueft: native Auswahl, Abbruch ohne Quelle,
  Zeitlimit/verspaetete Antwort, verlassenes Fenster, falscher Frame und
  mehrere Quellen trotz Wayland-Umgebung.
- Linux-Diagnose mit erreichbaren, fehlenden, eingeschraenkten und fehlerhaften
  Portalantworten automatisiert geprueft. Es sind Tests der Diagnose und
  Zustandslogik, **kein echter CachyOS-Portaltest**.
- Browser-Regressionspruefung der echten App mit zwei WebRTC-Teilnehmern:
  fehlgeschlagene Freigabe schliesst den Auswahldialog; erneuter Versuch,
  Abbruch und Verlassen durch den Kollegen funktionieren. Nur die fehlschlagende
  Aufnahme-Anfrage wird im Test ersetzt, kein Desktop aufgenommen.
  Aufruf: `node test/picker-ui.mjs` (Playwright-Chromium oder `TEST_CHROME`).
- Vorhandenes Ubuntu/WSL hat einen Wayland-Socket, aber keine installierten
  ScreenCast-Portale/Backends und kein PipeWire-Paket. Dort ist daher kein
  gueltiger Portal-/Picker-Test moeglich. Keine Desktop-Dienste nachinstalliert
  oder gestartet und keine private Desktopaufnahme vorgenommen.
- Die gebaute Linux-App 0.1.1 wurde dort mit `--diagnose-linux` ausgefuehrt:
  Exitcode 2, `needs-attention`, Wayland erkannt, PipeWire/Portal fehlen,
  `captureTested: false`. Diagnose und normales App-Fenster funktionieren.
- CachyOS, sein echter Portal-Picker und die Uebertragung aus zwei Heimnetzen
  bleiben am Zielrechner zu pruefen.

## Technische Grundlage

Electron verwendet seit Version 38 in einer Wayland-Sitzung standardmaessig
den nativen Wayland-Modus. `--ozone-platform=x11` erzwingt dagegen XWayland;
die alte Variable `ELECTRON_OZONE_PLATFORM_HINT` wird nicht mehr verwendet.
[Electron: Breaking changes](https://www.electronjs.org/docs/latest/breaking-changes)

PipeWire liefert Electron nach der Portal-Auswahl nur eine Quelle. SofaFunk
uebernimmt diese; bei mehreren Quellen wird immer der eigene Auswahldialog
gezeigt. Die Option `useSystemPicker` betrifft derzeit macOS, nicht den
Linux-Portalweg. Electron stellt fuer eine laufende `getSources`-Anfrage
keine Abbruch-API bereit: nach Verlassen/Timeout wird jede verspaetete Antwort
verworfen; ein eventuell noch sichtbarer Portal-Dialog muss geschlossen werden.
[Electron: desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer),
[Electron: session](https://www.electronjs.org/docs/latest/api/session)

Die Diagnose liest nur `version` und `AvailableSourceTypes`; die Methoden zum
Anlegen einer Aufnahme werden nicht aufgerufen.
[XDG Desktop Portal: ScreenCast](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.ScreenCast.html)
