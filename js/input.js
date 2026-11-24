const Input = {
  // direction vector in screen space, length 0..1
  dirX: 0, dirY: 0,
  mouseX: 0, mouseY: 0,
  usingMouse: true,
  lastTouch: -9999,
  zoomMul: 1,
  wantSplit: false,
  wantEject: false,
  ejectHeld: false,
  isTouch: ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || (window.matchMedia && matchMedia('(pointer: coarse)').matches),

  init(canvas) {
    window.addEventListener('mousemove', e => { if (performance.now() - this.lastTouch < 800) return; this.mouseX = e.clientX; this.mouseY = e.clientY; this.usingMouse = true; });
    window.addEventListener('keydown', e => {
      if (e.code === 'Space') { this.wantSplit = true; e.preventDefault(); }
      if (e.code === 'KeyW') { this.ejectHeld = true; this.wantEject = true; }
    });
    window.addEventListener('keyup', e => { if (e.code === 'KeyW') this.ejectHeld = false; });
    window.addEventListener('wheel', e => {
      this.zoomMul = clamp(this.zoomMul * (e.deltaY > 0 ? 0.92 : 1.08), 0.5, 1.6);
    }, { passive: true });

    // Floating touch joystick: touch anywhere (not on a button) and it appears under your thumb
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    const hud = document.getElementById('hud');
    let activeId = null, cx = 0, cy = 0;
    const R = 55;
    const move = t => {
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.dirX = dx / R; this.dirY = dy / R;
      this.usingMouse = false;
    };
    window.addEventListener('touchstart', e => {
      this.lastTouch = performance.now();
      if (activeId !== null || hud.classList.contains('hidden')) return;
      for (const t of e.changedTouches) {
        if (t.target.closest && t.target.closest('button, #leaderboard')) continue;
        activeId = t.identifier; cx = t.clientX; cy = t.clientY;
        stick.style.left = (cx - 58) + 'px'; stick.style.top = (cy - 58) + 'px'; stick.style.bottom = 'auto';
        stick.classList.add('active');
        move(t);
        break;
      }
    }, { passive: true });
    window.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) if (t.identifier === activeId) move(t);
    }, { passive: true });
    const end = e => {
      for (const t of e.changedTouches) if (t.identifier === activeId) {
        activeId = null;
        stick.classList.remove('active');
        stick.style.left = stick.style.top = stick.style.bottom = '';
        knob.style.transform = 'translate(0px, 0px)';
        this.dirX = 0; this.dirY = 0;
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
