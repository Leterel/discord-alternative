# SofaFunk selbst hosten

Der mitgelieferte Aufbau verbindet zwei Clients über einen eigenen Linux-Server:

```text
Windows / CachyOS  -- WSS :443 -->  Caddy  -->  Signalisierung :8787
       |                                            |
       +---- verschlüsselte direkte WebRTC-Verbindung ---+
       +---- falls nötig über coturn :3478 / Relay-Ports
```

Die Signalisierung tauscht Verbindungsdaten aus. Chat, Audio und Video laufen
über WebRTC, direkt oder über TURN als Vermittler. TURN transportiert dabei
verschlüsselte WebRTC-Nutzdaten; IP-Adressen und Verbindungsmetadaten bleiben
für Serverbetreiber sichtbar. Beide müssen dem Signalisierungsserver vertrauen:
eine unabhängige Identitätsprüfung des Gesprächspartners gibt es noch nicht.

## Voraussetzungen

- Linux-Server mit Docker Engine und Docker Compose v2 oder neuer. Dieses
  Rezept nutzt für coturn Linux-Host-Networking; es ist **kein getestetes
  Docker-Desktop-Rezept für den Windows-PC**.
- Eine erreichbare öffentliche IPv4-Adresse und zwei DNS-A-Einträge, etwa
  `sofa.example.net` und `turn.example.net`, auf diese Adresse. Hinter NAT
  müssen die unten genannten Ports 1:1 weitergeleitet werden. Ein Anschluss
  hinter CGNAT genügt dafür nicht ohne zusätzliche öffentlich erreichbare
  Infrastruktur. Veraltete AAAA-Einträge entfernen, wenn IPv6 nicht eingerichtet ist.
- Freie TCP-Ports 80 und 443 für Caddy sowie die TURN-Ports aus der Tabelle.
- Zugang zum vollständigen Repository auf dem Server. Die Docker-Builddatei
  installiert nur Produktionsabhängigkeiten, keine Electron-Binaries.

Ein vorhandener Server kann genutzt werden. Es wurde weder ein Server gemietet
noch eine Domain gekauft. TURN verursacht je nach Nutzung ausgehenden Traffic;
Kosten und Anbieterlimits vor dem Betrieb prüfen.

## Einmal einrichten

### Gefuehrte Einrichtung (empfohlen)

Mit Node.js 22.12+ im Repository auf dem Linux-Server:

```bash
node deploy/configure.mjs
node deploy/configure.mjs --check
cd deploy
docker compose config --quiet
docker compose up -d --build
```

Das Werkzeug fragt Domains, Zertifikats-E-Mail und Server-IPv4 ab. Zwei
unterschiedliche Zufallsschluessel werden direkt in `deploy/.env` gespeichert;
sie erscheinen nicht im Terminal. Auf Linux erhaelt die neue Datei Modus 600.
Eine vorhandene Datei wird niemals ueberschrieben. `--check` liest sie nur.
Die Datei verwendet einfache `KEY=VALUE`-Zeilen ohne Anfuehrungszeichen;
der Raumschluessel braucht 32–128 Buchstaben/Ziffern/Unterstriche/Bindestriche.
Zwei getrennte, automatisch erzeugte 64-stellige Hex-Schluessel erfuellen das.

Beispieldomains/-IPs, private oeffentliche IPs, Steuerzeichen, doppelte Felder
und unsichere Schluessel werden abgelehnt. Der Check bestaetigt nur die lokale
Konfiguration, **keine** DNS-Aufloesung, Portfreigabe, TLS- oder TURN-Verbindung.
Er startet keinen Dienst und bucht nichts. Auf Windows gilt die Ordner-ACL;
fuer die Serverdatei daher das Werkzeug direkt unter Linux ausfuehren.

### Manuelle Alternative

Im geklonten Repository auf dem **Linux-Server**:

```bash
cd deploy
umask 077
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
```

Die beiden Ausgaben sind unterschiedliche Zufallswerte. In `.env` eintragen:

| Variable | Inhalt |
| --- | --- |
| `SOFA_DOMAIN` | DNS-Name für App und Signalisierung, ohne `https://` |
| `TURN_DOMAIN` | DNS-Name des TURN-Servers, ohne `turn:` |
| `ACME_EMAIL` | Eigene E-Mail-Adresse für Zertifikatsverwaltung |
| `ROOM_SECRET` | Erster Zufallswert; nur diesen Schlüssel mit dem Kollegen teilen |
| `TURN_SECRET` | Zweiter Zufallswert; ausschließlich auf dem Server behalten |
| `TURN_PUBLIC_IP` | Öffentliche IPv4-Adresse des Servers |
| `TURN_LISTEN_IP` | IPv4-Adresse seiner lokalen Netzwerkschnittstelle |

Ohne vorgeschaltetes NAT sind beide IP-Werte gleich. Hinter 1:1 NAT ist
`TURN_LISTEN_IP` die private Adresse des Servers. `203.0.113.10` und
`example.net` in der Vorlage sind Dokumentationswerte und müssen ersetzt werden.
Für dieses Rezept muss `TURN_SECRET` genau 64 Hex-Zeichen haben.

```bash
chmod 600 .env
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Nur `config --quiet` verwenden, wenn Ausgaben weitergegeben werden: die normale
`config`-Ausgabe enthält die aufgelösten Geheimnisse. `.env` ist von Git und
vom Docker-Buildkontext ausgeschlossen. Docker-/Serveradministratoren können
Container-Umgebungsvariablen dennoch lesen.

Caddy bezieht und erneuert bei passendem DNS und erreichbaren Ports ein
öffentlich gültiges Zertifikat. Seine Daten liegen in benannten Docker-Volumes.
WebSocket-Upgrades werden automatisch weitergeleitet.
[Caddy: HTTPS](https://caddyserver.com/docs/automatic-https),
[Caddy: reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

## Firewall und NAT

| Eingehender Port am Server | Zweck |
| --- | --- |
| 80/TCP | HTTPS-Zertifikatsprüfung und HTTP-Weiterleitung |
| 443/TCP | HTTPS-Seite und WSS-Signalisierung |
| 3478/UDP und 3478/TCP | TURN-Verbindung der Clients |
| 49160–49200/UDP | TURN-Relay-Ports |

Diese Regeln sowohl in einer Provider-Firewall als auch auf dem Host prüfen.
Bei einem Heimserver dieselben Ports im Router an denselben lokalen Port
weiterleiten. Ausgehender Verkehr und zugehörige Antworten müssen erlaubt sein.
Port 8787 wird **nicht** am Docker-Host veröffentlicht. Ein gewöhnlicher
HTTP-Reverse-Proxy transportiert kein TURN; TURN-DNS muss direkt auf den Server
zeigen. coturn verwendet bewusst Host-Networking und einen begrenzten Bereich
für Relay-Ports. [coturn Docker-Dokumentation](https://github.com/coturn/coturn/tree/master/docker/coturn).

## Beide Apps verbinden

Beide tragen ein:

- Server: `wss://sofa.example.net`
- Raum: denselben Namen, beispielsweise `sofa`
- Raumschlüssel: denselben `ROOM_SECRET`
- Name: jeweils den eigenen Namen

Die App akzeptiert `ws://` ausschließlich für `localhost`, `127.0.0.1` und
`[::1]`. **Auch im LAN wird `ws://192.168.…` abgelehnt.** Für zwei Rechner ist
also WSS mit gültigem Zertifikat erforderlich. Nur ein lokaler Ein-Rechner-Test
kann direkt `ws://127.0.0.1:8787` verwenden.

Ein Raum hat höchstens zwei Teilnehmer. Der Raumschlüssel gilt jedoch für den
gesamten Server, nicht für einen einzelnen Raum. Wer ihn kennt, kann weitere
Räume öffnen und temporäre TURN-Zugangsdaten bekommen. Nicht öffentlich teilen.

## TURN im gelieferten Aufbau

`signal.mjs` erzeugt nach erfolgreicher Anmeldung HMAC-SHA1-Zugangsdaten mit
24 Stunden Gültigkeit. Compose verwendet denselben `TURN_SECRET` für
Signalisierung und coturn; die Startdatei schreibt ihn nur in eine private
temporäre coturn-Konfiguration. TURN verlangt Authentifizierung. Ausgehende
Relay-Verbindungen zu privaten Adressbereichen sind gesperrt, Kontingente
begrenzen gleichzeitige Relay-Zuweisungen und Bandbreite.
[coturn-Konfigurationsreferenz](https://github.com/coturn/coturn/blob/master/examples/etc/turnserver.conf).

Bei einem manuellen Start außerhalb von Compose müssen `TURN_URLS` und
`TURN_SECRET` gemeinsam gesetzt werden. Ohne beide läuft ein lokaler Test
ohne TURN. Fehlende Partnerwerte, leere URLs, falsche URL-Schemata und ungültige
Ports brechen den Start mit einer verständlichen Fehlermeldung ab. Der
Raumschlüssel und das TURN-Geheimnis werden dabei nicht ausgegeben.

Dieses kleine Setup bietet TURN über UDP/TCP auf 3478, **kein TURN-over-TLS**.
Die Chat-/Medien-Nutzdaten bleiben durch WebRTC verschlüsselt. Restriktive
Firmennetze, die nur TLS auf 443 erlauben, können damit trotzdem scheitern.
Ein späterer `turns:`-Endpunkt braucht eine eigene TLS-Konfiguration inklusive
Zertifikat und Erneuerung; allein eine `turns:`-URL einzutragen genügt nicht.
Eine TURN-TLS-Nutzung auf 443 benötigt außerdem eine passende separate
IP-/Listener-Architektur, da Caddy hier schon 443 belegt.

## Betrieb und Prüfung

```bash
curl --fail https://sofa.example.net/health
docker compose logs --tail=50 signal caddy turn
```

`/health` muss `ok` liefern. Das bestätigt HTTPS und Signalisierung, **nicht**
die Funktion des TURN-Relays. Protokolle können IP-Adressen und temporäre
Benutzernamen enthalten; nur nach Prüfung weitergeben. Container-Logs sind
auf je zwei Dateien à 5 MB begrenzt; die App speichert keine Chat-Historie.

Danach mit Windows und CachyOS aus zwei verschiedenen Netzen prüfen:

1. Beide Raumbeitrittsreihenfolgen, Textnachrichten in beide Richtungen.
2. Mikrofon/Kamera separat aktivieren, beenden und erneut starten.
3. Bildschirmfreigabe auswählen, beenden und neu auswählen; Abbruch testen.
4. Teilnehmer verlassen lassen: Medien müssen lokal stoppen; anschließend neu beitreten.
5. Einen gesonderten WebRTC-Test mit `iceTransportPolicy: 'relay'` ausführen,
   um TURN gezielt zu prüfen. Eine erfolgreiche Direktverbindung beweist TURN
   nicht; diese Erzwingung ist noch kein Schalter in der Benutzeroberfläche.

Nach mehr als 24 Stunden vor einem neuen Verbindungsaufbau den Raum neu
betreten, damit frische TURN-Zugangsdaten kommen. Beim Austausch von
`ROOM_SECRET`/`TURN_SECRET` alle Container neu erstellen und beide Clients neu
beitreten lassen; bestehende Sitzungen werden dabei unterbrochen.

Updates im Wartungsfenster:

```bash
docker compose pull
docker compose up -d --build
```

Der coturn-Tag ist fixiert; eine neue coturn-Version muss in `compose.yaml`
bewusst eingetragen und erneut geprüft werden. Node und Caddy folgen ihren
Hauptversions-Tags. Stoppen: `docker compose down`. Die Zertifikats-Volumes
bleiben dabei erhalten; `down --volumes` würde diese löschen.

## CachyOS / Wayland

Der Server ersetzt nicht die Bildschirmfreigabe des Linux-Desktops. Der
CachyOS-Rechner braucht PipeWire, `xdg-desktop-portal` und ein zum Desktop
passendes Portal-Backend, beispielsweise KDE, GNOME oder Hyprland. Electron
nutzt den PipeWire-Weg; dabei kann nur die vom System ausgewählte Quelle
geliefert werden. Fenster-/Monitorwahl und das Beenden der Freigabe müssen am
echten CachyOS-Rechner getestet werden.
[Electron desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer),
[XDG Desktop Portal und Backends](https://flatpak.github.io/xdg-desktop-portal/docs/#backends).

## Prüfstand dieses Rezepts

Stand 2026-09-20: Compose-Konfiguration erneut lokal mit `config --quiet`
statisch validiert; Shell-Startdatei mit `bash -n` syntaktisch geprüft. Die Docker-Engine
war hier nicht erreichbar. Es wurden **keine Container gestartet**, keine
Zertifikate bezogen und kein öffentlicher TURN-/NAT-Test ausgeführt. Linux-
Host-Networking, der Linux-Container-Build sowie CachyOS/Wayland benötigen
deshalb noch einen praktischen Test auf den Zielsystemen.

`node --test test/server.test.mjs` besteht acht Tests: HTTP/Anmeldung,
Zwei-Personen-Grenze, ungültige Anmeldungen, Raumtrennung und Aufräumen nach
Trennung, HMAC/24-Stunden-Vertrag der TURN-Zugangsdaten, Konfigurationsfehler
und vollständiges wiederholbares Herunterfahren. Diese Tests öffnen echte
lokale WebSocket-Verbindungen. Sie prüfen die Ausgabe der TURN-Zugangsdaten,
aber bauen keine TURN-Relay-Verbindung auf.
