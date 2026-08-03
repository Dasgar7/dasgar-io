import { FOOD, PHYSICS } from '../utils/constants';

let nextFoodId = 1;
const pool: FoodPellet[] = [];

export class FoodPellet {
  id: number;
  x = 0;
  y = 0;
  color = FOOD.COLORS[0];
  mass = PHYSICS.FOOD_MASS;
  alive = true;

  constructor() {
    this.id = nextFoodId++;
  }

  static acquire(x: number, y: number, color?: string): FoodPellet {
    const f = pool.pop() || new FoodPellet();
    f.x = x;
    f.y = y;
    f.color = color || FOOD.COLORS[Math.floor(Math.random() * FOOD.COLORS.length)];
    f.mass = PHYSICS.FOOD_MASS;
    f.alive = true;
    return f;
  }

  release() {
    this.alive = false;
    pool.push(this);
  }
}
