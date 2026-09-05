import { verifySession } from "./_auth.js";

const PROTECTED_PATHS = new Set(["/dashboard.html", "/dashboard"]);

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (!PROTECTED_PATHS.has(url.pathname)) {
    return next();
  }

  const email = await verifySession(env, request.headers.get("Cookie"));
  if (email) {
    return next();
  }

  return Response.redirect(new URL("/login.html", url), 302);
}
