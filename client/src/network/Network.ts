import { MsgType } from '../../../shared/src/index';
export type MessageHandler = (msg: any) => void;
export class Network {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private url: string;
  private reconnectAttempts = 0;
  public connected = false;
  public latency = 0;
  constructor(url?: string) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.url = url || `${proto}://${location.hostname}:3001`;
  }
  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => { this.connected = true; this.reconnectAttempts = 0; console.log('[Net] Connected'); this.ping(); };
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === MsgType.PONG) { this.latency = Date.now() - msg.t; return; }
        for (const h of this.handlers) h(msg);
      } catch {}
    };
    this.ws.onclose = () => { this.connected = false; this.scheduleReconnect(); };
    this.ws.onerror = () => { this.connected = false; };
  }
  private scheduleReconnect() {
    if (this.reconnectAttempts > 8) return;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }
  onMessage(h: MessageHandler) { this.handlers.push(h); }
  send(obj: object) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj)); }
  join(name: string, color?: string) { this.send({ type: MsgType.JOIN, name, color }); }
  sendInput(mx: number, my: number, seq: number) { this.send({ type: MsgType.INPUT, mx, my, seq }); }
  split() { this.send({ type: MsgType.SPLIT }); }
  eject() { this.send({ type: MsgType.EJECT }); }
  ping() {
    this.send({ type: MsgType.PING, t: Date.now() });
    setTimeout(() => { if (this.connected) this.ping(); }, 2000);
  }
}
