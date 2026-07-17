import { redirect } from "next/navigation";
import { listOptions } from "@/db/queries/options";
import { listMarks } from "@/db/queries/marks";
import { OPTION_CATEGORIES, OPTION_CATEGORY_LABELS, TIDE_TYPES, TIDE_TYPE_LABELS, CURRENT_LEVELS } from "@/lib/constants";
import { OptionListManager } from "@/components/option-list-manager";
import { MarksTable } from "@/components/marks-table";
import { getUserId } from "@/lib/auth-helpers";
import { cardClass } from "@/lib/ui";

export default async function MaintenancePage() {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const lists = await Promise.all(OPTION_CATEGORIES.map((category) => listOptions(userId, category)));
  const marks = await listMarks(userId);
  const locationOptions = lists[OPTION_CATEGORIES.indexOf("location")].map((o) => o.value);
  const locationDetailsOptions = lists[OPTION_CATEGORIES.indexOf("locationDetails")].map((o) => o.value);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Maintenance</h1>
        <p className="mt-1 text-sm text-muted">
          Manage the values that show up in dropdowns on the session form. New values you type on the form are added
          here automatically too.
        </p>
      </div>

      {OPTION_CATEGORIES.map((category, i) => (
        <section key={category} className={`${cardClass} p-5`}>
          <h2 className="mb-3 text-sm font-semibold">{OPTION_CATEGORY_LABELS[category]}</h2>
          <OptionListManager category={category} initialValues={lists[i]} />
        </section>
      ))}

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-1 text-sm font-semibold">Fishing marks</h2>
        <p className="mb-3 text-xs text-muted">
          Named GPS waypoints — select them on catches, attach several to a session, and browse them on the Marks tab.
        </p>
        <MarksTable marks={marks} locationOptions={locationOptions} locationDetailsOptions={locationDetailsOptions} />
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-1 text-sm font-semibold">Tide type</h2>
        <p className="mb-3 text-xs text-muted">Fixed set, used by Dashboard breakdowns — not editable here.</p>
        <div className="flex flex-wrap gap-2">
          {TIDE_TYPES.map((t) => (
            <span key={t} className="rounded-md border border-surface-border/60 px-3 py-1.5 text-sm">
              {TIDE_TYPE_LABELS[t]}
            </span>
          ))}
        </div>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-1 text-sm font-semibold">Current</h2>
        <p className="mb-3 text-xs text-muted">Fixed set, used by Dashboard breakdowns — not editable here.</p>
        <div className="flex flex-wrap gap-2">
          {CURRENT_LEVELS.map((c) => (
            <span key={c} className="rounded-md border border-surface-border/60 px-3 py-1.5 text-sm">
              {c}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
