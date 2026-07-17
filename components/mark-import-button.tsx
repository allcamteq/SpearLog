"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { button } from "@/lib/ui";

type ImportResult = { imported: number; total: number; errors: string[] } | { error: string };

export function MarkImportButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPending(true);
    setResult(null);

    try {
      const text = await file.text();
      const res = await fetch("/api/marks/import", {
        method: "POST",
        headers: { "Content-Type": "application/gpx+xml" },
        body: text,
      });
      const data = await res.json();
      setResult(data);
      if (res.ok && data.imported > 0) {
        router.refresh();
      }
    } catch {
      setResult({ error: "Could not read or upload that file." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className={button("primary")}
      >
        {pending ? "Importing…" : "Import GPX"}
      </button>
      <input ref={inputRef} type="file" accept=".gpx,application/gpx+xml" onChange={handleFileSelected} className="hidden" />
      {result && (
        <div className="absolute right-0 top-full z-10 mt-2 w-80 rounded-lg border border-surface-border bg-surface p-3 text-xs shadow-md">
          {"error" in result ? (
            <p className="text-danger">{result.error}</p>
          ) : (
            <>
              <p className="font-medium">
                Imported {result.imported} of {result.total} waypoint{result.total === 1 ? "" : "s"}.
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-danger">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          <button type="button" onClick={() => setResult(null)} className="mt-2 text-muted hover:text-foreground">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
