import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import express from 'express';
import { v4 as uuid } from 'uuid';
import { GameWorld } from '../game/GameWorld';
import { Player } from '../game/Player';
import { MsgType, TICK_MS, WORLD } from '../../../shared/src/index';

export class GameServer {
  wss: WebSocketServer;
  world: GameWorld;
  clients = new Map<string, WebSocket>();
  httpServer: ReturnType<typeof createServer>;

  constructor(port = 3001) {
    const app = express();
    app.use(express.static('../client/dist'));
    app.get('/health', (_, res) => res.json({ ok: true, players: this.world?.players.size ?? 0 }));
    this.httpServer = createServer(app);
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.world = new GameWorld();
    this.world.onKill = (killer, victim) => {
      this.broadcast({ type: MsgType.KILL, killer: killer.name, victim: victim.name });
      if (victim.ws?.readyState === WebSocket.OPEN)
        victim.ws.send(JSON.stringify({ type: MsgType.DEATH, killer: killer.name }));
    };
    this.wss.on('connection', (ws) => this.onConnection(ws));
    this.httpServer.listen(port, () => console.log(`[Dasgar.io] Server listening on :${port}`));
    setInterval(() => this.tick(), TICK_MS);
  }

  onConnection(ws: WebSocket) {
    const id = uuid();
    this.clients.set(id, ws);
    console.log(`[+] Client: ${id.slice(0, 8)}`);
    ws.on('message', (raw) => {
      try { this.handleMessage(id, ws, JSON.parse(raw.toString())); } catch {}
    });
    ws.on('close', () => { this.world.removePlayer(id); this.clients.delete(id); });
    ws.on('error', () => { this.world.removePlayer(id); this.clients.delete(id); });
  }

  handleMessage(id: string, ws: WebSocket, msg: any) {
    switch (msg.type) {
      case MsgType.JOIN: {
        const player = new Player(id, msg.name || 'Cell', ws, msg.color);
        this.world.addPlayer(player);
        ws.send(JSON.stringify({ type: MsgType.WELCOME, playerId: id, world: WORLD, tickRate: 20 }));
        break;
      }
      case MsgType.INPUT: {
        const p = this.world.players.get(id);
        if (!p) return;
        p.targetX = msg.mx; p.targetY = msg.my; p.lastInputSeq = msg.seq || 0;
        break;
      }
      case MsgType.SPLIT: this.world.doSplit(id); break;
      case MsgType.EJECT: this.world.doEject(id); break;
      case MsgType.PING: ws.send(JSON.stringify({ type: MsgType.PONG, t: msg.t })); break;
      case MsgType.CHAT: {
        const p = this.world.players.get(id);
        if (p) this.broadcast({ type: MsgType.CHAT_MSG, name: p.name, text: String(msg.text||'').slice(0,120) });
        break;
      }
    }
  }

  tick() {
    this.world.update(TICK_MS / 1000);
    const snapshot = this.world.getSnapshot();
    const stateMsg = JSON.stringify({ type: MsgType.STATE, ...snapshot });
    const lbMsg = this.world.tick % 10 === 0
      ? JSON.stringify({ type: MsgType.LEADERBOARD, entries: this.world.getLeaderboard() }) : null;
    for (const ws of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(stateMsg);
        if (lbMsg) ws.send(lbMsg);
      }
    }
  }

  broadcast(obj: object) {
    const data = JSON.stringify(obj);
    for (const ws of this.clients.values())
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}
