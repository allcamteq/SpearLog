import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { ipAddress } from "@vercel/functions";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { checkAndHit } from "@/lib/rate-limit";

class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : undefined;
        const password = typeof credentials?.password === "string" ? credentials.password : undefined;
        if (!email || !password) return null;

        const ip = ipAddress(request) ?? "unknown";
        const [okEmail, okIp] = await Promise.all([
          checkAndHit(`login:email:${email}`, { windowMinutes: 15, limit: 5 }),
          checkAndHit(`login:ip:${ip}`, { windowMinutes: 15, limit: 20 }),
        ]);
        if (!okEmail || !okIp) throw new TooManyAttempts();

        const [user] = await db.select().from(users).where(eq(users.email, email));
        if (!user) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: String(user.id), email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    authorized: ({ auth }) => !!auth?.user,
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
