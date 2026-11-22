// Top three of a leaderboard as a small 3D podium (CSS 3D: a front face plus a top face seen from slightly above).
import Link from "next/link";
import { LabAvatar } from "@/components/ui/primitives";
import { MEDAL, TONE } from "@/lib/tones";
import type { RankingRow } from "@/lib/types";

const HEIGHT: Record<number, number> = { 1: 104, 2: 78, 3: 58 };

export function Podium({ rows }: { rows: RankingRow[] }) {
  const top = rows.filter((r) => r.rank <= 3).slice(0, 3);
  if (top.length < 3) return null;
  const order = [top[1], top[0], top[2]]; // silver, gold, bronze
  return (
    <ol aria-label="Top three" className="relative mx-auto grid max-w-[560px] grid-cols-3 items-end gap-2 sm:gap-3" style={{ perspective: "700px", perspectiveOrigin: "50% -80%" }}>
      {/* floor shadow */}
      <span aria-hidden className="pointer-events-none absolute inset-x-[-6%] -bottom-3 h-6 rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--fg)_14%,transparent),transparent)]" />
      {order.map((r, i) => (
        <li key={r.model.id} className="flex min-w-0 flex-col items-center text-center">
          <Link href={`/models/${r.model.id}`} className="group mb-3 flex min-w-0 flex-col items-center px-1">
            <LabAvatar slug={r.model.lab.slug} name={r.model.lab.name} size={r.rank === 1 ? 44 : 36} className="pop-in transition-transform group-hover:-translate-y-0.5" />
            <span className="mt-2 line-clamp-2 text-13 leading-tight font-semibold group-hover:text-accent">{r.model.name}</span>
            <span className="text-xs text-muted">{r.valueLabel}</span>
          </Link>
          <div
            className="relative w-full origin-bottom rounded-t-[6px] border border-b-0"
            style={{
              height: HEIGHT[r.rank] ?? 56,
              transformStyle: "preserve-3d",
              animation: `podium-rise 0.7s cubic-bezier(0.2,0.7,0.2,1) ${0.12 * i}s both`,
              borderColor: `color-mix(in srgb, ${TONE[MEDAL[r.rank]].color} 40%, var(--border))`,
              background: `linear-gradient(to bottom, color-mix(in srgb, ${TONE[MEDAL[r.rank]].color} 18%, var(--bg)), var(--bg))`,
            }}
          >
            {/* top face */}
            <span
              aria-hidden
              className="absolute inset-x-[-1px] bottom-full h-9 origin-bottom border"
              style={{
                transform: "rotateX(62deg)",
                borderColor: `color-mix(in srgb, ${TONE[MEDAL[r.rank]].color} 40%, var(--border))`,
                background: `color-mix(in srgb, ${TONE[MEDAL[r.rank]].color} 30%, var(--bg))`,
              }}
            />
            <span className={`absolute inset-x-0 top-2 text-2xl font-semibold sm:text-3xl ${TONE[MEDAL[r.rank]].text}`} aria-label={`Rank ${r.rank}`}>
              {r.rank}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
