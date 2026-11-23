class World {
  constructor() {
    this.foods = [];
    this.pellets = [];
    this.viruses = [];
    this.blobs = [];
    this.player = null;
    this.time = 0;
    for (let i = 0; i < CFG.FOOD_COUNT; i++) this.foods.push(new Food());
    for (let i = 0; i < CFG.VIRUS_COUNT; i++) this.viruses.push(new Virus());
    for (let i = 0; i < CFG.BOT_COUNT; i++) {
      const b = new Blob(BOT_NAMES[i % BOT_NAMES.length], randColor(), true);
      this.respawnBot(b, true);
      this.blobs.push(b);
    }
  }

  respawnBot(b, first) {
    const m = first ? rand(15, 250) : rand(15, 60);
    b.spawn(rand(200, CFG.WORLD - 200), rand(200, CFG.WORLD - 200), m);
  }

  spawnPlayer(name, color) {
    if (this.player) this.blobs = this.blobs.filter(b => b !== this.player);
    const p = new Blob(name || 'Player', color, false);
    p.spawn(rand(800, CFG.WORLD - 800), rand(800, CFG.WORLD - 800), CFG.START_MASS);
    this.player = p;
    this.blobs.push(p);
  }

  update(dt) {
    this.time += dt;
    const now = performance.now() / 1000;

    for (const b of this.blobs) {
      if (!b.alive) {
        if (b.isBot && now > b.respawnAt) this.respawnBot(b, false);
        continue;
      }
      if (b.isBot) AI.think(b, this, dt);
      this.moveBlob(b, dt, now);
    }

    this.updatePellets(dt);
    this.updateEating();
    this.maintain();
  }

  moveBlob(b, dt, now) {
    const W = CFG.WORLD;
    for (const c of b.cells) {
      // steer toward the aim point; closer aim point = slower
      let dx = b.targetX - c.x, dy = b.targetY - c.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        const k = Math.min(1, d / (c.r * 0.8 + 20));
        const sp = c.speed * k;
        c.x += (dx / d) * sp * dt;
        c.y += (dy / d) * sp * dt;
      }
      // boost from split / eject, decays fast
      c.x += c.bx * dt; c.y += c.by * dt;
      const decay = Math.pow(0.004, dt);
      c.bx *= decay; c.by *= decay;

      // slow mass decay for big cells
      if (c.mass > 60) c.setMass(c.mass - c.mass * CFG.DECAY * dt);

      c.x = clamp(c.x, c.r * 0.5, W - c.r * 0.5);
      c.y = clamp(c.y, c.r * 0.5, W - c.r * 0.5);
      c.jelly(dt);
    }

    // own cells push apart until ready to merge, then merge
    const cs = b.cells;
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const a = cs[i], c = cs[j];
        if (!a || !c) continue;
        let dx = c.x - a.x, dy = c.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = a.r + c.r;
        if (d >= min) continue;
        if (now >= a.mergeAt && now >= c.mergeAt) {
          if (d < Math.max(a.r, c.r) * 0.75) {
            a.setMass(a.mass + c.mass);
            a.bx += c.bx; a.by += c.by;
            cs.splice(j, 1);
            j--;
          }
        } else {
          const push = (min - d) * 0.5;
          dx /= d; dy /= d;
          a.x -= dx * push; a.y -= dy * push;
          c.x += dx * push; c.y += dy * push;
        }
      }
    }

    if (b.mass > b.peak) b.peak = b.mass;
  }

  updatePellets(dt) {
    for (const p of this.pellets) {
      p.age += dt;
      p.x += p.bx * dt; p.y += p.by * dt;
      const d = Math.pow(0.01, dt);
      p.bx *= d; p.by *= d;
      p.x = clamp(p.x, p.r, CFG.WORLD - p.r);
      p.y = clamp(p.y, p.r, CFG.WORLD - p.r);
    }
  }

  updateEating() {
    // food + pellets
    for (const b of this.blobs) {
      if (!b.alive) continue;
      for (const c of b.cells) {
        for (let i = this.foods.length - 1; i >= 0; i--) {
          const f = this.foods[i];
          const dx = f.x - c.x, dy = f.y - c.y;
          if (dx * dx + dy * dy < c.r * c.r) {
            c.setMass(c.mass + f.mass);
            this.foods.splice(i, 1);
          }
        }
        for (let i = this.pellets.length - 1; i >= 0; i--) {
          const p = this.pellets[i];
          if (p.age < 0.25) continue;
          const dx = p.x - c.x, dy = p.y - c.y;
          if (dx * dx + dy * dy < c.r * c.r) {
            c.setMass(c.mass + p.mass);
            this.pellets.splice(i, 1);
          }
        }
      }
    }

    // pellets feeding viruses
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const p = this.pellets[i];
      for (const v of this.viruses) {
        if (dist(p.x, p.y, v.x, v.y) < v.r) {
          v.fed++;
          this.pellets.splice(i, 1);
          if (v.fed >= 7) {
            v.fed = 0;
            const a = Math.atan2(p.by || 1, p.bx || 1);
            const nv = new Virus(v.x + Math.cos(a) * (v.r * 2), v.y + Math.sin(a) * (v.r * 2));
            this.viruses.push(nv);
            if (this.viruses.length > CFG.VIRUS_COUNT + 10) this.viruses.shift();
          }
          break;
        }
      }
    }

    // cells vs cells and viruses
    const now = performance.now() / 1000;
    for (const a of this.blobs) {
      if (!a.alive) continue;
      for (const ca of a.cells.slice()) {
        if (!a.cells.includes(ca)) continue;

        for (let vi = this.viruses.length - 1; vi >= 0; vi--) {
          const v = this.viruses[vi];
          if (ca.mass > v.mass * 1.3 && dist(ca.x, ca.y, v.x, v.y) < ca.r - v.r * 0.3) {
            this.viruses.splice(vi, 1);
            this.popCell(a, ca);
            break;
          }
        }

        for (const o of this.blobs) {
          if (o === a || !o.alive) continue;
          for (const co of o.cells.slice()) {
            if (ca.mass > co.mass * CFG.EAT_RATIO && dist(ca.x, ca.y, co.x, co.y) < ca.r - co.r * 0.45) {
              ca.setMass(ca.mass + co.mass);
              o.cells.splice(o.cells.indexOf(co), 1);
              a.eaten++;
              if (o.cells.length === 0) this.kill(o);
            }
          }
        }
      }
    }
  }

  popCell(blob, cell) {
    const room = CFG.MAX_CELLS - blob.cells.length;
    const pieces = Math.min(room, 7);
    if (pieces < 1) { cell.setMass(cell.mass + CFG.VIRUS_MASS * 0.5); return; }
    const share = cell.mass / (pieces + 1);
    cell.setMass(share);
    const t = performance.now() / 1000;
    for (let i = 0; i < pieces; i++) {
      const a = (i / pieces) * Math.PI * 2 + rand(0, 0.5);
      const n = new Cell(blob, cell.x, cell.y, share);
      n.bx = Math.cos(a) * 600; n.by = Math.sin(a) * 600;
      n.mergeAt = t + CFG.MERGE_TIME + share * 0.02;
      blob.cells.push(n);
    }
    cell.mergeAt = t + CFG.MERGE_TIME + share * 0.02;
  }

  kill(blob) {
    blob.alive = false;
    blob.cells = [];
    blob.respawnAt = performance.now() / 1000 + rand(3, 7);
  }

  maintain() {
    while (this.foods.length < CFG.FOOD_COUNT) this.foods.push(new Food());
    while (this.viruses.length < CFG.VIRUS_COUNT) this.viruses.push(new Virus());
  }

  leaderboard() {
    return this.blobs.filter(b => b.alive).sort((a, b) => b.mass - a.mass).slice(0, 8);
  }
}
