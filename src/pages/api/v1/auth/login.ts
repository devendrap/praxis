import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { verifyPassword, createSession, sessionCookie } from "../../../../lib/auth";
import { findUserByEmail } from "../../../../lib/d1";

export async function POST(context: APIContext): Promise<Response> {
  let email: string;
  let password: string;
  try {
    const formData = await context.request.formData();
    email = (formData.get("email") as string)?.trim().toLowerCase();
    password = formData.get("password") as string;
  } catch {
    return context.redirect("/login?error=invalid");
  }

  if (!email || !password) {
    return context.redirect("/login?error=invalid");
  }

  const user = await findUserByEmail(env.DB, email);
  if (!user) {
    return context.redirect("/login?error=invalid");
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return context.redirect("/login?error=invalid");
  }

  const token = await createSession(env.SESSIONS, {
    id: user.id,
    email: user.email,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": sessionCookie(token),
    },
  });
}
