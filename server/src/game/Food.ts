import { FOOD, PHYSICS } from '../../../shared/src/index';
let nextFoodId = 1;
export class FoodPellet {
  id: number; x: number; y: number; color: string; mass: number;
  constructor(x: number, y: number, color?: string) {
    this.id = nextFoodId++; this.x = x; this.y = y;
    this.color = color || FOOD.COLORS[Math.floor(Math.random() * FOOD.COLORS.length)];
    this.mass = PHYSICS.FOOD_MASS;
  }
  toData() { return { id: this.id, x: Math.round(this.x), y: Math.round(this.y), color: this.color, mass: this.mass }; }
}
