import { useId, type ChangeEvent } from "react";

export const ADD_OPTION = "__add__";

export interface PickerOption {
  value: number;
  label: string;
}

interface PickerProps {
  label: string;
  value: number | null;
  options: PickerOption[];
  onChange: (value: number | null) => void;
  /** "Add organization": shown as the last item, and opens the inline add form (R45). */
  addLabel?: string;
  onAdd?: () => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  name?: string;
}

/**
 * A labelled record picker on a native select, so it works with the keyboard and screen readers
 * as it is. The "Add …" item calls `onAdd` and leaves the current choice unchanged.
 */
export function Picker({
  label,
  value,
  options,
  onChange,
  addLabel,
  onAdd,
  placeholder = "None",
  error,
  disabled,
  name,
}: PickerProps) {
  const id = useId();
  const errorId = `${id}-error`;
  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (next === ADD_OPTION) {
      onAdd?.();
      return;
    }
    onChange(next === "" ? null : Number(next));
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name={name}
        value={value === null ? "" : String(value)}
        onChange={handleChange}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {addLabel && onAdd && <option value={ADD_OPTION}>+ {addLabel}</option>}
      </select>
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
