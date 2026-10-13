import { GENERATORS, renderSpecimen } from "./specimens.js";

const root = document.documentElement;
const body = document.body;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
const pad3 = (n) => String(n).padStart(3, "0");

// ---------- Letter-by-letter title reveal ----------
document.querySelectorAll(".split").forEach((el) => {
  const text = el.textContent;
  el.setAttribute("aria-label", text);
  el.textContent = "";
  for (const c of text) {
    const s = document.createElement("span");
    s.className = "ch";
    s.setAttribute("aria-hidden", "true");
    s.textContent = c;
    s.style.transitionDelay = `${0.15 + Math.random() * 0.7}s`;
    el.append(s);
  }
});

// ---------- Clock ----------
const clock = $("clock");
const tickClock = () => {
  const d = new Date();
  clock.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
tickClock();
setInterval(tickClock, 10000);

// ---------- Sound (generated with Web Audio, off until the visitor asks) ----------
const sound = (() => {
  let ctx, master, on = false;
  const scale = [220, 246.9, 293.7, 329.6, 392, 440, 493.9, 587.3];

  const start = () => {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // Low drone: two detuned sines through a slowly breathing filter
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 420; filter.Q.value = 6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(filter.frequency); lfo.start();
    for (const [f, g] of [[55, 0.22], [82.6, 0.12], [110.4, 0.05]]) {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const gn = ctx.createGain(); gn.gain.value = g;
      o.connect(gn).connect(filter); o.start();
    }
    filter.connect(master);
  };

  const fade = (to) => {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(to, t, 0.4);
  };

  return {
    get on() { return on; },
    toggle() {
      if (!ctx) start();
      on = !on;
      if (on) ctx.resume();
      fade(on ? 0.5 : 0);
      return on;
    },
    blip(i = 0) {
      if (!on) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = "triangle";
      o.frequency.value = scale[i % scale.length] * 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.4);
    },
    sweep() {
      if (!on) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = "sawtooth";
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(1400, t + 0.25);
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 8; f.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + 0.32);
    },
  };
})();

const soundBtn = $("sound");
soundBtn.addEventListener("click", () => {
  const on = sound.toggle();
  soundBtn.setAttribute("aria-pressed", on);
  soundBtn.querySelector(".sound-label").textContent = on ? "Sound on" : "Sound off";
});

// ---------- Views: Specimens / Index / Contact ----------
const VIEWS = ["specimens", "index", "contact"];
const setView = (view, push = true) => {
  if (!VIEWS.includes(view)) view = "specimens";
  body.dataset.view = view;
  document.querySelectorAll(".pill-item").forEach((b) => {
    b.toggleAttribute("aria-current", b.dataset.view === view);
    if (b.dataset.view === view) b.setAttribute("aria-current", "true");
  });
  if (push) history.replaceState(null, "", view === "specimens" ? location.pathname : `#${view}`);
  sound.blip(VIEWS.indexOf(view) + 2);
};
document.querySelectorAll("[data-view]").forEach((el) => {
  if (el === body) return;
  el.addEventListener("click", (e) => { e.preventDefault(); setView(el.dataset.view); });
});
setView(location.hash.slice(1), false);

// ---------- Specimen cloud ----------
const stage = $("stage");
const label = $("cursorLabel");
const hudCount = $("hudCount");
const small = () => innerWidth < 640;
const COUNT = small() ? 14 : 22;
const ASPECTS = [
  { name: "Portrait", r: 0.78 },
  { name: "Square", r: 1 },
  { name: "Landscape", r: 1.32 },
  { name: "Tall", r: 0.62 },
];

const tiles = [];
const order = [...GENERATORS.keys()].sort(() => Math.random() - 0.5);
for (let i = 0; i < COUNT; i++) {
  // Points spread evenly over a sphere, then nudged so it feels organic
  const y = 1 - ((i + 0.5) / COUNT) * 2;
  const rad = Math.sqrt(1 - y * y);
  const th = i * Math.PI * (3 - Math.sqrt(5));
  const j = () => (Math.random() - 0.5) * 0.25;
  tiles.push({
    i,
    gi: order[i % order.length],
    seed: Math.floor(Math.random() * 1e6),
    aspect: ASPECTS[Math.floor(Math.random() * ASPECTS.length)],
    size: 0.75 + Math.random() * 0.5,
    p: [Math.cos(th) * rad + j(), y * 0.9 + j(), Math.sin(th) * rad + j()],
    variant: null,
    mutations: 0,
  });
}

const tileDims = (t) => {
  const base = (small() ? 50 : 70) * t.size;
  const w = t.aspect.r >= 1 ? base * t.aspect.r : base;
  const h = t.aspect.r >= 1 ? base : base / t.aspect.r;
  return [w, h];
};

const buildTile = (t) => {
  const el = document.createElement("button");
  el.className = "tile";
  el.innerHTML = "<canvas></canvas>";
  const name = GENERATORS[t.gi].name;
  el.setAttribute("aria-label", `Specimen ${pad3(t.i + 1)}: ${name}. Open to inspect.`);
  t.el = el;
  t.canvas = el.firstChild;
  const [w, h] = tileDims(t);
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  t.w = w; t.h = h;
  // Draw at extra resolution so tiles stay sharp when they float close
  t.variant = renderSpecimen(t.canvas, t.gi, t.seed, w, h, Math.min(devicePixelRatio || 1, 2) * 1.5);
  stage.append(el);
};

const cam = { yaw: 0, pitch: -0.18, vyaw: 0, vpitch: 0, zoom: 1, zoomTarget: 1, px: 0, py: 0 };
let R, cx, cy;
const layout = () => {
  R = Math.min(innerWidth, innerHeight) * (small() ? 0.4 : 0.34);
  cx = innerWidth / 2;
  cy = innerHeight / 2 + (small() ? -30 : 0);
  for (const t of tiles) {
    if (!t.el) continue;
    const [w, h] = tileDims(t);
    t.w = w; t.h = h;
    t.el.style.width = `${w}px`;
    t.el.style.height = `${h}px`;
  }
};
layout();
addEventListener("resize", layout);

let hovered = null;
const render = () => {
  const yaw = cam.yaw + cam.px * 0.25;
  const pitch = cam.pitch + cam.py * 0.15;
  const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const D = 3.4;
  const r = R * cam.zoom;
  for (const t of tiles) {
    if (!t.el) continue;
    let [x, y, z] = t.p;
    // Rotate around Y (yaw), then X (pitch)
    [x, z] = [x * cyaw - z * syaw, x * syaw + z * cyaw];
    [y, z] = [y * cp - z * sp, y * sp + z * cp];
    const s = D / (D - z);
    const sx = cx + x * r * s - (t.w * s) / 2;
    const sy = cy + y * r * s - (t.h * s) / 2;
    t.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
    t.el.style.opacity = (0.3 + 0.7 * ((z + 1.2) / 2.4)).toFixed(3);
    t.el.style.zIndex = Math.round((z + 2) * 100);
  }
};

const AUTO = reduceMotion ? 0 : 0.0016;
let dragging = false;
const loop = () => {
  if (!dragging) {
    cam.yaw += AUTO + cam.vyaw;
    cam.pitch += cam.vpitch;
    cam.vyaw *= 0.94;
    cam.vpitch *= 0.94;
  }
  cam.pitch = Math.max(-1.1, Math.min(1.1, cam.pitch));
  cam.zoom += (cam.zoomTarget - cam.zoom) * 0.08;
  render();
  requestAnimationFrame(loop);
};

// Drag to orbit; a click without movement opens a specimen
let down = null;
stage.addEventListener("pointerdown", (e) => {
  down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0, tile: e.target.closest(".tile") };
  dragging = true;
  stage.classList.add("dragging");
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener("pointermove", (e) => {
  cam.px = (e.clientX / innerWidth - 0.5);
  cam.py = (e.clientY / innerHeight - 0.5);
  if (down) {
    const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
    down.moved += Math.abs(dx) + Math.abs(dy);
    down.lx = e.clientX; down.ly = e.clientY;
    cam.yaw += dx * 0.006; cam.pitch -= dy * 0.004;
    cam.vyaw = reduceMotion ? 0 : dx * 0.0012;
    cam.vpitch = reduceMotion ? 0 : -dy * 0.0008;
  }
  const tile = down ? null : e.target.closest(".tile");
  if (tile !== hovered?.el) {
    hovered = tiles.find((t) => t.el === tile) || null;
    if (hovered) {
      label.innerHTML = `<b>${pad3(hovered.i + 1)}</b>${GENERATORS[hovered.gi].name}`;
      hudCount.textContent = pad3(hovered.i + 1);
      sound.blip(hovered.i);
    } else {
      hudCount.textContent = pad3(tiles.length);
    }
    label.classList.toggle("on", !!hovered);
  }
  label.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
});
const endDrag = () => {
  if (down && down.moved < 6 && down.tile) openViewer(tiles.find((t) => t.el === down.tile));
  down = null;
  dragging = false;
  stage.classList.remove("dragging");
};
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", () => { down = null; dragging = false; stage.classList.remove("dragging"); });
stage.addEventListener("pointerleave", () => { label.classList.remove("on"); hovered = null; });
stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  cam.zoomTarget = Math.max(0.55, Math.min(1.7, cam.zoomTarget * (1 - e.deltaY * 0.0012)));
}, { passive: false });
// Keyboard: Enter/Space on a focused tile opens it
stage.addEventListener("keydown", (e) => {
  const tile = e.target.closest(".tile");
  if (tile && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    openViewer(tiles.find((t) => t.el === tile));
  }
});

// ---------- Viewer ----------
const viewer = $("viewer");
const vCanvas = $("viewerCanvas");
let current = null, lastFocus = null;

const drawViewer = () => {
  const t = current;
  const gen = GENERATORS[t.gi];
  const maxH = small() ? innerHeight * 0.5 : Math.min(innerHeight - 220, 620);
  const maxW = small() ? innerWidth - 32 : innerWidth - 300 - 140;
  let h = maxH, w = h * t.aspect.r;
  if (w > maxW) { w = maxW; h = w / t.aspect.r; }
  t.variant = renderSpecimen(vCanvas, t.gi, t.seed, w, h, Math.min(devicePixelRatio || 1, 2));
  vCanvas.style.width = `${w}px`;
  vCanvas.style.height = `${h}px`;
  $("vId").textContent = `Specimen ${pad3(t.i + 1)}`;
  $("vName").textContent = gen.name;
  $("vNote").textContent = gen.note;
  $("vSeed").textContent = t.seed;
  $("vVariant").textContent = t.variant ? `${t.variant} · ${t.aspect.name}` : t.aspect.name;
  $("vMut").textContent = t.mutations;
};

function openViewer(t) {
  if (!t) return;
  current = t;
  lastFocus = document.activeElement;
  viewer.hidden = false;
  drawViewer();
  sound.sweep();
  $("vMutate").focus();
}
const closeViewer = () => {
  viewer.hidden = true;
  current = null;
  lastFocus?.focus?.();
};
$("vClose").addEventListener("click", closeViewer);
viewer.addEventListener("click", (e) => { if (e.target === viewer || e.target.classList.contains("viewer-art")) closeViewer(); });
$("vMutate").addEventListener("click", () => {
  current.seed = Math.floor(Math.random() * 1e6);
  current.mutations++;
  drawViewer();
  // Update the floating tile too, so the mutation persists in the cloud
  renderSpecimen(current.canvas, current.gi, current.seed, current.w, current.h, Math.min(devicePixelRatio || 1, 2) * 1.5);
  vCanvas.style.animation = "none";
  void vCanvas.offsetWidth;
  vCanvas.style.animation = "";
  sound.sweep();
});

addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!viewer.hidden) closeViewer();
    else if (body.dataset.view !== "specimens") setView("specimens");
  }
  if (!viewer.hidden || e.target.closest("input, textarea")) return;
  if (e.key === "1" || e.key === "2" || e.key === "3") setView(VIEWS[+e.key - 1]);
  if (e.key.toLowerCase() === "m" && current) $("vMutate").click();
});

// ---------- Loading: grow the specimens, count up while they appear ----------
const loadCount = $("loadCount");
let built = 0;
const grow = () => {
  // Build tiles in small time-boxed chunks so the page stays responsive
  const t0 = performance.now();
  while (built < tiles.length && performance.now() - t0 < 12) buildTile(tiles[built++]);
  if (built < tiles.length) setTimeout(grow, 0);
};
grow();

const MIN_LOAD = reduceMotion ? 0 : 1400;
const loadStart = performance.now();
const finish = () => {
  loadCount.textContent = "100";
  hudCount.textContent = pad3(tiles.length);
  setTimeout(() => root.classList.add("loaded"), 200);
};
const count = (now) => {
  const p = Math.min(built / tiles.length, (now - loadStart) / MIN_LOAD);
  loadCount.textContent = pad3(Math.floor(p * 100));
  if (p < 1) requestAnimationFrame(count);
  else finish();
};
// Hidden tabs don't run animation frames; skip the count-up there
if (document.hidden) setTimeout(function wait() { built < tiles.length ? setTimeout(wait, 50) : finish(); }, 0);
else requestAnimationFrame(count);
render();
requestAnimationFrame(loop);
