const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const massToRadius = m => Math.sqrt(m) * 6 + 4;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const randColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];
const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}
