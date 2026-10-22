// Glossy, physically lit 3D candies (no image files, canvas textures only): orange wrapped bonbon, candy corn, gummy eyeball,
// purple swirl lollipop, chocolate skull, red jelly bat; specials (striped, wrapped bomb, ghost candy); pumpkin blockers,
// cobwebs, slime tiles and golden skulls. Templates are built once and cloned (shared geometry and materials).
import * as THREE from 'three';
import { cv, tex, rnd, noise2 } from './tex.js';
export const KIND_COL = ['#ff8a1f', '#ffd23a', '#5dff6a', '#b45cff', '#8a4a26', '#ff2d4a', '#f4f0ff'];
const phys = o => new THREE.MeshPhysicalMaterial({ roughness: .22, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: 1.1, ...o });
function swirlTex(a, b, n = 6, spiral = 0) { const S = 256, [c, g] = cv(S, S); g.fillStyle = a; g.fillRect(0, 0, S, S); g.fillStyle = b;
  if (spiral) { g.translate(S / 2, S / 2); for (let k = 0; k < n; k++) { g.beginPath(); for (let t = 0; t <= 1.001; t += .01) { const r = t * S * .52, an = t * 7 + k / n * Math.PI * 2; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
      for (let t = 1; t >= 0; t -= .01) { const r = t * S * .52, an = t * 7 + (k + .45) / n * Math.PI * 2; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); } g.fill(); } }
  else for (let k = 0; k < n; k++) { g.save(); g.translate(k * S / n, 0); g.transform(1, 0, -.6, 1, 0, 0); g.fillRect(0, 0, S / n * .42, S * 1.2); g.restore(); }
  return tex(c); }
function eyeTex() { const S = 256, [c, g] = cv(S * 2, S), r = rnd(9); g.fillStyle = '#e6d9c2'; g.fillRect(0, 0, S * 2, S);
  g.strokeStyle = 'rgba(200,30,40,.55)'; g.lineWidth = 1.6; for (let k = 0; k < 26; k++) { let x = S * .5 + (r() - .5) * S * .2 + (r() < .5 ? S : 0) * 0, y = S * .5; x = r() * S * 2; y = r() < .5 ? S * .05 : S * .95; g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 6; q++) { x += (r() - .5) * 26; y += (S * .5 - y) * .16 + (r() - .5) * 8; g.lineTo(x, y); } g.stroke(); }
  // iris sits at u=.75 (-z in three's SphereGeometry); the mesh is turned by PI so it looks out of the board
  const cx = S * 1.5, cy = S * .5; let gr = g.createRadialGradient(cx, cy, 4, cx, cy, S * .36); gr.addColorStop(0, '#f0ff7a'); gr.addColorStop(.45, '#ff7a1a'); gr.addColorStop(.85, '#a01a08'); gr.addColorStop(1, '#2a0602');
  g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, S * .36 * .5, S * .36, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#050505'; g.beginPath(); g.ellipse(cx, cy, S * .045, S * .2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(cx - 12, cy - 30, 7, 13, 0, 0, Math.PI * 2); g.fill(); return tex(c); }
function webTex() { const S = 512, [c, g] = cv(S, S); g.clearRect(0, 0, S, S); g.translate(S / 2, S / 2); g.strokeStyle = 'rgba(240,240,255,.95)'; g.lineWidth = 3; const N = 12, r0 = S * .48;
  for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r0, Math.sin(a) * r0); g.stroke(); }
  g.lineWidth = 2.2; for (let ring = 1; ring < 8; ring++) { const rr = r0 * ring / 8; g.beginPath(); for (let k = 0; k <= N; k++) { const a = k / N * Math.PI * 2, a2 = (k + .5) / N * Math.PI * 2;
      if (k === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.quadraticCurveTo(Math.cos(a2 - Math.PI / N) * rr * .86, Math.sin(a2 - Math.PI / N) * rr * .86, Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); }
  return tex(c); }
function jackTex() { const S = 256, [c, g] = cv(S * 2, S); g.fillStyle = '#000'; g.fillRect(0, 0, S * 2, S); g.fillStyle = '#fff'; const cx = S * 1.5, cy = S * .52;
  const tri = (x, y, s) => { g.beginPath(); g.moveTo(x - s * .3, y + s * .5); g.lineTo(x + s * .3, y + s * .5); g.lineTo(x, y - s * .4); g.fill(); };
  tri(cx - 34, cy - 30, 56); tri(cx + 34, cy - 30, 56); g.beginPath(); g.moveTo(cx - 70, cy + 18); for (let k = 0; k <= 8; k++) g.lineTo(cx - 70 + k * 17.5, cy + 18 + (k % 2 ? 16 : 0)); g.lineTo(cx + 64, cy + 30);
  g.quadraticCurveTo(cx, cy + 80, cx - 64, cy + 30); g.fill(); return tex(c); }
function slimeTex() { const S = 256, [c, g] = cv(S, S), r = rnd(4), n = noise2(12); const im = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = n(x / 22, y / 22), i = (y * S + x) * 4; im.data[i] = 40 + v * 90; im.data[i + 1] = 200 + v * 55; im.data[i + 2] = 60 + v * 40; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); for (let k = 0; k < 26; k++) { const x = r() * S, y = r() * S, s = 4 + r() * 14; g.strokeStyle = 'rgba(230,255,200,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(x - s * .3, y - s * .3, s * .22, 0, Math.PI * 2); g.fill(); }
  return tex(c); }
function tileTex() { const S = 128, [c, g] = cv(S, S), n = noise2(31); const im = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = n(x / 14, y / 14), i = (y * S + x) * 4, e = Math.min(x, y, S - 1 - x, S - 1 - y) / S; const rim = e < .06 ? 1.5 : 1;
    im.data[i] = (36 + v * 26) * rim; im.data[i + 1] = (20 + v * 16) * rim; im.data[i + 2] = (58 + v * 30) * rim; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); return tex(c); }
// rounded, ruffled wrapper twist
function wrapperGeo() { const g = new THREE.ConeGeometry(.2, .26, 14, 3, true); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + Math.sin(a * 7) * .16 * (.5 - y / .26) + Math.sin(a * 3 + y * 20) * .04; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); return g; }
function cornGeo() { const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; const y = -.3 + t * .66; const r = (t < .12 ? Math.sin(t / .12 * Math.PI / 2) : 1) * .3 * Math.pow(1 - t, .85) + .012; pts.push(new THREE.Vector2(r, y)); }
  const g = new THREE.LatheGeometry(pts, 28); const p = g.attributes.position, col = new Float32Array(p.count * 3); const C = [new THREE.Color('#ffc21a'), new THREE.Color('#ff7a0e'), new THREE.Color('#fff8ea')];
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); const c = y < -.07 ? C[0] : y < .14 ? C[1] : C[2]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; p.setZ(i, p.getZ(i) * .72); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g; }
function lolliGeo() { const pts = [new THREE.Vector2(0, -.075)]; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI; pts.push(new THREE.Vector2(.31 + Math.cos(a) * .075, Math.sin(a) * .075)); } pts.push(new THREE.Vector2(0, .075));
  const g = new THREE.LatheGeometry(pts, 40); const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / .78 + .5, p.getZ(i) / .78 + .5); return g; }
function batShape() { const s = new THREE.Shape(); s.moveTo(0, .12); s.quadraticCurveTo(.06, .2, .09, .14); s.quadraticCurveTo(.2, .2, .42, .2); s.quadraticCurveTo(.36, .1, .4, -.02);
  s.quadraticCurveTo(.3, 0, .26, -.1); s.quadraticCurveTo(.18, -.04, .12, -.16); s.quadraticCurveTo(.05, -.1, 0, -.2);
  s.quadraticCurveTo(-.05, -.1, -.12, -.16); s.quadraticCurveTo(-.18, -.04, -.26, -.1); s.quadraticCurveTo(-.3, 0, -.4, -.02); s.quadraticCurveTo(-.36, .1, -.42, .2); s.quadraticCurveTo(-.2, .2, -.09, .14); s.quadraticCurveTo(-.06, .2, 0, .12); return s; }
function skullGroup(mat, eyeMat) { const g = new THREE.Group(); const cr = new THREE.Mesh(new THREE.SphereGeometry(.29, 32, 24), mat); cr.scale.set(1, .92, .95); cr.position.y = .04; g.add(cr);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(.2, 24, 16), mat); jaw.scale.set(.95, .62, .8); jaw.position.set(0, -.16, .08); g.add(jaw);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.078, 16, 12), eyeMat); e.scale.set(1, 1.1, .55); e.position.set(sx * .105, .0, .245); g.add(e); }
  const no = new THREE.Mesh(new THREE.ConeGeometry(.035, .07, 3), eyeMat); no.position.set(0, -.1, .262); no.rotation.x = Math.PI; g.add(no);
  for (let k = -2; k <= 2; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(.03, .05, .02), eyeMat); t.position.set(k * .042, -.2, .225); g.add(t); } return g; }
export function createCandyKit(envTex) {
  const K = { mats: {}, geo: {} };
  const M = K.mats;
  M.bonbon = phys({ color: '#ff8414', map: swirlTex('#ff7a00', '#ffc070', 7), roughness: .16, sheen: .3, sheenColor: new THREE.Color('#ffd0a0') });
  M.wrap = phys({ color: '#ffb347', roughness: .3, transparent: true, opacity: .82, side: THREE.DoubleSide, metalness: .25, iridescence: .6 });
  M.corn = phys({ vertexColors: true, roughness: .34, clearcoat: .7 });
  M.eye = phys({ map: eyeTex(), roughness: .32, clearcoatRoughness: .16, envMapIntensity: .6 }); M.gummy = phys({ color: '#3dff58', roughness: .2, clearcoatRoughness: .16, transparent: true, opacity: .16, transmission: 0, emissive: '#0a5a12', emissiveIntensity: .25, depthWrite: false });
  M.lolli = phys({ map: swirlTex('#7a2cff', '#f2e6ff', 5, 1), roughness: .2 }); M.stick = phys({ color: '#f3efe6', roughness: .5, clearcoat: .2 });
  M.choc = phys({ color: '#5a2d14', roughness: .38, clearcoat: .55, clearcoatRoughness: .2, sheen: .4, sheenColor: new THREE.Color('#a0603a') }); M.chocDark = new THREE.MeshStandardMaterial({ color: '#1a0904', roughness: .7 });
  M.bat = phys({ color: '#ff1838', roughness: .12, transparent: true, opacity: .93, emissive: '#600010', emissiveIntensity: .55, sheen: .6, sheenColor: new THREE.Color('#ff8090') }); M.batEye = new THREE.MeshStandardMaterial({ color: '#ffe23a', emissive: '#ffb000', emissiveIntensity: 1.6 });
  M.ghost = phys({ color: '#f6f2ff', roughness: .08, iridescence: 1, iridescenceIOR: 1.6, sheen: 1, sheenColor: new THREE.Color('#c8b0ff'), emissive: '#5a40a0', emissiveIntensity: .35 }); M.ghostEye = new THREE.MeshStandardMaterial({ color: '#0a0612', roughness: .3 });
  M.stripe = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: .75, roughness: .2 });
  M.bombWrap = phys({ color: '#ffffff', roughness: .1, transparent: true, opacity: .38, iridescence: 1, depthWrite: false, side: THREE.DoubleSide, emissive: '#ffd27a', emissiveIntensity: .25 });
  M.pump = phys({ color: '#ff7410', roughness: .42, clearcoat: .45, clearcoatRoughness: .3 }); M.stem = new THREE.MeshStandardMaterial({ color: '#3d4a18', roughness: .8 });
  M.jack = new THREE.MeshBasicMaterial({ map: jackTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: '#ffb23a' });
  M.web = new THREE.MeshStandardMaterial({ map: webTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: .4, emissive: '#c8c8ff', emissiveIntensity: .35, alphaTest: .05 });
  M.slime = new THREE.MeshStandardMaterial({ map: slimeTex(), emissive: '#2cff4a', emissiveIntensity: .55, roughness: .15, transparent: true, opacity: .92 });
  M.gold = new THREE.MeshPhysicalMaterial({ color: '#ffcf4a', metalness: 1, roughness: .18, clearcoat: .6, envMapIntensity: 1.6, emissive: '#5a3800', emissiveIntensity: .3 }); M.goldDark = new THREE.MeshStandardMaterial({ color: '#201000', roughness: .6 });
  M.tile = new THREE.MeshPhysicalMaterial({ map: tileTex(), roughness: .2, clearcoat: 1, clearcoatRoughness: .05, color: '#ffffff' }); M.tile2 = M.tile.clone(); M.tile2.color = new THREE.Color('#c8b8e8');
  M.licorice = new THREE.MeshPhysicalMaterial({ color: '#07050a', roughness: .3, clearcoat: 1, clearcoatRoughness: .1, sheen: .5, sheenColor: new THREE.Color('#5a2a7a') });
  for (const k in M) if (M[k].isMeshStandardMaterial) M[k].envMap = envTex;
  const G = K.geo; G.bonbon = new THREE.SphereGeometry(.27, 36, 24); G.wrap = wrapperGeo(); G.corn = cornGeo(); G.eye = new THREE.SphereGeometry(.3, 36, 24); G.gummy = new THREE.SphereGeometry(.345, 32, 20);
  G.lolli = lolliGeo(); G.stick = new THREE.CylinderGeometry(.03, .03, .42, 10); G.bat = new THREE.ExtrudeGeometry(batShape(), { depth: .1, bevelEnabled: true, bevelThickness: .05, bevelSize: .04, bevelSegments: 4, curveSegments: 10 }); G.bat.translate(0, 0, -.05);
  G.ring = new THREE.TorusGeometry(.33, .028, 10, 40);
  { const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; const y = -.3 + t * .62; const r = t > .55 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - .55) / .45, 2))) * .27 : .27 + (.55 - t) * .06; pts.push(new THREE.Vector2(Math.max(.001, r), y)); }
    G.ghost = new THREE.LatheGeometry(pts, 36); const p = G.ghost.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < -.2) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, y + Math.sin(a * 6) * .04); } } G.ghost.computeVertexNormals(); }
  { const g = new THREE.SphereGeometry(.36, 40, 28); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x); const k = 1 - .07 * Math.pow(Math.abs(Math.cos(a * 4)), .6); p.setXYZ(i, x * k, y * .78, z * k); } g.computeVertexNormals(); G.pump = g; }
  G.tile = new THREE.BoxGeometry(.94, .08, .94); G.base = new THREE.BoxGeometry(1.06, .3, 1.06); G.slime = new THREE.BoxGeometry(.9, .05, .9); G.web = new THREE.PlaneGeometry(1.02, 1.02, 6, 6);
  { const p = G.web.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -(1 - x * x * 3.6) * (1 - y * y * 3.6) * .05); } G.web.computeVertexNormals(); }
  return K;
}
// one candy as a Group: body (spun gently), optional special overlay
export function makeCandy(K, k, sp = '') { const M = K.mats, G = K.geo; const root = new THREE.Group(); const body = new THREE.Group(); root.add(body); root.userData = { body, k, sp };
  const add = (geo, mat, f) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; if (f) f(m); body.add(m); return m; };
  if (sp === 'g' || k === 6) { add(G.ghost, M.ghost, m => m.position.y = .02); for (const sx of [-1, 1]) add(G.eye, M.ghostEye, m => { m.scale.set(.15, .22, .1); m.position.set(sx * .09, .12, .23); });
    add(G.eye, M.ghostEye, m => { m.scale.set(.1, .12, .08); m.position.set(0, -.02, .25); }); root.userData.ghost = true; return root; }
  if (k === 0) { add(G.bonbon, M.bonbon, m => m.scale.set(1.15, .9, .9)); for (const sx of [-1, 1]) add(G.wrap, M.wrap, m => { m.rotation.z = sx * Math.PI / 2; m.position.x = sx * .4; }); }
  else if (k === 1) { add(G.corn, M.corn, m => { m.rotation.x = -.25; m.scale.setScalar(1.05); }); }
  else if (k === 2) { add(G.eye, M.eye, m => { m.rotation.y = Math.PI; m.rotation.x = -.55; root.userData.eye = m; }); add(G.gummy, M.gummy); }
  else if (k === 3) { add(G.lolli, M.lolli, m => { m.rotation.x = Math.PI / 2; m.position.y = .05; }); add(G.stick, M.stick, m => { m.position.set(0, -.26, -.02); }); body.rotation.x = -.15; }
  else if (k === 4) { body.add(skullGroup(M.choc, M.chocDark)); body.children[0].traverse(o => { if (o.isMesh) o.castShadow = true; }); }
  else if (k === 5) { add(G.bat, M.bat, m => m.scale.setScalar(1.05)); for (const sx of [-1, 1]) add(G.eye, M.batEye, m => { m.scale.setScalar(.1); m.position.set(sx * .05, .07, .1); }); }
  if (sp === 'h' || sp === 'v') { const st = new THREE.Group(); for (let q = -1; q <= 1; q++) { const r = new THREE.Mesh(G.ring, M.stripe); r.position.x = q * .17; r.rotation.y = Math.PI / 2; r.scale.setScalar(1 - Math.abs(q) * .12); st.add(r); }
    if (sp === 'v') st.rotation.y = Math.PI / 2; root.add(st); root.userData.stripe = st; }
  if (sp === 'b' || sp === 'b2') { const w = new THREE.Mesh(G.gummy, M.bombWrap); w.scale.setScalar(1.28); root.add(w); for (const sx of [-1, 1]) { const t = new THREE.Mesh(G.wrap, M.bombWrap); t.rotation.z = sx * Math.PI / 2; t.position.x = sx * .5; t.scale.setScalar(1.2); root.add(t); } root.userData.bomb = w; }
  return root; }
export function makePumpkin(K) { const M = K.mats, G = K.geo; const g = new THREE.Group(); const b = new THREE.Mesh(G.pump, M.pump); b.castShadow = true; g.add(b);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(.035, .06, .2, 8), M.stem); st.position.set(.02, .32, 0); st.rotation.z = -.3; g.add(st);
  const face = new THREE.Mesh(new THREE.SphereGeometry(.372, 32, 20, 0, Math.PI * 2, .3, 2.2), M.jack); face.scale.set(1, .78, 1); face.rotation.y = -Math.PI / 2; face.visible = false; g.add(face); g.userData = { face, body: b }; return g; }
export function makeGoldSkull(K) { const g = new THREE.Group(); const s = skullGroup(K.mats.gold, K.mats.goldDark); s.scale.setScalar(1.1); s.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(s); g.userData = { body: s }; return g; }
