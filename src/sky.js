// Sky elements: sun + moon sprites, drifting clouds, night stars.

import * as THREE from 'three';

function makeSpriteCanvas(draw, size = 128) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Build a sky dome: large inverted sphere with a vertical gradient texture,
// so we always have a visible sky even when scene.background isn't honoured.
function makeSkyDome() {
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#7fb6ec');    // zenith
  g.addColorStop(0.50, '#a7d2f4');  // upper sky
  g.addColorStop(0.78, '#cfe5fa');  // mid
  g.addColorStop(1, '#ffffff');     // horizon
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 20), mat);
  dome.userData.gradTex = tex;
  dome.renderOrder = -1000;
  dome.frustumCulled = false;
  return dome;
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.dome = makeSkyDome();
    scene.add(this.dome);
    // Sun
    const sunTex = makeSpriteCanvas((ctx, s) => {
      const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
      g.addColorStop(0, 'rgba(255,255,200,1)');
      g.addColorStop(0.4, 'rgba(255,220,90,0.85)');
      g.addColorStop(1, 'rgba(255,180,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false }));
    this.sun.scale.set(20, 20, 1);
    scene.add(this.sun);

    // Moon
    const moonTex = makeSpriteCanvas((ctx, s) => {
      ctx.fillStyle = '#dde6ff';
      ctx.beginPath(); ctx.arc(s/2, s/2, s*0.32, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(s*0.62, s*0.45, s*0.30, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // craters
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.arc(s*0.38, s*0.50, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s*0.46, s*0.62, 3, 0, Math.PI * 2); ctx.fill();
    });
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false }));
    this.moon.scale.set(14, 14, 1);
    scene.add(this.moon);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const N = 600;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 220;
      const t = Math.random() * Math.PI * 2;
      const p = Math.random() * Math.PI;
      const x = r * Math.sin(p) * Math.cos(t);
      const y = r * Math.cos(p) * 0.6 + 60;
      const z = r * Math.sin(p) * Math.sin(t);
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.stars = new THREE.Points(starGeo, starMat);
    scene.add(this.stars);

    // Clouds — instanced flat planes drifting horizontally
    const cloudTex = makeSpriteCanvas((ctx, s) => {
      const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
      g.addColorStop(0, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(s/2, s/2, s*0.45, s*0.22, 0, 0, Math.PI * 2); ctx.fill();
    });
    this.cloudGroup = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false }));
      const sx = 16 + Math.random() * 18;
      const sy = sx * 0.4;
      m.scale.set(sx, sy, 1);
      m.position.set((Math.random() - 0.5) * 220, 60 + Math.random() * 18, (Math.random() - 0.5) * 220);
      m.userData.speed = 0.6 + Math.random() * 0.6;
      this.cloudGroup.add(m);
    }
    scene.add(this.cloudGroup);
  }

  update(dt, timeOfDay, cameraPos) {
    // Sun and moon revolve over an arc; moon is opposite the sun.
    const t = timeOfDay; // 0..1
    const ang = t * Math.PI * 2 - Math.PI / 2;
    const R = 180;
    const sx = Math.cos(ang) * R;
    const sy = Math.sin(ang) * R;
    this.sun.position.set(cameraPos.x + sx * 0.6, cameraPos.y + sy + 60, cameraPos.z + 30);
    this.moon.position.set(cameraPos.x - sx * 0.6, cameraPos.y - sy + 60, cameraPos.z + 30);
    const dayInt = Math.max(0, Math.sin(ang));
    this.sun.material.opacity = 0.4 + dayInt * 0.6;
    this.moon.material.opacity = (1 - dayInt) * 0.85;
    this.stars.material.opacity = (1 - dayInt) * 0.9;
    this.stars.position.copy(cameraPos);
    // Clouds drift
    for (const c of this.cloudGroup.children) {
      c.position.x += c.userData.speed * dt;
      // wrap around
      if (c.position.x - cameraPos.x > 130) c.position.x -= 260;
      if (c.position.x - cameraPos.x < -130) c.position.x += 260;
      if (c.position.z - cameraPos.z > 130) c.position.z -= 260;
      if (c.position.z - cameraPos.z < -130) c.position.z += 260;
    }
    this.cloudGroup.position.set(0, 0, 0);
    // Move dome with camera so horizon is always at the camera's altitude.
    if (this.dome) {
      this.dome.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
      // Tint the dome by day intensity: blue daytime → orange sunset → deep blue night.
      let r, g, b;
      if (dayInt > 0.4) {
        r = 0.6 + dayInt * 0.4; g = 0.82; b = 1.0;
      } else if (dayInt > 0.0) {
        const k = dayInt / 0.4;
        r = 0.95 - k * 0.25; g = 0.55 + k * 0.27; b = 0.45 + k * 0.55;
      } else {
        r = 0.06; g = 0.08; b = 0.18;
      }
      this.dome.material.color.setRGB(r, g, b);
    }
  }
}
