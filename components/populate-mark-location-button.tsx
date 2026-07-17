"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { button } from "@/lib/ui";

export function PopulateMarkLocationButton({
  markId,
  hasGps,
  hasLocation,
}: {
  markId: number;
  hasGps: boolean;
  hasLocation: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = pending || (hasGps && hasLocation) || (!hasGps && !hasLocation);

  async function handleClick() {
    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/marks/${markId}/populate-location`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not populate.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not populate.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={
          hasGps && hasLocation
            ? "Already has a location and GPS"
            : !hasGps && !hasLocation
              ? "Add a location or GPS first"
              : hasGps
                ? "Look up location from GPS"
                : "Look up GPS from location"
        }
        className={button("secondary", "text-xs px-2.5 py-1.5")}
      >
        {pending ? "Geotagging…" : "Geotag location"}
      </button>
      {error && (
        <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-surface-border bg-surface p-2 text-xs shadow-md">
          <p className="text-danger">{error}</p>
          <button type="button" onClick={() => setError(null)} className="mt-1 text-muted hover:text-foreground">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
