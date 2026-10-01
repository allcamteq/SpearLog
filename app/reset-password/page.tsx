import { Suspense } from "react";
import type { Metadata } from "next";
import { cardClass } from "@/lib/ui";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = { title: "Set a new password — SpearLog" };

/**
 * The token lives in the query string, which the form reads with
 * `useSearchParams`. That bails this route's client tree out to client-side
 * rendering up to the nearest Suspense boundary, so the boundary is here and the
 * heading above it still prerenders.
 */
export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-1 text-sm text-muted">Choose a new password for your SpearLog account.</p>
      </div>

      <Suspense fallback={<div className={`${cardClass} p-5 text-sm text-muted`}>Loading…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
