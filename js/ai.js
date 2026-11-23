const AI = {
  think(bot, world, dt) {
    bot.brainT -= dt;
    if (bot.brainT > 0) return;
    bot.brainT = rand(0.15, 0.4);

    const me = bot.center();
    const myMass = bot.mass;
    const biggest = bot.cells.reduce((a, c) => (c.mass > a.mass ? c : a), bot.cells[0]);
    const view = 350 + biggest.r * 2.2;

    let threat = null, threatD = Infinity;
    let prey = null, preyD = Infinity;

    for (const o of world.blobs) {
      if (o === bot || !o.alive) continue;
      for (const c of o.cells) {
        const d = dist(me.x, me.y, c.x, c.y);
        if (d > view + c.r) continue;
        if (c.mass > biggest.mass * 1.18 && d < threatD) { threat = c; threatD = d; }
        else if (biggest.mass > c.mass * 1.25 && d < preyD) { prey = c; preyD = d; }
      }
    }

    // big bots avoid viruses
    let virus = null;
    if (biggest.mass > CFG.VIRUS_MASS * 1.3) {
      for (const v of world.viruses) {
        const d = dist(me.x, me.y, v.x, v.y);
        if (d < biggest.r + v.r + 80) { virus = v; break; }
      }
    }

    if (threat) {
      // run away, split away only rarely
      bot.targetX = me.x + (me.x - threat.x) * 3;
      bot.targetY = me.y + (me.y - threat.y) * 3;
    } else if (virus) {
      bot.targetX = me.x + (me.x - virus.x) * 3;
      bot.targetY = me.y + (me.y - virus.y) * 3;
    } else if (prey) {
      bot.targetX = prey.x; bot.targetY = prey.y;
      if (biggest.mass > prey.mass * 2.6 && preyD < biggest.r * 3.2 && biggest.mass >= CFG.MIN_SPLIT_MASS * 2 && Math.random() < 0.25) {
        bot.split();
      }
    } else {
      // nearest food in view, else wander
      let best = null, bd = Infinity;
      for (const f of world.foods) {
        const d = Math.abs(f.x - me.x) + Math.abs(f.y - me.y);
        if (d < bd) { bd = d; best = f; }
      }
      if (best && bd < 1500) { bot.targetX = best.x; bot.targetY = best.y; }
      else if (Math.random() < 0.3) {
        bot.targetX = rand(200, CFG.WORLD - 200);
        bot.targetY = rand(200, CFG.WORLD - 200);
      }
    }
  }
};
