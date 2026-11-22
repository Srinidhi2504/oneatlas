"use client";
// The atlas globe: a dotted sphere in true 3D projection, AI-lab hubs and great-circle arcs with travelling pulses.
// Canvas 2D, no 3D library (~150 lines instead of ~150 kB). Decorative: aria-hidden, pauses off-screen and in hidden tabs,
// renders a single still frame under prefers-reduced-motion, follows the theme tokens, and spins on drag with inertia.
import { useEffect, useRef } from "react";

type Vec = [number, number, number];

// approximate HQ locations of AI labs in the catalog (decorative, not data)
const HUBS: [number, number][] = [
  [37.77, -122.42], [47.61, -122.33], [40.71, -74.0], [43.65, -79.38], [51.51, -0.13], [48.86, 2.35],
  [52.52, 13.4], [39.9, 116.4], [31.23, 121.47], [22.54, 114.06], [35.68, 139.69], [1.35, 103.82], [12.97, 77.59], [24.71, 46.68],
];
const ARCS: [number, number][] = [[0, 4], [0, 10], [4, 7], [5, 12], [2, 6], [10, 11], [8, 12], [1, 3], [7, 9], [13, 6]];

const toVec = (lat: number, lon: number): Vec => {
  const p = (lat * Math.PI) / 180;
  const l = (lon * Math.PI) / 180;
  return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)];
};

/** Spherical interpolation between two unit vectors, lifted above the surface mid-way (so arcs read as flight paths). */
function arcPoints(a: Vec, b: Vec, steps = 48): Vec[] {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  const s = Math.sin(omega) || 1;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const k1 = Math.sin((1 - t) * omega) / s;
    const k2 = Math.sin(t * omega) / s;
    const lift = 1 + 0.18 * Math.sin(Math.PI * t) * (omega / Math.PI + 0.35);
    return [(a[0] * k1 + b[0] * k2) * lift, (a[1] * k1 + b[1] * k2) * lift, (a[2] * k1 + b[2] * k2) * lift];
  });
}

export function AtlasGlobe({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // fibonacci sphere: evenly spread dots
    const N = 1100;
    const dots: Vec[] = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * Math.PI * (3 - Math.sqrt(5));
      return [Math.cos(th) * r, y, Math.sin(th) * r];
    });
    const hubs = HUBS.map(([la, lo]) => toVec(la, lo));
    const arcs = ARCS.map(([a, b]) => arcPoints(hubs[a], hubs[b]));

    let colors = { dot: "#888", accent: "#0b6e6a", rim: "#ccc", palette: ["#0b6e6a"] };
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const v = (name: string) => cs.getPropertyValue(name).trim();
      // hubs and arcs cycle through the data palette, so the globe carries the same colours as the rest of the UI
      colors = { dot: v("--faint"), accent: v("--accent"), rim: v("--border-strong"), palette: ["--accent", "--c-amber", "--c-violet", "--c-coral", "--c-blue", "--c-green"].map(v) };
    };
    readColors();

    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();

    const tilt = 0.4; // look from slightly above the equator: most hubs are in the northern hemisphere
    let spin = 2.2;
    let velocity = reduce ? 0 : 0.0022; // radians per frame at rest
    const baseVelocity = velocity;
    let dragging = false;
    let lastX = 0;

    const project = (v: Vec, R: number, cx: number, cy: number) => {
      const cosA = Math.cos(spin), sinA = Math.sin(spin), cosT = Math.cos(tilt), sinT = Math.sin(tilt);
      const x1 = v[0] * cosA + v[2] * sinA;
      const z1 = -v[0] * sinA + v[2] * cosA;
      const y2 = v[1] * cosT - z1 * sinT;
      const z2 = v[1] * sinT + z1 * cosT;
      return { x: cx + x1 * R, y: cy - y2 * R, z: z2 };
    };

    let time = 0;
    const draw = () => {
      const R = Math.min(w, h) * 0.42;
      const cx = w / 2, cy = h / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // soft halo + rim
      const halo = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, Math.min(R * 1.16, Math.min(w, h) / 2));
      halo.addColorStop(0, "transparent");
      halo.addColorStop(0.55, colors.accent);
      halo.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = colors.rim;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // dots: back hemisphere faint, front bright and larger
      ctx.fillStyle = colors.dot;
      for (const d of dots) {
        const p = project(d, R, cx, cy);
        const front = (p.z + 1) / 2;
        ctx.globalAlpha = p.z < 0 ? 0.08 + front * 0.12 : 0.25 + front * 0.6;
        const s = p.z < 0 ? 0.9 : 1 + front * 1.1;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }

      // arcs with a travelling pulse
      arcs.forEach((pts, ai) => {
        const color = colors.palette[ai % colors.palette.length];
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        const proj = pts.map((v) => project(v, R, cx, cy));
        ctx.lineWidth = 1.2;
        for (let i = 1; i < proj.length; i++) {
          const z = (proj[i].z + proj[i - 1].z) / 2;
          ctx.globalAlpha = z < -0.15 ? 0.06 : 0.25 + Math.max(0, z) * 0.45;
          ctx.beginPath();
          ctx.moveTo(proj[i - 1].x, proj[i - 1].y);
          ctx.lineTo(proj[i].x, proj[i].y);
          ctx.stroke();
        }
        const t = (time * 0.004 + ai * 0.137) % 1;
        const head = proj[Math.floor(t * (proj.length - 1))];
        if (head.z > -0.1) {
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(head.x, head.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // hubs with a breathing ring
      hubs.forEach((v, i) => {
        const p = project(v, R, cx, cy);
        if (p.z < -0.05) return;
        const pulse = (Math.sin(time * 0.05 + i) + 1) / 2;
        ctx.fillStyle = colors.palette[i % colors.palette.length];
        ctx.globalAlpha = 0.25 * (1 - pulse) * (0.4 + p.z);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 + pulse * 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };

    let raf = 0;
    let visible = true;
    const loop = () => {
      if (!dragging) {
        velocity += (baseVelocity - velocity) * 0.02; // ease back to the resting spin after a fling
        spin += velocity;
      }
      time++;
      draw();
      raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
    };
    const start = () => {
      if (!raf && !reduce) raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    io.observe(canvas);
    const onVisibility = () => !document.hidden && start();
    document.addEventListener("visibilitychange", onVisibility);
    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);
    const mo = new MutationObserver(() => {
      readColors();
      draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      readColors();
      draw();
    };
    mq.addEventListener("change", onScheme);

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      velocity = dx * 0.006;
      spin += velocity;
      if (reduce) draw();
    };
    const onUp = () => {
      dragging = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    draw();
    start();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", onScheme);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} style={{ touchAction: "pan-y", cursor: "grab" }} />;
}
