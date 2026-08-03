import { Cell } from '../entities/Cell';
import { FoodPellet } from '../entities/Food';
import { Virus } from '../entities/Virus';
import { WORLD } from '../utils/constants';

export class Renderer {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  camX = 0;
  camY = 0;
  zoom = 1;
  targetZoom = 1;
  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  setCamera(x: number, y: number, playerMass: number) {
    this.camX += (x - this.camX) * 0.14;
    this.camY += (y - this.camY) * 0.14;
    this.targetZoom = Math.max(0.14, Math.min(1.35, 1.05 / Math.pow(playerMass / 12, 0.17)));
    this.zoom += (this.targetZoom - this.zoom) * 0.07;
  }

  begin(dt: number) {
    this.time += dt;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const vw = w / devicePixelRatio;
    const vh = h / devicePixelRatio;
    ctx.translate(vw / 2, vh / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);
    this.drawGrid(vw, vh);
    this.drawBorder();
  }

  end() { this.ctx.restore(); }

  private drawGrid(vw: number, vh: number) {
    const ctx = this.ctx;
    const gs = 50;
    const left = this.camX - vw / (2 * this.zoom) - gs;
    const top = this.camY - vh / (2 * this.zoom) - gs;
    const right = this.camX + vw / (2 * this.zoom) + gs;
    const bottom = this.camY + vh / (2 * this.zoom) + gs;
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.055)';
    ctx.lineWidth = 1 / this.zoom;
    ctx.beginPath();
    for (let x = Math.floor(left / gs) * gs; x < right; x += gs) {
      ctx.moveTo(x, top); ctx.lineTo(x, bottom);
    }
    for (let y = Math.floor(top / gs) * gs; y < bottom; y += gs) {
      ctx.moveTo(left, y); ctx.lineTo(right, y);
    }
    ctx.stroke();
  }

  private drawBorder() {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
    ctx.lineWidth = 10 / this.zoom;
    ctx.strokeRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  drawFood(foods: FoodPellet[]) {
    const ctx = this.ctx;
    const viewR = 1800 / this.zoom;
    for (const f of foods) {
      if (!f.alive) continue;
      if (Math.abs(f.x - this.camX) > viewR || Math.abs(f.y - this.camY) > viewR * 0.75) continue;
      const pulse = 0.85 + Math.sin(this.time * 3.2 + f.id * 0.7) * 0.15;
      const r = 4.5 * pulse;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r * 2, 0, Math.PI * 2);
      ctx.fillStyle = f.color + '28';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fillStyle = f.color;
      ctx.fill();
    }
  }

  drawViruses(viruses: Virus[]) {
    const ctx = this.ctx;
    for (const v of viruses) {
      if (Math.abs(v.x - this.camX) > 2200 || Math.abs(v.y - this.camY) > 1600) continue;
      const spikes = 16, r = v.radius, rot = this.time * 0.35 + v.id;
      ctx.beginPath();
      for (let i = 0; i < spikes; i++) {
        const a1 = rot + (i / spikes) * Math.PI * 2;
        const a2 = rot + ((i + 0.5) / spikes) * Math.PI * 2;
        if (i === 0) ctx.moveTo(v.x + Math.cos(a1) * r * 1.18, v.y + Math.sin(a1) * r * 1.18);
        else ctx.lineTo(v.x + Math.cos(a1) * r * 1.18, v.y + Math.sin(a1) * r * 1.18);
        ctx.lineTo(v.x + Math.cos(a2) * r * 0.82, v.y + Math.sin(a2) * r * 0.82);
      }
      ctx.closePath();
      const grad = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, r);
      grad.addColorStop(0, '#86efac');
      grad.addColorStop(0.55, '#22c55e');
      grad.addColorStop(1, '#14532d');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.75)';
      ctx.lineWidth = 2 / this.zoom;
      ctx.stroke();
    }
  }

  drawCells(cells: { cell: Cell; isMe: boolean }[]) {
    const sorted = [...cells].sort((a, b) => a.cell.mass - b.cell.mass);
    const ctx = this.ctx;
    for (const { cell: c, isMe } of sorted) {
      if (Math.abs(c.x - this.camX) > 2800 || Math.abs(c.y - this.camY) > 2000) continue;
      const r = c.radius;
      ctx.beginPath();
      ctx.arc(c.x + 3, c.y + 5, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fill();
      const grad = ctx.createRadialGradient(c.x - r * 0.28, c.y - r * 0.28, r * 0.08, c.x, c.y, r);
      grad.addColorStop(0, this.lighten(c.color, 45));
      grad.addColorStop(0.45, c.color);
      grad.addColorStop(1, this.darken(c.color, 35));
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x - r * 0.22, c.y - r * 0.28, r * 0.32, r * 0.18, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = isMe ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.22)';
      ctx.lineWidth = (isMe ? 3.5 : 2) / this.zoom;
      ctx.stroke();
      if (r * this.zoom > 16) {
        const fontSize = Math.max(11, Math.min(26, r * 0.32)) / this.zoom;
        ctx.font = `600 ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillText(c.name, c.x + 1, c.y - fontSize * 0.3 + 1);
        ctx.fillStyle = '#fff';
        ctx.fillText(c.name, c.x, c.y - fontSize * 0.3);
        if (r * this.zoom > 26) {
          const massStr = String(Math.round(c.mass));
          ctx.font = `500 ${fontSize * 0.72}px Inter, sans-serif`;
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillText(massStr, c.x + 1, c.y + fontSize * 0.42 + 1);
          ctx.fillStyle = 'rgba(255,255,255,0.88)';
          ctx.fillText(massStr, c.x, c.y + fontSize * 0.42);
        }
      }
    }
  }

  private lighten(hex: string, pct: number): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${Math.min(255, (n >> 16) + pct)},${Math.min(255, ((n >> 8) & 0xff) + pct)},${Math.min(255, (n & 0xff) + pct)})`;
  }

  private darken(hex: string, pct: number): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${Math.max(0, (n >> 16) - pct)},${Math.max(0, ((n >> 8) & 0xff) - pct)},${Math.max(0, (n & 0xff) - pct)})`;
  }
}
