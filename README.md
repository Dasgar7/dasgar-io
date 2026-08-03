# Dasgar.io

**Modern Agar.io-style single-player browser game** with dark neon visuals and smart AI bots.

Runs entirely in the browser — no backend, no WebSockets, no accounts.

## Quick Start

```bash
npm install
npm run dev
```

Open **http://localhost:5173**

### Production / Vercel

```bash
npm run build
# deploy the `dist/` folder as a static site
```

## Features

- **70 AI bots** that wander, hunt food, chase prey, flee threats, split, and respawn
- Thousands of food pellets + viruses
- Smooth camera, mass-based zoom, glossy cells
- Desktop (mouse + keyboard) and mobile (joystick + buttons)
- Spatial grid for efficient collisions
- Object pooling for food
- Modular architecture ready for future multiplayer

## Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Move | Mouse | Joystick |
| Split | Space | ⬡ |
| Feed | W | ◉ |
| Multi-split | Q / E / R | ⬢ |
| Macro feed | F | — |

## Architecture

```
src/
  core/       Game loop, World simulation, SpatialGrid
  entities/   Cell, Food, Virus, Player (human + bots share this)
  ai/         BotController — drives bots via the same Player API
  render/     Canvas renderer
  input/      Mouse, keyboard, joystick
  ui/         Menu, HUD, styles
  utils/      Constants & helpers
```

Bots and the human player both use the `Player` class. To add multiplayer later, replace or supplement bot targets with network input — no need to rewrite physics or rendering.

## License

MIT © Dasgar7
