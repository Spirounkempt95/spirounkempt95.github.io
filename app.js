import { t, setLang, getLang, LANG_NAMES } from './i18n.js';
import { joinRoom, selfId } from './modules/trystero-torrent.js';
import { joinRoom as joinRoomNostr } from './modules/trystero-nostr.js';
import { joinRoom as joinRoomMqtt } from './modules/trystero-mqtt.js';

/* ============ CONSTANTES ============ */
const APP_ID = 'p2p-chat-v3';
const DB_NAME = 'p2p-chat';
const DB_VERSION = 3;
const MAX_LOGS = 800;
const CHUNK_SIZE = 16 * 1024;
const RATE_LIMIT = { max: 30, window: 10000 };
const PEER_WARN_MS = 30000;
const INACTIVITY_LOCK_MS = 5 * 60 * 1000;
const PIN_HASH_KEY = 'pin-hash-v1';

const TURN_SERVERS = [
  { urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302','stun:global.stun.twilio.com:3478'] },
  { urls:['turn:turn.evan-brass.net:3478?transport=udp','turn:turn.evan-brass.net:3478?transport=tcp','turns:turn.evan-brass.net:443?transport=tcp'],
    username:'user', credential:'password' },
  { urls:['turn:openrelay.metered.ca:80?transport=tcp','turn:openrelay.metered.ca:443?transport=tcp','turns:openrelay.metered.ca:443?transport=tcp','turn:openrelay.metered.ca:80'],
    username:'openrelayproject', credential:'openrelayproject' },
  { urls:['turn:relay1.expressturn.com:3478?transport=tcp','turn:relay1.expressturn.com:3478?transport=udp'],
    username:'ef0f8b5c7a2d3e4f', credential:'a1b2c3d4e5f6' }
];

/* ============ DB ============ */
class DB {
  constructor(){ this.db = null; }
  async open(){
    if (this.db) return this.db;
    this.db = await new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('messages'))
          db.createObjectStore('messages', { keyPath:'key' }).createIndex('room','roomId');
        if (!db.objectStoreNames.contains('contacts'))
          db.createObjectStore('contacts', { keyPath:'id' });
        if (!db.objectStoreNames.contains('settings'))
          db.createObjectStore('settings', { keyPath:'key' });
        if (!db.objectStoreNames.contains('logs'))
          db.createObjectStore('logs', { keyPath:'id', autoIncrement:true });
        if (!db.objectStoreNames.contains('rooms'))
          db.createObjectStore('rooms', { keyPath:'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this.db;
  }
  async tx(store, mode, fn){
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, mode);
      const s = tx.objectStore(store);
      const out = fn(s);
      tx.oncomplete = () => res(out?.result ?? out);
      tx.onerror = () => rej(tx.error);
    });
  }
  get(s, k){ return this.tx(s, 'readonly', o => o.get(k)); }
  put(s, v){ return this.tx(s, 'readwrite', o => o.put(v)); }
  del(s, k){ return this.tx(s, 'readwrite', o => o.delete(k)); }
  all(s){ return this.tx(s, 'readonly', o => o.getAll()); }
  byIndex(s, i, v){ return this.tx(s, 'readonly', o => o.index(i).getAll(v)); }
  clear(s){ return this.tx(s, 'readwrite', o => o.clear()); }
}
const db = new DB();

/* ============ CRYPTO CLIENT (worker) ============ */
class CryptoClient {
  constructor(){
    this.worker = new Worker('./modules/crypto.worker.js', { type:'module' });
    this.pending = new Map();
    this.nextId = 0;
    this.worker.onmessage = e => {
      const { id, result, error } = e.data;
      const p = this.pending.get(id);
      if (!p) return;
      this.pending.delete(id);
      if (error) p.reject(new Error(error)); else p.resolve(result);
    };
  }
  call(op, roomId, payload){
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, op, roomId, payload });
    });
  }
  setKey(roomId, password, salt){ return this.call('setKey', roomId, { password, salt }); }
  encrypt(roomId, password, salt, data){ return this.call('encrypt', roomId, { password, salt, data }); }
  decrypt(roomId, password, salt, iv, data){ return this.call('decrypt', roomId, { password, salt, iv, data }); }
  drop(roomId){ return this.call('drop', roomId, {}); }
}
const cryptoClient = new CryptoClient();

/* ============ UTIL ============ */
const b64e = buf => { const b=new Uint8Array(buf); let s=''; for(let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s); };
const b64d = s => { const bin=atob(s); const out=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i); return out; };
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function linkify(text){
  return text.split(/(https?:\/\/[^\s<]+)/g).map(p =>
    /^https?:\/\//.test(p)
      ? `<a href="${escapeHtml(p)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(p)}</a>`
      : escapeHtml(p)
  ).join('');
}
function fmtBytes(n){
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n/1024).toFixed(1) + ' KB';
  if (n < 1073741824) return (n/1048576).toFixed(1) + ' MB';
  return (n/1073741824).toFixed(2) + ' GB';
}
async function sha256hex(str){
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2,'0')).join('');
}
async function genECDH(){ return crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'}, true, ['deriveBits']); }
async function exportPub(k){
  const raw = await crypto.subtle.exportKey('raw', k);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return { raw: b64e(raw), fp: b64e(hash).slice(0,16) };
}
async function deriveSAS(privKey, theirRawB64){
  const raw = b64d(theirRawB64);
  const theirKey = await crypto.subtle.importKey('raw', raw, {name:'ECDH',namedCurve:'P-256'}, false, []);
  const bits = await crypto.subtle.deriveBits({name:'ECDH',public:theirKey}, privKey, 256);
  const hash = await crypto.subtle.digest('SHA-256', bits);
  const n = new DataView(hash).getUint32(0) % 1000000;
  return String(n).padStart(6,'0').replace(/(\d{3})(\d{3})/,'$1 $2');
}

/* ============ LOGGER ============ */
const Logger = {
  entries: [], filter: 'all',
  add(level, category, message, data){
    const e = { t: Date.now(), level, category, message, data };
    this.entries.push(e);
    if (this.entries.length > MAX_LOGS) this.entries.shift();
    this.render();
    const fn = level==='err' ? console.error : level==='warn' ? console.warn : console.log;
    fn(`[${category}] ${message}`, data || '');
    if (state?.settings?.persistLogs) db.put('logs', e).catch(()=>{});
  },
  info(c,m,d){ this.add('info',c,m,d); },
  ok(c,m,d){ this.add('ok',c,m,d); },
  warn(c,m,d){ this.add('warn',c,m,d); },
  err(c,m,d){ this.add('err',c,m,d); },
  render(){
    const el = document.getElementById('logs'); if (!el) return;
    const list = this.entries.filter(e => this.filter==='all' || e.category.startsWith(this.filter)).slice(-300);
    el.innerHTML = list.map(e => {
      const time = new Date(e.t).toLocaleTimeString();
      const d = e.data ? ' ' + JSON.stringify(e.data) : '';
      return `<div class="log-line ${e.level}"><span class="t">${time}</span> <span class="m">[${e.category}] ${escapeHtml(e.message)}${escapeHtml(d)}</span></div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  }
};

/* ============ STATE ============ */
const state = {
  settings: {
    nickname:'', notifications:false, sound:true, persistLogs:false,
    strategy:'auto', savePasswords:true, saveFiles:true,
    theme:'dark', fontSize:'normal', lang:'es',
    pinEnabled:false, pinHash:null,
    fileWarnShown:false
  },
  contacts: [],
  rooms: new Map(),
  activeRoomId: null,
  locked: false,
  lastActivity: Date.now()
};
window.__debug = state;

/* ============ RATE LIMITER ============ */
class RateLimiter {
  constructor(max, windowMs){ this.max=max; this.windowMs=windowMs; this.buckets=new Map(); }
  check(peerId){
    const now = Date.now();
    let b = this.buckets.get(peerId);
    if (!b){ b=[]; this.buckets.set(peerId,b); }
    while (b.length && now-b[0] > this.windowMs) b.shift();
    if (b.length >= this.max) return false;
    b.push(now); return true;
  }
}

/* ============ FILE RECEIVER ============ */
class FileReceiver {
  constructor(){ this.transfers = new Map(); }
  start(id, meta){ this.transfers.set(id, { ...meta, chunks:[], received:0 }); }
  chunk(id, index, dataB64){
    const t = this.transfers.get(id); if (!t) return;
    t.chunks[index] = b64d(dataB64); t.received++;
  }
  end(id){
    const t = this.transfers.get(id); if (!t) return null;
    this.transfers.delete(id);
    const blob = new Blob(t.chunks, { type: t.mime || 'application/octet-stream' });
    return { blob, name: t.name, mime: t.mime, size: t.size };
  }
}

/* ============ ROOM ============ */
class Room {
  constructor(id, name, password, nickname, opts={}){
    this.id = id; this.name = name; this.password = password || '';
    this.nickname = nickname || state.settings.nickname || 'Anónimo';
    this.trysteroRoom = null;
    this.sendRaw = null; this.sendCtrl = null;
    this.peers = new Map();
    this.messages = [];
    this.unread = 0;
    this.status = 'disconnected';
    this.ecdh = null;
    this.rateLimiter = new RateLimiter(RATE_LIMIT.max, RATE_LIMIT.window);
    this.fileReceiver = new FileReceiver();
    this.typingTimeout = null;
    this.strategy = opts.strategy || null;
    this.icePollTimer = null;
    this.peerWarnTimer = null;
    this.statsPollTimer = null;
    this.createdAt = opts.createdAt || Date.now();
    this.myFingerprint = null;
    this.myPubRaw = null;
    this.netStats = new Map();
    this.connectedOnce = false;
  }

  async init(){
    if (this.password) await cryptoClient.setKey(this.id, this.password, 'p2p-chat-v1:'+this.name);
    const ecdh = await genECDH();
    const pub = await exportPub(ecdh.publicKey);
    this.ecdh = { priv: ecdh.privateKey, pub };
    this.myFingerprint = pub.fp;
    this.myPubRaw = pub.raw;
    await this.loadMessages();
  }

  async loadMessages(){
    try {
      const stored = await db.byIndex('messages','room', this.id);
      this.messages = stored.map(m => m.msg).sort((a,b)=>a.ts-b.ts);
      Logger.info('db', `Cargados ${this.messages.length} mensajes de "${this.name}"`);
    } catch(e){ Logger.warn('db', 'Error cargando mensajes', e.message); }
  }
  async persistMessage(msg){
    try { await db.put('messages', { key: this.id+':'+msg.id, roomId: this.id, msg }); }
    catch(e){ Logger.warn('db', 'Error persistiendo', e.message); }
  }
  async persistRoom(){
    try {
      await db.put('rooms', {
        id: this.id, name: this.name,
        password: state.settings.savePasswords ? this.password : '',
        nickname: this.nickname, strategy: this.strategy, createdAt: this.createdAt
      });
    } catch(e){ Logger.warn('db', 'Error persistiendo sala', e.message); }
  }
  async removeRoom(){ try { await db.del('rooms', this.id); } catch{} }

  async deleteMessage(msgId, remote=false){
    this.messages = this.messages.filter(m => m.id !== msgId);
    try { await db.del('messages', this.id+':'+msgId); } catch{}
    if (remote && this.sendCtrl){
      try { this.sendCtrl({ t:'delete', id: msgId }); } catch{}
    }
    UI.renderMessages();
  }
  async clearMessages(){
    const stored = await db.byIndex('messages','room', this.id).catch(()=>[]);
    for (const s of stored) await db.del('messages', s.key).catch(()=>{});
    this.messages = [];
    UI.renderMessages();
  }

  async connect(){
    if (this.trysteroRoom) return;
    this.status = 'connecting';
    UI.updateRoomStatus(this);
    Logger.info('conn', `Conectando a "${this.name}" (${this.strategy || state.settings.strategy})`);

    const cfg = {
      appId: APP_ID,
      password: this.password || undefined,
      turnConfig: TURN_SERVERS
    };

    const strategy = this.strategy || state.settings.strategy;
    const strategies = strategy === 'auto' ? ['torrent','nostr','mqtt'] : [strategy];
    let lastErr = null;
    for (const strat of strategies){
      try {
        const fn = strat === 'torrent' ? joinRoom : strat === 'nostr' ? joinRoomNostr : joinRoomMqtt;
        this.trysteroRoom = fn(cfg, this.name);
        this.strategy = strat;
        Logger.ok('conn', `Signaling OK via ${strat}`);
        break;
      } catch(e){
        lastErr = e;
        Logger.warn('conn', `Fallo signaling ${strat}`, e.message);
      }
    }
    if (!this.trysteroRoom){
      this.status = 'error';
      Logger.err('conn', 'No se pudo inicializar signaling', lastErr?.message);
      UI.updateRoomStatus(this); return;
    }

    const [sendMsg, getMsg] = this.trysteroRoom.makeAction('msg');
    const [sendCtrl, getCtrl] = this.trysteroRoom.makeAction('ctrl');
    this.sendRaw = sendMsg;
    this.sendCtrl = sendCtrl;

    getMsg(async (payload, peerId) => {
      if (!this.rateLimiter.check(peerId)){
        Logger.warn('msg', `Rate limit para ${peerId.slice(0,6)}`); return;
      }
      await this.handleIncoming(payload, peerId);
    });
    getCtrl(async (payload, peerId) => {
      if (!this.rateLimiter.check(peerId)) return;
      await this.handleControl(payload, peerId);
    });

    this.trysteroRoom.onPeerJoin(async peerId => {
      Logger.ok('conn', `Peer conectado: ${peerId.slice(0,8)}`);
      this.peers.set(peerId, { nickname: null, sas: null, verified: false });
      try { sendCtrl({ t:'pub', raw: this.myPubRaw }, peerId); } catch(e){ Logger.warn('conn','sendCtrl pub fallo', e.message); }
      try { sendCtrl({ t:'nick', nickname: this.nickname }, peerId); } catch(e){ Logger.warn('conn','sendCtrl nick fallo', e.message); }
      this.flushPending();
      this.startIcePoll();
      this.startStatsPoll();
      this.clearPeerWarn();
      this.connectedOnce = true;
      UI.updateRoomStatus(this);
      UI.renderMessages();
    });

    this.trysteroRoom.onPeerLeave(peerId => {
      Logger.warn('conn', `Peer desconectado: ${peerId.slice(0,8)}`);
      this.peers.delete(peerId);
      this.netStats.delete(peerId);
      UI.updateRoomStatus(this);
      UI.renderMessages();
      if (state.settings.notifications && document.hidden && Notification.permission === 'granted'){
        new Notification(t('app_name'), { body: t('peer_left') });
      }
    });

    this.status = 'connected';
    UI.updateRoomStatus(this);
    this.flushPending();
    this.armPeerWarn();
  }

  armPeerWarn(){
    this.clearPeerWarn();
    this.peerWarnTimer = setTimeout(() => {
      if (this.peers.size === 0){
        Logger.warn('conn', `Sin peers tras ${PEER_WARN_MS/1000}s. ¿VPN bloqueando WebRTC?`);
        this.showNoPeerHint = true;
        UI.updateRoomStatus(this);
      }
    }, PEER_WARN_MS);
  }
  clearPeerWarn(){ clearTimeout(this.peerWarnTimer); this.peerWarnTimer = null; this.showNoPeerHint = false; }

  async flushPending(){
    if (!this.peers.size) return;
    const pending = this.messages.filter(m => m.status === 'pending' && m.self);
    for (const m of pending){
      try { await this.resendMessage(m); Logger.info('msg', `Reenviado ${m.id.slice(0,8)}`); }
      catch(e){ Logger.warn('msg', 'Error reenviando', e.message); }
    }
  }
  async resendMessage(m){
    const payload = await cryptoClient.encrypt(
      this.id, this.password || '', 'p2p-chat-v1:'+this.name,
      { t:'text', id: m.id, text: m.text, ts: m.ts, nickname: this.nickname }
    );
    this.sendRaw(payload);
    m.status = 'sent';
    await this.persistMessage(m);
  }

  async handleControl(payload, peerId){
    const peer = this.peers.get(peerId) || {};
    if (payload.t === 'pub'){
      peer.pubRaw = payload.raw;
      try {
        peer.sas = await deriveSAS(this.ecdh.priv, payload.raw);
        Logger.info('sas', `SAS con ${peerId.slice(0,6)}: ${peer.sas}`);
      } catch(e){ Logger.warn('sas', `Error derivando SAS: ${e.message}`); }
      this.peers.set(peerId, peer);
      UI.updateRoomStatus(this);
    } else if (payload.t === 'nick'){
      peer.nickname = String(payload.nickname || '').slice(0,32) || peerId.slice(0,6);
      this.peers.set(peerId, peer);
      UI.updateRoomStatus(this);
      UI.renderMessages();
    } else if (payload.t === 'ack'){
      const msg = this.messages.find(m => m.id === payload.id);
      if (msg && msg.status !== 'delivered'){
        msg.status = 'delivered';
        await this.persistMessage(msg);
        UI.renderMessages();
      }
    } else if (payload.t === 'typing'){
      const el = document.getElementById('typing');
      if (el){
        const nick = payload.nickname || peer.nickname || peerId.slice(0,6);
        el.textContent = t('is_typing', { name: nick });
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => { el.textContent=''; }, 3000);
      }
    } else if (payload.t === 'delete'){
      await this.deleteMessage(payload.id, false);
      Logger.info('msg', `Borrado remoto de ${payload.id.slice(0,8)}`);
    }
  }

  async handleIncoming(payload, peerId){
    let env;
    try {
      env = await cryptoClient.decrypt(
        this.id, this.password || '', 'p2p-chat-v1:'+this.name,
        payload.iv, payload.data
      );
    } catch(e){
      Logger.warn('msg', `No se pudo descifrar de ${peerId.slice(0,6)}: ${e.message}`);
      return;
    }
    const peer = this.peers.get(peerId) || {};
    const nickname = peer.nickname || env.nickname || peerId.slice(0,6);
    // Guardar el nickname en el peer si aún no lo teníamos (fix del "typing")
    if (!peer.nickname && env.nickname){
      peer.nickname = env.nickname;
      this.peers.set(peerId, peer);
    }

    if (env.t === 'text'){
      const msg = { id: env.id, peerId, nickname, text: env.text, type:'text', ts: env.ts,
        status:'delivered', encrypted: !!this.password, self:false };
      this.messages.push(msg);
      await this.persistMessage(msg);
      try { this.sendCtrl({ t:'ack', id: env.id }, peerId); } catch{}
      UI.renderMessages();
      this.notify(nickname, env.text);
    } else if (env.t === 'file-start'){
      this.fileReceiver.start(env.id, env.meta);
      Logger.info('file', `Recibiendo ${env.meta.name} (${fmtBytes(env.meta.size)})`);
    } else if (env.t === 'file-chunk'){
      this.fileReceiver.chunk(env.id, env.index, env.data);
    } else if (env.t === 'file-end'){
      const result = this.fileReceiver.end(env.id);
      if (result){
        let url = null;
        if (state.settings.saveFiles){
          url = URL.createObjectURL(result.blob);
        }
        const fileMeta = { name: result.name, size: result.size, mime: result.mime, url,
          isImage: result.mime.startsWith('image/'), isVideo: result.mime.startsWith('video/') };
        const msg = { id: env.id, peerId, nickname, type:'file', ts: env.ts,
          status:'delivered', encrypted: !!this.password, self:false, file: fileMeta };
        this.messages.push(msg);
        await this.persistMessage(msg);
        try { this.sendCtrl({ t:'ack', id: env.id }, peerId); } catch{}
        UI.renderMessages();
        this.notify(nickname, `Archivo: ${result.name}`);
      }
    }
  }

  async sendMessage(text){
    const msg = { id: crypto.randomUUID(), self:true, type:'text', text,
      ts: Date.now(), status: this.peers.size ? 'sent' : 'pending',
      encrypted: !!this.password, nickname: this.nickname };
    this.messages.push(msg);
    await this.persistMessage(msg);
    UI.renderMessages();
    if (!this.peers.size) return msg;
    const payload = await cryptoClient.encrypt(
      this.id, this.password || '', 'p2p-chat-v1:'+this.name,
      { t:'text', id: msg.id, text: msg.text, ts: msg.ts, nickname: this.nickname }
    );
    this.sendRaw(payload);
    return msg;
  }

  async sendFile(file){
    if (!this.peers.size){ Logger.warn('file','Sin peers'); return; }
    const id = crypto.randomUUID();
    const meta = { name: file.name, size: file.size, mime: file.type || 'application/octet-stream' };
    Logger.info('file', `Enviando ${meta.name} (${fmtBytes(meta.size)})`);

    let fileMeta = { ...meta };
    if (state.settings.saveFiles){
      fileMeta.url = URL.createObjectURL(file);
      fileMeta.isImage = meta.mime.startsWith('image/');
      fileMeta.isVideo = meta.mime.startsWith('video/');
    } else {
      fileMeta.omitted = true;
    }
    const msg = { id, self:true, type:'file', ts: Date.now(), status:'sent',
      encrypted: !!this.password, file: fileMeta, nickname: this.nickname };
    this.messages.push(msg);
    await this.persistMessage(msg);
    UI.renderMessages();

    const start = await cryptoClient.encrypt(this.id, this.password||'', 'p2p-chat-v1:'+this.name,
      { t:'file-start', id, meta, ts: msg.ts });
    this.sendRaw(start);
    const buf = await file.arrayBuffer();
    const chunks = Math.ceil(buf.byteLength / CHUNK_SIZE);
    for (let i = 0; i < chunks; i++){
      const slice = buf.slice(i*CHUNK_SIZE, (i+1)*CHUNK_SIZE);
      const payload = await cryptoClient.encrypt(this.id, this.password||'', 'p2p-chat-v1:'+this.name,
        { t:'file-chunk', id, index:i, data: b64e(slice) });
      this.sendRaw(payload);
      await new Promise(r => setTimeout(r, 5));
    }
    const end = await cryptoClient.encrypt(this.id, this.password||'', 'p2p-chat-v1:'+this.name,
      { t:'file-end', id, ts: Date.now() });
    this.sendRaw(end);
  }

  notify(title, body){
    if (!state.settings.notifications) return;
    if (!document.hidden) return;
    if (Notification.permission === 'granted'){
      new Notification(`💬 ${title}`, { body: body.slice(0,120), tag: this.id });
    }
    if (state.settings.sound){
      try {
        const ctx = new (window.AudioContext||window.webkitAudioContext)();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 660; g.gain.value = 0.05;
        o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 120);
      } catch{}
    }
  }

  startIcePoll(){
    if (this.icePollTimer) return;
    this.icePollTimer = setInterval(() => this.pollIce(), 6000);
    setTimeout(() => this.pollIce(), 1500);
  }
  async pollIce(){
    if (!this.trysteroRoom) return;
    try {
      const pcs = this.trysteroRoom.getPeers?.() || {};
      const entries = pcs instanceof Map ? [...pcs.entries()] : Object.entries(pcs);
      for (const [peerId, pc] of entries){
        if (!pc || typeof pc.getStats !== 'function') continue;
        try {
          const stats = await pc.getStats();
          let local='', remote='', proto='', relay=false, type='', pairState='';
          stats.forEach(r => {
            if (r.type === 'candidate-pair' && (r.state === 'succeeded' || r.nominated)){
              pairState = r.state;
              stats.forEach(x => {
                if (x.id === r.localCandidateId){ local = x.address||x.ip||''; proto = x.protocol||''; relay = x.candidateType==='relay'; type = x.candidateType||''; }
                if (x.id === r.remoteCandidateId){ remote = x.address||x.ip||''; }
              });
            }
          });
          const peer = this.peers.get(peerId) || {};
          const changed = peer.localIp !== local || peer.remoteIp !== remote ||
                          peer.relay !== relay || peer.connState !== pc.connectionState;
          Object.assign(peer, { localIp: local, remoteIp: remote, proto, relay, connType: type, connState: pc.connectionState });
          this.peers.set(peerId, peer);
          if (changed){
            Logger.info('ice', `Peer ${peerId.slice(0,6)} · conn=${pc.connectionState} · tipo=${type}${relay?' (relay)':''} · local=${local||'?'} · remoto=${remote||'?'}`);
            UI.updateRoomStatus(this);
          }
        } catch(e){ Logger.warn('ice', `getStats fallo: ${e.message}`); }
      }
    } catch(e){ Logger.warn('ice', `pollIce: ${e.message}`); }
  }

  startStatsPoll(){
    if (this.statsPollTimer) return;
    this.statsPollTimer = setInterval(() => this.pollStats(), 5000);
    setTimeout(() => this.pollStats(), 2000);
  }
  async pollStats(){
    if (!this.trysteroRoom) return;
    try {
      const pcs = this.trysteroRoom.getPeers?.() || {};
      const entries = pcs instanceof Map ? [...pcs.entries()] : Object.entries(pcs);
      for (const [peerId, pc] of entries){
        if (!pc || typeof pc.getStats !== 'function') continue;
        try {
          const stats = await pc.getStats();
          let sent = 0, recv = 0, rtt = null;
          stats.forEach(r => {
            // Sumar data-channels (uso principal)
            if (r.type === 'data-channel'){
              sent += r.bytesSent || 0;
              recv += r.bytesReceived || 0;
            }
            // Preferir transport si reporta más (agregado global)
            if (r.type === 'transport'){
              sent = Math.max(sent, r.bytesSent || 0);
              recv = Math.max(recv, r.bytesReceived || 0);
            }
            if (r.type === 'candidate-pair' && (r.state === 'succeeded' || r.nominated)){
              if (r.currentRoundTripTime != null) rtt = r.currentRoundTripTime * 1000;
            }
          });
          this.netStats.set(peerId, { sent, recv, rtt });
        } catch(e){ /* silencioso */ }
      }
      UI.renderStats();
    } catch{}
  }

  disconnect(){
    clearInterval(this.icePollTimer); this.icePollTimer = null;
    clearInterval(this.statsPollTimer); this.statsPollTimer = null;
    this.clearPeerWarn();
    try { this.trysteroRoom?.leave?.(); } catch{}
    this.trysteroRoom = null;
    this.peers.clear();
    this.netStats.clear();
    this.status = 'disconnected';
    UI.updateRoomStatus(this);
  }
}

/* ============ VIRTUAL LIST ============ */
class VirtualList {
  constructor(el, renderFn){
    this.el = el;
    this.renderFn = renderFn;
    this.items = [];
    this.heights = new Map();
    this.DEFAULT = 68;
    this.scrollHost = el;
    this.spacer = document.createElement('div');
    this.spacer.style.cssText = 'position:relative;width:100%';
    this.el.innerHTML = '';
    this.el.appendChild(this.spacer);
    this.scrollHost.addEventListener('scroll', () => this.onScroll(), { passive:true });
    this.raf = null;
  }
  setItems(items){
    const wasAtBottom = this.isAtBottom();
    this.items = items;
    this.render();
    if (wasAtBottom) this.scrollBottom();
  }
  isAtBottom(){
    const h = this.scrollHost.scrollHeight - this.scrollHost.scrollTop - this.scrollHost.clientHeight;
    return h < 60;
  }
  scrollBottom(){ this.scrollHost.scrollTop = this.scrollHost.scrollHeight; }
  getH(i){ return this.heights.get(this.items[i]?.id) || this.DEFAULT; }
  totalH(){ let h=0; for (let i=0;i<this.items.length;i++) h += this.getH(i); return h; }
  offsetOf(idx){ let h=0; for (let i=0;i<idx;i++) h += this.getH(i); return h; }
  indexAt(y){ let h=0; for (let i=0;i<this.items.length;i++){ const hh=this.getH(i); if (y < h+hh) return i; h += hh; } return this.items.length; }
  onScroll(){ if (this.raf) return; this.raf = requestAnimationFrame(() => { this.raf=null; this.render(); }); }
  render(){
    if (!this.items.length){ this.spacer.innerHTML=''; return; }
    const scrollTop = this.scrollHost.scrollTop;
    const viewH = this.scrollHost.clientHeight;
    const start = Math.max(0, this.indexAt(scrollTop) - 8);
    const end = Math.min(this.items.length, this.indexAt(scrollTop + viewH) + 8);
    const totalH = this.totalH();
    this.spacer.style.height = totalH + 'px';
    const frag = document.createDocumentFragment();
    const wrapper = document.createElement('div');
    wrapper.style.transform = `translateY(${this.offsetOf(start)}px)`;
    for (let i = start; i < end; i++){
      const node = this.renderFn(this.items[i], i);
      if (node) frag.appendChild(node);
    }
    wrapper.appendChild(frag);
    this.spacer.innerHTML = '';
    this.spacer.appendChild(wrapper);
    requestAnimationFrame(() => {
      const kids = wrapper.children;
      for (let i = 0; i < kids.length; i++){
        const node = kids[i];
        const id = node.dataset.id;
        const h = node.offsetHeight + 6;
        if (id && this.heights.get(id) !== h){
          this.heights.set(id, h);
        }
      }
    });
  }
}

/* ============ UI ============ */
const UI = {
  vlist: null,
  activeRoom(){ return state.rooms.get(state.activeRoomId); },

  renderTabs(){
    const el = document.getElementById('tabs');
    el.innerHTML = '';
    for (const r of state.rooms.values()){
      const btn = document.createElement('button');
      btn.className = 'tab' + (r.id === state.activeRoomId ? ' active' : '');
      const badge = r.unread > 0 ? `<span class="badge">${r.unread}</span>` : '';
      btn.innerHTML = `<span class="dot ${r.status==='connected'?'on':''}"></span>
        <span style="overflow:hidden;text-overflow:ellipsis">${escapeHtml(r.name)}</span>
        ${badge}<span class="close" data-close="${r.id}">✕</span>`;
      btn.onclick = e => {
        if (e.target.dataset.close){ UI.closeRoom(r.id); return; }
        UI.setActive(r.id);
      };
      el.appendChild(btn);
    }
  },

  async setActive(id){
    state.activeRoomId = id || null;
    const r = this.activeRoom();
    if (r) r.unread = 0;
    this.renderTabs();
    this.renderMessages();
    this.updateRoomStatus(r);
    document.getElementById('empty').hidden = !!r;
    document.getElementById('messages').hidden = !r;
    document.getElementById('composer').hidden = !r;
  },

  async closeRoom(id){
    const r = state.rooms.get(id);
    if (r){ r.disconnect(); await r.removeRoom(); state.rooms.delete(id); }
    if (state.activeRoomId === id){
      const next = state.rooms.keys().next().value;
      state.activeRoomId = next || null;
    }
    this.setActive(state.activeRoomId);
  },

  renderMessages(){
    const r = this.activeRoom();
    const host = document.getElementById('messages');
    if (!r){ host.innerHTML = ''; this.vlist = null; return; }
    if (!this.vlist || this.vlist.scrollHost !== host){
      host.innerHTML = '';
      host.style.cssText = 'flex:1;overflow-y:auto;padding:16px 20px;position:relative';
      this.vlist = new VirtualList(host, m => this.buildMsgNode(m, r));
    }
    this.vlist.setItems(r.messages);
  },

  buildMsgNode(m, r){
    const d = document.createElement('div');
    d.dataset.id = m.id;
    d.className = 'msg ' + (m.self ? 'self' : 'other');
    const time = new Date(m.ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const lock = m.encrypted ? '<span class="lock" title="E2EE">🔒</span>' : '<span class="lock" title="DTLS">🛡️</span>';
    const status = m.self && m.status ? `<span class="status">${m.status==='delivered'?'✓✓':m.status==='sent'?'✓':'⏳'}</span>` : '';

    // FIX: mis mensajes muestran mi nickname, no "Tu nombre"
    let whoHtml;
    if (m.self){
      whoHtml = escapeHtml(m.nickname || t('your_name'));
    } else {
      const nick = m.nickname || (m.peerId||'').slice(0,6);
      whoHtml = `<span class="peer-name" data-peer="${escapeHtml(m.peerId||'')}">${escapeHtml(nick)}</span>`;
    }
    const meta = `<span class="meta">${lock}<span>${whoHtml}</span><span>·</span><span>${time}</span>${status}</span>`;

    if (m.type === 'text'){
      d.innerHTML = meta + `<span>${linkify(m.text)}</span>`;
    } else if (m.type === 'file'){
      if (m.file?.omitted){
        d.innerHTML = meta + `<span class="file-omitted">📎 ${escapeHtml(m.file.name)}</span>`;
      } else {
        let media = '';
        if (m.file.isImage && m.file.url) media = `<img src="${m.file.url}" alt="${escapeHtml(m.file.name)}">`;
        else if (m.file.isVideo && m.file.url) media = `<video controls src="${m.file.url}"></video>`;
        const dl = m.file.url ? `<a href="${m.file.url}" download="${escapeHtml(m.file.name)}"><button>↓</button></a>` : '';
        d.innerHTML = meta + `<div class="file"><span>📎</span><span style="flex:1">${escapeHtml(m.file.name)}<br><small>${fmtBytes(m.file.size)}</small></span>${dl}</div>` + media;
      }
    } else if (m.type === 'system'){
      d.className = 'msg system';
      d.textContent = m.text;
    }

    // FIX: acciones de borrado para TODOS los mensajes (propios y remotos)
    // - local: siempre disponible
    // - remoto: solo para mensajes propios (borrar en el resto de dispositivos)
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    let actionsHtml = `<button data-del-local="1" title="${t('delete_local')}">🗑</button>`;
    if (m.self){
      actionsHtml += `<button data-del-remote="1" title="${t('delete_both')}">🗑↗</button>`;
    }
    actions.innerHTML = actionsHtml;
    const localBtn = actions.querySelector('[data-del-local]');
    if (localBtn) localBtn.onclick = ev => { ev.stopPropagation(); r.deleteMessage(m.id, false); };
    const remoteBtn = actions.querySelector('[data-del-remote]');
    if (remoteBtn) remoteBtn.onclick = ev => { ev.stopPropagation(); r.deleteMessage(m.id, true); };
    d.appendChild(actions);

    // FIX: click en el nombre del peer (mensajes remotos) → abrir menú del peer o guardar contacto
    if (!m.self){
      const nameEl = d.querySelector('.peer-name');
      if (nameEl){
        nameEl.style.cursor = 'pointer';
        nameEl.onclick = async ev => {
          ev.stopPropagation();
          const peerId = m.peerId;
          if (peerId && r.peers.has(peerId)){
            const rect = nameEl.getBoundingClientRect();
            UI.showPeerMenu({ clientX: rect.left, clientY: rect.bottom + 4 }, peerId);
          } else {
            // Peer offline: guardar la sala como contacto directamente
            const nick = m.nickname || (peerId||'').slice(0,6);
            await db.put('contacts', { id: r.id, nickname: nick, fp: null, verified: false, at: Date.now() });
            state.contacts = await db.all('contacts');
            Logger.ok('contacts', `Contacto guardado: ${r.name} (${nick})`);
            UI.renderContacts();
            const orig = nameEl.textContent;
            nameEl.textContent = '✓ ' + orig;
            setTimeout(() => { nameEl.textContent = orig; }, 1200);
          }
        };
      }
    }
    return d;
  },

  updateRoomStatus(r){
    const el = document.getElementById('statusBar');
    if (!r){ el.innerHTML = ''; return; }
    const peers = [...r.peers.entries()];
    const pills = [];
    pills.push(`<span class="pill static ${r.status==='connected'?'ok':'warn'}">${r.strategy || '—'} · ${t(r.status) || r.status}</span>`);
    pills.push(`<span class="pill static">${peers.length} ${peers.length===1?t('peer'):t('peers')}</span>`);
    for (const [id, p] of peers){
      const ip = p.remoteIp ? ` · ${p.remoteIp}` : '';
      const relay = p.relay ? ' · relay' : '';
      const ver = p.verified ? ' ✓' : '';
      pills.push(`<span class="pill" data-peer="${id}">${escapeHtml(p.nickname || id.slice(0,6))}${ver}${ip}${relay}</span>`);
    }
    if (r.showNoPeerHint && peers.length === 0){
      pills.push(`<span class="pill warn static">⚠️ ${t('without_peers')}</span>`);
    }
    el.innerHTML = pills.join(' ');
    el.querySelectorAll('[data-peer]').forEach(pill => {
      pill.onclick = e => UI.showPeerMenu(e, pill.dataset.peer);
    });
  },

  renderStats(){
    const el = document.getElementById('netStats');
    if (!el) return;
    const r = this.activeRoom();
    if (!r){ el.innerHTML = ''; return; }
    if (!r.peers.size){ el.innerHTML = `<p class="hint">${t('without_peers')}</p>`; return; }
    const rows = [];
    for (const [peerId, p] of r.peers){
      const s = r.netStats.get(peerId) || {};
      rows.push(`<div class="stat-row">
        <span>${escapeHtml(p.nickname||peerId.slice(0,6))}</span>
        <span>↓ ${fmtBytes(s.recv||0)}</span>
        <span>↑ ${fmtBytes(s.sent||0)}</span>
        <span>${s.rtt != null ? s.rtt.toFixed(0)+' ms' : '—'}</span>
        <span>${p.connType||'?'}${p.relay?' · relay':''}</span>
      </div>`);
    }
    el.innerHTML = rows.join('');
  },

  showPeerMenu(evt, peerId){
    document.getElementById('peerMenu')?.remove();
    const r = this.activeRoom(); if (!r) return;
    const p = r.peers.get(peerId); if (!p) return;
    const menu = document.createElement('div');
    menu.id = 'peerMenu';
    menu.style.left = Math.min(evt.clientX, window.innerWidth-200) + 'px';
    menu.style.top = Math.min(evt.clientY, window.innerHeight-180) + 'px';
    menu.innerHTML = `
      <button id="pmSas">🔐 ${t('view_sas')}</button>
      <button id="pmSave">💾 ${t('save_contact')}</button>
      <button id="pmCopyId">📋 ${t('copy_peer_id')}</button>`;
    document.body.appendChild(menu);
    const close = () => menu.remove();
    document.getElementById('pmSas').onclick = () => { close(); UI.renderSAS(peerId); document.getElementById('sasDialog').showModal(); };
    document.getElementById('pmSave').onclick = async () => {
      close();
      await db.put('contacts', { id: r.id, nickname: p.nickname||peerId.slice(0,6),
        fp: p.pubRaw?.slice(0,16), verified: !!p.verified, at: Date.now() });
      state.contacts = await db.all('contacts');
      Logger.ok('contacts', `Contacto guardado: ${r.name}`);
      UI.renderContacts();
    };
    document.getElementById('pmCopyId').onclick = () => { navigator.clipboard.writeText(peerId); close(); };
    setTimeout(() => document.addEventListener('click', close, { once:true }), 50);
  },

  renderContacts(){
    const el = document.getElementById('contactsList');
    if (!state.contacts.length){ el.innerHTML = `<p class="hint">${t('contacts_hint')}</p>`; return; }
    el.innerHTML = state.contacts.map(c => `
      <div class="list-item">
        <div class="info">
          <div class="name">${escapeHtml(c.nickname || c.id)} ${c.verified?'✅':''}</div>
          <div class="sub">${escapeHtml(c.id)}${c.fp?' · '+escapeHtml(c.fp):''}</div>
        </div>
        <div class="actions">
          <button class="btn sec sm" data-open="${escapeHtml(c.id)}">${t('open')}</button>
          <button class="btn sec sm" data-del="${escapeHtml(c.id)}">✕</button>
        </div>
      </div>`).join('');
    el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => {
      const c = state.contacts.find(x => x.id === b.dataset.open);
      const f = document.getElementById('newChatForm');
      f.room.value = c.id;
      f.nickname.value = c.nickname || '';
      document.getElementById('newChatDialog').showModal();
    });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      await db.del('contacts', b.dataset.del);
      state.contacts = state.contacts.filter(c => c.id !== b.dataset.del);
      UI.renderContacts();
    });
  },

  renderSAS(peerId){
    const r = this.activeRoom(); if (!r) return;
    const p = r.peers.get(peerId); if (!p) return;
    document.getElementById('sasCode').textContent = p.sas || t('sas_waiting');
    document.getElementById('sasPeer').textContent = `${p.nickname||peerId.slice(0,8)} — fp: ${p.pubRaw ? p.pubRaw.slice(0,16) : '—'}`;
    document.getElementById('sasVerify').onclick = async () => {
      p.verified = true;
      r.peers.set(peerId, p);
      await db.put('contacts', { id: r.id, nickname: p.nickname||peerId.slice(0,6),
        fp: p.pubRaw?.slice(0,16), verified: true, at: Date.now() });
      state.contacts = await db.all('contacts');
      Logger.ok('sas', `Verificado: ${peerId.slice(0,6)}`);
      document.getElementById('sasDialog').close();
      UI.renderContacts();
      UI.updateRoomStatus(r);
      UI.renderMessages();
    };
  },

  renderDiag(){
    const el = document.getElementById('diag');
    const info = {
      selfId,
      fingerprint: state.ecdh?.pub?.fp || '—',
      strategy: state.settings.strategy,
      online: navigator.onLine,
      hidden: document.hidden,
      locked: state.locked,
      lang: getLang(),
      theme: state.settings.theme,
      fontSize: state.settings.fontSize,
      rooms: [...state.rooms.values()].map(r => ({
        id: r.id, name: r.name, status: r.status, strategy: r.strategy,
        messages: r.messages.length,
        peers: [...r.peers.entries()].map(([pid, p]) => ({
          id: pid.slice(0,8), nickname: p.nickname, sas: p.sas, verified: !!p.verified,
          connState: p.connState, connType: p.connType, relay: !!p.relay,
          local: p.localIp, remote: p.remoteIp, proto: p.proto
        }))
      }))
    };
    el.textContent = JSON.stringify(info, null, 2);
  },

  async renderStorage(){
    const el = document.getElementById('storageInfo');
    if (!el) return;
    try {
      const est = await navigator.storage.estimate();
      const pct = est.quota ? (est.usage / est.quota * 100).toFixed(1) : '?';
      el.textContent = `${t('storage_usage')}: ${fmtBytes(est.usage||0)} / ${fmtBytes(est.quota||0)} (${pct}%)`;
    } catch {
      el.textContent = `${t('storage_usage')}: —`;
    }
  }
};

/* ============ CONFIRM ============ */
function confirmDialog(title, msg){
  return new Promise(resolve => {
    const dlg = document.getElementById('confirmDialog');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent = msg;
    const yes = document.getElementById('confirmYes');
    const no = document.getElementById('confirmNo');
    const done = v => { yes.onclick=null; no.onclick=null; dlg.close(); resolve(v); };
    yes.onclick = () => done(true);
    no.onclick = () => done(false);
    dlg.addEventListener('cancel', e => { e.preventDefault(); done(false); }, { once:true });
    dlg.showModal();
  });
}

/* ============ THEME / FONT / LANG ============ */
function applyTheme(){
  const theme = state.settings.theme;
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('theme-dark', dark);
  document.documentElement.classList.toggle('theme-light', !dark);
}
function applyFontSize(){
  const s = state.settings.fontSize;
  document.documentElement.classList.remove('font-small','font-normal','font-large');
  document.documentElement.classList.add('font-' + s);
}
function applyLang(){
  setLang(state.settings.lang);
  applyTranslations();
}
function applyTranslations(){
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.dataset.i18n;
    el.textContent = t(k);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  document.title = t('app_name');
}

/* ============ PIN ============ */
async function checkPinExists(){
  const stored = await db.get('settings', PIN_HASH_KEY);
  return stored?.val || null;
}
async function setPin(pin){
  const hash = await sha256hex('pin-salt-v1:' + pin);
  await db.put('settings', { key: PIN_HASH_KEY, val: hash });
  state.settings.pinEnabled = true;
  state.settings.pinHash = hash;
  await db.put('settings', { key:'main', val: state.settings });
}
async function clearPin(){
  await db.del('settings', PIN_HASH_KEY);
  state.settings.pinEnabled = false;
  state.settings.pinHash = null;
  await db.put('settings', { key:'main', val: state.settings });
}
function showLock(){
  state.locked = true;
  document.getElementById('lockScreen').hidden = false;
  document.getElementById('lockInput').value = '';
  document.getElementById('lockInput').focus();
}
function hideLock(){
  state.locked = false;
  document.getElementById('lockScreen').hidden = true;
}
async function tryUnlock(){
  const pin = document.getElementById('lockInput').value;
  const hash = await sha256hex('pin-salt-v1:' + pin);
  if (hash === state.settings.pinHash){
    hideLock();
    state.lastActivity = Date.now();
  } else {
    document.getElementById('lockError').hidden = false;
    setTimeout(() => { document.getElementById('lockError').hidden = true; }, 2000);
  }
}
function armInactivityWatch(){
  setInterval(() => {
    if (!state.settings.pinEnabled) return;
    if (state.locked) return;
    if (Date.now() - state.lastActivity > INACTIVITY_LOCK_MS){
      showLock();
    }
  }, 30000);
  const bump = () => { state.lastActivity = Date.now(); };
  ['click','keydown','touchstart','mousemove'].forEach(ev => document.addEventListener(ev, bump, { passive:true }));
}

/* ============ FILE WARNING ============ */
async function maybeShowFileWarning(){
  if (state.settings.fileWarnShown) return true;
  return new Promise(resolve => {
    const dlg = document.getElementById('fileWarnDialog');
    const dont = document.getElementById('fileWarnDont');
    document.getElementById('fileWarnOk').onclick = async () => {
      if (dont.checked){
        state.settings.fileWarnShown = true;
        await db.put('settings', { key:'main', val: state.settings });
      }
      dlg.close();
      resolve(true);
    };
    dlg.addEventListener('cancel', e => { e.preventDefault(); resolve(false); }, { once:true });
    dlg.showModal();
  });
}

/* ============ CREATE / RESTORE ROOMS ============ */
async function createChat({ name, password, nickname }){
  const roomId = name.toLowerCase().trim();
  if (state.rooms.has(roomId)){
    await UI.setActive(roomId);
    const existing = state.rooms.get(roomId);
    if (existing.status !== 'connected') await existing.connect();
    return existing;
  }
  const r = new Room(roomId, name.trim(), password||'', nickname);
  await r.init();
  await r.persistRoom();
  state.rooms.set(roomId, r);
  UI.renderTabs();
  await UI.setActive(roomId);
  await r.connect();
  Logger.info('app', `Chat "${name}" creado`);
  return r;
}

async function restoreRooms(){
  const saved = await db.all('rooms').catch(()=>[]) || [];
  if (!saved.length) return;
  Logger.info('app', `Restaurando ${saved.length} sala(s)`);
  for (const s of saved){
    try {
      const r = new Room(s.id, s.name, s.password || '', s.nickname, { strategy: s.strategy, createdAt: s.createdAt });
      await r.init();
      state.rooms.set(s.id, r);
    } catch(e){ Logger.warn('app', `Fallo restaurando "${s.name}"`, e.message); }
  }
  UI.renderTabs();
  if (state.rooms.size) UI.setActive(state.rooms.keys().next().value);
  for (const r of state.rooms.values()){
    try { await r.connect(); } catch(e){ Logger.warn('app','Reconnect fallo', e.message); }
    await new Promise(res => setTimeout(res, 800));
  }
}

/* ============ ACTIONS ============ */
async function restartConnections(){
  Logger.info('app', t('restarting'));
  for (const r of state.rooms.values()) r.disconnect();
  await new Promise(res => setTimeout(res, 500));
  for (const r of state.rooms.values()){
    try { await r.connect(); } catch(e){ Logger.warn('app','Restart fallo', e.message); }
    await new Promise(res => setTimeout(res, 400));
  }
  Logger.ok('app', t('restored'));
}
async function clearSignalingCache(){
  Logger.info('app', t('clearing'));
  for (const r of state.rooms.values()) r.disconnect();
  try { sessionStorage.clear(); } catch{}
  try {
    const keys = await caches.keys();
    for (const k of keys) if (k.includes('trystero')) await caches.delete(k);
  } catch{}
  await new Promise(res => setTimeout(res, 500));
  await restartConnections();
}
async function hardReset(){
  const ok = await confirmDialog(t('hard_reset'), t('confirm_hard_reset'));
  if (!ok) return;
  Logger.warn('app', t('resetting'));
  for (const r of state.rooms.values()) r.disconnect();
  for (const s of ['messages','contacts','logs','settings','rooms']) await db.clear(s).catch(()=>{});
  try { localStorage.clear(); sessionStorage.clear(); } catch{}
  try {
    if ('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) await reg.unregister();
    }
  } catch{}
  location.reload();
}

/* ============ INIT ============ */
async function init(){
  try {
    const s = await db.get('settings', 'main');
    if (s?.val) Object.assign(state.settings, s.val);
  } catch{}
  state.contacts = await db.all('contacts').catch(()=>[]) || [];

  const existingPin = await checkPinExists();
  if (existingPin){
    state.settings.pinEnabled = true;
    state.settings.pinHash = existingPin;
  }

  applyTheme();
  applyFontSize();
  applyLang();

  const ecdh = await genECDH();
  const pub = await exportPub(ecdh.publicKey);
  state.ecdh = { priv: ecdh.privateKey, pub };

  document.getElementById('setNickname').value = state.settings.nickname || '';
  document.getElementById('setSelfId').value = selfId;
  document.getElementById('setFingerprint').value = pub.fp;
  document.getElementById('optNotif').checked = state.settings.notifications;
  document.getElementById('optSound').checked = state.settings.sound;
  document.getElementById('optLogs').checked = state.settings.persistLogs;
  document.getElementById('optStrategy').value = state.settings.strategy;
  document.getElementById('optSavePw').checked = state.settings.savePasswords;
  document.getElementById('optSaveFiles').checked = state.settings.saveFiles;
  document.getElementById('optTheme').value = state.settings.theme;
  document.getElementById('optFont').value = state.settings.fontSize;
  document.getElementById('optLang').value = state.settings.lang;

  await UI.renderStorage();

  document.getElementById('menuBtn').onclick = async () => {
    document.getElementById('drawer').classList.add('on');
    document.getElementById('backdrop').classList.add('on');
    Logger.render();
    UI.renderContacts();
    UI.renderDiag();
    UI.renderStats();
    await UI.renderStorage();
  };
  const closeDrawer = () => {
    document.getElementById('drawer').classList.remove('on');
    document.getElementById('backdrop').classList.remove('on');
  };
  document.getElementById('closeDrawer').onclick = closeDrawer;
  document.getElementById('backdrop').onclick = closeDrawer;

  document.querySelectorAll('.drawer-tabs button').forEach(b => {
    b.onclick = async () => {
      document.querySelectorAll('.drawer-tabs button').forEach(x => x.classList.remove('on'));
      document.querySelectorAll('.panel').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      document.querySelector(`.panel[data-panel="${b.dataset.tab}"]`).classList.add('on');
      if (b.dataset.tab === 'logs') Logger.render();
      if (b.dataset.tab === 'diag') UI.renderDiag();
      if (b.dataset.tab === 'contacts') UI.renderContacts();
      if (b.dataset.tab === 'stats') UI.renderStats();
      if (b.dataset.tab === 'settings') await UI.renderStorage();
    };
  });

  document.getElementById('setNickname').onchange = async e => {
    state.settings.nickname = e.target.value.slice(0,32);
    await db.put('settings', { key:'main', val: state.settings });
  };
  document.getElementById('optNotif').onchange = async e => {
    if (e.target.checked){
      const p = await Notification.requestPermission();
      if (p !== 'granted'){ e.target.checked = false; return; }
    }
    state.settings.notifications = e.target.checked;
    await db.put('settings', { key:'main', val: state.settings });
  };
  document.getElementById('optSound').onchange = async e => {
    state.settings.sound = e.target.checked;
    await db.put('settings', { key:'main', val: state.settings });
  };
  document.getElementById('optLogs').onchange = async e => {
    state.settings.persistLogs = e.target.checked;
    await db.put('settings', { key:'main', val: state.settings });
  };
  document.getElementById('optSavePw').onchange = async e => {
    state.settings.savePasswords = e.target.checked;
    await db.put('settings', { key:'main', val: state.settings });
    for (const r of state.rooms.values()) await r.persistRoom();
  };
  document.getElementById('optSaveFiles').onchange = async e => {
    state.settings.saveFiles = e.target.checked;
    await db.put('settings', { key:'main', val: state.settings });
  };
  document.getElementById('optStrategy').onchange = async e => {
    state.settings.strategy = e.target.value;
    await db.put('settings', { key:'main', val: state.settings });
  };
  document.getElementById('optTheme').onchange = async e => {
    state.settings.theme = e.target.value;
    await db.put('settings', { key:'main', val: state.settings });
    applyTheme();
  };
  document.getElementById('optFont').onchange = async e => {
    state.settings.fontSize = e.target.value;
    await db.put('settings', { key:'main', val: state.settings });
    applyFontSize();
  };
  document.getElementById('optLang').onchange = async e => {
    state.settings.lang = e.target.value;
    await db.put('settings', { key:'main', val: state.settings });
    applyLang();
  };

  const refreshPinUI = () => {
    const el = document.getElementById('pinStatus');
    el.textContent = state.settings.pinEnabled ? '✅ ' + t('pin_lock') : '—';
    document.getElementById('btnPinSet').hidden = state.settings.pinEnabled;
    document.getElementById('btnPinChange').hidden = !state.settings.pinEnabled;
    document.getElementById('btnPinDisable').hidden = !state.settings.pinEnabled;
  };
  document.getElementById('btnPinSet').onclick = async () => {
    const pin = prompt(t('set_pin') + ':');
    if (!pin || pin.length < 4) return;
    await setPin(pin);
    refreshPinUI();
    Logger.ok('pin','PIN activado');
  };
  document.getElementById('btnPinChange').onclick = async () => {
    const pin = prompt(t('change_pin') + ':');
    if (!pin || pin.length < 4) return;
    await setPin(pin);
    Logger.ok('pin','PIN cambiado');
  };
  document.getElementById('btnPinDisable').onclick = async () => {
    if (!confirm(t('disable_pin') + '?')) return;
    await clearPin();
    refreshPinUI();
    Logger.ok('pin','PIN desactivado');
  };
  refreshPinUI();

  document.getElementById('logFilterAll').onclick = () => { Logger.filter='all'; Logger.render(); };
  document.getElementById('logFilterConn').onclick = () => { Logger.filter='conn'; Logger.render(); };
  document.getElementById('logFilterIce').onclick = () => { Logger.filter='ice'; Logger.render(); };
  document.getElementById('logFilterMsg').onclick = () => { Logger.filter='msg'; Logger.render(); };
  document.getElementById('logClear').onclick = async () => { Logger.entries=[]; await db.clear('logs').catch(()=>{}); Logger.render(); };

  document.getElementById('diagRefresh').onclick = () => UI.renderDiag();
  document.getElementById('diagCopy').onclick = () => navigator.clipboard.writeText(document.getElementById('diag').textContent);

  document.getElementById('btnRestart').onclick = restartConnections;
  document.getElementById('btnClearSig').onclick = clearSignalingCache;
  document.getElementById('btnHardReset').onclick = hardReset;
  document.getElementById('btnClearHistory').onclick = async () => {
    const r = UI.activeRoom(); if (!r) return;
    const ok = await confirmDialog(t('clear_history'), t('confirm_clear_history'));
    if (!ok) return;
    await r.clearMessages();
    Logger.warn('app', `Historial borrado de "${r.name}"`);
  };

  document.getElementById('contactAdd').onclick = async () => {
    const room = document.getElementById('contactRoom').value.trim().toLowerCase();
    const nick = document.getElementById('contactNick').value.trim();
    if (!room) return;
    await db.put('contacts', { id: room, nickname: nick || room, at: Date.now() });
    state.contacts = await db.all('contacts');
    document.getElementById('contactRoom').value = '';
    document.getElementById('contactNick').value = '';
    UI.renderContacts();
  };

  const dlg = document.getElementById('newChatDialog');
  const form = document.getElementById('newChatForm');
  const openNew = () => {
    form.reset();
    form.nickname.value = state.settings.nickname || '';
    form.room.value = 'sala-' + Math.random().toString(36).slice(2,8);
    dlg.showModal();
  };
  document.getElementById('newChatBtn').onclick = openNew;
  document.getElementById('emptyNew').onclick = openNew;
  form.addEventListener('cancel', e => { e.preventDefault(); dlg.close(); });
  form.querySelector('button[value="cancel"]').onclick = () => dlg.close();
  form.onsubmit = async e => {
    e.preventDefault();
    const data = new FormData(form);
    dlg.close();
    await createChat({ name: data.get('room'), password: data.get('password'), nickname: data.get('nickname') });
  };

  const composer = document.getElementById('composer');
  const input = document.getElementById('input');
  composer.onsubmit = async e => {
    e.preventDefault();
    const r = UI.activeRoom(); if (!r) return;
    const text = input.value.trim(); if (!text) return;
    input.value = ''; input.style.height = 'auto';
    await r.sendMessage(text);
  };
  input.oninput = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    const r = UI.activeRoom(); if (!r) return;
    // FIX: enviar nickname en el typing
    try { r.sendCtrl({ t:'typing', nickname: r.nickname }); } catch{}
  };
  input.onkeydown = e => {
    if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); composer.requestSubmit(); }
  };

  document.getElementById('attach').onclick = async () => {
    const ok = await maybeShowFileWarning();
    if (!ok) return;
    document.getElementById('filePicker').click();
  };
  document.getElementById('filePicker').onchange = async e => {
    const r = UI.activeRoom(); if (!r) return;
    for (const f of e.target.files) await r.sendFile(f);
    e.target.value = '';
  };
  const area = document.getElementById('chatArea');
  const overlay = document.getElementById('dropOverlay');
  area.addEventListener('dragover', e => { e.preventDefault(); overlay.classList.add('on'); });
  area.addEventListener('dragleave', e => { if (e.target === area) overlay.classList.remove('on'); });
  area.addEventListener('drop', async e => {
    e.preventDefault(); overlay.classList.remove('on');
    const r = UI.activeRoom(); if (!r) return;
    const ok = await maybeShowFileWarning();
    if (!ok) return;
    for (const f of e.dataTransfer.files) await r.sendFile(f);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape'){
      document.getElementById('drawer').classList.remove('on');
      document.getElementById('backdrop').classList.remove('on');
    }
    if ((e.ctrlKey||e.metaKey) && e.key === 'k'){ e.preventDefault(); openNew(); }
  });

  window.addEventListener('online', () => {
    Logger.info('net', 'Conexión de red restaurada');
    for (const r of state.rooms.values()) r.flushPending();
  });
  window.addEventListener('offline', () => Logger.warn('net', 'Sin conexión de red'));
  window.addEventListener('beforeunload', () => {
    for (const r of state.rooms.values()){ try { r.trysteroRoom?.leave?.(); } catch{} }
  });

  document.getElementById('lockUnlock').onclick = tryUnlock;
  document.getElementById('lockInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') tryUnlock();
  });

  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').then(
      () => Logger.info('pwa', 'Service worker registrado'),
      e => Logger.warn('pwa', 'Fallo SW', e.message)
    );
  }

  Logger.info('app', 'App iniciada', { selfId });

  if (state.settings.pinEnabled) showLock();

  armInactivityWatch();

  await restoreRooms();
}

init();