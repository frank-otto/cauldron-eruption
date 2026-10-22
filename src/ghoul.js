// THE GUMMY GHOUL: a giant wobbling jelly monster with gummy-eyeball eyes and candy-corn teeth that rises out of the
// erupting cauldron, roars and gulps the candy fountain. Plus the candy geyser (instanced candies + a glowing column).
import * as THREE from 'three';
import { POTION_Y } from './world.js';
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
export const GHOUL_Z = -6.6;
export function createGhoul(scene, K) {
  const G = { up: 0, mouth: 0, roar: 0, t: 0, look: new THREE.Vector3(0, 0, 10), active: false };
  const root = new THREE.Group(); root.position.set(0, -9, GHOUL_Z); scene.add(root); root.visible = false; G.root = root;
  const U = { time: { value: 0 }, wob: { value: .4 }, roar: { value: 0 } };
  const mat = new THREE.MeshPhysicalMaterial({ color: '#b03cff', roughness: .14, clearcoat: 1, clearcoatRoughness: .06, transparent: true, opacity: .93, emissive: '#3a0a70', emissiveIntensity: .7, sheen: 1, sheenColor: new THREE.Color('#ffb0ff'), side: THREE.FrontSide });
  mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U); sh.vertexShader = 'uniform float time, wob, roar;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float w = sin(position.y * 2.3 + time * 3.1) * .06 + sin(position.x * 3.1 + time * 2.3) * .05 + sin(position.z * 2.7 - time * 4.) * .04;
      transformed += normal * w * (wob + roar * 1.8); transformed.xz *= 1. + roar * .06 * sin(time * 30.);`); };
  G.mat = mat; G.U = U;
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 54), mat); body.scale.set(3.3, 3.7, 2.7); root.add(body); G.body = body;
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 56, 40), mat); head.scale.set(2.3, 1.9, 2); head.position.set(0, 3.3, .5); root.add(head); G.head = head;
  // candies suspended inside the jelly
  const kinds = []; for (let k = 0; k < 9; k++) { const c = K.make(k % 6); c.scale.setScalar(1.6); c.position.set((Math.random() - .5) * 3.6, (Math.random() - .5) * 4 - .6, (Math.random() - .5) * 2.2); c.rotation.set(Math.random() * 6, Math.random() * 6, 0); root.add(c); kinds.push(c); }
  // eyes: big gummy eyeballs
  G.eyes = []; for (const sx of [-1, 1]) { const e = K.make(2); e.scale.setScalar(2.6); e.position.set(sx * .95, 3.75, 2.15); root.add(e); G.eyes.push(e); }
  // mouth + candy-corn teeth
  const mm = new THREE.MeshStandardMaterial({ color: '#2a0410', emissive: '#5a0016', emissiveIntensity: .8, roughness: .5 });
  G.mouthM = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), mm); G.mouthM.scale.set(1.2, .35, .5); G.mouthM.position.set(0, 2.55, 2.1); root.add(G.mouthM);
  G.teeth = []; for (let q = -3; q <= 3; q++) { const t = new THREE.Mesh(K.geo.corn, K.mats.corn); t.scale.setScalar(.55); t.rotation.z = Math.PI; t.position.set(q * .3, 2.8, 2.35 - Math.abs(q) * .06); root.add(t); G.teeth.push({ m: t, q }); }
  G.tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#ff3a6a', roughness: .3, clearcoat: 1, emissive: '#600020', emissiveIntensity: .5 })); G.tongue.scale.set(.7, .18, .5); G.tongue.position.set(0, 2.25, 2.1); root.add(G.tongue);
  // arms
  G.arms = []; for (const sx of [-1, 1]) { const a = new THREE.Mesh(new THREE.CapsuleGeometry(.55, 2.6, 10, 20), mat); a.position.set(sx * 3.3, 1.2, .6); a.rotation.z = sx * -.9; root.add(a); G.arms.push({ m: a, sx }); }
  const glow = new THREE.PointLight('#d080ff', 0, 20, 1.5); glow.position.set(0, 3, 3); root.add(glow); G.glow = glow;
  return G;
}
export function mouthWorld(G, out) { return out.set(0, 2.55, 2.4).applyMatrix4(G.root.matrixWorld); }
export function updateGhoul(G, t, dt, lookAt) {
  G.t = t; G.U.time.value = t; G.roar = Math.max(0, G.roar - dt * .8); G.U.roar.value = G.roar; G.U.wob.value = .35 + (1 - G.up) * .6;
  G.root.visible = G.up > .002; if (!G.root.visible) return;
  const u = smooth(G.up); G.root.position.y = POTION_Y - 15 + u * 15.2 + Math.sin(t * 1.7) * .2 * u; G.root.scale.setScalar(1.2 + .55 * u); // huge: it towers over the board
  G.root.rotation.z = Math.sin(t * 1.3) * .04; G.root.rotation.y = Math.sin(t * .9) * .08;
  const m = Math.max(G.mouth, G.roar); G.mouthM.scale.set(1.2 + m * .4, .3 + m * 1.25, .5 + m * .2); G.mouthM.position.y = 2.55 - m * .35;
  G.tongue.position.y = 2.25 - m * .75; for (const T of G.teeth) { T.m.position.y = 2.82 + m * .08; T.m.rotation.x = m * .3; }
  for (const A of G.arms) { A.m.rotation.z = A.sx * (-.9 - G.roar * .7 - Math.sin(t * 2 + A.sx) * .12); A.m.position.y = 1.2 + G.roar * .8; }
  G.head.scale.set(2.3 + G.roar * .25, 1.9 + G.roar * .4, 2); G.glow.intensity = 20 * u + G.roar * 60;
  if (lookAt) for (const e of G.eyes) { const p = e.getWorldPosition(new THREE.Vector3()); const d = lookAt.clone().sub(p); e.rotation.set(-Math.atan2(d.y, Math.hypot(d.x, d.z)) * .7, Math.atan2(d.x, d.z) * .7, 0); }
}
// the candy fountain: instanced candies flung from the geyser, falling back or flying into the ghoul's mouth
export function createFountain(scene, K, count = 48) {
  const F = { list: [], col: null };
  const parts = [[K.geo.bonbon, K.mats.bonbon], [K.geo.corn, K.mats.corn], [K.geo.eye, K.mats.eye], [K.geo.lolli, K.mats.lolli], [K.geo.bonbon, K.mats.choc], [K.geo.bat, K.mats.bat]];
  F.meshes = parts.map(([g, m]) => { const im = new THREE.InstancedMesh(g, m, count); im.count = 0; im.frustumCulled = false; scene.add(im); return { im, n: 0, p: [] }; });
  const cm = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, k: { value: 0 }, gold: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec2 vUv; uniform float time, k, gold; float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
      void main(){ float n = noise(vec2(vUv.x * 10., vUv.y * 6. - time * 7.)) * .6 + noise(vec2(vUv.x * 23., vUv.y * 14. - time * 11.)) * .4;
        float side = sin(vUv.x * 3.14159 * 2.) * .5 + .5; float a = smoothstep(.25, .8, n) * (1. - smoothstep(.55, 1., vUv.y)) * k * (.5 + side * .5);
        vec3 c = mix(vec3(.3, 1., .35), vec3(1., .85, .3), gold) * (1.2 + n); gl_FragColor = vec4(c * a, a); }` });
  F.col = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.7, 14, 32, 1, true), cm); F.col.position.set(0, POTION_Y + 7, -1.5); F.col.visible = false; scene.add(F.col); F.cm = cm;
  return F;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function spray(F, n, at, rng, opt = {}) { for (let q = 0; q < n; q++) { const k = Math.floor(rng() * 6); const M = F.meshes[k]; if (M.p.length >= M.im.instanceMatrix.count) continue;
    const a = rng() * Math.PI * 2, sp = (opt.speed || 4) * (.4 + rng());
    M.p.push({ p: at.clone().add(new THREE.Vector3((rng() - .5) * 1.2, 0, (rng() - .5) * 1.2)), v: new THREE.Vector3(Math.cos(a) * sp, (opt.up || 14) * (.7 + rng() * .5), Math.sin(a) * sp * .7 + (opt.vz || 0)),
      r: new THREE.Vector3(rng() * 6, rng() * 6, rng() * 6), w: new THREE.Vector3((rng() - .5) * 9, (rng() - .5) * 9, (rng() - .5) * 9), s: (opt.size || 1.25) * (.8 + rng() * .5), life: opt.life || 4, gulp: rng() < (opt.gulp || 0), g: 0 }); } }
export function updateFountain(F, t, dt, mouth, onGulp) { F.cm.uniforms.time.value = t;
  for (const M of F.meshes) { for (let i = M.p.length - 1; i >= 0; i--) { const P = M.p[i]; P.life -= dt;
      if (P.gulp && mouth && P.v.y < 3) { P.g = Math.min(1, P.g + dt * 1.4); const d = _p.copy(mouth).sub(P.p); const L = d.length(); P.v.lerp(d.normalize().multiplyScalar(14), Math.min(1, dt * 6 * P.g)); if (L < .8) { onGulp && onGulp(P); M.p.splice(i, 1); continue; } }
      else P.v.y -= 16 * dt; P.p.addScaledVector(P.v, dt); P.r.addScaledVector(P.w, dt);
      if (P.life <= 0 || P.p.y < POTION_Y - 1.5) { M.p.splice(i, 1); continue; } }
    M.im.count = M.p.length; M.p.forEach((P, i) => { _q.setFromEuler(_e.set(P.r.x, P.r.y, P.r.z)); _s.setScalar(P.s * Math.min(1, P.life * 2)); _m.compose(P.p, _q, _s); M.im.setMatrixAt(i, _m); }); M.im.instanceMatrix.needsUpdate = true; } }
export const fountainCount = F => F.meshes.reduce((a, M) => a + M.p.length, 0);
