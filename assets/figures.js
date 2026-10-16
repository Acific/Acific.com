// Interactive geometric figures: black "goo" bodies and thin outlined
// circles, drawn in SVG (viewBox 0 0 500 500) and animated each frame.

const NS = "http://www.w3.org/2000/svg";
const TAU = Math.PI * 2;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
};
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// The goo filter blurs shapes together and re-sharpens the edge, so nearby
// filled circles melt into one body with a neck between them
let gooCount = 0;
function goo(svg, blur = 9) {
  const id = `goo${gooCount++}`;
  const defs = el("defs", {}, svg);
  const f = el("filter", { id, x: "-50%", y: "-50%", width: "200%", height: "200%", "color-interpolation-filters": "sRGB" }, defs);
  el("feGaussianBlur", { in: "SourceGraphic", stdDeviation: blur, result: "b" }, f);
  // Output flat ink (#1f1f1f) and a hard alpha edge, so the body has no halo
  el("feColorMatrix", { in: "b", values: "0 0 0 0 0.1216  0 0 0 0 0.1216  0 0 0 0 0.1216  0 0 0 28 -12" }, f);
  return el("g", { filter: `url(#${id})`, fill: "var(--ink)" }, svg);
}
const ring = (parent, r) => el("circle", { r, fill: "none", stroke: "var(--ink)", "stroke-width": 1, "vector-effect": "non-scaling-stroke" }, parent);
const set = (n, x, y) => { n.setAttribute("cx", x.toFixed(2)); n.setAttribute("cy", y.toFixed(2)); };

// ---------- Figures ----------
const FIGURES = {
  // A body with a satellite, ringed by circles; the gap in the ring turns
  // toward the pointer and a click flings the satellite out
  orbit(svg) {
    const C = [255, 265];
    const ringG = el("g", {}, svg);
    const N = 10, RR = 150;
    const rings = Array.from({ length: N }, () => ring(ringG, 68));
    const body = goo(svg, 10);
    const big = el("circle", { r: 108 }, body);
    const sat = el("circle", { r: 56 }, body);
    let gap = -2.2, dist = 150, vel = 0;
    return {
      update(t, p) {
        const goal = p ? Math.atan2(p.y - C[1], p.x - C[0]) : -2.2 + Math.sin(t * 0.25) * 0.8;
        gap += angDiff(gap, goal) * 0.05;
        // Breathing distance with a spring, so the neck stretches and snaps
        const rest = 150 + Math.sin(t * 0.9) * 14;
        vel += (rest - dist) * 0.06; vel *= 0.86; dist += vel;
        set(big, C[0], C[1]);
        set(sat, C[0] + Math.cos(gap) * dist, C[1] + Math.sin(gap) * dist);
        rings.forEach((c, i) => {
          const a = gap + 0.62 + (i / (N - 1)) * (TAU - 1.24);
          const wob = Math.sin(t * 1.3 + i) * 4;
          set(c, C[0] + Math.cos(a) * (RR + wob), C[1] + Math.sin(a) * (RR + wob));
        });
      },
      click() { vel += 26; },
    };
  },

  // Nodes on threads around a core: AI tools as a small network
  network(svg) {
    const C = [250, 250];
    const lines = el("g", { stroke: "var(--ink)", "stroke-width": 1, "vector-effect": "non-scaling-stroke" }, svg);
    const nodes = Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * TAU + 0.4, r = 150 + (i % 3) * 28;
      return { a, r, line: el("line", {}, lines), c: ring(svg, 26 + (i % 2) * 10) };
    });
    const body = goo(svg, 8);
    const core = el("circle", { r: 62 }, body);
    const sat = el("circle", { r: 30 }, body);
    return {
      update(t, p) {
        set(core, C[0], C[1]);
        let sa = t * 0.6, sd = 86;
        if (p) { sa = Math.atan2(p.y - C[1], p.x - C[0]); sd = 92; }
        set(sat, C[0] + Math.cos(sa) * sd, C[1] + Math.sin(sa) * sd);
        for (const [i, n] of nodes.entries()) {
          const a = n.a + Math.sin(t * 0.4 + i) * 0.08, r = n.r + Math.sin(t * 0.9 + i * 2) * 8;
          const x = C[0] + Math.cos(a) * r, y = C[1] + Math.sin(a) * r;
          set(n.c, x, y);
          n.line.setAttribute("x1", C[0]); n.line.setAttribute("y1", C[1]);
          n.line.setAttribute("x2", x.toFixed(2)); n.line.setAttribute("y2", y.toFixed(2));
        }
      },
    };
  },

  // A grid of squares that turn as the pointer passes: small sharp tools
  stack(svg) {
    const n = 5, s = 58, gap = 14, o = (500 - (n * s + (n - 1) * gap)) / 2;
    const cells = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const x = o + c * (s + gap) + s / 2, y = o + r * (s + gap) + s / 2;
      const g = el("g", {}, svg);
      const sq = el("rect", { x: -s / 2, y: -s / 2, width: s, height: s, fill: "none", stroke: "var(--ink)", "stroke-width": 1, "vector-effect": "non-scaling-stroke" }, g);
      cells.push({ x, y, g, sq, rot: 0, fill: 0 });
    }
    let active = 12;
    return {
      update(t, p) {
        if (p) {
          let best = Infinity;
          cells.forEach((c, i) => { const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2; if (d < best) { best = d; active = i; } });
        } else {
          active = Math.floor(t / 1.6) % cells.length;
        }
        for (const [i, c] of cells.entries()) {
          const d = p ? Math.hypot(c.x - p.x, c.y - p.y) : 999;
          const goal = p ? Math.max(0, 1 - d / 220) * 45 : Math.sin(t + i * 0.5) * 6;
          c.rot = lerp(c.rot, goal, 0.12);
          c.fill = lerp(c.fill, i === active ? 1 : 0, 0.15);
          c.g.setAttribute("transform", `translate(${c.x} ${c.y}) rotate(${c.rot.toFixed(2)})`);
          c.sq.setAttribute("fill", c.fill > 0.5 ? "var(--ink)" : "none");
        }
      },
    };
  },

  // One body, many echoes: rings shift toward the pointer like ripples
  single(svg) {
    const C = [250, 250];
    const rings = Array.from({ length: 7 }, (_, i) => ring(svg, 112 + i * 22));
    const body = goo(svg, 8);
    const core = el("circle", { r: 92 }, body);
    let px = 0, py = 0;
    return {
      update(t, p) {
        const tx = p ? (p.x - C[0]) / 250 : Math.cos(t * 0.5) * 0.4;
        const ty = p ? (p.y - C[1]) / 250 : Math.sin(t * 0.5) * 0.4;
        px = lerp(px, tx, 0.06); py = lerp(py, ty, 0.06);
        core.setAttribute("r", (92 + Math.sin(t * 1.2) * 4).toFixed(2));
        set(core, C[0], C[1]);
        rings.forEach((c, i) => set(c, C[0] + px * (i + 1) * 9, C[1] + py * (i + 1) * 9));
      },
    };
  },

  // Four stations; the body travels to whichever one is active
  grid(svg) {
    const P = [[150, 150], [350, 150], [150, 350], [350, 350]];
    P.forEach(([x, y]) => set(ring(svg, 88), x, y));
    const body = goo(svg, 10);
    const lead = el("circle", { r: 60 }, body);
    const tail = el("circle", { r: 34 }, body);
    const pos = { x: 150, y: 150 }, trail = { x: 150, y: 150 };
    let active = 0, forced = null;
    const api = {
      update(t) {
        active = forced ?? Math.floor(t / 2.4) % 4;
        const [gx, gy] = P[active];
        pos.x = lerp(pos.x, gx, 0.09); pos.y = lerp(pos.y, gy, 0.09);
        trail.x = lerp(trail.x, pos.x, 0.07); trail.y = lerp(trail.y, pos.y, 0.07);
        set(lead, pos.x, pos.y); set(tail, trail.x, trail.y);
      },
      setActive(i) { forced = i; },
    };
    return api;
  },

  // Thin vertical lines with black blocks that sink as the pointer passes
  bars(svg) {
    const lines = el("g", { stroke: "var(--ink)", "stroke-width": 1, "vector-effect": "non-scaling-stroke" }, svg);
    const cols = 64, x0 = 10, w = 480, top = 70, bot = 430;
    for (let i = 0; i < cols; i++) {
      const x = x0 + (i / (cols - 1)) * w;
      // Every other line is cut short into three bands
      if (i % 2 === 0) el("line", { x1: x, x2: x, y1: top, y2: bot }, lines);
      else for (const [a, b] of [[148, 180], [258, 290], [368, 400]]) el("line", { x1: x, x2: x, y1: a, y2: b }, lines);
    }
    const blocks = [];
    const bw = 30, bh = 92;
    [[1, 0], [3, 0], [0, 1], [2, 1], [4, 1], [1, 2], [3, 2]].forEach(([c, r]) => {
      const x = x0 + 60 + c * 85 - bw / 2;
      const y = top + 16 + r * 110;
      blocks.push({ x, y, cx: x + bw / 2, off: 0, n: el("rect", { x, y, width: bw, height: bh, fill: "var(--ink)" }, svg) });
    });
    return {
      update(t, p) {
        blocks.forEach((b, i) => {
          const near = p ? Math.max(0, 1 - Math.abs(b.cx - p.x) / 90) : 0;
          const goal = near * 26 + Math.sin(t * 1.4 + i * 1.7) * 3;
          b.off = lerp(b.off, goal, 0.12);
          b.n.setAttribute("y", (b.y + b.off).toFixed(2));
        });
      },
    };
  },

  // A tunnel: rings step from a fixed outer ellipse down to a small vanishing
  // point that drifts in a slow loop and leans toward the pointer
  funnel(svg) {
    const C = { x: 250, y: 250 };
    const N = 14;
    const R = { x: 205, y: 172 };          // the fixed outer ring
    const END = { x: 15, y: 11 };          // the vanishing point's size
    const rings = Array.from({ length: N }, () => el("ellipse", { fill: "none", stroke: "var(--ink)", "stroke-width": 1, "vector-effect": "non-scaling-stroke" }, svg));
    const vp = el("ellipse", { fill: "var(--ink)", rx: END.x, ry: END.y }, svg);
    const P = { x: C.x, y: C.y };
    return {
      update(t, p) {
        // Idle: a slow figure-eight; with a pointer: lean toward it, kept inside the frame
        let gx = C.x + Math.sin(t * 0.45) * 95;
        let gy = C.y + Math.sin(t * 0.9) * 50;
        if (p) {
          const dx = p.x - C.x, dy = p.y - C.y;
          const d = Math.hypot(dx, dy) || 1;
          const reach = Math.min(d, 140);
          gx = C.x + (dx / d) * reach;
          gy = C.y + (dy / d) * reach * 0.8;
        }
        P.x = lerp(P.x, gx, 0.06); P.y = lerp(P.y, gy, 0.06);
        const breathe = 1 + Math.sin(t * 1.1) * 0.015;
        rings.forEach((e, i) => {
          // Evenly stepped rings read as depth, like looking down a tube
          const k = i / N;
          e.setAttribute("rx", (lerp(R.x, END.x, k) * breathe).toFixed(2));
          e.setAttribute("ry", (lerp(R.y, END.y, k) * breathe).toFixed(2));
          set(e, lerp(C.x, P.x, k), lerp(C.y, P.y, k));
        });
        set(vp, P.x, P.y);
      },
    };
  },

  // A wireframe globe that turns, with a body orbiting on a tilted ring:
  // Brand World Building. The globe leans toward the pointer; a click spins it
  world(svg) {
    const C = [250, 250], R = 128;
    const tilt = el("g", {}, svg);
    const stroke = { fill: "none", stroke: "var(--ink)", "stroke-width": 1, "vector-effect": "non-scaling-stroke" };
    const back = el("ellipse", { ...stroke, rx: 212, ry: 54 }, tilt);
    const globe = el("g", {}, tilt);
    el("circle", { r: R, fill: "var(--card, #fff)", stroke: "none" }, globe);
    el("circle", { ...stroke, r: R }, globe);
    [-0.62, -0.3, 0, 0.3, 0.62].forEach((k) => {
      const y = k * R, rx = Math.sqrt(R * R - y * y);
      el("ellipse", { ...stroke, cy: y, rx, ry: rx * 0.16 }, globe);
    });
    const merid = Array.from({ length: 6 }, () => el("ellipse", { ...stroke, ry: R }, globe));
    const front = el("path", { ...stroke }, tilt);
    const body = goo(svg, 7);
    const moon = el("circle", { r: 26 }, body);
    let spin = 0, speed = 0.35, lean = -14;
    return {
      update(t, p) {
        speed += (0.35 - speed) * 0.02;
        spin += speed / 60;
        const goal = p ? Math.max(-30, Math.min(30, (p.x - C[0]) / 8)) - 14 : -14 + Math.sin(t * 0.3) * 4;
        lean = lerp(lean, goal, 0.05);
        tilt.setAttribute("transform", `translate(${C[0]} ${C[1]}) rotate(${lean.toFixed(2)})`);
        merid.forEach((m, i) => m.setAttribute("rx", (R * Math.abs(Math.sin(spin + (i * Math.PI) / 6))).toFixed(2)));
        // The ring's near half passes in front of the globe
        front.setAttribute("d", "M -212 0 A 212 54 0 0 0 212 0");
        const a = t * 0.55;
        const mx = Math.cos(a) * 212, my = Math.sin(a) * 54;
        const r = (lean * Math.PI) / 180;
        set(moon, C[0] + mx * Math.cos(r) - my * Math.sin(r), C[1] + mx * Math.sin(r) + my * Math.cos(r));
        moon.setAttribute("r", (Math.sin(a) > 0 ? 26 : 20).toFixed(1));
        body.parentNode.append(body);
        if (Math.sin(a) < 0) svg.insertBefore(body, tilt);
      },
      click() { speed += 2.2; },
    };
  },

  // Two bodies in a slow dance inside three rings
  pair(svg) {
    const C = [250, 250];
    [210, 160, 110].forEach((r) => set(ring(svg, r), C[0], C[1]));
    const body = goo(svg, 10);
    const a = el("circle", { r: 70 }, body);
    const b = el("circle", { r: 46 }, body);
    return {
      update(t, p) {
        const k = p ? Math.min(1, Math.hypot(p.x - C[0], p.y - C[1]) / 300) : 0.5;
        const d = 40 + k * 110;
        set(a, C[0] + Math.cos(t * 0.7) * d * 0.6, C[1] + Math.sin(t * 0.9) * d * 0.4);
        set(b, C[0] - Math.cos(t * 0.7) * d, C[1] - Math.sin(t * 1.1) * d * 0.7);
      },
    };
  },
};

// ---------- Mount every <svg data-figure> and run one shared loop ----------
const pointer = { x: 0, y: 0, active: false };
addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; }, { passive: true });
document.addEventListener("pointerleave", () => { pointer.active = false; });

const live = new Set();
const mounted = [];

// Mount every <svg data-figure> inside `scope` (the page, or a popup)
export function mountFigures(scope = document) {
  for (const svg of scope.querySelectorAll("svg[data-figure]")) {
    if (svg.fig) continue;
    const make = FIGURES[svg.dataset.figure];
    if (!make) continue;
    svg.setAttribute("viewBox", "0 0 500 500");
    const fig = make(svg);
    svg.fig = fig;
    const item = { svg, fig, follow: svg.dataset.follow !== "off" };
    mounted.push(item);
    fig.update(0, null);
    if (fig.click) svg.addEventListener("click", () => fig.click());
    new IntersectionObserver(([e]) => (e.isIntersecting ? live.add(item) : live.delete(item))).observe(svg);
  }
}

// Pointer in a figure's own 0–500 coordinates
const local = (svg) => {
  const r = svg.getBoundingClientRect();
  return { x: ((pointer.x - r.left) / r.width) * 500, y: ((pointer.y - r.top) / r.height) * 500 };
};

const root = document.documentElement;
let paused = false;
new MutationObserver(() => { paused = root.classList.contains("modal-open"); })
  .observe(root, { attributes: true, attributeFilter: ["class"] });

const start = performance.now();
const frame = (now) => {
  const t = (now - start) / 1000;
  for (const item of live) {
    // Figures removed with a closed popup drop out of the loop
    if (!item.svg.isConnected) { live.delete(item); continue; }
    // Behind an open popup the carousel is frozen, so the blur stays cheap
    if (paused && item.svg.closest(".stage")) continue;
    item.fig.update(t, pointer.active && item.follow ? local(item.svg) : null);
  }
  if (!reduceMotion) requestAnimationFrame(frame);
};
mountFigures();
requestAnimationFrame(frame);
