import { CellData, FoodData, VirusData, WORLD } from '../../../shared/src/index';

export class Renderer {
  ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement;
  camX = 0; camY = 0; zoom = 1; targetZoom = 1; private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }
  setCamera(x: number, y: number, playerMass: number) {
    this.camX += (x - this.camX) * 0.12;
    this.camY += (y - this.camY) * 0.12;
    this.targetZoom = Math.max(0.12, Math.min(1.4, 1.1 / Math.pow(playerMass / 10, 0.18)));
    this.zoom += (this.targetZoom - this.zoom) * 0.06;
  }
  begin(dt: number) {
    this.time += dt;
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.fillStyle = '#0a0f0a'; ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const vw = w / devicePixelRatio, vh = h / devicePixelRatio;
    ctx.translate(vw / 2, vh / 2); ctx.scale(this.zoom, this.zoom); ctx.translate(-this.camX, -this.camY);
    this.drawGrid(vw, vh); this.drawBorder();
  }
  end() { this.ctx.restore(); }
  private drawGrid(vw: number, vh: number) {
    const ctx = this.ctx, gs = 50;
    const left = this.camX - vw / (2 * this.zoom) - gs;
    const top = this.camY - vh / (2 * this.zoom) - gs;
    const right = this.camX + vw / (2 * this.zoom) + gs;
    const bottom = this.camY + vh / (2 * this.zoom) + gs;
    ctx.strokeStyle = 'rgba(74,222,128,0.06)'; ctx.lineWidth = 1 / this.zoom;
    ctx.beginPath();
    for (let x = Math.floor(left / gs) * gs; x < right; x += gs) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
    for (let y = Math.floor(top / gs) * gs; y < bottom; y += gs) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
    ctx.stroke();
  }
  private drawBorder() {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(74,222,128,0.35)'; ctx.lineWidth = 8 / this.zoom;
    ctx.strokeRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }
  drawFood(foods: FoodData[]) {
    const ctx = this.ctx;
    for (const f of foods) {
      if (Math.abs(f.x - this.camX) > 2000 || Math.abs(f.y - this.camY) > 1500) continue;
      const pulse = 0.85 + Math.sin(this.time * 3 + f.id) * 0.15;
      const r = 5 * pulse;
      ctx.beginPath(); ctx.arc(f.x, f.y, r * 2.2, 0, Math.PI * 2); ctx.fillStyle = f.color + '33'; ctx.fill();
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fillStyle = f.color; ctx.fill();
    }
  }
  drawViruses(viruses: VirusData[]) {
    const ctx = this.ctx;
    for (const v of viruses) {
      if (Math.abs(v.x - this.camX) > 2500 || Math.abs(v.y - this.camY) > 1800) continue;
      const spikes = 16, r = v.radius, rot = this.time * 0.4 + v.id;
      ctx.beginPath();
      for (let i = 0; i < spikes; i++) {
        const a1 = rot + (i / spikes) * Math.PI * 2;
        const a2 = rot + ((i + 0.5) / spikes) * Math.PI * 2;
        if (i === 0) ctx.moveTo(v.x + Math.cos(a1) * r * 1.15, v.y + Math.sin(a1) * r * 1.15);
        else ctx.lineTo(v.x + Math.cos(a1) * r * 1.15, v.y + Math.sin(a1) * r * 1.15);
        ctx.lineTo(v.x + Math.cos(a2) * r * 0.85, v.y + Math.sin(a2) * r * 0.85);
      }
      ctx.closePath();
      const grad = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, r);
      grad.addColorStop(0, '#86efac'); grad.addColorStop(0.6, '#22c55e'); grad.addColorStop(1, '#166534');
      ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = 'rgba(34,197,94,0.8)'; ctx.lineWidth = 2 / this.zoom; ctx.stroke();
    }
  }
  drawCells(cells: CellData[], myId: string) {
    const sorted = [...cells].sort((a, b) => a.mass - b.mass);
    const ctx = this.ctx;
    for (const c of sorted) {
      if (Math.abs(c.x - this.camX) > 3000 || Math.abs(c.y - this.camY) > 2200) continue;
      const r = c.radius, isMe = c.ownerId === myId;
      ctx.beginPath(); ctx.arc(c.x + 4, c.y + 6, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
      const grad = ctx.createRadialGradient(c.x - r * 0.3, c.y - r * 0.3, r * 0.1, c.x, c.y, r);
      grad.addColorStop(0, this.lighten(c.color, 40)); grad.addColorStop(0.5, c.color); grad.addColorStop(1, this.darken(c.color, 30));
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); ctx.ellipse(c.x - r * 0.25, c.y - r * 0.3, r * 0.35, r * 0.2, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = isMe ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.25)';
      ctx.lineWidth = (isMe ? 3 : 2) / this.zoom; ctx.stroke();
      if (r * this.zoom > 18) {
        const fontSize = Math.max(12, Math.min(28, r * 0.35)) / this.zoom;
        ctx.font = `600 ${fontSize}px Inter,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(c.name || '', c.x + 1, c.y - fontSize * 0.35 + 1);
        ctx.fillStyle = '#fff'; ctx.fillText(c.name || '', c.x, c.y - fontSize * 0.35);
        if (r * this.zoom > 28) {
          const massStr = Math.round(c.mass).toString();
          ctx.font = `500 ${fontSize * 0.75}px Inter,sans-serif`;
          ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(massStr, c.x + 1, c.y + fontSize * 0.45 + 1);
          ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(massStr, c.x, c.y + fontSize * 0.45);
        }
      }
    }
  }
  private lighten(hex: string, pct: number) {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${Math.min(255,(n>>16)+pct)},${Math.min(255,((n>>8)&0xff)+pct)},${Math.min(255,(n&0xff)+pct)})`;
  }
  private darken(hex: string, pct: number) {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${Math.max(0,(n>>16)-pct)},${Math.max(0,((n>>8)&0xff)-pct)},${Math.max(0,(n&0xff)-pct)})`;
  }
}
