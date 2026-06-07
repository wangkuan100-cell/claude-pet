// Deterministic local art pass for the expanded pet roster.
// This keeps new pets usable without requiring an image API key; the OpenAI art pipeline can
// still replace these PNGs later with richer handoff-quality images.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SIZE = 256;
const SS = 3;
const W = SIZE * SS;
const H = SIZE * SS;

const FORMS = ['hatchling', 'juvenile', 'adolescent', 'adult', 'legendary'];
const FORM_SCALE = { hatchling: 0.68, juvenile: 0.8, adolescent: 0.92, adult: 1.03, legendary: 1.13 };
const EXPANDED_PETS = {
  unicorn: {
    body: '#fff3fb', shade: '#f6cde9', accent: '#e88ecb', accent2: '#91d7ff', dark: '#72538f', metal: '#f8cf61',
  },
  griffin: {
    body: '#f3c86f', shade: '#d88a48', accent: '#fff0bd', accent2: '#8d643c', dark: '#6c4726', metal: '#ffcf54',
  },
  pegasus: {
    body: '#f6fbff', shade: '#b9ddff', accent: '#8cc9ff', accent2: '#d7ecff', dark: '#526d9f', metal: '#c8d8ff',
  },
  leviathan: {
    body: '#6fd7e8', shade: '#2aa9c5', accent: '#b8fff3', accent2: '#4f7edc', dark: '#245778', metal: '#f0e1a2',
  },
  basilisk: {
    body: '#7dd36e', shade: '#3e9d5b', accent: '#f7d36a', accent2: '#c8ef8a', dark: '#315f38', metal: '#ffe07b',
  },
  mandrake: {
    body: '#c9955b', shade: '#8f623e', accent: '#6ecf6a', accent2: '#a7e86f', dark: '#5d3b29', metal: '#f2d064',
  },
};

function hexColor(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
    a: alpha,
  };
}

function clamp(value, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

function seedFrom(text) {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pixelNoise(seed, x, y) {
  let n = seed ^ Math.imul(x + 101, 374761393) ^ Math.imul(y + 503, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function blend(buf, x, y, color, coverage = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H || coverage <= 0) return;
  const i = (Math.floor(y) * W + Math.floor(x)) * 4;
  const sa = (color.a / 255) * coverage;
  const da = buf[i + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return;
  buf[i] = Math.round((color.r * sa + buf[i] * da * (1 - sa)) / outA);
  buf[i + 1] = Math.round((color.g * sa + buf[i + 1] * da * (1 - sa)) / outA);
  buf[i + 2] = Math.round((color.b * sa + buf[i + 2] * da * (1 - sa)) / outA);
  buf[i + 3] = Math.round(outA * 255);
}

function ellipse(buf, cx, cy, rx, ry, fill, alpha = 255) {
  const color = hexColor(fill, alpha);
  const minX = Math.floor((cx - rx - 1) * SS);
  const maxX = Math.ceil((cx + rx + 1) * SS);
  const minY = Math.floor((cy - ry - 1) * SS);
  const maxY = Math.ceil((cy + ry + 1) * SS);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = (x + 0.5) / SS;
      const py = (y + 0.5) / SS;
      const d = ((px - cx) ** 2) / (rx ** 2) + ((py - cy) ** 2) / (ry ** 2);
      if (d <= 1.12) blend(buf, x, y, color, Math.max(0, Math.min(1, (1.12 - d) / 0.12)));
    }
  }
}

function rotatedEllipse(buf, cx, cy, rx, ry, angle, fill, alpha = 255) {
  const color = hexColor(fill, alpha);
  const radius = Math.max(rx, ry) + 2;
  const minX = Math.floor((cx - radius) * SS);
  const maxX = Math.ceil((cx + radius) * SS);
  const minY = Math.floor((cy - radius) * SS);
  const maxY = Math.ceil((cy + radius) * SS);
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = (x + 0.5) / SS - cx;
      const py = (y + 0.5) / SS - cy;
      const lx = px * ca + py * sa;
      const ly = -px * sa + py * ca;
      const d = (lx ** 2) / (rx ** 2) + (ly ** 2) / (ry ** 2);
      if (d <= 1.12) blend(buf, x, y, color, Math.max(0, Math.min(1, (1.12 - d) / 0.12)));
    }
  }
}

function polygon(buf, points, fill, alpha = 255) {
  const color = hexColor(fill, alpha);
  const scaled = points.map(([x, y]) => [x * SS, y * SS]);
  const minX = Math.floor(Math.min(...scaled.map((p) => p[0])));
  const maxX = Math.ceil(Math.max(...scaled.map((p) => p[0])));
  const minY = Math.floor(Math.min(...scaled.map((p) => p[1])));
  const maxY = Math.ceil(Math.max(...scaled.map((p) => p[1])));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let inside = false;
      for (let i = 0, j = scaled.length - 1; i < scaled.length; j = i++) {
        const [xi, yi] = scaled[i];
        const [xj, yj] = scaled[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) blend(buf, x, y, color, 1);
    }
  }
}

function circleLine(buf, points, width, fill, alpha = 255) {
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 1.3));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      ellipse(buf, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, width / 2, fill, alpha);
    }
  }
}

function star(buf, cx, cy, r, fill, alpha = 255) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  polygon(buf, pts, fill, alpha);
}

function eye(buf, cx, cy, s, dark) {
  ellipse(buf, cx, cy, s * 0.82, s, '#fff8ee');
  ellipse(buf, cx, cy + s * 0.04, s * 0.52, s * 0.68, dark);
  ellipse(buf, cx - s * 0.18, cy - s * 0.22, s * 0.16, s * 0.16, '#ffffff');
}

function face(buf, cx, cy, scale, dark) {
  eye(buf, cx - 15 * scale, cy - 1 * scale, 8.5 * scale, dark);
  eye(buf, cx + 15 * scale, cy - 1 * scale, 8.5 * scale, dark);
  ellipse(buf, cx - 25 * scale, cy + 16 * scale, 5 * scale, 3 * scale, '#ffadad', 115);
  ellipse(buf, cx + 25 * scale, cy + 16 * scale, 5 * scale, 3 * scale, '#ffadad', 115);
  circleLine(buf, [[cx - 6 * scale, cy + 15 * scale], [cx, cy + 19 * scale], [cx + 6 * scale, cy + 15 * scale]], 2.2 * scale, dark, 185);
}

function wings(buf, cx, cy, scale, cfg, pose, soft = false) {
  const lift = [0.12, -0.35, 0.42, -0.08][pose] || 0;
  const leftAngle = -0.72 + lift;
  const rightAngle = 0.72 - lift;
  const wing = (side, angle) => {
    const sx = side < 0 ? -1 : 1;
    rotatedEllipse(buf, cx + sx * 39 * scale, cy + 6 * scale, 20 * scale, 43 * scale, sx * angle, cfg.accent2, 210);
    rotatedEllipse(buf, cx + sx * 50 * scale, cy + 18 * scale, 12 * scale, 31 * scale, sx * (angle + 0.18), soft ? '#ffffff' : cfg.accent, 190);
    rotatedEllipse(buf, cx + sx * 33 * scale, cy + 24 * scale, 10 * scale, 23 * scale, sx * (angle - 0.12), '#ffffff', 150);
  };
  wing(-1, leftAngle);
  wing(1, rightAngle);
}

function legs(buf, cx, cy, scale, cfg, pose = 0) {
  const step = [0, -4, 4, -2][pose] || 0;
  circleLine(buf, [[cx - 15 * scale, cy + 24 * scale], [cx - 18 * scale, cy + (43 + step) * scale]], 8 * scale, cfg.shade);
  circleLine(buf, [[cx + 15 * scale, cy + 24 * scale], [cx + 18 * scale, cy + (43 - step) * scale]], 8 * scale, cfg.shade);
  ellipse(buf, cx - 20 * scale, cy + (45 + step) * scale, 10 * scale, 5 * scale, cfg.dark, 190);
  ellipse(buf, cx + 20 * scale, cy + (45 - step) * scale, 10 * scale, 5 * scale, cfg.dark, 190);
}

function crown(buf, cx, cy, scale, fill) {
  polygon(buf, [[cx - 18 * scale, cy], [cx - 10 * scale, cy - 13 * scale], [cx, cy - 2 * scale], [cx + 10 * scale, cy - 13 * scale], [cx + 18 * scale, cy]], fill);
  ellipse(buf, cx, cy + 1 * scale, 20 * scale, 5 * scale, fill);
}

function drawUnicorn(buf, form, pose) {
  const cfg = EXPANDED_PETS.unicorn;
  const s = FORM_SCALE[form];
  const cx = 128;
  const headY = 94 - (s - 1) * 10;
  const bodyY = 160;
  circleLine(buf, [[cx + 22 * s, headY + 20 * s], [cx + 46 * s, headY + 46 * s], [cx + 34 * s, headY + 80 * s]], 11 * s, cfg.accent);
  ellipse(buf, cx, bodyY, 36 * s, 42 * s, cfg.body);
  legs(buf, cx, bodyY, s, cfg, pose);
  ellipse(buf, cx, headY, 43 * s, 40 * s, cfg.body);
  polygon(buf, [[cx - 24 * s, headY - 29 * s], [cx - 32 * s, headY - 55 * s], [cx - 8 * s, headY - 35 * s]], cfg.body);
  polygon(buf, [[cx + 24 * s, headY - 29 * s], [cx + 32 * s, headY - 55 * s], [cx + 8 * s, headY - 35 * s]], cfg.body);
  polygon(buf, [[cx, headY - 39 * s], [cx - 9 * s, headY - 76 * s], [cx + 10 * s, headY - 39 * s]], form === 'legendary' ? cfg.metal : cfg.accent2);
  circleLine(buf, [[cx - 10 * s, headY - 34 * s], [cx - 22 * s, headY - 14 * s], [cx - 16 * s, headY + 25 * s]], 12 * s, cfg.accent);
  circleLine(buf, [[cx - 3 * s, headY - 34 * s], [cx - 13 * s, headY - 10 * s], [cx - 8 * s, headY + 24 * s]], 7 * s, cfg.accent2);
  if (form === 'legendary') {
    crown(buf, cx + 20 * s, headY - 35 * s, s * 0.75, cfg.metal);
    star(buf, cx - 54, headY - 25, 7, cfg.metal, 175);
  }
  face(buf, cx, headY + 5 * s, s, cfg.dark);
}

function drawGriffin(buf, form, pose) {
  const cfg = EXPANDED_PETS.griffin;
  const s = FORM_SCALE[form];
  const cx = 128;
  const headY = 95 - (s - 1) * 8;
  const bodyY = 160;
  wings(buf, cx, bodyY - 24 * s, s, cfg, pose);
  circleLine(buf, [[cx + 28 * s, bodyY + 3 * s], [cx + 55 * s, bodyY + 18 * s], [cx + 50 * s, bodyY + 43 * s]], 13 * s, cfg.shade);
  ellipse(buf, cx, bodyY, 39 * s, 44 * s, cfg.body);
  legs(buf, cx, bodyY, s, cfg, pose);
  ellipse(buf, cx, headY, 42 * s, 38 * s, cfg.accent);
  polygon(buf, [[cx, headY + 5 * s], [cx - 10 * s, headY + 18 * s], [cx + 10 * s, headY + 18 * s]], '#f1a548');
  rotatedEllipse(buf, cx - 18 * s, headY - 35 * s, 10 * s, 18 * s, -0.55, cfg.body);
  rotatedEllipse(buf, cx + 18 * s, headY - 35 * s, 10 * s, 18 * s, 0.55, cfg.body);
  circleLine(buf, [[cx - 16 * s, headY - 36 * s], [cx, headY - 48 * s], [cx + 16 * s, headY - 36 * s]], 7 * s, cfg.metal, 220);
  if (form === 'legendary') {
    crown(buf, cx, headY - 40 * s, s * 0.75, cfg.metal);
    star(buf, cx + 50, headY - 24, 8, cfg.metal, 160);
  }
  face(buf, cx, headY + 4 * s, s, cfg.dark);
}

function drawPegasus(buf, form, pose) {
  const cfg = EXPANDED_PETS.pegasus;
  const s = FORM_SCALE[form];
  const cx = 128;
  const headY = 96 - (s - 1) * 8;
  const bodyY = 160;
  wings(buf, cx, bodyY - 22 * s, s, cfg, pose, true);
  ellipse(buf, cx, bodyY, 37 * s, 42 * s, cfg.body);
  legs(buf, cx, bodyY, s, cfg, pose);
  ellipse(buf, cx, headY, 42 * s, 39 * s, cfg.body);
  polygon(buf, [[cx - 24 * s, headY - 28 * s], [cx - 31 * s, headY - 52 * s], [cx - 8 * s, headY - 34 * s]], cfg.body);
  polygon(buf, [[cx + 24 * s, headY - 28 * s], [cx + 31 * s, headY - 52 * s], [cx + 8 * s, headY - 34 * s]], cfg.body);
  circleLine(buf, [[cx - 12 * s, headY - 33 * s], [cx - 22 * s, headY - 8 * s], [cx - 12 * s, headY + 23 * s]], 11 * s, cfg.accent);
  circleLine(buf, [[cx + 26 * s, bodyY + 14 * s], [cx + 55 * s, bodyY + 4 * s], [cx + 59 * s, bodyY + 30 * s]], 10 * s, cfg.accent);
  if (form === 'legendary') {
    crown(buf, cx, headY - 38 * s, s * 0.72, cfg.metal);
    star(buf, cx - 52, bodyY - 58, 7, '#fff6a0', 170);
  }
  face(buf, cx, headY + 5 * s, s, cfg.dark);
}

function drawLeviathan(buf, form, pose) {
  const cfg = EXPANDED_PETS.leviathan;
  const s = FORM_SCALE[form];
  const cx = 128;
  const headY = 102 - (s - 1) * 8;
  const wave = [0, -7, 7, -3][pose] || 0;
  circleLine(buf, [[cx - 12 * s, 150], [cx + 31 * s, 171 + wave], [cx + 61 * s, 144 - wave], [cx + 47 * s, 116]], 25 * s, cfg.body);
  rotatedEllipse(buf, cx + 68 * s, 137 - wave, 10 * s, 25 * s, 0.75, cfg.accent2, 210);
  rotatedEllipse(buf, cx - 6 * s, 158, 18 * s, 36 * s, -0.25, cfg.shade, 160);
  ellipse(buf, cx - 6 * s, headY + 4 * s, 43 * s, 39 * s, cfg.body);
  rotatedEllipse(buf, cx - 34 * s, headY + 8 * s, 10 * s, 22 * s, -0.55, cfg.accent, 220);
  rotatedEllipse(buf, cx + 26 * s, headY + 8 * s, 10 * s, 22 * s, 0.55, cfg.accent, 220);
  polygon(buf, [[cx - 17 * s, headY - 31 * s], [cx - 24 * s, headY - 49 * s], [cx - 6 * s, headY - 34 * s]], cfg.accent2);
  polygon(buf, [[cx + 14 * s, headY - 31 * s], [cx + 21 * s, headY - 49 * s], [cx + 5 * s, headY - 34 * s]], cfg.accent2);
  if (form === 'legendary') {
    crown(buf, cx + 2 * s, headY - 36 * s, s * 0.7, cfg.metal);
    star(buf, cx + 54, headY - 28, 7, '#d9ffff', 170);
  }
  face(buf, cx - 4 * s, headY + 6 * s, s, cfg.dark);
}

function drawBasilisk(buf, form, pose) {
  const cfg = EXPANDED_PETS.basilisk;
  const s = FORM_SCALE[form];
  const cx = 128;
  const headY = 96 - (s - 1) * 8;
  const bodyY = 160;
  const tailShift = [0, 5, -5, 2][pose] || 0;
  circleLine(buf, [[cx + 25 * s, bodyY + 16 * s], [cx + 62 * s, bodyY + 2 * s + tailShift], [cx + 57 * s, bodyY - 29 * s - tailShift]], 13 * s, cfg.shade);
  ellipse(buf, cx, bodyY, 37 * s, 43 * s, cfg.body);
  legs(buf, cx, bodyY, s, cfg, pose);
  ellipse(buf, cx, headY, 42 * s, 39 * s, cfg.body);
  circleLine(buf, [[cx - 20 * s, headY - 35 * s], [cx - 2 * s, headY - 55 * s], [cx + 20 * s, headY - 35 * s]], 8 * s, cfg.accent, 220);
  rotatedEllipse(buf, cx - 26 * s, headY - 6 * s, 9 * s, 18 * s, -0.85, cfg.accent2, 180);
  rotatedEllipse(buf, cx + 26 * s, headY - 6 * s, 9 * s, 18 * s, 0.85, cfg.accent2, 180);
  if (form === 'legendary') {
    crown(buf, cx, headY - 39 * s, s * 0.72, cfg.metal);
    star(buf, cx + 49, headY - 19, 7, cfg.metal, 160);
  }
  face(buf, cx, headY + 5 * s, s, cfg.dark);
}

function drawMandrake(buf, form, pose) {
  const cfg = EXPANDED_PETS.mandrake;
  const s = FORM_SCALE[form];
  const cx = 128;
  const headY = 101 - (s - 1) * 8;
  const bodyY = 162;
  circleLine(buf, [[cx - 22 * s, bodyY + 10 * s], [cx - 48 * s, bodyY + 1 * s]], 9 * s, cfg.shade);
  circleLine(buf, [[cx + 22 * s, bodyY + 10 * s], [cx + 48 * s, bodyY + 1 * s]], 9 * s, cfg.shade);
  ellipse(buf, cx, bodyY, 36 * s, 47 * s, cfg.body);
  circleLine(buf, [[cx - 14 * s, bodyY + 35 * s], [cx - 23 * s, bodyY + 55 * s]], 8 * s, cfg.shade);
  circleLine(buf, [[cx + 14 * s, bodyY + 35 * s], [cx + 23 * s, bodyY + 55 * s]], 8 * s, cfg.shade);
  ellipse(buf, cx, headY, 40 * s, 38 * s, cfg.body);
  const leafLift = [0, -6, 5, -2][pose] || 0;
  rotatedEllipse(buf, cx - 22 * s, headY - 42 * s + leafLift, 12 * s, 31 * s, -0.75, cfg.accent);
  rotatedEllipse(buf, cx, headY - 48 * s - leafLift, 13 * s, 36 * s, 0, cfg.accent2);
  rotatedEllipse(buf, cx + 22 * s, headY - 42 * s + leafLift, 12 * s, 31 * s, 0.75, cfg.accent);
  if (form === 'legendary') {
    crown(buf, cx, headY - 35 * s, s * 0.65, '#8be15e');
    star(buf, cx - 52, headY - 24, 7, '#dcff8b', 160);
    star(buf, cx + 50, bodyY - 52, 6, '#dcff8b', 140);
  }
  face(buf, cx, headY + 6 * s, s, cfg.dark);
}

const DRAWERS = {
  unicorn: drawUnicorn,
  griffin: drawGriffin,
  pegasus: drawPegasus,
  leviathan: drawLeviathan,
  basilisk: drawBasilisk,
  mandrake: drawMandrake,
};

function downsample(buf) {
  const out = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let r = 0; let g = 0; let b = 0; let a = 0;
      for (let yy = 0; yy < SS; yy++) {
        for (let xx = 0; xx < SS; xx++) {
          const i = ((y * SS + yy) * W + (x * SS + xx)) * 4;
          r += buf[i];
          g += buf[i + 1];
          b += buf[i + 2];
          a += buf[i + 3];
        }
      }
      const o = (y * SIZE + x) * 4;
      out[o] = Math.round(r / (SS * SS));
      out[o + 1] = Math.round(g / (SS * SS));
      out[o + 2] = Math.round(b / (SS * SS));
      out[o + 3] = Math.round(a / (SS * SS));
    }
  }
  return out;
}

function crc32(buf) {
  let crc = -1;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return out;
}

function pngBuffer(rgba, width, height) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    header,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function paintedAura(buf, line, form, pose) {
  const cfg = EXPANDED_PETS[line];
  const rnd = mulberry32(seedFrom(`${line}:${form}:${pose}:aura`));
  const strength = form === 'legendary' ? 1 : 0.68;
  for (let i = 0; i < 26; i++) {
    const r = rnd();
    const cx = 128 + (rnd() - 0.5) * 32;
    const cy = 137 + (rnd() - 0.5) * 28;
    const rx = (46 + rnd() * 50) * FORM_SCALE[form];
    const ry = (45 + rnd() * 48) * FORM_SCALE[form];
    const color = r > 0.62 ? cfg.accent2 : r > 0.28 ? cfg.accent : '#ffffff';
    ellipse(buf, cx, cy, rx, ry, color, Math.round((5 + rnd() * 12) * strength));
  }
}

function paintedDabs(buf, line, form, pose) {
  const cfg = EXPANDED_PETS[line];
  const rnd = mulberry32(seedFrom(`${line}:${form}:${pose}:dabs`));
  const s = FORM_SCALE[form];
  const count = form === 'legendary' ? 360 : 260;
  const palette = ['#ffffff', cfg.body, cfg.shade, cfg.accent, cfg.accent2, cfg.metal];
  for (let i = 0; i < count; i++) {
    const angle = rnd() * Math.PI * 2;
    const radius = Math.pow(rnd(), 0.72) * (54 + 36 * s);
    const cx = 128 + Math.cos(angle) * radius * (0.74 + rnd() * 0.34);
    const cy = 136 + Math.sin(angle) * radius * (0.68 + rnd() * 0.38);
    const rx = 1.2 + rnd() * 5.6;
    const ry = 0.8 + rnd() * 4.4;
    const color = palette[Math.floor(rnd() * palette.length)];
    const alpha = Math.round(5 + rnd() * (form === 'legendary' ? 26 : 20));
    rotatedEllipse(buf, cx, cy, rx, ry, rnd() * Math.PI, color, alpha);
  }
}

function painterlyFinish(buf, line, form, pose) {
  const cfg = EXPANDED_PETS[line];
  const seed = seedFrom(`${line}:${form}:${pose}:grain`);
  const rim = hexColor(cfg.accent2);
  for (let y = 0; y < H; y++) {
    const ny = y / H;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = buf[i + 3];
      if (a === 0) continue;

      const nx = x / W;
      const n1 = pixelNoise(seed, x, y) - 0.5;
      const n2 = pixelNoise(seed ^ 0x9e3779b9, Math.floor(x / 5), Math.floor(y / 5)) - 0.5;
      const topLeftLight = 34 * (1 - ny) + 15 * (1 - nx);
      const lowerShade = -30 * ny + 8 * Math.sin((nx * 8 + ny * 5 + pose) * Math.PI);
      const airbrush = n1 * 20 + n2 * 18;
      const transparentEdgeBoost = a < 90 ? 18 : 0;
      const delta = topLeftLight + lowerShade + airbrush + transparentEdgeBoost;

      buf[i] = clamp(Math.round(buf[i] + delta + (rim.r - buf[i]) * (a < 120 ? 0.045 : 0.015)));
      buf[i + 1] = clamp(Math.round(buf[i + 1] + delta + (rim.g - buf[i + 1]) * (a < 120 ? 0.045 : 0.015)));
      buf[i + 2] = clamp(Math.round(buf[i + 2] + delta + (rim.b - buf[i + 2]) * (a < 120 ? 0.045 : 0.015)));
      buf[i + 3] = clamp(Math.round(a + n1 * 10), 0, 255);
    }
  }
}

function render(line, form, pose = 0) {
  const buf = Buffer.alloc(W * H * 4);
  paintedAura(buf, line, form, pose);
  DRAWERS[line](buf, form, pose);
  paintedDabs(buf, line, form, pose);
  painterlyFinish(buf, line, form, pose);
  return pngBuffer(downsample(buf), SIZE, SIZE);
}

const only = process.argv[2];
const lines = only ? [only] : Object.keys(EXPANDED_PETS);
let written = 0;

for (const line of lines) {
  if (!DRAWERS[line]) throw new Error(`Unknown expanded pet: ${line}`);
  const dir = path.join('assets', line);
  fs.mkdirSync(dir, { recursive: true });
  for (const form of FORMS) {
    fs.writeFileSync(path.join(dir, `${form}.png`), render(line, form, 0));
    written += 1;
  }
  for (let pose = 1; pose <= 3; pose++) {
    fs.writeFileSync(path.join(dir, `legendary_pose${pose + 1}.png`), render(line, 'legendary', pose));
    written += 1;
  }
}

console.log(`Generated ${written} local transparent PNG sprites for ${lines.length} expanded pets.`);
