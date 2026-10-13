// Shared behaviour: live date in the card header, page reveal, commission
// rows steering the figure, and 1–5 keys to jump between pages.
import "./figures.js?v=20261013183633";

const root = document.documentElement;

// A card color that would vanish on a dark background becomes white there
function onDark(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum < 0.35 ? "#ffffff" : hex;
}

// Logos outside the page card (e.g. the dock) take that card's color
const pageCard = document.querySelector(".card");
if (pageCard) {
  const band = pageCard.style.getPropertyValue("--band");
  root.style.setProperty("--band", band);
  root.style.setProperty("--band-on-dark", onDark(band));
}

// Today's date where a poster would print its issue date
const now = new Date();
const mon = document.getElementById("dateMon");
const day = document.getElementById("dateDay");
if (mon) mon.textContent = now.toLocaleString("en", { month: "short" });
if (day) day.textContent = String(now.getDate()).padStart(2, "0");

// Reveal (with a timer fallback for tabs that don't run animation frames)
requestAnimationFrame(() => root.classList.add("in"));
setTimeout(() => root.classList.add("in"), 120);

// Commissions: hovering a row sends the body to that station
const gridFig = document.querySelector('svg[data-figure="grid"]');
document.querySelectorAll("[data-station]").forEach((row) => {
  row.addEventListener("pointerenter", () => gridFig?.fig?.setActive(+row.dataset.station));
  row.addEventListener("pointerleave", () => gridFig?.fig?.setActive(null));
});

const PAGES = ["/", "/experiments/", "/commissions/", "/about/", "/figures/"];
addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea, [contenteditable]")) return;
  const i = ["1", "2", "3", "4", "5"].indexOf(e.key);
  if (i >= 0 && location.pathname !== PAGES[i]) location.href = PAGES[i];
});
