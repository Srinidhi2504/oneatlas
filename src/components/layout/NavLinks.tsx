"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export const NAV = [
  { href: "/", label: "Models", match: (p: string) => p === "/" || p.startsWith("/models") || p.startsWith("/compare") },
  { href: "/rankings/reach", label: "Rankings", match: (p: string) => p.startsWith("/rankings") },
  { href: "/benchmarks", label: "Benchmarks", match: (p: string) => p.startsWith("/benchmarks") },
  { href: "/labs", label: "Labs", match: (p: string) => p.startsWith("/labs") },
  { href: "/providers", label: "Providers", match: (p: string) => p.startsWith("/providers") },
];

export function NavLinks({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/";
  return (
    <ul className={cn("flex items-center gap-0.5", className)}>
      {NAV.map((item) => {
        const active = item.match(pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-8 items-center rounded-[var(--radius-control)] px-2.5 text-sm transition-colors",
                active ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
