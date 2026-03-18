import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { hashPassword, createSession, sessionCookie } from "../../../../lib/auth";
import { createUser, findUserByEmail } from "../../../../lib/d1";

export async function POST(context: APIContext): Promise<Response> {
  let email: string;
  let password: string;
  try {
    const formData = await context.request.formData();
    email = (formData.get("email") as string)?.trim().toLowerCase();
    password = formData.get("password") as string;
  } catch {
    return context.redirect("/register?error=invalid");
  }

  if (!email || !password) {
    return context.redirect("/register?error=missing");
  }

  if (password.length < 8) {
    return context.redirect("/register?error=short");
  }

  const existing = await findUserByEmail(env.DB, email);
  if (existing) {
    return context.redirect("/register?error=exists");
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser(env.DB, email, passwordHash);

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
