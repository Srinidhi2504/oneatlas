// Rolling-digit number: each digit is a 0-9 strip translated to its value; a CSS animation rolls it in on first paint.
// Server-renderable (no hooks), so there is no hydration flash; screen readers get the plain value.
import { cn } from "@/lib/cn";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function Odometer({ value, className }: { value: string; className?: string }) {
  let digitIndex = 0;
  return (
    <span className={cn("relative inline-block", className)}>
      <span className="sr-only">{value}</span>
      <span className="odo" aria-hidden>
        {[...value].map((ch, i) =>
          /\d/.test(ch) ? (
            <span key={i} className="odo-digit">
              <span className="odo-strip" style={{ ["--d" as string]: ch, ["--i" as string]: digitIndex++ }}>
                {DIGITS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          ) : (
            <span key={i} className="odo-char">
              {ch === " " ? " " : ch}
            </span>
          ),
        )}
      </span>
    </span>
  );
}
