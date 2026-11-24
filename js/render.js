const Render = {
  canvas: null, ctx: null, w: 0, h: 0, dpr: 1,
  camX: 0, camY: 0, zoom: 1, mini: null, mctx: null,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mini = document.getElementById('minimap');
    this.mctx = this.mini.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
  },

  screenToWorld(sx, sy) {
    return { x: (sx - this.w / 2) / this.zoom + this.camX, y: (sy - this.h / 2) / this.zoom + this.camY };
  },

  updateCamera(world, dt) {
    const p = world.player;
    if (p && p.alive) {
      const c = p.center();
      this.camX = c.x;
      this.camY = c.y;
      const m = p.mass;
      const target = clamp(Math.pow(Math.min(this.w, this.h) / (260 + Math.sqrt(m) * 26), 1), 0.18, 1.4) * Input.zoomMul;
      this.zoom += (target - this.zoom) * (1 - Math.exp(-dt * 3.5));
    }
  },

  draw(world) {
    const ctx = this.ctx, W = CFG.WORLD;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#cfdbe3';
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);

    const vw = this.w / this.zoom / 2 + 100, vh = this.h / this.zoom / 2 + 100;
    const inView = (x, y, r) => Math.abs(x - this.camX) < vw + r && Math.abs(y - this.camY) < vh + r;

    // world bounds + grid
    ctx.fillStyle = '#f2fbff';
    ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 1 / this.zoom;
    const step = 25;
    const x0 = Math.max(0, Math.floor((this.camX - vw) / step) * step), x1 = Math.min(W, this.camX + vw);
    const y0 = Math.max(0, Math.floor((this.camY - vh) / step) * step), y1 = Math.min(W, this.camY + vh);
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = y0; y <= y1; y += step) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,77,109,0.7)'; ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, W, W);

    // food
    for (const f of world.foods) {
      if (!inView(f.x, f.y, 10)) continue;
      ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fill();
    }
    // pellets
    for (const p of world.pellets) {
      if (!inView(p.x, p.y, 20)) continue;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
    }

    // collect and sort all cells by size so small ones draw on top
    const all = [];
    for (const b of world.blobs) if (b.alive) for (const c of b.cells) if (inView(c.x, c.y, c.r)) all.push(c);
    for (const v of world.viruses) if (inView(v.x, v.y, v.r)) all.push({ virus: v, mass: v.mass });
    all.sort((a, b) => a.mass - b.mass);

    for (const it of all) {
      if (it.virus) this.drawVirus(it.virus);
      else this.drawCell(it);
    }
    this.drawArrow(world);
    ctx.restore();

    this.drawMinimap(world);
  },

  // Small flat gray arrowhead floating just outside your cells, pointing where you are heading
  drawArrow(world) {
    const p = world.player;
    if (!p || !p.alive) return;
    const c = p.center();
    const dx = p.targetX - c.x, dy = p.targetY - c.y, d = Math.hypot(dx, dy);
    if (d < 10) return;
    const a = Math.atan2(dy, dx);
    this._aa = this._aa === undefined ? a : this._aa + Math.atan2(Math.sin(a - this._aa), Math.cos(a - this._aa)) * 0.35;
    let ext = 0;
    for (const k of p.cells) ext = Math.max(ext, Math.hypot(k.x - c.x, k.y - c.y) + k.r);
    const z = this.zoom, size = 10 / z, gap = ext + 22 / z;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(this._aa);
    ctx.globalAlpha = Math.min(1, d * z / 60) * 0.6;
    ctx.beginPath();
    ctx.moveTo(gap + size * 1.1, 0);
    ctx.lineTo(gap - size * 0.6, -size * 0.85);
    ctx.lineTo(gap - size * 0.6, size * 0.85);
    ctx.closePath();
    ctx.fillStyle = '#868b92';
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3 / z;
    ctx.strokeStyle = '#868b92';
    ctx.stroke();
    ctx.restore();
  },

  drawVirus(v) {
    const ctx = this.ctx, spikes = 22;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const r = i % 2 ? v.r * 0.9 : v.r * 1.08;
      ctx.lineTo(v.x + Math.cos(a) * r, v.y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#3ddc4a'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#1a9a26'; ctx.stroke();
  },

  cellPath(c) {
    const ctx = this.ctx, N = JN, t = performance.now() / 1000;
    const pts = this._pts || (this._pts = new Float32Array(N * 2));
    for (let i = 0; i < N; i++) {
      const rr = c.r * 1.005 * (1 + c.off[i] + Math.sin(t * 2.2 + i * 0.9 + c.id) * 0.004);
      pts[i * 2] = c.x + JCOS[i] * rr;
      pts[i * 2 + 1] = c.y + JSIN[i] * rr;
    }
    const L = (N - 1) * 2;
    ctx.moveTo((pts[L] + pts[0]) / 2, (pts[L + 1] + pts[1]) / 2);
    for (let i = 0; i < N; i++) {
      const j = ((i + 1) % N) * 2;
      ctx.quadraticCurveTo(pts[i * 2], pts[i * 2 + 1], (pts[i * 2] + pts[j]) / 2, (pts[i * 2 + 1] + pts[j + 1]) / 2);
    }
    ctx.closePath();
  },

  drawCell(c) {
    const ctx = this.ctx, o = c.owner;
    ctx.beginPath();
    if (c.r * this.zoom < 9) ctx.arc(c.x, c.y, c.r, 0, 6.2832);
    else this.cellPath(c);
    ctx.fillStyle = o.color; ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, c.r * 0.035);
    ctx.strokeStyle = shade(o.color, -40); ctx.stroke();

    if (c.r > 18) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let fs = c.r * 0.42;
      ctx.font = `800 ${fs}px system-ui, Arial`;
      const tw = ctx.measureText(o.name).width, maxW = c.r * 1.45;   // keep the name inside the cell, even when the edge dents
      if (tw > maxW) { fs *= maxW / tw; ctx.font = `800 ${fs}px system-ui, Arial`; }
      ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText(o.name, c.x, c.y); ctx.fillStyle = '#fff'; ctx.fillText(o.name, c.x, c.y);
      if (c.r > 40) {
        const f2 = fs * 0.6;
        ctx.font = `700 ${f2}px system-ui, Arial`;
        ctx.lineWidth = f2 * 0.14;
        const t = Math.floor(c.mass).toString();
        ctx.strokeText(t, c.x, c.y + fs * 0.85); ctx.fillText(t, c.x, c.y + fs * 0.85);
      }
    }
  },

  drawMinimap(world) {
    const m = this.mctx, S = this.mini.width, k = S / CFG.WORLD;
    m.clearRect(0, 0, S, S);
    for (const b of world.blobs) {
      if (!b.alive || b === world.player) continue;
      const c = b.center();
      m.fillStyle = 'rgba(255,255,255,0.35)';
      m.fillRect(c.x * k - 1, c.y * k - 1, 2, 2);
    }
    const p = world.player;
    if (p && p.alive) {
      const c = p.center();
      m.fillStyle = '#ffd54a';
      m.beginPath(); m.arc(c.x * k, c.y * k, 3.5, 0, 6.2832); m.fill();
    }
  }
};
