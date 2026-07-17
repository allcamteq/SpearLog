"use client";

import { Controller, type Control } from "react-hook-form";
import { RATING_OPTIONS } from "@/lib/constants";
import type { SessionFormValues } from "@/lib/validation/session";

export function RatingInput({
  control,
  name = "session.rating",
}: {
  control: Control<SessionFormValues>;
  name?: "session.rating" | "session.fishAbundance";
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const current = Number(field.value) || 0;
        return (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              {RATING_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-label={`${r} star${r === 1 ? "" : "s"}`}
                  onClick={() => field.onChange(r)}
                  className="text-2xl leading-none transition-transform hover:scale-110"
                >
                  <span className={r <= current ? "text-amber-500" : "text-surface-border"}>★</span>
                </button>
              ))}
            </div>
            {current > 0 && (
              <button
                type="button"
                onClick={() => field.onChange(null)}
                className="text-xs text-muted hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        );
      }}
    />
  );
}
