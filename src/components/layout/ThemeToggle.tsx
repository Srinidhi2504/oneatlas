"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { THEME_KEY, type ThemeChoice } from "./theme";

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const ICON = { system: Monitor, light: Sun, dark: Moon };

/** Cycles system -> light -> dark. The choice lives on <html data-theme> + localStorage. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice>("system");

  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    // sync from the attribute the inline head script set before hydration
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t === "light" || t === "dark") setTheme(t);
  }, []);

  function cycle() {
    const next = NEXT[theme];
    setTheme(next);
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage blocked: the choice still applies to this page */
    }
  }

  const Icon = ICON[theme];
  return (
    <button
      type="button"
      onClick={cycle}
      className="inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      aria-label={`Theme: ${theme}. Switch to ${NEXT[theme]}`}
      title={`Theme: ${theme}`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
