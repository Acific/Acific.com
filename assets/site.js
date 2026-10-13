// Shared behaviour: live date in the card header, page reveal, commission
// rows steering the figure, and 1–5 keys to jump between pages.
import "./figures.js?v=20261013093533";

const root = document.documentElement;

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
