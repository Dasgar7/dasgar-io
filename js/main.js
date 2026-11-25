(function () {
  const canvas = document.getElementById('game');
  const $ = id => document.getElementById(id);
  Input.init(canvas);
  Render.init(canvas);

  let world = new World();
  let playing = false, paused = false;
  let selColor = localStorage.getItem('dasgar_color') || COLORS[4];
  $('nameInput').value = localStorage.getItem('dasgar_name') || '';

  // skin picker
  const skins = $('skins');
  COLORS.forEach(c => {
    const d = document.createElement('div');
    d.className = 'skin' + (c === selColor ? ' sel' : '');
    d.style.background = c;
    d.onclick = () => {
      selColor = c;
      skins.querySelectorAll('.skin').forEach(e => e.classList.remove('sel'));
      d.classList.add('sel');
    };
    skins.appendChild(d);
  });

  function start() {
    const name = $('nameInput').value.trim() || 'Dasgar';
    localStorage.setItem('dasgar_name', name);
    localStorage.setItem('dasgar_color', selColor);
    world.spawnPlayer(name, selColor);
    const c = world.player.center();
    Render.camX = c.x; Render.camY = c.y; Render.zoom = 0.9;
    $('menu').classList.add('hidden');
    $('dead').classList.add('hidden');
    $('hud').classList.remove('hidden');
    playing = true; paused = false; $('pauseBtn').classList.remove('on');
    Input.mouseX = Render.w / 2; Input.mouseY = Render.h / 2;   // no drifting until you tap
    Input.mode = 'mouse'; Input.tapDown = false; Input.stickActive = false; $('knob').style.transform = 'translate(0px, 0px)';
    $('stick').classList.remove('shown', 'active');
  }
  $('pauseBtn').onclick = () => { paused = !paused; $('pauseBtn').classList.toggle('on', paused); };
  if (localStorage.getItem('dasgar_lb') === '1') { $('leaderboard').classList.remove('collapsed'); $('lbBtn').classList.add('on'); }
  $('lbBtn').onclick = () => { const c = $('leaderboard').classList.toggle('collapsed'); $('lbBtn').classList.toggle('on', !c); localStorage.setItem('dasgar_lb', c ? '0' : '1'); };
  $('playBtn').onclick = start;
  $('againBtn').onclick = () => { $('dead').classList.add('hidden'); $('menu').classList.remove('hidden'); };
  $('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') start(); });

  let sdx = 0, sdy = 0;
  function playerControls(dt) {
    const p = world.player;
    if (!p || !p.alive) return;
    const c = p.center();
    if (Input.mode === 'tap') {
      if (Input.tapDown) { const t = Render.screenToWorld(Input.mouseX, Input.mouseY); Input.tapWX = t.x; Input.tapWY = t.y; }
      p.targetX = Input.tapWX; p.targetY = Input.tapWY;
    } else if (Input.mode === 'mouse') {
      const t = Render.screenToWorld(Input.mouseX, Input.mouseY);
      p.targetX = t.x; p.targetY = t.y;
    } else {
      const k = 1 - Math.exp(-dt * 14);
      sdx += (Input.dirX - sdx) * k; sdy += (Input.dirY - sdy) * k;
      const mag = Math.hypot(sdx, sdy);
      if (mag > 0.08) {
        p.targetX = c.x + sdx * 400; p.targetY = c.y + sdy * 400;
      } else { p.targetX = c.x; p.targetY = c.y; }
    }
    if (Input.wantSplit) { p.split(); Input.wantSplit = false; }
    if (Input.wantEject) {
      world.pellets.push(...p.eject());
      Input.wantEject = false;
    }
    if (Input.ejectHeld) {
      ejectTimer++;
      if (ejectTimer % 6 === 0) world.pellets.push(...p.eject());
    } else ejectTimer = 0;
  }
  let ejectTimer = 0;

  // joystick knob points the way the cell is heading (when you are not dragging the stick itself)
  function updateKnob() {
    const p = world.player;
    if (!p || !p.alive || Input.mode === 'stick') return;
    const c = p.center();
    const dx = p.targetX - c.x, dy = p.targetY - c.y, d = Math.hypot(dx, dy);
    const k = d > 1 ? Math.min(1, d * Render.zoom / 140) : 0;
    $('knob').style.transform = d > 1 ? `translate(${dx / d * 46 * k}px, ${dy / d * 46 * k}px)` : 'translate(0px, 0px)';
  }

  function updateHud() {
    const p = world.player, alive = p && p.alive;
    $('scoreMain').textContent = 'Score ' + (alive ? Math.floor(p.mass) : 0);
    const ranked = world.blobs.filter(b => b.alive).sort((x, y) => y.mass - x.mass);
    const rank = alive ? ranked.indexOf(p) + 1 : 0;
    $('scoreSub').textContent = alive ? `Rank ${rank} of ${ranked.length}` : '';
    const row = (b, n) => `<li class="${b === p ? 'me' : ''}" value="${n}">${b.name.replace(/</g, '')} <small>${Math.floor(b.mass)}</small></li>`;
    let html = ranked.slice(0, 5).map((b, i) => row(b, i + 1)).join('');
    if (alive && rank > 5) html += row(p, rank);
    $('lbList').innerHTML = html;
  }

  let last = performance.now(), hudT = 0, deadShown = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (paused) { Input.wantSplit = false; Input.wantEject = false; }
    if (playing && !paused) playerControls(dt);
    if (playing && Input.isTouch) updateKnob();
    if (!paused) world.update(dt);
    Render.updateCamera(world, dt);
    Render.draw(world);

    hudT += dt;
    if (hudT > 0.25) { hudT = 0; if (playing) updateHud(); }

    if (playing && world.player && !world.player.alive) {
      playing = false;
      const p = world.player;
      try { if (Math.floor(p.peak) > (+localStorage.getItem('dasgar_best') || 0)) localStorage.setItem('dasgar_best', Math.floor(p.peak)); } catch (e) {}
      $('deadStats').textContent = `Peak mass: ${Math.floor(p.peak)}  |  Cells eaten: ${p.eaten}`;
      setTimeout(() => { $('dead').classList.remove('hidden'); }, 600);
      $('hud').classList.add('hidden');
    }
    requestAnimationFrame(frame);
  }

  // menu background: camera drifts around the world while waiting
  let drift = 0;
  const origUpdateCam = Render.updateCamera.bind(Render);
  Render.updateCamera = function (w, dt) {
    if (!playing && !(w.player && w.player.alive)) {
      drift += dt * 0.15;
      this.camX = CFG.WORLD / 2 + Math.cos(drift) * 1200;
      this.camY = CFG.WORLD / 2 + Math.sin(drift * 1.3) * 1200;
      this.zoom = 0.45;
    } else origUpdateCam(w, dt);
  };

  requestAnimationFrame(frame);
})();
