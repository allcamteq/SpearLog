"use client";

import { useState } from "react";
import { parseGps, formatGps, type GpsCoordinate, type GpsFormat } from "@/lib/gps";
import { useGpsFormat } from "@/lib/use-gps-format";
import { inputClass } from "@/lib/ui";

const FORMATS: GpsFormat[] = ["DDM", "DD"];

export function GpsCoordinateInput({
  value,
  onChange,
  placeholder,
}: {
  value: GpsCoordinate | null;
  onChange: (value: GpsCoordinate | null) => void;
  placeholder?: string;
}) {
  const [format, setFormat] = useGpsFormat();
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState(() => (value ? formatGps(value.lat, value.lng, format) : ""));

  // Re-derive the displayed text when the canonical value/format changes from
  // outside (format toggle, parent resetting the field) — not from local typing.
  // Adjusting state during render (rather than in an effect) avoids an extra
  // commit and the set-state-in-effect lint rule; see React docs on "Adjusting
  // state when a prop changes".
  const syncKey = `${value?.lat ?? ""}|${value?.lng ?? ""}|${format}`;
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey);
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    setText(value ? formatGps(value.lat, value.lng, format) : "");
  }

  function handleBlur() {
    if (!text.trim()) {
      setError(null);
      onChange(null);
      return;
    }
    const parsed = parseGps(text);
    if (!parsed) {
      setError("Couldn't parse that as a coordinate.");
      return;
    }
    setError(null);
    onChange(parsed);
    setText(formatGps(parsed.lat, parsed.lng, format));
  }

  return (
    <div>
      <div className="flex gap-1.5">
        <input
          className={inputClass}
          placeholder={placeholder ?? (format === "DDM" ? "e.g. 59°54.834'N, 10°45.132'E" : "e.g. 59.9139, 10.7522")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
        />
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-surface-border text-xs">
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={
                f === format
                  ? "bg-accent px-2.5 py-2 font-medium text-accent-foreground"
                  : "bg-surface px-2.5 py-2 text-muted hover:text-foreground"
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
