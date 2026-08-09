"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type BnbSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type BnbSelectProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  options: BnbSelectOption[];
  onChange?: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function BnbSelect({
  name,
  value,
  defaultValue,
  options,
  onChange,
  ariaLabel,
  placeholder = "Select",
  className = "",
  disabled = false,
}: BnbSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const controlled = typeof value === "string";
  const selectedValue = controlled ? value : internalValue;
  const selectedOption = useMemo(
    () => options.find((option) => option.value === selectedValue),
    [options, selectedValue],
  );

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(nextValue: string) {
    const nextOption = options.find((option) => option.value === nextValue);
    if (!nextOption || nextOption.disabled) return;
    if (!controlled) setInternalValue(nextValue);
    onChange?.(nextValue);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function moveSelection(direction: 1 | -1) {
    const enabled = options.filter((option) => !option.disabled);
    if (enabled.length === 0) return;
    const currentIndex = enabled.findIndex((option) => option.value === selectedValue);
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + direction + enabled.length) % enabled.length;
    choose(enabled[nextIndex].value);
  }

  return (
    <div ref={rootRef} className={`bnb-select-shell ${className}`} data-open={open ? "true" : undefined}>
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
      <button
        ref={buttonRef}
        type="button"
        className="bnb-select-trigger bnb-focus"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) setOpen(true);
            else moveSelection(1);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) setOpen(true);
            else moveSelection(-1);
          }
        }}
      >
        <span className="bnb-select-value">{selectedOption?.label || placeholder}</span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>

      {open ? (
        <div id={`${id}-menu`} className="bnb-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const selected = option.value === selectedValue;
            return (
              <button
                key={option.value || option.label}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                className="bnb-select-option bnb-focus"
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                {selected ? <Check aria-hidden="true" size={15} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
