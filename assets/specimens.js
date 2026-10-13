// Generative "specimens": small procedural drawings rendered into canvases.
// Each generator draws into a 2D context of size w×h using a seeded RNG and
// noise, so the same seed always produces the same specimen.

export const INK = "#111110";
export const PAPER = "#f6f6f3";
export const GREY = "#e8e8e3";
export const DARK = "#151514";
export const ACID = "#c8ff3d";

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seeded 2D value noise with fractal layering
function makeNoise(rand) {
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = rand(); }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const smooth = (t) => t * t * (3 - 2 * t);
  const at = (x, y) => vals[perm[(perm[x & 255] + y) & 511]];
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  noise.fbm = (x, y, oct = 4) => {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += noise(x * f, y * f) * amp;
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  };
  return noise;
}

const fill = (ctx, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(0, 0, w, h); };

// Paint every `step`-sized cell by a function returning a CSS color or null
function cells(ctx, w, h, step, fn) {
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const c = fn(x, y);
      if (c) { ctx.fillStyle = c; ctx.fillRect(x, y, step, step); }
    }
  }
}

export const GENERATORS = [
  {
    name: "Flow field",
    note: "Particles released into a noise field, each one tracing the current it was born into.",
    draw(ctx, w, h, r, n) {
      fill(ctx, w, h, PAPER);
      const sc = 2.2 + r() * 2;
      ctx.lineWidth = Math.max(0.5, w / 400);
      for (let i = 0; i < 520; i++) {
        let x = r() * w, y = r() * h;
        ctx.strokeStyle = i % 41 === 0 ? ACID : `rgba(17,17,16,${0.18 + r() * 0.3})`;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < 70; s++) {
          const a = n.fbm((x / w) * sc, (y / h) * sc, 3) * Math.PI * 4;
          x += Math.cos(a) * w / 220; y += Math.sin(a) * w / 220;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
  },
  {
    name: "Ordered dither",
    note: "A smooth gradient field forced through a 4×4 Bayer matrix. Continuous becomes binary.",
    draw(ctx, w, h, r, n) {
      fill(ctx, w, h, PAPER);
      const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      const px = Math.max(2, Math.round(w / 110));
      const sc = 1.5 + r() * 2.5;
      cells(ctx, w, h, px, (x, y) => {
        const v = n.fbm((x / w) * sc, (y / h) * sc) * 1.4 - 0.2 + (y / h) * 0.3;
        const t = (bayer[((y / px) % 4) * 4 + ((x / px) % 4)] + 0.5) / 16;
        return v > t ? INK : null;
      });
    },
  },
  {
    name: "Isolines",
    note: "Contour lines of an invented terrain. A map of a place that only exists at this seed.",
    draw(ctx, w, h, r, n) {
      const dark = r() > 0.5;
      fill(ctx, w, h, dark ? DARK : PAPER);
      const levels = 10 + Math.floor(r() * 10);
      const sc = 1.5 + r() * 2;
      cells(ctx, w, h, Math.max(1, Math.round(w / 220)), (x, y) => {
        const v = n.fbm((x / w) * sc, (y / h) * sc, 5) * levels;
        const f = v - Math.floor(v);
        if (f < 0.07) return Math.floor(v) % 5 === 0 ? ACID : dark ? PAPER : INK;
        return null;
      });
    },
  },
  {
    name: "Cellular automaton",
    note: "One row of random cells, one elementary rule, applied again and again down the page.",
    draw(ctx, w, h, r) {
      const rules = [30, 90, 110, 45, 73, 105, 150];
      const rule = rules[Math.floor(r() * rules.length)];
      const dark = r() > 0.4;
      fill(ctx, w, h, dark ? DARK : PAPER);
      const px = Math.max(2, Math.round(w / 90));
      const cols = Math.ceil(w / px);
      let row = Array.from({ length: cols }, () => (r() > 0.5 ? 1 : 0));
      ctx.fillStyle = dark ? ACID : INK;
      for (let y = 0; y < h; y += px) {
        row.forEach((c, i) => c && ctx.fillRect(i * px, y, px, px));
        row = row.map((_, i) => {
          const l = row[(i - 1 + cols) % cols], c = row[i], rr = row[(i + 1) % cols];
          return (rule >> ((l << 2) | (c << 1) | rr)) & 1;
        });
      }
      this.label = `Rule ${rule}`;
    },
  },
  {
    name: "Glyph field",
    note: "Noise sampled on a grid and translated into type. Density becomes character.",
    draw(ctx, w, h, r, n) {
      fill(ctx, w, h, PAPER);
      const chars = " .·:-=+*%#@";
      const size = Math.max(6, Math.round(w / 22));
      ctx.font = `${size}px ui-monospace, monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const sc = 2 + r() * 2;
      for (let y = size / 2; y < h; y += size) {
        for (let x = size / 2; x < w; x += size * 0.7) {
          const v = n.fbm((x / w) * sc, (y / h) * sc);
          const ch = chars[Math.min(chars.length - 1, Math.floor(v * v * 1.6 * chars.length))];
          ctx.fillStyle = v > 0.72 ? "#7aa800" : INK;
          ctx.fillText(ch, x, y);
        }
      }
    },
  },
  {
    name: "Moiré",
    note: "Two sets of concentric rings, slightly offset. The pattern you see is in neither of them.",
    draw(ctx, w, h, r) {
      fill(ctx, w, h, r() > 0.5 ? PAPER : GREY);
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(0.6, w / 300);
      const gap = w / (40 + r() * 30);
      const centers = [
        [w * (0.35 + r() * 0.1), h * 0.5],
        [w * (0.55 + r() * 0.1), h * (0.45 + r() * 0.1)],
      ];
      for (const [cx, cy] of centers) {
        for (let rad = gap; rad < Math.max(w, h) * 1.2; rad += gap) {
          ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
        }
      }
    },
  },
  {
    name: "Signal stack",
    note: "Forty readings of the same noisy signal, stacked. Peaks rise where the noise agrees.",
    draw(ctx, w, h, r, n) {
      fill(ctx, w, h, DARK);
      const lines = 34;
      const gap = h / (lines + 6);
      ctx.lineWidth = Math.max(0.8, w / 520);
      for (let i = 0; i < lines; i++) {
        const y0 = gap * (i + 4);
        const pts = [];
        for (let x = 0; x <= w + 1; x += w / 120) {
          const mid = 1 - Math.min(1, Math.abs(x / w - 0.5) * 2.4);
          pts.push([x, y0 - n.fbm(x / w * 4, i * 0.21) * mid * mid * gap * 9]);
        }
        // Fill below the line to hide the ones behind, then stroke only the line
        ctx.beginPath();
        pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        ctx.fillStyle = DARK; ctx.fill();
        ctx.beginPath();
        pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.strokeStyle = i === lines - 8 ? ACID : PAPER; ctx.stroke();
      }
    },
  },
  {
    name: "Stipple",
    note: "Thousands of dots dropped at random, kept only where the field is dense enough.",
    draw(ctx, w, h, r, n) {
      fill(ctx, w, h, PAPER);
      const sc = 2 + r() * 2;
      const rad = Math.max(0.6, w / 300);
      ctx.fillStyle = INK;
      for (let i = 0; i < 9000; i++) {
        const x = r() * w, y = r() * h;
        const v = n.fbm((x / w) * sc, (y / h) * sc);
        if (r() < Math.pow(v, 3) * 2.4) { ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill(); }
      }
    },
  },
  {
    name: "Halftone",
    note: "Tone rebuilt from circles alone, the way newspapers printed photographs.",
    draw(ctx, w, h, r, n) {
      const acid = r() > 0.65;
      fill(ctx, w, h, acid ? ACID : PAPER);
      ctx.fillStyle = INK;
      const step = w / (14 + Math.floor(r() * 10));
      const sc = 1.5 + r() * 2;
      for (let y = step / 2; y < h; y += step) {
        for (let x = step / 2; x < w; x += step) {
          const v = n.fbm((x / w) * sc, (y / h) * sc);
          ctx.beginPath(); ctx.arc(x, y, Math.max(0, (v - 0.25)) * step * 0.95, 0, 7); ctx.fill();
        }
      }
    },
  },
  {
    name: "Warped lattice",
    note: "A perfect grid, displaced by noise. Order, slightly bent.",
    draw(ctx, w, h, r, n) {
      fill(ctx, w, h, PAPER);
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(0.6, w / 320);
      const k = 16 + Math.floor(r() * 10);
      const amp = w * (0.04 + r() * 0.06);
      const warp = (x, y) => {
        const a = n.fbm(x / w * 2.5, y / h * 2.5) - 0.5;
        const b = n.fbm(x / w * 2.5 + 9, y / h * 2.5 + 9) - 0.5;
        return [x + a * amp * 2, y + b * amp * 2];
      };
      for (let i = 0; i <= k; i++) {
        for (const vertical of [true, false]) {
          ctx.beginPath();
          for (let j = 0; j <= 60; j++) {
            const x = vertical ? (i / k) * w : (j / 60) * w;
            const y = vertical ? (j / 60) * h : (i / k) * h;
            const [px, py] = warp(x, y);
            j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
    },
  },
  {
    name: "Metaballs",
    note: "Invisible charges summed into one field, then thresholded into soft bodies.",
    draw(ctx, w, h, r) {
      fill(ctx, w, h, GREY);
      const balls = Array.from({ length: 5 + Math.floor(r() * 4) }, () => ({
        x: r() * w, y: r() * h, r: (0.08 + r() * 0.12) * w,
      }));
      cells(ctx, w, h, Math.max(1, Math.round(w / 200)), (x, y) => {
        let f = 0;
        for (const b of balls) f += (b.r * b.r) / ((x - b.x) ** 2 + (y - b.y) ** 2 + 1);
        if (f > 1.15) return INK;
        if (f > 0.95) return ACID;
        return null;
      });
    },
  },
  {
    name: "Spectrum",
    note: "A frequency readout from a signal that was never recorded.",
    draw(ctx, w, h, r, n) {
      fill(ctx, w, h, PAPER);
      const bars = 28 + Math.floor(r() * 30);
      const bw = w / bars;
      const hot = Math.floor(r() * bars);
      for (let i = 0; i < bars; i++) {
        const v = Math.pow(n.fbm(i * 0.18, r() * 0.05 + 3), 1.6) * 1.5;
        const bh = Math.min(1, v) * h * 0.9;
        ctx.fillStyle = i === hot ? ACID : INK;
        ctx.fillRect(i * bw + bw * 0.18, h - bh, bw * 0.64, bh);
      }
    },
  },
];

// Render generator `gi` with `seed` into a canvas of CSS size w×h
export function renderSpecimen(canvas, gi, seed, w, h, dpr = 1) {
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  const rand = rng(seed);
  const noise = makeNoise(rng(seed ^ 0x9e3779b9));
  const gen = GENERATORS[gi];
  gen.label = null;
  gen.draw(ctx, canvas.width, canvas.height, rand, noise);
  return gen.label;
}
