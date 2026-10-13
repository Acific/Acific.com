import { GENERATORS, renderSpecimen } from "./specimens.js";

const root = document.documentElement;
const body = document.body;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;
const $ = (id) => document.getElementById(id);
const pad3 = (n) => String(n).padStart(3, "0");
const small = () => innerWidth < 640;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const TAU = Math.PI * 2;

// ---------- Text effects ----------
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

// Characters flicker through glyphs before settling on the real text
const GLYPHS = "▖▘▝▗▚▞▌▐░▒▓/\\|+*#%<>";
const scrambling = new WeakMap();
function scramble(el, text, dur = 420) {
  if (reduceMotion) { el.textContent = text; return; }
  cancelAnimationFrame(scrambling.get(el));
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const n = Math.floor(p * text.length);
    let out = text.slice(0, n);
    for (let i = n; i < text.length; i++) out += text[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    el.textContent = out;
    if (p < 1) scrambling.set(el, requestAnimationFrame(step));
  };
  scrambling.set(el, requestAnimationFrame(step));
}
document.querySelectorAll(".pill-item .pl").forEach((el) => {
  const text = el.textContent;
  el.closest("button").addEventListener("pointerenter", () => scramble(el, text, 300));
});

// ---------- Clock ----------
const clock = $("clock");
const tickClock = () => {
  const d = new Date();
  clock.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
tickClock();
setInterval(tickClock, 10000);

// ---------- Sound (generated with Web Audio, only after the visitor opts in) ----------
const sound = (() => {
  let ctx, master, noise, on = false;
  const scale = [220, 246.9, 293.7, 329.6, 392, 440, 493.9, 587.3];

  const start = () => {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // Low drone: detuned sines through a slowly breathing filter
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 420; filter.Q.value = 6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(filter.frequency); lfo.start();
    for (const [f, g] of [[55, 0.22], [82.6, 0.12], [110.4, 0.05]]) {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const gn = ctx.createGain(); gn.gain.value = g;
      o.connect(gn).connect(filter); o.start();
    }
    filter.connect(master);

    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };

  const env = (g, peak, attack, release) => {
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    return t + attack + release + 0.05;
  };

  return {
    get on() { return on; },
    set(next) {
      if (!ctx) start();
      on = next;
      if (on) ctx.resume();
      master.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.4);
      return on;
    },
    blip(i = 0) {
      if (!on) return;
      const o = ctx.createOscillator(); o.type = "triangle";
      o.frequency.value = scale[Math.abs(i) % scale.length] * 2;
      const g = ctx.createGain();
      o.connect(g).connect(master); o.start(); o.stop(env(g, 0.06, 0.008, 0.35));
    },
    sweep() {
      if (!on) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = "sawtooth";
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(1400, t + 0.25);
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 8; f.frequency.value = 900;
      const g = ctx.createGain();
      o.connect(f).connect(g).connect(master); o.start(); o.stop(env(g, 0.05, 0.005, 0.3));
    },
    whoosh() {
      if (!on) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.5;
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(2400, t + 0.6);
      f.frequency.exponentialRampToValueAtTime(500, t + 1.3);
      const g = ctx.createGain();
      src.connect(f).connect(g).connect(master); src.start(); src.stop(env(g, 0.09, 0.4, 1));
    },
  };
})();

const soundBtn = $("sound");
const setSound = (on) => {
  sound.set(on);
  soundBtn.setAttribute("aria-pressed", on);
  scramble(soundBtn.querySelector(".sound-label"), on ? "Sound on" : "Sound off", 300);
};
soundBtn.addEventListener("click", () => setSound(!sound.on));

// ---------- Views: Specimens / Index / Contact ----------
const VIEWS = ["specimens", "index", "contact"];
const setView = (view, push = true) => {
  if (!VIEWS.includes(view)) view = "specimens";
  body.dataset.view = view;
  document.querySelectorAll(".pill-item").forEach((b) => {
    if (b.dataset.view === view) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  });
  if (push) history.replaceState(null, "", view === "specimens" ? location.pathname : `#${view}`);
  sound.blip(VIEWS.indexOf(view) + 2);
};
document.querySelectorAll("[data-view]").forEach((el) => {
  if (el === body) return;
  el.addEventListener("click", (e) => { e.preventDefault(); setView(el.dataset.view); });
});
setView(location.hash.slice(1), false);

// ---------- Specimens ----------
const stage = $("stage");
const label = $("cursorLabel");
const hudCount = $("hudCount");
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
    sphere: [Math.cos(th) * rad + j(), y * 0.9 + j(), Math.sin(th) * rad + j()],
    scatter: [(Math.random() - 0.5) * 3.4, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 2.2],
    cur: [0, 0, 0, 0], from: [0, 0, 0, 0], to: [0, 0, 0, 0], t0: 0,
    h: 0, blur: 0, mutations: 0,
  });
}

const tileDims = (t) => {
  const base = (small() ? 50 : 70) * t.size;
  return t.aspect.r >= 1 ? [base * t.aspect.r, base] : [base, base / t.aspect.r];
};
const tileRes = () => Math.min(devicePixelRatio || 1, 2) * 1.8;

const buildTile = (t) => {
  const el = document.createElement("button");
  el.className = "tile";
  el.innerHTML = "<canvas></canvas>";
  el.setAttribute("aria-label", `Specimen ${pad3(t.i + 1)}: ${GENERATORS[t.gi].name}. Open to inspect.`);
  t.el = el;
  t.canvas = el.firstChild;
  [t.w, t.h0] = tileDims(t);
  el.style.width = `${t.w}px`;
  el.style.height = `${t.h0}px`;
  el.style.transform = "scale(0)";
  t.variant = renderSpecimen(t.canvas, t.gi, t.seed, t.w, t.h0, tileRes());
  stage.append(el);
};

// ---------- Formations: the same tiles rearranged ----------
const FORMS = ["Sphere", "Helix", "Grid", "Ring", "Strip", "Scatter"];
const AUTO_FORMS = ["Sphere", "Helix", "Ring", "Grid", "Scatter"];
let form = null;
let formChangedAt = 0;

const stripGap = () => (small() ? 0.78 : 0.62);
function target(name, t) {
  const N = tiles.length, i = t.i;
  switch (name) {
    case "Helix": {
      const k = i / (N - 1), a = k * TAU * 2.1;
      return [Math.cos(a) * 0.8, (k - 0.5) * 1.6, Math.sin(a) * 0.8, 1];
    }
    case "Grid": {
      const cols = small() ? 3 : Math.ceil(Math.sqrt(N * 1.8));
      const rows = Math.ceil(N / cols);
      const c = i % cols, r = Math.floor(i / cols);
      const gx = small() ? 0.62 : 0.5, gy = small() ? 0.5 : 0.55;
      return [(c - (cols - 1) / 2) * gx, (r - (rows - 1) / 2) * gy, 0, 1.1];
    }
    case "Ring": {
      const a = (i / N) * TAU;
      return [Math.cos(a) * 1.15, Math.sin(a * 2) * 0.12, Math.sin(a) * 1.15, 1];
    }
    case "Strip":
      return [(i - (N - 1) / 2) * stripGap(), small() ? 0.1 : 0.34, 0, 1.6];
    case "Scatter":
      return [...t.scatter, 0.9];
    default:
      return [...t.sphere, 1];
  }
}

const formsEl = $("forms");
FORMS.forEach((name) => {
  const b = document.createElement("button");
  b.textContent = name;
  b.dataset.form = name;
  b.addEventListener("click", () => {
    // On phones only the current form is shown; tapping it cycles
    setForm(small() && name === form ? FORMS[(FORMS.indexOf(form) + 1) % FORMS.length] : name);
  });
  formsEl.append(b);
});

const strip = { x: 0, target: 0 };
function setForm(name) {
  if (name === form) return;
  form = name;
  formChangedAt = performance.now();
  const now = performance.now();
  [...tiles].sort(() => Math.random() - 0.5).forEach((t, k) => {
    t.from = [...t.cur];
    t.to = target(name, t);
    t.t0 = now + (reduceMotion ? 0 : k * 28);
  });
  if (name !== "Strip") strip.target = 0;
  formsEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.form === name));
  body.dataset.form = name.toLowerCase();
  sound.whoosh();
}
const nextForm = (list = FORMS) => setForm(list[(list.indexOf(form) + 1) % list.length]);

// ---------- Camera and rendering ----------
const cam = { yaw: 0, pitch: -0.18, vyaw: 0, vpitch: 0, zoom: 0.45, zoomTarget: 0.45, px: 0, py: 0, pxs: 0, pys: 0 };
let R, cx, cy;
const layout = () => {
  R = Math.min(innerWidth, innerHeight) * (small() ? 0.4 : 0.34);
  cx = innerWidth / 2;
  cy = innerHeight / 2 + (small() ? -30 : 0);
};
layout();
addEventListener("resize", layout);

let hovered = null;
let current = null;
const DUR = reduceMotion ? 1 : 1500;
const D = 3.4;

const render = (now) => {
  const yaw = cam.yaw + cam.pxs * 0.3;
  const pitch = cam.pitch + cam.pys * 0.18;
  const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const r = R * cam.zoom;
  const allowBlur = !small() && !reduceMotion;
  for (const t of tiles) {
    if (!t.el) continue;
    const e = ease(clamp((now - t.t0) / DUR, 0, 1));
    for (let k = 0; k < 4; k++) t.cur[k] = t.from[k] + (t.to[k] - t.from[k]) * e;
    t.h += ((hovered === t ? 1 : 0) - t.h) * 0.15;

    let [x, y, z, s0] = t.cur;
    x -= strip.x;
    [x, z] = [x * cyaw - z * syaw, x * syaw + z * cyaw];
    [y, z] = [y * cp - z * sp, y * sp + z * cp];
    const persp = D / (D - z);
    const s = persp * s0 * (1 + t.h * 0.1);
    const sx = cx + x * r * persp - (t.w * s) / 2;
    const sy = cy + y * r * persp - (t.h0 * s) / 2;
    t.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
    t.el.style.opacity = clamp(0.3 + 0.7 * ((z + 1.3) / 2), 0.3, 1).toFixed(3);
    t.el.style.zIndex = Math.round((z + 2) * 100);
    // Depth of field: tiles at the back go soft, in half-pixel steps
    const b = allowBlur ? Math.round(clamp((-z - 0.25) * 2.4, 0, 3) * 2) / 2 : 0;
    if (b !== t.blur) { t.blur = b; t.el.style.filter = b ? `blur(${b}px)` : ""; }
  }
};

// ---------- Custom cursor ----------
const cur = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 };
const dot = $("curDot"), ring = $("curRing");
// Hidden until the pointer first moves, so it never sits stranded mid-screen
if (finePointer) root.classList.add("custom-cursor", "c-out");
addEventListener("pointermove", (e) => {
  if (root.classList.contains("c-out")) { cur.rx = e.clientX; cur.ry = e.clientY; root.classList.remove("c-out"); }
  cur.x = e.clientX; cur.y = e.clientY;
  if (finePointer) dot.style.transform = `translate(${cur.x}px, ${cur.y}px)`;
  const over = e.target.closest?.("a, button:not(.tile)");
  root.classList.toggle("c-link", !!over);
  root.classList.toggle("c-stage", !over && !!e.target.closest?.(".stage"));
}, { passive: true });
document.addEventListener("pointerleave", () => root.classList.add("c-out"));
document.addEventListener("pointerenter", () => root.classList.remove("c-out"));

// ---------- Interaction: orbit, zoom, scroll the strip ----------
const AUTO = reduceMotion ? 0 : 0.0016;
let dragging = false;
let down = null;
let lastInput = performance.now();
for (const ev of ["pointermove", "pointerdown", "wheel", "keydown"]) {
  addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true });
}
const stripLimit = () => ((tiles.length - 1) / 2) * stripGap();

stage.addEventListener("pointerdown", (e) => {
  down = { lx: e.clientX, ly: e.clientY, moved: 0, tile: e.target.closest(".tile") };
  dragging = true;
  root.classList.add("c-drag");
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener("pointermove", (e) => {
  cam.px = e.clientX / innerWidth - 0.5;
  cam.py = e.clientY / innerHeight - 0.5;
  if (down) {
    const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
    down.moved += Math.abs(dx) + Math.abs(dy);
    down.lx = e.clientX; down.ly = e.clientY;
    if (form === "Strip") {
      strip.target = clamp(strip.target - dx / (R * cam.zoom), -stripLimit(), stripLimit());
    } else {
      cam.yaw += dx * 0.006; cam.pitch -= dy * 0.004;
      cam.vyaw = reduceMotion ? 0 : dx * 0.0012;
      cam.vpitch = reduceMotion ? 0 : -dy * 0.0008;
    }
  }
  const tile = down ? null : e.target.closest(".tile");
  if (tile !== hovered?.el) {
    hovered = tiles.find((t) => t.el === tile) || null;
    root.classList.toggle("c-tile", !!hovered);
    if (hovered) {
      label.innerHTML = `<b>${pad3(hovered.i + 1)}</b><span></span>`;
      scramble(label.lastChild, GENERATORS[hovered.gi].name, 320);
      scramble(hudCount, pad3(hovered.i + 1), 250);
      sound.blip(hovered.i);
    } else {
      scramble(hudCount, pad3(tiles.length), 250);
    }
    label.classList.toggle("on", !!hovered);
  }
  label.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 16}px)`;
});
const endDrag = () => {
  if (down && down.moved < 6 && down.tile) openViewer(tiles.find((t) => t.el === down.tile));
  down = null;
  dragging = false;
  root.classList.remove("c-drag");
};
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", () => { down = null; dragging = false; root.classList.remove("c-drag"); });
stage.addEventListener("pointerleave", () => {
  label.classList.remove("on");
  root.classList.remove("c-tile");
  hovered = null;
});
stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (form === "Strip") {
    strip.target = clamp(strip.target + (e.deltaY + e.deltaX) * 0.0025, -stripLimit(), stripLimit());
  } else {
    cam.zoomTarget = clamp(cam.zoomTarget * (1 - e.deltaY * 0.0012), 0.55, 1.7);
  }
}, { passive: false });
stage.addEventListener("keydown", (e) => {
  const tile = e.target.closest(".tile");
  if (tile && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    openViewer(tiles.find((t) => t.el === tile));
  }
});

// ---------- Viewer: the tile flies out of the cloud ----------
const viewer = $("viewer");
const vCanvas = $("viewerCanvas");
let lastFocus = null;

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
  scramble($("vId"), `Specimen ${pad3(t.i + 1)}`, 300);
  $("vName").textContent = gen.name;
  $("vNote").textContent = gen.note;
  scramble($("vSeed"), String(t.seed), 300);
  $("vVariant").textContent = t.variant ? `${t.variant} · ${t.aspect.name}` : t.aspect.name;
  $("vMut").textContent = t.mutations;
};

// Animate the viewer canvas between its own box and a tile's box
const flip = (tileRect, canvasRect, opts, reverse = false) => {
  const k = {
    transform: `translate(${tileRect.left - canvasRect.left}px, ${tileRect.top - canvasRect.top}px) scale(${tileRect.width / canvasRect.width}, ${tileRect.height / canvasRect.height})`,
    transformOrigin: "0 0",
  };
  const none = { transform: "none", transformOrigin: "0 0" };
  return vCanvas.animate(reverse ? [none, k] : [k, none], opts);
};

function openViewer(t) {
  if (!t || current) return;
  current = t;
  lastFocus = document.activeElement;
  viewer.hidden = false;
  drawViewer();
  const from = t.el.getBoundingClientRect();
  t.el.classList.add("away");
  void viewer.offsetWidth; // commit the hidden state so the reveal transitions
  viewer.classList.add("open");
  if (!reduceMotion) flip(from, vCanvas.getBoundingClientRect(), { duration: 800, easing: "cubic-bezier(.16,1,.3,1)" });
  sound.sweep();
  $("vMutate").focus({ preventScroll: true });
}
const closeViewer = async () => {
  if (!current) return;
  const t = current;
  viewer.classList.remove("open");
  if (!reduceMotion) {
    await flip(t.el.getBoundingClientRect(), vCanvas.getBoundingClientRect(),
      { duration: 600, easing: "cubic-bezier(.7,0,.2,1)", fill: "forwards" }, true).finished;
  }
  viewer.hidden = true;
  vCanvas.getAnimations().forEach((a) => a.cancel());
  t.el.classList.remove("away");
  current = null;
  lastFocus?.focus?.({ preventScroll: true });
};
$("vClose").addEventListener("click", closeViewer);
viewer.addEventListener("click", (e) => {
  if (e.target === viewer || e.target.classList.contains("viewer-art")) closeViewer();
});
$("vMutate").addEventListener("click", () => {
  current.seed = Math.floor(Math.random() * 1e6);
  current.mutations++;
  drawViewer();
  // Keep the mutation: redraw the floating tile as well
  renderSpecimen(current.canvas, current.gi, current.seed, current.w, current.h0, tileRes());
  if (!reduceMotion) vCanvas.animate([{ filter: "invert(1)", opacity: 0.6 }, { filter: "none", opacity: 1 }], { duration: 380, easing: "ease-out" });
  sound.sweep();
});

// ---------- Index: hovering an entry grows a matching specimen at the cursor ----------
const peek = $("peek");
const peekCanvas = peek.querySelector("canvas");
const pk = { x: 0, y: 0 };
if (finePointer) {
  document.querySelectorAll("[data-gen]").forEach((li) => {
    li.addEventListener("pointerenter", () => {
      renderSpecimen(peekCanvas, +li.dataset.gen, Math.floor(Math.random() * 1e6), 132, 168, Math.min(devicePixelRatio || 1, 2));
      peek.classList.add("on");
      sound.blip(+li.dataset.gen);
    });
    li.addEventListener("pointerleave", () => peek.classList.remove("on"));
  });
}

// ---------- Keyboard ----------
addEventListener("keydown", (e) => {
  if (!root.classList.contains("loaded")) {
    if (e.key === "Enter" && root.classList.contains("ready")) enter(false);
    return;
  }
  if (e.key === "Escape") {
    if (current) closeViewer();
    else if (body.dataset.view !== "specimens") setView("specimens");
    return;
  }
  if (current) {
    if (e.key.toLowerCase() === "m") $("vMutate").click();
    return;
  }
  if (["1", "2", "3"].includes(e.key)) setView(VIEWS[+e.key - 1]);
  if (e.key.toLowerCase() === "f") nextForm();
  if (form === "Strip" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    strip.target = clamp(strip.target + (e.key === "ArrowRight" ? 1 : -1) * stripGap(), -stripLimit(), stripLimit());
  }
});

// ---------- Main loop ----------
let entered = false;
const loop = (now) => {
  if (!dragging) {
    if (form === "Strip" || form === "Grid") {
      // Face the camera: ease back to the nearest full turn
      const goal = Math.round(cam.yaw / TAU) * TAU + (form === "Grid" && !reduceMotion ? Math.sin(now * 0.0004) * 0.35 : 0);
      cam.yaw += (goal - cam.yaw) * 0.05;
      cam.pitch += ((form === "Grid" ? -0.08 : 0) - cam.pitch) * 0.05;
      cam.vyaw = cam.vpitch = 0;
    } else {
      cam.yaw += AUTO + cam.vyaw;
      cam.pitch += cam.vpitch;
      cam.vyaw *= 0.94;
      cam.vpitch *= 0.94;
      const pitchGoal = form === "Ring" ? -0.5 : form === "Helix" ? -0.1 : null;
      if (pitchGoal !== null) cam.pitch += (pitchGoal - cam.pitch) * 0.02;
    }
  }
  cam.pitch = clamp(cam.pitch, -1.1, 1.1);
  cam.zoom += (cam.zoomTarget - cam.zoom) * 0.05;
  cam.pxs += (cam.px - cam.pxs) * 0.05;
  cam.pys += (cam.py - cam.pys) * 0.05;
  strip.x += (strip.target - strip.x) * 0.08;

  // Left alone for a while, the lab rearranges itself
  if (entered && !reduceMotion && !current && body.dataset.view === "specimens" && form !== "Strip" &&
      now - lastInput > 14000 && now - formChangedAt > 14000) {
    nextForm(AUTO_FORMS);
  }

  if (finePointer) {
    cur.rx += (cur.x - cur.rx) * 0.18;
    cur.ry += (cur.y - cur.ry) * 0.18;
    ring.style.transform = `translate(${cur.rx}px, ${cur.ry}px)`;
    pk.x += (cur.x - pk.x) * 0.2;
    pk.y += (cur.y - pk.y) * 0.2;
    peek.style.transform = `translate(${pk.x + 48}px, ${pk.y - 84}px)`;
  }
  render(now);
  requestAnimationFrame(loop);
};

// ---------- Loading, then a gate to enter (with or without sound) ----------
const loadCount = $("loadCount");
let built = 0;
const grow = () => {
  const t0 = performance.now();
  while (built < tiles.length && performance.now() - t0 < 12) buildTile(tiles[built++]);
  if (built < tiles.length) setTimeout(grow, 0);
};
grow();

const MIN_LOAD = reduceMotion ? 0 : 1600;
const loadStart = performance.now();
const ready = () => {
  loadCount.textContent = "100";
  hudCount.textContent = pad3(tiles.length);
  root.classList.add("ready");
  scramble($("loaderNote"), "Specimens ready", 400);
};
const count = (now) => {
  const p = Math.min(built / tiles.length, (now - loadStart) / MIN_LOAD);
  loadCount.textContent = pad3(Math.floor(p * 100));
  if (p < 1) requestAnimationFrame(count);
  else ready();
};
if (document.hidden) setTimeout(function wait() { built < tiles.length ? setTimeout(wait, 50) : ready(); }, 0);
else requestAnimationFrame(count);

function enter(withSound) {
  if (entered) return;
  entered = true;
  if (withSound) setSound(true);
  root.classList.add("loaded");
  setTimeout(() => {
    setForm("Sphere");
    cam.zoomTarget = 1;
  }, 250);
}
$("enterSound").addEventListener("click", () => enter(true));
$("enterQuiet").addEventListener("click", () => enter(false));

requestAnimationFrame(loop);
