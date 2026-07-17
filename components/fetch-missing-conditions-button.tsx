"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { button } from "@/lib/ui";

type Progress = { completed: number; total: number };
type Result = { updated: number; total: number; errors: string[] } | { error: string };

export function FetchMissingConditionsButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function handleClick() {
    setPending(true);
    setResult(null);
    setProgress(null);

    try {
      const res = await fetch("/api/sessions/fetch-missing-conditions", { method: "POST" });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setResult({ error: typeof data?.error === "string" ? data.error : "Could not fetch tide/current data." });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "start") {
            setProgress({ completed: 0, total: event.total });
          } else if (event.type === "progress") {
            setProgress({ completed: event.completed, total: event.total });
          } else if (event.type === "done") {
            setResult({ updated: event.updated, total: event.total, errors: event.errors });
            if (event.updated > 0) router.refresh();
          }
        }
      }
    } catch {
      setResult({ error: "Could not fetch tide/current data." });
    } finally {
      setPending(false);
      setProgress(null);
    }
  }

  const percent = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="relative flex items-center gap-3">
      <button type="button" onClick={handleClick} disabled={pending} className={button("primary", "text-xs")}>
        {pending ? "Fetching…" : "Fetch missing tide & current data"}
      </button>
      {pending && progress && progress.total > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-border/60">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="whitespace-nowrap text-xs text-muted">
            {progress.completed} of {progress.total}
          </p>
        </div>
      )}
      {result && (
        <div className="absolute right-0 top-full z-10 mt-2 w-80 rounded-lg border border-surface-border bg-surface p-3 text-xs shadow-md">
          {"error" in result ? (
            <p className="text-danger">{result.error}</p>
          ) : (
            <>
              <p className="font-medium">
                {result.total === 0
                  ? "Every session already has tide & current data."
                  : `Updated ${result.updated} of ${result.total} session${result.total === 1 ? "" : "s"}.`}
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
