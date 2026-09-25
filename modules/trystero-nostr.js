var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod2) => function __require() {
  try {
    return mod2 || (0, cb[__getOwnPropNames(cb)[0]])((mod2 = { exports: {} }).exports, mod2), mod2.exports;
  } catch (e) {
    throw mod2 = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod2, isNodeMode, target) => (target = mod2 != null ? __create(__getProtoOf(mod2)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod2 || !mod2.__esModule ? __defProp(target, "default", { value: mod2, enumerable: true }) : target,
  mod2
));

// (disabled):crypto
var require_crypto = __commonJS({
  "(disabled):crypto"() {
  }
});

// node_modules/@noble/secp256k1/lib/esm/index.js
var nodeCrypto = __toESM(require_crypto(), 1);
var _0n = BigInt(0);
var _1n = BigInt(1);
var _2n = BigInt(2);
var _3n = BigInt(3);
var _8n = BigInt(8);
var CURVE = Object.freeze({
  a: _0n,
  b: BigInt(7),
  P: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),
  n: BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),
  h: _1n,
  Gx: BigInt("55066263022277343669578718895168534326250603453777594175500187360389116729240"),
  Gy: BigInt("32670510020758816978083085130507043184471273380659243275938904335757337482424"),
  beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee")
});
var divNearest = (a, b) => (a + b / _2n) / b;
var endo = {
  beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
  splitScalar(k) {
    const { n } = CURVE;
    const a1 = BigInt("0x3086d221a7d46bcde86c90e49284eb15");
    const b1 = -_1n * BigInt("0xe4437ed6010e88286f547fa90abfe4c3");
    const a2 = BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8");
    const b2 = a1;
    const POW_2_128 = BigInt("0x100000000000000000000000000000000");
    const c1 = divNearest(b2 * k, n);
    const c2 = divNearest(-b1 * k, n);
    let k1 = mod(k - c1 * a1 - c2 * a2, n);
    let k2 = mod(-c1 * b1 - c2 * b2, n);
    const k1neg = k1 > POW_2_128;
    const k2neg = k2 > POW_2_128;
    if (k1neg)
      k1 = n - k1;
    if (k2neg)
      k2 = n - k2;
    if (k1 > POW_2_128 || k2 > POW_2_128) {
      throw new Error("splitScalarEndo: Endomorphism failed, k=" + k);
    }
    return { k1neg, k1, k2neg, k2 };
  }
};
var fieldLen = 32;
var groupLen = 32;
var compressedLen = fieldLen + 1;
var uncompressedLen = 2 * fieldLen + 1;
function weierstrass(x) {
  const { a, b } = CURVE;
  const x2 = mod(x * x);
  const x3 = mod(x2 * x);
  return mod(x3 + a * x + b);
}
var USE_ENDOMORPHISM = CURVE.a === _0n;
var ShaError = class extends Error {
  constructor(message) {
    super(message);
  }
};
function assertJacPoint(other) {
  if (!(other instanceof JacobianPoint))
    throw new TypeError("JacobianPoint expected");
}
var JacobianPoint = class _JacobianPoint {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  static fromAffine(p) {
    if (!(p instanceof Point)) {
      throw new TypeError("JacobianPoint#fromAffine: expected Point");
    }
    if (p.equals(Point.ZERO))
      return _JacobianPoint.ZERO;
    return new _JacobianPoint(p.x, p.y, _1n);
  }
  static toAffineBatch(points) {
    const toInv = invertBatch(points.map((p) => p.z));
    return points.map((p, i) => p.toAffine(toInv[i]));
  }
  static normalizeZ(points) {
    return _JacobianPoint.toAffineBatch(points).map(_JacobianPoint.fromAffine);
  }
  equals(other) {
    assertJacPoint(other);
    const { x: X1, y: Y1, z: Z1 } = this;
    const { x: X2, y: Y2, z: Z2 } = other;
    const Z1Z1 = mod(Z1 * Z1);
    const Z2Z2 = mod(Z2 * Z2);
    const U1 = mod(X1 * Z2Z2);
    const U2 = mod(X2 * Z1Z1);
    const S1 = mod(mod(Y1 * Z2) * Z2Z2);
    const S2 = mod(mod(Y2 * Z1) * Z1Z1);
    return U1 === U2 && S1 === S2;
  }
  negate() {
    return new _JacobianPoint(this.x, mod(-this.y), this.z);
  }
  double() {
    const { x: X1, y: Y1, z: Z1 } = this;
    const A = mod(X1 * X1);
    const B = mod(Y1 * Y1);
    const C = mod(B * B);
    const x1b = X1 + B;
    const D = mod(_2n * (mod(x1b * x1b) - A - C));
    const E = mod(_3n * A);
    const F = mod(E * E);
    const X3 = mod(F - _2n * D);
    const Y3 = mod(E * (D - X3) - _8n * C);
    const Z3 = mod(_2n * Y1 * Z1);
    return new _JacobianPoint(X3, Y3, Z3);
  }
  add(other) {
    assertJacPoint(other);
    const { x: X1, y: Y1, z: Z1 } = this;
    const { x: X2, y: Y2, z: Z2 } = other;
    if (X2 === _0n || Y2 === _0n)
      return this;
    if (X1 === _0n || Y1 === _0n)
      return other;
    const Z1Z1 = mod(Z1 * Z1);
    const Z2Z2 = mod(Z2 * Z2);
    const U1 = mod(X1 * Z2Z2);
    const U2 = mod(X2 * Z1Z1);
    const S1 = mod(mod(Y1 * Z2) * Z2Z2);
    const S2 = mod(mod(Y2 * Z1) * Z1Z1);
    const H = mod(U2 - U1);
    const r = mod(S2 - S1);
    if (H === _0n) {
      if (r === _0n) {
        return this.double();
      } else {
        return _JacobianPoint.ZERO;
      }
    }
    const HH = mod(H * H);
    const HHH = mod(H * HH);
    const V = mod(U1 * HH);
    const X3 = mod(r * r - HHH - _2n * V);
    const Y3 = mod(r * (V - X3) - S1 * HHH);
    const Z3 = mod(Z1 * Z2 * H);
    return new _JacobianPoint(X3, Y3, Z3);
  }
  subtract(other) {
    return this.add(other.negate());
  }
  multiplyUnsafe(scalar) {
    const P0 = _JacobianPoint.ZERO;
    if (typeof scalar === "bigint" && scalar === _0n)
      return P0;
    let n = normalizeScalar(scalar);
    if (n === _1n)
      return this;
    if (!USE_ENDOMORPHISM) {
      let p = P0;
      let d2 = this;
      while (n > _0n) {
        if (n & _1n)
          p = p.add(d2);
        d2 = d2.double();
        n >>= _1n;
      }
      return p;
    }
    let { k1neg, k1, k2neg, k2 } = endo.splitScalar(n);
    let k1p = P0;
    let k2p = P0;
    let d = this;
    while (k1 > _0n || k2 > _0n) {
      if (k1 & _1n)
        k1p = k1p.add(d);
      if (k2 & _1n)
        k2p = k2p.add(d);
      d = d.double();
      k1 >>= _1n;
      k2 >>= _1n;
    }
    if (k1neg)
      k1p = k1p.negate();
    if (k2neg)
      k2p = k2p.negate();
    k2p = new _JacobianPoint(mod(k2p.x * endo.beta), k2p.y, k2p.z);
    return k1p.add(k2p);
  }
  precomputeWindow(W) {
    const windows = USE_ENDOMORPHISM ? 128 / W + 1 : 256 / W + 1;
    const points = [];
    let p = this;
    let base = p;
    for (let window2 = 0; window2 < windows; window2++) {
      base = p;
      points.push(base);
      for (let i = 1; i < 2 ** (W - 1); i++) {
        base = base.add(p);
        points.push(base);
      }
      p = base.double();
    }
    return points;
  }
  wNAF(n, affinePoint) {
    if (!affinePoint && this.equals(_JacobianPoint.BASE))
      affinePoint = Point.BASE;
    const W = affinePoint && affinePoint._WINDOW_SIZE || 1;
    if (256 % W) {
      throw new Error("Point#wNAF: Invalid precomputation window, must be power of 2");
    }
    let precomputes = affinePoint && pointPrecomputes.get(affinePoint);
    if (!precomputes) {
      precomputes = this.precomputeWindow(W);
      if (affinePoint && W !== 1) {
        precomputes = _JacobianPoint.normalizeZ(precomputes);
        pointPrecomputes.set(affinePoint, precomputes);
      }
    }
    let p = _JacobianPoint.ZERO;
    let f = _JacobianPoint.BASE;
    const windows = 1 + (USE_ENDOMORPHISM ? 128 / W : 256 / W);
    const windowSize = 2 ** (W - 1);
    const mask = BigInt(2 ** W - 1);
    const maxNumber = 2 ** W;
    const shiftBy = BigInt(W);
    for (let window2 = 0; window2 < windows; window2++) {
      const offset = window2 * windowSize;
      let wbits = Number(n & mask);
      n >>= shiftBy;
      if (wbits > windowSize) {
        wbits -= maxNumber;
        n += _1n;
      }
      const offset1 = offset;
      const offset2 = offset + Math.abs(wbits) - 1;
      const cond1 = window2 % 2 !== 0;
      const cond2 = wbits < 0;
      if (wbits === 0) {
        f = f.add(constTimeNegate(cond1, precomputes[offset1]));
      } else {
        p = p.add(constTimeNegate(cond2, precomputes[offset2]));
      }
    }
    return { p, f };
  }
  multiply(scalar, affinePoint) {
    let n = normalizeScalar(scalar);
    let point;
    let fake;
    if (USE_ENDOMORPHISM) {
      const { k1neg, k1, k2neg, k2 } = endo.splitScalar(n);
      let { p: k1p, f: f1p } = this.wNAF(k1, affinePoint);
      let { p: k2p, f: f2p } = this.wNAF(k2, affinePoint);
      k1p = constTimeNegate(k1neg, k1p);
      k2p = constTimeNegate(k2neg, k2p);
      k2p = new _JacobianPoint(mod(k2p.x * endo.beta), k2p.y, k2p.z);
      point = k1p.add(k2p);
      fake = f1p.add(f2p);
    } else {
      const { p, f } = this.wNAF(n, affinePoint);
      point = p;
      fake = f;
    }
    return _JacobianPoint.normalizeZ([point, fake])[0];
  }
  toAffine(invZ) {
    const { x, y, z } = this;
    const is0 = this.equals(_JacobianPoint.ZERO);
    if (invZ == null)
      invZ = is0 ? _8n : invert(z);
    const iz1 = invZ;
    const iz2 = mod(iz1 * iz1);
    const iz3 = mod(iz2 * iz1);
    const ax = mod(x * iz2);
    const ay = mod(y * iz3);
    const zz = mod(z * iz1);
    if (is0)
      return Point.ZERO;
    if (zz !== _1n)
      throw new Error("invZ was invalid");
    return new Point(ax, ay);
  }
};
JacobianPoint.BASE = new JacobianPoint(CURVE.Gx, CURVE.Gy, _1n);
JacobianPoint.ZERO = new JacobianPoint(_0n, _1n, _0n);
function constTimeNegate(condition, item) {
  const neg = item.negate();
  return condition ? neg : item;
}
var pointPrecomputes = /* @__PURE__ */ new WeakMap();
var Point = class _Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  _setWindowSize(windowSize) {
    this._WINDOW_SIZE = windowSize;
    pointPrecomputes.delete(this);
  }
  hasEvenY() {
    return this.y % _2n === _0n;
  }
  static fromCompressedHex(bytes) {
    const isShort = bytes.length === 32;
    const x = bytesToNumber(isShort ? bytes : bytes.subarray(1));
    if (!isValidFieldElement(x))
      throw new Error("Point is not on curve");
    const y2 = weierstrass(x);
    let y = sqrtMod(y2);
    const isYOdd = (y & _1n) === _1n;
    if (isShort) {
      if (isYOdd)
        y = mod(-y);
    } else {
      const isFirstByteOdd = (bytes[0] & 1) === 1;
      if (isFirstByteOdd !== isYOdd)
        y = mod(-y);
    }
    const point = new _Point(x, y);
    point.assertValidity();
    return point;
  }
  static fromUncompressedHex(bytes) {
    const x = bytesToNumber(bytes.subarray(1, fieldLen + 1));
    const y = bytesToNumber(bytes.subarray(fieldLen + 1, fieldLen * 2 + 1));
    const point = new _Point(x, y);
    point.assertValidity();
    return point;
  }
  static fromHex(hex) {
    const bytes = ensureBytes(hex);
    const len = bytes.length;
    const header = bytes[0];
    if (len === fieldLen)
      return this.fromCompressedHex(bytes);
    if (len === compressedLen && (header === 2 || header === 3)) {
      return this.fromCompressedHex(bytes);
    }
    if (len === uncompressedLen && header === 4)
      return this.fromUncompressedHex(bytes);
    throw new Error(`Point.fromHex: received invalid point. Expected 32-${compressedLen} compressed bytes or ${uncompressedLen} uncompressed bytes, not ${len}`);
  }
  static fromPrivateKey(privateKey2) {
    return _Point.BASE.multiply(normalizePrivateKey(privateKey2));
  }
  static fromSignature(msgHash, signature, recovery) {
    const { r, s } = normalizeSignature(signature);
    if (![0, 1, 2, 3].includes(recovery))
      throw new Error("Cannot recover: invalid recovery bit");
    const h = truncateHash(ensureBytes(msgHash));
    const { n } = CURVE;
    const radj = recovery === 2 || recovery === 3 ? r + n : r;
    const rinv = invert(radj, n);
    const u1 = mod(-h * rinv, n);
    const u2 = mod(s * rinv, n);
    const prefix = recovery & 1 ? "03" : "02";
    const R = _Point.fromHex(prefix + numTo32bStr(radj));
    const Q = _Point.BASE.multiplyAndAddUnsafe(R, u1, u2);
    if (!Q)
      throw new Error("Cannot recover signature: point at infinify");
    Q.assertValidity();
    return Q;
  }
  toRawBytes(isCompressed = false) {
    return hexToBytes(this.toHex(isCompressed));
  }
  toHex(isCompressed = false) {
    const x = numTo32bStr(this.x);
    if (isCompressed) {
      const prefix = this.hasEvenY() ? "02" : "03";
      return `${prefix}${x}`;
    } else {
      return `04${x}${numTo32bStr(this.y)}`;
    }
  }
  toHexX() {
    return this.toHex(true).slice(2);
  }
  toRawX() {
    return this.toRawBytes(true).slice(1);
  }
  assertValidity() {
    const msg = "Point is not on elliptic curve";
    const { x, y } = this;
    if (!isValidFieldElement(x) || !isValidFieldElement(y))
      throw new Error(msg);
    const left = mod(y * y);
    const right = weierstrass(x);
    if (mod(left - right) !== _0n)
      throw new Error(msg);
  }
  equals(other) {
    return this.x === other.x && this.y === other.y;
  }
  negate() {
    return new _Point(this.x, mod(-this.y));
  }
  double() {
    return JacobianPoint.fromAffine(this).double().toAffine();
  }
  add(other) {
    return JacobianPoint.fromAffine(this).add(JacobianPoint.fromAffine(other)).toAffine();
  }
  subtract(other) {
    return this.add(other.negate());
  }
  multiply(scalar) {
    return JacobianPoint.fromAffine(this).multiply(scalar, this).toAffine();
  }
  multiplyAndAddUnsafe(Q, a, b) {
    const P = JacobianPoint.fromAffine(this);
    const aP = a === _0n || a === _1n || this !== _Point.BASE ? P.multiplyUnsafe(a) : P.multiply(a);
    const bQ = JacobianPoint.fromAffine(Q).multiplyUnsafe(b);
    const sum = aP.add(bQ);
    return sum.equals(JacobianPoint.ZERO) ? void 0 : sum.toAffine();
  }
};
Point.BASE = new Point(CURVE.Gx, CURVE.Gy);
Point.ZERO = new Point(_0n, _0n);
function sliceDER(s) {
  return Number.parseInt(s[0], 16) >= 8 ? "00" + s : s;
}
function parseDERInt(data) {
  if (data.length < 2 || data[0] !== 2) {
    throw new Error(`Invalid signature integer tag: ${bytesToHex(data)}`);
  }
  const len = data[1];
  const res = data.subarray(2, len + 2);
  if (!len || res.length !== len) {
    throw new Error(`Invalid signature integer: wrong length`);
  }
  if (res[0] === 0 && res[1] <= 127) {
    throw new Error("Invalid signature integer: trailing length");
  }
  return { data: bytesToNumber(res), left: data.subarray(len + 2) };
}
function parseDERSignature(data) {
  if (data.length < 2 || data[0] != 48) {
    throw new Error(`Invalid signature tag: ${bytesToHex(data)}`);
  }
  if (data[1] !== data.length - 2) {
    throw new Error("Invalid signature: incorrect length");
  }
  const { data: r, left: sBytes } = parseDERInt(data.subarray(2));
  const { data: s, left: rBytesLeft } = parseDERInt(sBytes);
  if (rBytesLeft.length) {
    throw new Error(`Invalid signature: left bytes after parsing: ${bytesToHex(rBytesLeft)}`);
  }
  return { r, s };
}
var Signature = class _Signature {
  constructor(r, s) {
    this.r = r;
    this.s = s;
    this.assertValidity();
  }
  static fromCompact(hex) {
    const arr = isBytes(hex);
    const name = "Signature.fromCompact";
    if (typeof hex !== "string" && !arr)
      throw new TypeError(`${name}: Expected string or Uint8Array`);
    const str = arr ? bytesToHex(hex) : hex;
    if (str.length !== 128)
      throw new Error(`${name}: Expected 64-byte hex`);
    return new _Signature(hexToNumber(str.slice(0, 64)), hexToNumber(str.slice(64, 128)));
  }
  static fromDER(hex) {
    const arr = isBytes(hex);
    if (typeof hex !== "string" && !arr)
      throw new TypeError(`Signature.fromDER: Expected string or Uint8Array`);
    const { r, s } = parseDERSignature(arr ? hex : hexToBytes(hex));
    return new _Signature(r, s);
  }
  static fromHex(hex) {
    return this.fromDER(hex);
  }
  assertValidity() {
    const { r, s } = this;
    if (!isWithinCurveOrder(r))
      throw new Error("Invalid Signature: r must be 0 < r < n");
    if (!isWithinCurveOrder(s))
      throw new Error("Invalid Signature: s must be 0 < s < n");
  }
  hasHighS() {
    const HALF = CURVE.n >> _1n;
    return this.s > HALF;
  }
  normalizeS() {
    return this.hasHighS() ? new _Signature(this.r, mod(-this.s, CURVE.n)) : this;
  }
  toDERRawBytes() {
    return hexToBytes(this.toDERHex());
  }
  toDERHex() {
    const sHex = sliceDER(numberToHexUnpadded(this.s));
    const rHex = sliceDER(numberToHexUnpadded(this.r));
    const sHexL = sHex.length / 2;
    const rHexL = rHex.length / 2;
    const sLen = numberToHexUnpadded(sHexL);
    const rLen = numberToHexUnpadded(rHexL);
    const length = numberToHexUnpadded(rHexL + sHexL + 4);
    return `30${length}02${rLen}${rHex}02${sLen}${sHex}`;
  }
  toRawBytes() {
    return this.toDERRawBytes();
  }
  toHex() {
    return this.toDERHex();
  }
  toCompactRawBytes() {
    return hexToBytes(this.toCompactHex());
  }
  toCompactHex() {
    return numTo32bStr(this.r) + numTo32bStr(this.s);
  }
};
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function abytes(item) {
  if (!isBytes(item))
    throw new Error("Uint8Array expected");
}
function concatBytes(...arrays) {
  arrays.every(abytes);
  if (arrays.length === 1)
    return arrays[0];
  const length = arrays.reduce((a, arr) => a + arr.length, 0);
  const result = new Uint8Array(length);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const arr = arrays[i];
    result.set(arr, pad);
    pad += arr.length;
  }
  return result;
}
var hexes = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes) {
  abytes(bytes);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
var asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
  if (ch >= asciis._0 && ch <= asciis._9)
    return ch - asciis._0;
  if (ch >= asciis.A && ch <= asciis.F)
    return ch - (asciis.A - 10);
  if (ch >= asciis.a && ch <= asciis.f)
    return ch - (asciis.a - 10);
  return;
}
function hexToBytes(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new Error("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex[hi] + hex[hi + 1];
      throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
var POW_2_256 = BigInt("0x10000000000000000000000000000000000000000000000000000000000000000");
function numTo32bStr(num) {
  if (typeof num !== "bigint")
    throw new Error("Expected bigint");
  if (!(_0n <= num && num < POW_2_256))
    throw new Error("Expected number 0 <= n < 2^256");
  return num.toString(16).padStart(64, "0");
}
function numTo32b(num) {
  const b = hexToBytes(numTo32bStr(num));
  if (b.length !== 32)
    throw new Error("Error: expected 32 bytes");
  return b;
}
function numberToHexUnpadded(num) {
  const hex = num.toString(16);
  return hex.length & 1 ? `0${hex}` : hex;
}
function hexToNumber(hex) {
  if (typeof hex !== "string") {
    throw new TypeError("hexToNumber: expected string, got " + typeof hex);
  }
  return BigInt(`0x${hex}`);
}
function bytesToNumber(bytes) {
  return hexToNumber(bytesToHex(bytes));
}
function ensureBytes(hex) {
  return isBytes(hex) ? Uint8Array.from(hex) : hexToBytes(hex);
}
function normalizeScalar(num) {
  if (typeof num === "number" && Number.isSafeInteger(num) && num > 0)
    return BigInt(num);
  if (typeof num === "bigint" && isWithinCurveOrder(num))
    return num;
  throw new TypeError("Expected valid private scalar: 0 < scalar < curve.n");
}
function mod(a, b = CURVE.P) {
  const result = a % b;
  return result >= _0n ? result : b + result;
}
function pow2(x, power) {
  const { P } = CURVE;
  let res = x;
  while (power-- > _0n) {
    res *= res;
    res %= P;
  }
  return res;
}
function sqrtMod(x) {
  const { P } = CURVE;
  const _6n = BigInt(6);
  const _11n = BigInt(11);
  const _22n = BigInt(22);
  const _23n = BigInt(23);
  const _44n = BigInt(44);
  const _88n = BigInt(88);
  const b2 = x * x * x % P;
  const b3 = b2 * b2 * x % P;
  const b6 = pow2(b3, _3n) * b3 % P;
  const b9 = pow2(b6, _3n) * b3 % P;
  const b11 = pow2(b9, _2n) * b2 % P;
  const b22 = pow2(b11, _11n) * b11 % P;
  const b44 = pow2(b22, _22n) * b22 % P;
  const b88 = pow2(b44, _44n) * b44 % P;
  const b176 = pow2(b88, _88n) * b88 % P;
  const b220 = pow2(b176, _44n) * b44 % P;
  const b223 = pow2(b220, _3n) * b3 % P;
  const t1 = pow2(b223, _23n) * b22 % P;
  const t2 = pow2(t1, _6n) * b2 % P;
  const rt = pow2(t2, _2n);
  const xc = rt * rt % P;
  if (xc !== x)
    throw new Error("Cannot find square root");
  return rt;
}
function invert(number, modulo = CURVE.P) {
  if (number === _0n || modulo <= _0n) {
    throw new Error(`invert: expected positive integers, got n=${number} mod=${modulo}`);
  }
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n, y = _1n, u = _1n, v = _0n;
  while (a !== _0n) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a, a = r, x = u, y = v, u = m, v = n;
  }
  const gcd = b;
  if (gcd !== _1n)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function invertBatch(nums, p = CURVE.P) {
  const scratch = new Array(nums.length);
  const lastMultiplied = nums.reduce((acc, num, i) => {
    if (num === _0n)
      return acc;
    scratch[i] = acc;
    return mod(acc * num, p);
  }, _1n);
  const inverted = invert(lastMultiplied, p);
  nums.reduceRight((acc, num, i) => {
    if (num === _0n)
      return acc;
    scratch[i] = mod(acc * scratch[i], p);
    return mod(acc * num, p);
  }, inverted);
  return scratch;
}
function bits2int_2(bytes) {
  const delta = bytes.length * 8 - groupLen * 8;
  const num = bytesToNumber(bytes);
  return delta > 0 ? num >> BigInt(delta) : num;
}
function truncateHash(hash, truncateOnly = false) {
  const h = bits2int_2(hash);
  if (truncateOnly)
    return h;
  const { n } = CURVE;
  return h >= n ? h - n : h;
}
var _sha256Sync;
var _hmacSha256Sync;
function isWithinCurveOrder(num) {
  return _0n < num && num < CURVE.n;
}
function isValidFieldElement(num) {
  return _0n < num && num < CURVE.P;
}
function normalizePrivateKey(key) {
  let num;
  if (typeof key === "bigint") {
    num = key;
  } else if (typeof key === "number" && Number.isSafeInteger(key) && key > 0) {
    num = BigInt(key);
  } else if (typeof key === "string") {
    if (key.length !== 2 * groupLen)
      throw new Error("Expected 32 bytes of private key");
    num = hexToNumber(key);
  } else if (isBytes(key)) {
    if (key.length !== groupLen)
      throw new Error("Expected 32 bytes of private key");
    num = bytesToNumber(key);
  } else {
    throw new TypeError("Expected valid private key");
  }
  if (!isWithinCurveOrder(num))
    throw new Error("Expected private key: 0 < key < n");
  return num;
}
function normalizePublicKey(publicKey2) {
  if (publicKey2 instanceof Point) {
    publicKey2.assertValidity();
    return publicKey2;
  } else {
    return Point.fromHex(publicKey2);
  }
}
function normalizeSignature(signature) {
  if (signature instanceof Signature) {
    signature.assertValidity();
    return signature;
  }
  try {
    return Signature.fromDER(signature);
  } catch (error) {
    return Signature.fromCompact(signature);
  }
}
function schnorrChallengeFinalize(ch) {
  return mod(bytesToNumber(ch), CURVE.n);
}
var SchnorrSignature = class _SchnorrSignature {
  constructor(r, s) {
    this.r = r;
    this.s = s;
    this.assertValidity();
  }
  static fromHex(hex) {
    const bytes = ensureBytes(hex);
    if (bytes.length !== 64)
      throw new TypeError(`SchnorrSignature.fromHex: expected 64 bytes, not ${bytes.length}`);
    const r = bytesToNumber(bytes.subarray(0, 32));
    const s = bytesToNumber(bytes.subarray(32, 64));
    return new _SchnorrSignature(r, s);
  }
  assertValidity() {
    const { r, s } = this;
    if (!isValidFieldElement(r) || !isWithinCurveOrder(s))
      throw new Error("Invalid signature");
  }
  toHex() {
    return numTo32bStr(this.r) + numTo32bStr(this.s);
  }
  toRawBytes() {
    return hexToBytes(this.toHex());
  }
};
function schnorrGetPublicKey(privateKey2) {
  return Point.fromPrivateKey(privateKey2).toRawX();
}
var InternalSchnorrSignature = class {
  constructor(message, privateKey2, auxRand = utils.randomBytes()) {
    if (message == null)
      throw new TypeError(`sign: Expected valid message, not "${message}"`);
    this.m = ensureBytes(message);
    const { x, scalar } = this.getScalar(normalizePrivateKey(privateKey2));
    this.px = x;
    this.d = scalar;
    this.rand = ensureBytes(auxRand);
    if (this.rand.length !== 32)
      throw new TypeError("sign: Expected 32 bytes of aux randomness");
  }
  getScalar(priv) {
    const point = Point.fromPrivateKey(priv);
    const scalar = point.hasEvenY() ? priv : CURVE.n - priv;
    return { point, scalar, x: point.toRawX() };
  }
  initNonce(d, t0h) {
    return numTo32b(d ^ bytesToNumber(t0h));
  }
  finalizeNonce(k0h) {
    const k0 = mod(bytesToNumber(k0h), CURVE.n);
    if (k0 === _0n)
      throw new Error("sign: Creation of signature failed. k is zero");
    const { point: R, x: rx, scalar: k } = this.getScalar(k0);
    return { R, rx, k };
  }
  finalizeSig(R, k, e, d) {
    return new SchnorrSignature(R.x, mod(k + e * d, CURVE.n)).toRawBytes();
  }
  error() {
    throw new Error("sign: Invalid signature produced");
  }
  async calc() {
    const { m, d, px, rand } = this;
    const tag2 = utils.taggedHash;
    const t = this.initNonce(d, await tag2(TAGS.aux, rand));
    const { R, rx, k } = this.finalizeNonce(await tag2(TAGS.nonce, t, px, m));
    const e = schnorrChallengeFinalize(await tag2(TAGS.challenge, rx, px, m));
    const sig = this.finalizeSig(R, k, e, d);
    if (!await schnorrVerify(sig, m, px))
      this.error();
    return sig;
  }
  calcSync() {
    const { m, d, px, rand } = this;
    const tag2 = utils.taggedHashSync;
    const t = this.initNonce(d, tag2(TAGS.aux, rand));
    const { R, rx, k } = this.finalizeNonce(tag2(TAGS.nonce, t, px, m));
    const e = schnorrChallengeFinalize(tag2(TAGS.challenge, rx, px, m));
    const sig = this.finalizeSig(R, k, e, d);
    if (!schnorrVerifySync(sig, m, px))
      this.error();
    return sig;
  }
};
async function schnorrSign(msg, privKey, auxRand) {
  return new InternalSchnorrSignature(msg, privKey, auxRand).calc();
}
function schnorrSignSync(msg, privKey, auxRand) {
  return new InternalSchnorrSignature(msg, privKey, auxRand).calcSync();
}
function initSchnorrVerify(signature, message, publicKey2) {
  const raw = signature instanceof SchnorrSignature;
  const sig = raw ? signature : SchnorrSignature.fromHex(signature);
  if (raw)
    sig.assertValidity();
  return {
    ...sig,
    m: ensureBytes(message),
    P: normalizePublicKey(publicKey2)
  };
}
function finalizeSchnorrVerify(r, P, s, e) {
  const R = Point.BASE.multiplyAndAddUnsafe(P, normalizePrivateKey(s), mod(-e, CURVE.n));
  if (!R || !R.hasEvenY() || R.x !== r)
    return false;
  return true;
}
async function schnorrVerify(signature, message, publicKey2) {
  try {
    const { r, s, m, P } = initSchnorrVerify(signature, message, publicKey2);
    const e = schnorrChallengeFinalize(await utils.taggedHash(TAGS.challenge, numTo32b(r), P.toRawX(), m));
    return finalizeSchnorrVerify(r, P, s, e);
  } catch (error) {
    return false;
  }
}
function schnorrVerifySync(signature, message, publicKey2) {
  try {
    const { r, s, m, P } = initSchnorrVerify(signature, message, publicKey2);
    const e = schnorrChallengeFinalize(utils.taggedHashSync(TAGS.challenge, numTo32b(r), P.toRawX(), m));
    return finalizeSchnorrVerify(r, P, s, e);
  } catch (error) {
    if (error instanceof ShaError)
      throw error;
    return false;
  }
}
var schnorr = {
  Signature: SchnorrSignature,
  getPublicKey: schnorrGetPublicKey,
  sign: schnorrSign,
  verify: schnorrVerify,
  signSync: schnorrSignSync,
  verifySync: schnorrVerifySync
};
Point.BASE._setWindowSize(8);
var crypto2 = {
  node: nodeCrypto,
  web: typeof self === "object" && "crypto" in self ? self.crypto : void 0
};
var TAGS = {
  challenge: "BIP0340/challenge",
  aux: "BIP0340/aux",
  nonce: "BIP0340/nonce"
};
var TAGGED_HASH_PREFIXES = {};
var utils = {
  bytesToHex,
  hexToBytes,
  concatBytes,
  mod,
  invert,
  isValidPrivateKey(privateKey2) {
    try {
      normalizePrivateKey(privateKey2);
      return true;
    } catch (error) {
      return false;
    }
  },
  _bigintTo32Bytes: numTo32b,
  _normalizePrivateKey: normalizePrivateKey,
  hashToPrivateKey: (hash) => {
    hash = ensureBytes(hash);
    const minLen = groupLen + 8;
    if (hash.length < minLen || hash.length > 1024) {
      throw new Error(`Expected valid bytes of private key as per FIPS 186`);
    }
    const num = mod(bytesToNumber(hash), CURVE.n - _1n) + _1n;
    return numTo32b(num);
  },
  randomBytes: (bytesLength = 32) => {
    if (crypto2.web) {
      return crypto2.web.getRandomValues(new Uint8Array(bytesLength));
    } else if (crypto2.node) {
      const { randomBytes } = crypto2.node;
      return Uint8Array.from(randomBytes(bytesLength));
    } else {
      throw new Error("The environment doesn't have randomBytes function");
    }
  },
  randomPrivateKey: () => utils.hashToPrivateKey(utils.randomBytes(groupLen + 8)),
  precompute(windowSize = 8, point = Point.BASE) {
    const cached = point === Point.BASE ? point : new Point(point.x, point.y);
    cached._setWindowSize(windowSize);
    cached.multiply(_3n);
    return cached;
  },
  sha256: async (...messages) => {
    if (crypto2.web) {
      const buffer = await crypto2.web.subtle.digest("SHA-256", concatBytes(...messages));
      return new Uint8Array(buffer);
    } else if (crypto2.node) {
      const { createHash } = crypto2.node;
      const hash = createHash("sha256");
      messages.forEach((m) => hash.update(m));
      return Uint8Array.from(hash.digest());
    } else {
      throw new Error("The environment doesn't have sha256 function");
    }
  },
  hmacSha256: async (key, ...messages) => {
    if (crypto2.web) {
      const ckey = await crypto2.web.subtle.importKey("raw", key, { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]);
      const message = concatBytes(...messages);
      const buffer = await crypto2.web.subtle.sign("HMAC", ckey, message);
      return new Uint8Array(buffer);
    } else if (crypto2.node) {
      const { createHmac } = crypto2.node;
      const hash = createHmac("sha256", key);
      messages.forEach((m) => hash.update(m));
      return Uint8Array.from(hash.digest());
    } else {
      throw new Error("The environment doesn't have hmac-sha256 function");
    }
  },
  sha256Sync: void 0,
  hmacSha256Sync: void 0,
  taggedHash: async (tag2, ...messages) => {
    let tagP = TAGGED_HASH_PREFIXES[tag2];
    if (tagP === void 0) {
      const tagH = await utils.sha256(Uint8Array.from(tag2, (c) => c.charCodeAt(0)));
      tagP = concatBytes(tagH, tagH);
      TAGGED_HASH_PREFIXES[tag2] = tagP;
    }
    return utils.sha256(tagP, ...messages);
  },
  taggedHashSync: (tag2, ...messages) => {
    if (typeof _sha256Sync !== "function")
      throw new ShaError("sha256Sync is undefined, you need to set it");
    let tagP = TAGGED_HASH_PREFIXES[tag2];
    if (tagP === void 0) {
      const tagH = _sha256Sync(Uint8Array.from(tag2, (c) => c.charCodeAt(0)));
      tagP = concatBytes(tagH, tagH);
      TAGGED_HASH_PREFIXES[tag2] = tagP;
    }
    return _sha256Sync(tagP, ...messages);
  },
  _JacobianPoint: JacobianPoint
};
Object.defineProperties(utils, {
  sha256Sync: {
    configurable: false,
    get() {
      return _sha256Sync;
    },
    set(val) {
      if (!_sha256Sync)
        _sha256Sync = val;
    }
  },
  hmacSha256Sync: {
    configurable: false,
    get() {
      return _hmacSha256Sync;
    },
    set(val) {
      if (!_hmacSha256Sync)
        _hmacSha256Sync = val;
    }
  }
});

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
var toHex = (buffer) => buffer.reduce((a, c) => a + c.toString(16).padStart(2, "0"), "");
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
    const [tag2] = buffer.subarray(tagIndex, progressIndex);
    const [progress] = buffer.subarray(progressIndex, payloadIndex);
    const payload = buffer.subarray(payloadIndex);
    const isLast = !!(tag2 & 1);
    const isMeta = !!(tag2 & 1 << 1);
    const isBinary = !!(tag2 & 1 << 2);
    const isJson = !!(tag2 & 1 << 3);
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
var strategy_default = ({ init, subscribe: subscribe2, announce }) => {
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
          announceIntervals[relayId] * 0.9
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
    const announceIntervals = initPromises.map(() => announceIntervalMs);
    const announceTimeouts = [];
    const unsubFns = initPromises.map(
      async (relayP, i) => subscribe2(
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
          announceIntervals[i] = ms;
        }
        announceTimeouts[i] = setTimeout(
          () => queueAnnounce(relay, i),
          announceIntervals[i]
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

// node_modules/trystero/src/nostr.js
var clients = {};
var defaultRedundancy = 5;
var tag = "x";
var eventMsgType = "EVENT";
var privateKey = utils.randomPrivateKey();
var publicKey = toHex(schnorr.getPublicKey(privateKey));
var subIdToTopic = {};
var msgHandlers = {};
var kindCache = {};
var now = () => Math.floor(Date.now() / 1e3);
var topicToKind = (topic) => kindCache[topic] ??= strToNum(topic, 1e4) + 2e4;
var createEvent = async (topic, content) => {
  const payload = {
    kind: topicToKind(topic),
    content,
    pubkey: publicKey,
    created_at: now(),
    tags: [[tag, topic]]
  };
  const id = toHex(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        encodeBytes(
          toJson([
            0,
            payload.pubkey,
            payload.created_at,
            payload.kind,
            payload.tags,
            payload.content
          ])
        )
      )
    )
  );
  return toJson([
    eventMsgType,
    {
      ...payload,
      id,
      sig: toHex(await schnorr.sign(id, privateKey))
    }
  ]);
};
var subscribe = (subId, topic) => {
  subIdToTopic[subId] = topic;
  return toJson([
    "REQ",
    subId,
    {
      kinds: [topicToKind(topic)],
      since: now(),
      ["#" + tag]: [topic]
    }
  ]);
};
var unsubscribe = (subId) => {
  delete subIdToTopic[subId];
  return toJson(["CLOSE", subId]);
};
var joinRoom = strategy_default({
  init: (config) => getRelays(config, defaultRelayUrls, defaultRedundancy, true).map((url) => {
    const client = makeSocket(url, (data) => {
      const [msgType, subId, payload, relayMsg] = fromJson(data);
      if (msgType !== eventMsgType) {
        const prefix = `${libName}: relay failure from ${client.url} - `;
        if (msgType === "NOTICE") {
          console.warn(prefix + subId);
        } else if (msgType === "OK" && !payload) {
          console.warn(prefix + relayMsg);
        }
        return;
      }
      msgHandlers[subId]?.(subIdToTopic[subId], payload.content);
    });
    clients[url] = client;
    return client.ready;
  }),
  subscribe: (client, rootTopic, selfTopic, onMessage) => {
    const rootSubId = genId(64);
    const selfSubId = genId(64);
    msgHandlers[rootSubId] = msgHandlers[selfSubId] = (topic, data) => onMessage(
      topic,
      data,
      async (peerTopic, signal) => client.send(await createEvent(peerTopic, signal))
    );
    client.send(subscribe(rootSubId, rootTopic));
    client.send(subscribe(selfSubId, selfTopic));
    return () => {
      client.send(unsubscribe(rootSubId));
      client.send(unsubscribe(selfSubId));
      delete msgHandlers[rootSubId];
      delete msgHandlers[selfSubId];
    };
  },
  announce: async (client, rootTopic) => client.send(await createEvent(rootTopic, toJson({ peerId: selfId })))
});
var getRelaySockets = socketGetter(clients);
var defaultRelayUrls = [
  "black.nostrcity.club",
  "eu.purplerelay.com",
  "ftp.halifax.rwth-aachen.de/nostr",
  "nostr.cool110.xyz",
  "nostr.data.haus",
  "nostr.mom",
  "nostr.oxtr.dev",
  "nostr.sathoarder.com",
  "nostr.vulpem.com",
  "nostrelay.memory-art.xyz",
  "playground.nostrcheck.me/relay",
  "relay.agorist.space",
  "relay.binaryrobot.com",
  "relay.fountain.fm",
  "relay.mostro.network",
  "relay.nostraddress.com",
  "relay.nostrdice.com",
  "relay.nostromo.social",
  "relay.oldenburg.cool",
  "relay.snort.social",
  "relay.verified-nostr.com",
  "sendit.nosflare.com",
  "yabu.me/v2"
].map((url) => "wss://" + url);
export {
  defaultRelayUrls,
  getRelaySockets,
  joinRoom,
  selfId
};
/*! Bundled license information:

@noble/secp256k1/lib/esm/index.js:
  (*! noble-secp256k1 - MIT License (c) 2019 Paul Miller (paulmillr.com) *)
*/
