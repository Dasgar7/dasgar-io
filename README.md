# Dasgar.io

**Modern Agar.io-style multiplayer browser game** — dark neon theme, smooth 60 FPS, TypeScript client + Node.js WebSocket server.

## Quick Start

```bash
npm install
npm run dev          # server :3001 + client :5173
```

Open http://localhost:5173

## Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Move | Mouse | Joystick |
| Split | Space | ⬡ |
| Feed | W | ◉ |
| Double/Triple/Quad | Q / E / R | ⬢ |
| Macro feed | F | — |

## Structure

```
client/   Vite + Canvas + TypeScript
server/   Node.js + ws + authoritative physics
shared/   Constants, types, protocol
```

## Features (v1.0)

- Server-authoritative multiplayer
- Eat pellets, players, virus pop
- Split / feed / merge
- Smooth interpolation & camera zoom
- Desktop + mobile controls
- Leaderboard, kill feed, death screen
- Dark neon green UI

Scaffolded for shop, skins, progression, modes, admin panel — see `docs/ARCHITECTURE.md`.

## License

MIT © Dasgar7
