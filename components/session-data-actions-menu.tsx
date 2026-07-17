"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { button } from "@/lib/ui";

type ImportResult = { imported: number; total: number; errors: string[] } | { error: string };

export function SessionDataActionsMenu() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const exportHref = `/api/sessions/export${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPending(true);
    setResult(null);

    try {
      const text = await file.text();
      const res = await fetch("/api/sessions/import", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
      });
      const data = await res.json();
      setResult(data);
      if (res.ok && data.imported > 0) router.refresh();
    } catch {
      setResult({ error: "Could not read or upload that file." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={button("secondary", "text-xs")}>
        Data actions ▾
      </button>
      <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={handleFileSelected} className="hidden" />

      {open && !result && (
        <div className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-lg border border-surface-border bg-surface py-1 text-sm shadow-md">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              inputRef.current?.click();
            }}
            disabled={pending}
            className="block w-full px-3 py-2 text-left hover:bg-surface-border/40"
          >
            {pending ? "Importing…" : "Import CSV"}
          </button>
          <a href={exportHref} onClick={() => setOpen(false)} className="block w-full px-3 py-2 text-left hover:bg-surface-border/40">
            Export CSV
          </a>
        </div>
      )}

      {result && (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-lg border border-surface-border bg-surface p-3 text-xs shadow-md">
          {"error" in result ? (
            <p className="text-danger">{result.error}</p>
          ) : (
            <>
              <p className="font-medium">
                Imported {result.imported} of {result.total} session{result.total === 1 ? "" : "s"}.
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
