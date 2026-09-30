import { redirect } from "next/navigation";
import { listOptions } from "@/db/queries/options";
import { getUserId } from "@/lib/auth-helpers";
import { TripPlanner } from "@/components/trip-planner";

export const metadata = { title: "Trip planning" };

export default async function TripPlanningPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const [locationOptions, countryOptions] = await Promise.all([
    listOptions(userId, "location"),
    listOptions(userId, "country"),
  ]);

  return (
    <TripPlanner
      locationOptions={locationOptions.map((o) => o.value)}
      countryOptions={countryOptions.map((o) => o.value)}
    />
  );
}
