"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { SessionPhotoRow } from "@/db/schema";
import { button } from "@/lib/ui";

export function SessionPhotos({ sessionId, initialPhotos }: { sessionId: number; initialPhotos: SessionPhotoRow[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/sessions/${sessionId}/photos`, { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not upload that photo.");
        continue;
      }

      setPhotos((prev) => [...prev, data]);
    }

    setUploading(false);
  }

  async function handleDelete(photoId: number) {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    await fetch(`/api/sessions/${sessionId}/photos/${photoId}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">Add photos from this session (JPEG, PNG, WebP, or HEIC, up to 10MB each).</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={button("primary", "whitespace-nowrap text-xs")}
        >
          {uploading ? "Uploading…" : "Add photos"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {photos.length === 0 ? (
        <p className="text-sm text-muted">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg border border-surface-border">
              <Image src={photo.url} alt="Session photo" fill sizes="200px" className="object-cover" unoptimized />
              <button
                type="button"
                onClick={() => handleDelete(photo.id)}
                className="absolute right-1.5 top-1.5 rounded-md bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
