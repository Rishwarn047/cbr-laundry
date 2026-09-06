import { verifySession } from "../../_auth.js";
import { sendToRole } from "../../_push.js";

export async function onRequestPost({ request, env }) {
  const email = await verifySession(env, request.headers.get("Cookie"));
  if (!email) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  await sendToRole(env, "manager", { type: "reload" });
  return Response.json({ ok: true });
}
