export class HUD {
  private root: HTMLElement;
  private el: HTMLElement | null = null;
  private fpsEl: HTMLElement | null = null;
  private massEl: HTMLElement | null = null;
  private aliveEl: HTMLElement | null = null;
  private coordEl: HTMLElement | null = null;
  private lbEl: HTMLElement | null = null;
  private toastContainer: HTMLElement | null = null;
  private deathEl: HTMLElement | null = null;
  private onSplit: () => void;
  private onEject: () => void;
  private onMultiSplit: (n: number) => void;
  private onJoystick: (dx: number, dy: number, active: boolean) => void;
  private onRespawn: () => void;

  constructor(root: HTMLElement, handlers: {
    onSplit: () => void; onEject: () => void; onMultiSplit: (n: number) => void;
    onJoystick: (dx: number, dy: number, active: boolean) => void; onRespawn: () => void;
  }) {
    this.root = root;
    this.onSplit = handlers.onSplit;
    this.onEject = handlers.onEject;
    this.onMultiSplit = handlers.onMultiSplit;
    this.onJoystick = handlers.onJoystick;
    this.onRespawn = handlers.onRespawn;
  }

  show() {
    this.hide();
    const el = document.createElement('div');
    el.className = 'hud';
    el.innerHTML = `
      <div class="hud-top-left hud-panel">
        <span>FPS <span class="val" id="hud-fps">--</span></span>
        <span>Mass <span class="val" id="hud-mass">10</span></span>
        <span>Alive <span class="val" id="hud-alive">--</span></span>
        <span>Pos <span class="val" id="hud-coord">0, 0</span></span>
      </div>
      <div class="hud-top-right">
        <div class="leaderboard hud-panel"><h3>Leaderboard</h3><div id="hud-lb"></div></div>
      </div>
      <div class="hud-center" id="hud-toasts"></div>
      <div class="hud-bottom-left mobile-only">
        <div class="joystick-base" id="joystick"><div class="joystick-knob" id="joy-knob"></div></div>
        <div class="action-btns">
          <button class="action-btn" id="btn-split">⬡</button>
          <button class="action-btn" id="btn-eject">◉</button>
          <button class="action-btn" id="btn-dsplit">⬢</button>
        </div>
      </div>
      <div class="desktop-hint">Space Split · W Feed · Q/E/R Multi · F Macro</div>`;
    this.root.appendChild(el);
    this.el = el;
    this.fpsEl = el.querySelector('#hud-fps');
    this.massEl = el.querySelector('#hud-mass');
    this.aliveEl = el.querySelector('#hud-alive');
    this.coordEl = el.querySelector('#hud-coord');
    this.lbEl = el.querySelector('#hud-lb');
    this.toastContainer = el.querySelector('#hud-toasts');
    this.bindMobile(el);
  }

  private bindMobile(el: HTMLElement) {
    const base = el.querySelector('#joystick') as HTMLElement;
    const knob = el.querySelector('#joy-knob') as HTMLElement;
    if (!base) return;
    const maxR = 36;
    let active = false;
    const move = (cx: number, cy: number) => {
      const rect = base.getBoundingClientRect();
      let dx = cx - (rect.left + rect.width / 2);
      let dy = cy - (rect.top + rect.height / 2);
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > maxR) { dx = (dx / len) * maxR; dy = (dy / len) * maxR; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.onJoystick(dx, dy, true);
    };
    const end = () => {
      active = false;
      knob.style.transform = 'translate(-50%, -50%)';
      this.onJoystick(0, 0, false);
    };
    base.addEventListener('touchstart', (e) => {
      e.preventDefault(); active = true;
      move(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    base.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (active) move(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    base.addEventListener('touchend', end);
    const press = (btn: HTMLElement | null, fn: () => void) => {
      if (!btn) return;
      const down = (e: Event) => { e.preventDefault(); btn.classList.add('pressed'); fn(); };
      const up = () => btn.classList.remove('pressed');
      btn.addEventListener('touchstart', down, { passive: false });
      btn.addEventListener('mousedown', down);
      btn.addEventListener('touchend', up);
      btn.addEventListener('mouseup', up);
    };
    press(el.querySelector('#btn-split'), () => this.onSplit());
    press(el.querySelector('#btn-eject'), () => this.onEject());
    press(el.querySelector('#btn-dsplit'), () => this.onMultiSplit(2));
  }

  hide() {
    this.el?.remove(); this.el = null;
    this.deathEl?.remove(); this.deathEl = null;
  }

  updateStats(fps: number, mass: number, alive: number, x: number, y: number) {
    if (this.fpsEl) this.fpsEl.textContent = String(Math.round(fps));
    if (this.massEl) this.massEl.textContent = String(Math.round(mass));
    if (this.aliveEl) this.aliveEl.textContent = String(alive);
    if (this.coordEl) this.coordEl.textContent = `${Math.round(x)}, ${Math.round(y)}`;
  }

  updateLeaderboard(entries: { name: string; mass: number; id: string }[], myId: string) {
    if (!this.lbEl) return;
    this.lbEl.innerHTML = entries.map((e, i) =>
      `<div class="lb-row ${e.id === myId ? 'me' : ''}"><span>${i + 1}. ${this.esc(e.name)}</span><span>${e.mass}</span></div>`
    ).join('');
  }

  toast(text: string) {
    if (!this.toastContainer) return;
    const t = document.createElement('div');
    t.className = 'kill-toast';
    t.textContent = text;
    this.toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }

  showDeath(killer: string) {
    this.deathEl?.remove();
    const el = document.createElement('div');
    el.className = 'death-screen';
    el.innerHTML = `<h2>You were eaten</h2><p>by ${this.esc(killer || 'a bot')}</p>
      <button class="btn btn-primary" style="width:auto;padding:0.9rem 2.5rem" id="respawn-btn">Play Again</button>`;
    this.root.appendChild(el);
    this.deathEl = el;
    el.querySelector('#respawn-btn')?.addEventListener('click', () => {
      el.remove(); this.deathEl = null; this.onRespawn();
    });
  }

  private esc(s: string) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
}
