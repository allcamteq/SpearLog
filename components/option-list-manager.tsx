"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OptionValueRow } from "@/db/schema";
import type { OptionCategory } from "@/lib/constants";
import { inputClass, button } from "@/lib/ui";

type CheckState =
  | { status: "loading" }
  | { status: "success"; lat: number; lng: number; displayName: string }
  | { status: "error"; message: string };

export function OptionListManager({ category, initialValues }: { category: OptionCategory; initialValues: OptionValueRow[] }) {
  const router = useRouter();
  const [newValue, setNewValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<number, CheckState>>({});

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newValue.trim();
    if (!trimmed) return;

    setPending(true);
    setError(null);
    const res = await fetch("/api/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, value: trimmed }),
    });
    setPending(false);

    if (!res.ok) {
      setError("Could not add that value.");
      return;
    }

    setNewValue("");
    router.refresh();
  }

  async function handleDelete(id: number) {
    await fetch(`/api/options/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleCheck(option: OptionValueRow) {
    setChecks((prev) => ({ ...prev, [option.id]: { status: "loading" } }));

    const res = await fetch(`/api/options/${option.id}/check-location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: option.value }),
    });
    const data = await res.json();

    setChecks((prev) => ({
      ...prev,
      [option.id]: res.ok
        ? { status: "success", lat: data.lat, lng: data.lng, displayName: data.displayName }
        : { status: "error", message: typeof data.error === "string" ? data.error : "Could not check this location." },
    }));

    if (res.ok) router.refresh();
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="mb-3 flex gap-2">
        <input
          className={inputClass}
          placeholder="Add a value…"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
        />
        <button type="submit" disabled={pending} className={button("primary", "whitespace-nowrap")}>
          Add
        </button>
      </form>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {initialValues.length === 0 ? (
        <p className="text-sm text-muted">No values yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {initialValues.map((option) => {
            const check = checks[option.id];
            return (
              <li key={option.id} className="rounded-md border border-surface-border/60 px-3 py-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span>{option.value}</span>
                  <div className="flex items-center gap-3">
                    {category === "location" && (
                      <button
                        type="button"
                        onClick={() => handleCheck(option)}
                        disabled={check?.status === "loading"}
                        className={button("secondary", "text-xs px-2.5 py-1.5")}
                      >
                        {check?.status === "loading" ? "Geotagging…" : "Geotag location"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(option.id)}
                      className="text-xs font-medium text-danger hover:text-danger-hover"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {check?.status === "loading" && <p className="mt-1 text-xs text-muted">Geotagging…</p>}
                {check?.status === "error" && <p className="mt-1 text-xs text-danger">{check.message}</p>}
                {check?.status === "success" && (
                  <p className="mt-1 text-xs text-muted">
                    → {check.lat.toFixed(4)}, {check.lng.toFixed(4)} — {check.displayName}
                  </p>
                )}
                {!check && option.lat != null && option.lng != null && (
                  <p className="mt-1 text-xs text-muted">
                    → {option.lat.toFixed(4)}, {option.lng.toFixed(4)}
                    {option.resolvedAddress ? ` — ${option.resolvedAddress}` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
