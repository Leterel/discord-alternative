# SofaFunk zum ersten Mal ausprobieren

## Auf diesem Windows-PC, ohne öffentlichen Server

1. Den Windows-Installer aus dem [Release 0.1.3](https://github.com/Leterel/discord-alternative/releases/tag/v0.1.3) installieren: `SofaFunk Setup 0.1.3-fresh-20261007.exe`.
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

Den genauen Zeitpunkt, die ausgeführte Aktion, Windows-Version und Paketnamen
notieren. Fehlermeldung ohne Schlüssel oder Gesprächsinhalte festhalten.
Der früher gemeldete Absturz ist weiterhin nicht nachweislich behoben.
Ein erfolgreicher lokaler Test darf nicht als Beweis dafür gelten.
