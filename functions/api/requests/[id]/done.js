import { markDone } from "../../../_db.js";

export async function onRequestPost({ params, env }) {
  const { record, error } = await markDone(env, params.id);
  if (error === "not_found") return Response.json({ error: "Request not found" }, { status: 404 });
  if (error === "invalid_state") return Response.json({ error: "Request is not pending" }, { status: 409 });
  return Response.json({ record });
}
