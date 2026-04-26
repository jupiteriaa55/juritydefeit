// Generates a starting castle and a small village near spawn, applying the
// blocks directly to the world. Also stores NPC spawn points.

import * as B from './blocks.js';

export function buildCastle(world, ox, oz) {
  // Determine ground level by averaging heights at corners
  const w = 14, d = 12, h = 7;
  const baseY = avgHeight(world, ox, oz, w, d) + 1;
  // Foundation of cobble
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
    fillColumn(world, ox + x, baseY - 2, baseY - 1, oz + z, B.COBBLE);
  }
  // Walls of stone, thickness 1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      world.setBlock(ox + x, baseY + y, oz, B.STONE, { persist: false });
      world.setBlock(ox + x, baseY + y, oz + d - 1, B.STONE, { persist: false });
    }
    for (let z = 0; z < d; z++) {
      world.setBlock(ox, baseY + y, oz + z, B.STONE, { persist: false });
      world.setBlock(ox + w - 1, baseY + y, oz + z, B.STONE, { persist: false });
    }
  }
  // Crenellations
  for (let x = 0; x < w; x += 2) {
    world.setBlock(ox + x, baseY + h, oz, B.STONE, { persist: false });
    world.setBlock(ox + x, baseY + h, oz + d - 1, B.STONE, { persist: false });
  }
  for (let z = 0; z < d; z += 2) {
    world.setBlock(ox, baseY + h, oz + z, B.STONE, { persist: false });
    world.setBlock(ox + w - 1, baseY + h, oz + z, B.STONE, { persist: false });
  }
  // Towers at corners
  for (const [tx, tz] of [[0,0], [w-1,0], [0,d-1], [w-1,d-1]]) {
    for (let y = 0; y <= h + 3; y++) world.setBlock(ox + tx, baseY + y, oz + tz, B.STONE, { persist: false });
  }
  // Floor of plank inside
  for (let x = 1; x < w - 1; x++) for (let z = 1; z < d - 1; z++) {
    world.setBlock(ox + x, baseY - 1, oz + z, B.PLANK, { persist: false });
  }
  // Doorway in front wall (z = 0)
  const doorX = ox + Math.floor(w / 2);
  for (let y = 0; y < 3; y++) world.setBlock(doorX, baseY + y, oz, B.AIR, { persist: false });
  world.setBlock(doorX - 1, baseY + 3, oz, B.STONE, { persist: false });
  world.setBlock(doorX + 1, baseY + 3, oz, B.STONE, { persist: false });
  // Windows
  for (let x = 2; x < w - 2; x += 3) {
    world.setBlock(ox + x, baseY + 2, oz, B.GLASS, { persist: false });
    world.setBlock(ox + x, baseY + 2, oz + d - 1, B.GLASS, { persist: false });
  }
  for (let z = 2; z < d - 2; z += 3) {
    world.setBlock(ox, baseY + 2, oz + z, B.GLASS, { persist: false });
    world.setBlock(ox + w - 1, baseY + 2, oz + z, B.GLASS, { persist: false });
  }
  // Throne room: a chair from stone + lamp
  const tx = ox + Math.floor(w / 2);
  const tz = oz + d - 3;
  world.setBlock(tx, baseY, tz, B.PLANK, { persist: false });
  world.setBlock(tx, baseY + 1, tz, B.PLANK, { persist: false });
  world.setBlock(tx, baseY + 2, tz, B.PLANK, { persist: false });
  world.setBlock(tx - 1, baseY, tz, B.PLANK, { persist: false });
  world.setBlock(tx + 1, baseY, tz, B.PLANK, { persist: false });
  world.setBlock(tx, baseY + 3, tz - 1, B.LAMP_ON, { persist: false });
  // Path to door
  for (let z = -6; z <= 0; z++) world.setBlock(doorX, baseY - 1, oz + z, B.PATH, { persist: false });
  return { ox, oz, baseY, w, d, h, doorX, gateZ: oz };
}

export function buildVillage(world, ox, oz) {
  const homes = [];
  const layouts = [
    { dx: 0, dz: 0, w: 7, d: 6 },
    { dx: 12, dz: 1, w: 6, d: 6 },
    { dx: 0, dz: 10, w: 7, d: 6 },
    { dx: 12, dz: 12, w: 7, d: 7 },
    { dx: 24, dz: 4, w: 6, d: 8 }
  ];
  // Plaza/path
  for (let x = 4; x < 26; x++) for (let z = 7; z < 10; z++) {
    const y = world.heightAt(ox + x, oz + z) + 1;
    world.setBlock(ox + x, y - 1, oz + z, B.PATH, { persist: false });
    // clear above path
    for (let yy = y; yy < y + 3; yy++) world.setBlock(ox + x, yy, oz + z, B.AIR, { persist: false });
  }
  for (const lay of layouts) {
    const home = buildHouse(world, ox + lay.dx, oz + lay.dz, lay.w, lay.d);
    homes.push(home);
  }
  // Well in plaza centre
  const wx = ox + 14, wz = oz + 8;
  const wy = world.heightAt(wx, wz) + 1;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    world.setBlock(wx + dx, wy - 1, wz + dz, B.COBBLE, { persist: false });
  }
  for (let dy = 0; dy < 2; dy++) {
    world.setBlock(wx - 1, wy + dy, wz, B.COBBLE, { persist: false });
    world.setBlock(wx + 1, wy + dy, wz, B.COBBLE, { persist: false });
    world.setBlock(wx, wy + dy, wz - 1, B.COBBLE, { persist: false });
    world.setBlock(wx, wy + dy, wz + 1, B.COBBLE, { persist: false });
  }
  world.setBlock(wx, wy, wz, B.WATER, { persist: false });
  return { homes, well: { x: wx, y: wy, z: wz } };
}

function buildHouse(world, ox, oz, w, d) {
  const baseY = avgHeight(world, ox, oz, w, d) + 1;
  // foundation
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
    world.setBlock(ox + x, baseY - 1, oz + z, B.COBBLE, { persist: false });
  }
  // walls of plank, height 4
  const h = 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      world.setBlock(ox + x, baseY + y, oz, B.PLANK, { persist: false });
      world.setBlock(ox + x, baseY + y, oz + d - 1, B.PLANK, { persist: false });
    }
    for (let z = 0; z < d; z++) {
      world.setBlock(ox, baseY + y, oz + z, B.PLANK, { persist: false });
      world.setBlock(ox + w - 1, baseY + y, oz + z, B.PLANK, { persist: false });
    }
  }
  // corner posts
  for (const [tx, tz] of [[0,0],[w-1,0],[0,d-1],[w-1,d-1]]) {
    for (let y = 0; y < h; y++) world.setBlock(ox + tx, baseY + y, oz + tz, B.WOOD, { persist: false });
  }
  // door (front, mid)
  const doorX = ox + Math.floor(w / 2);
  for (let y = 0; y < 2; y++) world.setBlock(doorX, baseY + y, oz, B.AIR, { persist: false });
  // windows
  world.setBlock(ox + 1, baseY + 1, oz, B.GLASS, { persist: false });
  world.setBlock(ox + w - 2, baseY + 1, oz, B.GLASS, { persist: false });
  world.setBlock(ox + 1, baseY + 1, oz + d - 1, B.GLASS, { persist: false });
  world.setBlock(ox + w - 2, baseY + 1, oz + d - 1, B.GLASS, { persist: false });
  // pyramid roof
  const cx = w / 2, cz = d / 2;
  for (let y = 0; y < Math.max(w, d); y++) {
    let any = false;
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        const dx = Math.abs(x - cx + 0.5);
        const dz = Math.abs(z - cz + 0.5);
        const m = Math.max(dx, dz);
        if (m >= y - 0.4 && m < y + 0.6) {
          world.setBlock(ox + x, baseY + h + y, oz + z, B.ROOF, { persist: false });
          any = true;
        }
      }
    }
    if (!any) break;
  }
  // floor
  for (let x = 1; x < w - 1; x++) for (let z = 1; z < d - 1; z++) {
    world.setBlock(ox + x, baseY - 1, oz + z, B.PLANK, { persist: false });
  }
  // a lamp inside
  world.setBlock(ox + Math.floor(w / 2), baseY + h - 1, oz + Math.floor(d / 2), B.LAMP_ON, { persist: false });
  // NPC spawn point in front of door
  const npcSpawn = { x: doorX + 0.5, y: baseY, z: oz - 1.5 };
  return { ox, oz, baseY, w, d, h, doorX, npcSpawn };
}

function avgHeight(world, ox, oz, w, d) {
  let max = 0;
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
    const h = world.heightAt(ox + x, oz + z);
    if (h > max) max = h;
  }
  return max;
}

// Flatten ground under a structure to remove tree clutter and give a flat plate.
export function flatten(world, ox, oz, w, d, surface = B.GRASS) {
  const target = avgHeight(world, ox, oz, w, d);
  for (let x = -1; x <= w; x++) for (let z = -1; z <= d; z++) {
    const wx = ox + x, wz = oz + z;
    const h = world.heightAt(wx, wz);
    // raise low ground
    for (let y = h + 1; y <= target; y++) world.setBlock(wx, y, wz, B.DIRT, { persist: false });
    // shave high ground
    for (let y = target + 1; y <= h + 8; y++) {
      const cur = world.getBlock(wx, y, wz);
      if (cur !== B.AIR) world.setBlock(wx, y, wz, B.AIR, { persist: false });
    }
    // top block
    world.setBlock(wx, target, wz, surface, { persist: false });
  }
  return target;
}
