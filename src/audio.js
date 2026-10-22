// WebAudio for the embedded CC0 recordings (window.CM_SOUNDS): crunchy hard candy, chocolate bites, wrapper crinkles,
// gummy squishes and slime, potion bubbles, a deep monster roar and swallow, booms, fireworks, bells, choir, witches'
// cackles and a real pipe organ, pizzicato, harp, contrabass and timpani (VSCO 2 CE). Nothing is synthesized: pitched
// instruments re-pitch the nearest recorded note; the kitchen echo is a generated convolution reverb (processing only).
// Every sound (and every loop level change) is logged so tests and the video mix can replay it exactly.
let ctx = null, master = null, dry = null, conv = null, bufs = {}, ready = false, muted = false; const loops = {};
export const log = [];
let clock = () => 0;
export function setClock(f) { clock = f; }
function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
export const INS = {
  org: Object.fromEntries([48, 51, 54, 57, 60, 63, 66, 69, 72, 75].map(m => [m, m])),
  ped: Object.fromEntries([24, 27, 30, 33, 36, 39, 42].map(m => [m, m])),
  pz: { D3: 50, A3: 57, C4: 60, E4: 64, G4: 67, D5: 74 },
  cb: { E1: 28, Fs1: 30, A1: 33, Cs2: 37, E2: 40 },
  hp: { D4: 62, A4: 69 }
};
const SORTED = Object.fromEntries(Object.entries(INS).map(([k, v]) => [k, Object.entries(v).sort((a, b) => a[1] - b[1])]));
export function sampleFor(ins, m) { const L = SORTED[ins]; let best = L[0]; for (const e of L) if (Math.abs(e[1] - m) < Math.abs(best[1] - m)) best = e; return { n: ins + '_' + best[0], r: Math.pow(2, (m - best[1]) / 12) }; }
function makeIR(sec = 3.2) { const sr = ctx.sampleRate, n = Math.floor(sr * sec), ir = ctx.createBuffer(2, n, sr); let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const t = i / sr; lp += (rnd() - lp) * (.5 - .38 * t / sec); d[i] = lp * Math.exp(-t * 1.9) * (i < sr * .02 ? i / (sr * .02) : 1); } } return ir; }
function kick() { try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {} } // a silent sample inside the gesture unlocks iOS Safari
export function state() { return ctx ? ctx.state : 'none'; }
export function isReady() { return ready; }
export async function unlock() {
  if (ctx) { if (ctx.state !== 'running') { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); kick(); } return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} // iOS 17+: play even with the ring/silent switch on silent
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : .9; if (ctx.state !== 'running') { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); } kick();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .2; master.connect(comp); comp.connect(ctx.destination);
  dry = ctx.createGain(); dry.connect(master); conv = ctx.createConvolver(); conv.buffer = makeIR(); const wet = ctx.createGain(); wet.gain.value = .32; conv.connect(wet); wet.connect(master);
  const src = window.CM_SOUNDS || {};
  // base64 → bytes is synchronous: do it a few sounds per tick so the first tap never freezes a frame (beds and loops first)
  const keys = Object.keys(src).sort((a, b) => (b.endsWith('_loop') || b === 'wind') - (a.endsWith('_loop') || a === 'wind')); const jobs = [];
  for (let i = 0; i < keys.length; i += 4) { for (const k of keys.slice(i, i + 4)) jobs.push(new Promise(res => { try { ctx.decodeAudioData(b64(src[k]), b => { bufs[k] = b; res(); }, () => res()); } catch (e) { res(); } })); await new Promise(r => setTimeout(r, 0)); }
  await Promise.all(jobs);
  ready = true; window.__cmAudioReady = Object.keys(bufs).length; for (const k in loops) startLoop(k);
}
export function play(n, vol = 1, rate = 1, delay = 0, rev = .4, dur = 0, pan = 0) {
  if (!Number.isFinite(vol)) vol = 0; if (!Number.isFinite(rate) || rate <= 0) rate = 1; if (!Number.isFinite(delay)) delay = 0; if (!Number.isFinite(rev)) rev = 0; if (!Number.isFinite(dur)) dur = 0; if (!Number.isFinite(pan)) pan = 0;
  delay = Math.max(0, delay); log.push({ n, t: clock() + delay, v: vol, r: rate, rv: rev, d: dur, p: pan });
  if (log.length > 8000) log.splice(0, 1500);
  if (!ready || !bufs[n] || !(vol > 0)) return null;
  const s = ctx.createBufferSource(); s.buffer = bufs[n]; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol; s.connect(g); let out = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
  out.connect(dry); if (rev > 0) { const sg = ctx.createGain(); sg.gain.value = rev; out.connect(sg); sg.connect(conv); }
  const t0 = ctx.currentTime + delay; s.start(t0);
  if (dur > 0) { g.gain.setValueAtTime(vol, t0 + dur); g.gain.exponentialRampToValueAtTime(.0008, t0 + dur + .4); s.stop(t0 + dur + .45); }
  return s;
}
export function note(ins, m, vol = .7, dur = 0, delay = 0, rev = .4, pan = 0) { const { n, r } = sampleFor(ins, m); return play(n, vol, r, delay, rev, dur, pan); }
// looping beds (rain, coil buzz, bubbling, mob): level/rate changes are logged as '~name'
function startLoop(k) { const L = loops[k]; if (!ready || L.src || !bufs[k]) return; L.g = ctx.createGain(); L.g.gain.value = L.v; L.src = ctx.createBufferSource(); L.src.buffer = bufs[k]; L.src.loop = true; L.src.playbackRate.value = L.r; L.src.connect(L.g); L.g.connect(dry); const sg = ctx.createGain(); sg.gain.value = .25; L.g.connect(sg); sg.connect(conv); L.src.start(); }
export function loop(k, v, r = 1, fade = .4) {
  if (!Number.isFinite(v)) v = 0; if (!Number.isFinite(r) || r <= 0) r = 1; if (!Number.isFinite(fade)) fade = .4;
  const L = loops[k] || (loops[k] = { v: 0, r: 1 }); if (Math.abs(L.v - v) < .004 && Math.abs(L.r - r) < .004) return; L.v = v; L.r = r;
  log.push({ n: '~' + k, t: clock(), v, r, f: fade }); startLoop(k);
  if (L.g) { const t = ctx.currentTime; L.g.gain.cancelScheduledValues(t); L.g.gain.setValueAtTime(L.g.gain.value, t); L.g.gain.linearRampToValueAtTime(v, t + fade); L.src.playbackRate.setTargetAtTime(r, t, .15); }
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : .9; }
export function isMuted() { return muted; }
const R = Math.random, rr = a => a[Math.floor(R() * a.length)], jit = (k = .06) => 1 + (R() - .5) * 2 * k;
const PENTA = [50, 53, 55, 57, 60, 62, 65, 67, 69, 72, 74, 77, 79, 81, 84];
const POP = [['crunch', .5, 'wrapper', .1], ['bite', .55], ['slime', .5], ['crunch_b', .5], ['bite_b', .55], ['slime_b', .5]];
let landN = 0, landT = -1;
export const sfx = {
  ui() { play('knock', .22, 1.0, 0, .15); },
  pick(pan = 0) { play('plop', .22, 1.15 * jit(), 0, .2, 0, pan); },
  swap(pan = 0) { play('whoosh', .22, .85 * jit(), 0, .25, 0, pan); play('plop', .16, .95 * jit(), .06, .2, 0, pan); },
  bad(pan = 0) { play('thud_a', .4, .9 * jit(), 0, .3, 0, pan); play('slime', .22, .75, .02, .3, 0, pan); },
  pop(k, cas = 1, pan = 0, delay = 0) { const P = POP[k] || ['ghosts', .4]; const r = Math.min(1.25, (.92 + cas * .03) * jit(.07)); play(P[0], P[1], r, delay, .3, 0, pan); if (P[2] && R() < .5) play(P[2], P[3], .8, delay, .2, 0, pan); },
  ladder(cas) { const i = Math.min(PENTA.length - 1, 3 + (cas - 1) * 2); note('pz', PENTA[i], .32, 0, 0, .5); note('hp', PENTA[i] + 12, .2, 0, .03, .6); if (cas >= 3) note('org', PENTA[Math.max(0, i - 5)], .16, 1.2, 0, .6); if (cas >= 5) play('bell_strike', .25, .9 + cas * .02, .05, .6); },
  land(k, pan = 0) { const t = clock(); if (t - landT > .045) { landT = t; landN = 0; } if (landN++ > 2) return; play('plop', Math.min(.3, .08 + k * .1), .72 * jit(.1), 0, .15, 0, pan); },
  special(sp, pan = 0) { play('magic', .4, sp === 'g' ? .8 : 1, 0, .5, 0, pan); play('harp', .3, 1, .02, .6, 0, pan); [62, 65, 69].forEach((m, i) => note('org', m, .14, 1, i * .03, .6));
    if (sp === 'g') { play('choir_ah', .35, 1, .05, .7); play('ghosts', .3, 1.05, .1, .6, 1.2); } if (sp === 'b') play('wrapper', .3, .75, 0, .3, 0, pan); },
  stripe(pan = 0) { play('fwoosh', .5, .85 * jit(), 0, .35, 0, pan); play('whoosh', .35, .7, 0, .3, 0, pan); play('crack', .25, .75, .02, .4, 0, pan); },
  bomb(pan = 0) { play('boom', .65, .95 * jit(), 0, .45, 0, pan); play('sub', .45, 1, 0, .2); play('wrapper', .28, .7, 0, .25, 0, pan); play('splat', .3, .8, .02, .3, 0, pan); },
  ghostFire() { play('ghosts', .55, 1, 0, .6, 1.8); play('boo', .35, .85, .05, .55); play('glissup', .3, .9, 0, .5); play('choir_swell', .35, 1, .05, .7); },
  fusion() { play('boom_cine', .85, 1, 0, .45); play('hit_dram', .6, .9, 0, .5); play('gong', .35, .8, .03, .6); play('sub', .7, 1, 0, .2); play('fw_burst', .4, .9, .05, .5); },
  pump(gone, pan = 0) { if (gone) { play('splat', .6, .8 * jit(), 0, .35, 0, pan); play('crumble', .4, .9, .02, .35, 0, pan); play('thump_b', .45, .8, 0, .3, 0, pan); } else { play('thump', .5, .85 * jit(), 0, .3, 0, pan); play('crack', .4, .7, .01, .35, 0, pan); } },
  web(pan = 0) { play('wrapper', .32, .62 * jit(), 0, .3, 0, pan); play('whisper', .12, 1.1, .02, .5, 0, pan); },
  slime(pan = 0) { play('goo', .3, 1.05 * jit(), 0, .3, 0, pan); },
  item(pan = 0) { play('bell_strike', .45, 1, 0, .6, 0, pan); play('magic', .35, 1.1, .03, .5, 0, pan); play('harp', .3, 1, .06, .6, 0, pan); },
  callout(lv) { if (lv >= 3) { play('cackle', .5, .95, 0, .55); play('choir_swell', .4, 1, 0, .7); play('tproll', .25, 1, 0, .5, 1); } else if (lv === 2) { play('choir_ah', .35, 1, 0, .7); play('bell_strike', .25, 1.1, .05, .6); } else play('choir_ah', .22, 1.1, 0, .6, 1.2); },
  meterFull() { play('riser', .5, 1, 0, .5); play('rumble', .5, 1, 0, .4); play('bubbles_a', .5, .8, 0, .4); },
  erupt() { play('boom_cine', 1, .95, 0, .5); play('sub', .9, 1, 0, .2); play('thunder_big', .45, .9, .05, .5); play('fw_burst', .6, .85, .02, .5); play('fw_burst_b', .5, .8, .35, .5); play('fwoosh', .6, .7, 0, .5);
    play('bubbles_a', .7, .7, 0, .5); play('gong', .4, .7, .05, .7); play('crash', .35, .8, .05, .6); [26, 38].forEach((m, i) => note('ped', m, .5, 3.5, i * .02, .7)); [50, 57, 62, 65, 69].forEach((m, i) => note('org', m, .24, 3.2, .04 + i * .02, .7)); play('choir_swell', .55, 1, .1, .7); },
  roar() { play('roar', 1, .95, 0, .55); play('boom_bass', .5, .9, 0, .4); play('sub', .55, .9, .05, .2); },
  gulp(pan = 0) { play('gulp', .55, jit(.1), 0, .4, 0, pan); },
  sink() { play('goo', .6, .7, 0, .5); play('bubbles_a', .5, .8, .1, .5); play('slime_b', .4, .6, .2, .4); },
  win() { play('success', .45, .95, 0, .5); play('choir_ah', .35, 1, .1, .7); play('bell_strike', .35, .95, 0, .6); play('applause', .22, 1, .3, .5, 3); },
  star(i) { play('bell_strike', .42, [.9, 1, 1.12][i] || 1, 0, .6); play('harp', .25, [.9, 1, 1.12][i] || 1, .02, .6); },
  fail() { play('cackle_b', .5, .95, 0, .55); [50, 53, 56].forEach((m, i) => note('org', m, .2, 2, i * .04, .7)); note('ped', 26, .4, 2.4, 0, .7); },
  hint() { play('magic', .14, 1.25, 0, .5); },
  shuffle() { play('whoosh', .4, .7, 0, .4); play('wing', .3, .9, .05, .4); play('swoosh_rise', .3, .9, .1, .5); },
  hammer(pan = 0) { play('hit_dram', .55, 1.05, 0, .5, 0, pan); play('crack', .5, .8, 0, .4, 0, pan); play('crunch', .4, .7, .02, .3, 0, pan); },
  broom() { play('swoosh_rise', .45, .9, 0, .4); play('whoosh', .45, .65, .05, .4); play('fwoosh', .3, 1, .1, .4); },
  turn() { play('bell_far', .38, 1, 0, .6); },
  rush() { play('fw_crackle', .35, 1, 0, .5); play('fwoosh', .35, 1.1, 0, .4); },
  bubble(pan = 0) { play(rr(['bubble_pop', 'bubble_pop_b']), .2, .85 * jit(.12), 0, .4, 0, pan); },
  owl() { play('owl', .2, 1, 0, .6, 0, (R() - .5) * 1.4); }, cackle() { play(rr(['cackle', 'cackle_b']), .28, 1, 0, .6, 0, (R() - .5) * 1.2); },
  intro() { play('swoosh_rise', .4, .7, 0, .5); play('wind', .2, 1, 0, .4, 3); },
  title() { play('boom_cine', .9, .9, 0, .5); play('hit_dram', .6, .85, 0, .5); [26, 38].forEach((m, i) => note('ped', m, .5, 3, i * .02, .7)); [50, 57, 62, 65].forEach((m, i) => note('org', m, .24, 3, .03 + i * .02, .7)); play('choir_swell', .5, 1, 0, .7); }
};
