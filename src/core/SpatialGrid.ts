/**
 * Uniform grid spatial partition for O(1) broad-phase collision queries.
 * Modular — can later power client prediction or server AOI.
 */

export interface SpatialItem {
  id: number;
  x: number;
  y: number;
  radius: number;
}

export class SpatialGrid<T extends SpatialItem> {
  private cellSize: number;
  private cols: number;
  private rows: number;
  private buckets: Map<number, T[]> = new Map();

  constructor(worldW: number, worldH: number, cellSize = 120) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldW / cellSize);
    this.rows = Math.ceil(worldH / cellSize);
  }

  clear() {
    this.buckets.clear();
  }

  private key(cx: number, cy: number): number {
    return cy * this.cols + cx;
  }

  insert(item: T) {
    const cx = Math.floor(item.x / this.cellSize);
    const cy = Math.floor(item.y / this.cellSize);
    const k = this.key(cx, cy);
    let bucket = this.buckets.get(k);
    if (!bucket) {
      bucket = [];
      this.buckets.set(k, bucket);
    }
    bucket.push(item);
  }

  /** Query items whose cell overlaps a circle */
  queryRadius(x: number, y: number, radius: number): T[] {
    const r = radius;
    const minCX = Math.max(0, Math.floor((x - r) / this.cellSize));
    const maxCX = Math.min(this.cols - 1, Math.floor((x + r) / this.cellSize));
    const minCY = Math.max(0, Math.floor((y - r) / this.cellSize));
    const maxCY = Math.min(this.rows - 1, Math.floor((y + r) / this.cellSize));
    const out: T[] = [];
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const bucket = this.buckets.get(this.key(cx, cy));
        if (bucket) out.push(...bucket);
      }
    }
    return out;
  }
}
