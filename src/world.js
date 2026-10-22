// The witch's kitchen: a giant iron cauldron bubbling with glowing potion over a log fire, stone walls, shelves of glowing
// jars, candles, a moonlit arched window, steam. The match-3 board floats on the brew as a licorice-and-glass tray.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { cv, tex, rnd, noise2, softTexture, smokeTexture, stoneTextures, flagTextures, woodTexture } from './tex.js';
export const QUALITY = {
  low: { dpr: 1, shadows: false, bloom: .75, parts: .45, msaa: 0, steam: 10, jarLights: false },
  mid: { dpr: 1.25, shadows: true, shadowSize: 1024, bloom: 1, parts: .8, msaa: 4, steam: 18, jarLights: true },
  high: { dpr: 1.6, shadows: true, shadowSize: 2048, bloom: 1, parts: 1, msaa: 4, steam: 24, jarLights: true },
  ultra: { dpr: 2, shadows: true, shadowSize: 2048, bloom: 1, parts: 1.3, msaa: 4, steam: 30, jarLights: true }
};
export const POTION_Y = -.5, RIM_R = 7.3, RIM_Y = -.32;
const fin = (v, d = 0) => Number.isFinite(v) ? v : d;
function moonCanvas() { const S = 512, [c, g] = cv(S, S), n = noise2(77), r = rnd(78); const im = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const dx = (x - S / 2) / (S / 2 - 6), dy = (y - S / 2) / (S / 2 - 6), d = Math.hypot(dx, dy); const i = (y * S + x) * 4;
    if (d > 1) { im.data[i + 3] = 0; continue; } const mare = n(x / 70 + 2, y / 70), v = .8 + n(x / 9, y / 9) * .2 - Math.max(0, mare - .45) * 1.1, limb = .72 + .28 * Math.sqrt(1 - d * d);
    im.data[i] = 255 * v * limb; im.data[i + 1] = 246 * v * limb; im.data[i + 2] = 222 * v * limb; im.data[i + 3] = 255 * Math.min(1, (1 - d) * 90); }
  g.putImageData(im, 0, 0); for (let k = 0; k < 40; k++) { const a = r() * 6.28, rr = Math.sqrt(r()) * S * .43, x = S / 2 + Math.cos(a) * rr, y = S / 2 + Math.sin(a) * rr, s = 3 + r() * r() * 26;
    const cg = g.createRadialGradient(x + s * .25, y + s * .25, 0, x, y, s); cg.addColorStop(0, 'rgba(60,54,50,.18)'); cg.addColorStop(.8, 'rgba(60,54,50,.1)'); cg.addColorStop(1, 'rgba(255,250,240,.12)'); g.fillStyle = cg; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }
  return c; }
function flameTexture() { const [c, g] = cv(128, 256); const gr = g.createRadialGradient(64, 180, 4, 64, 160, 110); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(.25, 'rgba(255,200,80,.95)'); gr.addColorStop(.6, 'rgba(255,90,10,.5)'); gr.addColorStop(1, 'rgba(120,10,0,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(64, 6); g.bezierCurveTo(118, 120, 120, 200, 64, 250); g.bezierCurveTo(8, 200, 10, 120, 64, 6); g.fill(); return tex(c); }
function ironTextures() { const S = 512, [c, g] = cv(S, S), [hc, hg] = cv(S, S), n = noise2(41), r = rnd(42); const im = g.createImageData(S, S), hm = hg.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = n(x / 18, y / 18), w = n(x / 4, y / 4), i = (y * S + x) * 4; const rust = Math.max(0, n(x / 50 + 9, y / 50) - .6) * 2.4;
    im.data[i] = 34 + v * 22 + rust * 60; im.data[i + 1] = 30 + v * 18 + rust * 26; im.data[i + 2] = 32 + v * 18 + rust * 8; im.data[i + 3] = 255; const hh = 120 + v * 80 + w * 40; hm.data[i] = hm.data[i + 1] = hm.data[i + 2] = hh; hm.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); hg.putImageData(hm, 0, 0); for (let k = 0; k < 40; k++) { const x = r() * S, y = r() * S; g.fillStyle = 'rgba(10,8,10,.5)'; g.beginPath(); g.arc(x, y, 3 + r() * 4, 0, 7); g.fill(); hg.fillStyle = '#fff'; hg.beginPath(); hg.arc(x, y, 3, 0, 7); hg.fill(); }
  return { map: tex(c, true, [6, 2]), rough: tex(hc, false, [6, 2]) }; }
function potionMaterial() { return new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, gold: { value: 0 }, boil: { value: .3 }, glow: { value: 1 } },
  vertexShader: 'varying vec2 vP; varying vec3 vW; void main(){ vP = position.xy; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `varying vec2 vP; varying vec3 vW; uniform float time, gold, boil, glow;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
    float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.07 + 3.1; a *= .5; } return v; }
    void main(){ vec2 p = vP * .32; float r = length(vP); float a = atan(vP.y, vP.x);
      vec2 sw = vec2(cos(a + time * .12 + r * .2), sin(a + time * .12 + r * .2)) * r * .32;
      float n = fbm(sw * 1.6 + vec2(time * .05, -time * .04)); float n2 = fbm(sw * 4. - time * .1);
      vec3 deep = vec3(.01, .09, .03), mid = vec3(.06, .42, .11), hi = vec3(.42, .78, .22);
      vec3 col = mix(deep, mid, smoothstep(.3, .75, n)); col = mix(col, hi, smoothstep(.62, .9, n2) * .6);
      // bubbles: cells that swell and pop
      vec2 g = vP * 1.1; vec2 id = floor(g); vec2 f = fract(g) - .5; float h = hash(id); float ph = fract(time * (.25 + h * .35) * (.6 + boil) + h * 7.);
      float rad = .12 + .3 * h; float b = smoothstep(rad * ph, rad * ph - .05, length(f - (vec2(hash(id + 3.), hash(id + 9.)) - .5) * .4)) * step(.45, h) * (1. - ph);
      col += vec3(.45, .85, .35) * b * .7;
      col *= mix(.55, 1., smoothstep(3.2, 6.2, r)); // darker under the tray so the candies pop
      col = mix(col, col * vec3(1.6, 1.15, .25) + vec3(.35, .22, 0.), gold);
      float edge = smoothstep(${(RIM_R - .9).toFixed(2)}, ${(RIM_R - .25).toFixed(2)}, r); col *= 1. - edge * .55;
      gl_FragColor = vec4(col * (.75 + glow * .45), 1.); }` }); }
function skyMaterial() { return new THREE.ShaderMaterial({ uniforms: { time: { value: 0 } }, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `varying vec2 vUv; uniform float time; float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
    float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 1.7; a *= .5; } return v; }
    void main(){ vec2 m = vec2(.62, .66); float d = length((vUv - m) * vec2(1.2, 1.)); vec3 col = mix(vec3(.07, .08, .2), vec3(.015, .02, .06), vUv.y);
      col += vec3(.2, .24, .4) * exp(-d * 5.) ; float c = fbm(vUv * vec2(3., 2.) + vec2(time * .02, 0.)); col = mix(col, vec3(.05, .06, .12) + vec3(.3, .32, .45) * exp(-d * 4.) * c, smoothstep(.45, .75, c) * .85);
      vec2 sp = floor(vUv * 220.); col += step(.996, hash(sp)) * vec3(.7, .75, .9) * (.6 + .4 * sin(time * 2. + hash(sp.yx) * 6.)) * smoothstep(.2, .5, vUv.y);
      gl_FragColor = vec4(col, 1.); }` }); }
export function createWorld(renderer, seed = 14) {
  const W = { t: 0, flash: 0, gold: 0, boil: .3, glowPunch: 0, candles: [], jars: [], steam: [] };
  const scene = new THREE.Scene(); W.scene = scene; scene.background = new THREE.Color('#05040a'); scene.fog = new THREE.FogExp2('#0a0714', .018);
  const pm = new THREE.PMREMGenerator(renderer); const room = new RoomEnvironment(); W.env = pm.fromScene(room, .03).texture; scene.environment = W.env; scene.environmentIntensity = .55; room.dispose && room.dispose();
  W.soft = softTexture(); W.smokeTex = smokeTexture(7); W.flameTex = flameTexture();
  // lights
  W.hemi = new THREE.HemisphereLight('#5a4a9a', '#103a12', .55); scene.add(W.hemi);
  W.key = new THREE.SpotLight('#ffd6a8', 200, 60, .62, .55, 1.6); W.key.position.set(-6.5, 15, 9); W.key.target.position.set(0, 0, .3); scene.add(W.key, W.key.target);
  W.key.shadow.mapSize.set(1024, 1024); W.key.shadow.bias = -.0004; W.key.shadow.normalBias = .02; W.key.shadow.camera.near = 6; W.key.shadow.camera.far = 40;
  W.moonL = new THREE.DirectionalLight('#8aa6ff', 1.1); W.moonL.position.set(6, 9, -14); scene.add(W.moonL);
  W.potL = new THREE.PointLight('#5dff6a', 22, 14, 1.6); W.potL.position.set(0, -.2, -5.6); scene.add(W.potL);
  W.potL2 = new THREE.PointLight('#5dff6a', 14, 10, 1.6); W.potL2.position.set(0, -.2, 5.4); scene.add(W.potL2);
  W.fireL = new THREE.PointLight('#ff7a2a', 90, 22, 1.5); W.fireL.position.set(0, -6.2, 7.5); scene.add(W.fireL);
  W.rimL = new THREE.PointLight('#c070ff', 26, 26, 1.4); W.rimL.position.set(9, 6, -8); scene.add(W.rimL);
  // room
  const st = stoneTextures(seed); const stoneMat = new THREE.MeshStandardMaterial({ map: tex(st.map, true, [3, 2]), normalMap: tex(st.normal, false, [3, 2]), roughness: .9, color: '#8a80a0' });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(56, 30), stoneMat); back.position.set(0, 6, -17); scene.add(back);
  for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(44, 30), stoneMat); s.position.set(sx * 22, 6, 2); s.rotation.y = -sx * Math.PI / 2; scene.add(s); }
  const fl = flagTextures(seed + 1); const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 50), new THREE.MeshStandardMaterial({ map: tex(fl.map, true, [5, 4]), normalMap: tex(fl.normal, false, [5, 4]), roughness: .85, color: '#7a7088' }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -7; scene.add(floor);
  // arched window with the moon
  const win = new THREE.Group(); win.position.set(7.5, 8.2, -16.9); scene.add(win);
  const sh = new THREE.Shape(); sh.moveTo(-3, -4); sh.lineTo(3, -4); sh.lineTo(3, 1.5); sh.absarc(0, 1.5, 3, 0, Math.PI, false); sh.lineTo(-3, -4);
  W.sky = new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), skyMaterial()); { const uv = W.sky.geometry.attributes.uv, p = W.sky.geometry.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 3) / 6, (p.getY(i) + 4) / 8.5); } win.add(W.sky);
  W.moon = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), new THREE.MeshBasicMaterial({ map: tex(moonCanvas()), transparent: true, color: '#fff2da', fog: false })); W.moon.position.set(.75, 1.6, .02); win.add(W.moon);
  W.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.soft, color: '#8aa0ff', transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); W.halo.scale.setScalar(7); W.halo.position.set(.75, 1.6, .05); win.add(W.halo);
  const frameMat = new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: .8 });
  for (const x of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.14, 8.5, .2), frameMat); b.position.set(x * 1, -.25, .1); win.add(b); }
  for (const y of [-1.5, 1.2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(6, .14, .2), frameMat); b.position.set(0, y, .1); win.add(b); }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(3.1, .28, 8, 40, Math.PI), new THREE.MeshStandardMaterial({ map: stoneMat.map, color: '#5a5068', roughness: .9 })); arch.position.set(0, 1.5, .1); win.add(arch);
  for (const x of [-3.1, 3.1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.56, 5.6, .5), arch.material); p.position.set(x, -1.3, .1); win.add(p); }
  W.win = win;
  // shelves with glowing jars + candles
  const wood = new THREE.MeshStandardMaterial({ map: tex(woodTexture(seed + 3), true), roughness: .75, color: '#9a7a66' });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: .05, transmission: 0, transparent: true, opacity: .25, clearcoat: 1, depthWrite: false });
  const r = rnd(seed + 9); const jarCols = ['#5dff6a', '#b45cff', '#ff8a1f', '#ff2d4a', '#3ad8ff', '#ffd23a'];
  for (const [sx, sy, sw] of [[-9, 3.2, 9], [-9, 6.6, 9], [9.5, 1.4, 7]]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(sw, .25, 1.6), wood); pl.position.set(sx, sy, -16.1); scene.add(pl);
    let x = sx - sw / 2 + .6; while (x < sx + sw / 2 - .6) { const h = .7 + r() * 1.1, rad = .28 + r() * .3; const col = jarCols[Math.floor(r() * jarCols.length)];
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 16), glass); jar.position.set(x, sy + .125 + h / 2, -16 + (r() - .5) * .4);
      const liq = new THREE.Mesh(new THREE.CylinderGeometry(rad * .88, rad * .88, h * (.4 + r() * .45), 16), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.4, roughness: .3 }));
      liq.position.copy(jar.position); liq.position.y = sy + .125 + liq.geometry.parameters.height / 2 + .02; scene.add(liq, jar); W.jars.push({ m: liq.material, ph: r() * 6 });
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(rad * .7, rad * .8, .14, 12), wood); lid.position.set(x, sy + .125 + h + .07, jar.position.z); scene.add(lid);
      x += rad * 2 + .25 + r() * .5; if (r() < .25) { addCandle(W, scene, x, sy + .125, -15.8, r); x += .6; } } }
  for (const [x, y, z] of [[-13, -.6, -9], [12.5, -.4, -8], [-4.5, 9.9, -16]]) addCandle(W, scene, x, y, z, r, 1.6);
  for (const [x, z, h] of [[-13, -9, 6.4], [12.5, -8, 6.6]]) { const t = new THREE.Mesh(new THREE.BoxGeometry(3.2, h, 2.4), wood); t.position.set(x, -.6 - h / 2, z); scene.add(t); }
  // cauldron
  const iron = ironTextures(); const ironMat = new THREE.MeshStandardMaterial({ map: iron.map, roughnessMap: iron.rough, color: '#8a8290', metalness: .85, roughness: .55, envMapIntensity: .8 });
  const prof = [[.1, -7.2], [3.5, -7.1], [6.2, -6.2], [7.9, -4.6], [8.4, -3], [8.2, -1.7], [7.6, -.75], [RIM_R + .1, RIM_Y - .1], [RIM_R - .25, RIM_Y], [RIM_R - .5, -1.6]].map(([a, b]) => new THREE.Vector2(a, b));
  const pot = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), ironMat); scene.add(pot); W.pot = pot;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_R + .05, .34, 18, 120), ironMat); rim.rotation.x = Math.PI / 2; rim.position.y = RIM_Y; scene.add(rim);
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + .5; const leg = new THREE.Mesh(new THREE.CylinderGeometry(.5, .25, 2.4, 10), ironMat); leg.position.set(Math.cos(a) * 5.5, -7.6, Math.sin(a) * 5.5); scene.add(leg); }
  for (const sx of [-1, 1]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(.8, .16, 10, 28), ironMat); ring.position.set(sx * 8.3, -1.7, 0); ring.rotation.y = Math.PI / 2; scene.add(ring); }
  W.potion = new THREE.Mesh(new THREE.CircleGeometry(RIM_R - .15, 96), potionMaterial()); W.potion.rotation.x = -Math.PI / 2; W.potion.position.y = POTION_Y; scene.add(W.potion);
  // fire under the cauldron
  W.flames = []; const fm = new THREE.SpriteMaterial({ map: W.flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: '#ffb060' });
  for (let k = 0; k < 14; k++) { const s = new THREE.Sprite(fm); const a = (k / 14 - .5) * 2.4; s.position.set(Math.sin(a) * 6.5, -7.2, Math.cos(a) * 6.5 * .7 + 1); s.scale.set(2, 3.6, 1); scene.add(s); W.flames.push({ s, ph: k * 1.7, base: s.position.clone() }); }
  const logs = new THREE.MeshStandardMaterial({ color: '#2a160c', roughness: .9, emissive: '#ff4a00', emissiveIntensity: .25 });
  for (let k = 0; k < 7; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.35, .4, 5, 8), logs); const a = (k / 7 - .5) * 2.6; l.position.set(Math.sin(a) * 5.6, -7.3, Math.cos(a) * 5.6 * .8 + 1); l.rotation.set(Math.PI / 2, 0, a + 1.2); scene.add(l); }
  // steam puffs
  const sm = W.smokeTex; for (let k = 0; k < 30; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sm, color: '#a8ffb0', transparent: true, opacity: 0, depthWrite: false })); scene.add(s); W.steam.push({ s, t: Math.random() * 6, life: 5 + Math.random() * 3, x: 0, z: 0 }); }
  // the floating tray group (board lives here)
  W.tray = new THREE.Group(); scene.add(W.tray);
  return W;
}
function addCandle(W, scene, x, y, z, r, s = 1) { const h = (.5 + r() * .7) * s; const wax = new THREE.Mesh(new THREE.CylinderGeometry(.12 * s, .14 * s, h, 12), new THREE.MeshStandardMaterial({ color: '#efe2c8', roughness: .6, emissive: '#3a2008', emissiveIntensity: .4 }));
  wax.position.set(x, y + h / 2, z); scene.add(wax); const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: '#ffc070' })); f.scale.set(.28 * s, .55 * s, 1); f.position.set(x, y + h + .22 * s, z); scene.add(f);
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.soft, color: '#ff9a40', transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false })); gl.scale.setScalar(1.6 * s); gl.position.copy(f.position); scene.add(gl);
  let L = null; if (s > 1) { L = new THREE.PointLight('#ffa050', 9, 9, 1.6); L.position.copy(f.position); scene.add(L); } W.candles.push({ f, gl, L, ph: r() * 6, s }); }
export function gradeShader() { return { uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: .34 }, grain: { value: .03 }, lift: { value: new THREE.Vector3(.01, .0, .02) }, sat: { value: 1.1 }, flash: { value: 0 }, gold: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float time, vig, grain, sat, flash, gold; uniform vec3 lift;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 x = c.rgb; float l = dot(x, vec3(.299, .587, .114));
      x = mix(vec3(l), x, sat); x += lift * (1. - l); x = mix(x, x * vec3(1.04, .99, .95), smoothstep(.35, .9, l));
      x = mix(x, x * vec3(1.08, 1.0, .82) + vec3(.03, .02, 0.), gold);
      vec2 q = vUv - .5; float v = 1. - vig * smoothstep(.2, .85, dot(q, q) * 2.2); x *= v; x += flash * vec3(.16, .2, .08) * (1. - l);
      x += (hash(vUv * 900. + fract(time * 7.)) - .5) * grain * (1. - l * .6); gl_FragColor = vec4(x, c.a); }` }; }
export function updateWorld(W, t, dt, q) {
  W.t = t; W.flash = Math.max(0, fin(W.flash) - dt * 1.8); W.glowPunch = Math.max(0, fin(W.glowPunch) - dt * 1.5); W.gold = Math.min(1, Math.max(0, fin(W.gold))); W.boil = Math.min(1.5, Math.max(0, fin(W.boil, .3)));
  const u = W.potion.material.uniforms; u.time.value = t; u.gold.value = W.gold; u.boil.value = W.boil; u.glow.value = 1 + W.glowPunch;
  W.sky.material.uniforms.time.value = t;
  const gp = 1 + W.glowPunch * 1.5 + W.boil * .3; W.potL.intensity = 22 * gp * (.92 + .08 * Math.sin(t * 3.1)); W.potL2.intensity = 14 * gp * (.92 + .08 * Math.sin(t * 2.3 + 1));
  const gc = new THREE.Color('#5dff6a').lerp(new THREE.Color('#ffc23a'), W.gold); W.potL.color.copy(gc); W.potL2.color.copy(gc);
  W.fireL.intensity = 90 * (.85 + .1 * Math.sin(t * 11) + .06 * Math.sin(t * 27));
  for (const f of W.flames) { const k = .8 + .25 * Math.sin(t * 9 + f.ph) * Math.sin(t * 5.3 + f.ph * 2); f.s.scale.set(2 * k, 3.6 * (.8 + .4 * k), 1); f.s.position.y = f.base.y + .4 * k; }
  for (const c of W.candles) { const k = .85 + .1 * Math.sin(t * 13 + c.ph) + .06 * Math.sin(t * 31 + c.ph); c.f.scale.set(.28 * c.s * k, .55 * c.s * (.8 + .3 * k), 1); c.gl.material.opacity = .3 * k; if (c.L) c.L.intensity = 9 * k; }
  for (const j of W.jars) j.m.emissiveIntensity = 1.2 + .3 * Math.sin(t * 1.3 + j.ph);
  const N = q ? q.steam : 18; W.steam.forEach((p, i) => { if (i >= N) { p.s.visible = false; return; } p.s.visible = true; p.t += dt; if (p.t > p.life) { p.t = 0; const a = Math.random() * 6.283, rr = 3 + Math.random() * 3.6; p.x = Math.cos(a) * rr; p.z = Math.sin(a) * rr * .9; }
    const k = p.t / p.life; p.s.position.set(p.x + Math.sin(t * .3 + i) * k * .8, POTION_Y + k * (4.5 + W.boil * 3), p.z); p.s.scale.setScalar(1.6 + k * 3.4); p.s.material.opacity = Math.sin(Math.PI * k) * (.11 + W.boil * .05); p.s.material.rotation = i + t * .05;
    p.s.material.color.set(W.gold > .3 ? '#ffe0a0' : '#a8ffb0'); });
}
