// Branded 404 page with routes back into the catalog.
import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <Compass className="size-10 text-accent" strokeWidth={1.5} aria-hidden />
      <p className="mt-4 text-13 font-medium text-muted">404</p>
      <h1 className="mt-1 text-[28px] leading-9">This page isn’t on the map</h1>
      <p className="mt-2 max-w-[48ch] text-muted">
        The model, lab or provider may have been renamed or removed from the catalog. Search for it, or start from the full list.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <ButtonLink href="/" variant="primary">
          Browse all models
        </ButtonLink>
        <ButtonLink href="/rankings/reach">See rankings</ButtonLink>
      </div>
      <p className="mt-4 text-13 text-faint">Tip: press Ctrl K anywhere to search.</p>
    </div>
  );
}
