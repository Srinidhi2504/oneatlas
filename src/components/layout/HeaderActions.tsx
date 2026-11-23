"use client";
// Header actions: search, compare badge, Ask the code, theme switch and the mobile menu; lazy-loads the palette.
import * as Dialog from "@radix-ui/react-dialog";
import { GitCompareArrows, Menu, Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCompareList } from "@/lib/compare-store";
import { AskLauncher } from "@/components/ask/AskLauncher";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

// cmdk + the palette UI load on first open (or hover/focus of the search button), not with every page
const loadPalette = () => import("./CommandPalette").then((m) => m.CommandPalette);
const CommandPalette = dynamic(loadPalette, { ssr: false });

const iconButton =
  "inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] text-muted transition-colors hover:bg-surface-2 hover:text-fg";

export function HeaderActions() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteUsed, setPaletteUsed] = useState(false); // stays mounted after the first open (keeps its state)
  const [menuOpen, setMenuOpen] = useState(false);
  const { items } = useCompareList();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteUsed(true);
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPalette = () => {
    setPaletteUsed(true);
    setPaletteOpen(true);
  };

  const compareHref = items.length ? `/compare?ids=${items.map((i) => i.id).join(",")}` : "/compare";

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        onPointerEnter={() => void loadPalette()}
        className="hidden h-9 w-56 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-13 text-faint transition-colors hover:border-border-strong xl:flex"
        aria-label="Search models, labs and providers (Control K)"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search className="size-4" aria-hidden />
        <span>Search…</span>
        <kbd className="ml-auto rounded border border-border bg-bg px-1.5 text-[11px] font-medium text-muted">Ctrl K</kbd>
      </button>
      <button type="button" onClick={openPalette}
        onPointerEnter={() => void loadPalette()} className={`${iconButton} xl:hidden`} aria-label="Search">
        <Search className="size-4" aria-hidden />
      </button>

      <Link
        href={compareHref}
        className="relative inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        aria-label={`Compare (${items.length} selected)`}
      >
        <GitCompareArrows className="size-4" aria-hidden />
        <span className="hidden xl:inline">Compare</span>
        {items.length ? (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-fg">
            {items.length}
          </span>
        ) : null}
      </Link>

      <AskLauncher />

      <ThemeToggle />

      <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <Dialog.Trigger className={`${iconButton} lg:hidden`} aria-label="Open menu">
          <Menu className="size-4" aria-hidden />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--fg)_28%,transparent)]" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-72 flex-col border-l border-border bg-bg p-4" aria-describedby={undefined}>
            <div className="mb-4 flex items-center justify-between">
              <Dialog.Title className="text-sm font-semibold">Menu</Dialog.Title>
              <Dialog.Close className={iconButton} aria-label="Close menu">
                <X className="size-4" aria-hidden />
              </Dialog.Close>
            </div>
            <nav aria-label="Mobile">
              <NavLinks className="flex-col items-stretch gap-1 [&_a]:h-10" onNavigate={() => setMenuOpen(false)} />
            </nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {paletteUsed ? <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} /> : null}
    </>
  );
}
