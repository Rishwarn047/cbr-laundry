import { listRequests } from "../../_db.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const villaParam = url.searchParams.get("villa");
  const villaNumber = villaParam ? Number(villaParam) : undefined;

  const records = await listRequests(env, { status, villaNumber });
  return Response.json({ records });
}
