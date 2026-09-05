import { markCollected } from "../../../_db.js";

export async function onRequestPost({ request, params, env }) {
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
  return Response.json({ record });
}
