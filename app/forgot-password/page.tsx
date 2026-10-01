"use client";

import { useState } from "react";
import Link from "next/link";
import { inputClass, labelClass, cardClass, button } from "@/lib/ui";
import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/contact";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Could not send a reset link just now.");
        return;
      }

      // The endpoint answers the same way whether or not the address has an
      // account, and so does this screen — otherwise the form would become a
      // way to find out who has registered.
      setSent(true);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-muted">
          Enter the email address on your account and we&apos;ll send a link to choose a new password.
        </p>
      </div>

      {sent ? (
        <div className={`${cardClass} flex flex-col gap-3 p-5`}>
          <p className="text-sm text-foreground">
            If <span className="font-medium">{email}</span> has an account, a reset link is on its way. It expires in
            an hour and works once.
          </p>
          <p className="text-sm text-muted">
            Nothing arrived? Check the spam folder, then try again — or email{" "}
            <a className="text-accent hover:underline" href={CONTACT_MAILTO}>
              {CONTACT_EMAIL}
            </a>{" "}
            if you&apos;re stuck.
          </p>
          <Link href="/login" className="text-sm text-accent hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={`${cardClass} flex flex-col gap-4 p-5`}>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div>
            <label className={labelClass} htmlFor="reset-email">
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              required
              autoComplete="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" disabled={pending} className={button("primary")}>
            {pending ? "Sending…" : "Send reset link"}
          </button>
          <p className="text-sm text-muted">
            Remembered it?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
