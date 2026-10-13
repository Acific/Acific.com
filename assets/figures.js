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

  // Nested ellipses that all converge on one point, which follows the pointer
  funnel(svg) {
    const N = 18;
    const shells = Array.from({ length: N }, () => el("ellipse", { fill: "none", stroke: "var(--ink)", "stroke-width": 1, "vector-effect": "non-scaling-stroke" }, svg));
    const dotE = el("ellipse", { fill: "var(--ink)" }, svg);
    const corner = { x: 470, y: 420 };
    return {
      update(t, p) {
        const gx = p ? Math.min(490, Math.max(260, p.x)) : 470 + Math.sin(t * 0.4) * 10;
        const gy = p ? Math.min(470, Math.max(260, p.y)) : 420 + Math.cos(t * 0.5) * 8;
        corner.x = lerp(corner.x, gx, 0.08); corner.y = lerp(corner.y, gy, 0.08);
        shells.forEach((e, i) => {
          const k = Math.pow(1 - i / N, 1.5);
          const rx = 18 + k * (corner.x - 30) / 2;
          const ry = 12 + k * (corner.y - 80) / 2;
          e.setAttribute("rx", rx.toFixed(2)); e.setAttribute("ry", ry.toFixed(2));
          set(e, corner.x - rx, corner.y - ry);
        });
        dotE.setAttribute("rx", 18); dotE.setAttribute("ry", 12);
        set(dotE, corner.x - 18, corner.y - 12);
      },
    };
  },

  // A dot-matrix that spells A·C·I·F·I·C over a faint grid of crosses;
  // the pointer draws extra dots wherever it passes
  matrix(svg) {
    const GLYPHS = {
      A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
      C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
      I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
      F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    };
    const WORD = "ACIFIC";
    const cols = 9, rows = 7, x0 = 70, y0 = 110, dx = 45, dy = 46.67;
    const marks = el("g", { stroke: "#b9b9b9", "stroke-width": 1, "vector-effect": "non-scaling-stroke" }, svg);
    const dots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = x0 + c * dx, y = y0 + r * dy;
      // Alternate tiny crosses and ticks, like a typesetter's grid
      if ((r + c) % 2) {
        el("line", { x1: x - 5, y1: y - 5, x2: x + 5, y2: y + 5 }, marks);
        el("line", { x1: x - 5, y1: y + 5, x2: x + 5, y2: y - 5 }, marks);
      } else {
        el("line", { x1: x, y1: y - 6, x2: x, y2: y + 6 }, marks);
      }
      dots.push({ x, y, c, r, s: 0, n: el("circle", { cx: x, cy: y, r: 0, fill: "var(--ink)" }, svg) });
    }
    const on = (ch, c, r) => c >= 2 && c <= 6 && GLYPHS[ch][r][c - 2] === "#";
    return {
      update(t, p) {
        const ch = WORD[Math.floor(t / 1.3) % WORD.length];
        for (const d of dots) {
          let goal = on(ch, d.c, d.r) ? 1 : 0;
          if (p) goal = Math.max(goal, 1 - Math.hypot(d.x - p.x, d.y - p.y) / 70);
          d.s = lerp(d.s, goal, 0.18);
          d.n.setAttribute("r", (d.s * 6.5).toFixed(2));
        }
      },
    };
  },

  // A woven field of circles and diagonals that swell toward the pointer
  weave(svg) {
    const g = el("g", { fill: "none", stroke: "var(--ink)", "stroke-width": 1, "stroke-opacity": 0.7, "vector-effect": "non-scaling-stroke" }, svg);
    const cells = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      const x = 106 + c * 72, y = 178 + r * 72;
      cells.push({ x, y, k: 0, a: -Math.PI / 4, circle: el("circle", { cx: x, cy: y, r: 58 }, g), line: el("line", {}, g) });
    }
    return {
      update(t, p) {
        for (const [i, c] of cells.entries()) {
          const near = p ? Math.max(0, 1 - Math.hypot(c.x - p.x, c.y - p.y) / 200) : 0.5 + Math.sin(t * 1.1 + i * 0.6) * 0.5;
          c.k = lerp(c.k, near, 0.1);
          const r = 52 + c.k * 14;
          const goalA = p ? Math.atan2(p.y - c.y, p.x - c.x) : -Math.PI / 4 + Math.sin(t * 0.5 + i) * 0.15;
          c.a += angDiff(c.a, goalA) * 0.08;
          c.circle.setAttribute("r", r.toFixed(2));
          const ex = Math.cos(c.a) * r, ey = Math.sin(c.a) * r;
          c.line.setAttribute("x1", (c.x - ex).toFixed(2)); c.line.setAttribute("y1", (c.y - ey).toFixed(2));
          c.line.setAttribute("x2", (c.x + ex).toFixed(2)); c.line.setAttribute("y2", (c.y + ey).toFixed(2));
        }
      },
    };
  },

  // A row of dots; the one nearest the pointer rises on a column
  lift(svg) {
    const N = 5, y = 280, r = 34;
    const items = Array.from({ length: N }, (_, i) => {
      const x = 90 + i * 80;
      const col = el("rect", { x: x - r, width: r * 2, fill: "#a9a9a9", "fill-opacity": 0.85 }, svg);
      const shadow = el("circle", { r, fill: "#a3a3a3" }, svg);
      const dotN = el("circle", { r, fill: "var(--ink)" }, svg);
      return { x, col, shadow, dot: dotN, up: 0 };
    });
    return {
      update(t, p) {
        let active = Math.floor(t / 1.8) % N;
        if (p) {
          let best = Infinity;
          items.forEach((it, i) => { const d = Math.abs(it.x - p.x); if (d < best) { best = d; active = i; } });
        }
        for (const [i, it] of items.entries()) {
          it.up = lerp(it.up, i === active ? 1 : 0, 0.1);
          const cy = y - it.up * 92;
          set(it.dot, it.x, cy);
          set(it.shadow, it.x + 4, cy + 5);
          it.col.setAttribute("y", cy.toFixed(2));
          it.col.setAttribute("height", Math.max(0, (y + 70 - cy) * it.up).toFixed(2));
        }
      },
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
for (const svg of document.querySelectorAll("svg[data-figure]")) {
  const make = FIGURES[svg.dataset.figure];
  if (!make) continue;
  svg.setAttribute("viewBox", "0 0 500 500");
  const fig = make(svg);
  svg.fig = fig;
  const item = { svg, fig, follow: svg.dataset.follow !== "off" };
  mounted.push(item);
  if (fig.click) svg.addEventListener("click", () => fig.click());
  new IntersectionObserver(([e]) => (e.isIntersecting ? live.add(item) : live.delete(item))).observe(svg);
}

// Pointer in a figure's own 0–500 coordinates
const local = (svg) => {
  const r = svg.getBoundingClientRect();
  return { x: ((pointer.x - r.left) / r.width) * 500, y: ((pointer.y - r.top) / r.height) * 500 };
};

const start = performance.now();
const frame = (now) => {
  const t = (now - start) / 1000;
  for (const item of live) item.fig.update(t, pointer.active && item.follow ? local(item.svg) : null);
  if (!reduceMotion) requestAnimationFrame(frame);
};
// Draw a first frame right away (also the only frame with reduced motion)
for (const item of mounted) item.fig.update(0, null);
requestAnimationFrame(frame);
