// Animated voxel material. Extends MeshLambertMaterial via onBeforeCompile to
// add a `wave` per-vertex attribute that drives subtle vertex displacement:
//  - wave == 1 (grass tops, cross plants): horizontal sway
//  - wave == 2 (leaves): both horizontal sway and vertical bob
//  - wave == 3 (water surface): up-down ripple
// A shared `uTime` uniform is updated each frame.

import * as THREE from 'three';
import { atlasTexture } from './textures.js';

export const sharedUniforms = {
  uTime: { value: 0 }
};

function makeBaseMaterial(opts = {}) {
  const mat = new THREE.MeshLambertMaterial({
    map: atlasTexture,
    vertexColors: true,
    transparent: !!opts.transparent,
    alphaTest: opts.alphaTest ?? 0.2,
    depthWrite: opts.depthWrite ?? true,
    side: opts.side ?? THREE.FrontSide
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        attribute float wave;
        uniform float uTime;
      `)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3( position );
        if (wave > 0.5) {
          float t = uTime;
          // world-space position approximation using object position + local
          float wx = position.x + modelMatrix[3].x;
          float wz = position.z + modelMatrix[3].z;
          if (wave > 2.5) {
            // water surface ripple
            transformed.y += sin(t*1.6 + wx*0.6 + wz*0.4) * 0.06
                           + cos(t*1.1 + wx*0.4 - wz*0.3) * 0.04;
          } else if (wave > 1.5) {
            // leaves
            transformed.x += sin(t*1.2 + wx*0.7) * 0.06;
            transformed.z += cos(t*1.0 + wz*0.8) * 0.06;
            transformed.y += sin(t*0.7 + (wx+wz)*0.4) * 0.03;
          } else {
            // grass / cross plants top sway
            float a = sin(t*1.8 + wx*0.6 + wz*0.5) * 0.10;
            transformed.x += a;
            transformed.z += cos(t*1.5 + wx*0.4) * 0.05;
          }
        }
      `);
  };
  // ensure custom shader recompiles
  mat.customProgramCacheKey = () => 'voxel-anim-' + (opts.transparent ? 't' : 'o');
  return mat;
}

export const opaqueMaterial = makeBaseMaterial({ transparent: false, alphaTest: 0.2, depthWrite: true });
export const transparentMaterial = makeBaseMaterial({ transparent: true, alphaTest: 0.05, depthWrite: false, side: THREE.DoubleSide });

export function tickMaterials(seconds) {
  sharedUniforms.uTime.value = seconds;
}
