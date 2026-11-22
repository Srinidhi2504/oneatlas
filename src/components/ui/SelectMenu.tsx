"use client";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/** Accessible single select (Radix): keyboard, typeahead, screen-reader semantics. */
export function SelectMenu<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T;
  onValueChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <Select.Root value={value} onValueChange={(v) => onValueChange(v as T)}>
      <Select.Trigger
        aria-label={label}
        className={cn(
          "inline-flex h-9 items-center justify-between gap-2 rounded-[var(--radius-control)] border border-border bg-bg px-3 text-13 hover:border-border-strong data-[state=open]:border-accent",
          className,
        )}
      >
        <span className="text-faint">{label}:</span>
        <span className="truncate font-medium">
          <Select.Value />
        </span>
        <Select.Icon>
          <ChevronDown className="size-3.5 text-faint" aria-hidden />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={4} className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--radius-panel)] border border-border bg-bg p-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.25)]">
          <Select.Viewport>
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                className="relative flex h-8 cursor-pointer items-center rounded-[var(--radius-control)] pr-8 pl-2.5 text-13 outline-none select-none data-[highlighted]:bg-surface-2"
              >
                <Select.ItemText>{o.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-2">
                  <Check className="size-3.5 text-accent" aria-hidden />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
