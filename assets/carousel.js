// Home: a 3D carousel of small poster cards with a glass nav bar.
const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const stage = document.getElementById("stage");
const cards = [...stage.querySelectorAll(".cc")];
const N = cards.length;

const navTitle = document.getElementById("navTitle");
const navSub = document.getElementById("navSub");
const navChip = document.getElementById("navChip");
const navThumb = document.getElementById("navThumb");
const navOpen = document.getElementById("navOpen");
const playBtn = document.getElementById("play");

let active = 0;   // the card in front
let pos = 0;      // eased, fractional position for smooth motion
let drag = null;

// Visit position kept for the session, so Back returns to the same card
try { active = Math.min(N - 1, Math.max(0, +sessionStorage.getItem("acific-card") || 0)); } catch { /* storage off */ }
pos = active;

const wrap = (i) => ((i % N) + N) % N;
const spacing = () => Math.min(innerWidth * 0.22, 250);

function render() {
  const sp = spacing();
  cards.forEach((c, i) => {
    // Shortest signed distance around the loop, so the ring has no end
    let d = i - pos;
    d -= Math.round(d / N) * N;
    const a = Math.abs(d);
    const x = Math.sign(d) * (a < 1 ? a * sp : sp + (a - 1) * sp * 0.62);
    const z = -Math.min(a, 3) * 150;
    const ry = -Math.max(-1, Math.min(1, d)) * 38 - Math.sign(d) * Math.max(0, Math.min(a - 1, 2)) * 4;
    c.style.transform = `translateX(${x.toFixed(1)}px) translateZ(${z.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg)`;
    c.style.opacity = a > 3.2 ? 0 : (1 - Math.max(0, a - 1) * 0.28).toFixed(3);
    c.style.zIndex = String(100 - Math.round(a * 10));
    c.style.filter = a > 0.6 ? `brightness(${(1 - Math.min(a, 3) * 0.16).toFixed(3)})` : "";
    c.classList.toggle("is-active", wrap(Math.round(pos)) === i && a < 0.5);
    c.setAttribute("aria-hidden", wrap(active) === i ? "false" : "true");
    c.querySelector("a").tabIndex = wrap(active) === i ? 0 : -1;
  });
}

function updateNav() {
  const c = cards[wrap(active)];
  navTitle.textContent = c.dataset.title;
  navSub.textContent = c.dataset.sub;
  navChip.textContent = c.dataset.chip;
  navThumb.style.setProperty("--band", c.style.getPropertyValue("--band"));
  navOpen.href = c.dataset.href;
  navOpen.setAttribute("aria-label", `Open ${c.dataset.title}`);
  try { sessionStorage.setItem("acific-card", String(wrap(active))); } catch { /* storage off */ }
}

function go(i) {
  active = i;
  updateNav();
}

// Ease pos toward active every frame
const loop = () => {
  if (!drag) {
    // Travel the short way around the loop
    let diff = active - pos;
    diff -= Math.round(diff / N) * N;
    pos += reduceMotion ? diff : diff * 0.12;
    if (Math.abs(diff) < 0.001) pos = active;
  }
  render();
  requestAnimationFrame(loop);
};

// ---------- Controls ----------
document.getElementById("prev").addEventListener("click", () => { stop(); go(active - 1); });
document.getElementById("next").addEventListener("click", () => { stop(); go(active + 1); });

let timer = null;
function stop() {
  clearInterval(timer); timer = null;
  playBtn.setAttribute("aria-pressed", "false");
  playBtn.setAttribute("aria-label", "Play");
}
playBtn.addEventListener("click", () => {
  if (timer) return stop();
  timer = setInterval(() => go(active + 1), 3200);
  playBtn.setAttribute("aria-pressed", "true");
  playBtn.setAttribute("aria-label", "Pause");
  go(active + 1);
});

addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea")) return;
  if (e.key === "ArrowRight") { stop(); go(active + 1); }
  if (e.key === "ArrowLeft") { stop(); go(active - 1); }
  if (e.key === "Enter" && document.activeElement === document.body) location.href = cards[wrap(active)].dataset.href;
});

// Wheel: one card per gesture
let wheelLock = 0;
stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  const now = performance.now();
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(delta) < 8 || now < wheelLock) return;
  wheelLock = now + 380;
  stop();
  go(active + Math.sign(delta));
}, { passive: false });

// Drag / swipe; a click on a side card brings it forward
// Cards are links and their figures are SVG: stop the browser's own
// link/image dragging, which would otherwise swallow the gesture
stage.addEventListener("dragstart", (e) => e.preventDefault());
stage.querySelectorAll("a, svg").forEach((n) => n.setAttribute("draggable", "false"));

stage.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  drag = { x: e.clientX, start: pos, moved: 0, card: e.target.closest(".cc") };
  stage.setPointerCapture(e.pointerId);
  stage.classList.add("dragging");
});
stage.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  drag.moved = Math.max(drag.moved, Math.abs(dx));
  pos = drag.start - dx / spacing();
});
const endDrag = (e) => {
  if (!drag) return;
  const { moved, card } = drag;
  drag = null;
  stage.classList.remove("dragging");
  if (moved > 6) {
    stop();
    go(Math.round(pos));
    return;
  }
  // A plain click: side card comes forward, front card opens
  if (!card) return;
  const i = cards.indexOf(card);
  if (i === wrap(active)) location.href = card.dataset.href;
  else { stop(); go(active + (() => { let d = i - wrap(active); d -= Math.round(d / N) * N; return d; })()); }
};
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", () => { drag = null; stage.classList.remove("dragging"); go(Math.round(pos)); });
// Links inside cards are handled by the click logic above
// (keyboard activation has detail 0 and is allowed through)
stage.addEventListener("click", (e) => { if (e.detail && e.target.closest(".cc a")) e.preventDefault(); });

updateNav();
render();
requestAnimationFrame(loop);
requestAnimationFrame(() => root.classList.add("in"));
setTimeout(() => root.classList.add("in"), 120);
