// 20 hand-made levels: goals (score, slime, cobwebs, pumpkins, golden skulls, candy kinds), limited moves, 3-star scores.
// Layout chars: '.' cell  '#' ghost tile (hole)  's' slime  'S' double slime  'w' cobweb  'x' cobweb on slime  'p' pumpkin  'k' golden skull
// kinds: 0 bonbon, 1 candy corn, 2 gummy eyeball, 3 lollipop, 4 chocolate skull, 5 jelly bat
const L = (name, moves, colors, layout, goals, stars, extra = {}) => ({ name, moves, colors, layout, goals, stars, ...extra });
export const LEVELS = [
  L('first_brew', 20, 5, ['........', '........', '........', '........', '........', '........', '........', '........'], [{ t: 'score', n: 3000 }], [9000, 22500, 34000], { tip: 'tip1' }),
  L('corn_harvest', 18, 5, ['........', '........', '........', '........', '........', '........', '........', '........'], [{ t: 'kind', k: 1, n: 22 }], [8000, 21000, 31500], { tip: 'tip2' }),
  L('slime_spill', 20, 5, ['........', '........', '..ssss..', '..ssss..', '..ssss..', '..ssss..', '........', '........'], [{ t: 'slime' }], [11000, 23500, 36000], { tip: 'tip3' }),
  L('stripes', 18, 5, ['#......#', '........', '........', '........', '........', '........', '........', '#......#'], [{ t: 'score', n: 7000 }], [8500, 13500, 25000], { tip: 'tip4' }),
  L('cobweb_cellar', 20, 5, ['........', '........', '.w....w.', '..w..w..', '..w..w..', '.w....w.', '........', '........'], [{ t: 'locks' }], [9500, 21500, 31000], { tip: 'tip5' }),
  L('pumpkin_patch', 22, 5, ['........', '........', '........', '.p.pp.p.', '........', '........', '..p..p..', '........'], [{ t: 'pumps' }], [10000, 21000, 31000], { tip: 'tip6' }),
  L('golden_skulls', 24, 5, ['..k..k..', '........', '........', '........', '........', '........', '........', '........'], [{ t: 'items' }], [10500, 25500, 51000], { items: 3, tip: 'tip7' }),
  L('ghost_tiles', 22, 5, ['ss####ss', 'ssssssss', 'ss.##.ss', 'ss....ss', '.s....s.', '.s.##.s.', '.ssssss.', '..ssss..'], [{ t: 'slime' }], [9000, 13000, 21000], { tip: 'tip8' }),
  L('bat_swarm', 22, 6, ['........', '........', '........', '........', '........', '........', '........', '........'], [{ t: 'kind', k: 5, n: 20 }, { t: 'kind', k: 2, n: 20 }], [2000, 11000, 13000]),
  L('witch_hat', 26, 6, ['###SS###', '##SSSS##', '##SxxS##', '#.SSSS.#', '#..ss..#', 'ssssssss', 'ssssssss', '........'], [{ t: 'slime' }, { t: 'locks' }], [4000, 11500, 14500]),
  L('pumpkin_vault', 24, 6, ['..k..k..', '........', '.pp..pp.', '........', '...pp...', '........', '.p....p.', '........'], [{ t: 'pumps' }, { t: 'items' }], [3500, 13000, 18000], { items: 2 }),
  L('skull_board', 26, 6, ['.ssssss.', 'ssssssss', 'sS#ss#Ss', 'sS#ss#Ss', 'ssssssss', '.ss##ss.', '.ssssss.', '..s..s..'], [{ t: 'slime' }], [4000, 12000, 14500]),
  L('double_trouble', 27, 6, ['SSSSSSSS', 'S......S', 'S.SSSS.S', 'S.S..S.S', 'S.S..S.S', 'S.SSSS.S', 'S......S', 'SSSSSSSS'], [{ t: 'slime' }], [12500, 17500, 21000]),
  L('web_of_doom', 24, 6, ['........', 'xxxxxxxx', '........', '..xxxx..', '..xxxx..', '........', 'xxxxxxxx', '........'], [{ t: 'locks' }, { t: 'slime' }], [3500, 13500, 15500]),
  L('skull_mine', 26, 6, ['.k.##.k.', '........', '...##...', '........', '#......#', '##....##', '........', '........'], [{ t: 'items' }], [2000, 9500, 12000], { items: 3 }),
  L('pumpkin_wall', 26, 6, ['........', '........', 'pp.pp.pp', '........', '........', 'p.pppp.p', '........', '........'], [{ t: 'pumps' }, { t: 'kind', k: 0, n: 25 }], [4500, 14000, 16000]),
  L('long_night', 22, 6, ['........', '........', '........', '........', '........', '........', '........', '........'], [{ t: 'score', n: 11000 }], [11000, 12000, 14500]),
  L('witches_brew', 27, 6, ['s.xxxx.s', 'ss....ss', 'p.SSSS.p', '..SSSS..', '..SSSS..', 'p.SSSS.p', 'ss....ss', 's.xxxx.s'], [{ t: 'slime' }, { t: 'locks' }, { t: 'pumps' }], [12000, 18000, 26500]),
  L('crypt_of_gold', 30, 6, ['k.SSSS.k', '.#SSSS#.', '..SSSS..', 'SS....SS', 'SS....SS', '..SSSS..', '.#SSSS#.', '..SSSS..'], [{ t: 'slime' }, { t: 'items' }], [12500, 17500, 27500], { items: 4 }),
  L('grand_eruption', 32, 6, ['xS.kk.Sx', 'SSssssSS', 'p.SxxS.p', '.SS##SS.', '.SS##SS.', 'p.SxxS.p', 'SSssssSS', 'xS....Sx'], [{ t: 'slime' }, { t: 'locks' }, { t: 'pumps' }, { t: 'items' }], [13500, 18500, 21000], { items: 4 })
];
export const DUEL = L('duel', 10, 6, ['........', '........', '........', '........', '........', '........', '........', '........'], [{ t: 'score', n: 0 }], [0, 0, 0]);
export const INTRO = L('intro', 99, 6, ['........', '........', '........', '........', '........', '........', '........', '........'], [{ t: 'score', n: 0 }], [0, 0, 0]);
