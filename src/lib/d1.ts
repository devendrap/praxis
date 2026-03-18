export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export async function createUser(
  db: D1Database,
  email: string,
  passwordHash: string
): Promise<UserRow> {
  const result = await db
    .prepare(
      "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id, email, password_hash, created_at"
    )
    .bind(email, passwordHash)
    .first<UserRow>();

  if (!result) throw new Error("Failed to create user");
  return result;
}

export async function findUserByEmail(
  db: D1Database,
  email: string
): Promise<UserRow | null> {
  return db
    .prepare("SELECT id, email, password_hash, created_at FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();
}
