"use client";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/** Accessible tooltip (Radix): shows on hover and keyboard focus. The trigger must be focusable or wrap one. */
export function Tip({ label, children, side = "top" }: { label: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-64 rounded-[var(--radius-control)] border border-border bg-fg px-2 py-1 text-xs text-bg shadow-md"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
