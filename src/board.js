// Pure, deterministic match-3 engine (no rendering): runs, specials, fusions, obstacles, gravity, refill, hints, shuffle.
// cell = { id, t: 'c' candy | 'p' pumpkin blocker | 'i' golden skull item, k: kind 0..5 (6 = ghost), sp: '' | 'h' | 'v' | 'b' | 'b2' | 'g', lock: 0/1 cobweb, hp, r }
// Board layout chars: '.' cell  '#' hole (ghost tile)  's' slime  'S' double slime  'w' cobweb  'x' cobweb on slime  'p' pumpkin  'k' golden skull
export const GHOST = 6;
export const SCORE = { candy: 20, special: { h: 120, v: 120, b: 200, g: 400 }, pump: 60, pumpGone: 160, slime: 60, lock: 40, item: 500 };
export function createBoard(spec, rng) {
  const rows = spec.layout, h = rows.length, w = rows[0].length;
  const B = { w, h, n: w * h, rng, colors: spec.colors || 6, hole: new Uint8Array(w * h), slime: new Uint8Array(w * h), cells: new Array(w * h).fill(null), nextId: 1,
    itemsPending: Math.max(0, (spec.items || 0)), itemsMax: spec.itemsMax || 2, stats: { kinds: [0, 0, 0, 0, 0, 0], slime: 0, locks: 0, pumps: 0, items: 0, specials: 0, fusions: 0 } };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = rows[y][x] || '#', i = y * w + x;
    if (ch === '#' || ch === ' ') { B.hole[i] = 1; continue; }
    if (ch === 's' || ch === 'x') B.slime[i] = 1; if (ch === 'S') B.slime[i] = 2;
    if (ch === 'p') B.cells[i] = { id: B.nextId++, t: 'p', k: -1, sp: '', lock: 0, hp: 2 };
    else if (ch === 'k') { B.cells[i] = { id: B.nextId++, t: 'i', k: -1, sp: '', lock: 0, hp: 0 }; B.itemsPending = Math.max(0, B.itemsPending - 1); }
    else if (ch === 'w' || ch === 'x') B.cells[i] = { id: B.nextId++, t: 'c', k: -1, sp: '', lock: 1, hp: 0 }; }
  B.itemsTotal = (spec.items || 0);
  fillFresh(B); let guard = 0; while (!findMoves(B, 1).length && guard++ < 50) { for (let i = 0; i < B.n; i++) { const c = B.cells[i]; if (c && c.t === 'c' && !c.sp) c.k = -1; } fillFresh(B); }
  return B;
}
// seeded RNG with copyable state (so a board can be simulated ahead exactly, e.g. for the intro)
export function mkRng(s) { const f = () => { f.s = (f.s + 0x6D2B79F5) >>> 0; let t = f.s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; f.s = s >>> 0; return f; }
export function cloneBoard(B) { const C = { ...B, hole: B.hole.slice(), slime: B.slime.slice(), cells: B.cells.map(c => c ? { ...c } : null), stats: { ...B.stats, kinds: B.stats.kinds.slice() } }; C.rng = B.rng.s !== undefined ? mkRng(B.rng.s) : B.rng; return C; }
export const X = (B, i) => i % B.w, Y = (B, i) => (i / B.w) | 0;
const inb = (B, x, y) => x >= 0 && y >= 0 && x < B.w && y < B.h;
const at = (B, x, y) => inb(B, x, y) && !B.hole[y * B.w + x] ? B.cells[y * B.w + x] : null;
export const swappable = c => !!c && (c.t === 'c' || c.t === 'i') && !c.lock;
export const matchable = c => !!c && c.t === 'c' && c.sp !== 'g' && c.k >= 0 && c.k < GHOST;
export const fixed = c => !!c && (c.t === 'p' || c.lock === 1);
export const isSpecial = c => !!c && c.t === 'c' && !!c.sp;
function pickKind(B, x, y) { const bad = new Set();
  const k = (dx, dy) => { const c = at(B, x + dx, y + dy); return matchable(c) ? c.k : -9; };
  if (k(-1, 0) === k(-2, 0) && k(-1, 0) >= 0) bad.add(k(-1, 0)); if (k(0, -1) === k(0, -2) && k(0, -1) >= 0) bad.add(k(0, -1));
  if (k(1, 0) === k(2, 0) && k(1, 0) >= 0) bad.add(k(1, 0)); if (k(0, 1) === k(0, 2) && k(0, 1) >= 0) bad.add(k(0, 1));
  if (k(-1, 0) === k(1, 0) && k(1, 0) >= 0) bad.add(k(1, 0)); if (k(0, -1) === k(0, 1) && k(0, 1) >= 0) bad.add(k(0, 1));
  const ok = []; for (let q = 0; q < B.colors; q++) if (!bad.has(q)) ok.push(q); const L = ok.length ? ok : [0, 1, 2, 3, 4, 5].slice(0, B.colors); return L[Math.floor(B.rng() * L.length)]; }
function fillFresh(B) { for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) { const i = y * B.w + x; if (B.hole[i]) continue; let c = B.cells[i];
  if (!c) c = B.cells[i] = { id: B.nextId++, t: 'c', k: -1, sp: '', lock: 0, hp: 0 }; if (c.t === 'c' && c.k < 0) c.k = pickKind(B, x, y); } }
// ---- runs and groups ----
export function findRuns(B) { const runs = [];
  for (let y = 0; y < B.h; y++) { let x = 0; while (x < B.w) { const c = at(B, x, y); if (!matchable(c)) { x++; continue; } let e = x + 1; while (e < B.w && matchable(at(B, e, y)) && at(B, e, y).k === c.k) e++;
      if (e - x >= 3) { const cells = []; for (let q = x; q < e; q++) cells.push(y * B.w + q); runs.push({ dir: 'h', k: c.k, cells }); } x = e; } }
  for (let x = 0; x < B.w; x++) { let y = 0; while (y < B.h) { const c = at(B, x, y); if (!matchable(c)) { y++; continue; } let e = y + 1; while (e < B.h && matchable(at(B, x, e)) && at(B, x, e).k === c.k) e++;
      if (e - y >= 3) { const cells = []; for (let q = y; q < e; q++) cells.push(q * B.w + x); runs.push({ dir: 'v', k: c.k, cells }); } y = e; } }
  return runs; }
export function findGroups(B) { const runs = findRuns(B); const par = runs.map((_, i) => i); const f = i => par[i] === i ? i : (par[i] = f(par[i]));
  const owner = new Map(); runs.forEach((r, ri) => r.cells.forEach(c => { if (owner.has(c)) par[f(ri)] = f(owner.get(c)); else owner.set(c, ri); }));
  const G = new Map(); runs.forEach((r, ri) => { const g = f(ri); if (!G.has(g)) G.set(g, { k: r.k, runs: [], cells: new Set() }); const o = G.get(g); o.runs.push(r); r.cells.forEach(c => o.cells.add(c)); });
  return [...G.values()].map(g => ({ k: g.k, runs: g.runs, cells: [...g.cells], maxLen: Math.max(...g.runs.map(r => r.cells.length)), hv: g.runs.some(r => r.dir === 'h') && g.runs.some(r => r.dir === 'v') })); }
// ---- one resolve pass: clears + specials + obstacles, then gravity + refill ----
// ctx: { pre: [[i, depth, noTrigger]], swap: [a, b], cascade, erupt, convert }
export function resolvePass(B, ctx = {}) {
  const groups = ctx.erupt ? [] : findGroups(B);
  const armed = []; for (let i = 0; i < B.n; i++) { const c = B.cells[i]; if (c && c.sp === 'b2' && !c.fresh && !ctx.erupt) armed.push(i); if (c) c.fresh = false; }
  if (!groups.length && !(ctx.pre && ctx.pre.length) && !armed.length && !ctx.erupt) return null;
  const ev = { cleared: [], created: [], armed: [], pumps: [], locks: [], slime: [], blasts: [], moves: [], spawns: [], collected: [], score: 0, groups: [], cascade: ctx.cascade || 1, erupt: !!ctx.erupt, ghostClears: [] };
  const clear = new Map(), triggered = new Set(), pumpHit = new Set(), keep = new Set(), noTrig = new Set();
  const Q = [];
  const hit = (i, d, nt) => { if (i < 0 || i >= B.n || B.hole[i]) return; const c = B.cells[i]; if (!c) return;
    if (c.t === 'p') { if (!pumpHit.has(i)) { pumpHit.add(i); ev.pumps.push({ i, id: c.id, d }); } return; }
    if (c.t === 'i' || keep.has(i)) return;
    if (clear.has(i) && !(c.sp && !triggered.has(i))) return;
    if (!clear.has(i)) clear.set(i, d);
    if (nt) noTrig.add(i);
    if (c.sp && !triggered.has(i) && !noTrig.has(i)) { triggered.add(i); Q.push([i, d]); } };
  // special creation from groups first (so their cells are kept)
  for (const g of groups) { let sp = ''; if (g.maxLen >= 5) sp = 'g'; else if (g.hv) sp = 'b'; else if (g.maxLen === 4) sp = g.runs.find(r => r.cells.length === 4).dir === 'h' ? 'v' : 'h';
    ev.groups.push({ k: g.k, cells: g.cells.slice(), len: g.cells.length });
    if (sp) { let pos = -1; if (ctx.swap) for (const s of ctx.swap) if (g.cells.includes(s) && !B.cells[s].sp) pos = s;
      if (pos < 0) { const lr = g.runs.reduce((a, r) => r.cells.length > a.cells.length ? r : a); if (g.hv) { const inter = g.cells.filter(c => g.runs.filter(r => r.cells.includes(c)).length > 1); pos = inter.find(c => !B.cells[c].sp) ?? -1; }
        if (pos < 0) { const m = lr.cells[Math.floor((lr.cells.length - 1) / 2)]; pos = !B.cells[m].sp ? m : (g.cells.find(c => !B.cells[c].sp) ?? -1); } }
      if (pos >= 0) { keep.add(pos); ev.created.push({ i: pos, id: B.cells[pos].id, sp, k: sp === 'g' ? GHOST : g.k }); ev.score += SCORE.special[sp]; B.stats.specials++; } }
    for (const c of g.cells) { const x = X(B, c), y = Y(B, c); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = at(B, x + dx, y + dy); if (n && n.t === 'p') hit((y + dy) * B.w + x + dx, 0); } } }
  for (const g of groups) for (const c of g.cells) if (!keep.has(c)) hit(c, 0); else { if (B.cells[c].lock) { ev.locks.push({ i: c, id: B.cells[c].id }); B.cells[c].lock = 0; B.stats.locks++; ev.score += SCORE.lock; } if (B.slime[c]) { B.slime[c]--; ev.slime.push({ i: c, v: B.slime[c] }); ev.score += SCORE.slime; } }
  if (ctx.pre) for (const [i, d, nt] of ctx.pre) hit(i, d || 0, nt);
  for (const i of armed) { const c = B.cells[i]; if (clear.has(i)) continue; triggered.add(i); clear.set(i, 0); Q.push([i, 0]); }
  if (ctx.erupt) for (let i = 0; i < B.n; i++) hit(i, Math.floor(Math.hypot(X(B, i) - (B.w - 1) / 2, Y(B, i) - (B.h - 1) / 2) * .6), true);
  // trigger chain (breadth first, depth = stagger for the animation)
  while (Q.length) { const [i, d] = Q.shift(); const c = B.cells[i]; const x = X(B, i), y = Y(B, i), D = d + 1;
    if (c.sp === 'h') { ev.blasts.push({ i, type: 'h', d }); for (let q = 0; q < B.w; q++) hit(y * B.w + q, D + Math.abs(q - x) * .25); }
    else if (c.sp === 'v') { ev.blasts.push({ i, type: 'v', d }); for (let q = 0; q < B.h; q++) hit(q * B.w + x, D + Math.abs(q - y) * .25); }
    else if (c.sp === 'b' || c.sp === 'b2') { const r = c.r || 1; ev.blasts.push({ i, type: c.sp, d, r }); for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (inb(B, x + xx, y + yy)) hit((y + yy) * B.w + x + xx, D);
      if (c.sp === 'b') { clear.delete(i); ev.armed.push({ i, id: c.id }); } }
    else if (c.sp === 'g') { const k = mostCommon(B, i); ev.blasts.push({ i, type: 'g', d, k }); for (let q = 0; q < B.n; q++) { const o = B.cells[q]; if (matchable(o) && o.k === k) { ev.ghostClears.push(q); hit(q, D + .5); } } } }
  // apply clears
  for (const [i, d] of clear) { const c = B.cells[i]; if (!c) continue;
    if (c.lock) { ev.locks.push({ i, id: c.id }); c.lock = 0; B.stats.locks++; ev.score += SCORE.lock; }
    if (B.slime[i]) { B.slime[i]--; ev.slime.push({ i, v: B.slime[i] }); ev.score += SCORE.slime; }
    ev.cleared.push({ i, id: c.id, k: c.k, sp: c.sp, d }); if (c.k >= 0 && c.k < GHOST) B.stats.kinds[c.k]++; ev.score += SCORE.candy * ev.cascade; B.cells[i] = null; }
  for (const p of ev.pumps) { const c = B.cells[p.i]; c.hp--; p.hp = c.hp; ev.score += SCORE.pump; if (c.hp <= 0) { B.cells[p.i] = null; B.stats.pumps++; ev.score += SCORE.pumpGone; } }
  for (const a of ev.armed) { const c = B.cells[a.i]; if (c) { c.sp = 'b2'; } }
  for (const cr of ev.created) { const c = B.cells[cr.i]; if (c) { c.sp = cr.sp; c.k = cr.k; c.lock = 0; } }
  gravity(B, ev);
  return ev;
}
function mostCommon(B, not) { const n = new Array(GHOST).fill(0); for (let q = 0; q < B.n; q++) { const o = B.cells[q]; if (q !== not && matchable(o)) n[o.k]++; } let b = 0; for (let k = 1; k < GHOST; k++) if (n[k] > n[b]) b = k; return b; }
// column slots: playable, not fixed (fixed cells and holes are passed through)
function slots(B, x) { const s = []; for (let y = B.h - 1; y >= 0; y--) { const i = y * B.w + x; if (!B.hole[i] && !fixed(B.cells[i])) s.push(i); } return s; }
export function gravity(B, ev) { const moved = new Map();
  for (let loop = 0; loop < 6; loop++) { let changed = false; const where = new Map(); for (let i = 0; i < B.n; i++) if (B.cells[i]) where.set(B.cells[i], i);
    for (let x = 0; x < B.w; x++) { const S = slots(B, x); const items = S.map(i => B.cells[i]).filter(Boolean); let spawnN = 0;
      for (let q = 0; q < S.length; q++) { const i = S[q]; const c = items[q];
        if (c) { if (B.cells[i] !== c) { const from = moved.has(c.id) ? moved.get(c.id).from : where.get(c); moved.set(c.id, { id: c.id, from, to: i }); changed = true; } B.cells[i] = c; }
        else { const nc = spawnCell(B); B.cells[i] = nc; ev.spawns.push({ id: nc.id, to: i, k: nc.k, t: nc.t, h: spawnN++, col: x, loop }); changed = true; } }
      // golden skulls are collected at the bottom of their column
      const bot = S[0]; const c0 = bot != null ? B.cells[bot] : null; if (c0 && c0.t === 'i') { ev.collected.push({ id: c0.id, i: bot }); B.cells[bot] = null; B.stats.items++; ev.score += SCORE.item; changed = true; } }
    if (!changed) break; let empty = false; for (let i = 0; i < B.n; i++) if (!B.hole[i] && !B.cells[i]) empty = true; if (!empty) break; }
  // spawn records: final position (a spawned cell can move again in a later loop)
  const pos = new Map(); for (let i = 0; i < B.n; i++) if (B.cells[i]) pos.set(B.cells[i].id, i);
  for (const s of ev.spawns) { if (pos.has(s.id)) s.to = pos.get(s.id); else s.gone = true; moved.delete(s.id); }
  for (const m of moved.values()) { if (pos.has(m.id)) m.to = pos.get(m.id); else m.gone = true; ev.moves.push(m); } }
function spawnCell(B) { let itemsOn = 0; for (const c of B.cells) if (c && c.t === 'i') itemsOn++;
  if (B.itemsPending > 0 && itemsOn < B.itemsMax && B.rng() < .12) { B.itemsPending--; return { id: B.nextId++, t: 'i', k: -1, sp: '', lock: 0, hp: 0 }; }
  return { id: B.nextId++, t: 'c', k: Math.floor(B.rng() * B.colors), sp: '', lock: 0, hp: 0 }; }
// ---- swaps ----
export function adjacent(B, a, b) { return Math.abs(X(B, a) - X(B, b)) + Math.abs(Y(B, a) - Y(B, b)) === 1; }
// returns { ok, pre, fuse, erupt } and leaves the board swapped when ok
export function trySwap(B, a, b) {
  if (a == null || b == null || a === b || !adjacent(B, a, b) || B.hole[a] || B.hole[b]) return { ok: false, why: 'far' };
  const A = B.cells[a], C = B.cells[b]; if (!swappable(A) || !swappable(C)) return { ok: false, why: 'locked' };
  B.cells[a] = C; B.cells[b] = A;
  const fu = fusion(B, b, a); if (fu) { B.stats.fusions += fu.fuse ? 1 : 0; return { ok: true, ...fu }; }
  const g = findGroups(B); if (g.some(G => G.cells.includes(a) || G.cells.includes(b))) return { ok: true, swap: [a, b] };
  B.cells[a] = A; B.cells[b] = C; return { ok: false, why: 'nomatch' }; }
// after the swap: cell at `to` is the moved one (from `from`)
function fusion(B, to, from) { const P = B.cells[to], Q = B.cells[from]; if (!P || !Q || P.t !== 'c' || Q.t !== 'c') return null;
  const a = P.sp, b = Q.sp; const isG = s => s === 'g', isL = s => s === 'h' || s === 'v', isB = s => s === 'b' || s === 'b2';
  const x = X(B, to), y = Y(B, to), pre = [], add = (i, d, nt = false) => pre.push([i, d, nt]);
  const rowCol = (yy, xx, d) => { if (yy >= 0 && yy < B.h) for (let q = 0; q < B.w; q++) add(yy * B.w + q, d + Math.abs(q - x) * .2); if (xx >= 0 && xx < B.w) for (let q = 0; q < B.h; q++) add(q * B.w + xx, d + Math.abs(q - y) * .2); };
  if (isG(a) && isG(b)) { for (let i = 0; i < B.n; i++) add(i, Math.hypot(X(B, i) - x, Y(B, i) - y) * .35, true); return { pre, fuse: 'gg', erupt: true, at: to }; }
  if (isG(a) || isG(b)) { const gi = isG(a) ? to : from, oi = isG(a) ? from : to, o = B.cells[oi]; const k = o.k; add(gi, 0, true);
    const conv = []; for (let i = 0; i < B.n; i++) { const c = B.cells[i]; if (matchable(c) && c.k === k) { conv.push(i); } }
    if (o.sp && o.sp !== 'g') { for (const i of conv) { const c = B.cells[i]; c.sp = isB(o.sp) ? 'b' : (B.rng() < .5 ? 'h' : 'v'); } return { pre: [[gi, 0, true]].concat(conv.map((i, q) => [i, 1 + q * .12, false])), fuse: 'g' + (isB(o.sp) ? 'b' : 'l'), conv: conv.map(i => ({ i, sp: B.cells[i].sp })), at: gi, k }; }
    for (const i of conv) add(i, 1 + Math.hypot(X(B, i) - X(B, gi), Y(B, i) - Y(B, gi)) * .15); return { pre, fuse: '', ghost: true, at: gi, k }; }
  if (isL(a) && isL(b)) { add(to, 0, true); add(from, 0, true); rowCol(y, x, 1); return { pre, fuse: 'll', at: to }; }
  if ((isL(a) && isB(b)) || (isB(a) && isL(b))) { add(to, 0, true); add(from, 0, true); for (let d = -1; d <= 1; d++) rowCol(y + d, x + d, 1); return { pre, fuse: 'lb', at: to }; }
  if (isB(a) && isB(b)) { add(from, 0, true); for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) if (inb(B, x + xx, y + yy) && (yy || xx)) add((y + yy) * B.w + x + xx, 1);
    P.sp = 'b2'; P.r = 2; P.fresh = true; return { pre, fuse: 'bb', at: to }; }
  return null; }
// ---- hints / shuffle ----
export function findMoves(B, limit = 99) { const out = [];
  for (let i = 0; i < B.n && out.length < limit; i++) for (const j of [i + 1, i + B.w]) { if (j >= B.n || (j === i + 1 && X(B, j) === 0)) continue;
    const A = B.cells[i], C = B.cells[j]; if (B.hole[i] || B.hole[j] || !swappable(A) || !swappable(C)) continue;
    if ((isSpecial(A) && isSpecial(C)) || A.sp === 'g' || C.sp === 'g') { out.push({ a: i, b: j, v: 30 + (A.sp === 'g' && C.sp === 'g' ? 50 : 0) }); continue; }
    B.cells[i] = C; B.cells[j] = A; const g = findGroups(B).filter(G => G.cells.includes(i) || G.cells.includes(j)); B.cells[i] = A; B.cells[j] = C;
    if (g.length) { let v = 0; for (const G of g) v += G.cells.length + (G.maxLen >= 5 ? 12 : G.hv ? 8 : G.maxLen === 4 ? 5 : 0) + G.cells.filter(c => B.slime[c]).length * .6; out.push({ a: i, b: j, v }); } }
  return out.sort((p, q) => q.v - p.v); }
export function shuffle(B) { const idx = []; for (let i = 0; i < B.n; i++) if (B.cells[i] && B.cells[i].t === 'c' && !B.cells[i].lock) idx.push(i);
  const before = new Map(idx.map(i => [B.cells[i].id, i]));
  for (let tries = 0; tries < 300; tries++) { const pool = idx.map(i => B.cells[i]); for (let q = pool.length - 1; q > 0; q--) { const r = Math.floor(B.rng() * (q + 1)); [pool[q], pool[r]] = [pool[r], pool[q]]; }
    idx.forEach((i, q) => B.cells[i] = pool[q]); if (!findRuns(B).length && findMoves(B, 1).length) break;
    if (tries > 200) for (const i of idx) if (!B.cells[i].sp) B.cells[i].k = Math.floor(B.rng() * B.colors); }
  return idx.map(i => ({ id: B.cells[i].id, from: before.get(B.cells[i].id), to: i })); }
export const counts = B => { let slime = 0, locks = 0, pumps = 0, itemsOn = 0; for (let i = 0; i < B.n; i++) { if (B.hole[i]) continue; slime += B.slime[i]; const c = B.cells[i]; if (c) { if (c.lock) locks++; if (c.t === 'p') pumps++; if (c.t === 'i') itemsOn++; } } return { slime, locks, pumps, itemsOn }; };
