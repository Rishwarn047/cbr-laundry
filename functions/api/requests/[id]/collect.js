import { markCollected } from "../../../_db.js";
import { sendToRole } from "../../../_push.js";

export async function onRequestPost({ request, params, env, waitUntil }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const collectedBy = typeof body.collectedBy === "string" ? body.collectedBy.trim() : "";
  const collectedNotes = typeof body.collectedNotes === "string" ? body.collectedNotes.trim() : "";

  if (!collectedBy) {
    return Response.json({ error: "Collector name is required" }, { status: 400 });
  }

  const { record, error } = await markCollected(env, params.id, { collectedBy, collectedNotes });
  if (error === "not_found") return Response.json({ error: "Request not found" }, { status: 404 });
  if (error === "invalid_state") return Response.json({ error: "Request is not marked Done yet" }, { status: 409 });

  waitUntil(sendToRole(env, "manager", {
    title: "Laundry Collected",
    body: `Villa ${record.villaNumber} collected by ${collectedBy}`,
    url: "/dashboard.html"
  }).catch(() => {}));

  return Response.json({ record });
}
