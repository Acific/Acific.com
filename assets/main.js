document.getElementById("year").textContent = new Date().getFullYear();

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Status bar: live clock and viewport size
const clock = document.getElementById("clock");
const vp = document.getElementById("vp");
const pad = (n) => String(n).padStart(2, "0");
const tickClock = () => {
  const d = new Date();
  clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const updateViewport = () => { vp.textContent = `${innerWidth}×${innerHeight}`; };
tickClock();
updateViewport();
setInterval(tickClock, 1000);
window.addEventListener("resize", updateViewport);

// Mobile menu
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");
toggle.addEventListener("click", () => {
  const open = links.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
  toggle.textContent = open ? "[ CLOSE ]" : "[ MENU ]";
});
links.addEventListener("click", (e) => {
  if (e.target.closest("a")) {
    links.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "[ MENU ]";
  }
});

// Fade sections in as they scroll into view
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.15 }
);
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

// Specimen: particles drifting through a flow field. The cursor pushes them
// away; a click injects a burst of new ones.
(() => {
  const canvas = document.getElementById("field");
  const frame = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  const crosshair = document.getElementById("crosshair");
  const out = {
    x: document.getElementById("rx"),
    y: document.getElementById("ry"),
    n: document.getElementById("rn"),
    f: document.getElementById("rf"),
  };

  const ACID = "200, 255, 61";
  const WARN = "255, 106, 43";
  const BASE = 900;
  const MAX = 1800;
  let w, h, dpr, particles = [];
  const pointer = { x: 0.5, y: 0.5, active: false };
  let t = 0;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = frame.clientWidth;
    h = frame.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0c0d0b";
    ctx.fillRect(0, 0, w, h);
  };

  const spawn = (x = Math.random() * w, y = Math.random() * h, hot = false) => ({
    x, y, px: x, py: y,
    life: 200 + Math.random() * 300,
    speed: 0.6 + Math.random() * 1.2,
    hot,
  });

  // Cheap smooth noise from layered sines, slowly evolving over time
  const angle = (x, y) => {
    const nx = x / w, ny = y / h;
    return (
      Math.sin(nx * 6.0 + t * 0.4) * 1.4 +
      Math.cos(ny * 5.0 - t * 0.3) * 1.4 +
      Math.sin((nx + ny) * 9.0 + t * 0.2) * 0.8
    );
  };

  const step = () => {
    t += 0.004;
    // Fade previous frame to leave trails
    ctx.fillStyle = "rgba(12, 13, 11, 0.09)";
    ctx.fillRect(0, 0, w, h);

    const mx = pointer.x * w, my = pointer.y * h;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const a = angle(p.x, p.y);
      let vx = Math.cos(a) * p.speed;
      let vy = Math.sin(a) * p.speed;

      if (pointer.active) {
        const dx = p.x - mx, dy = p.y - my;
        const d2 = dx * dx + dy * dy;
        const r = Math.min(w, h) * 0.18;
        if (d2 < r * r) {
          const f = (1 - Math.sqrt(d2) / r) * 4;
          const d = Math.sqrt(d2) || 1;
          // Push outward and swirl
          vx += (dx / d) * f - (dy / d) * f * 0.6;
          vy += (dy / d) * f + (dx / d) * f * 0.6;
        }
      }

      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy;
      p.life--;

      const color = p.hot ? WARN : ACID;
      const alpha = Math.min(1, p.life / 60) * (p.hot ? 0.9 : 0.55);
      ctx.strokeStyle = `rgba(${color}, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(p.px, p.py);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      const outside = p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10;
      if (p.life <= 0 || outside) {
        if (particles.length > BASE) particles.splice(i, 1);
        else particles[i] = spawn();
      }
    }
  };

  // Static frame for reduced motion: run the field for a while, then stop
  const renderStill = () => {
    for (let i = 0; i < 240; i++) step();
    out.f.textContent = "0";
  };

  let frames = 0, fpsAt = performance.now();
  const loop = (now) => {
    step();
    frames++;
    if (now - fpsAt > 500) {
      out.f.textContent = Math.round((frames * 1000) / (now - fpsAt));
      out.n.textContent = particles.length;
      frames = 0; fpsAt = now;
    }
    if (running) requestAnimationFrame(loop);
  };

  const setPointer = (e) => {
    const r = frame.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) / r.width;
    pointer.y = (e.clientY - r.top) / r.height;
    out.x.textContent = pointer.x.toFixed(3);
    out.y.textContent = pointer.y.toFixed(3);
    crosshair.style.left = `${pointer.x * 100}%`;
    crosshair.style.top = `${pointer.y * 100}%`;
  };
  frame.addEventListener("pointermove", (e) => { pointer.active = true; setPointer(e); });
  frame.addEventListener("pointerleave", () => { pointer.active = false; });
  frame.addEventListener("pointerdown", (e) => {
    setPointer(e);
    const room = MAX - particles.length;
    for (let i = 0; i < Math.min(160, room); i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 12;
      particles.push(spawn(pointer.x * w + Math.cos(a) * r, pointer.y * h + Math.sin(a) * r, true));
    }
    out.n.textContent = particles.length;
    if (reduceMotion) renderStill();
  });

  resize();
  particles = Array.from({ length: BASE }, () => spawn());
  out.n.textContent = particles.length;
  window.addEventListener("resize", resize);

  // Only animate while the specimen is on screen
  let running = false;
  if (reduceMotion) {
    renderStill();
  } else {
    new IntersectionObserver(([entry]) => {
      const wasRunning = running;
      running = entry.isIntersecting;
      if (running && !wasRunning) requestAnimationFrame(loop);
    }).observe(frame);
  }
})();
