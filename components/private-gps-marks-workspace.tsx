"use client";

import { useState } from "react";
import type { MarkRow } from "@/db/schema";
import { MarksMapSection } from "@/components/marks-map-section";
import { MarkExportButton } from "@/components/mark-export-button";
import { MarkExportCsvButton } from "@/components/mark-export-csv-button";
import { MarkImportButton } from "@/components/mark-import-button";
import { PopulateMarkLocationsButton } from "@/components/populate-mark-locations-button";
import { MarksTable } from "@/components/marks-table";
import { button, inputClass } from "@/lib/ui";
import { decryptMarkCoordinates, importPrivateGpsKey } from "@/lib/private-gps-crypto";

export function PrivateGpsMarksWorkspace({
  marks,
  allMarks,
  locationOptions,
  locationDetailsOptions,
  privateGpsEnabled,
  focusMarkName,
}: {
  marks: MarkRow[];
  allMarks: MarkRow[];
  locationOptions: string[];
  locationDetailsOptions: string[];
  privateGpsEnabled: boolean;
  focusMarkName?: string;
}) {
  const [keyInput, setKeyInput] = useState("");
  const [gpsKey, setGpsKey] = useState<CryptoKey | null>(null);
  const [unlockedMarks, setUnlockedMarks] = useState<MarkRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function unlock() {
    setPending(true);
    setError(null);
    try {
      const key = await importPrivateGpsKey(keyInput);
      const decrypted = await Promise.all(
        allMarks.map(async (mark) => {
          if (!mark.gpsEncrypted) return mark;
          const coordinates = await decryptMarkCoordinates(key, mark.gpsEncrypted);
          return { ...mark, ...coordinates };
        })
      );
      setGpsKey(key);
      setUnlockedMarks(decrypted);
      setKeyInput("");
    } catch {
      setError("Could not unlock mark coordinates. Check the key and try again.");
    } finally {
      setPending(false);
    }
  }

  if (privateGpsEnabled && (!gpsKey || !unlockedMarks)) {
    return (
      <section className="rounded-lg border border-surface-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Private mark coordinates are locked</h2>
        <p className="mt-1 text-sm text-muted">
          Enter your Private GPS key to view, edit, import, or export precise mark coordinates. The key stays in this
          page&apos;s memory and is cleared when you leave.
        </p>
        <div className="mt-3 flex max-w-lg flex-col gap-2 sm:flex-row">
          <input
            aria-label="Private GPS key"
            type="password"
            autoComplete="off"
            className={inputClass}
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void unlock();
            }}
            placeholder="Paste your 43-character key"
          />
          <button type="button" onClick={unlock} disabled={pending || !keyInput} className={button("primary", "shrink-0")}>
            {pending ? "Unlocking…" : "Unlock marks"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </section>
    );
  }

  const displayMarks = privateGpsEnabled
    ? marks.map((mark) => unlockedMarks!.find((candidate) => candidate.id === mark.id) ?? mark)
    : marks;
  const displayAllMarks = privateGpsEnabled ? unlockedMarks! : allMarks;
  const mappable = displayMarks
    .filter((mark): mark is typeof mark & { lat: number; lng: number } => mark.lat != null && mark.lng != null)
    .map((mark) => ({ id: mark.id, name: mark.name, location: mark.location, lat: mark.lat, lng: mark.lng }));
  const focusMarkId = focusMarkName ? (mappable.find((mark) => mark.name === focusMarkName)?.id ?? null) : null;

  return (
    <>
      {privateGpsEnabled && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setGpsKey(null);
              setUnlockedMarks(null);
              setKeyInput("");
            }}
            className={button("secondary", "text-xs")}
          >
            Lock mark coordinates
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <MarkImportButton
          privateGpsEnabled={privateGpsEnabled}
          gpsKey={gpsKey ?? undefined}
          existingMarks={displayAllMarks}
        />
        <MarkExportButton marks={privateGpsEnabled ? displayAllMarks : undefined} />
        <MarkExportCsvButton marks={privateGpsEnabled ? displayAllMarks : undefined} />
      </div>
      <MarksMapSection marks={mappable} focusMarkId={focusMarkId} />
      {privateGpsEnabled ? (
        <p className="text-xs text-muted">Automatic geotagging is unavailable while Private GPS is enabled. Enter mark coordinates here to encrypt them.</p>
      ) : (
        <PopulateMarkLocationsButton />
      )}
      <MarksTable
        marks={displayMarks}
        locationOptions={locationOptions}
        locationDetailsOptions={locationDetailsOptions}
        privateGpsEnabled={privateGpsEnabled}
        gpsKey={gpsKey ?? undefined}
      />
    </>
  );
}