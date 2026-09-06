export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { endpoint, role } = body || {};
  if (typeof endpoint !== "string" || typeof role !== "string") {
    return Response.json({ error: "endpoint and role are required" }, { status: 400 });
  }

  const row = await env.DB.prepare(
    `SELECT id FROM push_subscriptions WHERE endpoint = ? AND role = ?`
  ).bind(endpoint, role).first();

  return Response.json({ subscribed: !!row });
}
