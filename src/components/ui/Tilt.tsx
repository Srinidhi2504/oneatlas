"use client";
// Subtle 3D tilt + glare that follows the pointer. Mouse/pen only (touch scrolls normally); off under reduced motion.
import { useRef, type ComponentProps, type PointerEvent } from "react";
import { cn } from "@/lib/cn";

const MAX_DEG = 6;

export function Tilt({ className, children, as: Tag = "div", ...rest }: ComponentProps<"div"> & { as?: "div" | "article" | "li" }) {
  const frame = useRef(0);

  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === "touch") return;
    const el = e.currentTarget;
    const { left, top, width, height } = el.getBoundingClientRect();
    const px = (e.clientX - left) / width;
    const py = (e.clientY - top) / height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.dataset.tilting = "";
      el.style.setProperty("--ry", `${(px - 0.5) * 2 * MAX_DEG}deg`);
      el.style.setProperty("--rx", `${(0.5 - py) * 2 * MAX_DEG}deg`);
      el.style.setProperty("--gx", `${px * 100}%`);
      el.style.setProperty("--gy", `${py * 100}%`);
      el.style.setProperty("--go", "1");
    });
  };
  const onLeave = (e: PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    cancelAnimationFrame(frame.current);
    delete el.dataset.tilting;
    for (const p of ["--rx", "--ry"]) el.style.setProperty(p, "0deg");
    el.style.setProperty("--go", "0");
  };

  const Component = Tag as "div";
  return (
    <Component className={cn("tilt", className)} onPointerMove={onMove} onPointerLeave={onLeave} {...rest}>
      {children}
    </Component>
  );
}
