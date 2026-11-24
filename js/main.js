(function () {
  const canvas = document.getElementById('game');
  const $ = id => document.getElementById(id);
  Input.init(canvas);
  Render.init(canvas);

  let world = new World();
  let playing = false;
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
    playing = true;
  }
  $('playBtn').onclick = start;
  $('againBtn').onclick = () => { $('dead').classList.add('hidden'); $('menu').classList.remove('hidden'); };
  $('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') start(); });

  let sdx = 0, sdy = 0;
  function playerControls(dt) {
    const p = world.player;
    if (!p || !p.alive) return;
    const c = p.center();
    if (Input.usingMouse) {
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

  function updateHud() {
    const p = world.player;
    $('score').textContent = 'Mass: ' + (p && p.alive ? Math.floor(p.mass) : 0);
    const lb = world.leaderboard();
    $('lbList').innerHTML = lb.map(b =>
      `<li class="${b === p ? 'me' : ''}">${b.name.replace(/</g, '')} <small>${Math.floor(b.mass)}</small></li>`).join('');
  }

  let last = performance.now(), hudT = 0, deadShown = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (playing) playerControls(dt);
    world.update(dt);
    Render.updateCamera(world, dt);
    Render.draw(world);

    hudT += dt;
    if (hudT > 0.25) { hudT = 0; if (playing) updateHud(); }

    if (playing && world.player && !world.player.alive) {
      playing = false;
      const p = world.player;
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
