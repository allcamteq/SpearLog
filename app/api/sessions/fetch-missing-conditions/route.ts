import { NextResponse } from "next/server";
import { listSessionsMissingConditions, setSessionConditions } from "@/db/queries/sessions";
import { fetchSessionConditions, StormglassError } from "@/lib/fetch-session-conditions";
import { getUserId } from "@/lib/auth-helpers";

// Streams newline-delimited JSON progress events so the client can render a live
// progress bar — a full batch can take a while since each session is a Stormglass call.
export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const candidates = await listSessionsMissingConditions(userId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const errors: string[] = [];
      let updated = 0;

      send({ type: "start", total: candidates.length });

      for (const [index, session] of candidates.entries()) {
        try {
          const conditions = await fetchSessionConditions(userId, {
            location: session.location!,
            country: session.country,
            date: session.date!,
            startTime: session.startTime,
          });
          await setSessionConditions(userId, session.id, conditions);
          updated++;
        } catch (error) {
          const label = session.date ? `${session.location} (${session.date})` : session.location!;
          if (error instanceof StormglassError) {
            errors.push(`${label}: ${error.message}`);
            // The daily quota is shared across every remaining session — stop
            // burning requests on calls that will just fail the same way.
            if (error.code === "quota_exceeded") {
              send({ type: "progress", completed: candidates.length, total: candidates.length });
              break;
            }
          } else {
            errors.push(`${label}: ${error instanceof Error ? error.message : "could not fetch conditions"}`);
          }
        }

        send({ type: "progress", completed: index + 1, total: candidates.length });
      }

      send({ type: "done", updated, total: candidates.length, errors });
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}
