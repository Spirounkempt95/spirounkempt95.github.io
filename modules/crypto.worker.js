const enc = new TextEncoder();
const dec = new TextDecoder();
const PERIOD = 24 * 60 * 60 * 1000; // 24h

const rooms = new Map(); // roomId -> { password, salt, slots: Map<slot, key> }

function b64e(buf){
  const b = new Uint8Array(buf); let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function b64d(s){
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password, salt){
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name:'PBKDF2', salt: enc.encode(salt), iterations: 200000, hash:'SHA-256' },
    km, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']
  );
}

function currentSlot(){ return Math.floor(Date.now() / PERIOD); }

async function getEntry(roomId, password, salt){
  let entry = rooms.get(roomId);
  if (!entry || entry.password !== password || entry.salt !== salt){
    entry = { password, salt, slots: new Map() };
    rooms.set(roomId, entry);
  }
  return entry;
}

async function getKey(roomId, password, salt){
  const entry = await getEntry(roomId, password, salt);
  const slot = currentSlot();
  if (!entry.slots.has(slot)){
    entry.slots.set(slot, await deriveKey(password, `${salt}:${slot}`));
    // Limpiar slots con más de 2 de antigüedad
    for (const s of [...entry.slots.keys()]) if (Math.abs(s - slot) > 2) entry.slots.delete(s);
  }
  return entry;
}

self.onmessage = async e => {
  const { id, op, roomId, payload } = e.data;
  try {
    if (op === 'setKey'){
      await getKey(roomId, payload.password, payload.salt);
      self.postMessage({ id, result: true });
    } else if (op === 'encrypt'){
      const entry = await getKey(roomId, payload.password, payload.salt);
      const slot = currentSlot();
      const key = entry.slots.get(slot);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, enc.encode(JSON.stringify(payload.data)));
      self.postMessage({ id, result: { enc:1, iv: Array.from(iv), data: b64e(ct) } });
    } else if (op === 'decrypt'){
      const entry = await getEntry(roomId, payload.password, payload.salt);
      // Asegurar slot actual
      await getKey(roomId, payload.password, payload.salt);
      let lastErr = null;
      // Probar slot actual primero, luego anteriores
      const slot = currentSlot();
      const order = [...entry.slots.keys()].sort((a,b) => Math.abs(a-slot) - Math.abs(b-slot));
      for (const s of order){
        try {
          const pt = await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(payload.iv)}, entry.slots.get(s), b64d(payload.data));
          self.postMessage({ id, result: JSON.parse(dec.decode(pt)) });
          return;
        } catch(err){ lastErr = err; }
      }
      throw lastErr || new Error('decrypt failed');
    } else if (op === 'drop'){
      rooms.delete(roomId);
      self.postMessage({ id, result: true });
    } else {
      throw new Error('unknown op');
    }
  } catch(err){
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
