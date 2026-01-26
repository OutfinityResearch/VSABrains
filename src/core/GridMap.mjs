import { HeavyHitters } from './HeavyHitters.mjs';

/**
 * 2D discrete map with HeavyHitters cells.
 * Supports dense or sparse (hash-grid) storage.
 */
export class GridMap {
  constructor(config = { width: 64, height: 64, k: 4, sparse: false }) {
    this.width = config.width || 64;
    this.height = config.height || 64;
    this.k = config.k || 4;
    
    // DS006 §7.1: Sparse if > 128x128
    this.sparse = config.sparse ?? (this.width > 128 || this.height > 128);

    if (this.sparse) {
      this.cells = new Map();
    } else {
      this.cells = Array.from({ length: this.height }, () =>
        Array.from({ length: this.width }, () => null)
      );
    }
  }

  _getLocKey(x, y) {
    return (((x & 0xffff) << 16) | (y & 0xffff)) >>> 0;
  }

  /**
   * Get or create a HeavyHitters cell at location.
   */
  _getCell(x, y) {
    if (this.sparse) {
      const key = this._getLocKey(x, y);
      let cell = this.cells.get(key);
      if (!cell) {
        cell = new HeavyHitters(this.k);
        this.cells.set(key, cell);
      }
      return cell;
    } else {
      let cell = this.cells[y][x];
      if (!cell) {
        cell = new HeavyHitters(this.k);
        this.cells[y][x] = cell;
      }
      return cell;
    }
  }

  /** Write token at location */
  update(x, y, tokenId, weight = 1.0) {
    const cell = this._getCell(x, y);
    cell.update(tokenId, weight);
  }

  /** Read top-K at location */
  readTopK(x, y, n = 4) {
    if (this.sparse) {
      const key = this._getLocKey(x, y);
      const cell = this.cells.get(key);
      return cell ? cell.topK(n) : [];
    } else {
      const cell = this.cells[y][x];
      return cell ? cell.topK(n) : [];
    }
  }

  /** Get all non-empty cells for diagnostics */
  nonEmptyCells() {
    if (this.sparse) {
      return this.cells.size;
    } else {
      let count = 0;
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          if (this.cells[y][x]) count++;
        }
      }
      return count;
    }
  }

  /**
   * Diagnostics: utilization and saturation.
   */
  stats() {
    let nonEmpty = 0;
    let full = 0;

    if (this.sparse) {
      for (const cell of this.cells.values()) {
        nonEmpty++;
        if (cell.counts.size >= this.k) full++;
      }
    } else {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const cell = this.cells[y][x];
          if (!cell) continue;
          nonEmpty++;
          if (cell.counts.size >= this.k) full++;
        }
      }
    }

    const totalCells = this.width * this.height;
    const gridUtilization = totalCells > 0 ? nonEmpty / totalCells : 0;
    const cellSaturation = nonEmpty > 0 ? full / nonEmpty : 0;

    return {
      nonEmptyCells: nonEmpty,
      cellsAtFullCapacity: full,
      gridUtilization,
      cellSaturation
    };
  }

  toJSON() {
    const serializedCells = [];
    if (this.sparse) {
      for (const [key, cell] of this.cells.entries()) {
        serializedCells.push([key, cell.toJSON()]);
      }
    } else {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          if (this.cells[y][x]) {
            serializedCells.push([this._getLocKey(x, y), this.cells[y][x].toJSON()]);
          }
        }
      }
    }
    return {
      width: this.width,
      height: this.height,
      k: this.k,
      sparse: this.sparse,
      cells: serializedCells
    };
  }

  static fromJSON(data) {
    const map = new GridMap(data);
    for (const [key, cellData] of data.cells) {
      const x = key >>> 16;
      const y = key & 0xffff;
      if (map.sparse) {
        map.cells.set(key, HeavyHitters.fromJSON(cellData));
      } else {
        map.cells[y][x] = HeavyHitters.fromJSON(cellData);
      }
    }
    return map;
  }
}
