"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sessionFormSchema, type SessionFormValues, type SessionFormOutput } from "@/lib/validation/session";
import {
  TIDE_TYPES,
  TIDE_TYPE_LABELS,
  CURRENT_LEVELS,
  CURRENT_LEVEL_LABELS,
  SEA_CONDITIONS,
  SEA_CONDITION_LABELS,
  WIND_CONDITIONS,
  WIND_CONDITION_LABELS,
} from "@/lib/constants";
import { CatchRowFields } from "@/components/catch-row-fields";
import { RatingInput } from "@/components/rating-input";
import { EditableSelect } from "@/components/editable-select";
import { SessionPhotos } from "@/components/session-photos";
import { MarkSelect, type MarkOption } from "@/components/mark-select";
import { GpsCoordinateInput } from "@/components/gps-coordinate-input";
import { compassDirection } from "@/lib/tide-derivation";
import { parseGps, formatGps } from "@/lib/gps";
import type { SessionPhotoRow } from "@/db/schema";
import { inputClass, labelClass, cardClass, button } from "@/lib/ui";

export type SessionFormOptions = {
  location: string[];
  locationDetails: string[];
  country: string[];
  species: string[];
  marks: MarkOption[];
};

const emptyCatch = { species: "", quantity: 1, weight: null, size: null, markId: null };
const emptySessionMark = { markId: undefined };

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

// react-hook-form/zodResolver blocks submission on any validation failure without
// calling onSubmit — so an invalid field (e.g. an "Add catch"/"Add mark" row left
// empty) otherwise makes Save silently do nothing. Walk the error tree so we can
// tell the user what's actually wrong.
function collectErrorMessages(node: unknown, path = ""): string[] {
  if (!node || typeof node !== "object") return [];
  const obj = node as { message?: unknown };
  if (typeof obj.message === "string") {
    return [formatErrorPath(path) ? `${formatErrorPath(path)}: ${obj.message}` : obj.message];
  }
  const messages: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key === "type" || key === "ref" || key === "root") continue;
    messages.push(...collectErrorMessages(value, path ? `${path}.${key}` : key));
  }
  return messages;
}

function formatErrorPath(path: string): string {
  const catchMatch = /^catches\.(\d+)\.(.+)$/.exec(path);
  if (catchMatch) return `Catch ${Number(catchMatch[1]) + 1} — ${catchMatch[2]}`;
  const markMatch = /^marks\.(\d+)\.(.+)$/.exec(path);
  if (markMatch) return `Mark ${Number(markMatch[1]) + 1} — ${markMatch[2]}`;
  return path.replace(/^session\./, "");
}

function SectionCard({
  title,
  children,
  tinted,
}: {
  title: string;
  children: React.ReactNode;
  /** Marks a section as auto-populated data (from an external API) rather than user-entered — a subtly tinted panel instead of the plain card. */
  tinted?: boolean;
}) {
  return (
    <section className={tinted ? "rounded-xl border border-accent/25 bg-accent-soft/40 p-5" : `${cardClass} p-5`}>
      <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function SessionForm({
  mode,
  sessionId,
  defaultValues,
  options,
  photos,
}: {
  mode: "create" | "edit";
  sessionId?: number;
  defaultValues?: SessionFormValues;
  options: SessionFormOptions;
  photos?: SessionPhotoRow[];
}) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [markOptions, setMarkOptions] = useState<MarkOption[]>(options.marks);

  const [fetchingConditions, setFetchingConditions] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  function handleMarkCreated(mark: MarkOption) {
    setMarkOptions((prev) => [...prev, mark]);
  }

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<SessionFormValues, unknown, SessionFormOutput>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: defaultValues ?? {
      session: {
        date: new Date().toISOString().slice(0, 10),
        location: "",
        locationDetails: "",
        country: "",
        numberOfDives: null,
        rating: null,
      },
      catches: [],
      marks: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "catches" });
  const { fields: markFields, append: appendMark, remove: removeMark } = useFieldArray({ control, name: "marks" });

  const watchedDate = watch("session.date");
  const watchedLocation = watch("session.location");
  const watchedLocationDetails = watch("session.locationDetails");
  const watchedWindDirection = watch("session.windDirection");

  async function handleLocationBlur() {
    const values = getValues();
    const location = values.session.location;
    const country = values.session.country;
    if (typeof location !== "string" || !location || country) return; // only fill in a blank country

    try {
      const res = await fetch(`/api/geocode?${new URLSearchParams({ location })}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.country && !getValues("session.country")) {
        setValue("session.country", data.country);
      }
    } catch {
      // best-effort background auto-fill — fail silently
    }
  }

  async function handleFetchConditions() {
    setFetchError(null);

    const values = getValues();
    if (!values.session.startTime) {
      setFetchError("Start time is required to fetch tide data.");
      return;
    }

    setFetchingConditions(true);
    try {
      const res = await fetch("/api/sessions/fetch-conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: values.session.location,
          country: values.session.country,
          date: values.session.date,
          startTime: values.session.startTime,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFetchError(typeof data.error === "string" ? data.error : "Could not fetch tide/current data.");
        return;
      }

      if (data.gpsPoint) setValue("session.gpsPoint", data.gpsPoint);
      if (data.highTideTime) setValue("session.highTideTime", data.highTideTime);
      if (data.lowTideTime) setValue("session.lowTideTime", data.lowTideTime);
      if (data.slackTideTime) setValue("session.slackTideTime", data.slackTideTime);
      if (data.tideRatio != null) setValue("session.tideRatio", data.tideRatio);
      if (data.tideType) setValue("session.tideType", data.tideType);
      if (data.current) setValue("session.current", data.current);
      if (data.currentSpeedKt != null) setValue("session.currentSpeedKt", data.currentSpeedKt);
      if (data.seaCondition) setValue("session.seaCondition", data.seaCondition);
      if (data.windCondition) setValue("session.windCondition", data.windCondition);
      if (data.windDirection != null) setValue("session.windDirection", data.windDirection);
      if (data.pressure != null) setValue("session.pressure", data.pressure);
      setFetchedAt(new Date());
    } catch {
      setFetchError("Could not fetch tide/current data.");
    } finally {
      setFetchingConditions(false);
    }
  }

  async function onSubmit(data: SessionFormOutput) {
    setSubmitError(null);
    const url = mode === "create" ? "/api/sessions" : `/api/sessions/${sessionId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      setSubmitError("Could not save this session. Check the fields and try again.");
      return;
    }

    const result = mode === "create" ? await res.json() : { id: sessionId };
    router.push(`/sessions/${result.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 pb-24">
      <SectionCard title="Session">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Date">
            <input type="date" className={inputClass} {...register("session.date")} />
          </Field>
          <Field label="Location">
            <Controller
              control={control}
              name="session.location"
              render={({ field }) => (
                <EditableSelect
                  value={field.value as string | null}
                  onChange={field.onChange}
                  onBlur={handleLocationBlur}
                  options={options.location}
                  placeholder="e.g. Blue Hole"
                />
              )}
            />
          </Field>
          <Field label="Location description">
            <Controller
              control={control}
              name="session.locationDetails"
              render={({ field }) => (
                <EditableSelect
                  value={field.value as string | null}
                  onChange={field.onChange}
                  options={options.locationDetails}
                  placeholder="e.g. entry point, landmarks, site description"
                />
              )}
            />
          </Field>
          <Field label="Number of dives">
            <input type="number" min={0} step={1} className={inputClass} {...register("session.numberOfDives")} />
          </Field>
          <Field label="Start time">
            <input type="time" className={inputClass} {...register("session.startTime")} />
          </Field>
          <Field label="Session length (hours)">
            <input
              type="number"
              min={0}
              step="any"
              className={inputClass}
              {...register("session.sessionLengthHours")}
            />
          </Field>
          <div>
            <label className={labelClass}>Rating</label>
            <RatingInput control={control} name="session.rating" />
          </div>
          <div>
            <label className={labelClass}>Fish abundance</label>
            <RatingInput control={control} name="session.fishAbundance" />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Conditions you observed">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field label="Visibility (m)">
            <input type="number" min={0} step="any" className={inputClass} {...register("session.visibility")} />
          </Field>
          <Field label="Depth (m)">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step="any"
                placeholder="From"
                className={inputClass}
                {...register("session.depthFrom")}
              />
              <span className="text-muted">–</span>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="To"
                className={inputClass}
                {...register("session.depthTo")}
              />
            </div>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Tide & weather" tinted>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted">
            <p>
              Automatically retrieved from <span className="font-medium text-foreground">Stormglass</span> for this
              date and location (needs Date + Location filled in) — override anything below if it looks wrong.
            </p>
            {fetchedAt && (
              <p className="mt-0.5">
                Last fetched at {fetchedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleFetchConditions}
            disabled={!watchedDate || !watchedLocation || fetchingConditions}
            className={button("secondary", "whitespace-nowrap text-xs")}
          >
            {fetchingConditions ? "Fetching…" : fetchedAt ? "Refresh" : "Fetch tide & current data"}
          </button>
        </div>
        {fetchError && <p className="mb-4 text-sm text-danger">{fetchError}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field label="High tide time">
            <input type="time" className={inputClass} {...register("session.highTideTime")} />
          </Field>
          <Field label="Low tide time">
            <input type="time" className={inputClass} {...register("session.lowTideTime")} />
          </Field>
          <Field label="Tide type">
            <select className={inputClass} {...register("session.tideType")}>
              <option value="">—</option>
              {TIDE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TIDE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Slack tide time">
            <input type="time" className={inputClass} {...register("session.slackTideTime")} />
          </Field>
          <Field label="High/low tide ratio">
            <input type="number" step="any" className={inputClass} {...register("session.tideRatio")} />
          </Field>
          <Field label="Current">
            <select className={inputClass} {...register("session.current")}>
              <option value="">—</option>
              {CURRENT_LEVELS.map((c) => (
                <option key={c} value={c}>
                  {CURRENT_LEVEL_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Current (knots)">
            <input type="number" step="any" className={inputClass} {...register("session.currentSpeedKt")} />
          </Field>
          <Field label="Sea condition">
            <select className={inputClass} {...register("session.seaCondition")}>
              <option value="">—</option>
              {SEA_CONDITIONS.map((s) => (
                <option key={s} value={s}>
                  {SEA_CONDITION_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Wind condition">
            <select className={inputClass} {...register("session.windCondition")}>
              <option value="">—</option>
              {WIND_CONDITIONS.map((w) => (
                <option key={w} value={w}>
                  {WIND_CONDITION_LABELS[w]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Wind direction (°)">
            <input type="number" min={0} max={360} step="any" className={inputClass} {...register("session.windDirection")} />
            {typeof watchedWindDirection === "number" && !Number.isNaN(watchedWindDirection) && (
              <p className="mt-1 text-xs text-muted">{compassDirection(watchedWindDirection)}</p>
            )}
          </Field>
          <Field label="Pressure (hPa)">
            <input type="number" step="any" className={inputClass} {...register("session.pressure")} />
          </Field>
          <Field label="GPS point" className="sm:col-span-2">
            <Controller
              control={control}
              name="session.gpsPoint"
              render={({ field }) => (
                <GpsCoordinateInput
                  value={parseGps(field.value as string | null | undefined)}
                  onChange={(coord) => field.onChange(coord ? formatGps(coord.lat, coord.lng, "DD") : "")}
                />
              )}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Marks">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">Which marks did you fish during this session?</p>
          <button type="button" onClick={() => appendMark(emptySessionMark)} className={button("primary", "text-xs")}>
            Add mark
          </button>
        </div>
        {markFields.length === 0 && <p className="text-sm text-muted">No marks recorded for this session yet.</p>}
        <div className="flex flex-col gap-2">
          {markFields.map((field, index) => (
            <div key={field.id} className="flex items-end gap-2">
              <div className="flex-1">
                <Controller
                  control={control}
                  name={`marks.${index}.markId`}
                  render={({ field: markField }) => (
                    <MarkSelect
                      value={markField.value as number | null}
                      onChange={markField.onChange}
                      marks={markOptions}
                      onMarkCreated={handleMarkCreated}
                      placeholder="Select a mark…"
                      defaultLocation={watchedLocation as string | null | undefined}
                      defaultLocationDetails={watchedLocationDetails as string | null | undefined}
                    />
                  )}
                />
              </div>
              <button type="button" onClick={() => removeMark(index)} className={button("ghost", "h-fit")}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Catches">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">Log each species you brought up separately.</p>
          <button type="button" onClick={() => append(emptyCatch)} className={button("primary", "text-xs")}>
            Add catch
          </button>
        </div>
        {fields.length === 0 && <p className="text-sm text-muted">No fish logged for this session yet.</p>}
        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <CatchRowFields
              key={field.id}
              index={index}
              control={control}
              register={register}
              speciesOptions={options.species}
              marks={markOptions}
              onMarkCreated={handleMarkCreated}
              defaultMarkLocation={watchedLocation as string | null | undefined}
              defaultMarkLocationDetails={watchedLocationDetails as string | null | undefined}
              onRemove={() => remove(index)}
            />
          ))}
        </div>
      </SectionCard>

      {mode === "edit" && sessionId && (
        <SectionCard title="Photos">
          <SessionPhotos sessionId={sessionId} initialPhotos={photos ?? []} />
        </SectionCard>
      )}

      <SectionCard title="Comments">
        <textarea rows={4} className={inputClass} {...register("session.comments")} />
      </SectionCard>

      {submitError && <p className="text-sm text-danger">{submitError}</p>}

      {Object.keys(errors).length > 0 && (
        <div className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <p className="font-medium">Fix the following before saving:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {collectErrorMessages(errors).map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-surface-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-2 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => router.push(mode === "edit" && sessionId ? `/sessions/${sessionId}` : "/")}
            className={button("ghost")}
          >
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className={button("primary", "px-5 py-2.5")}>
            {isSubmitting ? "Saving…" : mode === "create" ? "Save session" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
