"use client";
// The atlas globe: a dotted sphere, AI-lab hubs and great-circle arcs with travelling pulses, drawn as ~60k GPU particles.
// Hovering turns the material liquid: particles near the cursor are blown outward and swirled, a wake follows the pointer,
// curl-noise turbulence appears where it was disturbed, fast particles stretch into glinting streaks, then everything
// springs back to the crisp globe. Particle/liquid technique after guglielmogiannattasio.it.
//
// Engine: WebGL2 GPGPU, no library. Per-particle state (screen offset + velocity) lives in two float textures that a
// fragment shader ping-pongs each frame; a small 256x256 "flow map" carries the cursor's wake. One shared GLSL `project()`
// (spin, tilt, radius) is used by the simulation and the renderer, so particles stay glued to the spinning globe.
// Fallback: the original Canvas 2D globe (startGlobe2D) when WebGL2 or float render targets are missing, a shader fails,
// the context is lost, or the user prefers reduced motion (one still frame). Decorative: aria-hidden, pauses off-screen.
import { useEffect, useRef } from "react";

type Vec = [number, number, number];
type Rgb = [number, number, number];

// approximate HQ locations of AI labs in the catalog (decorative, not data)
const HUBS: [number, number][] = [
  [37.77, -122.42], [47.61, -122.33], [40.71, -74.0], [43.65, -79.38], [51.51, -0.13], [48.86, 2.35],
  [52.52, 13.4], [39.9, 116.4], [31.23, 121.47], [22.54, 114.06], [35.68, 139.69], [1.35, 103.82], [12.97, 77.59], [24.71, 46.68],
];
const ARCS: [number, number][] = [[0, 4], [0, 10], [4, 7], [5, 12], [2, 6], [10, 11], [8, 12], [1, 3], [7, 9], [13, 6]];
const PALETTE_VARS = ["--accent", "--c-amber", "--c-violet", "--c-coral", "--c-blue", "--c-green"];
const TILT = 0.4; // look from slightly above the equator: most hubs are in the northern hemisphere
const REST_VELOCITY = 0.0022; // radians per frame at rest

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

/** Fibonacci sphere: n evenly spread unit vectors. */
const fibonacci = (n: number): Vec[] =>
  Array.from({ length: n }, (_, i) => {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = i * Math.PI * (3 - Math.sqrt(5));
    return [Math.cos(th) * r, y, Math.sin(th) * r];
  });

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Every globe engine gets a fresh canvas: a canvas that once held a WebGL context can never give out a 2D one. */
function makeCanvas(host: HTMLElement) {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab";
  host.appendChild(canvas);
  return canvas;
}

/** Tells `onChange` whether the canvas is on screen in a visible tab (so loops can pause); returns the cleanup. */
function whileVisible(canvas: HTMLCanvasElement, onChange: (visible: boolean) => void) {
  let onScreen = true;
  const update = () => onChange(onScreen && !document.hidden);
  const io = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    update();
  });
  io.observe(canvas);
  document.addEventListener("visibilitychange", update);
  return () => {
    io.disconnect();
    document.removeEventListener("visibilitychange", update);
  };
}

/** Re-runs `onTheme` when the light/dark theme flips (the toggle sets data-theme; the OS can change too). */
function onThemeChange(onTheme: () => void) {
  const mo = new MutationObserver(onTheme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onTheme);
  return () => {
    mo.disconnect();
    mq.removeEventListener("change", onTheme);
  };
}

export function AtlasGlobe({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let stop = () => {};
    const fallback = () => {
      stop();
      stop = startGlobe2D(makeCanvas(host));
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = reduce ? null : startGlobeGL(makeCanvas(host), fallback);
    if (gl) stop = gl;
    else fallback();
    return () => stop();
  }, []);

  return <div ref={hostRef} aria-hidden className={className} />;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* WebGL2 particle engine                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

const TEX_W = 1024; // particle textures are 1024 wide; particle i lives at texel (i % 1024, i / 1024)
const FLOW = 256; // flow map resolution
const MID = 128 / 255; // the flow map stores velocity around 128 in RG

// effect defaults (all 1 = as designed)
const STRENGTH = 1, SPREAD = 1, TURBULENCE = 1, LIQUID = 1, RETURN_SPEED = 1, DOT_SIZE = 1;
const SETTLE_FRAMES = 270; // keep simulating this long after the pointer leaves, then snap back to the crisp globe

// projection shared by the simulation and the renderer: unit-sphere point -> (CSS px x, y down, depth z)
const GLSL_PROJECT = /* glsl */ `
uniform vec2 uRes;
uniform float uSpin, uTilt, uR;
vec3 project(vec3 v) {
  float cA = cos(uSpin), sA = sin(uSpin), cT = cos(uTilt), sT = sin(uTilt);
  float x1 = v.x * cA + v.z * sA;
  float z1 = -v.x * sA + v.z * cA;
  float y2 = v.y * cT - z1 * sT;
  float z2 = v.y * sT + z1 * cT;
  return vec3(uRes * 0.5 + vec2(x1, -y2) * uR, z2);
}`;

// value noise and its curl: a divergence-free field, so particles swirl instead of bunching up
const GLSL_CURL = /* glsl */ `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
vec2 curl(vec2 p) {
  const float e = 0.1;
  float a = noise(p + vec2(0, e)) - noise(p - vec2(0, e));
  float b = noise(p + vec2(e, 0)) - noise(p - vec2(e, 0));
  return vec2(a, -b) / (2.0 * e);
}`;

const VS_FULLSCREEN = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// flow map: advect by its own velocity, blur, inject the cursor's velocity and energy, decay
const FS_FLOW = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uFlow;
uniform vec2 uRes, uMouse, uMouseVel;
uniform float uPresence, uRadius, uDt;
out vec4 o;
const float MID = ${MID.toFixed(6)};
void main() {
  vec2 tx = vec2(1.0 / ${FLOW}.0);
  vec2 uv = gl_FragCoord.xy * tx;
  vec2 v = texture(uFlow, uv).xy - MID;
  vec2 src = uv - v * tx * 2.5 * uDt;
  vec4 c = texture(uFlow, src) * 0.52 + 0.12 * (texture(uFlow, src + vec2(tx.x, 0)) + texture(uFlow, src - vec2(tx.x, 0))
         + texture(uFlow, src + vec2(0, tx.y)) + texture(uFlow, src - vec2(0, tx.y)));
  vec2 vel = c.xy - MID;
  float energy = c.z;
  vec2 d = uv * uRes - uMouse;
  float g = exp(-dot(d, d) / (uRadius * uRadius)) * uPresence;
  vel += uMouseVel * g * 0.22 / 255.0 * uDt;
  energy = max(energy, g * min(length(uMouseVel) / 16.0, 1.0));
  float k = pow(0.968, uDt);
  vel = sign(vel) * max(abs(vel) * k - 1.2 / 255.0 * uDt, 0.0);
  energy = max(energy * k - 1.2 / 255.0 * uDt, 0.0);
  o = vec4(clamp(vel, -MID, 1.0 - MID) + MID, energy, 1.0);
}`;

// particle physics: one texel per particle, state = (offset.xy px, velocity.xy px/frame)
const FS_SIM = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uState, uHome, uCol, uFlow;
uniform vec2 uMouse;
uniform float uPresence, uRadius, uStrength, uSpread, uTurb, uReturn, uDt, uTime;
out vec4 o;
const float MID = ${MID.toFixed(6)};
${GLSL_PROJECT}
${GLSL_CURL}
void main() {
  ivec2 t = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(uState, t, 0);
  vec3 home = texelFetch(uHome, t, 0).xyz;
  float seed = texelFetch(uCol, t, 0).a;
  vec2 off = s.xy, vel = s.zw;
  vec2 p = project(home).xy + off;

  vec2 d = p - uMouse;
  float r2 = dot(d, d);
  float f = exp(-r2 / (uRadius * uRadius)) * uPresence;
  vec2 n = r2 > 1e-4 ? d * inversesqrt(r2) : vec2(0);
  vec4 flow = texture(uFlow, p / uRes);
  vec2 wake = (flow.xy - MID) * 2.0;
  float e = clamp(flow.z * 2.0 + f, 0.0, 1.0);
  float light = 0.45 + seed * 1.1; // light particles fly further, heavy ones lag: the material reads as liquid

  vec2 acc = n * f * 1.25 * uStrength * uSpread * light;               // blown outward
  acc += vec2(-n.y, n.x) * f * 1.45 * uStrength * uSpread * (0.4 + seed); // swirled around the cursor
  acc += (wake * 42.0 * uSpread * light - vel) * e * 0.08;               // dragged along the wake
  vec2 q = p * 0.0095 + uTime * vec2(0.35, -0.2);
  acc += (curl(q) + curl(q * 2.3 + 7.1) * 0.5) * (e * 1.2 * uSpread) * uTurb * light; // turbulence where disturbed
  acc -= off * (0.006 + 0.02 * uReturn) * (0.65 + seed * 0.7);          // elastic return home

  vel += acc * uDt;
  vel *= pow(mix(0.93, 0.955, e), uDt);
  off += vel * uDt;
  if (dot(off, off) < 0.0004 && dot(vel, vel) < 0.0004) { off = vec2(0); vel = vec2(0); }
  o = vec4(off, vel);
}`;

// soft accent halo + faint rim, behind the particles
const FS_HALO = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uR, uDpr;
uniform vec3 uAccent, uRim;
out vec4 o;
void main() {
  float d = distance(gl_FragCoord.xy / uDpr, uRes * 0.5);
  float r0 = uR * 0.7, r1 = min(uR * 1.16, min(uRes.x, uRes.y) * 0.5);
  float k = clamp((d - r0) / max(r1 - r0, 1.0), 0.0, 1.0);
  float halo = (k < 0.55 ? k / 0.55 : (1.0 - k) / 0.45) * 0.07 * step(r0, d) * step(d, r1);
  float rim = clamp(1.0 - abs(d - uR), 0.0, 1.0) * 0.5;
  o = vec4(uRim * rim + uAccent * halo * (1.0 - rim), rim + halo * (1.0 - rim));
}`;

// one instanced quad per particle, stretched along its velocity into a comet when it moves fast
const VS_PARTICLE = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uState, uHome, uCol;
uniform float uTime, uPulse, uFlowing, uLiquid, uDot, uScale, uSpacing;
uniform vec3 uGlint;
out vec2 vLocal;
out float vL, vR;
out vec4 vColor;
${GLSL_PROJECT}
${GLSL_CURL}
void main() {
  ivec2 t = ivec2(gl_InstanceID & ${TEX_W - 1}, gl_InstanceID >> 10);
  vec4 home = texelFetch(uHome, t, 0);
  vec3 rgb = texelFetch(uCol, t, 0).rgb;
  vec4 s = texelFetch(uState, t, 0);
  vec3 P = project(home.xyz);
  float z = P.z, front = (z + 1.0) * 0.5, w = home.w;
  float r, a; // radius (CSS px) and alpha
  vec2 ring = vec2(0);

  if (w < 1.5) {                    // sphere dot, w = size jitter: back hemisphere faint, front brighter and larger
    // (dots never grow past a third of their spacing, and sit at 60% of the old alpha: 40x the old dot count)
    r = min((z < 0.0 ? 0.45 : 0.5 + front * 0.55) * w, uSpacing * 0.32);
    a = (z < 0.0 ? 0.08 + front * 0.12 : 0.25 + front * 0.6) * 0.6;
  } else if (w < 3.5) {             // arc sample, w = 2 + position along the arc (phase-shifted): a pulse travels along it
    float behind = fract(uPulse - (w - 2.0));
    float pulse = (1.0 - smoothstep(0.0, 0.05, behind)) * step(-0.1, z);
    a = mix((z < -0.15 ? 0.06 : 0.25 + max(0.0, z) * 0.45) * 0.5, 0.9, pulse);
    r = mix(0.6, 1.6, pulse);
  } else {                          // hub: core (w = 4 + i/16) or breathing ring (w = 6 + i + angle/2pi)
    bool isRing = w >= 5.5;
    float i = isRing ? floor(w - 6.0) : floor((w - 4.0) * 16.0 + 0.5);
    float b = (sin(uTime * 3.0 + i) + 1.0) * 0.5;
    float vis = step(-0.05, z);
    if (isRing) {
      float ang = fract(w) * 6.2831853;
      ring = vec2(cos(ang), sin(ang)) * (4.0 + b * 7.0);
      r = 0.9;
      a = 0.5 * (1.0 - b) * (0.4 + z) * vis;
    } else {
      r = 1.4;
      a = 0.95 * vis;
    }
  }

  // while hovered the whole sculpture flows gently
  vec2 ambient = uFlowing > 0.001 ? curl(P.xy * 0.006 + uTime * vec2(0.12, -0.09)) * 10.0 * uScale * uFlowing * uLiquid : vec2(0);
  vec2 pos = P.xy + s.xy + ambient + ring;

  vec2 vel = s.zw;
  float speed = length(vel);
  float L = min(speed * 1.25, 18.0);
  vec2 dir = speed > 0.05 ? vel / speed : vec2(1, 0);
  float glint = smoothstep(2.0, 16.0, speed); // metallic glint on fast particles
  rgb = mix(rgb, uGlint, glint * 0.75);
  a = max(a, glint * 0.85);
  r *= uDot;

  float pad = r + 1.0;
  vec2 c = vec2(gl_VertexID & 1, gl_VertexID >> 1) * 2.0 - 1.0;
  float along = c.x < 0.0 ? -(L + pad) : pad;
  float across = c.y * pad;
  vec2 world = pos + dir * along + vec2(-dir.y, dir.x) * across;
  gl_Position = a < 0.004 ? vec4(2, 2, 2, 1) : vec4(world / uRes * vec2(2, -2) + vec2(-1, 1), 0, 1);
  vLocal = vec2(along, across);
  vL = L;
  vR = r;
  vColor = vec4(rgb, a);
}`;

// capsule SDF: a round head with a tail that thins and fades behind it
const FS_PARTICLE = /* glsl */ `#version 300 es
precision highp float;
uniform float uDpr;
in vec2 vLocal;
in float vL, vR;
in vec4 vColor;
out vec4 o;
void main() {
  float t = vL > 0.0 ? clamp(-vLocal.x / vL, 0.0, 1.0) : 0.0;
  float d = length(vec2(vLocal.x + t * vL, vLocal.y)) - vR * mix(1.0, 0.35, t);
  float a = vColor.a * clamp(0.5 - d * uDpr, 0.0, 1.0) * mix(1.0, 0.3, t);
  if (a < 0.004) discard;
  o = vec4(vColor.rgb * a, a); // premultiplied
}`;

/** Starts the WebGL2 globe on `canvas`. Returns its cleanup, or null (canvas removed) if WebGL2 is not usable. */
function startGlobeGL(canvas: HTMLCanvasElement, onLost: () => void): (() => void) | null {
  // failIfMajorPerformanceCaveat: no GPU (software rendering such as SwiftShader) means the 2D globe, not a 3 fps page
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, failIfMajorPerformanceCaveat: true });
  const textures: WebGLTexture[] = [];
  const framebuffers: WebGLFramebuffer[] = [];
  const programs: WebGLProgram[] = [];
  const release = () => {
    if (gl) {
      textures.forEach((t) => gl.deleteTexture(t));
      framebuffers.forEach((f) => gl.deleteFramebuffer(f));
      programs.forEach((p) => gl.deleteProgram(p));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    canvas.remove();
  };
  const fail = () => {
    release();
    return null;
  };
  if (!gl || !(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"))) return fail();
  // some browsers (headless Chrome) still hand out a software context: check the renderer name too
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  if (info && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)))) return fail();

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
    gl.deleteShader(s);
    return null;
  };
  const link = (vsSrc: string, fsSrc: string) => {
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return null;
    }
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    programs.push(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    // cache uniform locations by name
    const locs = new Map<string, WebGLUniformLocation | null>();
    const u = (name: string) => {
      if (!locs.has(name)) locs.set(name, gl.getUniformLocation(p, name));
      return locs.get(name) ?? null;
    };
    return { p, u };
  };
  const flowProg = link(VS_FULLSCREEN, FS_FLOW);
  const simProg = link(VS_FULLSCREEN, FS_SIM);
  const haloProg = link(VS_FULLSCREEN, FS_HALO);
  const drawProg = link(VS_PARTICLE, FS_PARTICLE);
  if (!flowProg || !simProg || !haloProg || !drawProg) return fail();

  // fewer particles and pixels on low-power devices
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowPower = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 || window.matchMedia("(pointer: coarse)").matches;
  // sphere dots ~3.2px apart at the globe's starting size (~40k on desktop), so it reads as fine grain, not a solid haze
  const R0 = Math.min(canvas.clientWidth || 600, canvas.clientHeight || 440) * 0.42;
  const SPHERE = Math.round(Math.min(lowPower ? 20000 : 48000, Math.max(6000, (4 * Math.PI * R0 * R0) / 3.2 ** 2)));
  const ARC_STEPS = lowPower ? 200 : 420; // samples per arc, 3 particles each
  const HUB_CORE = 16, HUB_RING = 40;

  // ---- particle data: homeTex (xyz, kind/jitter) and colTex (rgb from the theme, a = seed) ----
  const count = SPHERE + ARCS.length * (ARC_STEPS + 1) * 3 + HUBS.length * (HUB_CORE + HUB_RING);
  const rows = Math.ceil(count / TEX_W);
  const home = new Float32Array(rows * TEX_W * 4);
  const colorIndex = new Uint8Array(count); // 0 = dot colour, 1..6 = palette colour
  const seeds = new Uint8Array(count).map(() => Math.floor(Math.random() * 256));
  let n = 0;
  const put = (v: Vec, w: number, color: number) => {
    home.set([v[0], v[1], v[2], w], n * 4);
    colorIndex[n++] = color;
  };
  const jitter = (v: Vec, amount: number): Vec => [v[0] + (Math.random() - 0.5) * amount, v[1] + (Math.random() - 0.5) * amount, v[2] + (Math.random() - 0.5) * amount];
  // a little jitter breaks the lattice's moire pattern
  const spacing = Math.sqrt((4 * Math.PI) / SPHERE);
  for (const v of fibonacci(SPHERE)) {
    const [x, y, z] = jitter(v, spacing * 0.7);
    const len = Math.hypot(x, y, z);
    put([x / len, y / len, z / len], 0.85 + Math.random() * 0.3, 0);
  }
  const hubs = HUBS.map(([la, lo]) => toVec(la, lo));
  ARCS.forEach(([a, b], ai) => {
    const pts = arcPoints(hubs[a], hubs[b], ARC_STEPS);
    const phase = ai * 0.137;
    pts.forEach((v, i) => {
      const q = (((i / ARC_STEPS - phase) % 1) + 1) % 1;
      for (let k = 0; k < 3; k++) put(jitter(v, 0.005), 2 + q, 1 + (ai % PALETTE_VARS.length));
    });
  });
  hubs.forEach((v, i) => {
    const color = 1 + (i % PALETTE_VARS.length);
    for (let k = 0; k < HUB_CORE; k++) put(jitter(v, 0.012), 4 + i / 16, color);
    for (let k = 0; k < HUB_RING; k++) put(v, 6 + i + k / HUB_RING, color);
  });

  // ---- textures ----
  const texture = (internal: number, format: number, type: number, width: number, height: number, data: ArrayBufferView | null, filter: number) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, format, type, data);
    textures.push(t);
    return t;
  };
  const target = (t: WebGLTexture) => {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    framebuffers.push(f);
    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE ? f : null;
  };
  const homeTex = texture(gl.RGBA32F, gl.RGBA, gl.FLOAT, TEX_W, rows, home, gl.NEAREST);
  const colors = new Uint8Array(rows * TEX_W * 4);
  const colTex = texture(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, TEX_W, rows, colors, gl.NEAREST);
  const stateTex = [0, 1].map(() => texture(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, TEX_W, rows, null, gl.NEAREST));
  const flowTex = [0, 1].map(() => texture(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, FLOW, FLOW, null, gl.LINEAR));
  const stateFbo = stateTex.map(target);
  const flowFbo = flowTex.map(target);
  if (stateFbo.includes(null) || flowFbo.includes(null)) return fail();
  let sIdx = 0, fIdx = 0;

  const clearSim = () => {
    gl.clearColor(0, 0, 0, 0);
    stateFbo.forEach((f) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.clear(gl.COLOR_BUFFER_BIT);
    });
    gl.clearColor(MID, MID, 0, 1);
    flowFbo.forEach((f) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.clear(gl.COLOR_BUFFER_BIT);
    });
  };
  clearSim();

  // ---- theme colours: CSS tokens -> rgb via a 1x1 2D canvas (handles any CSS colour syntax) ----
  const probe = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
  const rgb = (css: string): Rgb => {
    if (!probe) return [128, 128, 128];
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = "#888";
    probe.fillStyle = css;
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  let theme = { accent: [0, 0, 0] as Rgb, rim: [0, 0, 0] as Rgb, glint: [0, 0, 0] as Rgb };
  const readColors = () => {
    const list = [rgb(cssVar("--faint")), ...PALETTE_VARS.map((v) => rgb(cssVar(v)))];
    theme = { accent: list[1], rim: rgb(cssVar("--border-strong")), glint: rgb(cssVar("--hover-gold")) };
    for (let i = 0; i < count; i++) colors.set([...list[colorIndex[i]], seeds[i]], i * 4);
    gl.bindTexture(gl.TEXTURE_2D, colTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, TEX_W, rows, gl.RGBA, gl.UNSIGNED_BYTE, colors);
  };
  readColors();

  // samplers: fixed texture units per program
  const bindUnits = (prog: { p: WebGLProgram; u: (n: string) => WebGLUniformLocation | null }, names: string[]) => {
    gl.useProgram(prog.p);
    names.forEach((name, i) => gl.uniform1i(prog.u(name), i));
  };
  bindUnits(flowProg, ["uFlow"]);
  bindUnits(simProg, ["uState", "uHome", "uCol", "uFlow"]);
  bindUnits(drawProg, ["uState", "uHome", "uCol"]);
  const bindTextures = (list: WebGLTexture[]) =>
    list.forEach((t, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
    });

  // ---- size ----
  let w = 1, h = 1, dpr = 1;
  const resize = () => {
    w = Math.max(1, canvas.clientWidth);
    h = Math.max(1, canvas.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2);
    if (w * h * dpr * dpr > 4.5e6) dpr = Math.sqrt(4.5e6 / (w * h)); // cap the canvas at ~4.5M pixels
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  };
  resize();

  // ---- interaction state ----
  let spin = 2.2;
  let velocity = REST_VELOCITY;
  let dragging = false;
  let lastX = 0;
  let hover = false;
  let releaseTimer = 0;
  const aim = { x: 0, y: 0 }; // where the pointer is
  const mouse = { x: 0, y: 0, vx: 0, vy: 0 }; // eased pointer, and its velocity in px/frame
  let presence = 0, flowing = 0, burst = 0, settle = 0, dirty = false, time = 0;
  const scale = () => Math.min(1.25, Math.max(0.6, window.innerWidth / 1400));

  const setView = (u: (n: string) => WebGLUniformLocation | null) => {
    gl.uniform2f(u("uRes"), w, h);
    gl.uniform1f(u("uSpin"), spin);
    gl.uniform1f(u("uTilt"), TILT);
    gl.uniform1f(u("uR"), Math.min(w, h) * 0.42);
  };

  const simulate = (dt: number) => {
    const radius = 220 * scale();
    gl.disable(gl.BLEND);
    // flow map
    gl.viewport(0, 0, FLOW, FLOW);
    gl.bindFramebuffer(gl.FRAMEBUFFER, flowFbo[1 - fIdx]);
    gl.useProgram(flowProg.p);
    bindTextures([flowTex[fIdx]]);
    gl.uniform2f(flowProg.u("uRes"), w, h);
    gl.uniform2f(flowProg.u("uMouse"), mouse.x, mouse.y);
    gl.uniform2f(flowProg.u("uMouseVel"), mouse.vx, mouse.vy);
    gl.uniform1f(flowProg.u("uPresence"), presence);
    gl.uniform1f(flowProg.u("uRadius"), radius);
    gl.uniform1f(flowProg.u("uDt"), dt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    fIdx = 1 - fIdx;
    // particles
    gl.viewport(0, 0, TEX_W, rows);
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateFbo[1 - sIdx]);
    gl.useProgram(simProg.p);
    bindTextures([stateTex[sIdx], homeTex, colTex, flowTex[fIdx]]);
    const u = simProg.u;
    setView(u);
    gl.uniform2f(u("uMouse"), mouse.x, mouse.y);
    gl.uniform1f(u("uPresence"), presence);
    gl.uniform1f(u("uRadius"), radius);
    gl.uniform1f(u("uStrength"), STRENGTH * (1 + 1.5 * burst)); // pointer down: a brief x2.5 burst
    gl.uniform1f(u("uSpread"), SPREAD);
    gl.uniform1f(u("uTurb"), TURBULENCE);
    gl.uniform1f(u("uReturn"), RETURN_SPEED);
    gl.uniform1f(u("uDt"), dt);
    gl.uniform1f(u("uTime"), time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    sIdx = 1 - sIdx;
  };

  const draw = () => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const R = Math.min(w, h) * 0.42;
    const unit = (c: Rgb) => c.map((x) => x / 255) as Rgb;

    gl.useProgram(haloProg.p);
    gl.uniform2f(haloProg.u("uRes"), w, h);
    gl.uniform1f(haloProg.u("uR"), R);
    gl.uniform1f(haloProg.u("uDpr"), canvas.width / w);
    gl.uniform3f(haloProg.u("uAccent"), ...unit(theme.accent));
    gl.uniform3f(haloProg.u("uRim"), ...unit(theme.rim));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(drawProg.p);
    bindTextures([stateTex[sIdx], homeTex, colTex]);
    const u = drawProg.u;
    setView(u);
    gl.uniform1f(u("uTime"), time);
    gl.uniform1f(u("uPulse"), time * 0.24);
    gl.uniform1f(u("uFlowing"), flowing);
    gl.uniform1f(u("uLiquid"), LIQUID);
    gl.uniform1f(u("uDot"), DOT_SIZE);
    gl.uniform1f(u("uSpacing"), R * spacing);
    gl.uniform1f(u("uScale"), scale());
    gl.uniform1f(u("uDpr"), canvas.width / w);
    gl.uniform3f(u("uGlint"), ...unit(theme.glint));
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
  };

  // ---- loop ----
  let raf = 0;
  let visible = true;
  let last = 0;
  const ease = (rate: number, dt: number) => 1 - Math.pow(1 - rate, dt);
  const loop = (now: number) => {
    const dt = last ? Math.min(3, Math.max(0.25, (now - last) / 16.67)) : 1;
    last = now;
    time += dt / 60;
    if (!dragging) {
      velocity += (REST_VELOCITY - velocity) * ease(0.02, dt); // ease back to the resting spin after a fling
      spin = (spin + velocity * dt) % (Math.PI * 2);
    }
    const px = mouse.x, py = mouse.y;
    mouse.x += (aim.x - mouse.x) * ease(0.22, dt);
    mouse.y += (aim.y - mouse.y) * ease(0.22, dt);
    mouse.vx = (mouse.x - px) / dt;
    mouse.vy = (mouse.y - py) / dt;
    presence += ((hover ? 1 : 0) - presence) * ease(hover ? 0.1 : 0.035, dt);
    flowing += ((hover ? 1 : 0) - flowing) * ease(hover ? 0.05 : 0.018, dt);
    burst *= Math.pow(0.9, dt);

    // simulate only while interacting or settling; at rest the globe just spins
    if (hover || presence > 0.01) settle = SETTLE_FRAMES;
    else settle -= dt;
    if (settle > 0) {
      simulate(dt);
      dirty = true;
    } else if (dirty) {
      clearSim(); // snap the last sub-pixel offsets back to the crisp globe
      dirty = false;
    }
    draw();
    raf = visible ? requestAnimationFrame(loop) : 0;
  };
  const stopVisible = whileVisible(canvas, (v) => {
    visible = v;
    if (v && !raf) {
      last = 0;
      raf = requestAnimationFrame(loop);
    }
  });
  const ro = new ResizeObserver(() => {
    resize();
    draw();
  });
  ro.observe(canvas);
  const stopTheme = onThemeChange(() => {
    readColors();
    draw();
  });

  // ---- pointer: mouse hover liquefies, drag spins, press bursts; touch acts while pressed, releasing 260ms after ----
  const toLocal = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    aim.x = e.clientX - r.left;
    aim.y = e.clientY - r.top;
  };
  const enter = (e: PointerEvent) => {
    toLocal(e);
    if (!hover && presence < 0.01) Object.assign(mouse, { x: aim.x, y: aim.y }); // no swipe in from the last position
    hover = true;
  };
  const onDown = (e: PointerEvent) => {
    window.clearTimeout(releaseTimer);
    enter(e);
    burst = 1;
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse" || e.pointerType === "pen") enter(e);
    else if (dragging) toLocal(e);
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    velocity = dx * 0.006;
    spin += velocity;
  };
  const onUp = (e: PointerEvent) => {
    dragging = false;
    if (e.pointerType === "touch") releaseTimer = window.setTimeout(() => (hover = false), 260);
  };
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType !== "touch" && !dragging) hover = false;
  };
  const onContextLost = (e: Event) => {
    e.preventDefault();
    onLost();
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("webglcontextlost", onContextLost);

  draw();
  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(releaseTimer);
    stopVisible();
    stopTheme();
    ro.disconnect();
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    release();
  };
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Canvas 2D fallback (the original globe, ~1,100 dots)                                                                */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Starts the Canvas 2D globe on `canvas` and returns its cleanup. Under reduced motion it draws one still frame. */
function startGlobe2D(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return () => {};
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const dots = fibonacci(1100);
  const hubs = HUBS.map(([la, lo]) => toVec(la, lo));
  const arcs = ARCS.map(([a, b]) => arcPoints(hubs[a], hubs[b]));

  let colors = { dot: "#888", accent: "#7a5800", rim: "#ccc", palette: ["#7a5800"] };
  const readColors = () => {
    // hubs and arcs cycle through the data palette, so the globe carries the same colours as the rest of the UI
    colors = { dot: cssVar("--faint"), accent: cssVar("--accent"), rim: cssVar("--border-strong"), palette: PALETTE_VARS.map(cssVar) };
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

  let spin = 2.2;
  let velocity = reduce ? 0 : REST_VELOCITY;
  const baseVelocity = velocity;
  let dragging = false;
  let lastX = 0;

  const project = (v: Vec, R: number, cx: number, cy: number) => {
    const cosA = Math.cos(spin), sinA = Math.sin(spin), cosT = Math.cos(TILT), sinT = Math.sin(TILT);
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
    raf = visible ? requestAnimationFrame(loop) : 0;
  };
  const stopVisible = whileVisible(canvas, (v) => {
    visible = v;
    if (v && !raf && !reduce) raf = requestAnimationFrame(loop);
  });
  const ro = new ResizeObserver(() => {
    resize();
    draw();
  });
  ro.observe(canvas);
  const stopTheme = onThemeChange(() => {
    readColors();
    draw();
  });

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
  return () => {
    cancelAnimationFrame(raf);
    stopVisible();
    stopTheme();
    ro.disconnect();
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.remove();
  };
}
