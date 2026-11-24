const Input = {
  // direction vector in screen space, length 0..1
  dirX: 0, dirY: 0,
  mouseX: 0, mouseY: 0,
  usingMouse: true,
  zoomMul: 1,
  wantSplit: false,
  wantEject: false,
  ejectHeld: false,
  isTouch: ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || (window.matchMedia && matchMedia('(pointer: coarse)').matches),

  init(canvas) {
    window.addEventListener('mousemove', e => { this.mouseX = e.clientX; this.mouseY = e.clientY; this.usingMouse = true; });
    window.addEventListener('keydown', e => {
      if (e.code === 'Space') { this.wantSplit = true; e.preventDefault(); }
      if (e.code === 'KeyW') { this.ejectHeld = true; this.wantEject = true; }
    });
    window.addEventListener('keyup', e => { if (e.code === 'KeyW') this.ejectHeld = false; });
    window.addEventListener('wheel', e => {
      this.zoomMul = clamp(this.zoomMul * (e.deltaY > 0 ? 0.92 : 1.08), 0.5, 1.6);
    }, { passive: true });

    // Touch joystick
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    let activeId = null;
    const R = 65;
    const move = t => {
      const r = stick.getBoundingClientRect();
      let dx = t.clientX - (r.left + R), dy = t.clientY - (r.top + R);
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.left = (40 + dx) + 'px';
      knob.style.top = (40 + dy) + 'px';
      this.dirX = dx / R; this.dirY = dy / R;
      this.usingMouse = false;
    };
    stick.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; activeId = t.identifier; move(t); }, { passive: false });
    stick.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === activeId) move(t);
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) if (t.identifier === activeId) {
        activeId = null; knob.style.left = '40px'; knob.style.top = '40px';
        this.dirX = 0; this.dirY = 0;
      }
    };
    stick.addEventListener('touchend', end);
    stick.addEventListener('touchcancel', end);

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
