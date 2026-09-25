# 🔒 P2P Chat — Verschlüsselter Chat ohne Backend

[🇬🇧 English](README.md) · [🇪🇸 Español](README.es.md) · [🇩🇪 Deutsch](README.de.md) · [🇨🇳 中文](README.zh.md) · [🇷🇺 Русский](README.ru.md)

> Ein Peer-to-Peer-Chat mit Ende-zu-Ende-Verschlüsselung, der vollständig in deinem Browser läuft. Keine Server, keine Konten, keine Protokolle auf irgendeinem Rechner. Einfach die Seite öffnen, einen Raumnamen teilen und loslegen.

---
## Was ist das?

**P2P Chat** ist eine Single-Page-Webanwendung, mit der zwei oder mehr Personen chatten, Dateien senden und die Identität des jeweils anderen überprüfen können — **ganz ohne Backend**. Es gibt keinen zentralen Server, keine Datenbank, keine Benutzerkonten und keine Telemetrie.

Der Browser selbst wird zum Client. WebRTC übernimmt die Peer-to-Peer-Verbindung. Web Crypto (in einem Web Worker) übernimmt die Verschlüsselung. IndexedDB speichert deinen Verlauf lokal. Alles, was du in der Oberfläche siehst, ergibt sich aus diesen drei Bausteinen.

Es handelt sich um eine Progressive Web App (PWA): Du kannst sie auf Handy oder Desktop wie eine native App installieren, und die Oberfläche funktioniert auch offline.

---
## Warum?

Die meisten "privaten" Chat-Apps verlangen immer noch, dass du dem Betreiber eines Servers vertraust. Selbst wenn sie Ende-zu-Ende-Verschlüsselung behaupten, wissen sie, wer wann mit wem spricht. Dieses Projekt entfernt den Server vollständig aus der Gleichung:

- **Kein Backend, das beschlagnahmt, per Vorladung eingefordert oder gehackt werden kann.**
- **Kein Konto zum Registrieren.**
- **Keine Metadatenspur** auf Infrastruktur, die du nicht kontrollierst (außer der Signaling-Schicht, siehe unten).
- **Du kannst es selbst hosten** — auf GitHub Pages, Cloudflare Pages, Netlify oder sogar einem USB-Stick — es sind nur statische Dateien.

---

## Funktionen

### Kernfunktionen
- **Peer-to-Peer-Chat** über WebRTC-Datenkanäle.
- **Optionale Ende-zu-Ende-Verschlüsselung** mit AES-GCM (256 Bit), abgeleitet aus einem gemeinsamen Passwort via PBKDF2 (200.000 Iterationen, SHA-256).
- **Automatische Schlüsselrotation alle 24 Stunden** — alte Nachrichtenschlüssel laufen ab; neue Schlüssel werden aus demselben Passwort mit einem rotierenden Slot abgeleitet.
- **Mehrere Räume in Tabs** — mehrere Unterhaltungen gleichzeitig öffnen und verwalten.
- **Persistenter Verlauf** in IndexedDB (pro Raum, pro Gerät).
- **Nachrichtenwarteschlange** — Nachrichten an einen offline befindlichen Kontakt werden lokal gespeichert und zugestellt, sobald dieser wieder online ist.
- **Zustellbestätigungen** — ✓ gesendet, ✓✓ zugestellt.
- **Fernlöschung von Nachrichten** — eine Nachricht lokal oder für alle Empfänger löschen.
- **Datei- und Bildübertragung** — in Chunks über denselben verschlüsselten Datenkanal.
- **Option, Dateien nicht im Verlauf zu speichern** (nur der Dateiname wird behalten).

### Sicherheit & Identität
- **Out-of-Band-SAS-Verifizierung** — ein 6-stelliger Code, abgeleitet aus einem ECDH-Austausch (P-256), mit dem du prüfen kannst, dass kein Man-in-the-Middle vorliegt.
- **Optionale PIN-Sperre** mit automatischer Sperre bei Inaktivität.
- **Fingerabdruck**, der in der Oberfläche angezeigt wird, damit Kontakte dich beim Erstkontakt verifizieren können.
- **Kontaktliste**, lokal gespeichert.

### Benutzererfahrung
- **Installierbare PWA** mit Offline-Oberfläche.
- **Mehrsprachige Oberfläche**: Spanisch, Englisch, Deutsch, Chinesisch, Russisch.
- **Dunkles / Helles / Systemthema** und **drei Schriftgrößen**.
- **Virtuelles Scrollen** — verarbeitet Tausende von Nachrichten flüssig.
- **Netzwerkstatistiken** — gesendete/empfangene Bytes, RTT, Verbindungstyp (direkt oder über Relay).
- **Interne Protokolle** — filterbar nach Kategorie (Verbindung, ICE, Nachrichten).
- **Diagnosepanel** mit dem vollständigen internen Zustand zur Fehlerbehebung.
- **Wiederverbindungsaktionen** — Verbindungen neu starten, Signaling-Cache leeren, vollständiger Reset.

---

## Vorteile

| | P2P Chat | Typischer "privater" Chat |
|---|---|---|
| **Benötigtes Backend** | Keins | Server + Datenbank |
| **Konto** | Keins | E-Mail / Telefon |
| **Daten auf Servern Dritter** | Nein | Ja |
| **Für den Betreiber sichtbare Metadaten** | Nein (nur Signaling) | Ja |
| **Auditierbar** | Ja, ~2k Zeilen JS | Meist nicht |
| **Auf statischem Hosting einsetzbar** | Ja | Nein |
| **Funktioniert offline (Oberfläche)** | Ja (PWA) | Meist nicht |

---

## Verwendung

1. Öffne die veröffentlichte URL (oder führe die App lokal aus, siehe unten).
2. Klicke auf **＋**, um einen Chat zu erstellen.
3. Wähle einen **Raumnamen** und optional ein **Passwort**.
   - Ohne Passwort: Verbindungen sind weiterhin verschlüsselt (DTLS), aber es gibt keine zusätzliche E2E-Schicht.
   - Mit Passwort: Eine zusätzliche AES-GCM-Schicht wird hinzugefügt, und auch die Signaling-Nachrichten (SDP) werden verschlüsselt, was MITM auf der Signaling-Ebene verhindert.
4. Teile den Raumnamen (und das Passwort, über einen *anderen* sicheren Kanal) mit deinem Kontakt.
5. Fang an zu chatten. Dateien können ins Fenster gezogen oder mit 📎 angehängt werden.

### Identität verifizieren

Sobald verbunden, klicke in der Statusleiste auf den Kontakt → **SAS anzeigen**. Vergleiche den 6-stelligen Code mit deinem Kontakt über einen separaten Kanal (persönlich, Signal, Telefon). Stimmt er überein, klicke auf **Speichern und verifizieren**.

---

## Wie es funktioniert

<img width="1740" height="904" alt="ChatGPT Image Sep 25, 2026, 11_21_21 AM" src="https://github.com/user-attachments/assets/04121b94-6c92-49ee-9dda-80c04a62662e" />


1. **Signaling**: Die beiden Browser finden sich über ein öffentliches, dezentrales Netzwerk — standardmäßig BitTorrent-Tracker, mit Nostr und MQTT als Fallback. Ist ein Passwort gesetzt, werden die SDP-Nachrichten (die die DTLS-Fingerabdrücke enthalten) vor dem Versand verschlüsselt, sodass ein bösartiger Signaling-Knoten keinen MITM durchführen kann.
2. **Verbindung**: WebRTC handelt eine direkte Peer-to-Peer-Verbindung aus. Blockiert das Netzwerk einen direkten Pfad (z. B. beide Teilnehmer hinter CGNAT), wird der Verkehr über einen TURN-Server weitergeleitet — weiterhin Ende-zu-Ende-verschlüsselt, aber mit höherer Latenz.
3. **Verschlüsselung**: WebRTC verschlüsselt immer mit DTLS-SRTP. Setzt du ein Passwort, wird zusätzlich eine AES-GCM-Schicht *innerhalb* des Datenkanals angewendet, und der Schlüssel rotiert alle 24 Stunden.
4. **Speicherung**: Nachrichten und Dateien werden lokal in IndexedDB gespeichert, bei gesetztem Passwort verschlüsselt im Ruhezustand.
5. **Persistenz**: Beim Neuladen stellt die App deine Räume wieder her und verbindet sich automatisch neu.

---

## Sicherheit & Datenschutz

**Was geschützt ist:**
- Nachrichteninhalt (immer DTLS; AES-GCM bei gesetztem Passwort).
- Signaling-Inhalt (SDP), falls ein Passwort gesetzt ist.
- Dateien (wie Nachrichten).
- Lokaler Verlauf im Ruhezustand (falls ein Passwort gesetzt ist).

**Was nicht geschützt ist:**
- **Deine IP-Adresse ist** bei einer direkten Verbindung **für deinen Kontakt sichtbar**. Das liegt in der Natur von WebRTC. Läuft die Verbindung über ein Relay (TURN), sieht dein Kontakt die IP des Relays, aber der TURN-Betreiber sieht deine.
- **Die Signaling-Schicht** (BitTorrent-Tracker, Nostr-Relays, MQTT-Broker) sieht, dass zwei IPs versuchen, eine Verbindung herzustellen, es sei denn, du setzt ein Passwort (dann kann sie das SDP nicht lesen, sieht aber weiterhin den Verbindungsversuch).
- **Keine Forward Secrecy** über das hinaus, was DTLS bietet. Erlangt ein Angreifer sowohl dein Passwort *als auch* deine IndexedDB, kann er gespeicherte Nachrichten des aktuellen Schlüssel-Slots (24-Stunden-Fenster) entschlüsseln.

**Bedrohungsmodell**: Diese App soll vor passiver Netzwerküberwachung und vor einem Dienstbetreiber schützen, der deine Chats mitlesen will. Sie ist *nicht* dafür ausgelegt, vor einem kompromittierten Gerät, einem globalen Angreifer mit Traffic-Korrelation oder einem Kontakt zu schützen, der deine Unterhaltungen absichtlich weitergibt.

**Empfehlungen:**
- Setze immer ein starkes, zufälliges Passwort.
- Teile es über einen anderen Kanal (Signal, persönlich).
- Verifiziere den SAS.
- Nutze ein VPN, wenn dein Kontakt deine IP nicht sehen soll.

---

## Einschränkungen

- **Benötigt in manchen Netzwerken ein Relay (TURN)** (~15–20 % der Verbindungen, besonders mobil/CGNAT). Die App nutzt standardmäßig kostenlose, öffentliche TURN-Server, die nach bestem Bemühen arbeiten und langsam sein können.
- **Keine Offline-Zustellung**: Ist dein Kontakt offline, wenn du eine Nachricht sendest, bleibt sie lokal in der Warteschlange und wird zugestellt, sobald er sich wieder verbindet. Es gibt keinen Server, der sie für ihn vorhält.
- **Keine Push-Benachrichtigungen** bei geschlossenem Tab. Desktop-Benachrichtigungen funktionieren nur, solange die Seite im Hintergrund geöffnet ist.
- **Keine geräteübergreifende Synchronisierung**: Jedes Gerät hat seinen eigenen Verlauf. Ohne Server gibt es keine Möglichkeit, Handy und Laptop zu synchronisieren.
- **Lokale Speichergrenzen**: Browser begrenzen IndexedDB auf mobilen Geräten auf etwa 50 MB. Große Dateien füllen den Speicher schnell; deaktiviere "Dateien im Verlauf speichern", falls nicht benötigt.
- **Die Signaling-Schicht ist öffentlich**: Tracker und Relays sind gemeinsam genutzte Infrastruktur. Sind sie down, kann die App keine Kontakte finden. Versuche eine andere Strategie (Nostr, MQTT) oder hoste deinen eigenen coturn.

---

## Bereitstellung

### GitHub Pages (empfohlen)

1. Klone dieses Repository oder erstelle einen Fork.
2. Stelle sicher, dass folgende Dateien im Root liegen: `index.html`, `app.js`, `i18n.js`, `sw.js`, `manifest.json`, `icon.svg` sowie der Ordner `modules/`.
3. Aktiviere GitHub Pages unter **Settings → Pages → Source: main branch / root**.
4. Fertig. HTTPS wird von GitHub bereitgestellt.

### Beliebiges statisches Hosting

Da es kein Backend gibt, funktioniert jedes statische Hosting: Cloudflare Pages, Netlify, Vercel, ein einfacher nginx, ein S3-Bucket, ein Raspberry Pi mit `python -m http.server`.

### Lokale Entwicklung

```bash
# Jeder statische Server funktioniert. Zum Beispiel:
python3 -m http.server 8080
# Dann öffne http://localhost:8080
```

> Wichtig: crypto.subtle, navigator.clipboard, Benachrichtigungen und Service Worker benötigen HTTPS oder localhost. Das Öffnen von index.html über eine file://-URL wird einige Funktionen beeinträchtigen.

## Module
Die drei Dateien in modules/ (außer crypto.worker.js) werden mit esbuild aus Trystero gebündelt. Zum Neubauen:
```bash
npm install --save-dev trystero@0.21.6 esbuild
mkdir -p modules
for strat in torrent nostr mqtt; do
  echo "export * from 'trystero/$strat'" > .entry.js
  npx esbuild .entry.js --bundle --format=esm --target=es2022 \
    --platform=browser --outfile=modules/trystero-$strat.js
done
rm .entry.js
rm -rf node_modules package.json package-lock.json
```

## Tech-Stack
- Vanilla JavaScript (ES-Module), kein Framework.
- WebRTC für den Peer-to-Peer-Transport.
- Trystero für Signaling über BitTorrent, Nostr und MQTT.
- Web Crypto API (in einem Web Worker) für AES-GCM, PBKDF2, ECDH, SHA-256.
- IndexedDB für lokale Persistenz.
- Service Worker für die PWA-Offline-Oberfläche.
- Kein Build-Schritt für die App selbst.
