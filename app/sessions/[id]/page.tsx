import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionById } from "@/db/queries/sessions";
import { listPhotos } from "@/db/queries/photos";
import { RatingBadge } from "@/components/rating-badge";
import { DeleteSessionButton } from "@/components/delete-session-button";
import { SessionPhotos } from "@/components/session-photos";
import { CURRENT_LEVEL_LABELS, TIDE_TYPE_LABELS } from "@/lib/constants";
import { compassDirection } from "@/lib/tide-derivation";
import { getUserId } from "@/lib/auth-helpers";
import { formatDateDisplay } from "@/lib/date";
import { button, cardClass } from "@/lib/ui";

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function SectionCard({
  title,
  children,
  tinted,
}: {
  title: string;
  children: React.ReactNode;
  tinted?: boolean;
}) {
  return (
    <section className={tinted ? "rounded-xl border border-accent/25 bg-accent-soft/40 p-5" : `${cardClass} p-5`}>
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function formatDepthRange(from: number | null, to: number | null): string | null {
  if (from != null && to != null) return `${from}–${to} m`;
  if (from != null) return `${from} m`;
  if (to != null) return `up to ${to} m`;
  return null;
}

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const { id } = await params;
  const [session, photos] = await Promise.all([getSessionById(userId, Number(id)), listPhotos(userId, Number(id))]);

  if (!session) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words">
            {[session.location, session.country].filter(Boolean).join(", ") || "(no location)"}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{session.date ? formatDateDisplay(session.date) : "(no date)"}</span>
            <RatingBadge rating={session.rating} />
            {session.fishAbundance != null && (
              <span className="text-xs text-muted">Fish abundance: {session.fishAbundance}/5</span>
            )}
          </div>
          {session.locationDetails && <p className="mt-1.5 text-sm text-muted">{session.locationDetails}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={`/sessions/${session.id}/edit`} className={button("primary")}>
            Edit
          </Link>
          <DeleteSessionButton sessionId={session.id} />
        </div>
      </div>

      <SectionCard title="Conditions you observed">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <DetailField label="Start time" value={session.startTime} />
          <DetailField
            label="Session length"
            value={session.sessionLengthHours != null ? `${session.sessionLengthHours} h` : null}
          />
          <DetailField label="Visibility" value={session.visibility != null ? `${session.visibility} m` : null} />
          <DetailField label="Depth" value={formatDepthRange(session.depthFrom, session.depthTo)} />
          <DetailField label="Number of dives" value={session.numberOfDives} />
        </div>
      </SectionCard>

      <SectionCard title="Tide & weather" tinted>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <DetailField label="High tide time" value={session.highTideTime} />
          <DetailField label="Low tide time" value={session.lowTideTime} />
          <DetailField label="Tide type" value={session.tideType ? TIDE_TYPE_LABELS[session.tideType] : null} />
          <DetailField label="Slack tide time" value={session.slackTideTime} />
          <DetailField label="High/low tide ratio" value={session.tideRatio} />
          <DetailField label="Current" value={session.current ? CURRENT_LEVEL_LABELS[session.current] : null} />
          <DetailField label="Current (knots)" value={session.currentSpeedKt != null ? `${session.currentSpeedKt} kt` : null} />
          <DetailField label="Sea condition" value={session.seaCondition} />
          <DetailField label="Wind condition" value={session.windCondition} />
          <DetailField
            label="Wind direction"
            value={session.windDirection != null ? `${session.windDirection}° (${compassDirection(session.windDirection)})` : null}
          />
          <DetailField label="Pressure" value={session.pressure != null ? `${session.pressure} hPa` : null} />
          <DetailField label="GPS point" value={session.gpsPoint} />
        </div>
      </SectionCard>

      <SectionCard title="Marks">
        {session.marks.length === 0 ? (
          <p className="text-sm text-muted">No marks recorded for this session.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {session.marks.map((m) => (
              <li key={m.id} className="rounded-md border border-surface-border/60 px-3 py-1.5 text-sm">
                {m.name}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Catches">
        {session.catches.length === 0 ? (
          <p className="text-sm text-muted">No fish logged for this session.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs text-muted">
                <th className="py-1 pr-4 font-normal">Species</th>
                <th className="py-1 pr-4 font-normal">Quantity</th>
                <th className="py-1 pr-4 font-normal">Weight (kg)</th>
                <th className="py-1 pr-4 font-normal">Size (cm)</th>
                <th className="py-1 pr-4 font-normal">Mark</th>
              </tr>
            </thead>
            <tbody>
              {session.catches.map((c) => (
                <tr key={c.id} className="border-b border-surface-border/60 last:border-0">
                  <td className="py-1.5 pr-4">{c.species}</td>
                  <td className="py-1.5 pr-4">{c.quantity}</td>
                  <td className="py-1.5 pr-4">{c.weight ?? "—"}</td>
                  <td className="py-1.5 pr-4">{c.size ?? "—"}</td>
                  <td className="py-1.5 pr-4">{c.markName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <SectionCard title="Photos">
        <SessionPhotos sessionId={session.id} initialPhotos={photos} />
      </SectionCard>

      {session.comments && (
        <SectionCard title="Comments">
          <p className="whitespace-pre-wrap text-sm">{session.comments}</p>
        </SectionCard>
      )}
    </div>
  );
}
