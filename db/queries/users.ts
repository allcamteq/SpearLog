import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, type UserRow } from "@/db/schema";

export async function getUserById(id: number): Promise<UserRow | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}
