import { PHYSICS, massToRadius } from '../../../shared/src/index';
let nextVirusId = 1;
export class Virus {
  id: number; x: number; y: number; mass: number; vx = 0; vy = 0;
  constructor(x: number, y: number, mass = PHYSICS.VIRUS_MASS) {
    this.id = nextVirusId++; this.x = x; this.y = y; this.mass = mass;
  }
  get radius() { return massToRadius(this.mass); }
  toData() {
    return { id: this.id, x: Math.round(this.x*10)/10, y: Math.round(this.y*10)/10,
      mass: Math.round(this.mass), radius: Math.round(this.radius*10)/10 };
  }
}
