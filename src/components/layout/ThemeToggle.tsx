"use client";
// Light/dark theme switch; the choice is stored on <html data-theme> and in localStorage.
import { Moon, Sun } from "lucide-react";
import { THEME_KEY } from "./theme";

/**
 * Light <-> dark switch. The first visit follows the OS; a click stores an explicit choice on <html data-theme>
 * and in localStorage. Which icon shows is decided by CSS from the same rules as the colour tokens
 * (.theme-icon-* in globals.css), so the server-rendered button is right before hydration.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage blocked: the choice still applies to this page */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      aria-label="Switch between light and dark theme"
    >
      <Moon className="theme-icon-light size-4" aria-hidden />
      <Sun className="theme-icon-dark size-4" aria-hidden />
    </button>
  );
}
