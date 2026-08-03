import { GameServer } from './network/Server';
const PORT = parseInt(process.env.PORT || '3001', 10);
new GameServer(PORT);
console.log(`
  ╔═══════════════════════════════════════╗
  ║         D A S G A R . I O             ║
  ║     Modern Agar.io Multiplayer        ║
  ╚═══════════════════════════════════════╝
`);
