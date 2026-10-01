"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { button, cardClass, inputClass, labelClass } from "@/lib/ui";
import { NOT_SCORED, compass, type Confidence } from "@/lib/trip-score";
import type { TripPlan } from "@/lib/trip-conditions";

const COMPASS_POINTS = [
  ["N", 0], ["NNE", 22.5], ["NE", 45], ["ENE", 67.5],
  ["E", 90], ["ESE", 112.5], ["SE", 135], ["SSE", 157.5],
  ["S", 180], ["SSW", 202.5], ["SW", 225], ["WSW", 247.5],
  ["W", 270], ["WNW", 292.5], ["NW", 315], ["NNW", 337.5],
] as const;

const VERDICT_STYLE: Record<TripPlan["verdict"], { className: string; icon: string }> = {
  Go: { className: "bg-success-soft text-success-foreground", icon: "●" },
  "Worth it": { className: "bg-success-soft text-success-foreground", icon: "◐" },
  Marginal: { className: "bg-warning-soft text-warning-foreground", icon: "▲" },
  "Stay home": { className: "bg-danger-soft text-danger", icon: "■" },
};

function ConfidenceBadge({ level, children }: { level: Confidence; children?: React.ReactNode }) {
  const style =
    level === "High"
      ? "bg-success-soft text-success-foreground"
      : level === "Medium"
        ? "bg-warning-soft text-warning-foreground"
        : "bg-surface-border/50 text-muted";
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${style}`}>
      {level}
      {children}
    </span>
  );
}

function todayISO(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function aspectKey(location: string) {
  return `spearlog:shore-aspect:${location.toLowerCase()}`;
}

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * The shore aspect belongs to the site rather than the trip, so it's remembered
 * per location. Read through useSyncExternalStore so the server renders the
 * empty field and the client swaps in the saved value without a hydration
 * mismatch — localStorage can also be absent or throw in a private window.
 */
function useSavedAspect(location: string): string {
  return useSyncExternalStore(
    subscribeToStorage,
    () => {
      if (!location) return "";
      try {
        return window.localStorage.getItem(aspectKey(location)) ?? "";
      } catch {
        return "";
      }
    },
    () => ""
  );
}

export function TripPlanner({
  locationOptions,
  countryOptions,
}: {
  locationOptions: string[];
  countryOptions: string[];
}) {
  // A new account has no saved locations yet, so start it on free text rather
  // than on an empty select it can't submit.
  const [location, setLocation] = useState(locationOptions[0] ?? "__other");
  const [customLocation, setCustomLocation] = useState("");
  const [country, setCountry] = useState("");
  const [date, setDate] = useState(todayISO());
  const [aspectEdits, setAspectEdits] = useState<Record<string, string>>({});
  const [depth, setDepth] = useState("10");
  const [estuary, setEstuary] = useState(false);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<TripPlan | null>(null);

  const effectiveLocation = (location === "__other" ? customLocation : location).trim();

  // A storage event doesn't fire in the tab that wrote it, so this turn's edit
  // takes precedence over what the store reports.
  const savedAspect = useSavedAspect(effectiveLocation);
  const shoreFacing = aspectEdits[effectiveLocation] ?? savedAspect;

  function rememberAspect(value: string) {
    setAspectEdits((prev) => ({ ...prev, [effectiveLocation]: value }));
    if (!effectiveLocation) return;
    try {
      if (value) window.localStorage.setItem(aspectKey(effectiveLocation), value);
      else window.localStorage.removeItem(aspectKey(effectiveLocation));
    } catch {
      // Not worth surfacing — the evaluation still uses the value in state.
    }
  }

  async function evaluate(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveLocation) {
      setError("Pick or type a location first.");
      return;
    }

    setPending(true);
    setError(null);
    setPlan(null);

    try {
      const res = await fetch("/api/trip-planning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: effectiveLocation,
          country: country || null,
          date,
          workingDepthM: Number(depth) || 10,
          shoreFacingDeg: shoreFacing === "" ? null : Number(shoreFacing),
          estuaryInfluence: estuary,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not evaluate conditions for that trip.");
        return;
      }
      setPlan(data as TripPlan);
    } catch {
      setError("Could not reach the conditions service.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trip planning</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Pick a place and a date and get a rating out of 10, a dive window, and the reasoning behind both. The model
          reads swell period before swell height, and the stream before the tide table — on this kind of coast
          visibility and a safe surface are the real constraints, and almost everything else is a proxy for one of them.
        </p>
      </div>

      <form onSubmit={evaluate} className={`${cardClass} p-4`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className={location === "__other" ? "" : "lg:col-span-2"}>
            <label className={labelClass} htmlFor="trip-location">
              Location
            </label>
            <select
              id="trip-location"
              className={inputClass}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              {locationOptions.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
              <option value="__other">Somewhere else…</option>
            </select>
          </div>

          {location === "__other" && (
            <div>
              <label className={labelClass} htmlFor="trip-custom-location">
                Place name
              </label>
              <input
                id="trip-custom-location"
                className={inputClass}
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="e.g. Kimmeridge Bay"
              />
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor="trip-date">
              Date
            </label>
            <input
              id="trip-date"
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="trip-aspect">
              Shore faces <span className="font-normal normal-case text-muted">(optional)</span>
            </label>
            <select
              id="trip-aspect"
              className={inputClass}
              value={shoreFacing}
              onChange={(e) => rememberAspect(e.target.value)}
            >
              <option value="">Not set — scores wind on strength only</option>
              {COMPASS_POINTS.map(([label, deg]) => (
                <option key={label} value={deg}>
                  {label} ({deg}°)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelClass} htmlFor="trip-depth">
              Working depth (m)
            </label>
            <input
              id="trip-depth"
              type="number"
              min={3}
              max={30}
              className={inputClass}
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="trip-country">
              Country <span className="font-normal normal-case text-muted">(helps the geocoder)</span>
            </label>
            <input
              id="trip-country"
              list="trip-country-options"
              className={inputClass}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Optional"
            />
            <datalist id="trip-country-options">
              {countryOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <label className="flex items-end gap-2 pb-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={estuary} onChange={(e) => setEstuary(e.target.checked)} className="size-4" />
            <span>
              Downstream of a river or harbour
              <span className="block text-xs text-muted">Makes recent rainfall count towards the rating.</span>
            </span>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={button("primary")}>
            {pending ? "Reading the conditions…" : "Evaluate conditions"}
          </button>
          <p className="text-xs text-muted">Each evaluation uses two forecast lookups from your daily allowance.</p>
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </form>

      {plan && <TripResult plan={plan} />}
    </div>
  );
}

function TripResult({ plan }: { plan: TripPlan }) {
  const verdict = VERDICT_STYLE[plan.verdict];
  const dateLabel = new Date(`${plan.date}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-col gap-6">
      {/* The rating itself: one number, so a hero figure rather than a chart. */}
      <div className={`${cardClass} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-baseline gap-3">
            <span className="text-6xl font-semibold leading-none tracking-tight text-accent tabular-nums">
              {plan.score.toFixed(1)}
            </span>
            <span className="text-2xl text-muted">/ 10</span>
          </div>

          <div className="flex flex-col items-start gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${verdict.className}`}>
              <span aria-hidden>{verdict.icon}</span>
              {plan.verdict}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              Confidence <ConfidenceBadge level={plan.confidence} />
            </span>
          </div>
        </div>

        <p className="mt-4 text-sm">
          <span className="font-medium">{plan.location}</span>
          <span className="text-muted"> · {dateLabel}</span>
          {plan.window && (
            <>
              <span className="text-muted"> · best window </span>
              <span className="font-medium">
                {plan.window.startLocal}–{plan.window.endLocal}
              </span>
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-muted">{plan.confidenceReason}</p>
        {plan.resolvedAddress && <p className="mt-1 text-xs text-muted">Matched to {plan.resolvedAddress}.</p>}

        {plan.caps.length > 0 && (
          <div className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">
            <p className="font-semibold">
              <span aria-hidden>■ </span>
              Rating capped, not averaged
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {plan.caps.map((cap, i) => (
                <li key={i}>{cap}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <HourChart plan={plan} />

      <FactorBreakdown plan={plan} />

      <TideCard plan={plan} />

      <section className={`${cardClass} p-4`}>
        <h2 className="text-base font-semibold">What to do about it</h2>
        <div className="mt-3 flex flex-col divide-y divide-surface-border">
          {plan.recommendations.map((rec, i) => (
            <div key={i} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">{rec.title}</h3>
                <ConfidenceBadge level={rec.confidence} />
              </div>
              <p className="mt-1 text-sm text-muted">{rec.body}</p>
            </div>
          ))}
        </div>
      </section>

      <LogCard plan={plan} />

      <section className={`${cardClass} p-4`}>
        <h2 className="text-base font-semibold">Deliberately not scored</h2>
        <p className="mt-1 text-sm text-muted">
          These are commonly believed and weakly evidenced, so they are left out rather than given a small weight.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {NOT_SCORED.map((item) => (
            <div key={item.title} className="rounded-lg bg-surface-border/25 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <ConfidenceBadge level="Low" />
              </div>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-muted">
        Calibrated for temperate-Atlantic shore diving on reef at 6–14 m, with the seasonal model flipped south of the
        equator. Thresholds are starting points, not physics — twenty entries in your own logbook for your own sites
        will beat them. Every dive assumes one-up-one-down with a buddy who is actually watching, a float and flag, and
        honest surface intervals.
      </p>
    </div>
  );
}

/**
 * Hour-by-hour conditions for the day. The story is "this window is the one",
 * so the chart uses emphasis — the recommended hours in the accent, the rest in
 * a light tint of the same hue — rather than a colour per hour.
 */
function HourChart({ plan }: { plan: TripPlan }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const windowHours = useMemo(() => {
    if (!plan.window) return new Set<string>();
    const inWindow = new Set<string>();
    for (const hour of plan.hours) {
      if (hour.timeLocal >= plan.window.startLocal && hour.timeLocal < plan.window.endLocal) inWindow.add(hour.timeLocal);
    }
    return inWindow;
  }, [plan]);

  if (plan.hours.length === 0) return null;

  const best = plan.hours.reduce((a, b) => (b.score > a.score ? b : a));
  const active = hovered != null ? plan.hours[hovered] : null;

  return (
    <section className={`${cardClass} p-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Through the day</h2>
        <p className="text-xs text-muted">Conditions score per hour, local time</p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[520px]">
          {/* Plot area: 6.5 is where the verdict turns from "marginal" to "worth it". */}
          <div className="relative flex h-40 items-end gap-[2px]" onMouseLeave={() => setHovered(null)}>
            {/* Sits above the columns so the threshold stays readable against the light tint. */}
            <div
              className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-muted/60"
              style={{ bottom: "65%" }}
              aria-hidden
            />
            {plan.hours.map((hour, i) => {
              const inWindow = windowHours.has(hour.timeLocal);
              return (
                <div
                  key={hour.timeLocal}
                  className="group relative flex h-full flex-1 cursor-default items-end"
                  onMouseEnter={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  tabIndex={0}
                  aria-label={`${hour.timeLocal}, score ${hour.score} out of 10`}
                >
                  <div
                    className={`w-full rounded-t ${inWindow ? "bg-accent" : "bg-accent/20"}`}
                    style={{ height: `${Math.max(hour.score * 10, 2)}%` }}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-1.5 flex gap-[2px] border-t border-surface-border pt-1.5">
            {plan.hours.map((hour) => (
              <div key={hour.timeLocal} className="flex-1 text-center text-[0.6rem] text-muted tabular-nums">
                {hour.timeLocal.endsWith(":00") && Number(hour.timeLocal.slice(0, 2)) % 3 === 0
                  ? hour.timeLocal.slice(0, 2)
                  : ""}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-accent" aria-hidden />
          Recommended window
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-accent/20" aria-hidden />
          Rest of the day
        </span>
        <span className="text-muted">Dashed line: 6.5, where a day becomes worth the drive</span>
      </div>

      <p className="mt-3 text-sm" aria-live="polite">
        {active ? (
          <>
            <span className="font-medium tabular-nums">{active.timeLocal}</span>
            <span className="text-muted">
              {" "}
              — {active.score.toFixed(1)}/10
              {active.surgeM != null && ` · ${Math.round(active.surgeM * 100)} cm bottom surge`}
              {active.windKt != null && ` · ${active.windKt.toFixed(0)} kt wind`}
              {active.currentKt != null && ` · ${active.currentKt.toFixed(2)} kt stream`}
            </span>
          </>
        ) : (
          <span className="text-muted">
            Best hour is <span className="font-medium text-foreground tabular-nums">{best.timeLocal}</span> at{" "}
            {best.score.toFixed(1)}/10. Hover or tab a column for that hour&rsquo;s numbers.
          </span>
        )}
      </p>
    </section>
  );
}

/** One measure across factors, so horizontal bars in a single hue — length carries the score, the printed number carries the detail. */
function FactorBreakdown({ plan }: { plan: TripPlan }) {
  const scored = plan.factors.filter((f) => f.score != null);
  const unscored = plan.factors.filter((f) => f.score == null);

  return (
    <section className={`${cardClass} p-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">What drove the rating</h2>
        <p className="text-xs text-muted">Confidence is in the mechanism, not the forecast</p>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {scored.map((factor) => (
          <div key={factor.key}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium">{factor.label}</h3>
                <ConfidenceBadge level={factor.confidence} />
              </div>
              <p className="text-xs text-muted tabular-nums">
                <span className="text-sm font-semibold text-foreground">{factor.score!.toFixed(1)}</span>
                /10 · {Math.round(factor.weight * 100)}% of the rating
              </p>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-border/40">
              <div className="h-full rounded-full bg-accent" style={{ width: `${factor.score! * 10}%` }} />
            </div>
            {factor.detail && <p className="mt-1.5 text-sm text-muted">{factor.detail}</p>}
          </div>
        ))}
      </div>

      {unscored.length > 0 && (
        <div className="mt-5 border-t border-surface-border pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Not counted in the rating</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {unscored.map((factor) => (
              <li key={factor.key} className="text-sm text-muted">
                <span className="font-medium text-foreground">{factor.label}</span> — {factor.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TideCard({ plan }: { plan: TripPlan }) {
  if (plan.tideExtremes.length === 0 && plan.slack.length === 0) return null;

  return (
    <section className={`${cardClass} p-4`}>
      <h2 className="text-base font-semibold">Tide &amp; estimated slack</h2>
      <p className="mt-1 text-sm text-muted">
        Slack times here are the midpoint between extremes. The real turn of the stream can lag shore high water by one
        to three hours, so take the window from a tidal stream atlas or the tidal diamonds on the chart before you
        commit to it.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Extremes</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm tabular-nums">
            {plan.tideExtremes.map((e) => (
              <li key={`${e.type}-${e.timeLocal}`}>
                <span className="font-medium">{e.timeLocal}</span>
                <span className="text-muted">
                  {" "}
                  {e.type === "high" ? "High water" : "Low water"} · {e.height.toFixed(2)} m
                </span>
              </li>
            ))}
            {plan.tideExtremes.length === 0 && <li className="text-muted">No tide station near this point.</li>}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Estimated slack windows</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm tabular-nums">
            {plan.slack.map((s) => (
              <li key={s.slackLocal}>
                <span className="font-medium">
                  {s.startLocal}–{s.endLocal}
                </span>
                <span className="text-muted"> around {s.slackLocal} · {s.between}</span>
              </li>
            ))}
            {plan.slack.length === 0 && <li className="text-muted">Not derivable here.</li>}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-surface-border pt-3 text-sm text-muted">
        {plan.tideRangeM != null && (
          <span>
            Range <span className="font-medium text-foreground tabular-nums">{plan.tideRangeM.toFixed(2)} m</span>
          </span>
        )}
        {plan.springNeapRatio != null && (
          <span>
            {plan.springNeapRatio >= 0.85 ? "Springs" : plan.springNeapRatio <= 0.55 ? "Neaps" : "Mid-range tide"} (
            {Math.round(plan.springNeapRatio * 100)}% of the fortnight&rsquo;s biggest)
          </span>
        )}
        {plan.waterTempC != null && (
          <span>
            Water <span className="font-medium text-foreground tabular-nums">{plan.waterTempC.toFixed(1)} °C</span>
          </span>
        )}
      </div>
    </section>
  );
}

/** Reads the day being planned back in logbook terms, so the comparison the rating made is inspectable rather than implied. */
function describeSnapshot(snapshot: NonNullable<TripPlan["log"]["snapshot"]>): string {
  const parts: string[] = [];
  if (snapshot.windCondition && snapshot.windDirectionDeg != null) {
    parts.push(`${snapshot.windCondition.toLowerCase()} ${compass(snapshot.windDirectionDeg)} wind`);
  } else if (snapshot.windCondition) {
    parts.push(`${snapshot.windCondition.toLowerCase()} wind`);
  }
  if (snapshot.seaCondition) parts.push(`${snapshot.seaCondition.toLowerCase()} seas`);
  if (snapshot.current) parts.push(`${snapshot.current.toLowerCase()} current`);
  if (snapshot.tideType) parts.push(`${snapshot.tideType.toLowerCase()} tide`);
  if (snapshot.tideRatio != null) parts.push(`${snapshot.tideRatio.toFixed(1)} m range`);
  return parts.join(", ");
}

/** One previously dived day that resembles this one, with how it actually went. */
function MatchRow({ match }: { match: TripPlan["log"]["matches"][number] }) {
  const good = match.outcome > 0.1;
  const bad = match.outcome < -0.1;
  const tone = good ? "text-success-foreground" : bad ? "text-danger" : "text-muted";
  const edge = good ? "border-l-success-foreground" : bad ? "border-l-danger" : "border-l-surface-border";

  return (
    <li className={`border-l-2 ${edge} bg-background py-2 pl-3 pr-2`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-foreground">{match.date ?? "Undated session"}</span>
        <span className="text-xs text-muted">{Math.round(match.similarity * 100)}% match</span>
      </div>
      <p className={`mt-0.5 text-xs ${tone}`}>
        {match.rating != null && <>Rated {match.rating}/5</>}
        {match.rating != null && match.catchCount > 0 && " · "}
        {match.catchCount > 0 && (
          <>
            {match.catchCount} fish landed
          </>
        )}
        {match.rating != null && match.catchCount === 0 && " · nothing landed"}
        {match.visibility != null && ` · ${match.visibility} m viz`}
      </p>
      {match.sharedConditions.length > 0 && (
        <p className="mt-0.5 text-xs text-muted">Matched on {match.sharedConditions.join(", ")}.</p>
      )}
    </li>
  );
}

/**
 * The guide rates a personal log above every general rule, so this is where the
 * rating stops being generic. Conditions mean different things at different
 * marks, and the only record of what they mean *here* is this logbook — so when
 * comparable days exist, the adjustment they made to the rating leads the card.
 */
function LogCard({ plan }: { plan: TripPlan }) {
  const { log } = plan;
  const adjusted = plan.logAdjustment;

  return (
    <section className={`${cardClass} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">What your own log says</h2>
        <ConfidenceBadge level={log.strength >= 0.5 ? "High" : log.matches.length > 0 ? "Medium" : "High"} />
      </div>

      {adjusted && (
        <div
          className={`mt-3 rounded-lg p-3 ${
            adjusted.points > 0 ? "bg-success-soft text-success-foreground" : "bg-danger-soft text-danger"
          }`}
        >
          <p className="text-sm font-semibold">
            {adjusted.points > 0 ? "+" : "−"}
            {Math.abs(adjusted.points).toFixed(1)} from your log at this location
          </p>
          <p className="mt-1 text-xs">
            {log.summary} The forecast alone rated this {adjusted.forecastOnly.toFixed(1)}/10; your own record here
            moved it to {plan.score.toFixed(1)}/10.
          </p>
        </div>
      )}

      {log.snapshot && (
        <p className="mt-3 text-xs text-muted">
          Comparing against <span className="text-foreground">{describeSnapshot(log.snapshot)}</span> during the
          recommended window.
        </p>
      )}

      {log.matches.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {log.matches.slice(0, 5).map((match) => (
            <MatchRow key={match.id} match={match} />
          ))}
        </ul>
      )}

      {log.matches.length === 0 && log.comparedCount > 0 && (
        <p className="mt-2 text-sm text-muted">
          {log.summary} Conditions and how they play out are specific to a mark, so only days dived here in a
          comparable sea, wind and tide can move the rating.
        </p>
      )}

      {log.sessionCount === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No sessions logged at {plan.location} yet. Twenty entries for your own sites will outperform every general
          rule on this page — record tide state and range, stream timing, swell height and period, wind, and visibility
          at depth.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">
            {log.sessionCount} session{log.sessionCount === 1 ? "" : "s"} logged at {plan.location}
            {log.averageRating != null && (
              <>
                , averaging <span className="font-medium text-foreground">{log.averageRating.toFixed(1)}/5</span> across{" "}
                {log.ratedCount} rated
              </>
            )}
            {log.averageVisibilityM != null && (
              <>
                , with visibility averaging{" "}
                <span className="font-medium text-foreground">{log.averageVisibilityM.toFixed(1)} m</span>
              </>
            )}
            .
          </p>
          {log.best && (
            <p className="mt-2 text-sm text-muted">
              Your best-rated day there was {log.best.date ?? "an undated session"} at {log.best.rating}/5
              {log.best.tideType && ` on a ${log.best.tideType.toLowerCase()} tide`}
              {log.best.current && ` with ${log.best.current.toLowerCase()} current`}
              {log.best.visibility != null && ` and ${log.best.visibility} m visibility`}. Compare that against the
              numbers above before you trust the rating.
            </p>
          )}
        </>
      )}
    </section>
  );
}
