const Input = {
  // direction vector in screen space, length 0..1
  dirX: 0, dirY: 0,
  mouseX: 0, mouseY: 0,
  usingMouse: true,
  lastTouch: -9999,
  stickActive: false, mode: 'mouse', tapDown: false, tapWX: 0, tapWY: 0,
  zoomMul: 1,
  wantSplit: false,
  wantEject: false,
  ejectHeld: false,
  isTouch: ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || (window.matchMedia && matchMedia('(pointer: coarse)').matches),

  init(canvas) {
    window.addEventListener('mousemove', e => { if (performance.now() - this.lastTouch < 800) return; this.mouseX = e.clientX; this.mouseY = e.clientY; this.usingMouse = true; this.mode = 'mouse'; });
    window.addEventListener('keydown', e => {
      if (e.code === 'Space') { this.wantSplit = true; e.preventDefault(); }
      if (e.code === 'KeyW') { this.ejectHeld = true; this.wantEject = true; }
    });
    window.addEventListener('keyup', e => { if (e.code === 'KeyW') this.ejectHeld = false; });
    window.addEventListener('wheel', e => {
      this.zoomMul = clamp(this.zoomMul * (e.deltaY > 0 ? 0.92 : 1.08), 0.5, 1.6);
    }, { passive: true });

    // Touch anywhere: the joystick appears under your finger and hides when you let go.
    //  - just tap / hold: the cell heads to that spot (and keeps going there after you lift)
    //  - drag: it works as a real joystick, steering by how far you pull the knob (stops when you lift)
    const stick = document.getElementById('stick');
    const knobEl = document.getElementById('knob');
    const hud = document.getElementById('hud');
    const R = 46, DRAG = 12;
    let tapId = null, ax = 0, ay = 0, dragging = false;
    const setKnob = (dx, dy) => { knobEl.style.transform = `translate(${dx}px, ${dy}px)`; };
    const touchAim = t => {
      let dx = t.clientX - ax, dy = t.clientY - ay;
      const d = Math.hypot(dx, dy);
      if (!dragging && d > DRAG) dragging = true;
      if (dragging) {
        if (d > R) { dx = dx / d * R; dy = dy / d * R; }
        setKnob(dx, dy);
        this.dirX = dx / R; this.dirY = dy / R;
        this.mode = 'stick'; this.tapDown = false;
      } else {
        this.mouseX = t.clientX; this.mouseY = t.clientY;
        const w = Render.screenToWorld(t.clientX, t.clientY);
        this.tapWX = w.x; this.tapWY = w.y;
        this.mode = 'tap'; this.tapDown = true;
      }
    };
    window.addEventListener('touchstart', e => {
      this.lastTouch = performance.now();
      if (hud.classList.contains('hidden') || tapId !== null) return;
      for (const t of e.changedTouches) {
        if (t.target.closest && t.target.closest('button, #leaderboard')) continue;
        tapId = t.identifier; ax = t.clientX; ay = t.clientY; dragging = false;
        stick.style.left = (ax - 58) + 'px';
        stick.style.top = (ay - 58) + 'px';
        stick.style.bottom = 'auto';
        stick.classList.add('shown', 'active');
        touchAim(t);
        break;
      }
    }, { passive: true });
    window.addEventListener('touchmove', e => {
      this.lastTouch = performance.now();
      for (const t of e.changedTouches) if (t.identifier === tapId) touchAim(t);
    }, { passive: true });
    const end = e => {
      this.lastTouch = performance.now();
      for (const t of e.changedTouches) if (t.identifier === tapId) {
        tapId = null; this.tapDown = false;
        if (dragging) { this.dirX = 0; this.dirY = 0; }   // joystick released: stop
        dragging = false;
        stick.classList.remove('shown', 'active');          // hide again until the next touch
        setKnob(0, 0);
      }
    };
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);

    const bind = (id, fn, hold) => {
      const b = document.getElementById(id);
      b.addEventListener('touchstart', e => { e.preventDefault(); fn(true); }, { passive: false });
      b.addEventListener('touchend', e => { e.preventDefault(); if (hold) fn(false); }, { passive: false });
      b.addEventListener('mousedown', e => { e.preventDefault(); fn(true); });
      b.addEventListener('mouseup', () => { if (hold) fn(false); });
    };
    bind('btnSplit', () => { this.wantSplit = true; });
    bind('btnEject', on => { this.ejectHeld = on; if (on) this.wantEject = true; }, true);

    if (this.isTouch) document.getElementById('touch').classList.remove('hidden');
  }
};
