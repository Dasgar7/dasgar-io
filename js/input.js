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

    // Two ways to steer on a phone:
    //  1) drag the joystick (bottom-left) for analog control
    //  2) touch anywhere else: the cell heads to that spot (follows your finger, keeps going to where you let go)
    // The joystick knob always shows which way you are heading.
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    const hud = document.getElementById('hud');
    let stickId = null, tapId = null;
    const R = 46;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
    const stickMove = t => {
      const r = stick.getBoundingClientRect();
      let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      setKnob(dx, dy);
      this.dirX = dx / R; this.dirY = dy / R;
      this.mode = 'stick'; this.stickActive = true;
    };
    const tapAim = t => {
      this.mouseX = t.clientX; this.mouseY = t.clientY;
      const w = Render.screenToWorld(t.clientX, t.clientY);
      this.tapWX = w.x; this.tapWY = w.y;
      this.mode = 'tap'; this.tapDown = true;
    };
    window.addEventListener('touchstart', e => {
      this.lastTouch = performance.now();
      if (hud.classList.contains('hidden')) return;
      for (const t of e.changedTouches) {
        if (t.target.closest && t.target.closest('button, #leaderboard')) continue;
        const r = stick.getBoundingClientRect();
        const inStick = Math.hypot(t.clientX - (r.left + r.width / 2), t.clientY - (r.top + r.height / 2)) < r.width / 2 + 24;
        if (inStick && stickId === null) { stickId = t.identifier; stick.classList.add('active'); stickMove(t); }
        else if (!inStick && tapId === null) { tapId = t.identifier; tapAim(t); }
      }
    }, { passive: true });
    window.addEventListener('touchmove', e => {
      this.lastTouch = performance.now();
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) stickMove(t);
        else if (t.identifier === tapId) tapAim(t);
      }
    }, { passive: true });
    const end = e => {
      this.lastTouch = performance.now();
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          stickId = null; this.stickActive = false; this.dirX = 0; this.dirY = 0;
          stick.classList.remove('active'); setKnob(0, 0);
        } else if (t.identifier === tapId) {
          tapId = null; this.tapDown = false;      // cell keeps heading to the last tapped spot
        }
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
