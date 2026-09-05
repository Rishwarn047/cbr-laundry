const SESSION_TTL_REMEMBERED_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_TTL_DEFAULT_MS = 24 * 60 * 60 * 1000; // 1 day
const SESSION_COOKIE = "session";

export function base64UrlEncode(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecodeToBytes(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(b64url.length + (4 - (b64url.length % 4)) % 4, "=");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function base64UrlDecodeToString(b64url) {
  return new TextDecoder().decode(base64UrlDecodeToBytes(b64url));
}

async function hmacSign(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function parseAllowedEmails(raw) {
  return String(raw || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

export async function createSessionCookie(env, email, remember) {
  const ttlMs = remember ? SESSION_TTL_REMEMBERED_MS : SESSION_TTL_DEFAULT_MS;
  const payload = JSON.stringify({ email, exp: Date.now() + ttlMs });
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payload));
  const sig = await hmacSign(env.SESSION_SECRET, payloadB64);
  let cookie = `${SESSION_COOKIE}=${payloadB64}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  // "Remember me" gets a persistent cookie; otherwise it's a browser-session cookie
  // (no Max-Age) that disappears when the browser closes, capped server-side at 1 day.
  if (remember) cookie += `; Max-Age=${Math.floor(ttlMs / 1000)}`;
  return cookie;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

export async function verifySession(env, cookieHeader) {
  if (!env.SESSION_SECRET) return null;
  const raw = readCookie(cookieHeader, SESSION_COOKIE);
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return null;
  const payloadB64 = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);

  const expectedSig = await hmacSign(env.SESSION_SECRET, payloadB64);
  if (!constantTimeEqual(expectedSig, sig)) return null;

  let payload;
  try {
    payload = JSON.parse(base64UrlDecodeToString(payloadB64));
  } catch {
    return null;
  }
  if (!payload.email || !payload.exp || Date.now() > payload.exp) return null;

  const allowed = parseAllowedEmails(env.ALLOWED_EMAILS);
  if (!allowed.includes(String(payload.email).toLowerCase())) return null;

  return payload.email;
}
