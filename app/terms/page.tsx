import type { Metadata } from "next";
import Link from "next/link";
import { cardClass } from "@/lib/ui";
import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/contact";

export const metadata: Metadata = { title: "Terms of service — SpearLog" };

export default function TermsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Terms of service</h1>
        <p className="mt-1 text-sm text-muted">Last updated August 2026.</p>
      </div>

      <section className={`${cardClass} flex flex-col gap-4 p-5 text-sm leading-relaxed`}>
        <p>
          SpearLog is a small, independently run app for logging personal fishing/spearfishing activity. These
          terms are intentionally short and informal — this isn&apos;t a legal document drafted by a lawyer, and if
          you have specific legal concerns, get your own advice.
        </p>

        <div>
          <h2 className="mb-1 font-semibold">The service</h2>
          <p className="text-muted">
            SpearLog is provided &quot;as is,&quot; without warranty of any kind. It&apos;s a personal-scale project,
            not a commercial product with guaranteed uptime or support. Tide, current, and weather data comes from
            third-party providers (Stormglass) and location lookups from another (LocationIQ/Nominatim) — that data
            may occasionally be wrong, delayed, or unavailable, and we can&apos;t guarantee its accuracy.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold">Your account</h2>
          <p className="text-muted">
            You&apos;re responsible for keeping your login credentials secure and for the accuracy of the data you
            enter. Don&apos;t share your account or use someone else&apos;s.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold">Acceptable use</h2>
          <p className="text-muted">
            Don&apos;t abuse the service — no automated scraping, no attempting to bypass rate limits or access
            other users&apos; data, no using it to overload third-party services the app depends on. Accounts that
            abuse the service may be suspended or removed.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold">Changes and availability</h2>
          <p className="text-muted">
            The service may change, be temporarily unavailable, or be discontinued at any time, with or without
            notice. See the <Link href="/privacy" className="text-accent hover:underline">privacy policy</Link> for
            how your data is handled.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold">Getting in touch</h2>
          <p className="text-muted">
            Questions about these terms, or about your account, go to{" "}
            <a className="text-accent hover:underline" href={CONTACT_MAILTO}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
