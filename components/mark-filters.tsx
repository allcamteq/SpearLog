"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { inputClass, labelClass, cardClass, button } from "@/lib/ui";

export function MarkFilters({
  locationOptions,
  markOptions,
}: {
  locationOptions: string[];
  markOptions: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [values, setValues] = useState({
    location: searchParams.get("location") ?? "",
    mark: searchParams.get("mark") ?? "",
  });

  function update(field: "location" | "mark", value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (values.location) params.set("location", values.location);
    if (values.mark) params.set("mark", values.mark);
    router.push(`/marks?${params.toString()}`);
  }

  function clearFilters() {
    setValues({ location: "", mark: "" });
    router.push("/marks");
  }

  return (
    <form onSubmit={applyFilters} className={`${cardClass} p-4`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Location</label>
          <select className={inputClass} value={values.location} onChange={(e) => update("location", e.target.value)}>
            <option value="">Any</option>
            {locationOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Mark</label>
          <select className={inputClass} value={values.mark} onChange={(e) => update("mark", e.target.value)}>
            <option value="">Any</option>
            {markOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="submit" className={button("primary")}>
          Apply filters
        </button>
        <button type="button" onClick={clearFilters} className={button("ghost")}>
          Clear
        </button>
      </div>
    </form>
  );
}
