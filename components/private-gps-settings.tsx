"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MarkRow } from "@/db/schema";
import { button, inputClass } from "@/lib/ui";
import {
  decryptMarkCoordinates,
  encryptMarkCoordinates,
  generatePrivateGpsKey,
  importPrivateGpsKey,
} from "@/lib/private-gps-crypto";

export function PrivateGpsSettings({ enabled, marks }: { enabled: boolean; marks: MarkRow[] }) {
  const router = useRouter();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enablePrivateGps() {
    if (!newKey || confirmation !== newKey || !acknowledged) return;

    setPending(true);
    setError(null);
    try {
      const key = await importPrivateGpsKey(newKey);
      const encryptedMarks = await Promise.all(
        marks
          .filter((mark) => mark.lat != null || mark.lng != null)
          .map(async (mark) => ({
            id: mark.id,
            gpsEncrypted: await encryptMarkCoordinates(key, { lat: mark.lat, lng: mark.lng }),
          }))
      );
      const response = await fetch("/api/account/private-gps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, marks: encryptedMarks }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not enable Private GPS.");

      setNewKey(null);
      setConfirmation("");
      setAcknowledged(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not encrypt marks.");
    } finally {
      setPending(false);
    }
  }

  async function disablePrivateGps() {
    if (!acknowledged) return;

    setPending(true);
    setError(null);
    try {
      const key = await importPrivateGpsKey(keyInput);
      const decryptedMarks = await Promise.all(
        marks
          .filter((mark) => mark.gpsEncrypted != null)
          .map(async (mark) => ({
            id: mark.id,
            ...(await decryptMarkCoordinates(key, mark.gpsEncrypted!)),
          }))
      );
      const response = await fetch("/api/account/private-gps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false, marks: decryptedMarks }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not disable Private GPS.");

      setKeyInput("");
      setAcknowledged(false);
      router.refresh();
    } catch {
      setError("Could not unlock every mark. Check the key and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="private-gps" className="rounded-xl border border-surface-border bg-surface p-5">
      <h2 className="text-sm font-semibold">Private GPS for marks</h2>
      {enabled ? (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-sm text-muted">
            Mark coordinates are encrypted in your browser. SpearLog does not store your key. Enter it to view, edit,
            import, export, or disable Private GPS.
          </p>
          <label className="text-xs font-medium text-muted" htmlFor="private-gps-disable-key">
            Encryption key
          </label>
          <input
            id="private-gps-disable-key"
            type="password"
            autoComplete="off"
            className={inputClass}
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            placeholder="Paste your 43-character key"
          />
          <label className="flex items-start gap-2 text-xs text-muted">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            Disabling Private GPS stores mark coordinates as readable database values again.
          </label>
          <div>
            <button
              type="button"
              onClick={disablePrivateGps}
              disabled={pending || keyInput.length === 0 || !acknowledged}
              className={button("secondary")}
            >
              {pending ? "Unlocking marks…" : "Disable Private GPS"}
            </button>
          </div>
        </div>
      ) : newKey ? (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-sm text-danger">
            If you lose this key, your mark coordinates cannot be recovered by you or SpearLog. Save it in a password
            manager before continuing.
          </p>
          <div>
            <label className="text-xs font-medium text-muted" htmlFor="private-gps-new-key">
              Your Private GPS key
            </label>
            <input
              id="private-gps-new-key"
              readOnly
              autoComplete="off"
              className={`${inputClass} mt-1 font-mono`}
              value={newKey}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(newKey)}
              className="mt-1 text-xs text-accent underline underline-offset-2"
            >
              Copy key
            </button>
          </div>
          <label className="text-xs font-medium text-muted" htmlFor="private-gps-confirm-key">
            Re-enter the key to confirm you saved it
          </label>
          <input
            id="private-gps-confirm-key"
            type="password"
            autoComplete="off"
            className={inputClass}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <label className="flex items-start gap-2 text-xs text-muted">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            I understand that losing this key makes encrypted mark coordinates permanently unrecoverable.
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={enablePrivateGps}
              disabled={pending || confirmation !== newKey || !acknowledged}
              className={button("primary")}
            >
              {pending ? "Encrypting marks…" : "Enable Private GPS"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNewKey(null);
                setConfirmation("");
                setAcknowledged(false);
                setError(null);
              }}
              disabled={pending}
              className={button("ghost")}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-sm text-muted">
            Encrypts precise GPS coordinates for your marks in this browser. Names, location labels, and session GPS
            are unchanged. You will need the key whenever you want to view, edit, import, or export mark coordinates.
          </p>
          <div>
            <button
              type="button"
              onClick={() => {
                setNewKey(generatePrivateGpsKey());
                setError(null);
              }}
              className={button("secondary")}
            >
              Set up Private GPS
            </button>
          </div>
        </div>
      )}
      {error && enabled && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}