// ============================================================================
// Auth foundation — crypto. Phase TS-11.
//
// PIN hashing + verification. Two on-disk hash formats supported:
//   - v1: `h_<base36 djb2>`  — legacy, kept for upgrade compatibility.
//        verifyPin() still accepts these; submitPinBuffer() in pin.ts
//        rewrites them to v2 on a successful entry.
//   - v2: JSON `{ v: 2, salt: <b64>, hash: <b64> }` — PBKDF2-SHA256
//        with 100 000 iterations on a 16-byte random salt.
//
// DESIGN RULES (non-negotiable):
// - PURE crypto layer. NO DOM, NO Supabase, NO `window` reads (except the
//   browser-API `crypto.subtle` which is the Web Crypto API host).
// - Functions are deterministic given (input, salt) — `hashPin` uses fresh
//   randomness for the salt; the harness mocks `crypto.getRandomValues`
//   when it needs reproducible output.
// - Constant-time compare on the 256-bit hash in `verifyPin` — never use
//   `==` or `===` over the hash bytes, that's a timing side-channel.
// ============================================================================

const PIN_HASH_VERSION = 2;
const PIN_PBKDF2_ITERATIONS = 100000;

/** Legacy djb2 hash — only used to verify pre-migration stored hashes. */
export function legacyHashPin(pin: string): string {
  if (!pin) return '';
  let h = 5381;
  for (let i = 0; i < pin.length; i++) {
    h = ((h * 33) ^ pin.charCodeAt(i)) >>> 0;
  }
  return 'h_' + h.toString(36);
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pbkdf2(pin: string, saltBytes: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  // The TS DOM lib types PBKDF2 `salt` as `BufferSource` (= ArrayBuffer
  // or ArrayBufferView<ArrayBuffer>), but `Uint8Array<ArrayBufferLike>`
  // doesn't satisfy that union after the recent narrowing of
  // SharedArrayBuffer. Cast through `BufferSource` — the runtime contract
  // is unchanged (Uint8Array IS a valid BufferSource at the platform level).
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes as unknown as BufferSource, iterations: PIN_PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

/** Hash a PIN for storage. Returns a JSON-encoded v2 record. '' for empty input. */
export async function hashPin(pin: string): Promise<string> {
  if (!pin) return '';
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hashBytes = await pbkdf2(pin, saltBytes);
  return JSON.stringify({
    v: PIN_HASH_VERSION,
    salt: bytesToB64(saltBytes),
    hash: bytesToB64(hashBytes),
  });
}

/**
 * Verify a PIN against a stored hash. Accepts v1 (djb2) AND v2 (PBKDF2)
 * formats — the caller (submitPinBuffer in pin.ts) is responsible for
 * upgrading v1 hashes after a successful entry.
 */
export async function verifyPin(pin: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored || !pin) return false;
  // Legacy djb2 format
  if (stored.startsWith('h_')) {
    return legacyHashPin(pin) === stored;
  }
  // v2 PBKDF2 format
  try {
    const parsed = JSON.parse(stored) as { v?: number; salt?: string; hash?: string };
    if (!parsed || parsed.v !== PIN_HASH_VERSION || !parsed.salt || !parsed.hash) return false;
    const saltBytes = b64ToBytes(parsed.salt);
    const challenge = await pbkdf2(pin, saltBytes);
    const expected = b64ToBytes(parsed.hash);
    if (challenge.length !== expected.length) return false;
    // Constant-time compare — avoid timing side-channel on the 256-bit hash.
    let diff = 0;
    for (let i = 0; i < challenge.length; i++) diff |= challenge[i] ^ expected[i];
    return diff === 0;
  } catch (_e) {
    return false;
  }
}
