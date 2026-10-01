import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserId } from "@/lib/auth-helpers";
import { getUserById } from "@/db/queries/users";
import { formatDateDisplay } from "@/lib/date";
import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/contact";
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
        <h2 className="mb-2 text-sm font-semibold">Support</h2>
        <p className="text-sm text-muted">
          Account deletion and data corrections aren&apos;t self-service yet, so they go by email — as does anything
          else that needs a human.
        </p>
        <a className="mt-2 inline-block text-sm text-accent hover:underline" href={CONTACT_MAILTO}>
          {CONTACT_EMAIL}
        </a>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-3 text-sm font-semibold">Policies</h2>
        <ul className="flex flex-col gap-2 text-sm">
          <li>
            <Link href="/privacy" className="text-accent hover:underline">
              Privacy policy
            </Link>
          </li>
          <li>
            <Link href="/terms" className="text-accent hover:underline">
              Terms of service
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
