import { base64UrlDecodeToBytes, base64UrlDecodeToString, createSessionCookie, parseAllowedEmails } from "../../_auth.js";

const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function verifyGoogleIdToken(idToken, clientId) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [headerB64, payloadB64, sigB64] = parts;

  const header = JSON.parse(base64UrlDecodeToString(headerB64));
  const payload = JSON.parse(base64UrlDecodeToString(payloadB64));

  if (payload.aud !== clientId) throw new Error("Audience mismatch");
  if (!GOOGLE_ISSUERS.has(payload.iss)) throw new Error("Bad issuer");
  if (!payload.exp || Date.now() >= payload.exp * 1000) throw new Error("Token expired");
  if (!payload.email || payload.email_verified !== true) throw new Error("Email not verified");

  const certsRes = await fetch(GOOGLE_CERTS_URL);
  if (!certsRes.ok) throw new Error("Could not fetch Google certs");
  const { keys } = await certsRes.json();
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown signing key");

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecodeToBytes(sigB64);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, signedData);
  if (!valid) throw new Error("Bad signature");

  return payload;
}

export async function onRequestPost(context) {
  const { env, request } = context;

  if (!env.GOOGLE_CLIENT_ID || !env.SESSION_SECRET || !env.ALLOWED_EMAILS) {
    return jsonError("Server not configured", 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!body || typeof body.credential !== "string") {
    return jsonError("Missing credential", 400);
  }

  let payload;
  try {
    payload = await verifyGoogleIdToken(body.credential, env.GOOGLE_CLIENT_ID);
  } catch {
    return jsonError("Invalid Google credential", 401);
  }

  const email = String(payload.email).toLowerCase();
  const allowed = parseAllowedEmails(env.ALLOWED_EMAILS);
  if (!allowed.includes(email)) {
    return jsonError("This account is not authorized to access the dashboard", 403);
  }

  const cookie = await createSessionCookie(env, email, body.remember === true);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie }
  });
}
