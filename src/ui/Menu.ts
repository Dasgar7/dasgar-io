export interface MenuCallbacks {
  onPlay: (name: string) => void;
}

export class Menu {
  private root: HTMLElement;
  private overlay: HTMLElement | null = null;
  private cbs: MenuCallbacks;

  constructor(root: HTMLElement, cbs: MenuCallbacks) {
    this.root = root;
    this.cbs = cbs;
  }

  show() {
    this.hide();
    const el = document.createElement('div');
    el.className = 'menu-overlay';
    el.innerHTML = `
      <div class="float-cell" style="width:80px;height:80px;background:#4ade80;top:15%;left:10%"></div>
      <div class="float-cell" style="width:50px;height:50px;background:#22d3ee;top:25%;right:12%;animation-delay:2s"></div>
      <div class="float-cell" style="width:120px;height:120px;background:#a78bfa;bottom:20%;left:8%;animation-delay:4s"></div>
      <div class="float-cell" style="width:60px;height:60px;background:#f472b6;bottom:30%;right:15%;animation-delay:1s"></div>
      <div class="menu-logo">DASGAR.IO</div>
      <div class="menu-tagline">Single-player · AI bots · Dark neon</div>
      <div class="menu-panel">
        <input class="menu-input" id="nick-input" type="text" placeholder="Enter nickname" maxlength="16" autocomplete="off" />
        <button class="btn btn-primary" id="play-btn">PLAY</button>
      </div>
      <div class="menu-footer">v1.0 · Runs fully offline · 70 AI bots</div>
    `;
    this.root.appendChild(el);
    this.overlay = el;

    const input = el.querySelector('#nick-input') as HTMLInputElement;
    input.value = localStorage.getItem('dasgar_name') || '';
    input.focus();

    const play = () => {
      const name = (input.value.trim() || 'You').slice(0, 16);
      localStorage.setItem('dasgar_name', name);
      this.cbs.onPlay(name);
    };
    el.querySelector('#play-btn')!.addEventListener('click', play);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') play();
    });
  }

  hide() {
    this.overlay?.remove();
    this.overlay = null;
  }
}
