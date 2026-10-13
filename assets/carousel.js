// Home: a 3D carousel of small poster cards with a glass nav bar.
// Opening a card shows its page in a popup over the blurred carousel.
import { mountFigures } from "./figures.js?v=20261013181519";

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

// Write a style only when it changes, so idle frames do no work
const setStyle = (c, key, value) => {
  if (c._last?.[key] === value) return;
  (c._last ||= {})[key] = value;
  if (key.startsWith("--")) c.style.setProperty(key, value);
  else c.style[key] = value;
};

function render() {
  const sp = spacing();
  const front = wrap(Math.round(pos));
  cards.forEach((c, i) => {
    // Shortest signed distance around the loop, so the ring has no end
    let d = i - pos;
    d -= Math.round(d / N) * N;
    const a = Math.abs(d);
    const x = Math.sign(d) * (a < 1 ? a * sp : sp + (a - 1) * sp * 0.62);
    const z = -Math.min(a, 3) * 150;
    const ry = -Math.max(-1, Math.min(1, d)) * 38 - Math.sign(d) * Math.max(0, Math.min(a - 1, 2)) * 4;
    setStyle(c, "transform", `translate3d(${x.toFixed(2)}px, 0, ${z.toFixed(2)}px) rotateY(${ry.toFixed(2)}deg)`);
    setStyle(c, "opacity", a > 3.2 ? "0" : (1 - Math.max(0, a - 1) * 0.28).toFixed(3));
    // Fine-grained stacking so passing cards never tie and flip
    setStyle(c, "zIndex", String(1000 - Math.round(a * 100)));
    // Side cards dim smoothly with distance (an overlay, not a filter)
    setStyle(c, "--dim", (Math.min(a, 3) * 0.16).toFixed(3));
    c.classList.toggle("is-active", front === i && a < 0.5);
  });
}

// Focus and screen readers follow the front card; only touched when it changes
let a11yFront = -1;
function syncA11y() {
  const f = wrap(active);
  if (f === a11yFront) return;
  a11yFront = f;
  cards.forEach((c, i) => {
    c.setAttribute("aria-hidden", i === f ? "false" : "true");
    c.querySelector("a").tabIndex = i === f ? 0 : -1;
  });
}

// Each card's own line above the carousel: blur out the old, blur in the new
const tagEl = document.querySelector(".ctag");
let tagTimer = 0;
function swapTag(text) {
  if (!tagEl) return;
  clearTimeout(tagTimer);
  if (tagEl.textContent === text && !tagEl.getAnimations().length) return;
  tagEl.getAnimations().forEach((a) => a.cancel());
  if (reduceMotion) { tagEl.textContent = text; placeTag(); return; }
  tagEl.animate(
    [{ opacity: 1, filter: "blur(0)", transform: "translateY(0)" }, { opacity: 0, filter: "blur(8px)", transform: "translateY(-6px)" }],
    { duration: 220, easing: "ease-in", fill: "forwards" });
  // Swap on a timer rather than the animation's finish event, which never
  // fires in a background tab
  tagTimer = setTimeout(() => {
    tagEl.getAnimations().forEach((a) => a.cancel());
    tagEl.textContent = text;
    placeTag();
    tagEl.animate(
      [{ opacity: 0, filter: "blur(10px)", transform: "translateY(8px)" }, { opacity: 1, filter: "blur(0)", transform: "translateY(0)" }],
      { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" });
  }, 220);
}

// A card color that would vanish on a dark background becomes white there
function onDark(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum < 0.35 ? "#ffffff" : hex;
}

function updateNav() {
  const c = cards[wrap(active)];
  syncA11y();
  swapTag(c.dataset.tag);
  navTitle.textContent = c.dataset.title;
  navSub.textContent = c.dataset.sub;
  navChip.textContent = c.dataset.chip;
  navThumb.style.setProperty("--band", c.style.getPropertyValue("--band"));
  // The header logo follows the card in front
  const band = c.style.getPropertyValue("--band");
  root.style.setProperty("--band", band);
  root.style.setProperty("--band-on-dark", onDark(band));
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
  // Nothing behind the popup moves while it's open
  if (!modal.hidden) { requestAnimationFrame(loop); return; }
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
  if (!modal.hidden) { if (e.key === "Escape") closeModal(); return; }
  if (e.key === "ArrowRight") { stop(); go(active + 1); }
  if (e.key === "ArrowLeft") { stop(); go(active - 1); }
  if (e.key === "Enter" && document.activeElement === document.body) openModal(cards[wrap(active)].dataset.href);
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
  if (i === wrap(active)) openModal(card.dataset.href);
  else { stop(); go(active + (() => { let d = i - wrap(active); d -= Math.round(d / N) * N; return d; })()); }
};
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", () => { drag = null; stage.classList.remove("dragging"); go(Math.round(pos)); });
// Links inside cards are handled by the click logic above
// Pointer clicks are handled above; keyboard activation (detail 0) opens the popup
stage.addEventListener("click", (e) => {
  const link = e.target.closest(".cc a");
  if (!link) return;
  e.preventDefault();
  if (!e.detail) openModal(link.closest(".cc").dataset.href);
});
navOpen.addEventListener("click", (e) => { e.preventDefault(); openModal(navOpen.getAttribute("href")); });

// ---------- Popup: a page's card over the blurred carousel ----------
const modal = document.getElementById("modal");
const modalCard = modal.querySelector(".modal-card");
const modalBody = document.getElementById("modalBody");
const homeTitle = document.title;
const pages = new Map();
let lastFocus = null;

// Fetch a page once and keep its card's contents
async function loadPage(href) {
  const path = href.split("#")[0];
  if (!pages.has(path)) {
    pages.set(path, fetch(path).then((r) => r.text()).then((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const card = doc.querySelector(".card");
      return { band: card.style.getPropertyValue("--band"), html: card.innerHTML, title: doc.title };
    }));
  }
  return pages.get(path);
}

async function openModal(href, push = true) {
  stop();
  let page;
  try { page = await loadPage(href); } catch { location.href = href; return; }
  const wasOpen = !modal.hidden;
  if (!wasOpen) lastFocus = document.activeElement;
  modalCard.style.setProperty("--band", page.band);
  modalBody.innerHTML = page.html;
  // The popup has its own copy of the date; fill it, and drop ids the
  // home page already uses
  const now = new Date();
  modalBody.querySelectorAll("#dateMon, #dateDay").forEach((n) => {
    n.textContent = n.id === "dateMon" ? now.toLocaleString("en", { month: "short" }) : String(now.getDate()).padStart(2, "0");
    n.removeAttribute("id");
  });
  // Stagger index for the blur-in of each block (capped so long pages don't drag)
  [...modalBody.children].forEach((n, i) => n.style.setProperty("--i", Math.min(i, 10)));
  mountFigures(modalBody);
  const grid = modalBody.querySelector('svg[data-figure="grid"]');
  modalBody.querySelectorAll("[data-station]").forEach((row) => {
    row.addEventListener("pointerenter", () => grid?.fig?.setActive(+row.dataset.station));
    row.addEventListener("pointerleave", () => grid?.fig?.setActive(null));
  });
  document.title = page.title;
  // Each page opened in the popup is one history step deeper
  if (push) history.pushState({ modal: href, depth: (history.state?.depth || 0) + 1 }, "", href);
  modal.hidden = false;
  root.classList.add("modal-open");
  void modal.offsetWidth; // let the hidden state settle so the entrance animates
  modal.classList.add("show");
  const hash = href.split("#")[1];
  const target = hash && modalBody.querySelector(`#${CSS.escape(hash)}`);
  if (target) target.scrollIntoView({ block: "start" });
  else modal.scrollTop = 0;
  modal.querySelector(".modal-close").focus({ preventScroll: true });
}

function hideModal() {
  if (modal.hidden) return;
  modal.classList.remove("show");
  root.classList.remove("modal-open");
  document.title = homeTitle;
  setTimeout(() => {
    if (modal.classList.contains("show")) return;
    modal.hidden = true;
    modalBody.innerHTML = "";
  }, reduceMotion ? 0 : 380);
  lastFocus?.focus?.({ preventScroll: true });
}

// × and Esc close the popup outright: rewind every step it added, so the
// address bar returns to the home page (Back alone steps page by page)
function closeModal() {
  const depth = history.state?.depth || 0;
  if (depth > 0) history.go(-depth);
  else { history.replaceState(null, "", "/"); hideModal(); }
}
addEventListener("popstate", (e) => {
  if (e.state?.modal) openModal(e.state.modal, false);
  else hideModal();
});

modal.querySelector(".modal-close").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

// Links inside the popup stay inside it
modalBody.addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (!a || a.target === "_blank") return;
  const url = new URL(a.getAttribute("href"), location.href);
  if (url.origin !== location.origin) return;
  e.preventDefault();
  if (url.pathname === "/") closeModal();
  else if (url.pathname === location.pathname && url.hash) modalBody.querySelector(url.hash)?.scrollIntoView({ behavior: "smooth" });
  else openModal(url.pathname + url.hash);
});

// Keep Tab inside the popup while it's open
modal.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const f = [...modal.querySelectorAll("a[href], button, [tabindex]:not([tabindex='-1'])")].filter((n) => n.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

// Stagger the load-in: the front card first, then each step outward
cards.forEach((c, i) => {
  let d = i - active;
  d -= Math.round(d / N) * N;
  c.style.setProperty("--delay", `${Math.abs(d) * 0.12}s`);
});

// Tagline: mirror the nav bar's gap below the front card, measured on screen
function placeTag() {
  const tag = tagEl;
  if (!tag) return;
  const front = cards[wrap(active)].getBoundingClientRect();
  const nav = document.querySelector(".cnav").getBoundingClientRect();
  const gap = nav.top - front.bottom;
  const headerBottom = document.querySelector(".top").getBoundingClientRect().bottom;
  tag.style.top = `${Math.max(headerBottom + 16, front.top - gap - tag.offsetHeight)}px`;
  tag.style.transform = "none";
}
addEventListener("resize", placeTag);

updateNav();
render();
placeTag();
requestAnimationFrame(loop);
requestAnimationFrame(() => root.classList.add("in"));
setTimeout(() => root.classList.add("in"), 120);
