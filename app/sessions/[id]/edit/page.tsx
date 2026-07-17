import { notFound, redirect } from "next/navigation";
import { getSessionById } from "@/db/queries/sessions";
import { listAllOptionValues } from "@/db/queries/options";
import { listMarks } from "@/db/queries/marks";
import { listPhotos } from "@/db/queries/photos";
import { SessionForm } from "@/components/session-form";
import type { SessionFormValues } from "@/lib/validation/session";
import { getUserId } from "@/lib/auth-helpers";

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const { id } = await params;
  const [session, options, marks, photos] = await Promise.all([
    getSessionById(userId, Number(id)),
    listAllOptionValues(userId),
    listMarks(userId),
    listPhotos(userId, Number(id)),
  ]);

  if (!session) notFound();

  const defaultValues: SessionFormValues = {
    session: {
      date: session.date,
      location: session.location,
      locationDetails: session.locationDetails,
      country: session.country,
      numberOfDives: session.numberOfDives,
      comments: session.comments,
      highTideTime: session.highTideTime,
      lowTideTime: session.lowTideTime,
      startTime: session.startTime,
      sessionLengthHours: session.sessionLengthHours,
      tideType: session.tideType,
      slackTideTime: session.slackTideTime,
      tideRatio: session.tideRatio,
      current: session.current,
      currentSpeedKt: session.currentSpeedKt,
      seaCondition: session.seaCondition,
      windCondition: session.windCondition,
      windDirection: session.windDirection,
      pressure: session.pressure,
      visibility: session.visibility,
      depthFrom: session.depthFrom,
      depthTo: session.depthTo,
      gpsPoint: session.gpsPoint,
      rating: session.rating,
      fishAbundance: session.fishAbundance,
    },
    catches: session.catches.map((c) => ({
      species: c.species,
      quantity: c.quantity,
      weight: c.weight,
      size: c.size,
      markId: c.markId,
    })),
    marks: session.marks.map((m) => ({ markId: m.id })),
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit session</h1>
      <SessionForm
        mode="edit"
        sessionId={session.id}
        defaultValues={defaultValues}
        options={{ ...options, marks: marks.map((m) => ({ id: m.id, name: m.name, location: m.location })) }}
        photos={photos}
      />
    </div>
  );
}
