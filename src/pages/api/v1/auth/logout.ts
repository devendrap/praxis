import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { parseSessionToken, destroySession, clearSessionCookie } from "../../../../lib/auth";

export async function POST(context: APIContext): Promise<Response> {
  const cookieHeader = context.request.headers.get("cookie");
  const token = parseSessionToken(cookieHeader);

  if (token) {
    await destroySession(env.SESSIONS, token);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": clearSessionCookie(),
    },
  });
}
