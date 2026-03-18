const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = await deriveKey(password, salt);
  return `${bufferToHex(salt)}:${bufferToHex(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  const salt = hexToBuffer(saltHex);
  const hash = await deriveKey(password, salt);
  return bufferToHex(hash) === hashHex;
}

export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bufferToHex(bytes);
}

export interface SessionUser {
  id: string;
  email: string;
}

export async function createSession(
  kv: KVNamespace,
  user: SessionUser
): Promise<string> {
  const token = generateSessionToken();
  await kv.put(token, JSON.stringify(user), { expirationTtl: SESSION_TTL });
  return token;
}

export async function getSession(
  kv: KVNamespace,
  token: string
): Promise<SessionUser | null> {
  const data = await kv.get(token);
  if (!data) return null;
  return JSON.parse(data) as SessionUser;
}

export async function destroySession(
  kv: KVNamespace,
  token: string
): Promise<void> {
  await kv.delete(token);
}

export function sessionCookie(token: string, maxAge: number = SESSION_TTL): string {
  return `praxis-session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `praxis-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function parseSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)praxis-session=([^;]+)/);
  return match?.[1] || null;
}
