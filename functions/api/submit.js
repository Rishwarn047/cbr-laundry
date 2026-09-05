import { insertRequest } from "../_db.js";

function isValidVilla(n) {
  return Number.isInteger(n) && n >= 1 && n <= 50;
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const villaNumber = Number(body.villaNumber);
  const staffName = typeof body.staffName === "string" ? body.staffName.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const urgent = !!body.urgent;

  if (!isValidVilla(villaNumber)) {
    return Response.json({ error: "Invalid villa number" }, { status: 400 });
  }
  if (!staffName) {
    return Response.json({ error: "Staff name is required" }, { status: 400 });
  }

  const record = await insertRequest(env, { villaNumber, staffName, notes, urgent });
  return Response.json({ record }, { status: 201 });
}
