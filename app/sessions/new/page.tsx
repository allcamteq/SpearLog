import { redirect } from "next/navigation";
import { SessionForm } from "@/components/session-form";
import { listAllOptionValues } from "@/db/queries/options";
import { listMarks } from "@/db/queries/marks";
import { getUserId } from "@/lib/auth-helpers";

export default async function NewSessionPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const [options, marks] = await Promise.all([listAllOptionValues(userId), listMarks(userId)]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">New session</h1>
      <SessionForm
        mode="create"
        options={{ ...options, marks: marks.map((m) => ({ id: m.id, name: m.name, location: m.location })) }}
      />
    </div>
  );
}
