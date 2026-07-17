import { auth } from "@/auth";

/** Returns the logged-in user's numeric id, or null if there's no session (route handlers still need to check, since middleware doesn't cover every path e.g. /api/auth/*). */
export async function getUserId(): Promise<number | null> {
  const session = await auth();
  return session?.user?.id ? Number(session.user.id) : null;
}
