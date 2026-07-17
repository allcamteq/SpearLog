"use client";

import { useState } from "react";
import { inputClass } from "@/lib/ui";

const ADD_NEW = "__add_new__";

export function EditableSelect({
  value,
  onChange,
  onBlur,
  options,
  placeholder,
}: {
  value: string | null | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: string[];
  placeholder?: string;
}) {
  const [adding, setAdding] = useState(false);
  const showTextInput = adding || (!!value && !options.includes(value));

  if (showTextInput) {
    return (
      <div className="flex gap-1.5">
        <input
          autoFocus
          className={inputClass}
          placeholder={placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        {options.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              onChange("");
            }}
            className="whitespace-nowrap text-xs text-muted hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      className={inputClass}
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) {
          setAdding(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
      onBlur={onBlur}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={ADD_NEW}>+ Add new…</option>
    </select>
  );
}
