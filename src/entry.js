import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { createWorld, updateWorld, gradeShader, QUALITY, POTION_Y } from './world.js';
import { createCandyKit, makeCandy, makePumpkin, makeGoldSkull, KIND_COL } from './candy.js';
import { createGhoul, updateGhoul, mouthWorld, createFountain, spray, updateFountain, fountainCount, GHOUL_Z } from './ghoul.js';
import * as BD from './board.js';
import { LEVELS, DUEL, INTRO } from './levels.js';
import { createFX, sparks, puff, updateFX } from './fx.js';
import { Player } from './music.js';
import * as A from './audio.js';
import { T, KIND_NAMES } from './i18n.js';

const CREDIT_TXT = 'Built with Grok Bot · 6 days to Halloween 🎃';
const $ = id => document.getElementById(id);
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
let fxSeed = (window.__cmSeed || (Date.now() & 0xffffff)) >>> 0;
function rng() { fxSeed = (fxSeed + 0x6D2B79F5) >>> 0; let t = fxSeed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x), fin = (v, d = 0) => Number.isFinite(v) ? v : d;
const eo = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3), eio = k => { k = clamp(k, 0, 1); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }, back = k => { k = clamp(k, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
// ---------------- rules ----------------
const DIFF = { easy: { moves: 5, colors: 5, hint: 4, boost: [2, 2, 2], cap: 110, duel: 12 }, medium: { moves: 0, colors: 0, hint: 6, boost: [1, 1, 1], cap: 130, duel: 10 },
  hard: { moves: -3, colors: 6, hint: 10, boost: [1, 0, 1], cap: 150, duel: 8 }, kids: { moves: Infinity, colors: 5, hint: 3, boost: [9, 9, 9], cap: 90, duel: 12 } };
function autoLang() { try { const l = (navigator.languages && navigator.languages[0]) || navigator.language || ''; return /^de\b|^de-/i.test(l) || l.toLowerCase() === 'de' ? 'de' : 'en'; } catch (e) { return 'en'; } }
const S = { state: 'intro', mode: 'level', lang: ls.get('cm-lang', '') || autoLang(), diff: ls.get('cm-diff', 'medium'), kids: ls.get('cm-kids', '0') === '1', q: ls.get('cm-q', ''), qUser: !!ls.get('cm-q', ''),
  name: ls.get('cm-name', 'Player') || 'Player', gt: 0, ts: 1, li: 0, score: [0, 0], used: [0, 0], player: 0, meter: 0, phase: 'idle', cascade: 0, bestC: [0, 0], erupts: [0, 0], specials: [0, 0], fusions: [0, 0],
  boosts: [0, 0, 0], boostMode: null, sel: null, cur: [3, 4], kb: false, idleT: 0, hintMv: null, fovPunch: 0, camE: 0, eruptT: -1, introT: 0, goldBonus: false, lastMover: 0, endT: 0, result: null, boilWarned: false, stars: 0 };
if (!DIFF[S.diff] || S.diff === 'kids') S.diff = 'medium';
if (!QUALITY[S.q]) { S.q = 'mid'; S.qUser = false; }
const dkey = () => S.kids ? 'kids' : S.diff, D = () => DIFF[dkey()];
A.setClock(() => S.gt);
const t = k => T[S.lang][k] ?? T.en[k] ?? k;
const progKey = () => `cm-prog-${dkey()}`;
function prog() { let p = null; try { p = JSON.parse(ls.get(progKey(), 'null')); } catch (e) {} if (!p || !Array.isArray(p.st)) p = { u: 0, st: [], b: [] }; if (S.kids) p.u = LEVELS.length - 1; return p; }
function saveProg(p) { ls.set(progKey(), JSON.stringify(p)); }

// ---------------- renderer / scene / post ----------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__cmPDB });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08; renderer.shadowMap.type = THREE.PCFShadowMap;
const W = createWorld(renderer, 14); const scene = W.scene;
const camera = new THREE.PerspectiveCamera(42, 1, .1, 200);
const F = createFX(scene, W.soft, W.smokeTex); F.floor = POTION_Y + .05;
const K = createCandyKit(W.env); K.make = (k, sp) => makeCandy(K, k, sp);
const G = createGhoul(scene, K); const FT = createFountain(scene, K, 60);
let composer, bloom, gradePass;
function buildComposer() { if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); }
  const q = QUALITY[S.q]; const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: q.msaa || 0 });
  composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .5, .45, 2.2); { const hp = bloom.materialHighPassFilter; hp.fragmentShader = hp.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );', 'vec4 texel = min( texture2D( tDiffuse, vUv ), vec4( 2.7 ) );'); hp.needsUpdate = true; } // clamp specular spikes so one glint can't flood the board
  composer.addPass(bloom); composer.addPass(new OutputPass()); gradePass = new ShaderPass(gradeShader()); composer.addPass(gradePass); }
function applyQuality(qn, user) {
  S.q = qn; if (user) { S.qUser = true; ls.set('cm-q', qn); } const q = QUALITY[qn];
  renderer.shadowMap.enabled = q.shadows; W.key.castShadow = q.shadows; if (q.shadows) { W.key.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (W.key.shadow.map) { W.key.shadow.map.dispose(); W.key.shadow.map = null; } }
  scene.traverse(o => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(x => x.needsUpdate = true); } });
  buildComposer(); resize(); qLabels(); }
function qLabels() { if ($('btnQ')) $('btnQ').textContent = '⚙ ' + t('q_' + S.q); if ($('btnQ2')) { $('btnQ2').textContent = `⚙ ${t('q_' + S.q)}${S.qUser ? '' : ' · ' + t('qAuto')}`; $('btnQ2').title = t('qL'); } }
let VW = 1, VH = 1;
function resize() { VW = window.innerWidth; VH = window.innerHeight; const dpr = Math.min(window.devicePixelRatio || 1, QUALITY[S.q].dpr);
  renderer.setPixelRatio(dpr); renderer.setSize(VW, VH, false); if (composer) { composer.setPixelRatio(dpr); composer.setSize(VW, VH); } camera.aspect = VW / VH; camera.updateProjectionMatrix(); fitDirty = true; }

// ---------------- board visuals ----------------
let B = null, LV = LEVELS[0];
const CELL = 1, CANDY_Y = .44, TILT = -.72;
const pieces = new Map(); // id → piece
const slimeM = new Map(), webM = new Map();
let trayMeshes = [];
const cx = x => (x - (B.w - 1) / 2) * CELL, cz = y => (y - (B.h - 1) / 2) * CELL;
const cellWorld = (i, y = CANDY_Y, out = new THREE.Vector3()) => out.set(cx(BD.X(B, i)), y, cz(BD.Y(B, i)));
function clearTray() { for (const m of trayMeshes) { W.tray.remove(m); if (m.isInstancedMesh) m.dispose(); } trayMeshes = []; for (const P of pieces.values()) W.tray.remove(P.g); pieces.clear();
  for (const m of slimeM.values()) W.tray.remove(m); slimeM.clear(); for (const w of webM.values()) W.tray.remove(w.m); webM.clear(); webM.clear(); }
function buildTray() { clearTray(); const n = B.n - B.hole.reduce((a, v) => a + v, 0);
  const base = new THREE.InstancedMesh(K.geo.base, K.mats.licorice, n), tA = new THREE.InstancedMesh(K.geo.tile, K.mats.tile, n), tB = new THREE.InstancedMesh(K.geo.tile, K.mats.tile2, n);
  let a = 0, ia = 0, ib = 0; const m = new THREE.Matrix4();
  for (let i = 0; i < B.n; i++) { if (B.hole[i]) continue; const x = cx(BD.X(B, i)), z = cz(BD.Y(B, i)); m.makeTranslation(x, -.15, z); base.setMatrixAt(a++, m); m.makeTranslation(x, .01, z); if ((BD.X(B, i) + BD.Y(B, i)) % 2) tB.setMatrixAt(ib++, m); else tA.setMatrixAt(ia++, m); }
  base.count = a; tA.count = ia; tB.count = ib; base.receiveShadow = tA.receiveShadow = tB.receiveShadow = true; base.castShadow = true;
  for (const M of [base, tA, tB]) { M.instanceMatrix.needsUpdate = true; W.tray.add(M); trayMeshes.push(M); }
  for (let i = 0; i < B.n; i++) { if (B.hole[i]) continue; if (B.slime[i]) setSlime(i, B.slime[i], true); const c = B.cells[i]; if (c) addPiece(c, i); } }
function setSlime(i, v, init) { let m = slimeM.get(i); if (!v) { if (m) { W.tray.remove(m); slimeM.delete(i); const p = cellWorld(i, .1); sparks(F, p, Math.round(26 * QUALITY[S.q].parts), { colors: ['#5dff6a', '#c8ffb0'], speed: 2.2, up: 2, life: .7, grav: 5, size: .06 }); } return; }
  if (!m) { m = new THREE.Mesh(K.geo.slime, K.mats.slime); m.receiveShadow = true; W.tray.add(m); slimeM.set(i, m); } m.position.copy(cellWorld(i, .07)); m.scale.set(1, v === 2 ? 2.4 : 1, 1); m.userData.v = v; m.material = v === 2 ? (K.mats.slime2 || (K.mats.slime2 = Object.assign(K.mats.slime.clone(), { emissiveIntensity: 1.1 }))) : K.mats.slime; }
function modelFor(c) { if (c.t === 'p') { const g = makePumpkin(K); if (c.hp === 1) g.userData.face.visible = true; return g; } if (c.t === 'i') return makeGoldSkull(K); return K.make(c.k, c.sp); }
function addPiece(c, i, from) { const g = modelFor(c); const P = { id: c.id, c, g, x: BD.X(B, i), z: BD.Y(B, i), y: 0, vz: 0, vy: 0, tx: BD.X(B, i), tz: BD.Y(B, i), st: 'idle', t: 0, sq: 0, pop: 0, s: 1, ph: rng() * 6, glow: 0, wig: 0 };
  if (from) Object.assign(P, from); g.rotation.x = c.t === 'p' ? -.35 : TILT; W.tray.add(g); pieces.set(c.id, P); if (c.lock) addWeb(i); placePiece(P); return P; }
function rebuildPiece(P) { const pos = P.g.position.clone(); W.tray.remove(P.g); P.g = modelFor(P.c); P.g.rotation.x = P.c.t === 'p' ? -.35 : TILT; P.g.position.copy(pos); W.tray.add(P.g); }
function addWeb(i) { if (webM.has(i)) return; const m = new THREE.Mesh(K.geo.web, K.mats.web); m.rotation.x = -Math.PI / 2 + .35; m.position.copy(cellWorld(i, CANDY_Y + .2)); m.rotation.z = rng() * 6; W.tray.add(m); webM.set(i, { m, t: -1 }); }
function tearWeb(i) { const w = webM.get(i); if (!w || w.t >= 0) return; w.t = 0; A.sfx.web(pan(BD.X(B, i))); sparks(F, cellWorld(i, CANDY_Y + .2), Math.round(18 * QUALITY[S.q].parts), { colors: ['#e8e8ff', '#ffffff'], speed: 1.6, up: 1.5, life: .8, grav: 2, size: .05 }); }
function placePiece(P) { const g = P.g; g.position.set(cx(P.x), CANDY_Y + P.y, cz(P.z)); }
const pan = x => clamp((x - (B ? (B.w - 1) / 2 : 3.5)) / 5, -.7, .7);
// ---------------- effects ----------------
const fxs = [];
const addMat = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const beamGeo = new THREE.BoxGeometry(1, .09, .16), ringGeo = new THREE.RingGeometry(.82, 1, 64), glowPlane = new THREE.PlaneGeometry(1, 1);
function beam(i, dir, col = '#ffffff') { const m = new THREE.Mesh(beamGeo, addMat(col, .95)); const p = cellWorld(i, CANDY_Y); m.position.copy(p); if (dir === 'v') m.rotation.y = Math.PI / 2; W.tray.add(m);
  const g = new THREE.Mesh(glowPlane, new THREE.MeshBasicMaterial({ map: W.soft, color: col, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false })); g.rotation.x = -Math.PI / 2; g.position.copy(p).setY(.15); if (dir === 'v') g.rotation.z = Math.PI / 2; W.tray.add(g);
  fxs.push({ kind: 'beam', m, g, t: 0, d: .42, len: (dir === 'v' ? B.h : B.w) * 2.05 }); }
function ring(at, col, big = 1, d = .7) { const m = new THREE.Mesh(ringGeo, addMat(col, .85)); m.rotation.x = -Math.PI / 2; m.position.copy(at).setY(.2); m.scale.setScalar(.3); W.tray.add(m); fxs.push({ kind: 'ring', m, t: 0, d, big }); }
function bolt(a, b, col = '#e0c8ff') { const N = 10, pos = new Float32Array(N * 3); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const m = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  W.tray.add(m); fxs.push({ kind: 'bolt', m, t: 0, d: .5, a: a.clone(), b: b.clone() }); }
function updateFxs(dt) { for (let i = fxs.length - 1; i >= 0; i--) { const f = fxs[i]; f.t += dt; const k = f.t / f.d;
    if (f.kind === 'beam') { f.m.scale.x = Math.min(1, k * 3) * f.len; f.m.material.opacity = .9 * (1 - smooth(k)); f.m.scale.y = f.m.scale.z = 1 + k * .7; f.g.scale.set(f.len * Math.min(1, k * 3), .95, 1); f.g.material.opacity = .42 * (1 - k); }
    else if (f.kind === 'ring') { f.m.scale.setScalar(.3 + eo(k) * 3.2 * f.big); f.m.material.opacity = .85 * (1 - k); }
    else if (f.kind === 'bolt') { const p = f.m.geometry.attributes.position; for (let q = 0; q < 10; q++) { const u = q / 9; const j = q === 0 || q === 9 ? 0 : .22; p.setXYZ(q, lerp(f.a.x, f.b.x, u) + (rng() - .5) * j, lerp(f.a.y, f.b.y, u) + Math.sin(u * Math.PI) * .9 + (rng() - .5) * j, lerp(f.a.z, f.b.z, u) + (rng() - .5) * j); } p.needsUpdate = true; f.m.material.opacity = 1 - k; }
    if (k >= 1) { for (const o of [f.m, f.g]) if (o) { W.tray.remove(o); o.material.dispose(); if (o.geometry !== beamGeo && o.geometry !== ringGeo && o.geometry !== glowPlane) o.geometry.dispose(); } fxs.splice(i, 1); } } }
function flashScreen(k) { const el = $('flash'); el.style.transition = 'none'; el.style.opacity = Math.min(.3, k); void el.offsetWidth; el.style.transition = 'opacity .7s ease-out'; el.style.opacity = 0; W.flash = Math.max(W.flash, k * 2); }
// ---------------- game flow ----------------
const timers = []; const after = (dt, f) => timers.push({ t: S.gt + dt, f });
const music = new Player();
const isDuel = () => S.mode === 'duel';
const movesMax = () => isDuel() ? D().duel : LV.moves + (S.kids ? 0 : D().moves);
const movesLeft = (p = S.player) => S.kids && !isDuel() ? Infinity : Math.max(0, movesMax() - S.used[p]);
const cap = () => D().cap;
function levelColors() { return S.kids ? 5 : D().colors ? (D().colors === 5 ? Math.min(5, LV.colors) : Math.max(LV.colors, D().colors)) : LV.colors; }
function newBoard(spec, seed) { const r = BD.mkRng(seed >>> 0); B = BD.createBoard({ layout: spec.layout, colors: spec === INTRO ? 6 : levelColors(), items: spec.items || 0 }, r); buildTray(); }
function resetRun() { timers.length = 0; S.ts = 1; G.roar = 0; W.flash = 0; FT.col.visible = false; FT.cm.uniforms.k.value = 0; for (const M of FT.meshes) { M.p.length = 0; M.im.count = 0; } $("banner").classList.remove("show"); S.score = [0, 0]; S.used = [0, 0]; S.player = 0; S.meter = 0; S.cascade = 0; S.bestC = [0, 0]; S.erupts = [0, 0]; S.specials = [0, 0]; S.fusions = [0, 0]; S.sel = null; S.hintMv = null; S.idleT = 0; S.boostMode = null; S.result = null; S.goldBonus = false; S.boilWarned = false; S.eruptT = -1; S.camE = 0; G.up = 0; W.gold = 0; W.boil = .3; S.stars = 0; }
function start(mode = 'level', li) { if (typeof mode === 'number') { li = mode; mode = 'level'; } if (mode !== 'duel') mode = 'level'; A.unlock(); resetRun(); S.mode = mode; S.li = mode === 'duel' ? 0 : clamp(li ?? S.li, 0, LEVELS.length - 1); LV = mode === 'duel' ? DUEL : LEVELS[S.li];
  S.boosts = mode === 'duel' ? [0, 0, 0] : D().boost.slice(); newBoard(LV, window.__cmBoardSeed ?? (Date.now() & 0xffffff)); S.state = 'play'; S.phase = 'idle'; S.cur = [Math.floor(B.w / 2), Math.floor(B.h / 2)];
  music.start('game', S.gt + .1); A.sfx.ui(); A.play('swoosh_rise', .3, .9, 0, .5); fitDirty = true; showLevelCard(); setUI(); }
function goalState() { const c = BD.counts(B); return LV.goals.map(g => { let left = 0, total = 0;
  if (g.t === 'score') { total = g.n; left = Math.max(0, g.n - S.score[0]); } else if (g.t === 'slime') { left = c.slime; total = LV._slime ?? (LV._slime = c.slime); } else if (g.t === 'locks') { left = c.locks; } else if (g.t === 'pumps') { left = c.pumps; }
  else if (g.t === 'items') { total = LV.items; left = Math.max(0, LV.items - B.stats.items); } else if (g.t === 'kind') { total = g.n; left = Math.max(0, g.n - B.stats.kinds[g.k]); }
  return { ...g, left, done: left <= 0 }; }); }
const goalsDone = () => !isDuel() && goalState().every(g => g.done);
const starsOf = sc => { const s = LV.stars; return sc >= s[2] ? 3 : sc >= s[1] ? 2 : 1; };
const canMove = () => S.state === 'play' && S.phase === 'idle';
function addScore(v, at, col = '#fff0c0', big = 1) { v = Math.round(v * (S.goldBonus ? 2 : 1)); S.score[S.lastMover] += v; if (at && v > 0) popAt('+' + v, col, big, at); }
function trySwapCells(a, b) { if (!canMove() || a == null || b == null) return false; if (!BD.adjacent(B, a, b)) return false; S.idleT = 0; S.hintMv = null; S.sel = null;
  const A0 = B.cells[a], B0 = B.cells[b]; const r = BD.trySwap(B, a, b); const PA = A0 && pieces.get(A0.id), PB = B0 && pieces.get(B0.id);
  if (!PA || !PB) return false; const ax = BD.X(B, a), ay = BD.Y(B, a), bx = BD.X(B, b), by = BD.Y(B, b);
  swapAnim(PA, ax, ay, bx, by); swapAnim(PB, bx, by, ax, ay); A.sfx.swap(pan((ax + bx) / 2)); S.phase = 'swap';
  if (!r.ok) { after(.18, () => { swapAnim(PA, bx, by, ax, ay, true); swapAnim(PB, ax, ay, bx, by, true); A.sfx.bad(pan(ax)); }); after(.4, () => { S.phase = 'idle'; }); return false; }
  S.lastMover = S.player; S.used[S.player]++; S.cascade = 0; S.moveDone = true;
  after(.18, () => { if (r.fuse || r.ghost) fusionFx(r); if (r.erupt) S.meter = cap(); runPass({ pre: r.pre, swap: r.swap, cascade: 1 }); }); setUI(); return true; }
function swapAnim(P, fx, fz, tx, tz, bad) { P.st = 'swap'; P.sw = { fx, fz, tx, tz, t: 0, d: bad ? .2 : .17, bad }; P.tx = tx; P.tz = tz; }
function fusionFx(r) { const at = cellWorld(r.at); S.fusions[S.lastMover] += r.fuse ? 1 : 0;
  if (r.fuse === 'gg') { banner('👻👻 ' + t('erupts')); A.sfx.fusion(); A.sfx.ghostFire(); flashScreen(.25); S.fovPunch = 1; }
  else if (r.ghost || r.fuse === 'gl' || r.fuse === 'gb') { A.sfx.ghostFire(); if (r.fuse) A.sfx.fusion(); ring(at, '#d8c0ff', 2.2, .9); S.fovPunch = Math.max(S.fovPunch, r.fuse ? .8 : .4); if (r.conv) for (const c of r.conv) { const cell = B.cells[c.i]; const P = cell && pieces.get(cell.id); bolt(at, cellWorld(c.i)); if (P) { P.c = cell; rebuildPiece(P); P.glow = 1; } } }
  else { A.sfx.fusion(); ring(at, '#fff0c0', 2.6, .9); flashScreen(.15); S.fovPunch = Math.max(S.fovPunch, .8); if (r.fuse === 'bb') { const P = pieces.get(B.cells[r.at].id); if (P) { P.c = B.cells[r.at]; rebuildPiece(P); } } }
  if (r.fuse) { S.meter += 25; banner(r.fuse === 'gg' ? '' : '💥 FUSION!'); } }
function runPass(ctx) { const ev = BD.resolvePass(B, ctx); if (!ev) { settled(); return; } S.cascade = ctx.cascade || S.cascade + 1; S.bestC[S.lastMover] = Math.max(S.bestC[S.lastMover], S.cascade);
  S.phase = 'clear'; const dur = animateClear(ev); after(dur, () => { animateFall(ev); S.phase = 'fall'; S.fallT = 0; S.nextCtx = { cascade: S.cascade + 1 }; }); }
function animateClear(ev) { const cas = ev.cascade; let maxD = 0; const q = QUALITY[S.q].parts; const sc = ev.score * (S.goldBonus ? 2 : 1);
  if (!ev.erupt) { A.sfx.ladder(cas); if (cas >= 2 && !(S.state === 'intro' && S.titleT >= 0)) { const lv = cas >= 6 ? 4 : cas >= 4 ? 3 : cas >= 3 ? 2 : 1; banner(t('c' + lv)); A.sfx.callout(Math.min(3, lv)); if (cas >= 4) S.fovPunch = Math.max(S.fovPunch, .35); } }
  let popN = 0; const center = new THREE.Vector3(); let nC = 0;
  for (const c of ev.cleared) { const P = pieces.get(c.id); const d = c.d * .07; maxD = Math.max(maxD, d); const pos = cellWorld(c.i); center.add(pos); nC++;
    if (P) { P.st = 'pop'; P.t = -d; P.popSound = popN++ < 5 || c.sp; } if (!ev.erupt) after(d, () => { sparks(F, pos, Math.round(14 * q), { colors: [KIND_COL[c.k] || '#fff', '#ffffff'], speed: 2.4, up: 1.8, life: .6, grav: 5, size: .07 }); });
    if (c.k >= 0 && c.k < 6 && !ev.erupt) { const P2 = P; after(d, () => { if (P2 && P2.popSound) A.sfx.pop(c.k, cas, pan(BD.X(B, c.i))); }); } }
  for (const b of ev.blasts) { const d = b.d * .07; after(d, () => { const p = cellWorld(b.i); if (b.type === 'h' || b.type === 'v') { beam(b.i, b.type, '#fff6e0'); A.sfx.stripe(pan(BD.X(B, b.i))); sparks(F, p, Math.round(40 * q), { colors: ['#ffffff', '#ffe0a0'], speed: 5, up: 1, life: .5, grav: 1, size: .06 }); }
    else if (b.type === 'b' || b.type === 'b2') { ring(p, '#ffb050', b.r === 2 ? 2.4 : 1.4); A.sfx.bomb(pan(BD.X(B, b.i))); flashScreen(.08); S.fovPunch = Math.max(S.fovPunch, .3); sparks(F, p, Math.round(60 * q), { colors: ['#ffd27a', '#ff8a1f', '#ffffff'], speed: 4.5, up: 3, life: .8, grav: 4, size: .08 }); puff(F, p, 3, '#ffd0a0', 1.2); }
    else if (b.type === 'g') { A.sfx.ghostFire(); ring(p, '#d8c0ff', 2.2, .9); for (const q2 of ev.ghostClears) bolt(p, cellWorld(q2)); } }); maxD = Math.max(maxD, d + .1); }
  for (const cr of ev.created) { const cell = B.cells[cr.i]; const P = cell && pieces.get(cell.id); if (P) { P.c = cell; after(.05, () => { rebuildPiece(P); P.glow = 1; P.sq = -.4; }); } S.specials[S.lastMover]++; after(.05, () => { A.sfx.special(cr.sp, pan(BD.X(B, cr.i))); ring(cellWorld(cr.i), cr.sp === 'g' ? '#e8d8ff' : '#fff0b0', 1, .5); }); }
  for (const a of ev.armed) { const cell = B.cells[a.i]; const P = cell && pieces.get(cell.id); if (P) { P.c = cell; P.armed = true; } }
  for (const p of ev.pumps) { const P = pieces.get(p.id); const d = (p.d || 0) * .07; after(d, () => { A.sfx.pump(p.hp <= 0, pan(BD.X(B, p.i))); const pos = cellWorld(p.i);
      if (p.hp <= 0) { if (P) { P.st = 'pop'; P.t = 0; P.popSound = false; } sparks(F, pos, Math.round(50 * q), { colors: ['#ff7410', '#ffb040', '#3d4a18'], speed: 3.5, up: 3, life: .9, grav: 6, size: .09 }); ring(pos, '#ff9a30', 1.1); }
      else if (P) { P.c.hp = p.hp; P.g.userData.face.visible = true; P.sq = .3; sparks(F, pos, Math.round(20 * q), { colors: ['#ff7410', '#ffd080'], speed: 2.5, up: 2, life: .6, grav: 5, size: .07 }); } }); }
  for (const l of ev.locks) tearWeb(l.i);
  for (const s of ev.slime) { const i = s.i, v = s.v; after(.05, () => { setSlime(i, v); A.sfx.slime(pan(BD.X(B, i))); }); }
  for (const c of ev.collected) { const P = pieces.get(c.id); if (P) P.collect = true; }
  if (nC) center.multiplyScalar(1 / nC); if (sc > 0 && !ev.erupt) addScore(ev.score, nC ? center : null, cas >= 3 ? '#ffd27a' : '#fff0c0', 1 + Math.min(.8, cas * .12));
  else if (ev.erupt) addScore(ev.score * 2, null);
  // brew meter
  let gain = 0; for (const c of ev.cleared) gain += 1 + .5 * (cas - 1); if (ev.created.length) gain += 4 * ev.created.length; if (!ev.erupt && S.eruptT < 0) S.meter = Math.min(cap() * 1.2, S.meter + gain * (S.kids ? 1.4 : 1));
  if (S.meter >= cap() * .8 && !S.boilWarned && S.eruptT < 0) { S.boilWarned = true; toast(t('boilOver')); A.sfx.meterFull(); }
  setUI(); return Math.max(.22, maxD + .24); }
function animateFall(ev) { // move survivors to their new cells, spawn new candies above the far edge
  for (const m of ev.moves) { const P = pieces.get(m.id); if (!P) continue; if (m.gone) continue; P.tx = BD.X(B, m.to); P.tz = BD.Y(B, m.to); if (P.st !== 'pop') { P.st = 'fall'; P.vz = 0; P.delay = 0; } }
  const colN = {}; for (const s of ev.spawns) { if (s.gone) continue; const cell = B.cells[s.to]; if (!cell) continue; const x = BD.X(B, s.to); colN[x] = (colN[x] || 0) + 1; }
  const colSeen = {}; for (const s of ev.spawns.slice().sort((a, b) => BD.Y(B, b.to) - BD.Y(B, a.to))) { if (s.gone) continue; const cell = B.cells[s.to]; if (!cell || pieces.has(cell.id)) continue; const x = BD.X(B, s.to); colSeen[x] = (colSeen[x] || 0) + 1;
    const P = addPiece(cell, s.to, { x, z: -1.2 - (colSeen[x] - 1) * 1.05 - (colN[x] > 0 ? 0 : 0), y: .3, st: 'fall', vz: 0, tx: x, tz: BD.Y(B, s.to), s: 0, delay: x * .012 }); P.golden = S.goldBonus; }
  // golden skulls that reached the bottom leave the board
  for (const c of ev.collected) { const P = pieces.get(c.id); if (P) { P.st = 'collect'; P.t = 0; const pos = cellWorld(c.i); after(.25, () => { A.sfx.item(pan(BD.X(B, c.i))); popAt('💀 +500', '#ffd84a', 1.3, pos); sparks(F, pos, 50, { colors: ['#ffd84a', '#ffffff'], speed: 3, up: 3, life: 1, grav: 2, size: .07 }); }); } } }
function piecesSettled() { for (const P of pieces.values()) if (P.st === 'fall' || P.st === 'swap' || P.st === 'pop' || P.st === 'collect' || P.st === 'shuffle') return false; return true; }
function settled() {
  if (S.meter >= cap() && S.eruptT < 0 && (S.state === 'play' || S.state === 'intro')) { startErupt(); return; }
  if (S.goldBonus) { S.goldBonus = false; W.gold = 0; }
  if (S.rushing) { S.rushing = false; finishRush(); return; }
  afterMove(); }
function afterMove() { S.phase = 'idle'; S.idleT = 0; music.I = clamp(S.meter / cap() * .7 + (S.cascade >= 3 ? .3 : 0), 0, 1);
  if (S.state === 'intro') { introAfter(); return; }
  if (S.state !== 'play') return;
  if (!isDuel()) { if (goalsDone() && !window.__cmNoWin) { startRush(); return; } if (movesLeft() <= 0) { S.phase = 'over'; after(.6, () => endRun('fail')); return; } }
  else { if (S.used[0] >= movesMax() && S.used[1] >= movesMax()) { S.phase = 'over'; after(.6, () => endRun('duel')); return; } if (S.moveDone && S.used[1 - S.player] < movesMax()) { S.player = 1 - S.player; A.sfx.turn(); toast(`${t(S.player ? 'p2' : 'p1')} – ${t('yourTurn')}`); } }
  S.moveDone = false;
  if (!BD.findMoves(B, 1).length) doShuffle(); setUI(); }
function doShuffle() { const mv = BD.shuffle(B); banner(t('shuffle')); A.sfx.shuffle(); S.phase = 'shuffle';
  for (const m of mv) { const P = pieces.get(m.id); if (!P) continue; P.st = 'shuffle'; P.sw = { fx: P.x, fz: P.z, tx: BD.X(B, m.to), tz: BD.Y(B, m.to), t: 0, d: .55 }; P.tx = P.sw.tx; P.tz = P.sw.tz; }
  after(.65, () => { if (BD.findRuns(B).length) runPass({ cascade: 1 }); else { S.phase = 'idle'; } }); }
// ---- THE CAULDRON ERUPTS ----
function startErupt() { S.phase = 'erupt'; S.eruptT = 0; S.erupts[S.lastMover]++; S.meter = 0; S.boilWarned = false; G.up = 0; S.eruptStage = 0; banner('🌋 ' + t('erupts')); A.sfx.meterFull(); music.I = 1; setUI(); }
function updateErupt(dt) { if (S.eruptT < 0) return; const e0 = S.eruptT; S.eruptT += dt; const e = S.eruptT; const at = s => e0 < s && e >= s;
  W.boil = Math.min(1.5, .3 + e * 1.2); S.camE = Math.min(1, S.camE + dt * 1.1);
  for (const P of pieces.values()) if (P.st === 'idle' && e < 1) P.jit = Math.min(1, e);
  if (at(.85)) { const ev = BD.resolvePass(B, { erupt: true, cascade: 2 }); S.eruptEv = ev; A.sfx.erupt(); flashScreen(.3); S.fovPunch = 1; W.glowPunch = 2; W.gold = 1; S.ts = .6;
    const geyser = new THREE.Vector3(0, POTION_Y + .5, -1.5); FT.col.visible = true;
    for (const c of ev.cleared) { const P = pieces.get(c.id); if (P) { pieces.delete(c.id); W.tray.remove(P.g); } spray(FT, 1, cellWorld(c.i, .6), rng, { speed: 2.5, up: 11, gulp: .55, life: 5, size: 1 }); }
    spray(FT, Math.round(90 * QUALITY[S.q].parts), geyser, rng, { speed: 5, up: 15, gulp: .45, life: 5, size: 1.1 });
    sparks(F, geyser, Math.round(220 * QUALITY[S.q].parts), { colors: ['#9aff6a', '#ffe070', '#ffffff'], speed: 6, up: 9, life: 1.6, grav: 6, size: .12 });
    for (const p of ev.pumps) { const P = pieces.get(p.id); if (P && p.hp <= 0) { pieces.delete(p.id); W.tray.remove(P.g); } else if (P) { P.c.hp = p.hp; P.g.userData.face.visible = true; } }
    for (const l of ev.locks) tearWeb(l.i); for (const s of ev.slime) setSlime(s.i, s.v);
    addScore(ev.score * 2, null); popAt(`×2  +${Math.round(ev.score * 2)}`, '#ffe070', 1.8, new THREE.Vector3(0, 2, 0)); S.eruptStage = 1; setUI(); }
  if (e >= .85 && e < 1.6) { if (rng() < dt * 30) spray(FT, 2, new THREE.Vector3(0, POTION_Y + .5, -1.5), rng, { speed: 4, up: 14, gulp: .5, life: 5 }); }
  if (e >= 1.2) G.up = Math.min(1, G.up + dt / 1.0);
  if (at(2.05)) { G.roar = 1; A.sfx.roar(); S.fovPunch = 1.2; banner('👾 ' + t('ghoul')); flashScreen(.12); }
  if (at(4.2)) { A.sfx.sink(); }
  if (e >= 4.2) G.up = Math.max(0, G.up - dt / 1.1);
  if (e >= 4.2) FT.cm.uniforms.k.value = Math.max(0, FT.cm.uniforms.k.value - dt * 1.5); else if (e >= 1.7) FT.cm.uniforms.k.value = Math.max(.3, FT.cm.uniforms.k.value - dt * 1.2); else if (e >= .85) FT.cm.uniforms.k.value = Math.min(1, FT.cm.uniforms.k.value + dt * 3); // the column thins so the ghoul reads
  if (e > 2.6) S.ts = Math.min(1, S.ts + dt * .8);
  if (at(4.6)) { S.goldBonus = true; animateFall(S.eruptEv); S.phase = 'fall'; S.fallT = 0; S.nextCtx = { cascade: 2 }; S.eruptStage = 2; }
  if (S.state === 'intro' && e >= 5) introAfter();
  if (e >= 6) { S.eruptT = -1; FT.col.visible = false; S.ts = 1; }
  S.camE = e > 5 ? Math.max(0, S.camE - dt * 1.6) : S.camE; }
function onGulp(P) { G.mouth = 1; const now = S.gt; if (now - (S.lastGulp || 0) > .28) { S.lastGulp = now; A.sfx.gulp(); } if (rng() < .5) addScore(200 / 4, null); sparks(F, P.p, 6, { colors: ['#9aff6a', '#ffffff'], speed: 1.5, up: 1, life: .4, grav: 1, size: .08 }); }
// ---- WITCHING HOUR: leftover moves become striped candies that fire ----
function startRush() { const left = S.kids ? 3 : movesLeft(); S.phase = 'rush'; S.rushing = true; banner('🍭 ' + t('witchingHour')); A.sfx.rush(); const pool = []; for (let i = 0; i < B.n; i++) { const c = B.cells[i]; if (c && c.t === 'c' && !c.sp && !c.lock) pool.push(i); }
  const n = Math.min(left, 10, pool.length); const pre = []; for (let q = 0; q < n; q++) { const j = Math.floor(rng() * pool.length); const i = pool.splice(j, 1)[0]; const c = B.cells[i]; c.sp = rng() < .5 ? 'h' : 'v'; const P = pieces.get(c.id); if (P) after(q * .09, () => { rebuildPiece(P); P.glow = 1; A.sfx.special('h', pan(BD.X(B, i))); }); pre.push([i, q * .6]); }
  if (left > n) addScore((left - n) * 500, null); S.lastMover = 0;
  if (!n) { S.rushing = false; finishRush(); return; } after(n * .09 + .3, () => { S.phase = 'rush'; const ev = BD.resolvePass(B, { pre, cascade: 1 }); if (!ev) { S.rushing = false; finishRush(); return; } S.cascade = 1; const dur = animateClear(ev); after(dur, () => { animateFall(ev); S.phase = 'fall'; S.fallT = 0; S.nextCtx = { cascade: 2 }; }); }); }
function finishRush() { S.phase = 'over'; after(.5, () => endRun('win')); }
function endRun(kind) { if (S.state !== 'play') return; S.result = kind; S.state = 'end'; S.endT = S.gt; music.start('menu', S.gt + .5);
  const p = prog(); let best = false;
  if (kind === 'win') { const st = starsOf(S.score[0]); S.stars = st; p.st[S.li] = Math.max(p.st[S.li] || 0, st); if ((p.b[S.li] || 0) < S.score[0]) { p.b[S.li] = S.score[0]; best = true; } p.u = Math.max(p.u, Math.min(LEVELS.length - 1, S.li + 1)); saveProg(p); A.sfx.win(); for (let i = 0; i < st; i++) after(.6 + i * .45, () => A.sfx.star(i)); }
  else if (kind === 'fail') A.sfx.fail(); else if (kind === 'duel') { A.sfx.win(); }
  S.newBest = best; showEnd(); setUI(); }
function toMenu() { S.state = 'menu'; S.phase = 'idle'; S.mode = 'level'; resetRun(); LV = INTRO; newBoard(INTRO, 777); music.start('menu', S.gt + .2); applyLang(); setUI(); buildLevelMap(); }
// ---------------- piece animation ----------------
const ptr = new THREE.Vector2(0, 0); const _v = new THREE.Vector3();
const selRing = new THREE.Mesh(ringGeo, addMat('#fff4c0', .9)), curRing = new THREE.Mesh(ringGeo, addMat('#9ad0ff', .7)), hintRings = [0, 1].map(() => new THREE.Mesh(ringGeo, addMat('#ffe070', .8)));
for (const r of [selRing, curRing, ...hintRings]) { r.rotation.x = -Math.PI / 2; r.scale.setScalar(.5); r.visible = false; W.tray.add(r); }
function updatePieces(dt) { const tt = S.gt; const hint = S.hintMv && S.phase === 'idle' ? [S.hintMv.a, S.hintMv.b] : null; const hintOn = hint && (tt % 1.6) < .9;
  for (const P of [...pieces.values()]) { const g = P.g; P.t += dt;
    if (P.st === 'swap' || P.st === 'shuffle') { const w = P.sw; w.t += dt; const k = clamp(w.t / w.d, 0, 1); const e = P.st === 'shuffle' ? eio(k) : w.bad ? eo(k) : back(k);
      P.x = lerp(w.fx, w.tx, e); P.z = lerp(w.fz, w.tz, e); P.y = Math.sin(Math.PI * k) * (P.st === 'shuffle' ? .9 : .28); if (k >= 1) { P.x = w.tx; P.z = w.tz; P.y = 0; P.st = 'idle'; P.sq = w.bad ? .12 : .22; } }
    else if (P.st === 'fall') { if (P.delay > 0) { P.delay -= dt; } else { P.vz = Math.min(26, P.vz + 46 * dt); P.z += P.vz * dt; P.x = P.tx; P.y = Math.max(0, P.y - dt * 1.5);
        if (P.z >= P.tz) { P.z = P.tz; P.y = 0; if (P.vz > 3) { P.sq = Math.min(.42, P.vz * .03); A.sfx.land(P.vz / 10, pan(P.x)); if (P.golden) sparks(F, cellWorld(P.tz * B.w + P.tx), 8, { colors: ['#ffe070', '#ffffff'], speed: 1.5, up: 2, life: .5, grav: 4, size: .06 }); } P.vz = 0; P.st = 'idle'; } }
      P.s = clamp((P.z + 1.4) / .9, 0, 1); }
    else if (P.st === 'pop') { if (P.t >= 0) { const k = P.t / .24; P.s = k < .3 ? 1 + .4 * smooth(k / .3) : 1.4 * (1 - smooth((k - .3) / .7)); g.rotation.z += dt * 9; if (k >= 1) { W.tray.remove(g); pieces.delete(P.id); continue; } } }
    else if (P.st === 'collect') { P.y += dt * 3.2; P.s = Math.max(0, 1 - P.t * 1.6); if (P.s <= 0) { W.tray.remove(g); pieces.delete(P.id); continue; } }
    P.sqv = fin(P.sqv) + (-fin(P.sq) * 190 - fin(P.sqv) * 13) * dt; P.sq = clamp(fin(P.sq) + P.sqv * dt, -.5, .5);
    const bob = P.st === 'idle' ? Math.sin(tt * 2.1 + P.ph) * .025 : 0; const sel = S.sel === P.tz * B.w + P.tx && P.st === 'idle' ? .16 : 0;
    const jit = P.jit ? (rng() - .5) * .06 * P.jit : 0; g.position.set(cx(P.x) + jit, CANDY_Y + P.y + bob + sel, cz(P.z) + jit);
    const s = fin(P.s, 1) * (1 + fin(P.glow) * .25); g.scale.set(s * (1 + P.sq * .5), s * (1 - P.sq), s * (1 + P.sq * .5)); P.glow = Math.max(0, fin(P.glow) - dt * 2.5);
    const isHint = hintOn && P.st === 'idle' && hint.includes(P.tz * B.w + P.tx); g.rotation.z = isHint ? Math.sin(tt * 18) * .25 : P.st === 'pop' ? g.rotation.z : lerp(g.rotation.z, 0, Math.min(1, dt * 10));
    const u = g.userData; if (u.body && P.c.t === 'c') { u.body.rotation.y = Math.sin(tt * .9 + P.ph) * .25; if (u.ghost) u.body.rotation.y = tt * 1.6 + P.ph; }
    if (u.eye) { /* eyeballs follow your finger */ u.eye.rotation.set(-.55 - ptr.y * .45, Math.PI + ptr.x * .7, 0); }
    if (u.stripe) u.stripe.children.forEach((r, q) => { r.rotation.x = tt * 3 + q; });
    if (u.bomb) { const k = P.armed || P.c.sp === 'b2' ? 1 + Math.sin(tt * 22) * .08 : 1 + Math.sin(tt * 4 + P.ph) * .05; u.bomb.scale.setScalar(1.28 * k); }
    if (P.hide) g.visible = false; else g.visible = true; }
  // web tear-off
  for (const [i, w] of webM) { if (w.t < 0) continue; w.t += dt; const k = w.t / .45; w.m.scale.setScalar(1 + k * .8); w.m.position.y = CANDY_Y + .2 + k * .6; w.m.material = w.mat || (w.mat = K.mats.web.clone()); w.m.material.opacity = 1 - k; if (k >= 1) { W.tray.remove(w.m); w.mat.dispose(); webM.delete(i); } }
  // rings
  const ringAt = (r, i, on, s) => { r.visible = on && i != null; if (r.visible) { cellWorld(i, .12, r.position); r.scale.setScalar(s); } };
  ringAt(selRing, S.sel, S.state === 'play' && S.sel != null, .55 + Math.sin(tt * 8) * .03); ringAt(curRing, S.cur ? S.cur[1] * B.w + S.cur[0] : null, S.state === 'play' && S.kb, .52);
  hintRings.forEach((r, q) => ringAt(r, hint ? hint[q] : null, !!hintOn && S.state === 'play', .5 + Math.sin(tt * 10) * .04)); }
// ---------------- camera ----------------
const camPos = new THREE.Vector3(0, 10, 10), look = new THREE.Vector3(); let fitDirty = true; const fit = { pos: new THREE.Vector3(0, 10, 9), look: new THREE.Vector3(), fov: 40, off: 0 }; const tcam = new THREE.PerspectiveCamera();
const portrait = () => VW / VH < .85;
function fitCam() { fitDirty = false; const pr = portrait(); const fov = pr ? 46 : 38, pitch = (pr ? 64 : 55) * Math.PI / 180; const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
  const w = (B ? B.w : 8) * CELL / 2 + .1, h = (B ? B.h : 8) * CELL / 2 + .1; const C = [[-w, -h], [w, -h], [-w, h], [w, h]].map(([x, z]) => new THREE.Vector3(x, .5, z));
  const topPx = pr ? 168 : 132, botPx = pr ? 112 : 92; const yT = 1 - 2 * topPx / VH, yB = -1 + 2 * botPx / VH, xM = pr ? .985 : .9;
  tcam.fov = fov; tcam.aspect = VW / VH; tcam.near = .1; tcam.far = 200; tcam.updateProjectionMatrix(); const tgt = new THREE.Vector3(0, 0, .1);
  let lo = 4, hi = 80, box = null; const bb = d => { tcam.position.copy(tgt).addScaledVector(dir, d); tcam.lookAt(tgt); tcam.updateMatrixWorld(); let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const c of C) { _v.copy(c).project(tcam); x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y); } return { x0, x1, y0, y1 }; };
  for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; const b = bb(m); if (b.x1 - b.x0 <= 2 * xM && b.y1 - b.y0 <= (yT - yB)) hi = m; else lo = m; } box = bb(hi);
  fit.pos.copy(tgt).addScaledVector(dir, hi); fit.look.copy(tgt); fit.fov = fov; fit.off = ((yT + yB) / 2 - (box.y0 + box.y1) / 2) * VH / 2; }
function eruptCam(out) { const pr = portrait(); out.pos.set(0, pr ? 10.5 : 8.6, pr ? 25 : 18.5); out.look.set(0, pr ? 3.2 : 2.6, -3.2); out.fov = pr ? 60 : 48; return out; }
const ecam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 48 };
function menuCam(out) { const a = Math.sin(S.gt * .07) * .45 + .35, pr = portrait(); const R = pr ? 21 : 15.5; out.pos.set(Math.sin(a) * R, pr ? 12 : 9.2, Math.cos(a) * R); out.look.set(pr ? 0 : -2.4 * Math.cos(a), pr ? -1.5 : .6, 0); out.fov = pr ? 55 : 42; return out; }
const mcam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 42 };
function updateCamera(dt) { if (fitDirty) fitCam(); let pos, lk, fov, off = 0;
  if (S.state === 'intro' && S.introCam) { pos = S.introCam.pos; lk = S.introCam.look; fov = S.introCam.fov; off = S.introCam.off || 0; camPos.copy(pos); look.copy(lk); }
  else if (S.state === 'menu' || (S.state === 'end' && S.mode !== 'duel' && false)) { menuCam(mcam); const k = 1 - Math.exp(-dt * 1.6); camPos.lerp(mcam.pos, k); look.lerp(mcam.look, k); fov = mcam.fov; }
  else { const br = new THREE.Vector3(Math.sin(S.gt * .21) * .22, Math.sin(S.gt * .17) * .1, 0); const e = smooth(S.camE); eruptCam(ecam);
    const tp = fit.pos.clone().add(br).lerp(ecam.pos, e), tl = fit.look.clone().lerp(ecam.look, e); const k = 1 - Math.exp(-dt * (S.camE > 0 ? 2.6 : 4)); camPos.lerp(tp, k); look.lerp(tl, k); fov = lerp(fit.fov, ecam.fov, e); off = fit.off * (1 - e); }
  if (!Number.isFinite(camPos.x + camPos.y + camPos.z)) camPos.set(0, 10, 10); if (!Number.isFinite(look.x + look.y + look.z)) look.set(0, 0, 0);
  S.fovPunch = Math.max(0, fin(S.fovPunch) - dt * 1.6); camera.position.copy(camPos); camera.lookAt(look); camera.fov = clamp(fin(fov, 42) - S.fovPunch * 3.2, 20, 80);
  if (Math.abs(off) > .5) camera.setViewOffset(VW, VH, 0, -off, VW, VH); else camera.clearViewOffset(); camera.aspect = VW / VH; camera.updateProjectionMatrix(); }
// ---------------- intro: MOON DROP → cascade → THE CAULDRON ERUPTS → title ----------------
let introPick = null;
// the opening board: found offline by searching 6000 seeds for the drop that sets off the longest cascade (5 waves, 41 candies, 2 specials)
function pickIntro() { return introPick || (introPick = { sd: 3636, x: 5 }); }
let hero = null;
function startIntro() { S.state = 'intro'; S.mode = 'level'; S.introT = 0; S.phase = 'introDrop'; resetRun(); LV = INTRO; const pk = pickIntro(); newBoard(INTRO, pk.sd); S.i0 = pk.x; S.meter = cap() - .5;
  const c0 = B.cells[S.i0]; const P0 = pieces.get(c0.id); P0.hide = true; if (hero) scene.remove(hero); hero = K.make(0); hero.scale.setScalar(2.4); scene.add(hero);
  S.introCam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40, off: 0 }; S.titleT = -1; $('opening').style.opacity = 0; music.stop(); A.sfx.intro(); introStep(0); setUI(); }
const HERO0 = new THREE.Vector3(7.3, 9.1, -12.8);
function introStep(dt) { S.introT += dt; const T0 = S.introT; const ic = S.introCam; if (!ic) return; const p1 = B ? cellWorld(S.i0, CANDY_Y) : new THREE.Vector3();
  if (hero && S.phase === 'introDrop') { let hp; if (T0 < 1.0) { hp = HERO0.clone().add(new THREE.Vector3(0, -T0 * .75, 0)); hero.scale.setScalar(2.4); }
    else { const k = clamp((T0 - 1.0) / 1.4, 0, 1), e = k * k; hp = HERO0.clone().add(new THREE.Vector3(0, -.75, 0)).lerp(p1, e); hp.y += Math.sin(Math.PI * k) * 1.2 * (1 - k); hero.scale.setScalar(lerp(2.4, 1, smooth(k))); }
    hero.position.copy(hp); hero.rotation.set(TILT * smooth((T0 - 1.0) / 1.4) + Math.sin(T0 * 1.3) * .3, T0 * 2.6, Math.sin(T0 * 1.9) * .3);
    if (T0 >= 2.4) { scene.remove(hero); hero = null; const c0 = B.cells[S.i0]; c0.k = 0; c0.sp = ''; const P0 = pieces.get(c0.id); P0.c = c0; rebuildPiece(P0); P0.hide = false; P0.sq = .45; A.sfx.land(1.2, 0); A.play('plop', .5, .6, 0, .3); A.play('thump', .4, .8, 0, .3);
      sparks(F, p1, 40, { colors: ['#ff8a1f', '#ffffff'], speed: 2.5, up: 2.5, life: .7, grav: 5, size: .07 }); ring(p1, '#ffd08a', 1.2); S.phase = 'idle'; S.lastMover = 0; runPass({ cascade: 1, swap: [S.i0] }); } }
  // camera: moon window → crane down with the candy → into the cauldron → gameplay framing
  const winCam = new THREE.Vector3(4.6 + T0 * .25, 8.3 - T0 * .1, -6.6 + T0 * .2), winLook = (hero ? hero.position : p1).clone().lerp(new THREE.Vector3(8.2, 9.6, -16.8), .25);
  const mid = new THREE.Vector3(1.6, 7.4, 6.5), midLook = (hero ? hero.position : p1).clone().lerp(new THREE.Vector3(0, 0, 0), .55);
  if (fitDirty) fitCam(); const gp = fit.pos.clone().add(new THREE.Vector3(0, -.6, -.8)), gl = fit.look.clone();
  if (T0 < 1.0) { ic.pos.copy(winCam); ic.look.copy(winLook); ic.fov = 38; ic.off = 0; }
  else if (T0 < 2.8) { const k = eio((T0 - 1.0) / 1.8); ic.pos.copy(winCam).lerp(mid, k); ic.look.copy(winLook).lerp(midLook, k); ic.fov = 38 + k * 4; ic.off = 0; }
  else { const k = eio((T0 - 2.8) / 1.3); ic.pos.copy(mid).lerp(gp, k); ic.look.copy(midLook).lerp(gl, k); ic.fov = lerp(42, fit.fov, k); ic.off = fit.off * k; }
  if (S.camE > 0) { eruptCam(ecam); const e = smooth(S.camE); ic.pos.lerp(ecam.pos, e); ic.look.lerp(ecam.look, e); ic.fov = lerp(ic.fov, ecam.fov, e); ic.off *= 1 - e; }
  // title slam + recede (driven by game time, so the video gets it frame-exact)
  const el = $('opening'); if (S.titleT >= 0) { const k = S.introT - S.titleT; const slam = k < .35 ? lerp(3.2, 1, eo(k / .35)) : 1; const rec = k > 1.5 ? smooth((k - 1.5) / 1.6) : 0;
    el.style.opacity = String(k < .12 ? k / .12 : 1 - smooth((k - 2.7) / .4)); el.style.transform = `translate(-50%,-50%) perspective(700px) rotateX(${rec * 52}deg) translateY(${-rec * 140}px) scale(${slam * (1 - rec * .72)})`;
    if (k > 3.15) endIntro(); } }
function introAfter() { if (S.titleT < 0) { S.titleT = S.introT + .2; after(.2, () => { A.sfx.title(); S.fovPunch = .6; flashScreen(.12); }); } }
function endIntro() { if (S.state !== 'intro') return; if (hero) { scene.remove(hero); hero = null; } $('opening').style.opacity = 0; S.introCam = null; S.eruptT = -1; G.up = 0; FT.col.visible = false; S.ts = 1; S.camE = 0; toMenu(); }
// ---------------- UI ----------------
const fmt = n => Math.round(n).toLocaleString(S.lang === 'de' ? 'de-DE' : 'en-US');
const GOAL_ICON = { score: '⭐', slime: '🟢', locks: '🕸️', pumps: '🎃', items: '💀' }, KIND_ICON = ['🍬', '🌽', '👁️', '🍭', '🍫', '🦇'];
const levelName = () => t('n_' + LV.name);
function goalsHTML(gs, big) { return gs.map(g => `<span class="goal${g.done ? ' done' : ''}${g.t === 'items' ? ' gold' : ''}" title="${g.t === 'kind' ? KIND_NAMES[S.lang][g.k] : t('g_' + g.t)}"><i>${g.t === 'kind' ? KIND_ICON[g.k] : GOAL_ICON[g.t]}</i><b>${g.done ? '✓' : g.t === 'score' ? fmt(g.left) : g.left}</b>${big ? `<small>${g.t === 'kind' ? t('g_kind') + ' ' + KIND_NAMES[S.lang][g.k] : t('g_' + g.t)}</small>` : ''}</span>`).join(''); }
let lastUI = '';
function setUI() { const st = S.state; document.body.dataset.state = st; document.body.dataset.mode = S.mode; document.body.dataset.kids = S.kids ? '1' : '0'; document.body.dataset.phase = S.phase; document.body.dataset.boost = S.boostMode || '';
  if (st !== 'menu') S.more = false; $('menu').classList.toggle('show', st === 'menu'); $('more').classList.toggle('show', st === 'menu' && !!S.more); document.body.dataset.more = S.more ? '1' : '0'; $('btnMore').setAttribute('aria-expanded', S.more ? 'true' : 'false'); $('end').classList.toggle('show', st === 'end');
  if (st !== 'play' && st !== 'end') return; const duel = isDuel(), p = duel ? S.player : 0;
  $('hLevel').textContent = duel ? t('duelT') : `${S.li + 1} · ${levelName()}`; $('hScore').textContent = fmt(S.score[p]); const ml = movesLeft(p); $('hMoves').textContent = Number.isFinite(ml) ? ml : '∞'; $('hMoves').parentElement.classList.toggle('low', Number.isFinite(ml) && ml <= 3);
  if (!duel) { const s3 = LV.stars[2], sc = S.score[0]; $('starFill').style.width = Math.min(100, sc / s3 * 100) + '%'; $('starMarks').innerHTML = LV.stars.map((v, i) => `<i style="left:${Math.min(100, v / s3 * 100)}%" class="${sc >= v && (i > 0 || goalsDone()) ? 'on' : ''}">★</i>`).join(''); const html = goalsHTML(goalState()); if (html !== lastUI) { $('goals').innerHTML = html; lastUI = html; } }
  $('brewFill').style.width = Math.min(100, S.meter / cap() * 100) + '%'; $('brew').classList.toggle('hot', S.meter >= cap() * .8);
  $('dP1').textContent = `${t('p1')} · ${fmt(S.score[0])} · ${Math.max(0, movesMax() - S.used[0])}`; $('dP2').textContent = `${t('p2')} · ${fmt(S.score[1])} · ${Math.max(0, movesMax() - S.used[1])}`; $('dP1').classList.toggle('on', S.player === 0); $('dP2').classList.toggle('on', S.player === 1);
  ['bHammer', 'bBroom', 'bShuffle'].forEach((id, i) => { const b = $(id); b.querySelector('em').textContent = S.kids ? '∞' : S.boosts[i]; b.disabled = !S.kids && S.boosts[i] <= 0; b.classList.toggle('on', S.boostMode === ['hammer', 'broom'][i]); }); }
function applyLang() { document.documentElement.lang = S.lang; document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t)); $('btnLang').textContent = S.lang === 'en' ? 'DE' : 'EN';
  $('keysTip').textContent = t(isTouch ? 'keysHintT' : 'keysHint'); $('oSub').textContent = t('countdown');
  const kidsOn = S.kids, diffOn = S.diff; $('btnKids').classList.toggle('on', kidsOn); $('btnKids').setAttribute('aria-pressed', kidsOn); document.querySelectorAll('#diff button').forEach(b => b.classList.toggle('on', b.dataset.d === diffOn)); $('diff').classList.toggle('off', kidsOn);
  $('btnSound').textContent = A.isMuted() ? '🔇' : '🔊'; qLabels(); $('btnSkip').textContent = t(isTouch ? 'tapPlay' : 'clickPlay'); lastUI = ''; buildLevelMap(); setUI(); }
function buildLevelMap() { const p = prog(); const el = $('levels'); if (!el) return; el.innerHTML = LEVELS.map((L, i) => { const lock = i > p.u; const st = p.st[i] || 0;
    return `<button class="lv${lock ? ' lock' : ''}${i === p.u && !lock ? ' cur' : ''}" data-l="${i}" ${lock ? 'disabled' : ''} aria-label="${t('levelL')} ${i + 1}"><b>${lock ? '🔒' : i + 1}</b><i>${lock ? '' : '★'.repeat(st) + '☆'.repeat(3 - st)}</i></button>`; }).join('');
  el.querySelectorAll('button.lv').forEach(b => b.onclick = () => { S.li = +b.dataset.l; start('level', S.li); });
  const cur = Math.min(p.u, LEVELS.length - 1); S.li = cur; $('playL').textContent = `${t('levelL')} ${cur + 1} · ${t('n_' + LEVELS[cur].name)}`; }
function showLevelCard() { const el = $('lvCard'); if (isDuel()) { $('lcT').textContent = t('duelT'); $('lcG').innerHTML = ''; $('lcTip').textContent = t('duelInfo'); }
  else { $('lcT').textContent = `${t('levelL')} ${S.li + 1} · ${levelName()}`; $('lcG').innerHTML = goalsHTML(goalState(), true); $('lcTip').textContent = LV.tip ? t(LV.tip) : `${Number.isFinite(movesLeft()) ? movesLeft() + ' ' + t('movesL') : '∞'}`; }
  el.classList.add('show'); S.cardT = S.gt; }
function hideLevelCard() { $('lvCard').classList.remove('show'); }
function showEnd() { const duel = isDuel(), k = S.result; let title;
  if (duel) title = S.score[0] > S.score[1] ? t('duelWin1') : S.score[1] > S.score[0] ? t('duelWin2') : t('duelTie'); else title = k === 'win' ? t('win') : k === 'fail' ? t('fail') : t('quitT');
  $('eTitle').textContent = title; $('eLevel').textContent = duel ? t('duelT') : `${t('levelL')} ${S.li + 1} · ${levelName()}`;
  $('eScore').textContent = duel ? `${fmt(S.score[0])} : ${fmt(S.score[1])}` : fmt(S.score[0]);
  $('eStars').innerHTML = duel || k !== 'win' ? '' : [0, 1, 2].map(i => `<i class="${i < S.stars ? 'on' : ''}" style="animation-delay:${.6 + i * .45}s">★</i>`).join('');
  const p = prog(); $('eBest').textContent = duel ? '' : S.newBest ? '🏆 ' + t('newBest') : (p.b[S.li] ? `🏆 ${t('bestL')}: ${fmt(p.b[S.li])}` : (k === 'fail' ? t('failSub') : ''));
  const two = v => duel ? `${v[0]} : ${v[1]}` : `${v[0]}`; $('eStats').innerHTML = `<span>🔗 ${t('stBest')} <b>x${two(S.bestC)}</b></span><span>🌋 ${t('stErupt')} <b>${two(S.erupts)}</b></span><span>✨ ${t('stSpecial')} <b>${two(S.specials)}</b></span>`;
  $('btnNext').style.display = !duel && k === 'win' && S.li < LEVELS.length - 1 ? '' : 'none'; $('btnAgain').textContent = duel ? t('againD') : t('again'); $('eName').value = S.name; }
let popQ = 0; const _sp = new THREE.Vector3();
function popAt(txt, col, big, at) { if (S.state === 'intro' && !window.__cmIntroPops) return; (window.__pops = window.__pops || []).push(txt); let x = 0, y = 0; if (at) { _sp.copy(at).project(camera); if (_sp.z < 1) { x = clamp(_sp.x * .5 * VW, -VW * .38, VW * .38); y = clamp(-_sp.y * .5 * VH, -VH * .3, VH * .3); } } else y = -VH * .1;
  const now = performance.now(), delay = window.__cmManual ? 0 : Math.max(0, popQ - now); popQ = Math.max(now, popQ) + 120;
  setTimeout(() => { const el = document.createElement('div'); el.className = 'pop'; el.textContent = txt; el.style.color = col; el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.fontSize = (26 * big * (VW < 600 ? .8 : 1)) + 'px'; el.dataset.t0 = S.gt; $('pops').appendChild(el); const ps = $('pops').children; while (ps.length > 16) ps[0].remove(); }, delay); }
function banner(s) { if (!s) return; (window.__banners = window.__banners || []).push(s); const el = $('banner'); el.textContent = s; el.dataset.t0 = S.gt; el.classList.add('show'); }
function toast(s) { if (S.state !== 'play') return; const el = $('toast'); el.textContent = s; el.classList.add('show'); el.dataset.t0 = S.gt; }
function updateOverlays() { // CSS-free timing (follows game time, frame exact in the video)
  for (const el of [...$('pops').children]) { const k = (S.gt - +el.dataset.t0) / 1.3; if (k >= 1) { el.remove(); continue; } el.style.opacity = String(k < .1 ? k / .1 : 1 - smooth((k - .6) / .4)); el.style.transform = `translate(-50%,-50%) translateY(${-k * 70}px) scale(${k < .12 ? .6 + k / .12 * .5 : 1.1 - k * .1})`; }
  const b = $('banner'); if (b.classList.contains('show')) { const k = (S.gt - +b.dataset.t0) / 1.6; if (k >= 1) b.classList.remove('show'); else { b.style.opacity = String(k < .08 ? k / .08 : 1 - smooth((k - .7) / .3)); b.style.transform = `translate(-50%,-50%) scale(${k < .14 ? 1.9 - smooth(k / .14) * .9 : 1 + (k - .14) * .06})`; } }
  const ts = $('toast'); if (ts.classList.contains('show') && S.gt - +ts.dataset.t0 > 2.3) ts.classList.remove('show');
  if ($('lvCard').classList.contains('show') && S.gt - S.cardT > 2.6) hideLevelCard(); }
// ---------------- input ----------------
let isTouch = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })(), drag = null;
const ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -CANDY_Y), _hit = new THREE.Vector3();
function cellAt(px, py) { if (!B) return null; _ndc.set(px / VW * 2 - 1, -(py / VH) * 2 + 1); ray.setFromCamera(_ndc, camera); if (!ray.ray.intersectPlane(_pl, _hit)) return null;
  const fx = _hit.x / CELL + (B.w - 1) / 2, fz = _hit.z / CELL + (B.h - 1) / 2; const x = Math.round(fx), y = Math.round(fz); const ok = x >= 0 && y >= 0 && x < B.w && y < B.h && !B.hole[y * B.w + x]; return { x, y, i: y * B.w + x, fx, fz, ok }; }
function unlockAudio() { A.unlock(); setTimeout(audioBadge, 60); }
function audioBadge() { document.body.dataset.audio = A.state() === 'running' ? 'on' : 'locked'; }
function useBoost(kind, i) { const bi = { hammer: 0, broom: 1, shuffle: 2 }[kind]; if (!canMove() || isDuel()) return false; if (!S.kids && S.boosts[bi] <= 0) { toast(t('noBoost')); return false; }
  if (kind === 'shuffle') { if (!S.kids) S.boosts[bi]--; S.boostMode = null; S.lastMover = 0; doShuffle(); setUI(); return true; }
  if (i == null) { S.boostMode = S.boostMode === kind ? null : kind; toast(t('b_' + kind)); A.sfx.ui(); setUI(); return true; }
  const c = B.cells[i]; if (B.hole[i] || !c || c.t === 'i') return false; if (!S.kids) S.boosts[bi]--; S.boostMode = null; S.lastMover = 0; S.idleT = 0; S.hintMv = null; S.cascade = 0;
  let pre; if (kind === 'hammer') { pre = [[i, 0, false]]; A.sfx.hammer(pan(BD.X(B, i))); ring(cellWorld(i), '#ffd27a', 1.2); S.fovPunch = .3; }
  else { const y = BD.Y(B, i); pre = []; for (let x = 0; x < B.w; x++) pre.push([y * B.w + x, Math.abs(x - BD.X(B, i)) * .3, false]); A.sfx.broom(); beam(i, 'h', '#d8a0ff'); }
  setUI(); runPass({ pre, cascade: 1 }); return true; }
canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !isTouch) { isTouch = true; applyLang(); } unlockAudio(); e.preventDefault(); hideLevelCard();
  if (S.state !== 'play') return; const h = cellAt(e.clientX, e.clientY); if (!h || !h.ok) { S.sel = null; return; } S.kb = false; S.idleT = 0;
  if (S.boostMode) { useBoost(S.boostMode, h.i); return; }
  drag = { i: h.i, fx: h.fx, fz: h.fz, id: e.pointerId, done: false }; try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
  if (S.sel != null && BD.adjacent(B, S.sel, h.i) && canMove()) { const a = S.sel; S.sel = null; drag.done = true; trySwapCells(a, h.i); return; }
  if (canMove() && BD.swappable(B.cells[h.i])) { S.sel = h.i; A.sfx.pick(pan(h.x)); } });
canvas.addEventListener('pointermove', e => { ptr.set(e.clientX / VW * 2 - 1, -(e.clientY / VH) * 2 + 1); if (!drag || drag.done || e.pointerId !== drag.id) return; const h = cellAt(e.clientX, e.clientY); if (!h) return; const dx = h.fx - drag.fx, dz = h.fz - drag.fz;
  if (Math.max(Math.abs(dx), Math.abs(dz)) > .4) { drag.done = true; const x = BD.X(B, drag.i), y = BD.Y(B, drag.i); const nx = Math.abs(dx) > Math.abs(dz) ? x + Math.sign(dx) : x, ny = Math.abs(dx) > Math.abs(dz) ? y : y + Math.sign(dz);
    S.sel = null; if (nx >= 0 && ny >= 0 && nx < B.w && ny < B.h && canMove()) trySwapCells(drag.i, ny * B.w + nx); } });
canvas.addEventListener('pointerup', () => { drag = null; }); canvas.addEventListener('pointercancel', () => { drag = null; });
window.addEventListener('keydown', e => { if (e.target && e.target.tagName === 'INPUT') return; unlockAudio(); const k = e.code;
  if (S.state === 'intro' && k === 'Escape') { e.preventDefault(); endIntro(); return; }
  if (S.state === 'intro' && (k === 'Enter' || k === 'Space')) { e.preventDefault(); playNow(); return; }
  if (S.state === 'menu' && S.more && k === 'Escape') { S.more = false; setUI(); return; }
  if (S.state === 'play') { hideLevelCard(); const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] }[k];
    if (d) { e.preventDefault(); S.kb = true; S.idleT = 0; if (S.sel != null) { const a = S.sel, x = BD.X(B, a) + d[0], y = BD.Y(B, a) + d[1]; S.sel = null; if (x >= 0 && y >= 0 && x < B.w && y < B.h) { trySwapCells(a, y * B.w + x); S.cur = [x, y]; } } else { S.cur = [clamp(S.cur[0] + d[0], 0, B.w - 1), clamp(S.cur[1] + d[1], 0, B.h - 1)]; A.sfx.ui(); } return; }
    if ((k === 'Space' || k === 'Enter') && !e.repeat) { e.preventDefault(); S.kb = true; const i = S.cur[1] * B.w + S.cur[0]; if (S.boostMode) { useBoost(S.boostMode, i); return; } if (canMove() && BD.swappable(B.cells[i])) { S.sel = S.sel === i ? null : i; if (S.sel != null) A.sfx.pick(0); } return; }
    if (k === 'KeyH') { S.idleT = 99; return; } if (k === 'Digit1') { useBoost('hammer'); return; } if (k === 'Digit2') { useBoost('broom'); return; } if (k === 'Digit3') { useBoost('shuffle'); return; } }
  if (k === 'Escape') { if (S.state === 'play') { if (S.boostMode) { S.boostMode = null; setUI(); } else endRun('quit'); } else if (S.state === 'end') toMenu(); return; }
  if (S.state === 'menu' && k === 'Enter') start('level', S.li); });
$('btnPlay').onclick = () => start('level', S.li); $('btnDuel').onclick = () => start('duel');
$('btnAgain').onclick = () => start(S.mode, S.li); $('btnNext').onclick = () => start('level', S.li + 1); $('btnMenu').onclick = () => { A.sfx.ui(); toMenu(); };
$('btnQuit').onclick = () => { if (S.state === 'play') endRun('quit'); else if (S.state === 'end') toMenu(); };
$('btnCard').onclick = () => saveCard(false); $('btnShare').onclick = () => saveCard(true);
$('btnLang').onclick = () => { S.lang = S.lang === 'en' ? 'de' : 'en'; ls.set('cm-lang', S.lang); applyLang(); A.sfx.ui(); };
document.querySelectorAll('#diff button').forEach(b => b.onclick = () => { S.diff = b.dataset.d; ls.set('cm-diff', S.diff); applyLang(); A.unlock(); A.sfx.ui(); });
$('btnKids').onclick = () => { S.kids = !S.kids; ls.set('cm-kids', S.kids ? '1' : '0'); applyLang(); A.unlock(); A.sfx.ui(); };
$('btnSound').onclick = () => { A.unlock(); A.setMuted(!A.isMuted()); applyLang(); };
$('btnQ').onclick = () => { const o = ['low', 'mid', 'high', 'ultra']; applyQuality(o[(o.indexOf(S.q) + 1) % 4], true); };
$('bHammer').onclick = () => useBoost('hammer'); $('bBroom').onclick = () => useBoost('broom'); $('bShuffle').onclick = () => useBoost('shuffle'); $('bHint').onclick = () => { if (canMove()) { S.idleT = 99; A.sfx.ui(); } };
// ---- ONE TAP TO PLAY: the first tap/click anywhere on the opening goes straight into the level (sound unlocks on that same tap) ----
let eatClick = 0;
function playNow() { if (S.state !== 'intro') return; A.unlock(); setTimeout(audioBadge, 60); endIntro(); start('level', S.li); }
function introTap(e) { if (S.state !== 'intro' || (e.target && e.target.closest && e.target.closest('#top'))) return; if (e.pointerType === 'touch' && !isTouch) { isTouch = true; applyLang(); } eatClick = performance.now() + 450; playNow(); }
window.addEventListener('pointerup', introTap);
window.addEventListener('click', e => { if (performance.now() < eatClick) { e.stopPropagation(); e.preventDefault(); eatClick = 0; return; } introTap(e); }, true); // the same tap must not also hit a booster
for (const ev of ['touchend', 'click', 'keydown']) window.addEventListener(ev, () => A.unlock(), { capture: true, passive: true }); // iOS: resume audio inside a real user gesture
$('btnMore').onclick = () => { S.more = true; A.unlock(); A.sfx.ui(); setUI(); }; $('btnMoreX').onclick = $('moreBg').onclick = () => { S.more = false; A.sfx.ui(); setUI(); };
$('btnQ2').onclick = () => $('btnQ').onclick();
$('btnIntro').onclick = () => { A.unlock(); startIntro(); }; $('lvCard').onclick = hideLevelCard;
$('eName').addEventListener('keydown', e => e.stopPropagation());
window.addEventListener('resize', resize);
// ---------------- share card (1080×1350, no URL) ----------------
async function makeCard() {
  S.name = ($('eName').value || '').trim().slice(0, 18) || 'Player'; ls.set('cm-name', S.name); try { await document.fonts.load('700 40px Fredoka'); } catch (e) {}
  const CW = 1080, CH = 1350; renderer.setPixelRatio(1); renderer.setSize(CW, CH, false); composer.setPixelRatio(1); composer.setSize(CW, CH);
  const old = { a: camera.aspect, f: camera.fov, p: camera.position.clone(), q: camera.quaternion.clone() }; const hv = [selRing.visible, curRing.visible, ...hintRings.map(r => r.visible)]; selRing.visible = curRing.visible = hintRings[0].visible = hintRings[1].visible = false;
  camera.clearViewOffset(); camera.aspect = CW / CH; camera.fov = 50; camera.position.set(3.2, 10.5, 13.5); camera.lookAt(0, -.2, -1.2); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  updateWorld(W, S.gt, 0, QUALITY.high); composer.render();
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const k = c.getContext('2d'); k.drawImage(renderer.domElement, 0, 0, CW, CH);
  camera.aspect = old.a; camera.fov = old.f; camera.position.copy(old.p); camera.quaternion.copy(old.q); [selRing.visible, curRing.visible, hintRings[0].visible, hintRings[1].visible] = hv; resize();
  const gr = k.createLinearGradient(0, 0, 0, CH); gr.addColorStop(0, 'rgba(8,4,16,.92)'); gr.addColorStop(.2, 'rgba(8,4,16,.2)'); gr.addColorStop(.58, 'rgba(8,4,16,.08)'); gr.addColorStop(.72, 'rgba(8,4,16,.86)'); gr.addColorStop(1, 'rgba(8,4,16,.97)'); k.fillStyle = gr; k.fillRect(0, 0, CW, CH);
  const Fo = (w, s) => `${w} ${s}px Fredoka, "Arial Rounded MT Bold", sans-serif`; k.textAlign = 'center'; k.lineJoin = 'round';
  const txt = (s, x, y, fill, stroke = 'rgba(16,6,24,.9)', lw = 8) => { if (lw) { k.strokeStyle = stroke; k.lineWidth = lw; k.strokeText(s, x, y); } k.fillStyle = fill; k.fillText(s, x, y); };
  k.font = Fo(700, 96); txt('CAULDRON ERUPTION', CW / 2, 116, '#ffe2b0', 'rgba(60,20,4,.92)', 12);
  const duel = isDuel();
  if (duel) { k.font = Fo(700, 112); txt(`${fmt(S.score[0])} : ${fmt(S.score[1])}`, CW / 2, 1030, '#fff0c0', 'rgba(30,16,4,.9)', 14); k.font = Fo(600, 50); txt($('eTitle').textContent, CW / 2, 1100, '#ffb35a'); k.font = Fo(500, 34); txt(`${t('p1')} · ${t('p2')}`, CW / 2, 178, '#ffffff'); }
  else { k.font = Fo(600, 46); txt(`${t('levelL')} ${S.li + 1} · ${levelName()}`, CW / 2, 960, '#ffd0f0'); k.font = Fo(700, 150); txt(fmt(S.score[0]), CW / 2, 1100, '#fff0c0', 'rgba(30,16,4,.9)', 16);
    if (S.result === 'win') { k.font = Fo(700, 70); txt('★'.repeat(S.stars) + '☆'.repeat(3 - S.stars), CW / 2, 1180, '#ffcf4a', 'rgba(40,20,0,.9)', 8); } else { k.font = Fo(600, 46); txt($('eTitle').textContent, CW / 2, 1176, '#ffb35a'); }
    k.font = Fo(500, 34); txt(`${t('by')} ${S.name}`, CW / 2, 178, '#ffffff'); }
  const er = duel ? S.erupts[0] + S.erupts[1] : S.erupts[0]; if (er > 0) { k.save(); k.translate(CW - 170, 330); k.rotate(-.18); k.fillStyle = 'rgba(20,60,10,.9)'; k.strokeStyle = '#9aff6a'; k.lineWidth = 6; k.beginPath(); k.arc(0, 0, 116, 0, 7); k.fill(); k.stroke(); k.font = Fo(700, 58); txt('🌋', 0, -18, '#fff', 'rgba(0,0,0,0)', 0); k.font = Fo(700, 24); txt('ERUPTION', 0, 30, '#d8ffb0', 'rgba(0,0,0,0)', 0); k.font = Fo(700, 34); txt('x' + er, 0, 72, '#fff', 'rgba(0,0,0,0)', 0); k.restore(); }
  const two = v => duel ? `${v[0]}:${v[1]}` : `${v[0]}`;
  k.font = Fo(600, 34); txt(`${duel ? t('duelT') : S.kids ? t('kidsT') : t(S.diff)} · 🔗 x${two(S.bestC)} · ✨ ${two(S.specials)} · 🌋 ${two(S.erupts)}`, CW / 2, 1238, '#ffe08a');
  k.font = Fo(600, 40); txt(t('cardTag'), CW / 2, 1286, '#ffd0f0'); k.font = Fo(400, 30); txt(CREDIT_TXT, CW / 2, 1328, 'rgba(255,255,255,.92)');
  window.__cmCard = { w: c.width, h: c.height }; return c; }
async function saveCard(share) { const c = await makeCard(); const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'my-cauldron-eruption.png', { type: 'image/png' });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: `Cauldron Eruption · ${t('cardTag')}` }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my-cauldron-eruption.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast(t('saved')); }
// ---------------- simulation ----------------
let ambT = 2, owlT = 18;
function beds() { A.loop('cauldron_loop', .26 + W.boil * .22, .92 + W.boil * .1, 1.2); A.loop('torch_loop', .1, 1, 1.5); A.loop('night_loop', S.state === 'play' ? .05 : .09, 1, 1.5); }
function ambient(dt) { ambT -= dt; if (ambT <= 0) { ambT = .5 + rng() * 1.6 / (.6 + W.boil); A.sfx.bubble((rng() - .5) * 1.2); } owlT -= dt; if (owlT <= 0) { owlT = 22 + rng() * 25; if (S.state === 'menu' && rng() < .5) A.sfx.cackle(); else A.sfx.owl(); } }
function step(dt) {
  dt = Math.max(0, Math.min(fin(dt), 1 / 20)); // never step backwards, never jump
  S.ts = clamp(fin(S.ts, 1), .05, 1.6); const gdt = dt * S.ts; S.gt += gdt;
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i] && timers[i].t <= S.gt) { const f = timers[i].f; timers.splice(i, 1); f(); }
  for (const k of ['flash', 'gold', 'boil', 'glowPunch']) if (!Number.isFinite(W[k])) W[k] = k === 'boil' ? .3 : 0; // NaN guards
  for (const k of ['meter', 'fovPunch', 'camE', 'idleT']) if (!Number.isFinite(S[k])) S[k] = 0; for (const p of [0, 1]) if (!Number.isFinite(S.score[p])) S.score[p] = 0;
  music.step(S.gt); ambient(gdt); beds();
  if (S.state === 'intro') introStep(gdt);
  updateErupt(gdt);
  if (S.phase === 'fall') { S.fallT += gdt; if (piecesSettled() || S.fallT > 4) runPass(S.nextCtx); }
  if (S.phase === 'idle' && S.state === 'play') { S.idleT += dt; if (S.idleT > D().hint && !S.hintMv) { const mv = BD.findMoves(B, 30); S.hintMv = mv[0] || null; if (S.hintMv) A.sfx.hint(); } }
  if (S.state === 'end' || S.state === 'menu') { W.boil = lerp(W.boil, .3, dt); }
  updatePieces(gdt); updateFxs(gdt); updateGhoul(G, S.gt, gdt, camera.position); G.mouth = Math.max(0, G.mouth - gdt * 3);
  _m.set(0, 0, 0); updateFountain(FT, S.gt, gdt, G.up > .7 ? mouthWorld(G, _m) : null, onGulp);
  updateWorld(W, S.gt, gdt, QUALITY[S.q]); updateFX(F, gdt, VH * 1.5 * renderer.getPixelRatio());
  W.tray.position.y = Math.sin(S.gt * .8) * .04; W.tray.rotation.z = Math.sin(S.gt * .53) * .006; W.tray.rotation.x = Math.sin(S.gt * .41) * .006;
  updateCamera(dt); bloom.strength = .5 * QUALITY[S.q].bloom * (1 + W.glowPunch * .15); gradePass.uniforms.time.value = S.gt; gradePass.uniforms.flash.value = W.flash; gradePass.uniforms.gold.value = W.gold * .6;
  updateOverlays(); if ((S.uiT = (S.uiT || 0) + dt) > .1) { S.uiT = 0; setUI(); } }
const _m = new THREE.Vector3();
function render() { composer.render(); }
const fps = { n: 0, acc: 0, frames: 0, bad: 0, since: 0 };
function fpsTick(dt) { if (document.hidden) return; fps.since += dt; if (fps.since < 6 || dt > .25) return; fps.acc += dt; fps.frames++; // ignore the first 6 s (shader compile, decode): no false step-down at startup
  if (fps.acc >= 1) { const f = fps.frames / fps.acc; fps.acc = 0; fps.frames = 0; fps.n++; fps.bad = f < 32 ? fps.bad + 1 : 0; fps.last = f;
    if (!S.qUser && !window.__cmNoAutoQ && fps.bad >= 4 && S.q !== 'low') { const o = ['low', 'mid', 'high', 'ultra']; const nq = o[o.indexOf(S.q) - 1]; applyQuality(nq); toast(`${t('autoQ')} ${t('q_' + nq)} (${Math.round(f)} fps)`); fps.bad = 0; fps.since = 0; } } }
applyQuality(S.q); resize();
let last = performance.now();
function advance(now) { const dt = Math.max(0, (now - last) / 1000) || 0; last = Math.max(last, now || 0); if (!window.__cmManual) { step(dt); fpsTick(dt); } return dt; } // rAF stamps can be earlier than the last one: never run the clock backwards
function frameLoop(now) { advance(now); render(); requestAnimationFrame(frameLoop); }
if (window.__cmSkipIntro) { toMenu(); } else startIntro();
applyLang(); audioBadge();
step(0); requestAnimationFrame(frameLoop);
const cellOf = v => Array.isArray(v) ? v[1] * B.w + v[0] : v;
window.__cm = { S, W, G, FT, step: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); render(); }, stepq: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); }, log: A.log, quality: q => q ? applyQuality(q, true) : S.q, renderer,
  start, end: endRun, toMenu, startIntro, endIntro, board: () => B, BD, LEVELS, swap: (a, b) => trySwapCells(cellOf(a), cellOf(b)), canMove, moves: () => BD.findMoves(B), movesLeft: () => movesLeft(),
  setCells: rows => { // rows of tokens: digit = kind, h/v/b/g suffix = special, P = pumpkin, K = golden skull, '#' hole
    for (let y = 0; y < B.h; y++) { const toks = rows[y].trim().split(/\s+/); for (let x = 0; x < B.w; x++) { const i = y * B.w + x, s = toks[x]; if (B.hole[i]) continue; const old = B.cells[i]; const lock = old ? old.lock : 0;
      if (s === 'P') B.cells[i] = { id: B.nextId++, t: 'p', k: -1, sp: '', lock: 0, hp: 2 }; else if (s === 'K') B.cells[i] = { id: B.nextId++, t: 'i', k: -1, sp: '', lock: 0, hp: 0 }; else B.cells[i] = { id: B.nextId++, t: 'c', k: s[0] === 'g' ? 6 : +s[0], sp: s[0] === 'g' ? 'g' : (s[1] || ''), lock, hp: 0 }; } }
    for (const P of pieces.values()) W.tray.remove(P.g); pieces.clear(); for (const m of webM.values()) W.tray.remove(m.m); webM.clear(); for (let i = 0; i < B.n; i++) if (B.cells[i]) addPiece(B.cells[i], i); },
  settle: (max = 900) => { let i = 0; for (; i < max && S.phase !== 'idle' && S.phase !== 'over' && S.state === 'play'; i++) step(1 / 30); return S.phase; },
  fillMeter: v => { S.meter = v; }, erupt: () => { S.lastMover = S.player; S.meter = cap(); startErupt(); }, cap, goals: goalState, goalsDone, prog, stars: () => S.stars, boost: (k, c) => useBoost(k, c == null ? undefined : cellOf(c)),
  screen: v => { const i = cellOf(v); const p = cellWorld(i); W.tray.updateMatrixWorld(); p.applyMatrix4(W.tray.matrixWorld); _sp.copy(p).project(camera); return { x: (_sp.x * .5 + .5) * VW, y: (-_sp.y * .5 + .5) * VH, z: _sp.z }; }, cellAt: (x, y) => cellAt(x, y),
  cam: () => ({ p: camera.position.toArray(), fov: camera.fov }), fps, card: saveCard, cardURL: async () => (await makeCard()).toDataURL('image/jpeg', .9), sparks: () => { let n = 0; for (let i = 0; i < F.life.length; i++) if (F.life[i] > 0) n++; return n; },
  fpsTick, fountain: () => fountainCount(FT), pieces: () => pieces.size, advance, last: () => last, play: A.play, sfx: A.sfx, audioState: A.state, hint: () => S.hintMv, introPick: () => pickIntro(), setUI,
  _dbg: { scene, camera, composer, bloom, F, THREE, K, pieces, fit } };
document.body.classList.add('ready');
