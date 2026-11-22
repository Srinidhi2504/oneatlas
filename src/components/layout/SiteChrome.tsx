import { formatDate, formatInteger } from "@/lib/format";
import { getStats } from "@/server/services/catalog";
import { HeaderActions } from "./HeaderActions";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden md:block">
          <NavLinks />
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <HeaderActions />
        </div>
      </div>
    </header>
  );
}

/** Data attributions + freshness. Cached read, so it is part of the static shell. */
export async function Footer() {
  const stats = await getStats();
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto grid max-w-[1280px] gap-6 px-4 py-8 text-13 text-muted sm:grid-cols-[1fr_auto] sm:px-6">
        <div className="space-y-1.5">
          <p>
            Data from{" "}
            <a className="underline decoration-border-strong underline-offset-2 hover:text-fg" href="https://models.dev" rel="noreferrer">
              models.dev
            </a>{" "}
            (models, providers, prices) and{" "}
            <a className="underline decoration-border-strong underline-offset-2 hover:text-fg" href="https://openrouter.ai/models" rel="noreferrer">
              OpenRouter
            </a>{" "}
            (descriptions, benchmark feeds). Benchmarks by{" "}
            <a className="underline decoration-border-strong underline-offset-2 hover:text-fg" href="https://artificialanalysis.ai" rel="noreferrer">
              Artificial Analysis
            </a>{" "}
            and{" "}
            <a className="underline decoration-border-strong underline-offset-2 hover:text-fg" href="https://www.designarena.ai" rel="noreferrer">
              Design Arena
            </a>
            .
          </p>
          <p>Prices are USD per 1M tokens. Blended = (3 × input + output) / 4.</p>
        </div>
        <p className="sm:text-right">
          {formatInteger(stats.models)} models in {formatInteger(stats.listings)} API listings
          <br />
          Catalog updated {formatDate(stats.updatedAt?.slice(0, 10))}
        </p>
      </div>
    </footer>
  );
}
