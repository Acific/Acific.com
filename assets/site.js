// Shared behaviour for every page: text effects, clock, sound, cursor,
// generative covers, hover previews, page reveal and keyboard navigation.
import { renderSpecimen } from "./specimens.js";

export const root = document.documentElement;
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const finePointer = matchMedia("(pointer: fine)").matches;
export const $ = (id) => document.getElementById(id);
export const pad3 = (n) => String(n).padStart(3, "0");

const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
};
export { store };

// ---------- Text effects ----------
const GLYPHS = "▖▘▝▗▚▞▌▐░▒▓/\\|+*#%<>";
const scrambling = new WeakMap();
export function scramble(el, text, dur = 420) {
  if (!el) return;
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

// Letters drift in one by one (titles marked .split)
document.querySelectorAll(".split").forEach((el) => {
  const text = el.textContent;
  el.setAttribute("aria-label", text);
  el.textContent = "";
  for (const c of text) {
    const s = document.createElement("span");
    s.className = "ch";
    s.setAttribute("aria-hidden", "true");
    s.textContent = c;
    s.style.transitionDelay = `${0.1 + Math.random() * 0.6}s`;
    el.append(s);
  }
});

document.querySelectorAll(".pill-item .pl, [data-scramble]").forEach((el) => {
  const text = el.textContent;
  (el.closest("a, button") || el).addEventListener("pointerenter", () => scramble(el, text, 300));
});

// ---------- Clock ----------
const clock = $("clock");
if (clock) {
  const tick = () => {
    const d = new Date();
    clock.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  tick();
  setInterval(tick, 10000);
}

// ---------- Sound (generated with Web Audio, only after the visitor opts in) ----------
export const sound = (() => {
  let ctx, master, noise, on = false;
  const scale = [220, 246.9, 293.7, 329.6, 392, 440, 493.9, 587.3];

  const start = () => {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
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
export function setSound(on) {
  sound.set(on);
  store.set("acific-sound", on ? "on" : "off");
  soundBtn?.setAttribute("aria-pressed", on);
  scramble(soundBtn?.querySelector(".sound-label"), on ? "Sound on" : "Sound off", 300);
}
soundBtn?.addEventListener("click", () => setSound(!sound.on));
// Browsers need a gesture before audio can start, so a visitor who chose
// sound earlier gets it back on their first click on this page
if (store.get("acific-sound") === "on") {
  soundBtn?.setAttribute("aria-pressed", "true");
  const label = soundBtn?.querySelector(".sound-label");
  if (label) label.textContent = "Sound on";
  const resume = (e) => {
    if (e.target.closest?.("#sound")) return;
    setSound(true);
    removeEventListener("pointerdown", resume, true);
  };
  addEventListener("pointerdown", resume, true);
}

// ---------- Custom cursor ----------
const cursor = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 };
const dot = $("curDot"), ring = $("curRing");
export const cursorPos = cursor;
if (finePointer && dot && ring) {
  root.classList.add("custom-cursor", "c-out");
  addEventListener("pointermove", (e) => {
    if (root.classList.contains("c-out")) { cursor.rx = e.clientX; cursor.ry = e.clientY; root.classList.remove("c-out"); }
    cursor.x = e.clientX; cursor.y = e.clientY;
    dot.style.transform = `translate(${cursor.x}px, ${cursor.y}px)`;
    const over = e.target.closest?.("a, button:not(.tile)");
    root.classList.toggle("c-link", !!over);
    root.classList.toggle("c-stage", !over && !!e.target.closest?.(".stage"));
  }, { passive: true });
  document.addEventListener("pointerleave", () => root.classList.add("c-out"));
  document.addEventListener("pointerenter", () => root.classList.remove("c-out"));
}

// ---------- Generative covers: <canvas data-gen data-seed> ----------
const covers = [...document.querySelectorAll("canvas[data-cover]")];
const drawCovers = () => {
  for (const c of covers) {
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) continue;
    renderSpecimen(c, +c.dataset.gen, +c.dataset.seed, w, h, Math.min(devicePixelRatio || 1, 2));
  }
};
if (covers.length) {
  drawCovers();
  let t;
  addEventListener("resize", () => { clearTimeout(t); t = setTimeout(drawCovers, 200); });
}

// ---------- Hover previews: items with data-gen show a specimen at the cursor ----------
const peekItems = document.querySelectorAll("[data-peek]");
let peek = null;
const pk = { x: 0, y: 0 };
if (finePointer && peekItems.length) {
  peek = document.createElement("div");
  peek.className = "peek";
  peek.setAttribute("aria-hidden", "true");
  peek.innerHTML = "<canvas></canvas>";
  document.body.append(peek);
  const pc = peek.firstChild;
  peekItems.forEach((el) => {
    el.addEventListener("pointerenter", () => {
      renderSpecimen(pc, +el.dataset.peek, Math.floor(Math.random() * 1e6), 132, 168, Math.min(devicePixelRatio || 1, 2));
      peek.classList.add("on");
      sound.blip(+el.dataset.peek);
    });
    el.addEventListener("pointerleave", () => peek.classList.remove("on"));
  });
}

// One frame loop for the cursor ring and preview
if (finePointer && (ring || peek)) {
  const follow = () => {
    cursor.rx += (cursor.x - cursor.rx) * 0.18;
    cursor.ry += (cursor.y - cursor.ry) * 0.18;
    if (ring) ring.style.transform = `translate(${cursor.rx}px, ${cursor.ry}px)`;
    if (peek) {
      pk.x += (cursor.x - pk.x) * 0.2;
      pk.y += (cursor.y - pk.y) * 0.2;
      peek.style.transform = `translate(${pk.x + 48}px, ${pk.y - 84}px)`;
    }
    requestAnimationFrame(follow);
  };
  requestAnimationFrame(follow);
}

// ---------- Horizontal strips scroll with the wheel ----------
document.querySelectorAll(".hscroll").forEach((el) => {
  el.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if (el.scrollWidth <= el.clientWidth) return;
    e.preventDefault();
    el.scrollBy({ left: e.deltaY, behavior: "auto" });
  }, { passive: false });
});

// ---------- Page reveal ----------
requestAnimationFrame(() => root.classList.add("in"));
// Fallback for hidden tabs where animation frames don't run
setTimeout(() => root.classList.add("in"), 120);

// ---------- Keyboard: 1–4 jump between pages ----------
const PAGES = ["/", "/experiments/", "/commissions/", "/about/"];
addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea, [contenteditable]")) return;
  if (document.querySelector(".viewer:not([hidden])")) return;
  if (!root.classList.contains("loaded") && root.classList.contains("home")) return;
  const i = ["1", "2", "3", "4"].indexOf(e.key);
  if (i >= 0 && location.pathname !== PAGES[i]) location.href = PAGES[i];
});
