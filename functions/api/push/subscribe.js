import { verifySession } from "../../_auth.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { subscription, role, requestId } = body || {};
  if (
    !subscription ||
    typeof subscription.endpoint !== "string" ||
    !subscription.keys ||
    typeof subscription.keys.p256dh !== "string" ||
    typeof subscription.keys.auth !== "string"
  ) {
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  }
  if (role !== "villa" && role !== "manager") {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }
  if (role === "villa" && typeof requestId !== "string") {
    return Response.json({ error: "requestId is required for villa subscriptions" }, { status: 400 });
  }

  // Manager subscriptions receive business data (new requests, collections) — require a session.
  if (role === "manager") {
    const email = await verifySession(env, request.headers.get("Cookie"));
    if (!email) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, role, request_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      role = excluded.role,
      request_id = excluded.request_id,
      created_at = excluded.created_at
  `).bind(
    id,
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
    role,
    role === "villa" ? requestId : null,
    new Date().toISOString()
  ).run();

  return Response.json({ ok: true });
}
