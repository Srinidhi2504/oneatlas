import { formatInteger } from "@/lib/format";
import { getStats } from "@/server/services/catalog";
import { ButtonLink } from "@/components/ui/primitives";
import { AtlasGlobe } from "./AtlasGlobe";
import { AskCta } from "./AskCta";

/** Home hero: what this is, in one sentence with live catalog numbers, and the globe. Cached read: static shell. */
export async function Hero() {
  const s = await getStats();
  return (
    <section aria-labelledby="hero-title" className="relative grid items-center gap-2 pt-6 pb-4 sm:pt-10 lg:grid-cols-2 lg:gap-8 2xl:pt-14">
      <div className="relative z-[1]">
        <h1 id="hero-title" className="enter max-w-[14ch] text-[40px] leading-[1.02] font-semibold tracking-[-0.03em] sm:text-[56px] 2xl:text-[68px]">
          Every AI model, mapped.
        </h1>
        <p className="enter mt-4 max-w-[54ch] text-[15px] leading-relaxed text-muted" style={{ ["--stagger" as string]: 1 }}>
          {formatInteger(s.models)} models from {formatInteger(s.labs)} labs, served by {formatInteger(s.providers)} API providers. Compare prices, context windows,
          capabilities and benchmarks side by side, then open any model to see who serves it and for how much.
        </p>
        <div className="enter mt-6 flex flex-wrap gap-2" style={{ ["--stagger" as string]: 2 }}>
          <ButtonLink href="#explore" variant="primary" className="h-10 px-4">
            Explore models
          </ButtonLink>
          <ButtonLink href="/rankings/value" className="h-10 px-4">
            Best value right now
          </ButtonLink>
          <AskCta />
        </div>
        <p className="enter mt-5 hidden text-xs text-faint sm:block" style={{ ["--stagger" as string]: 3 }}>
          Press <kbd className="rounded border border-border px-1 font-sans">/</kbd> to search models,{" "}
          <kbd className="rounded border border-border px-1 font-sans">Ctrl K</kbd> for everything.
        </p>
      </div>
      <div className="relative -mx-4 h-[230px] sm:mx-0 sm:h-[340px] lg:h-[440px] 2xl:h-[540px]">
        {/* soft aurora behind the globe: three palette hues, heavily blurred */}
        <div aria-hidden className="pointer-events-none absolute inset-[12%] opacity-50 blur-3xl">
          <span className="absolute top-[8%] left-[14%] size-[46%] rounded-full" style={{ background: "color-mix(in srgb, var(--accent) 35%, transparent)" }} />
          <span className="absolute right-[6%] bottom-[16%] size-[40%] rounded-full" style={{ background: "color-mix(in srgb, var(--c-amber) 30%, transparent)" }} />
          <span className="absolute bottom-[4%] left-[22%] size-[34%] rounded-full" style={{ background: "color-mix(in srgb, var(--c-violet) 26%, transparent)" }} />
        </div>
        <AtlasGlobe className="enter absolute inset-0 h-full w-full" />
      </div>
    </section>
  );
}
