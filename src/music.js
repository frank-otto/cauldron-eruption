// Music, all played on recorded samples (VSCO 2 CE, CC0): an original D-minor "witch's candy waltz" (3/4) – contrabass
// on the downbeat, pizzicato violins on two and three, pipe-organ pads, harp arpeggios and timpani. Layers join as the
// combos grow (intensity I).
import { note, play } from './audio.js';
const CH = { Dm: { b: [38, 45, 41], p: [62, 65, 69, 74], o: [50, 53, 57] }, Bb: { b: [34, 41, 38], p: [58, 62, 65, 70], o: [50, 53, 58] }, Gm: { b: [31, 38, 34], p: [55, 58, 62, 67], o: [50, 55, 58] },
  A: { b: [33, 40, 37], p: [57, 61, 64, 69], o: [49, 52, 57] }, F: { b: [29, 36, 33], p: [57, 60, 65, 69], o: [48, 53, 57] }, C: { b: [36, 43, 40], p: [55, 60, 64, 67], o: [48, 52, 55] }, E7: { b: [28, 35, 32], p: [56, 59, 62, 64], o: [50, 52, 56] } };
const GROOVES = {
  menu: { bpm: 96, beats: 3, prog: ['Dm', 'Dm', 'Gm', 'A', 'Dm', 'Bb', 'E7', 'A'], bar(b, c, k) { const E = [];
    E.push([0, () => note('cb', c.b[0], .32 * k, 0, 0, .45)]); E.push([0, () => c.o.forEach(m => note('org', m, .06 * k, 2.4, 0, .75))]);
    E.push([1, () => note('pz', c.p[1], .09 * k, 0, 0, .5, -.3)]); E.push([2, () => note('pz', c.p[2], .09 * k, 0, 0, .5, .3)]); if (b % 2 === 1) E.push([1.5, () => note('hp', c.p[3], .1 * k, 0, 0, .6)]); return E; } },
  game: { bpm: 138, beats: 3, prog: ['Dm', 'Dm', 'Gm', 'A', 'Bb', 'Gm', 'E7', 'A', 'Dm', 'F', 'C', 'A'], bar(b, c, k, I) { const E = [];
    E.push([0, () => note('cb', c.b[b % 2 ? 1 : 0], .36 * k, 0, 0, .35)]);
    E.push([1, () => note('pz', c.p[0], .1 * k, 0, 0, .4, -.25)]); E.push([1, () => note('pz', c.p[1], .08 * k, 0, 0, .4, -.25)]);
    E.push([2, () => note('pz', c.p[1], .1 * k, 0, 0, .4, .25)]); E.push([2, () => note('pz', c.p[2], .08 * k, 0, 0, .4, .25)]);
    if (b % 2 === 0) E.push([0, () => c.o.forEach(m => note('org', m, (.045 + .035 * I) * k, 2.4, 0, .75))]);
    if (I > .3) [0, .5, 1, 1.5, 2, 2.5].forEach((q, i) => E.push([q, () => note('hp', c.p[i % 4] + (i > 3 ? 12 : 0), .06 * k, 0, 0, .55, (i - 2.5) * .15)]));
    if (I > .55 && b % 2 === 0) E.push([0, () => play('tp_4', .2 * k, Math.pow(2, ((c.b[0] - 40) % 12) / 24), 0, .4)]);
    if (b % 4 === 0) E.push([0, () => play('bd', .2 * k, .8, 0, .4)]); if (b % 12 === 11) E.push([2, () => play('cymcresc', .07 * k, 1, 0, .5, .8)]); return E; } }
};
export class Player {
  constructor() { this.g = null; this.on = false; this.vol = 1; this.I = 0; }
  start(name, t0) { this.g = GROOVES[name]; this.name = name; this.t0 = t0; this.spb = 60 / this.g.bpm; this.bar = -1; this.q = []; this.on = true; }
  stop() { this.on = false; this.q = []; }
  step(t) { if (!this.on) return; const nb = this.g.beats; const b = Math.floor((t - this.t0) / this.spb / nb);
    while (this.bar < b + 1) { this.bar++; if (this.bar < 0) continue; const ch = CH[this.g.prog[this.bar % this.g.prog.length]]; for (const [be, f] of this.g.bar(this.bar, ch, this.vol, this.I)) this.q.push([this.t0 + (this.bar * nb + be) * this.spb, f]); this.q.sort((a, b2) => a[0] - b2[0]); }
    while (this.q.length && this.q[0][0] <= t) { const [, f] = this.q.shift(); f(); } }
}
