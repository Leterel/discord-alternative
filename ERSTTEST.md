# SofaFunk zum ersten Mal ausprobieren

## Schnellstart ohne Umgebungsvariablen

Im Quellordner einmal `npm ci --omit=dev` ausführen (nur falls Abhängigkeiten
fehlen), dann `Start-Testserver.cmd` öffnen. Das Terminal nennt einen freien
lokalen Port und einen neuen Testschlüssel. Zwei Browserfenster mit der genannten
Browseradresse öffnen, die Werte mit verschiedenen Namen eintragen und Text
in beide Richtungen senden. Keine Medienfreigabe dafür nötig. Für die installierte
App die angezeigte WebSocket-Adresse verwenden. Strg+C beendet den Server.
Nur derselbe PC; jeder Start bekommt einen neuen Schlüssel. Vorhandene produktive
Servervariablen werden ignoriert. Die folgenden manuellen Varianten bleiben möglich.
## Auf diesem Windows-PC, ohne öffentlichen Server

1. Den neu bereitgestellten Windows-Installer `SofaFunk Setup 0.1.4.exe` installieren. Der ältere [Release 0.1.3](https://github.com/Leterel/discord-alternative/releases/tag/v0.1.3) enthält die neue Diagnose noch nicht.
2. In diesem Repository mit installiertem Node.js 24 einmal `npm ci` ausführen, falls die Abhängigkeiten fehlen.
3. In PowerShell einen nur lokal erreichbaren Testserver starten:

```powershell
$env:HOST = '127.0.0.1'
$env:PORT = '8787'
$env:ROOM_SECRET = [guid]::NewGuid().ToString('N')
Remove-Item Env:TURN_URLS, Env:TURN_SECRET -ErrorAction SilentlyContinue
$env:ROOM_SECRET
npm run server
```

Der ausgegebene zufällige Schlüssel ist nur für diesen lokalen Test. Nicht veröffentlichen.
Das Terminal offen lassen. In SofaFunk `ws://127.0.0.1:8787`, einen frei gewählten
Raumnamen und diesen Schlüssel eintragen. Mit „Rein da“ muss die App den Raum betreten.
Ein zweites App-Fenster kann mit demselben Raum und Schlüssel beitreten.
Falls die installierte App kein weiteres Fenster öffnet, im Repository in einem
zweiten Terminal `npm start` ausführen. Text in beide Richtungen senden.

Erwartet: Beide Teilnehmer sehen die Nachrichten. Beim Verlassen verschwindet der
Teilnehmer. Neuverbinden muss wieder funktionieren. Mikrofon, Kamera und Teilen
nur bewusst für den eigenen manuellen Test einschalten. Bei zwei Fenstern auf
einem PC können Lautsprecher Rückkopplung erzeugen; Kopfhörer verwenden.

Server mit Strg+C stoppen, dann `Remove-Item Env:ROOM_SECRET` ausführen.
Das beweist noch keine Verbindung zum Kollegen oder Funktion auf CachyOS.

## Mit dem Kollegen auf CachyOS

Hierfür fehlt noch ein erreichbarer öffentlicher HTTPS/WSS- und TURN-Server.
`127.0.0.1` verweist beim Kollegen auf seinen eigenen Rechner.
Nach Einrichtung nach [SERVER.md](SERVER.md) zunächst von beiden Netzen
[SERVER-CHECK.md](SERVER-CHECK.md) ausführen. Dann dieselbe WSS-Adresse,
denselben Raum und denselben privat geteilten Schlüssel verwenden.

Linux-Paket und Startbefehl: [README.md](README.md). Vor Bildschirmfreigabe
[LINUX-SCREENSHARING.md](LINUX-SCREENSHARING.md) beachten. Text, Ton, Kamera,
Teilen, Abbrechen, erneut Teilen und Neuverbinden jeweils beidseitig testen.
Die bisherigen Ubuntu/WSL-Belege ersetzen diesen CachyOS-/Wayland-Test nicht.

## Wenn die Windows-App abstürzt

Version 0.1.4 protokolliert Start, Bereitschaft, reguläres Ende und
von Electron gemeldete Renderer-/GPU-Abstürze automatisch im App-Profil.
Das Protokoll enthält ausschließlich Zeitpunkt, Ereignistyp, bekannte
Absturzursache, Prozesstyp und Exitcode. Keine Raumschlüssel, Nachrichten,
Serveradressen, Aufnahmen oder Fehlertexte werden gespeichert. Es bleibt lokal;
es gibt keinen automatischen Upload. Zwei Dateien mit jeweils etwa 64 KiB
begrenzen die Speicherung. Nicht schreibbare Protokollordner verhindern den
App-Start nicht.

Nach dem Beenden im Repository mit PowerShell den Bericht erzeugen:

```powershell
npm run --silent check:app > sofa-diagnose.json
```

Der Bericht zeigt die letzten maximal 100 Ereignisse, App-/Electron-Version,
Betriebssystemversion und Architektur. Für eine neu gebaute installierte App
denselben Schalter an die EXE anhängen:

```powershell
& 'C:\Pfad\zu\SofaFunk.exe' --diagnose-app > sofa-diagnose.json
```

Der alte veröffentlichte Installer 0.1.3 enthält diese neue Diagnose noch nicht.
Ein eigener `--user-data-dir` muss beim Diagnoseaufruf erneut angegeben werden,
sonst wird das normale App-Profil ausgewertet. Die Diagnose öffnet kein Fenster
und verändert bestehende Ereignisse nicht. Den Bericht vor dem Teilen prüfen;
Zeitpunkte und Systemversion sind enthalten. Unter Linux genauso das AppImage
mit `--diagnose-app` aufrufen.

Zusätzlich den genauen Zeitpunkt und die ausgeführte Aktion notieren.
Ein harter Abbruch des Hauptprozesses kann ohne abschließendes Ereignis bleiben;
der Bericht ersetzt deshalb keine Windows-Ereignisanzeige oder Speicheranalyse.
Der früher gemeldete Absturz ist weiterhin nicht nachweislich behoben.
Ein erfolgreicher lokaler Test darf nicht als Beweis dafür gelten.

