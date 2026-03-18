import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { getSession, parseSessionToken } from "./lib/auth";

const PUBLIC_ROUTES = new Set(["/", "/login", "/register"]);
const PUBLIC_API_PREFIXES = ["/api/v1/coach", "/api/v1/auth/"];
const STATIC_PREFIXES = ["/_astro/", "/favicon"];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  if (pathname.endsWith("/") && PUBLIC_ROUTES.has(pathname.slice(0, -1))) return true;
  for (const prefix of STATIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const cookieHeader = context.request.headers.get("cookie");
  const token = parseSessionToken(cookieHeader);

  // Try to resolve user from session
  if (token) {
    const user = await getSession(env.SESSIONS, token);
    if (user) {
      context.locals.user = user;
    }
  }

  // Public routes — allow through regardless of auth
  if (isPublicRoute(pathname)) {
    return next();
  }

  // Protected routes — require auth
  if (!context.locals.user) {
    if (isApiRoute(pathname)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return context.redirect("/login");
  }

  return next();
});
