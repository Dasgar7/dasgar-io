let _id = 1;

// Jelly membrane: JN edge points around each cell. Each point has an offset (fraction of
// radius) and a velocity, linked to its neighbours by springs. The cell body stays a clean
// circle; only the border ripples.
const JN = 32;
const JANG = [], JCOS = [], JSIN = [];
for (let i = 0; i < JN; i++) { const a = i * Math.PI * 2 / JN; JANG.push(a); JCOS.push(Math.cos(a)); JSIN.push(Math.sin(a)); }
const _jf = new Float32Array(JN);

class Cell {
  constructor(owner, x, y, mass) {
    this.id = _id++;
    this.owner = owner;
    this.x = x; this.y = y;
    this.mass = mass;
    this.r = massToRadius(mass);
    this.bx = 0; this.by = 0;          // boost velocity (split / eject kick)
    this.vx = 0; this.vy = 0;          // smoothed steering velocity
    this.px = x; this.py = y;          // last frame position
    this.pvx = 0; this.pvy = 0;        // last frame velocity
    this.off = new Float32Array(JN);   // membrane offsets
    this.jv = new Float32Array(JN);    // membrane offset velocities
    this.mergeAt = performance.now() / 1000 + CFG.MERGE_TIME + mass * 0.02;
  }
  setMass(m) {
    if (m > this.mass + 0.01) {        // eating: whole membrane gives a soft pulse
      const p = Math.min(0.3, Math.max(0.04, (m - this.mass) / this.mass * 3));
      for (let i = 0; i < JN; i++) this.jv[i] += p * 4;
    }
    this.mass = m; this.r = massToRadius(m);
  }
  get speed() { return CFG.BASE_SPEED * Math.pow(this.mass, -0.2); }

  // touching another cell: dent the border on the side that is being pressed
  poke(ang, overlap, dt) {
    const f = Math.min(0.4, overlap) * 90 * dt;
    for (let i = 0; i < JN; i++) {
      let d = JANG[i] - ang;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const ad = d < 0 ? -d : d;
      if (ad < 1.1) this.jv[i] -= f * Math.cos(ad / 1.1 * Math.PI / 2);
    }
  }

  jelly(dt) {
    // acceleration of the cell this frame -> front of the border dents, back bulges a little
    const inv = 1 / Math.max(dt, 0.001);
    let vx = (this.x - this.px) * inv, vy = (this.y - this.py) * inv;
    if (vx * vx + vy * vy > 2500 * 2500) { vx = 0; vy = 0; }
    let ax = (vx - this.pvx) * inv, ay = (vy - this.pvy) * inv;
    let am = Math.hypot(ax, ay);
    if (am > 5000) { ax *= 5000 / am; ay *= 5000 / am; am = 5000; }
    this.pvx = vx; this.pvy = vy; this.px = this.x; this.py = this.y;

    const mag = am * 0.16 / this.r;
    const ux = am > 1 ? ax / am : 0, uy = am > 1 ? ay / am : 0;
    const off = this.off, jv = this.jv;
    const steps = Math.min(4, Math.ceil(dt / 0.016)), h = dt / steps;
    const damp = Math.exp(-7 * h);
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < JN; i++) {
        const l = off[(i + JN - 1) % JN], n = off[(i + 1) % JN];
        const cc = ux * JCOS[i] + uy * JSIN[i];
        const drive = cc > 0 ? -cc * cc * mag : cc * cc * mag * 0.6;
        _jf[i] = drive - 90 * off[i] + 60 * (l + n - 2 * off[i]);
      }
      for (let i = 0; i < JN; i++) {
        jv[i] = (jv[i] + _jf[i] * h) * damp;
        let o = off[i] + jv[i] * h;
        if (o > 0.16) { o = 0.16; jv[i] *= 0.5; } else if (o < -0.16) { o = -0.16; jv[i] *= 0.5; }
        off[i] = o;
      }
      // keep the membrane centred on the cell: remove the "whole border slid sideways" part,
      // so the body never drifts away from the name
      let oc = 0, os = 0, vc = 0, vs = 0;
      for (let i = 0; i < JN; i++) {
        oc += off[i] * JCOS[i]; os += off[i] * JSIN[i];
        vc += jv[i] * JCOS[i]; vs += jv[i] * JSIN[i];
      }
      oc *= 2 / JN; os *= 2 / JN; vc *= 2 / JN; vs *= 2 / JN;
      for (let i = 0; i < JN; i++) {
        off[i] -= oc * JCOS[i] + os * JSIN[i];
        jv[i] -= vc * JCOS[i] + vs * JSIN[i];
      }
    }
  }
}

class Blob {
  constructor(name, color, isBot) {
    this.id = _id++;
    this.name = name;
    this.color = color;
    this.isBot = isBot;
    this.cells = [];
    this.alive = false;
    this.targetX = 0; this.targetY = 0; // world-space aim point
    this.respawnAt = 0;
    this.brainT = 0;
    this.peak = 0;
    this.eaten = 0;
  }
  get mass() { let m = 0; for (const c of this.cells) m += c.mass; return m; }
  center() {
    let x = 0, y = 0, m = 0;
    for (const c of this.cells) { x += c.x * c.mass; y += c.y * c.mass; m += c.mass; }
    return m ? { x: x / m, y: y / m } : { x: 0, y: 0 };
  }
  spawn(x, y, mass) {
    this.cells = [new Cell(this, x, y, mass)];
    this.alive = true;
    this.targetX = x; this.targetY = y;
    this.peak = mass;
  }
  split() {
    if (this.cells.length >= CFG.MAX_CELLS) return;
    const snapshot = this.cells.slice();
    for (const c of snapshot) {
      if (this.cells.length >= CFG.MAX_CELLS) break;
      if (c.mass < CFG.MIN_SPLIT_MASS) continue;
      let dx = this.targetX - c.x, dy = this.targetY - c.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      const half = c.mass / 2;
      c.setMass(half);
      const n = new Cell(this, c.x + dx * c.r, c.y + dy * c.r, half);
      const kick = 400 + c.r * 2;
      n.bx = dx * kick; n.by = dy * kick;
      const t = performance.now() / 1000;
      c.mergeAt = t + CFG.MERGE_TIME + half * 0.02;
      n.mergeAt = c.mergeAt;
      this.cells.push(n);
    }
  }
  // returns array of pellets to add to the world
  eject() {
    const out = [];
    for (const c of this.cells) {
      if (c.mass < CFG.MIN_EJECT_MASS) continue;
      let dx = this.targetX - c.x, dy = this.targetY - c.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      c.setMass(c.mass - CFG.EJECT_COST);
      out.push(new Pellet(c.x + dx * (c.r + 8), c.y + dy * (c.r + 8), dx, dy, this.color));
    }
    return out;
  }
}

class Food {
  constructor() {
    this.x = rand(20, CFG.WORLD - 20);
    this.y = rand(20, CFG.WORLD - 20);
    this.color = hsl(Math.floor(rand(0, 360)), 85, 60);
    this.mass = CFG.FOOD_MASS;
    this.r = 6;
  }
}

class Pellet {
  constructor(x, y, dx, dy, color) {
    this.x = x; this.y = y;
    this.bx = dx * 700; this.by = dy * 700;
    this.color = color;
    this.mass = CFG.EJECT_MASS;
    this.r = massToRadius(CFG.EJECT_MASS) * 0.8;
    this.age = 0;
  }
}

class Virus {
  constructor(x, y) {
    this.x = x ?? rand(300, CFG.WORLD - 300);
    this.y = y ?? rand(300, CFG.WORLD - 300);
    this.mass = CFG.VIRUS_MASS;
    this.r = massToRadius(this.mass);
    this.fed = 0;
  }
}
