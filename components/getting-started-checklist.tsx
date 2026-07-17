"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { cardClass, button } from "@/lib/ui";

const DISMISS_KEY = "spearlog-getting-started-dismissed";

// localStorage isn't readable during SSR and doesn't fire a same-tab "storage"
// event on write, so this is a minimal external store: subscribers are just
// notified manually by dismiss() below, and the server snapshot is "not
// dismissed" (checklist visible) since the real state is only knowable client-side.
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return localStorage.getItem(DISMISS_KEY) === "1";
}

function getServerSnapshot() {
  return false;
}

function dismiss() {
  localStorage.setItem(DISMISS_KEY, "1");
  listeners.forEach((notify) => notify());
}

type Step = {
  title: string;
  description: string;
  href?: string;
  cta?: string;
};

const STEPS: Step[] = [
  {
    title: "Import your sessions",
    description: 'Bring in your existing dive log from a spreadsheet — use "Data actions → Import CSV" above.',
  },
  {
    title: "Fetch missing tide & current data",
    description:
      'Backfill tide, current, and weather conditions for every imported session automatically — use "Fetch missing tide & current data" above.',
  },
  {
    title: "Geotag your locations",
    description: "Resolve GPS coordinates and place names for your marks in bulk.",
    href: "/marks",
    cta: "Go to Marks",
  },
  {
    title: "Import your marks",
    description: "Bring in named spots from a GPX file (e.g. exported from a chartplotter or GPS watch).",
    href: "/marks",
    cta: "Go to Marks",
  },
];

// Shown only while a new account has no sessions yet — hidden as soon as the
// user dismisses it, or forever once real data exists (see app/page.tsx).
export function GettingStartedChecklist() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (dismissed) return null;

  return (
    <section className={`${cardClass} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Getting started</h2>
          <p className="mt-1 text-xs text-muted">Four steps to get your existing data into SpearLog.</p>
        </div>
        <button type="button" onClick={dismiss} className="shrink-0 text-xs text-muted hover:text-foreground">
          Dismiss
        </button>
      </div>
      <ol className="mt-4 flex flex-col gap-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-foreground">
              {i + 1}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="mt-0.5 text-xs text-muted">{step.description}</p>
            </div>
            {step.href && step.cta && (
              <Link href={step.href} className={button("secondary", "shrink-0 text-xs")}>
                {step.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
