"use client";

import { useSyncExternalStore } from "react";
import type { GpsFormat } from "@/lib/gps";

const STORAGE_KEY = "fishlog:gpsFormat";
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): GpsFormat {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "DD" || stored === "DDM" ? stored : "DDM";
}

function getServerSnapshot(): GpsFormat {
  return "DDM";
}

/** The user's preferred GPS coordinate display/entry format, persisted in localStorage and shared live across every GpsCoordinateInput on the page. DDM by default. */
export function useGpsFormat(): [GpsFormat, (format: GpsFormat) => void] {
  const format = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function setFormat(next: GpsFormat) {
    window.localStorage.setItem(STORAGE_KEY, next);
    for (const listener of listeners) listener();
  }

  return [format, setFormat];
}
