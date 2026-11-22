// Small presentational primitives shared by every page. Server-safe (no hooks) unless noted.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Responsive card grid (plain string: safe to import from server and client components). */
export const cardGrid = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const buttonBase =
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-control)] font-medium transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";
const buttonVariants: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary: "border border-border bg-bg text-fg hover:border-border-strong hover:bg-surface",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
};
const buttonSizes: Record<Size, string> = { sm: "h-8 px-2.5 text-13", md: "h-9 px-3.5 text-sm" };

export const buttonClass = (variant: Variant = "secondary", size: Size = "md", className?: string) =>
  cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";
const tones: Record<Tone, string> = {
  neutral: "border-border bg-surface text-muted",
  accent: "border-transparent bg-accent-soft text-accent",
  success: "border-transparent bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-success",
  warning: "border-transparent bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-warning",
  danger: "border-transparent bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex h-5 items-center gap-1 rounded-[4px] border px-1.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3", tones[tone], className)}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-shimmer rounded-[4px] bg-surface-2", className)} />;
}

/** Deterministic initials avatar for a lab (no external logos). */
export function LabAvatar({ slug, name, size = 28, className }: { slug: string; name: string; size?: number; className?: string }) {
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? slug).slice(0, 2)).toUpperCase();
  return (
    <span
      aria-hidden
      className={cn("avatar inline-flex shrink-0 items-center justify-center rounded-[7px] font-semibold tracking-tight", className)}
      style={{ ["--h" as string]: hash % 360, width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials}
    </span>
  );
}

export function PageHeader({ title, description, actions, children }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 pt-8 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="enter text-[28px] leading-9">{title}</h1>
        {description ? <p className="enter mt-1.5 max-w-[68ch] text-muted" style={{ ["--stagger" as string]: 1 }}>{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-[var(--radius-panel)] border border-border bg-bg", className)} {...props} />;
}

export function SectionTitle({ children, id, aside }: { children: ReactNode; id?: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-base">
        {children}
      </h2>
      {aside ? <div className="text-13 text-muted">{aside}</div> : null}
    </div>
  );
}

/** Empty and error states: say what happened and offer the next action. */
export function StateMessage({ icon, title, children, action, className }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      {icon ? <div className="mb-3 text-faint [&_svg]:size-6">{icon}</div> : null}
      <p className="text-base font-semibold">{title}</p>
      {children ? <div className="mt-1 max-w-[52ch] text-muted">{children}</div> : null}
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Label/value pair used in spec lists. */
export function Spec({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
