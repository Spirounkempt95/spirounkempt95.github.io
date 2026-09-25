# 🔒 P2P Chat — Chat cifrado sin backend

[🇬🇧 English](README.md) · [🇪🇸 Español](README.es.md) · [🇩🇪 Deutsch](README.de.md) · [🇨🇳 中文](README.zh.md) · [🇷🇺 Русский](README.ru.md)

> Un chat de igual a igual (peer-to-peer), cifrado de extremo a extremo, que funciona íntegramente en tu navegador. Sin servidores, sin cuentas, sin registros en la máquina de nadie. Solo abre la página, comparte el nombre de una sala y habla.

---
## ¿Qué es?

**P2P Chat** es una aplicación web de una sola página que permite a dos o más personas chatear, enviar archivos y verificar la identidad de la otra parte — **sin ningún backend**. No hay servidor central, ni base de datos, ni cuentas de usuario, ni telemetría.

El propio navegador se convierte en el cliente. WebRTC gestiona la conexión de igual a igual. Web Crypto (dentro de un Web Worker) gestiona el cifrado. IndexedDB almacena tu historial localmente. Todo lo que ves en la interfaz se deriva de esos tres pilares.

Es una Progressive Web App (PWA): puedes instalarla en tu móvil o escritorio como una app nativa, y funciona sin conexión para la interfaz.

---
## ¿Por qué?

La mayoría de apps de chat "privadas" siguen exigiendo que confíes en el operador de un servidor. Aunque digan tener cifrado de extremo a extremo, saben quién habla con quién y cuándo. Este proyecto elimina el servidor de la ecuación por completo:

- **Ningún backend que incautar, citar judicialmente o hackear.**
- **Ninguna cuenta que registrar.**
- **Ningún rastro de metadatos** en infraestructura que no controlas (salvo la capa de señalización, explicada más abajo).
- **Puedes alojarlo tú mismo** en GitHub Pages, Cloudflare Pages, Netlify, o incluso en un USB — son solo archivos estáticos.

---

## Funcionalidades

### Núcleo
- **Chat de igual a igual** sobre canales de datos WebRTC.
- **Cifrado de extremo a extremo opcional** con AES-GCM (256 bits) derivado de una contraseña compartida mediante PBKDF2 (200.000 iteraciones, SHA-256).
- **Rotación automática de claves cada 24 horas** — las claves de mensajes antiguas caducan; se derivan nuevas claves de la misma contraseña con una ranura rotativa.
- **Varias salas en pestañas** — abre y gestiona varias conversaciones a la vez.
- **Historial persistente** en IndexedDB (por sala, por dispositivo).
- **Cola de mensajes** — los mensajes enviados a un contacto desconectado se guardan localmente y se entregan cuando vuelve a conectarse.
- **Confirmaciones de entrega** — ✓ enviado, ✓✓ entregado.
- **Borrado remoto de mensajes** — borra un mensaje localmente o para todos los que lo tengan.
- **Transferencia de archivos e imágenes** — fragmentada sobre el mismo canal de datos cifrado.
- **Opción de no guardar archivos** en el historial (solo se conserva el nombre del archivo).

### Seguridad e identidad
- **Verificación SAS fuera de banda** — código de 6 dígitos derivado de un intercambio ECDH (P-256), para que puedas verificar que no hay un ataque de intermediario (MITM).
- **Bloqueo por PIN opcional** con bloqueo automático por inactividad.
- **Huella digital** mostrada en la interfaz para que tus contactos puedan verificarte en el primer contacto.
- **Lista de contactos** almacenada localmente.

### Experiencia de usuario
- **PWA instalable** con interfaz disponible sin conexión.
- **Interfaz multilingüe**: español, inglés, alemán, chino, ruso.
- **Temas oscuro / claro / del sistema** y **tres tamaños de fuente**.
- **Scroll virtual** — maneja miles de mensajes con fluidez.
- **Estadísticas de red** — bytes enviados/recibidos, RTT, tipo de conexión (directa o mediante relay).
- **Registros internos** — filtrables por categoría (conexión, ICE, mensajes).
- **Panel de diagnóstico** con el estado interno completo para solucionar problemas.
- **Acciones de reconexión** — reiniciar conexiones, limpiar la caché de señalización, reinicio completo.

---

## Ventajas

| | P2P Chat | Chat "privado" típico |
|---|---|---|
| **Backend necesario** | Ninguno | Servidor + base de datos |
| **Cuenta** | Ninguna | Email / teléfono |
| **Datos en servidores de terceros** | No | Sí |
| **Metadatos visibles para el operador** | No (solo señalización) | Sí |
| **Auditable** | Sí, ~2k líneas de JS | Normalmente no |
| **Desplegable en hosting estático** | Sí | No |
| **Funciona sin conexión (interfaz)** | Sí (PWA) | Normalmente no |

---

## Cómo usarlo

1. Abre la URL desplegada (o ejecútala en local, ver más abajo).
2. Haz clic en **＋** para crear un chat.
3. Elige un **nombre de sala** y, opcionalmente, una **contraseña**.
   - Sin contraseña: las conexiones siguen cifradas (DTLS), pero no hay una capa extra E2E.
   - Con contraseña: se añade una capa adicional AES-GCM y los mensajes de señalización (SDP) también se cifran, evitando un MITM en la capa de señalización.
4. Comparte el nombre de la sala (y la contraseña, por un canal seguro *distinto*) con tu contacto.
5. Empieza a chatear. Puedes arrastrar archivos a la ventana o adjuntarlos con 📎.

### Verificar identidad

Una vez conectado, haz clic en el contacto en la barra de estado → **Ver SAS**. Compara el código de 6 dígitos con tu contacto por un canal distinto (en persona, Signal, teléfono). Si coincide, haz clic en **Guardar y verificar**.

---

## Cómo funciona

```
┌────────────────┐                          ┌────────────────┐
│  Navegador A    │                          │  Navegador B    │
│                 │                          │                 │
│  ┌──────────┐   │                          │  ┌──────────┐   │
│  │ P2P Chat │   │◄────────────────────────►│  │ P2P Chat │   │
│  └──────────┘   │        WebRTC (DTLS)     │  └──────────┘   │
│     ▲     ▲     │                          │     ▲     ▲     │
│     │     │      │                          │     │     │      │
│    UI   Crypto  │                          │    UI   Crypto  │
│         Worker  │                          │         Worker  │
└────┬────────────┘                          └───────────┬────┘
     │                                                    │
     └────────────► Señalización ◄───────────────────────┘
          (trackers BitTorrent / Nostr / MQTT)
```

1. **Señalización**: los dos navegadores se encuentran a través de una red pública y descentralizada — trackers de BitTorrent por defecto, con Nostr y MQTT como alternativas. Si se ha establecido una contraseña, los mensajes SDP (que contienen las huellas DTLS) se cifran antes de enviarse, de modo que un nodo de señalización malicioso no puede realizar un MITM.
2. **Conexión**: WebRTC negocia una conexión directa de igual a igual. Si la red bloquea una ruta directa (por ejemplo, ambos pares detrás de CGNAT), el tráfico se retransmite mediante un servidor TURN — sigue cifrado de extremo a extremo, pero con más latencia.
3. **Cifrado**: WebRTC siempre cifra con DTLS-SRTP. Si estableces una contraseña, se aplica una capa adicional AES-GCM *dentro* del canal de datos, y la clave rota cada 24 horas.
4. **Almacenamiento**: los mensajes y archivos se guardan localmente en IndexedDB, cifrados en reposo si se ha establecido una contraseña.
5. **Persistencia**: al recargar, la app restaura tus salas y se reconecta automáticamente.

---

## Seguridad y privacidad

**Qué está protegido:**
- El contenido de los mensajes (DTLS siempre; AES-GCM si hay contraseña).
- El contenido de señalización (SDP) si hay contraseña.
- Los archivos (igual que los mensajes).
- El historial local en reposo (si hay contraseña).

**Qué no lo está:**
- **Tu dirección IP es visible** para tu contacto en una conexión directa. Esto es inherente a WebRTC. Si la conexión pasa por un relay (TURN), tu contacto ve la IP del relay, pero el operador del TURN ve la tuya.
- **La capa de señalización** (trackers de BitTorrent, relays de Nostr, brokers MQTT) ve que dos IPs intentan conectarse, a menos que establezcas una contraseña (en cuyo caso no puede leer el SDP, pero sigue viendo el intento de conexión).
- **Sin forward secrecy** más allá de lo que proporciona DTLS. Si un atacante obtiene tu contraseña *y* tu IndexedDB, puede descifrar los mensajes almacenados de la ranura de clave actual (ventana de 24 h).

**Modelo de amenaza**: esta app está diseñada para proteger frente a la vigilancia pasiva de red y frente a un operador de servicio que quiera leer tus chats. *No* está diseñada para proteger frente a un dispositivo comprometido, un adversario global con correlación de tráfico, o un contacto que filtre tus conversaciones a propósito.

**Recomendaciones:**
- Establece siempre una contraseña fuerte y aleatoria.
- Compártela por un canal distinto (Signal, en persona).
- Verifica el SAS.
- Usa una VPN si no quieres que tu contacto vea tu IP.

---

## Limitaciones

- **Requiere un relay (TURN) en algunas redes** (~15–20% de las conexiones, especialmente móviles/CGNAT). La app usa servidores TURN públicos gratuitos por defecto, que son de mejor esfuerzo y pueden ser lentos.
- **Sin entrega sin conexión**: si tu contacto está desconectado cuando envías un mensaje, se queda en cola localmente y se entrega cuando se reconecte. No hay un servidor que lo retenga para él.
- **Sin notificaciones push** cuando la pestaña está cerrada. Las notificaciones de escritorio solo funcionan mientras la página está abierta en segundo plano.
- **Sin sincronización multi-dispositivo**: cada dispositivo tiene su propio historial. No hay forma de sincronizar entre móvil y portátil sin un servidor.
- **Límites de almacenamiento local**: los navegadores limitan IndexedDB a unos 50 MB en móvil. Los archivos grandes lo llenarán rápido; desactiva "Guardar archivos en el historial" si no los necesitas.
- **La capa de señalización es pública**: los trackers y relays son infraestructura compartida. Si están caídos, la app no puede encontrar contactos. Prueba otra estrategia (Nostr, MQTT) o aloja tu propio coturn.

---

## Despliegue

### GitHub Pages (recomendado)

1. Clona o haz un fork de este repositorio.
2. Asegúrate de que los siguientes archivos estén en la raíz: `index.html`, `app.js`, `i18n.js`, `sw.js`, `manifest.json`, `icon.svg`, y la carpeta `modules/`.
3. Activa GitHub Pages en **Settings → Pages → Source: main branch / root**.
4. Listo. HTTPS lo proporciona GitHub.

### Cualquier hosting estático

Como no hay backend, cualquier hosting estático funciona: Cloudflare Pages, Netlify, Vercel, un nginx normal, un bucket S3, una Raspberry Pi con `python -m http.server`.

### Desarrollo local

```bash
# Cualquier servidor estático funciona. Por ejemplo:
python3 -m http.server 8080
# Luego abre http://localhost:8080
```

> Importante: crypto.subtle, navigator.clipboard, las notificaciones y los service workers requieren HTTPS o localhost. Abrir index.html con una URL file:// romperá algunas funciones.

## Módulos
Los tres archivos en modules/ (excepto crypto.worker.js) están empaquetados con esbuild a partir de Trystero. Si quieres reconstruirlos:
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

## Stack tecnológico
- JavaScript vanilla (módulos ES), sin framework.
- WebRTC para el transporte de igual a igual.
- Trystero para la señalización sobre BitTorrent, Nostr y MQTT.
- Web Crypto API (en un Web Worker) para AES-GCM, PBKDF2, ECDH, SHA-256.
- IndexedDB para la persistencia local.
- Service Worker para la interfaz PWA sin conexión.
- Sin paso de compilación para la propia app.
