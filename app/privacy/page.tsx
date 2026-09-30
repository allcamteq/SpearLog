import type { Metadata } from "next";
import { cardClass } from "@/lib/ui";

export const metadata: Metadata = { title: "Privacy policy — SpearLog" };

export default function PrivacyPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy policy</h1>
        <p className="mt-1 text-sm text-muted">Last updated August 2026.</p>
      </div>

      <section className={`${cardClass} flex flex-col gap-4 p-5 text-sm leading-relaxed`}>
        <p>
          SpearLog is a small, independently run app. This policy explains what data it collects and why, in plain
          language. It isn&apos;t a legal document drafted by a lawyer — if you have specific legal concerns, get
          your own advice — but it does describe, honestly, what actually happens with your data.
        </p>

        <div>
          <h2 className="mb-1 font-semibold">What we collect</h2>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>
              <span className="text-foreground">Account info:</span> your email address, a hashed password (we never
              store or see your actual password), and an optional display name.
            </li>
            <li>
              <span className="text-foreground">Fishing data you enter:</span> session details (date, location text,
              country, tide/current/sea/wind conditions, comments, ratings), catches (species, quantity, weight,
              size), and named &quot;marks&quot; — fishing spots you save, which can include precise GPS
              coordinates.
            </li>
            <li>
              <span className="text-foreground">Photos:</span> any photos you attach to a session are uploaded to
              our file storage provider (Vercel Blob). Photo URLs use a random, unguessable identifier rather than
              your name or session details, but they are not access-controlled — anyone who obtained the exact URL
              could view the image. Don&apos;t upload anything you wouldn&apos;t want seen if a link ever leaked.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-1 font-semibold">GPS coordinates and location data</h2>
          <p className="text-muted">
            Marks and sessions can store precise GPS coordinates for fishing spots. This data can reveal real-world
            locations, including places you consider personal or private (a home launch point, a favorite spot).
            It&apos;s visible only to your own account — other users cannot see your marks, sessions, or catches.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold">Who else sees your data</h2>
          <p className="text-muted">We don&apos;t sell data, run ads, or use analytics/tracking of any kind. Data is shared only with the services that make the app work:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
            <li>
              <span className="text-foreground">LocationIQ / Nominatim</span> — receives location text or
              coordinates when you look up or geocode a place.
            </li>
            <li>
              <span className="text-foreground">Stormglass</span> — receives coordinates and a date/time when you
              fetch tide, current, or weather conditions for a session.
            </li>
            <li>
              <span className="text-foreground">Vercel</span> — hosts the app and stores uploaded photos.
            </li>
            <li>
              <span className="text-foreground">Turso</span> — hosts the database that stores your account and
              fishing data.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-1 font-semibold">Deleting your data</h2>
          <p className="text-muted">
            There isn&apos;t a self-service &quot;delete my account&quot; button yet. If you&apos;d like your account
            and all associated data deleted, contact the app owner directly and it will be handled by request.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold">Changes</h2>
          <p className="text-muted">
            If this policy changes in a meaningful way, the &quot;last updated&quot; date above will change too.
          </p>
        </div>
      </section>
    </div>
  );
}
