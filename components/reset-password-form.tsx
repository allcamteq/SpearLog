"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { inputClass, labelClass, cardClass, button } from "@/lib/ui";

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Checked here rather than server-side: the confirmation field exists to
    // catch a typo before it becomes a password nobody knows, and the server has
    // no use for a second copy.
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Could not reset your password.");
        return;
      }

      setDone(true);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className={`${cardClass} flex flex-col gap-3 p-5`}>
        <p className="text-sm text-danger">This link is missing its reset token.</p>
        <p className="text-sm text-muted">
          Open the link from the email exactly as it was sent, or request a new one.
        </p>
        <Link href="/forgot-password" className="text-sm text-accent hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className={`${cardClass} flex flex-col gap-3 p-5`}>
        <p className="text-sm text-foreground">
          Your password has been changed. The link you used no longer works.
        </p>
        <button type="button" className={button("primary")} onClick={() => router.push("/login")}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} flex flex-col gap-4 p-5`}>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div>
        <label className={labelClass} htmlFor="new-password">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
      </div>
      <div>
        <label className={labelClass} htmlFor="confirm-password">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <button type="submit" disabled={pending} className={button("primary")}>
        {pending ? "Saving…" : "Set new password"}
      </button>
      <p className="text-sm text-muted">
        Link expired?{" "}
        <Link href="/forgot-password" className="text-accent hover:underline">
          Request a new one
        </Link>
      </p>
    </form>
  );
}
