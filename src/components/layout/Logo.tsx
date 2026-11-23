// OneAtlas wordmark: a meridian globe glyph and the name, linking home.
import Link from "next/link";

/** Wordmark: a meridian globe (an atlas, not a sparkle) + the name. */
export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2 rounded-md font-semibold tracking-tight" aria-label="OneAtlas home">
      <svg viewBox="0 0 24 24" className="size-6 text-accent" aria-hidden>
        <circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <ellipse cx="12" cy="12" rx="4" ry="9.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 9.25h18M3 14.75h18" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
        <circle cx="15.6" cy="7.4" r="1.6" fill="currentColor" />
      </svg>
      <span className="text-[15px]">OneAtlas</span>
    </Link>
  );
}
