# 🔒 P2P Chat — Zero-Backend Encrypted Chat

[🇬🇧 English](README.md) · [🇪🇸 Español](README.es.md) · [🇩🇪 Deutsch](README.de.md) · [🇨🇳 中文](README.zh.md) · [🇷🇺 Русский](README.ru.md)

> A peer-to-peer, end-to-end encrypted chat that runs entirely in your browser. No servers, no accounts, no logs on anyone's machine. Just open the page, share a room name, and talk.

---

## What is it?

**P2P Chat** is a single-page web application that lets two or more people chat, send files, and verify each other's identity — **without any backend**. There is no central server, no database, no user accounts, and no telemetry.

The browser itself becomes the client. WebRTC handles the peer-to-peer connection. Web Crypto (in a Web Worker) handles the encryption. IndexedDB stores your history locally. Everything you see in the UI is derived from those three building blocks.

It's a Progressive Web App (PWA): you can install it on your phone or desktop like a native app, and it works offline for the UI shell.

---

## Why?

Most "private" chat apps still require you to trust the operator of a server. Even if they claim end-to-end encryption, they know who talks to whom and when. This project removes the server from the equation entirely:

- **No backend to seize, subpoena, or hack.**
- **No account to register.**
- **No metadata trail** on any infrastructure you don't control (except for the signaling layer, explained below).
- **You can host it yourself** on GitHub Pages, Cloudflare Pages, Netlify, or even a USB stick — it's just static files.

---

## Features

### Core
- **Peer-to-peer chat** over WebRTC data channels.
- **Optional end-to-end encryption** with AES-GCM (256-bit) derived from a shared password via PBKDF2 (200,000 iterations, SHA-256).
- **Automatic key rotation every 24 hours** — old message keys expire; new keys are derived from the same password with a rotating slot.
- **Multiple rooms in tabs** — open and manage several conversations at once.
- **Persistent history** in IndexedDB (per room, per device).
- **Message queue** — messages sent to an offline peer are stored locally and delivered when the peer reconnects.
- **Delivery receipts** — ✓ sent, ✓✓ delivered.
- **Remote message deletion** — delete a message locally or for everyone who has it.
- **File and image transfer** — chunked over the same encrypted data channel.
- **Option to not store files** in history (only the filename is kept).

### Security & identity
- **Out-of-band SAS verification** — 6-digit code derived from an ECDH (P-256) exchange, so you can verify there's no man-in-the-middle.
- **Optional PIN lock** with inactivity auto-lock.
- **Fingerprint** shown in the UI so contacts can verify you on first contact.
- **Contact list** stored locally.

### UX
- **Installable PWA** with offline UI shell.
- **Multi-language interface**: Spanish, English, German, Chinese, Russian.
- **Dark / Light / System themes** and **three font sizes**.
- **Virtual scrolling** — handles thousands of messages smoothly.
- **Network statistics** — bytes sent/received, RTT, connection type (direct or relay).
- **Internal logs** — filterable by category (connection, ICE, messages).
- **Diagnostics panel** with the full internal state for troubleshooting.
- **Reconnect actions** — restart connections, clear signaling cache, hard reset.

---

## Advantages

| | P2P Chat | Typical "private" chat |
|---|---|---|
| **Backend needed** | None | Server + database |
| **Account** | None | Email / phone |
| **Data on third-party servers** | No | Yes |
| **Metadata visible to operator** | No (only signaling) | Yes |
| **Auditable** | Yes, ~2k lines of JS | Usually not |
| **Deployable on static hosting** | Yes | No |
| **Works offline (UI)** | Yes (PWA) | Usually no |

---

## How to use

1. Open the deployed URL (or run it locally, see below).
2. Click **＋** to create a chat.
3. Pick a **room name** and, optionally, a **password**.
   - Without password: connections are still encrypted (DTLS), but there's no extra E2E layer.
   - With password: an extra AES-GCM layer is added and the signaling messages (SDP) are encrypted too, preventing MITM at the signaling layer.
4. Share the room name (and password, over a *different* secure channel) with your contact.
5. Start chatting. Files can be dragged into the window or attached with 📎.

### Verifying identity

Once connected, click the peer in the status bar → **View SAS**. Compare the 6-digit code with your contact over a separate channel (in person, Signal, phone). If it matches, click **Save and verify**.

---

## How it works

<img width="1738" height="905" alt="ChatGPT Image Sep 25, 2026, 11_17_07 AM" src="https://github.com/user-attachments/assets/3717a870-873b-4981-b31f-ff8097e74631" />


1. **Signaling**: The two browsers find each other through a public, decentralized network — BitTorrent trackers by default, with Nostr and MQTT as fallbacks. If a password is set, the SDP messages (which contain the DTLS fingerprints) are encrypted before being sent, so a malicious signaling node cannot perform a MITM.
2. **Connection**: WebRTC negotiates a direct peer-to-peer connection. If the network blocks a direct path (e.g., both peers behind CGNAT), the traffic is relayed by a TURN server — still end-to-end encrypted, but with higher latency.
3. **Encryption**: WebRTC always encrypts with DTLS-SRTP. If you set a password, an extra AES-GCM layer is applied *inside* the data channel, and the key is rotated every 24 hours.
4. **Storage**: Messages and files are stored locally in IndexedDB, encrypted at rest if a password is set.
5. **Persistence**: On reload, the app restores your rooms and reconnects automatically.

---

## Security & privacy

**What's protected:**
- Message content (DTLS always; AES-GCM if a password is set).
- Signaling content (SDP) if a password is set.
- Files (same as messages).
- Local history at rest (if a password is set).

**What's not:**
- **Your IP address is visible** to your peer in a direct connection. This is inherent to WebRTC. If the connection goes through a relay (TURN), your peer sees the relay's IP, but the TURN operator sees yours.
- **The signaling layer** (BitTorrent trackers, Nostr relays, MQTT brokers) sees that two IPs are trying to connect, unless you set a password (in which case it can't read the SDP, but still sees the connection attempt).
- **No forward secrecy** beyond what DTLS provides. If an attacker gets your password *and* your IndexedDB, they can decrypt stored messages for the current key slot (24h window).

**Threat model**: This app is designed to protect against passive network surveillance and against a service operator that wants to read your chats. It is *not* designed to protect against a compromised device, a global adversary with traffic correlation, or a peer who leaks your conversations on purpose.

**Recommendations:**
- Always set a strong, random password.
- Share it through a different channel (Signal, in person).
- Verify the SAS.
- Use a VPN if you don't want your peer to see your IP.

---

## Limitations

- **Requires a relay (TURN) in some networks** (~15–20% of connections, especially mobile/CGNAT). The app uses free public TURN servers by default, which are best-effort and can be slow.
- **No offline delivery**: if your peer is offline when you send a message, it stays queued locally and delivers when they reconnect. There's no server holding it for them.
- **No push notifications** when the tab is closed. Desktop notifications only work while the page is open in the background.
- **No multi-device sync**: each device has its own history. There's no way to sync between phone and laptop without a server.
- **Local storage limits**: browsers cap IndexedDB around 50 MB on mobile. Large files will fill it quickly; disable "Save files to history" if you don't need them.
- **The signaling layer is public**: trackers and relays are shared infrastructure. If they're down, the app can't find peers. Try another strategy (Nostr, MQTT) or host your own coturn.

---

## Deployment

### GitHub Pages (recommended)

1. Clone or fork this repository.
2. Make sure the following files are at the root: `index.html`, `app.js`, `i18n.js`, `sw.js`, `manifest.json`, `icon.svg`, and the `modules/` folder.
3. Enable GitHub Pages in **Settings → Pages → Source: main branch / root**.
4. Done. HTTPS is provided by GitHub.

### Any static host

Since there's no backend, any static hosting works: Cloudflare Pages, Netlify, Vercel, a plain nginx, an S3 bucket, a Raspberry Pi with `python -m http.server`.

### Local development

```bash
# Any static server works. For example:
python3 -m http.server 8080
# Then open http://localhost:8080
```

> Important: crypto.subtle, navigator.clipboard, notifications and service workers require HTTPS or localhost. Opening index.html with a file:// URL will break some features.

## Modules
The three files in modules/ (except crypto.worker.js) are bundled with esbuild from Trystero. If you want to rebuild them:
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

## Tech stack
- Vanilla JavaScript (ES modules), no framework.
- WebRTC for peer-to-peer transport.
- Trystero for signaling over BitTorrent, Nostr, and MQTT.
- Web Crypto API (in a Web Worker) for AES-GCM, PBKDF2, ECDH, SHA-256.
- IndexedDB for local persistence.
- Service Worker for PWA offline shell.
- Zero build step for the app itself.
