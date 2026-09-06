import { base64UrlEncode, base64UrlDecodeToBytes } from "./_auth.js";

const PUSH_RECORD_SIZE = 4096;

function textToBytes(str) {
  return new TextEncoder().encode(str);
}

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

async function hkdf(ikm, salt, info, lengthBytes) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    lengthBytes * 8
  );
  return new Uint8Array(bits);
}

async function importVapidPrivateKey(env) {
  const pub = base64UrlDecodeToBytes(env.VAPID_PUBLIC_KEY);
  const x = pub.slice(1, 33);
  const y = pub.slice(33, 65);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: env.VAPID_PRIVATE_KEY,
    x: base64UrlEncode(x),
    y: base64UrlEncode(y),
    ext: true
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function buildVapidAuthHeader(env, endpoint) {
  const audience = new URL(endpoint).origin;
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: env.VAPID_SUBJECT || "mailto:admin@example.com"
  };
  const signingInput =
    `${base64UrlEncode(textToBytes(JSON.stringify(header)))}.` +
    `${base64UrlEncode(textToBytes(JSON.stringify(payload)))}`;

  const key = await importVapidPrivateKey(env);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    textToBytes(signingInput)
  );
  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
  return `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`;
}

async function encryptPayload(subscription, payloadObj) {
  const uaPublicBytes = base64UrlDecodeToBytes(subscription.p256dh);
  const authSecret = base64UrlDecodeToBytes(subscription.auth);

  const uaPublicKey = await crypto.subtle.importKey(
    "raw", uaPublicBytes, { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const asKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", asKeyPair.publicKey));

  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPublicKey }, asKeyPair.privateKey, 256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // RFC 8291 §3.3 — combine the ECDH secret with the subscriber's auth secret.
  const keyInfo = concatBytes(textToBytes("WebPush: info\0"), uaPublicBytes, asPublicRaw);
  const ikm = await hkdf(sharedSecret, authSecret, keyInfo, 32);

  // RFC 8188 aes128gcm — derive the content-encryption key and nonce from a fresh salt.
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(ikm, salt, textToBytes("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(ikm, salt, textToBytes("Content-Encoding: nonce\0"), 12);

  const plaintext = concatBytes(textToBytes(JSON.stringify(payloadObj)), new Uint8Array([2]));

  const cekKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, cekKey, plaintext)
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, PUSH_RECORD_SIZE, false);
  const idLen = new Uint8Array([asPublicRaw.length]);

  return concatBytes(salt, rs, idLen, asPublicRaw, ciphertext);
}

async function sendPushNotification(env, subscription, payloadObj) {
  const body = await encryptPayload(subscription, payloadObj);
  const authHeader = await buildVapidAuthHeader(env, subscription.endpoint);

  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Authorization": authHeader
    },
    body
  });

  return { expired: res.status === 404 || res.status === 410, ok: res.ok, status: res.status };
}

async function sendToSubscriptions(env, rows, payloadObj) {
  await Promise.all(rows.map(async (row) => {
    try {
      const result = await sendPushNotification(env, row, payloadObj);
      if (result.expired) {
        await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(row.id).run();
      }
    } catch {
      // Best-effort — a single bad subscription shouldn't block the others or the caller.
    }
  }));
}

export async function sendToRole(env, role, payloadObj) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
  const { results } = await env.DB.prepare(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE role = ?`
  ).bind(role).all();
  await sendToSubscriptions(env, results, payloadObj);
}

export async function sendToRequest(env, requestId, payloadObj) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
  const { results } = await env.DB.prepare(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE request_id = ?`
  ).bind(requestId).all();
  await sendToSubscriptions(env, results, payloadObj);
}
