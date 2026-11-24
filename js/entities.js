let _id = 1;

class Cell {
  constructor(owner, x, y, mass) {
    this.id = _id++;
    this.owner = owner;
    this.x = x; this.y = y;
    this.mass = mass;
    this.r = massToRadius(mass);
    this.bx = 0; this.by = 0;          // boost velocity (split / eject kick)
    this.vx = 0; this.vy = 0;          // smoothed steering velocity
    this.px = x; this.py = y;          // previous position, for jelly stretch
    this.st = 0; this.stV = 0;         // stretch + its spring velocity
    this.pu = 0; this.puV = 0;         // pulse (when eating) + its spring velocity
    this.ang = 0;
    this.mergeAt = performance.now() / 1000 + CFG.MERGE_TIME + mass * 0.02;
  }
  setMass(m) {
    if (m > this.mass + 0.5) this.puV += 0.6;   // little jelly bounce when eating
    this.mass = m; this.r = massToRadius(m);
  }
  jelly(dt) {
    const mv = Math.hypot(this.x - this.px, this.y - this.py) / Math.max(dt, 0.001);
    if (mv > 20) this.ang = Math.atan2(this.y - this.py, this.x - this.px);
    const target = Math.min(0.14, mv / 1400);
    this.stV += (target - this.st) * 160 * dt; this.stV *= Math.exp(-8 * dt); this.st += this.stV * dt;
    this.puV += (0 - this.pu) * 140 * dt; this.puV *= Math.exp(-7 * dt); this.pu += this.puV * dt;
    this.pu = Math.max(-0.12, Math.min(0.12, this.pu));
    this.px = this.x; this.py = this.y;
  }
  get speed() { return CFG.BASE_SPEED * Math.pow(this.mass, -0.2); }
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
      const kick = 520 + c.r * 2;
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
