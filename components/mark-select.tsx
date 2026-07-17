"use client";

import { useState } from "react";
import { inputClass, button } from "@/lib/ui";
import { GpsCoordinateInput } from "@/components/gps-coordinate-input";
import type { GpsCoordinate } from "@/lib/gps";

const ADD_NEW = "__add_new_mark__";

export type MarkOption = { id: number; name: string; location: string | null };

export function MarkSelect({
  value,
  onChange,
  marks,
  onMarkCreated,
  placeholder = "— No mark —",
  defaultLocation,
  defaultLocationDetails,
}: {
  value: number | null | undefined;
  onChange: (id: number | null) => void;
  marks: MarkOption[];
  onMarkCreated: (mark: MarkOption) => void;
  placeholder?: string;
  /** Pre-filled onto a newly created mark — typically the session's own location/location details, so a mark added inline groups with it right away. */
  defaultLocation?: string | null;
  defaultLocationDetails?: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [coord, setCoord] = useState<GpsCoordinate | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cancelAdd() {
    setAdding(false);
    setName("");
    setCoord(null);
    setError(null);
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setPending(true);
    setError(null);
    const res = await fetch("/api/marks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmed,
        lat: coord?.lat ?? null,
        lng: coord?.lng ?? null,
        location: defaultLocation || null,
        locationDetails: defaultLocationDetails || null,
      }),
    });
    const data = await res.json();
    setPending(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not add that mark.");
      return;
    }

    const created: MarkOption = { id: data.id, name: data.name, location: data.location ?? null };
    onMarkCreated(created);
    onChange(created.id);
    cancelAdd();
  }

  if (adding) {
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-surface-border/60 p-2">
        <input
          autoFocus
          className={inputClass}
          placeholder="Mark name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <GpsCoordinateInput value={coord} onChange={setCoord} />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCreate}
            disabled={pending || !name.trim()}
            className={button("primary", "text-xs")}
          >
            {pending ? "Adding…" : "Add"}
          </button>
          <button type="button" onClick={cancelAdd} className="text-xs text-muted hover:text-foreground">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <select
      className={inputClass}
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) {
          setAdding(true);
        } else {
          onChange(e.target.value ? Number(e.target.value) : null);
        }
      }}
    >
      <option value="">{placeholder}</option>
      {marks.map((m) => (
        <option key={m.id} value={m.id}>
          {m.location ? `${m.name} (${m.location})` : m.name}
        </option>
      ))}
      <option value={ADD_NEW}>+ Add new mark…</option>
    </select>
  );
}
