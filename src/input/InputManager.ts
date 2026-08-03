export class InputManager {
  mouseX = 0;
  mouseY = 0;
  worldMouseX = 0;
  worldMouseY = 0;
  isMobile = false;
  joyActive = false;
  joyDx = 0;
  joyDy = 0;

  private canvas: HTMLCanvasElement;
  private onSplit: () => void;
  private onEject: () => void;
  private onMultiSplit: (n: number) => void;

  constructor(
    canvas: HTMLCanvasElement,
    handlers: {
      onSplit: () => void;
      onEject: () => void;
      onMultiSplit: (n: number) => void;
    }
  ) {
    this.canvas = canvas;
    this.onSplit = handlers.onSplit;
    this.onEject = handlers.onEject;
    this.onMultiSplit = handlers.onMultiSplit;
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.onSplit();
          break;
        case 'KeyW':
          this.onEject();
          break;
        case 'KeyQ':
          this.onMultiSplit(2);
          break;
        case 'KeyE':
          this.onMultiSplit(3);
          break;
        case 'KeyR':
          this.onMultiSplit(4);
          break;
        case 'KeyF':
          for (let i = 0; i < 7; i++) setTimeout(() => this.onEject(), i * 40);
          break;
      }
    });
  }

  updateWorldMouse(camX: number, camY: number, zoom: number) {
    if (this.joyActive && this.isMobile) {
      const len = Math.sqrt(this.joyDx * this.joyDx + this.joyDy * this.joyDy) || 1;
      this.worldMouseX = camX + (this.joyDx / len) * 2500;
      this.worldMouseY = camY + (this.joyDy / len) * 2500;
    } else {
      const cx = this.canvas.width / (2 * devicePixelRatio);
      const cy = this.canvas.height / (2 * devicePixelRatio);
      this.worldMouseX = camX + (this.mouseX - cx) / zoom;
      this.worldMouseY = camY + (this.mouseY - cy) / zoom;
    }
  }

  setJoystick(dx: number, dy: number, active: boolean) {
    this.joyDx = dx;
    this.joyDy = dy;
    this.joyActive = active;
  }
}
