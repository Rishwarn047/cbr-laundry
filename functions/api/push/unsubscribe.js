export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.endpoint !== "string") {
    return Response.json({ error: "endpoint is required" }, { status: 400 });
  }

  await env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).bind(body.endpoint).run();
  return Response.json({ ok: true });
}
