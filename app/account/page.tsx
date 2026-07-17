import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth-helpers";
import { getUserById } from "@/db/queries/users";
import { formatDateDisplay } from "@/lib/date";
import { cardClass, button } from "@/lib/ui";

export default async function AccountPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const user = await getUserById(userId);
  if (!user) redirect("/login");

  const memberSince = formatDateDisplay(user.createdAt.slice(0, 10));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted">Your profile, subscription, and app info.</p>
      </div>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-3 text-sm font-semibold">User details</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted">Name</dt>
            <dd className="mt-0.5 text-sm">{user.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Email</dt>
            <dd className="mt-0.5 text-sm">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Member since</dt>
            <dd className="mt-0.5 text-sm">{memberSince}</dd>
          </div>
        </dl>
        <button type="button" disabled className={`${button("secondary")} mt-4`}>
          Edit profile (coming soon)
        </button>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-3 text-sm font-semibold">Subscription</h2>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Free plan</p>
            <p className="mt-0.5 text-xs text-muted">Placeholder — paid plans aren&apos;t available yet.</p>
          </div>
          <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-soft-foreground">
            Active
          </span>
        </div>
        <button type="button" disabled className={`${button("secondary")} mt-4`}>
          Manage subscription (coming soon)
        </button>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-2 text-sm font-semibold">About SpearLog</h2>
        <p className="text-sm text-muted">
          SpearLog is a personal spearfishing log — track sessions, catches, conditions, and named GPS marks in one
          place.
        </p>
        <p className="mt-2 text-xs text-muted">Version 0.1.0 (placeholder)</p>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-3 text-sm font-semibold">Policies</h2>
        <ul className="flex flex-col gap-2 text-sm">
          <li>
            <span className="text-foreground">Privacy policy</span>
            <span className="ml-2 text-xs text-muted">(placeholder — not yet written)</span>
          </li>
          <li>
            <span className="text-foreground">Terms of service</span>
            <span className="ml-2 text-xs text-muted">(placeholder — not yet written)</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
