// Tiny redstone-like circuit. A BUTTON, when activated, lights up adjacent
// LAMP_OFF blocks via WIRE neighbours. Activation is a one-shot pulse that
// lasts a few seconds, after which the lamps revert.

import * as B from './blocks.js';

export class Redstone {
  constructor(world) {
    this.world = world;
    this.pulses = []; // {x,y,z, until, lamps:[{x,y,z}]}
  }

  activateButton(x, y, z) {
    const lamps = this.findReachableLamps(x, y, z);
    for (const l of lamps) {
      this.world.setBlock(l.x, l.y, l.z, B.LAMP_ON);
    }
    const until = performance.now() + 4000;
    this.pulses.push({ x, y, z, until, lamps });
  }

  update() {
    const now = performance.now();
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      if (now > p.until) {
        for (const l of p.lamps) {
          if (this.world.getBlock(l.x, l.y, l.z) === B.LAMP_ON) {
            this.world.setBlock(l.x, l.y, l.z, B.LAMP_OFF);
          }
        }
        this.pulses.splice(i, 1);
      }
    }
  }

  findReachableLamps(sx, sy, sz, max = 64) {
    const visited = new Set();
    const queue = [[sx, sy, sz]];
    const lamps = [];
    const key = (x, y, z) => `${x},${y},${z}`;
    visited.add(key(sx, sy, sz));
    const dirs = [
      [1,0,0],[-1,0,0],[0,0,1],[0,0,-1],
      [0,1,0],[0,-1,0]
    ];
    while (queue.length && visited.size < max) {
      const [x, y, z] = queue.shift();
      for (const [dx, dy, dz] of dirs) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        const k = key(nx, ny, nz);
        if (visited.has(k)) continue;
        const id = this.world.getBlock(nx, ny, nz);
        if (id === B.WIRE) {
          visited.add(k); queue.push([nx, ny, nz]);
        } else if (id === B.LAMP_OFF || id === B.LAMP_ON) {
          visited.add(k);
          lamps.push({ x: nx, y: ny, z: nz });
        }
      }
    }
    return lamps;
  }
}
