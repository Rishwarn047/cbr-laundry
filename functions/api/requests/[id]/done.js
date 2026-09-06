import { markDone } from "../../../_db.js";
import { sendToRequest } from "../../../_push.js";

export async function onRequestPost({ params, env, waitUntil }) {
  const { record, error } = await markDone(env, params.id);
  if (error === "not_found") return Response.json({ error: "Request not found" }, { status: 404 });
  if (error === "invalid_state") return Response.json({ error: "Request is not pending" }, { status: 409 });

  waitUntil(sendToRequest(env, params.id, {
    title: "Laundry Ready",
    body: `Villa ${record.villaNumber}'s laundry is ready for collection`,
    url: "/"
  }).catch(() => {}));

  return Response.json({ record });
}
