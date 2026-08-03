import { PHYSICS, massToRadius } from '../utils/constants';

let nextVirusId = 1;

export class Virus {
  id: number;
  x: number;
  y: number;
  mass: number;
  vx = 0;
  vy = 0;

  constructor(x: number, y: number, mass = PHYSICS.VIRUS_MASS) {
    this.id = nextVirusId++;
    this.x = x;
    this.y = y;
    this.mass = mass;
  }

  get radius(): number {
    return massToRadius(this.mass);
  }
}
