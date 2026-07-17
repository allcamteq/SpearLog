"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MarkRow } from "@/db/schema";
import { inputClass, labelClass, button, cardClass } from "@/lib/ui";
import { EditableSelect } from "@/components/editable-select";
import { GpsCoordinateInput } from "@/components/gps-coordinate-input";
import { PopulateMarkLocationButton } from "@/components/populate-mark-location-button";
import { formatGps, type GpsCoordinate } from "@/lib/gps";
import { useGpsFormat } from "@/lib/use-gps-format";

type SortKey = "name" | "gps" | "location";
type SortDir = "asc" | "desc";

type FormState = {
  name: string;
  location: string;
  locationDetails: string;
  coord: GpsCoordinate | null;
  freeText: string;
  comments: string;
};

const emptyForm: FormState = {
  name: "",
  location: "",
  locationDetails: "",
  coord: null,
  freeText: "",
  comments: "",
};

function markToForm(mark: MarkRow): FormState {
  return {
    name: mark.name,
    location: mark.location ?? "",
    locationDetails: mark.locationDetails ?? "",
    coord: mark.lat != null && mark.lng != null ? { lat: mark.lat, lng: mark.lng } : null,
    freeText: mark.freeText ?? "",
    comments: mark.comments ?? "",
  };
}

export function MarksTable({
  marks,
  locationOptions,
  locationDetailsOptions,
}: {
  marks: MarkRow[];
  locationOptions: string[];
  locationDetailsOptions: string[];
}) {
  const router = useRouter();
  const [format] = useGpsFormat();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(markToForm({ name: "" } as MarkRow));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(emptyForm);
  const [addPending, setAddPending] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...marks].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "location") return (a.location ?? "").localeCompare(b.location ?? "") * dir;
      // gps: marks without coordinates sort last regardless of direction
      const aHas = a.lat != null && a.lng != null;
      const bHas = b.lat != null && b.lng != null;
      if (aHas !== bHas) return aHas ? -1 : 1;
      if (!aHas) return 0;
      return (a.lat! - b.lat! || a.lng! - b.lng!) * dir;
    });
  }, [marks, sortKey, sortDir]);

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return null;
    return <span className="ml-1 text-muted">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function handleEdit(mark: MarkRow) {
    setEditingId(mark.id);
    setForm(markToForm(mark));
    setError(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function handleDelete(id: number) {
    await fetch(`/api/marks/${id}`, { method: "DELETE" });
    if (editingId === id) handleCancelEdit();
    router.refresh();
  }

  async function handleSave(id: number) {
    const trimmedName = form.name.trim();
    if (!trimmedName) return;

    setPending(true);
    setError(null);

    const res = await fetch(`/api/marks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmedName,
        location: form.location || null,
        locationDetails: form.locationDetails || null,
        lat: form.coord?.lat ?? null,
        lng: form.coord?.lng ?? null,
        freeText: form.freeText || null,
        comments: form.comments || null,
      }),
    });
    setPending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(typeof data?.error === "string" ? data.error : "Could not save that mark.");
      return;
    }

    setEditingId(null);
    router.refresh();
  }

  async function handleCreate() {
    const trimmedName = addForm.name.trim();
    if (!trimmedName) return;

    setAddPending(true);
    setAddError(null);

    const res = await fetch("/api/marks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmedName,
        location: addForm.location || null,
        locationDetails: addForm.locationDetails || null,
        lat: addForm.coord?.lat ?? null,
        lng: addForm.coord?.lng ?? null,
        freeText: addForm.freeText || null,
        comments: addForm.comments || null,
      }),
    });
    setAddPending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setAddError(typeof data?.error === "string" ? data.error : "Could not add that mark.");
      return;
    }

    setAddForm(emptyForm);
    setAdding(false);
    router.refresh();
  }

  function handleCancelAdd() {
    setAdding(false);
    setAddForm(emptyForm);
    setAddError(null);
  }

  const addSection = (
    <div className={`${cardClass} p-4`}>
      {adding ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Name</label>
              <input
                autoFocus
                className={inputClass}
                placeholder="e.g. North reef ledge"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>Location</label>
              <EditableSelect
                value={addForm.location}
                onChange={(v) => setAddForm((f) => ({ ...f, location: v }))}
                options={locationOptions}
                placeholder="e.g. Bognor Regis"
              />
            </div>
            <div>
              <label className={labelClass}>Location description</label>
              <EditableSelect
                value={addForm.locationDetails}
                onChange={(v) => setAddForm((f) => ({ ...f, locationDetails: v }))}
                options={locationDetailsOptions}
                placeholder="e.g. entry point, landmarks"
              />
            </div>
            <div>
              <label className={labelClass}>GPS (optional)</label>
              <GpsCoordinateInput value={addForm.coord} onChange={(coord) => setAddForm((f) => ({ ...f, coord }))} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Free text</label>
              <input
                className={inputClass}
                placeholder="e.g. 50m past the second buoy, near the rocks — in case you'd rather not record exact GPS"
                value={addForm.freeText}
                onChange={(e) => setAddForm((f) => ({ ...f, freeText: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Comments</label>
              <textarea
                rows={3}
                className={inputClass}
                placeholder="e.g. notes on the best conditions to fish this mark"
                value={addForm.comments}
                onChange={(e) => setAddForm((f) => ({ ...f, comments: e.target.value }))}
              />
            </div>
          </div>
          {addError && <p className="mt-2 text-sm text-danger">{addError}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={addPending || !addForm.name.trim()}
              className={button("primary")}
            >
              {addPending ? "Adding…" : "Add mark"}
            </button>
            <button type="button" onClick={handleCancelAdd} className={button("ghost")}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={button("primary")}>
          + Add mark
        </button>
      )}
    </div>
  );

  if (marks.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {addSection}
        <p className="text-sm text-muted">No marks match these filters yet.</p>
      </div>
    );
  }

  const headerCell = "px-3 py-2 text-left text-xs font-semibold text-muted select-none";

  return (
    <div className="flex flex-col gap-4">
      {addSection}
      <div className={`overflow-x-auto ${cardClass}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-border/20">
              <th className={headerCell}>
                <button type="button" onClick={() => toggleSort("name")} className="hover:text-foreground">
                  Name{sortIndicator("name")}
                </button>
              </th>
              <th className={headerCell}>
                <button type="button" onClick={() => toggleSort("gps")} className="hover:text-foreground">
                  GPS{sortIndicator("gps")}
                </button>
              </th>
              <th className={headerCell}>
                <button type="button" onClick={() => toggleSort("location")} className="hover:text-foreground">
                  Location{sortIndicator("location")}
                </button>
              </th>
              <th className={headerCell}>Free text</th>
              <th className={headerCell}></th>
              <th className={headerCell}></th>
              <th className={headerCell}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((mark) => {
              const hasGps = mark.lat != null && mark.lng != null;
              const isEditing = editingId === mark.id;
              return (
                <Fragment key={mark.id}>
                  <tr className="border-b border-surface-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium">{mark.name}</td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {hasGps ? formatGps(mark.lat!, mark.lng!, format) : "No GPS recorded"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {mark.location || "—"}
                      {mark.locationDetails && <span className="block text-muted/70">{mark.locationDetails}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{mark.freeText || "—"}</td>
                    <td className="px-3 py-2">
                      <PopulateMarkLocationButton markId={mark.id} hasGps={hasGps} hasLocation={!!mark.location} />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => (isEditing ? handleCancelEdit() : handleEdit(mark))}
                        className="text-xs font-medium text-accent hover:text-accent-hover"
                      >
                        {isEditing ? "Cancel" : "Edit"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(mark.id)}
                        className="text-xs font-medium text-danger hover:text-danger-hover"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="border-b border-surface-border/60 bg-surface-border/10 last:border-0">
                      <td colSpan={7} className="p-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className={labelClass}>Name</label>
                            <input
                              className={inputClass}
                              value={form.name}
                              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Location</label>
                            <EditableSelect
                              value={form.location}
                              onChange={(v) => setForm((f) => ({ ...f, location: v }))}
                              options={locationOptions}
                              placeholder="e.g. Bognor Regis"
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Location description</label>
                            <EditableSelect
                              value={form.locationDetails}
                              onChange={(v) => setForm((f) => ({ ...f, locationDetails: v }))}
                              options={locationDetailsOptions}
                              placeholder="e.g. entry point, landmarks"
                            />
                          </div>
                          <div>
                            <label className={labelClass}>GPS (optional)</label>
                            <GpsCoordinateInput
                              value={form.coord}
                              onChange={(coord) => setForm((f) => ({ ...f, coord }))}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className={labelClass}>Free text</label>
                            <input
                              className={inputClass}
                              placeholder="e.g. 50m past the second buoy, near the rocks — in case you'd rather not record exact GPS"
                              value={form.freeText}
                              onChange={(e) => setForm((f) => ({ ...f, freeText: e.target.value }))}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className={labelClass}>Comments</label>
                            <textarea
                              rows={3}
                              className={inputClass}
                              placeholder="e.g. notes on the best conditions to fish this mark"
                              value={form.comments}
                              onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
                            />
                          </div>
                        </div>
                        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSave(mark.id)}
                            disabled={pending || !form.name.trim()}
                            className={button("primary")}
                          >
                            {pending ? "Saving…" : "Save changes"}
                          </button>
                          <button type="button" onClick={handleCancelEdit} className={button("ghost")}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
