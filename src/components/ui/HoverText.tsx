"use client";
// Pointer-reactive text: letters near the cursor turn gold and grow (used on headings and intro text).
import { Fragment, useEffect, useRef, type ElementType } from "react";
import { cn } from "@/lib/cn";

/**
 * Text whose letters react to the pointer: each letter near the cursor turns gold and grows, then eases back as the
 * pointer moves away (a Gaussian falloff by distance, so it feels like a wave following the mouse).
 *
 * How it works: every letter is an inline-block span with a CSS variable --i (0..1). CSS turns --i into colour and
 * scale and transitions between values (.hover-letter in globals.css); this code only measures distances and sets
 * --i, once per animation frame. Nothing runs for touch input or under prefers-reduced-motion.
 * Screen readers get a visually hidden copy of the text; the letter spans are aria-hidden.
 */
export function HoverText({ text, as, className }: { text: string; as?: ElementType; className?: string }) {
  const Tag = as ?? "span";
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const letters = Array.from(root.querySelectorAll<HTMLElement>(".hover-letter"));
    let frame = 0;
    let point: { x: number; y: number } | null = null;

    const paint = () => {
      frame = 0;
      const size = parseFloat(getComputedStyle(root).fontSize) || 16;
      const sigma = size * 0.85; // reach of the effect scales with the text size: about 2 to 3 letters
      const spread = sigma * sigma;
      for (const el of letters) {
        let i = 0;
        if (point) {
          const r = el.getBoundingClientRect();
          const dx = point.x - (r.left + r.width / 2);
          const dy = point.y - (r.top + r.height / 2);
          i = Math.exp(-(dx * dx + dy * dy) / (2 * spread));
          if (i < 0.02) i = 0;
        }
        el.style.setProperty("--i", i.toFixed(2));
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return; // touch has no hover
      point = { x: e.clientX, y: e.clientY };
      schedule();
    };
    const onLeave = () => {
      point = null;
      schedule();
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, [text]);

  // words stay together (nowrap) so lines still break between words
  const words = text.split(" ");
  return (
    <Tag ref={ref} className={cn("hover-text", className)}>
      {/* screen readers get the plain text; the per-letter spans below are hidden from them */}
      <span className="sr-only">{text}</span>
      <span aria-hidden>
      {words.map((word, w) => (
        <Fragment key={w}>
          <span className="inline-block whitespace-nowrap">
            {[...word].map((ch, c) => (
              <span key={c} className="hover-letter">
                {ch}
              </span>
            ))}
          </span>
          {/* the space lives outside the nowrap box: trailing spaces inside an inline-block collapse */}
          {w < words.length - 1 ? " " : null}
        </Fragment>
      ))}
      </span>
    </Tag>
  );
}
