"use client";

import { Controller, type Control, type UseFormRegister } from "react-hook-form";
import type { SessionFormValues } from "@/lib/validation/session";
import { inputClass, labelClass, button } from "@/lib/ui";
import { EditableSelect } from "@/components/editable-select";
import { MarkSelect, type MarkOption } from "@/components/mark-select";

export function CatchRowFields({
  index,
  control,
  register,
  speciesOptions,
  marks,
  onMarkCreated,
  defaultMarkLocation,
  defaultMarkLocationDetails,
  onRemove,
}: {
  index: number;
  control: Control<SessionFormValues>;
  register: UseFormRegister<SessionFormValues>;
  speciesOptions: string[];
  marks: MarkOption[];
  onMarkCreated: (mark: MarkOption) => void;
  defaultMarkLocation?: string | null;
  defaultMarkLocationDetails?: string | null;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-2 items-end gap-2 rounded-lg border border-surface-border bg-background/40 p-2.5 sm:grid-cols-[2fr_1fr_1fr_1fr_1.5fr_auto]">
      <div className="col-span-2 sm:col-span-1">
        <label className={labelClass}>Species</label>
        <Controller
          control={control}
          name={`catches.${index}.species`}
          render={({ field }) => (
            <EditableSelect
              value={field.value as string}
              onChange={field.onChange}
              options={speciesOptions}
              placeholder="e.g. Snapper"
            />
          )}
        />
      </div>
      <div>
        <label className={labelClass}>Quantity</label>
        <input type="number" min={1} step={1} className={inputClass} {...register(`catches.${index}.quantity`)} />
      </div>
      <div>
        <label className={labelClass}>Weight (kg)</label>
        <input type="number" min={0} step="any" className={inputClass} {...register(`catches.${index}.weight`)} />
      </div>
      <div>
        <label className={labelClass}>Size (cm)</label>
        <input type="number" min={0} step="any" className={inputClass} {...register(`catches.${index}.size`)} />
      </div>
      <div>
        <label className={labelClass}>Mark</label>
        <Controller
          control={control}
          name={`catches.${index}.markId`}
          render={({ field }) => (
            <MarkSelect
              value={field.value as number | null}
              onChange={field.onChange}
              marks={marks}
              onMarkCreated={onMarkCreated}
              defaultLocation={defaultMarkLocation}
              defaultLocationDetails={defaultMarkLocationDetails}
            />
          )}
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <button type="button" onClick={onRemove} className={button("ghost", "h-fit")}>
          Remove
        </button>
      </div>
    </div>
  );
}
