// node_modules/trystero/src/utils.js
var { floor, random, sin } = Math;
var libName = "Trystero";
var alloc = (n, f) => Array(n).fill().map(f);
var charSet = "0123456789AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz";
var genId = (n) => alloc(n, () => charSet[floor(random() * charSet.length)]).join("");
var selfId = genId(20);
var all = Promise.all.bind(Promise);
var isBrowser = typeof window !== "undefined";
var { entries, fromEntries, keys } = Object;
var noOp = () => {
};
var mkErr = (msg) => new Error(`${libName}: ${msg}`);
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var encodeBytes = (txt) => encoder.encode(txt);
var decodeBytes = (buffer) => decoder.decode(buffer);
var topicPath = (...parts) => parts.join("@");
var shuffle = (xs, seed) => {
  const a = [...xs];
  const rand = () => {
    const x = sin(seed++) * 1e4;
    return x - floor(x);
  };
  let i = a.length;
  while (i) {
    const j = floor(rand() * i--);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
var getRelays = (config, defaults, defaultN, deriveFromAppId) => {
  const relayUrls = config.relayUrls || (deriveFromAppId ? shuffle(defaults, strToNum(config.appId)) : defaults);
  return relayUrls.slice(
    0,
    config.relayUrls ? config.relayUrls.length : config.relayRedundancy || defaultN
  );
};
var toJson = JSON.stringify;
var fromJson = JSON.parse;
var strToNum = (str, limit = Number.MAX_SAFE_INTEGER) => str.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % limit;
var defaultRetryMs = 3333;
var socketRetryPeriods = {};
var makeSocket = (url, onMessage) => {
  const client = {};
  const init = () => {
    const socket = new WebSocket(url);
    socket.onclose = () => {
      socketRetryPeriods[url] ??= defaultRetryMs;
      setTimeout(init, socketRetryPeriods[url]);
      socketRetryPeriods[url] *= 2;
    };
    socket.onmessage = (e) => onMessage(e.data);
    client.socket = socket;
    client.url = socket.url;
    client.ready = new Promise(
      (res) => socket.onopen = () => {
        res(client);
        socketRetryPeriods[url] = defaultRetryMs;
      }
    );
    client.send = (data) => {
      if (socket.readyState === 1) {
        socket.send(data);
      }
    };
  };
  init();
  return client;
};
var socketGetter = (clientMap) => () => fromEntries(entries(clientMap).map(([url, client]) => [url, client.socket]));

// node_modules/trystero/src/crypto.js
var algo = "AES-GCM";
var strToSha1 = {};
var pack = (buff) => btoa(String.fromCharCode.apply(null, new Uint8Array(buff)));
var unpack = (packed) => {
  const str = atob(packed);
  return new Uint8Array(str.length).map((_, i) => str.charCodeAt(i)).buffer;
};
var sha1 = async (str) => (
  // eslint-disable-next-line require-atomic-updates
  strToSha1[str] ||= Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-1", encodeBytes(str)))
  ).map((b) => b.toString(36)).join("")
);
var genKey = async (secret, appId, roomId) => crypto.subtle.importKey(
  "raw",
  await crypto.subtle.digest(
    { name: "SHA-256" },
    encodeBytes(`${secret}:${appId}:${roomId}`)
  ),
  { name: algo },
  false,
  ["encrypt", "decrypt"]
);
var joinChar = "$";
var ivJoinChar = ",";
var encrypt = async (keyP, plaintext) => {
  const iv = crypto.getRandomValues(new Uint8Array(16));
  return iv.join(ivJoinChar) + joinChar + pack(
    await crypto.subtle.encrypt(
      { name: algo, iv },
      await keyP,
      encodeBytes(plaintext)
    )
  );
};
var decrypt = async (keyP, raw) => {
  const [iv, c] = raw.split(joinChar);
  return decodeBytes(
    await crypto.subtle.decrypt(
      { name: algo, iv: new Uint8Array(iv.split(ivJoinChar)) },
      await keyP,
      unpack(c)
    )
  );
};

// node_modules/trystero/src/peer.js
var iceTimeout = 5e3;
var iceStateEvent = "icegatheringstatechange";
var offerType = "offer";
var answerType = "answer";
var peer_default = (initiator, { rtcConfig, rtcPolyfill, turnConfig }) => {
  const pc = new (rtcPolyfill || RTCPeerConnection)({
    iceServers: defaultIceServers.concat(turnConfig || []),
    ...rtcConfig
  });
  const handlers = {};
  let makingOffer = false;
  let isSettingRemoteAnswerPending = false;
  let dataChannel = null;
  const setupDataChannel = (channel) => {
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = 65535;
    channel.onmessage = (e) => handlers.data?.(e.data);
    channel.onopen = () => handlers.connect?.();
    channel.onclose = () => handlers.close?.();
    channel.onerror = (err) => handlers.error?.(err);
  };
  const waitForIceGathering = (pc2) => Promise.race([
    new Promise((res) => {
      const checkState = () => {
        if (pc2.iceGatheringState === "complete") {
          pc2.removeEventListener(iceStateEvent, checkState);
          res();
        }
      };
      pc2.addEventListener(iceStateEvent, checkState);
      checkState();
    }),
    new Promise((res) => setTimeout(res, iceTimeout))
  ]).then(() => ({
    type: pc2.localDescription.type,
    sdp: pc2.localDescription.sdp.replace(/a=ice-options:trickle\s\n/g, "")
  }));
  if (initiator) {
    dataChannel = pc.createDataChannel("data");
    setupDataChannel(dataChannel);
  } else {
    pc.ondatachannel = ({ channel }) => {
      dataChannel = channel;
      setupDataChannel(channel);
    };
  }
  pc.onnegotiationneeded = async () => {
    try {
      makingOffer = true;
      await pc.setLocalDescription();
      const offer = await waitForIceGathering(pc);
      handlers.signal?.(offer);
    } catch (err) {
      handlers.error?.(err);
    } finally {
      makingOffer = false;
    }
  };
  pc.onconnectionstatechange = () => {
    if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
      handlers.close?.();
    }
  };
  pc.ontrack = (e) => {
    handlers.track?.(e.track, e.streams[0]);
    handlers.stream?.(e.streams[0]);
  };
  pc.onremovestream = (e) => handlers.stream?.(e.stream);
  if (initiator) {
    if (!pc.canTrickleIceCandidates) {
      pc.onnegotiationneeded();
    }
  }
  return {
    created: Date.now(),
    connection: pc,
    get channel() {
      return dataChannel;
    },
    get isDead() {
      return pc.connectionState === "closed";
    },
    async signal(sdp) {
      if (dataChannel?.readyState === "open" && !sdp.sdp?.includes("a=rtpmap")) {
        return;
      }
      try {
        if (sdp.type === offerType) {
          if (makingOffer || pc.signalingState !== "stable" && !isSettingRemoteAnswerPending) {
            if (initiator) {
              return;
            }
            await all([
              pc.setLocalDescription({ type: "rollback" }),
              pc.setRemoteDescription(sdp)
            ]);
          } else {
            await pc.setRemoteDescription(sdp);
          }
          await pc.setLocalDescription();
          const answer = await waitForIceGathering(pc);
          handlers.signal?.(answer);
          return answer;
        } else if (sdp.type === answerType) {
          isSettingRemoteAnswerPending = true;
          try {
            await pc.setRemoteDescription(sdp);
          } finally {
            isSettingRemoteAnswerPending = false;
          }
        }
      } catch (err) {
        handlers.error?.(err);
      }
    },
    sendData: (data) => dataChannel.send(data),
    destroy: () => {
      dataChannel?.close();
      pc.close();
      makingOffer = false;
      isSettingRemoteAnswerPending = false;
    },
    setHandlers: (newHandlers) => Object.assign(handlers, newHandlers),
    offerPromise: initiator ? new Promise(
      (res) => handlers.signal = (sdp) => {
        if (sdp.type === offerType) {
          res(sdp);
        }
      }
    ) : Promise.resolve(),
    addStream: (stream) => stream.getTracks().forEach((track) => pc.addTrack(track, stream)),
    removeStream: (stream) => pc.getSenders().filter((sender) => stream.getTracks().includes(sender.track)).forEach((sender) => pc.removeTrack(sender)),
    addTrack: (track, stream) => pc.addTrack(track, stream),
    removeTrack: (track) => {
      const sender = pc.getSenders().find((s) => s.track === track);
      if (sender) {
        pc.removeTrack(sender);
      }
    },
    replaceTrack: (oldTrack, newTrack) => {
      const sender = pc.getSenders().find((s) => s.track === oldTrack);
      if (sender) {
        return sender.replaceTrack(newTrack);
      }
    }
  };
};
var defaultIceServers = [
  ...alloc(3, (_, i) => `stun:stun${i || ""}.l.google.com:19302`),
  "stun:stun.cloudflare.com:3478"
].map((url) => ({ urls: url }));

// node_modules/trystero/src/room.js
var TypedArray = Object.getPrototypeOf(Uint8Array);
var typeByteLimit = 12;
var typeIndex = 0;
var nonceIndex = typeIndex + typeByteLimit;
var tagIndex = nonceIndex + 1;
var progressIndex = tagIndex + 1;
var payloadIndex = progressIndex + 1;
var chunkSize = 16 * 2 ** 10 - payloadIndex;
var oneByteMax = 255;
var buffLowEvent = "bufferedamountlow";
var internalNs = (ns) => "@_" + ns;
var room_default = (onPeer, onPeerLeave, onSelfLeave) => {
  const peerMap = {};
  const actions = {};
  const actionsCache = {};
  const pendingTransmissions = {};
  const pendingPongs = {};
  const pendingStreamMetas = {};
  const pendingTrackMetas = {};
  const listeners = {
    onPeerJoin: noOp,
    onPeerLeave: noOp,
    onPeerStream: noOp,
    onPeerTrack: noOp
  };
  const iterate = (targets, f) => (targets ? Array.isArray(targets) ? targets : [targets] : keys(peerMap)).flatMap((id) => {
    const peer = peerMap[id];
    if (!peer) {
      console.warn(`${libName}: no peer with id ${id} found`);
      return [];
    }
    return f(id, peer);
  });
  const exitPeer = (id) => {
    if (!peerMap[id]) {
      return;
    }
    delete peerMap[id];
    delete pendingTransmissions[id];
    delete pendingPongs[id];
    listeners.onPeerLeave(id);
    onPeerLeave(id);
  };
  const makeAction = (type) => {
    if (actions[type]) {
      return actionsCache[type];
    }
    if (!type) {
      throw mkErr("action type argument is required");
    }
    const typeBytes = encodeBytes(type);
    if (typeBytes.byteLength > typeByteLimit) {
      throw mkErr(
        `action type string "${type}" (${typeBytes.byteLength}b) exceeds byte limit (${typeByteLimit}). Hint: choose a shorter name.`
      );
    }
    const typeBytesPadded = new Uint8Array(typeByteLimit);
    typeBytesPadded.set(typeBytes);
    let nonce = 0;
    actions[type] = {
      onComplete: noOp,
      onProgress: noOp,
      setOnComplete: (f) => actions[type] = { ...actions[type], onComplete: f },
      setOnProgress: (f) => actions[type] = { ...actions[type], onProgress: f },
      send: async (data, targets, meta, onProgress) => {
        if (meta && typeof meta !== "object") {
          throw mkErr("action meta argument must be an object");
        }
        const dataType = typeof data;
        if (dataType === "undefined") {
          throw mkErr("action data cannot be undefined");
        }
        const isJson = dataType !== "string";
        const isBlob = data instanceof Blob;
        const isBinary = isBlob || data instanceof ArrayBuffer || data instanceof TypedArray;
        if (meta && !isBinary) {
          throw mkErr("action meta argument can only be used with binary data");
        }
        const buffer = isBinary ? new Uint8Array(isBlob ? await data.arrayBuffer() : data) : encodeBytes(isJson ? toJson(data) : data);
        const metaEncoded = meta ? encodeBytes(toJson(meta)) : null;
        const chunkTotal = Math.ceil(buffer.byteLength / chunkSize) + (meta ? 1 : 0) || 1;
        const chunks = alloc(chunkTotal, (_, i) => {
          const isLast = i === chunkTotal - 1;
          const isMeta = meta && i === 0;
          const chunk = new Uint8Array(
            payloadIndex + (isMeta ? metaEncoded.byteLength : isLast ? buffer.byteLength - chunkSize * (chunkTotal - (meta ? 2 : 1)) : chunkSize)
          );
          chunk.set(typeBytesPadded);
          chunk.set([nonce], nonceIndex);
          chunk.set(
            [isLast | isMeta << 1 | isBinary << 2 | isJson << 3],
            tagIndex
          );
          chunk.set(
            [Math.round((i + 1) / chunkTotal * oneByteMax)],
            progressIndex
          );
          chunk.set(
            meta ? isMeta ? metaEncoded : buffer.subarray((i - 1) * chunkSize, i * chunkSize) : buffer.subarray(i * chunkSize, (i + 1) * chunkSize),
            payloadIndex
          );
          return chunk;
        });
        nonce = nonce + 1 & oneByteMax;
        return all(
          iterate(targets, async (id, peer) => {
            const { channel } = peer;
            let chunkN = 0;
            while (chunkN < chunkTotal) {
              const chunk = chunks[chunkN];
              if (channel.bufferedAmount > channel.bufferedAmountLowThreshold) {
                await new Promise((res) => {
                  const next = () => {
                    channel.removeEventListener(buffLowEvent, next);
                    res();
                  };
                  channel.addEventListener(buffLowEvent, next);
                });
              }
              if (!peerMap[id]) {
                break;
              }
              peer.sendData(chunk);
              chunkN++;
              onProgress?.(chunk[progressIndex] / oneByteMax, id, meta);
            }
          })
        );
      }
    };
    return actionsCache[type] ||= [
      actions[type].send,
      actions[type].setOnComplete,
      actions[type].setOnProgress
    ];
  };
  const handleData = (id, data) => {
    const buffer = new Uint8Array(data);
    const type = decodeBytes(buffer.subarray(typeIndex, nonceIndex)).replaceAll(
      "\0",
      ""
    );
    const [nonce] = buffer.subarray(nonceIndex, tagIndex);
    const [tag] = buffer.subarray(tagIndex, progressIndex);
    const [progress] = buffer.subarray(progressIndex, payloadIndex);
    const payload = buffer.subarray(payloadIndex);
    const isLast = !!(tag & 1);
    const isMeta = !!(tag & 1 << 1);
    const isBinary = !!(tag & 1 << 2);
    const isJson = !!(tag & 1 << 3);
    if (!actions[type]) {
      console.warn(
        `${libName}: received message with unregistered type (${type})`
      );
      return;
    }
    pendingTransmissions[id] ||= {};
    pendingTransmissions[id][type] ||= {};
    const target = pendingTransmissions[id][type][nonce] ||= { chunks: [] };
    if (isMeta) {
      target.meta = fromJson(decodeBytes(payload));
    } else {
      target.chunks.push(payload);
    }
    actions[type].onProgress(progress / oneByteMax, id, target.meta);
    if (!isLast) {
      return;
    }
    const full = new Uint8Array(
      target.chunks.reduce((a, c) => a + c.byteLength, 0)
    );
    target.chunks.reduce((a, c) => {
      full.set(c, a);
      return a + c.byteLength;
    }, 0);
    delete pendingTransmissions[id][type][nonce];
    if (isBinary) {
      actions[type].onComplete(full, id, target.meta);
    } else {
      const text = decodeBytes(full);
      actions[type].onComplete(isJson ? fromJson(text) : text, id);
    }
  };
  const leave = async () => {
    await sendLeave("");
    await new Promise((res) => setTimeout(res, 99));
    entries(peerMap).forEach(([id, peer]) => {
      peer.destroy();
      delete peerMap[id];
    });
    onSelfLeave();
  };
  const [sendPing, getPing] = makeAction(internalNs("ping"));
  const [sendPong, getPong] = makeAction(internalNs("pong"));
  const [sendSignal, getSignal] = makeAction(internalNs("signal"));
  const [sendStreamMeta, getStreamMeta] = makeAction(internalNs("stream"));
  const [sendTrackMeta, getTrackMeta] = makeAction(internalNs("track"));
  const [sendLeave, getLeave] = makeAction(internalNs("leave"));
  onPeer((peer, id) => {
    if (peerMap[id]) {
      return;
    }
    peerMap[id] = peer;
    peer.setHandlers({
      data: (d) => handleData(id, d),
      stream: (stream) => {
        listeners.onPeerStream(stream, id, pendingStreamMetas[id]);
        delete pendingStreamMetas[id];
      },
      track: (track, stream) => {
        listeners.onPeerTrack(track, stream, id, pendingTrackMetas[id]);
        delete pendingTrackMetas[id];
      },
      signal: (sdp) => sendSignal(sdp, id),
      close: () => exitPeer(id),
      error: (err) => {
        console.error(err);
        exitPeer(id);
      }
    });
    listeners.onPeerJoin(id);
  });
  getPing((_, id) => sendPong("", id));
  getPong((_, id) => {
    pendingPongs[id]?.();
    delete pendingPongs[id];
  });
  getSignal((sdp, id) => peerMap[id]?.signal(sdp));
  getStreamMeta((meta, id) => pendingStreamMetas[id] = meta);
  getTrackMeta((meta, id) => pendingTrackMetas[id] = meta);
  getLeave((_, id) => exitPeer(id));
  if (isBrowser) {
    addEventListener("beforeunload", leave);
  }
  return {
    makeAction,
    leave,
    ping: async (id) => {
      if (!id) {
        throw mkErr("ping() must be called with target peer ID");
      }
      const start = Date.now();
      sendPing("", id);
      await new Promise((res) => pendingPongs[id] = res);
      return Date.now() - start;
    },
    getPeers: () => fromEntries(entries(peerMap).map(([id, peer]) => [id, peer.connection])),
    addStream: (stream, targets, meta) => iterate(targets, async (id, peer) => {
      if (meta) {
        await sendStreamMeta(meta, id);
      }
      peer.addStream(stream);
    }),
    removeStream: (stream, targets) => iterate(targets, (_, peer) => peer.removeStream(stream)),
    addTrack: (track, stream, targets, meta) => iterate(targets, async (id, peer) => {
      if (meta) {
        await sendTrackMeta(meta, id);
      }
      peer.addTrack(track, stream);
    }),
    removeTrack: (track, targets) => iterate(targets, (_, peer) => peer.removeTrack(track)),
    replaceTrack: (oldTrack, newTrack, targets, meta) => iterate(targets, async (id, peer) => {
      if (meta) {
        await sendTrackMeta(meta, id);
      }
      peer.replaceTrack(oldTrack, newTrack);
    }),
    onPeerJoin: (f) => listeners.onPeerJoin = f,
    onPeerLeave: (f) => listeners.onPeerLeave = f,
    onPeerStream: (f) => listeners.onPeerStream = f,
    onPeerTrack: (f) => listeners.onPeerTrack = f
  };
};

// node_modules/trystero/src/strategy.js
var poolSize = 20;
var announceIntervalMs = 5333;
var offerTtl = 57333;
var strategy_default = ({ init, subscribe, announce }) => {
  const occupiedRooms = {};
  let didInit = false;
  let initPromises;
  let offerPool;
  let offerCleanupTimer;
  return (config, roomId, onJoinError) => {
    const { appId } = config;
    if (occupiedRooms[appId]?.[roomId]) {
      return occupiedRooms[appId][roomId];
    }
    const pendingOffers = {};
    const connectedPeers = {};
    const rootTopicPlaintext = topicPath(libName, appId, roomId);
    const rootTopicP = sha1(rootTopicPlaintext);
    const selfTopicP = sha1(topicPath(rootTopicPlaintext, selfId));
    const key = genKey(config.password || "", appId, roomId);
    const withKey = (f) => async (signal) => ({
      type: signal.type,
      sdp: await f(key, signal.sdp)
    });
    const toPlain = withKey(decrypt);
    const toCipher = withKey(encrypt);
    const makeOffer = () => peer_default(true, config);
    const connectPeer = (peer, peerId, relayId) => {
      if (connectedPeers[peerId]) {
        if (connectedPeers[peerId] !== peer) {
          peer.destroy();
        }
        return;
      }
      connectedPeers[peerId] = peer;
      onPeerConnect(peer, peerId);
      pendingOffers[peerId]?.forEach((peer2, i) => {
        if (i !== relayId) {
          peer2.destroy();
        }
      });
      delete pendingOffers[peerId];
    };
    const disconnectPeer = (peer, peerId) => {
      if (connectedPeers[peerId] === peer) {
        delete connectedPeers[peerId];
      }
    };
    const prunePendingOffer = (peerId, relayId) => {
      if (connectedPeers[peerId]) {
        return;
      }
      const offer = pendingOffers[peerId]?.[relayId];
      if (offer) {
        delete pendingOffers[peerId][relayId];
        offer.destroy();
      }
    };
    const getOffers = (n) => {
      offerPool.push(...alloc(n, makeOffer));
      return all(
        offerPool.splice(0, n).map(
          (peer) => peer.offerPromise.then(toCipher).then((offer) => ({ peer, offer }))
        )
      );
    };
    const handleJoinError = (peerId, sdpType) => onJoinError?.({
      error: `incorrect password (${config.password}) when decrypting ${sdpType}`,
      appId,
      peerId,
      roomId
    });
    const handleMessage = (relayId) => async (topic, msg, signalPeer) => {
      const [rootTopic, selfTopic] = await all([rootTopicP, selfTopicP]);
      if (topic !== rootTopic && topic !== selfTopic) {
        return;
      }
      const { peerId, offer, answer, peer } = typeof msg === "string" ? fromJson(msg) : msg;
      if (peerId === selfId || connectedPeers[peerId]) {
        return;
      }
      if (peerId && !offer && !answer) {
        if (pendingOffers[peerId]?.[relayId]) {
          return;
        }
        const [[{ peer: peer2, offer: offer2 }], topic2] = await all([
          getOffers(1),
          sha1(topicPath(rootTopicPlaintext, peerId))
        ]);
        pendingOffers[peerId] ||= [];
        pendingOffers[peerId][relayId] = peer2;
        setTimeout(
          () => prunePendingOffer(peerId, relayId),
          announceIntervals2[relayId] * 0.9
        );
        peer2.setHandlers({
          connect: () => connectPeer(peer2, peerId, relayId),
          close: () => disconnectPeer(peer2, peerId)
        });
        signalPeer(topic2, toJson({ peerId: selfId, offer: offer2 }));
      } else if (offer) {
        const myOffer = pendingOffers[peerId]?.[relayId];
        if (myOffer && selfId > peerId) {
          return;
        }
        const peer2 = peer_default(false, config);
        peer2.setHandlers({
          connect: () => connectPeer(peer2, peerId, relayId),
          close: () => disconnectPeer(peer2, peerId)
        });
        let plainOffer;
        try {
          plainOffer = await toPlain(offer);
        } catch {
          handleJoinError(peerId, "offer");
          return;
        }
        if (peer2.isDead) {
          return;
        }
        const [topic2, answer2] = await all([
          sha1(topicPath(rootTopicPlaintext, peerId)),
          peer2.signal(plainOffer)
        ]);
        signalPeer(
          topic2,
          toJson({ peerId: selfId, answer: await toCipher(answer2) })
        );
      } else if (answer) {
        let plainAnswer;
        try {
          plainAnswer = await toPlain(answer);
        } catch (e) {
          handleJoinError(peerId, "answer");
          return;
        }
        if (peer) {
          peer.setHandlers({
            connect: () => connectPeer(peer, peerId, relayId),
            close: () => disconnectPeer(peer, peerId)
          });
          peer.signal(plainAnswer);
        } else {
          const peer2 = pendingOffers[peerId]?.[relayId];
          if (peer2 && !peer2.isDead) {
            peer2.signal(plainAnswer);
          }
        }
      }
    };
    if (!config) {
      throw mkErr("requires a config map as the first argument");
    }
    if (!appId && !config.firebaseApp) {
      throw mkErr("config map is missing appId field");
    }
    if (!roomId) {
      throw mkErr("roomId argument required");
    }
    if (!didInit) {
      const initRes = init(config);
      offerPool = alloc(poolSize, makeOffer);
      initPromises = Array.isArray(initRes) ? initRes : [initRes];
      didInit = true;
      offerCleanupTimer = setInterval(
        () => offerPool = offerPool.filter((peer) => {
          const shouldLive = Date.now() - peer.created < offerTtl;
          if (!shouldLive) {
            peer.destroy();
          }
          return shouldLive;
        }),
        offerTtl * 1.03
      );
    }
    const announceIntervals2 = initPromises.map(() => announceIntervalMs);
    const announceTimeouts = [];
    const unsubFns = initPromises.map(
      async (relayP, i) => subscribe(
        await relayP,
        await rootTopicP,
        await selfTopicP,
        handleMessage(i),
        getOffers
      )
    );
    all([rootTopicP, selfTopicP]).then(([rootTopic, selfTopic]) => {
      const queueAnnounce = async (relay, i) => {
        const ms = await announce(relay, rootTopic, selfTopic);
        if (typeof ms === "number") {
          announceIntervals2[i] = ms;
        }
        announceTimeouts[i] = setTimeout(
          () => queueAnnounce(relay, i),
          announceIntervals2[i]
        );
      };
      unsubFns.forEach(async (didSub, i) => {
        await didSub;
        queueAnnounce(await initPromises[i], i);
      });
    });
    let onPeerConnect = noOp;
    occupiedRooms[appId] ||= {};
    return occupiedRooms[appId][roomId] = room_default(
      (f) => onPeerConnect = f,
      (id) => delete connectedPeers[id],
      () => {
        delete occupiedRooms[appId][roomId];
        announceTimeouts.forEach(clearTimeout);
        unsubFns.forEach(async (f) => (await f)());
        clearInterval(offerCleanupTimer);
      }
    );
  };
};

// node_modules/trystero/src/torrent.js
var clients = {};
var topicToInfoHash = {};
var infoHashToTopic = {};
var announceIntervals = {};
var announceFns = {};
var trackerAnnounceMs = {};
var handledOffers = {};
var msgHandlers = {};
var trackerAction = "announce";
var hashLimit = 20;
var offerPoolSize = 10;
var defaultAnnounceMs = 33333;
var maxAnnounceMs = 120333;
var defaultRedundancy = 3;
var getInfoHash = async (topic) => {
  if (topicToInfoHash[topic]) {
    return topicToInfoHash[topic];
  }
  const hash = (await sha1(topic)).slice(0, hashLimit);
  topicToInfoHash[topic] = hash;
  infoHashToTopic[hash] = topic;
  return hash;
};
var send = async (client, topic, payload) => client.send(
  toJson({
    action: trackerAction,
    info_hash: await getInfoHash(topic),
    peer_id: selfId,
    ...payload
  })
);
var warn = (url, msg, didFail) => console.warn(
  `${libName}: torrent tracker ${didFail ? "failure" : "warning"} from ${url} - ${msg}`
);
var joinRoom = strategy_default({
  init: (config) => getRelays(config, defaultRelayUrls, defaultRedundancy).map((rawUrl) => {
    const client = makeSocket(rawUrl, (rawData) => {
      const data = fromJson(rawData);
      const errMsg = data["failure reason"];
      const warnMsg = data["warning message"];
      const { interval } = data;
      const topic = infoHashToTopic[data.info_hash];
      if (errMsg) {
        warn(url, errMsg, true);
        return;
      }
      if (warnMsg) {
        warn(url, warnMsg);
      }
      if (interval && interval * 1e3 > trackerAnnounceMs[url] && announceFns[url][topic]) {
        const int = Math.min(interval * 1e3, maxAnnounceMs);
        clearInterval(announceIntervals[url][topic]);
        trackerAnnounceMs[url] = int;
        announceIntervals[url][topic] = setInterval(
          announceFns[url][topic],
          int
        );
      }
      if (handledOffers[data.offer_id]) {
        return;
      }
      if (data.offer || data.answer) {
        handledOffers[data.offer_id] = true;
        msgHandlers[url][topic]?.(data);
      }
    });
    const { url } = client;
    clients[url] = client;
    msgHandlers[url] = {};
    return client.ready;
  }),
  subscribe: (client, rootTopic, _, onMessage, getOffers) => {
    const { url } = client;
    const announce = async () => {
      const offers = fromEntries(
        (await getOffers(offerPoolSize)).map((peerAndOffer) => [
          genId(hashLimit),
          peerAndOffer
        ])
      );
      msgHandlers[client.url][rootTopic] = (data) => {
        if (data.offer) {
          onMessage(
            rootTopic,
            { offer: data.offer, peerId: data.peer_id },
            (_2, signal) => send(client, rootTopic, {
              // certain trackers will reject if answer contains extra fields
              answer: fromJson(signal).answer,
              offer_id: data.offer_id,
              to_peer_id: data.peer_id
            })
          );
        } else if (data.answer) {
          const offer = offers[data.offer_id];
          if (offer) {
            onMessage(rootTopic, {
              answer: data.answer,
              peerId: data.peer_id,
              peer: offer.peer
            });
          }
        }
      };
      send(client, rootTopic, {
        numwant: offerPoolSize,
        offers: entries(offers).map(([id, { offer }]) => ({ offer_id: id, offer }))
      });
    };
    trackerAnnounceMs[url] = defaultAnnounceMs;
    announceFns[url] ||= {};
    announceFns[url][rootTopic] = announce;
    announceIntervals[url] ||= {};
    announceIntervals[url][rootTopic] = setInterval(
      announce,
      trackerAnnounceMs[url]
    );
    announce();
    return () => {
      clearInterval(announceIntervals[url][rootTopic]);
      delete msgHandlers[url][rootTopic];
      delete announceFns[url][rootTopic];
    };
  },
  announce: (client) => trackerAnnounceMs[client.url]
});
var getRelaySockets = socketGetter(clients);
var defaultRelayUrls = [
  "tracker.webtorrent.dev",
  "tracker.openwebtorrent.com",
  "tracker.btorrent.xyz",
  "tracker.files.fm:7073/announce"
].map((url) => "wss://" + url);
export {
  defaultRelayUrls,
  getRelaySockets,
  joinRoom,
  selfId
};
