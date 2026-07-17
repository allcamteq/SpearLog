"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { button } from "@/lib/ui";

export function DeleteSessionButton({ sessionId }: { sessionId: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this session? This cannot be undone.")) return;
    setPending(true);
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className={button("danger")}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
