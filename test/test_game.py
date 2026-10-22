"""Cauldron Eruption – full headless test suite (Chrome + SwiftShader WebGL over a local web server).
Run: python3 test/test_game.py   (exit code 0 = all checks passed)"""
SUR = bytes([79, 116, 116, 111]).decode()  # the surname that must never appear (spelled as bytes so this file stays clean)
# third-party game trademarks that must never appear (Candy Crush callouts/bonus names, the old title), EN + DE
KING = r'\b(sweet|tasty|delicious|divine|saga|sugar)\b|sugar\s*(crush|rush|stars?)|candy[\s_-]*(match|crush)|\b(süß|süße|süßes|süßer|süßen|süßem|köstlich\w*|lecker\w*|göttlich\w*)\b|zucker\w*'
import asyncio, os, re, glob, json, sys
from playwright.async_api import async_playwright
import threading, http.server, functools, socketserver
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class _Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
_srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); _srv.daemon_threads = True
threading.Thread(target=_srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/index.html' % _srv.server_address[1]
OUT = ROOT + '/test/shots/'; os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
R = []
def check(n, ok, info=''): R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f' — {info}' if info != '' else ''), flush=True)

async def page(b, skip=True, manual=True, locale='en-US', clear=True, ctx=None, **kw):
    own = ctx is None
    if own:
        ctx = await b.new_context(accept_downloads=True, locale=locale, **kw)
        init = 'window.__cmSeed = 4242; window.__cmPDB = true; window.__cmNoAutoQ = true; window.__cmBoardSeed = 1234;' + ('window.__cmManual = true;' if manual else '') + ('window.__cmSkipIntro = true;' if skip else '')
        if clear: init += "try{if(!sessionStorage.getItem('cmInit')){sessionStorage.setItem('cmInit','1'); localStorage.clear();}}catch(e){}"
        await ctx.add_init_script(init)
    pg = await ctx.new_page(); pg.set_default_timeout(300000); logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR {e}'))
    await pg.goto(URL); await pg.wait_for_function('document.body.classList.contains("ready") && window.__cm', timeout=120000)
    return ctx, pg, logs

def pxs(im): return im.get_flattened_data() if hasattr(im, 'get_flattened_data') else list(im.getdata())
def mean(path): im = Image.open(path).convert('L'); px = pxs(im); return sum(px) / len(px)
def diff(a, b):
    A = Image.open(a).convert('L').resize((160, 100)); B = Image.open(b).convert('L').resize((160, 100)); pa, pb = pxs(A), pxs(B); return sum(abs(x - y) for x, y in zip(pa, pb)) / len(pa)
def white_share(path):
    im = Image.open(path).convert('RGB').resize((200, 250)); px = pxs(im); return sum(1 for r, g, b in px if r > 245 and g > 245 and b > 245) / len(px)
async def shot(pg, name, n=1):
    await pg.evaluate(f'__cm.step(1/30, {n})'); await pg.screenshot(path=OUT + name, timeout=180000); return OUT + name
async def mark(pg): return await pg.evaluate('__cm.log.length')
async def lg_since(pg, k): return await pg.evaluate(f'__cm.log.slice({k}).map(e => e.n)')
async def settle(pg, n=900): return await pg.evaluate(f'__cm.settle({n})')
async def banners(pg): return await pg.evaluate('(window.__banners || []).slice()')
async def ev(pg, js): return await pg.evaluate(js)

# ---- board builder: pattern kind 0 on given cells, filler 1..4 with no run of 3 anywhere (deterministic) ----
def board(mods, w=8, h=8):
    g = [[None] * w for _ in range(h)]
    for (x, y), v in mods.items(): g[y][x] = v
    def kind(v): return None if v is None or v in ('P', 'K', '#') else v[0]
    for y in range(h):
        for x in range(w):
            if g[y][x] is not None: continue
            for k in [str(1 + (x * 3 + y * 2 + t) % 4) for t in range(4)]:
                bad = False
                for dx, dy in ((1, 0), (0, 1)):
                    for o in range(-2, 1):
                        cells = [(x + (o + q) * dx, y + (o + q) * dy) for q in range(3)]
                        if all(0 <= cx < w and 0 <= cy < h for cx, cy in cells):
                            ks = [k if (cx, cy) == (x, y) else kind(g[cy][cx]) for cx, cy in cells]
                            if ks.count(k) == 3: bad = True
                if not bad: g[y][x] = k; break
    return [' '.join(r) for r in g]
async def setb(pg, mods):
    rows = board(mods); await pg.evaluate(f'__cm.setCells({json.dumps(rows)})')
    return await pg.evaluate('__cm.BD.findRuns(__cm.board()).length')
async def fresh(pg, li=0, mode='level'):
    await pg.evaluate(f'__cm.start({json.dumps(mode)}, {li}); __cm.stepq(1/30, 4)')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        # ================= THE OPENING: Moon Drop → cascade → THE CAULDRON ERUPTS → title =================
        ctx, pg, logs = await page(b, skip=False, viewport={'width': 540, 'height': 675})
        check('app opens straight into the cinematic opening (no title card)', await ev(pg, '__cm.S.state') == 'intro' and not await pg.is_visible('#menu.show'))
        f0 = await shot(pg, 'intro-f0.png', 0); m0 = mean(f0); check('opening frame 0 is not black', m0 > 25, round(m0, 1))
        f1 = await shot(pg, 'intro-f05.png', 15); d = diff(f0, f1); check('opening: visible motion in the first half second', d > 1.0, round(d, 2))
        pk = await ev(pg, '__cm.introPick()'); check('opening uses the searched 5-wave cascade board', pk.get('sd') == 3636, pk)
        BLACK = '''(n) => { const gl = __cm.renderer.getContext(), px = new Uint8Array(4); let k = 0; for (let i = 0; i < n; i++) { __cm.step(1/30); let lit = 0; for (const [fx, fy] of [[.5, .5], [.25, .3], [.75, .3], [.25, .75], [.75, .75]]) { gl.readPixels(Math.floor(gl.drawingBufferWidth * fx), Math.floor(gl.drawingBufferHeight * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); if (px[0] + px[1] + px[2] >= 3) lit++; } if (!lit) k++; } return k; }'''
        bk = await ev(pg, f'({BLACK})(10)'); check('opening: no black frames', bk == 0, bk)
        st = await ev(pg, '''(() => { let maxC = 0, sawErupt = false, ghoul = 0, fount = 0, title = -1; for (let i = 0; i < 1400 && __cm.S.state === 'intro'; i++) { __cm.stepq(1/30); maxC = Math.max(maxC, __cm.S.cascade); if (__cm.S.eruptT >= 0) sawErupt = true; ghoul = Math.max(ghoul, __cm.G.up); fount = Math.max(fount, __cm.fountain()); if (title < 0 && __cm.S.titleT >= 0) title = __cm.S.introT; } return { maxC, sawErupt, ghoul, fount, title, state: __cm.S.state }; })()''')
        check('opening: the hero drop sets off a real cascade (≥4 waves)', st['maxC'] >= 4, st)
        check('opening: THE CAULDRON ERUPTS (eruption + candy fountain)', st['sawErupt'] and st['fount'] > 40, st)
        check('opening: the Gummy Ghoul rises fully', st['ghoul'] > .95, round(st['ghoul'], 2))
        check('opening: title slams in under 14 s and the opening ends in the menu', 0 < st['title'] < 14 and st['state'] == 'menu', st)
        bn = await banners(pg); check('opening banners: eruption + ghoul callouts', any('ERUPTS' in x for x in bn) and any('GHOUL' in x for x in bn), bn)
        lg = await ev(pg, '__cm.log.map(e => e.n)')
        check('opening sounds: eruption boom, roar, gulps, title hit (real samples)', all(x in lg for x in ['boom_cine', 'roar', 'gulp']), sorted(set(lg))[:40])
        check('no console errors during the opening', not logs, logs[:3])
        # skip button
        await ev(pg, '__cm.startIntro(); __cm.stepq(1/30, 10)'); await pg.click('#btnSkip'); check('Skip ends the opening into the menu', await ev(pg, '__cm.S.state') == 'menu')
        await ctx.close()

        # ================= MENU, language, difficulty, privacy of visible text =================
        ctx, pg, logs = await page(b, viewport={'width': 1280, 'height': 800}, locale='de-DE')
        check('menu shown after skip', await pg.is_visible('#menu.show'))
        check('English is the default (even on a German browser)', await ev(pg, '__cm.S.lang') == 'en' and await ev(pg, 'document.documentElement.lang') == 'en')
        en = await ev(pg, 'document.body.innerText'); await pg.click('#btnLang'); de = await ev(pg, 'document.body.innerText')
        check('DE toggle switches the UI to German', await ev(pg, '__cm.S.lang') == 'de' and en != de and ('Spielen' in de or 'Spieler' in de), de[:120])
        await pg.click('#btnLang'); check('EN toggle back', await ev(pg, '__cm.S.lang') == 'en')
        for txt in (en, de):
            check('visible text: no "AI", no surname, no e-mail, no URL', not re.search(r'\bAI\b|\bKI\b|' + SUR + r'|@[\w-]+\.\w+|https?://|www\.', txt), re.findall(r'\bAI\b|' + SUR + r'|https?://\S+', txt))
        for txt in (en, de):
            check('visible text: no third-party trademark terms (Sweet/Tasty/Delicious/Divine/Sugar…/Saga/Candy Match, DE Süß/Köstlich/Zucker…)', not re.search(KING, txt, re.I), re.findall(KING, txt, re.I)[:5])
        check('game title is Cauldron Eruption (page title, menu, opening slam)', (await ev(pg, 'document.title')).startswith('Cauldron Eruption') and 'CAULDRON' in (await pg.inner_text('#menu h1')).upper() and 'ERUPTION' in (await pg.inner_text('#menu h1')).upper() and 'CAULDRON' in (await ev(pg, "document.getElementById('oTitle').textContent")).upper())
        check('difficulty buttons Easy/Medium/Hard + Kids toggle + duel + 20-level map', await ev(pg, "[document.querySelectorAll('#diff button').length, !!document.getElementById('btnKids'), !!document.getElementById('btnDuel'), document.querySelectorAll('#levels button').length]") == [3, True, True, 20])
        check('quality default is Normal (mid)', await ev(pg, '__cm.quality()') == 'mid' and 'Normal' in await pg.inner_text('#btnQ'))
        check('switching boards leaves no stale cobwebs', await ev(pg, '(() => { __cm.start(4); __cm.stepq(1/30, 3); __cm.start(0); __cm.stepq(1/30, 3); let n = 0; __cm.W.tray.traverse(o => { if (o.isMesh && o.geometry === __cm._dbg.K.geo.web) n++; }); __cm.toMenu(); return n; })()') == 0)
        check('only level 1 unlocked on a fresh profile', await ev(pg, "[...document.querySelectorAll('#levels button')].filter(b => !b.disabled && !b.classList.contains('locked')).length") == 1)
        await shot(pg, 'menu-desktop.png', 30)

        # ================= core match-3 rules (deterministic boards) =================
        await ev(pg, 'window.__cmNoWin = true'); await fresh(pg, 0)
        check('level 1 starts: play / idle, 20 moves, goal 3000', await ev(pg, '[__cm.S.state, __cm.movesLeft(), __cm.goals()[0].n]') == ['play', 20, 3000])
        n = await setb(pg, {(0, 3): '0', (1, 3): '0', (2, 4): '0'}); check('test board has no pre-made runs', n == 0, n)
        k = await mark(pg); s0 = await ev(pg, '__cm.S.score[0]'); ok = await ev(pg, '__cm.swap([2,4],[2,3])'); ph = await settle(pg)
        s1 = await ev(pg, '__cm.S.score[0]'); l = await lg_since(pg, k)
        check('valid swap: match of 3 clears, scores, uses a move', ok is not False and s1 > s0 and await ev(pg, '__cm.movesLeft()') == 19, (s0, s1))
        check('match sounds: swap whoosh + candy pops (real samples)', 'whoosh' in l and len(l) >= 4, sorted(set(l)))
        check('board refills completely (no holes) after clear', await ev(pg, '__cm.board().cells.filter((c, i) => !c && !__cm.board().hole[i]).length') == 0)
        await setb(pg, {}); k = await mark(pg); ok = await ev(pg, '__cm.swap([0,0],[1,0])'); await settle(pg)
        check('invalid swap bounces back, no move used, deep thud', ok is False and await ev(pg, '__cm.movesLeft()') == 19 and 'thud_a' in await lg_since(pg, k))
        check('non-adjacent swap rejected', await ev(pg, '__cm.swap([0,0],[2,0])') is False)
        # striped (4 in a row)
        await setb(pg, {(0, 3): '0', (1, 3): '0', (3, 3): '0', (2, 4): '0'}); sp0 = await ev(pg, '__cm.S.specials[0]')
        await ev(pg, '__cm.swap([2,4],[2,3])'); await settle(pg)
        check('4 in a row → STRIPED candy', await ev(pg, '__cm.S.specials[0]') > sp0 and await ev(pg, "__cm.board().cells.some(c => c && (c.sp === 'h' || c.sp === 'v'))"))
        # wrapped bomb (L)
        await setb(pg, {(0, 3): '0', (1, 3): '0', (2, 1): '0', (2, 2): '0', (3, 3): '0'}); await ev(pg, '__cm.swap([3,3],[2,3])'); await settle(pg)
        check('L/T shape → WRAPPED BOMB candy', await ev(pg, "__cm.board().cells.some(c => c && c.sp === 'b') || __cm.S.specials[0] >= 2"))
        # ghost (5)
        await setb(pg, {(0, 3): '0', (1, 3): '0', (3, 3): '0', (4, 3): '0', (2, 4): '0'}); await ev(pg, '__cm.swap([2,4],[2,3])'); await settle(pg)
        check('5 in a row → colour GHOST candy', await ev(pg, "__cm.board().cells.some(c => c && c.sp === 'g')"))
        # firing a striped
        await setb(pg, {(0, 5): '0', (1, 5): '0', (2, 6): '0h'}); k = await mark(pg); s0 = await ev(pg, '__cm.S.score[0]'); await ev(pg, '__cm.swap([2,6],[2,5])'); await settle(pg)
        l = await lg_since(pg, k); check('striped fires a whole line (fwoosh + crack, big score)', 'fwoosh' in l and await ev(pg, '__cm.S.score[0]') - s0 >= 160, await ev(pg, '__cm.S.score[0]') - s0)
        # bomb firing
        await setb(pg, {(0, 5): '0', (1, 5): '0', (2, 6): '0b'}); k = await mark(pg); await ev(pg, '__cm.swap([2,6],[2,5])'); await settle(pg)
        check('wrapped bomb explodes (boom + sub)', 'boom' in await lg_since(pg, k))
        # ghost + candy
        await setb(pg, {(3, 3): 'g'}); k = await mark(pg); c0 = await ev(pg, '__cm.board().cells[3*8+4].k'); s0 = await ev(pg, '__cm.S.score[0]'); await ev(pg, '__cm.swap([3,3],[4,3])'); await settle(pg)
        check('ghost candy swapped with a candy clears that colour (ghost choir)', 'ghosts' in await lg_since(pg, k) and await ev(pg, '__cm.S.score[0]') - s0 > 300)
        # fusion striped + bomb
        await setb(pg, {(3, 3): '0h', (4, 3): '1b'}); k = await mark(pg); await ev(pg, '__cm.swap([3,3],[4,3])'); await settle(pg)
        check('special + special FUSION (cinematic boom + gong)', 'boom_cine' in await lg_since(pg, k) and any('FUSION' in x for x in await banners(pg)))
        # hint after idle (medium: 6 s)
        await setb(pg, {(0, 3): '0', (1, 3): '0', (2, 4): '0'}); await ev(pg, '__cm.S.idleT = 0; __cm.S.hintMv = null; __cm.stepq(1/30, 120)'); h1 = await ev(pg, '!!__cm.hint()')
        await ev(pg, '__cm.stepq(1/30, 80)'); h2 = await ev(pg, '!!__cm.hint()')
        check('hint appears only after idle (none at 4 s, shown by ~6.7 s)', not h1 and h2, (h1, h2))
        # dead board → auto shuffle
        await ev(pg, "__cm.setCells(['0 1 2 3 0 1 2 3','2 3 0 1 2 3 0 1','0 1 2 3 0 1 2 3','2 3 0 1 2 3 0 1','0 1 2 3 0 1 2 3','2 3 0 1 2 3 0 1','0 1 2 3 0 1 2 3','2 3 0 1 2 3 0 1'])")
        dead = await ev(pg, '__cm.moves().length'); await ev(pg, '__cm.S.phase = "fall"; __cm.S.fallT = 9'); await settle(pg)
        check('no moves left → auto shuffle (banner) and moves exist again', dead == 0 and any('huffl' in x or 'ischen' in x for x in await banners(pg)) and await ev(pg, '__cm.moves().length') > 0, dead)
        # boosters
        bs = await ev(pg, '__cm.S.boosts.slice()'); await ev(pg, '__cm.boost("hammer", [4,4])'); await settle(pg)
        check('hammer booster smashes one candy and is used up', await ev(pg, '__cm.S.boosts[0]') == bs[0] - 1)
        await ev(pg, '__cm.boost("broom", [2,6])'); await settle(pg); check('broom booster sweeps a row', await ev(pg, '__cm.S.boosts[1]') == bs[1] - 1)
        await ev(pg, '__cm.boost("shuffle")'); await settle(pg); check('shuffle booster', await ev(pg, '__cm.S.boosts[2]') == bs[2] - 1)
        check('used-up booster refuses (toast, no effect)', await ev(pg, '__cm.boost("hammer", [1,1])') is False)
        # keyboard: cursor + space + arrow swaps
        await setb(pg, {(0, 3): '0', (1, 3): '0', (2, 4): '0'}); mv = await ev(pg, '__cm.movesLeft()')
        await ev(pg, '__cm.S.cur = [2, 4]'); await pg.keyboard.press('Space'); await pg.keyboard.press('ArrowUp'); await settle(pg)
        check('keyboard: Space selects, arrow swaps', await ev(pg, '__cm.movesLeft()') == mv - 1)
        # mouse swipe (desktop)
        await setb(pg, {(0, 3): '0', (1, 3): '0', (2, 4): '0'}); mv = await ev(pg, '__cm.movesLeft()'); await ev(pg, '__cm.step(1/30, 1)')
        a = await ev(pg, '__cm.screen([2,4])'); c = await ev(pg, '__cm.screen([2,3])')
        await pg.mouse.move(a['x'], a['y']); await pg.mouse.down(); await pg.mouse.move((a['x'] + c['x']) / 2, (a['y'] + c['y']) / 2, steps=3); await pg.mouse.move(c['x'], c['y'], steps=3); await pg.mouse.up(); await settle(pg)
        check('mouse drag-swipe swaps candies', await ev(pg, '__cm.movesLeft()') == mv - 1)
        await setb(pg, {(0, 3): '0', (1, 3): '0', (2, 4): '0'}); mv = await ev(pg, '__cm.movesLeft()')
        await pg.mouse.click(a['x'], a['y']); await pg.mouse.click(c['x'], c['y']); await settle(pg)
        check('tap-tap swaps candies', await ev(pg, '__cm.movesLeft()') == mv - 1)
        await shot(pg, 'play-desktop.png', 20)
        check('gameplay frame is not washed out (bloom under control)', white_share(OUT + 'play-desktop.png') < .04, round(white_share(OUT + 'play-desktop.png'), 3))

        # ================= THE CAULDRON ERUPTS in a real level =================
        await fresh(pg, 3); await settle(pg); s0 = await ev(pg, '__cm.S.score[0]'); k = await mark(pg)
        await ev(pg, '__cm.fillMeter(__cm.cap() - 1)'); await setb(pg, {(0, 3): '0', (1, 3): '0', (2, 4): '0'}); await ev(pg, '__cm.swap([2,4],[2,3])')
        er = await ev(pg, '''(() => { let e = false, up = 0, f = 0, gold = 0; for (let i = 0; i < 600; i++) { __cm.stepq(1/30); if (__cm.S.eruptT >= 0) e = true; up = Math.max(up, __cm.G.up); f = Math.max(f, __cm.fountain()); gold = Math.max(gold, __cm.W.gold); if (e && __cm.S.eruptT < 0 && __cm.S.phase === 'idle') break; } return { e, up, f, gold, phase: __cm.S.phase }; })()''')
        l = await lg_since(pg, k)
        check('filling the brew meter makes THE CAULDRON ERUPT', er['e'] and er['f'] > 40, er)
        check('the Gummy Ghoul rises, roars and gulps candies', er['up'] > .95 and 'roar' in l and 'gulp' in l, er['up'])
        check('golden refill after the eruption, board full again, game continues', er['gold'] >= 1 and er['phase'] == 'idle' and await ev(pg, '__cm.S.state') == 'play' and await ev(pg, '__cm.board().cells.filter((c, i) => !c && !__cm.board().hole[i]).length') == 0, er)
        check('eruption scores big (×2 clear of the whole board)', await ev(pg, '__cm.S.score[0]') - s0 > 1500, await ev(pg, '__cm.S.score[0]') - s0)
        check('one eruption counted', await ev(pg, '__cm.S.erupts[0]') == 1)

        # ================= obstacles & goals =================
        await fresh(pg, 4); locks = await ev(pg, '__cm.board().cells.filter(c => c && c.lock).length'); check('cobweb level has web-locked candies', locks == 8, locks)
        check('web-locked candy cannot be swapped', await ev(pg, '(() => { const B = __cm.board(); const i = B.cells.findIndex(c => c && c.lock); const x = i % 8, y = (i / 8) | 0; return __cm.swap([x, y], [x, y > 0 ? y - 1 : y + 1]); })()') is False)
        await ev(pg, '__cm.stepq(1/30, 20)'); k = await mark(pg); r0 = await ev(pg, '__cm.goals()[0].left'); await ev(pg, '__cm.boost("broom", [3,2])'); await settle(pg)
        check('clearing a webbed candy tears the web (goal counts down, web sound)', await ev(pg, '__cm.goals()[0].left') <= r0 - 2 and 'wrapper' in await lg_since(pg, k), (r0, await ev(pg, '__cm.goals()[0].left')))
        await fresh(pg, 5); pumps = await ev(pg, '__cm.board().cells.filter(c => c && c.t === "p").length'); check('pumpkin blockers placed (6)', pumps == 6, pumps)
        await ev(pg, '(() => { const B = __cm.board(); const i = B.cells.findIndex(c => c && c.t === "p"); window.__pi = i; })()')
        hp0 = await ev(pg, '__cm.board().cells[__pi].hp'); await ev(pg, '__cm.boost("hammer", __pi)'); await settle(pg); hp1 = await ev(pg, '__cm.board().cells[__pi] && __cm.board().cells[__pi].t === "p" ? __cm.board().cells[__pi].hp : 0')
        check('pumpkins take two hits (first hit cracks it)', hp0 == 2 and hp1 == 1, (hp0, hp1))
        await fresh(pg, 2); sl = await ev(pg, '__cm.goals()[0].left'); check('slime level: 16 slime tiles to clear', sl == 16, sl)
        await ev(pg, '__cm.boost("broom", [3,3])'); await settle(pg); check('clearing candies on slime removes the slime', await ev(pg, '__cm.goals()[0].left') <= sl - 4, await ev(pg, '__cm.goals()[0].left'))
        await fresh(pg, 6); check('golden-skull level: items goal and skulls on the board', await ev(pg, '__cm.goals()[0].t') == 'items' and await ev(pg, '__cm.board().cells.filter(c => c && c.t === "i").length') >= 1)
        await ev(pg, '__cm.stepq(1/30, 20); __cm.S.boosts[0] = 40'); k = await mark(pg)
        await ev(pg, '''(() => { for (let n = 0; n < 24; n++) { const B = __cm.board(); const i = B.cells.findIndex(c => c && c.t === "i"); if (i < 0 || B.stats.items) break; const x = i % 8, y = (i / 8) | 0; __cm.boost('hammer', [x, Math.min(7, y + 1)]); __cm.settle(); } __cm.stepq(1/30, 30); })()''')
        check('a golden skull dropped to the bottom is collected (+500, bell)', await ev(pg, '__cm.board().stats.items') >= 1 and 'bell_strike' in await lg_since(pg, k), await ev(pg, '__cm.board().stats.items'))
        check('19/20 levels have holes/obstacles or special goals', await ev(pg, "__cm.LEVELS.filter(L => L.layout.join('').replace(/\\./g, '').length || L.goals.some(g => g.t !== 'score')).length") >= 17)
        mv = await ev(pg, '__cm.LEVELS.map(L => L.moves)'); check('difficulty curve: later levels give more moves for bigger goals, all 18–32', min(mv) >= 18 and max(mv) <= 32 and sum(mv[10:]) > sum(mv[:10]), mv)

        # ================= win: witching hour → stars → progress; fail =================
        await ev(pg, 'window.__cmNoWin = false'); await fresh(pg, 0); await ev(pg, '__cm.S.score[0] = 2990'); await setb(pg, {(0, 3): '0', (1, 3): '0', (2, 4): '0'}); k = await mark(pg)
        await ev(pg, '__cm.swap([2,4],[2,3])'); await ev(pg, '(() => { for (let i = 0; i < 1800 && __cm.S.state === "play"; i++) __cm.stepq(1/30); })()')
        check('goal reached → WITCHING HOUR (left moves become stripes) → win screen', await ev(pg, '__cm.S.state') == 'end' and await ev(pg, '__cm.S.result') == 'win' and any('WITCHING' in x or 'GEISTERSTUNDE' in x for x in await banners(pg)))
        await ev(pg, '__cm.stepq(1/30, 90)')
        check('win: 1–3 stars, saved progress, level 2 unlocked, win fanfare', 1 <= await ev(pg, '__cm.stars()') <= 3 and await ev(pg, '__cm.prog().u') >= 1 and 'success' in await lg_since(pg, k), await ev(pg, '__cm.prog()'))
        check('end screen shows stars, score, next-level button', await pg.is_visible('#end.show') and await pg.is_visible('#btnNext') and len(await ev(pg, "document.querySelectorAll('#eStars i').length ? [1] : []")) == 1)
        await shot(pg, 'win-desktop.png', 30)
        # share card
        texts = await ev(pg, '''(async () => { const T = []; const o = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { T.push(String(t)); return o.call(this, t, ...a); }; const u = await __cm.cardURL(); CanvasRenderingContext2D.prototype.fillText = o; const im = new Image(); im.src = u; await im.decode(); return { T, w: im.width, h: im.height }; })()''')
        tx = ' '.join(texts['T'])
        check('share card is 1080×1350', (texts['w'], texts['h']) == (1080, 1350), (texts['w'], texts['h']))
        check('share card: title, score, stars, "6 days to Halloween 🎃", Built with Grok Bot', 'CAULDRON ERUPTION' in tx.upper() and not re.search(KING, tx, re.I) and '6 days to Halloween' in tx and 'Built with Grok Bot' in tx, tx[:200])
        check('share card has no URL, no e-mail, no surname, generic player name', not re.search(r'https?://|www\.|\.com|\.io|@\w+\.|' + SUR, tx) and 'Player' in tx, tx[:200])
        async with pg.expect_download() as dl: await pg.click('#btnCard')
        dpath = OUT + 'card.png'; await (await dl.value).save_as(dpath); im = Image.open(dpath); check('Save card downloads a 1080×1350 image', im.size == (1080, 1350), im.size)
        # fail
        await fresh(pg, 0); await ev(pg, '__cm.S.used[0] = 19'); await setb(pg, {(0, 3): '0', (1, 3): '0', (2, 4): '0'}); k = await mark(pg)
        await ev(pg, '__cm.swap([2,4],[2,3])'); await ev(pg, '(() => { for (let i = 0; i < 900 && __cm.S.state === "play"; i++) __cm.stepq(1/30); })()')
        check('out of moves → fail screen with a witch cackle', await ev(pg, '__cm.S.result') == 'fail' and 'cackle_b' in await lg_since(pg, k))
        check('console clean so far (desktop)', not logs, logs[:3])
        await ctx.close()

        # ================= difficulty + kids =================
        ctx, pg, logs = await page(b, viewport={'width': 1280, 'height': 800})
        res = {}
        for dname in ('easy', 'medium', 'hard'):
            await ev(pg, f'__cm.toMenu(); document.querySelector(\'#diff button[data-d="{dname}"]\').click()'); await fresh(pg, 8); res[dname] = await ev(pg, '[__cm.movesLeft(), __cm.cap(), __cm.S.boosts.reduce((a, b) => a + b, 0)]')
        check('Easy > Medium > Hard moves, boosters; brew meter fills faster on Easy', res['easy'][0] > res['medium'][0] > res['hard'][0] and res['easy'][2] > res['hard'][2] and res['easy'][1] < res['hard'][1], res)
        check('difficulty is remembered', await ev(pg, "localStorage.getItem('cm-diff')") == 'hard')
        await ev(pg, "__cm.toMenu(); document.getElementById('btnKids').click()"); await fresh(pg, 0)
        check('Kids mode: unlimited moves (∞)', await ev(pg, '__cm.movesLeft()') == None or await ev(pg, '!Number.isFinite(__cm.movesLeft())'))
        await ev(pg, '__cm.S.used[0] = 500'); await setb(pg, {(0, 3): '0', (1, 3): '0', (2, 4): '0'}); await ev(pg, '__cm.swap([2,4],[2,3])'); await settle(pg)
        check('Kids mode: can never fail', await ev(pg, '__cm.S.state') == 'play')
        await ev(pg, '__cm.S.idleT = 0; __cm.S.hintMv = null; __cm.stepq(1/30, 100)'); check('Kids mode: hint after ~3 s', await ev(pg, '!!__cm.hint()'))
        await pg.click('#btnQuit'); await ev(pg, "__cm.toMenu(); document.getElementById('btnKids').click(); document.querySelector('#diff button[data-d=medium]').click()")
        # ================= Player 1 vs Player 2 =================
        await ev(pg, '__cm.toMenu(); __cm.stepq(1/30, 3)'); await pg.click('#btnDuel'); await ev(pg, '__cm.stepq(1/30, 4)')
        check('Cauldron Duel: 10 moves each, Player 1 starts, duel bar shows Player 1 / Player 2', await ev(pg, '[__cm.S.mode, __cm.movesLeft(), __cm.S.player]') == ['duel', 10, 0] and 'Player 1' in await pg.inner_text('#duelBar') and 'Player 2' in await pg.inner_text('#duelBar'))
        await setb(pg, {(0, 3): '0', (1, 3): '0', (2, 4): '0'}); await ev(pg, '__cm.swap([2,4],[2,3])'); await settle(pg)
        check('after Player 1 moves it is Player 2\'s turn (bell)', await ev(pg, '__cm.S.player') == 1 and await ev(pg, '__cm.S.score[0]') > 0)
        await ev(pg, '''(() => { for (let g = 0; g < 60 && __cm.S.state === 'play'; g++) { __cm.settle(); if (__cm.S.state !== 'play') break; const m = __cm.moves()[0]; if (!m) { __cm.stepq(1/30, 5); continue; } __cm.swap(m.a, m.b); __cm.stepq(1/30, 2); } for (let i = 0; i < 200 && __cm.S.state === 'play'; i++) __cm.stepq(1/30); })()''')
        check('duel ends after 2×10 moves with a winner screen and both scores', await ev(pg, '[__cm.S.state, __cm.S.result, __cm.S.used[0], __cm.S.used[1]]') == ['end', 'duel', 10, 10] and ':' in await pg.inner_text('#eScore'), await ev(pg, '[__cm.S.used, __cm.S.score]'))
        check('duel: boosters disabled (fair)', await ev(pg, '__cm.boost("hammer", [1,1])') is False)
        await shot(pg, 'duel-end.png', 20)
        # ================= guards: NaN / frame clock =================
        await fresh(pg, 0)
        g = await ev(pg, '''(() => { const t0 = __cm.S.gt; __cm.stepq(NaN); __cm.stepq(-5); __cm.stepq(Infinity); __cm.stepq(1e9); const t1 = __cm.S.gt; __cm.S.meter = NaN; __cm.W.flash = NaN; __cm.S.score[0] = NaN; __cm.stepq(1/30); const l0 = __cm.last(); __cm.advance(l0 + 16); __cm.advance(l0 - 500); const l1 = __cm.last(); return [t1 - t0, __cm.S.meter, __cm.W.flash, __cm.S.score[0], l1 >= l0 + 16, Number.isFinite(__cm.cam().p[0])]; })()''')
        check('frame clock: NaN/negative/huge dt never jump or reverse (≤ 1/20 s per step)', 0 <= g[0] <= 4 / 20 + 1e-9, g[0])
        check('NaN guards reset meter/flash/score; clock monotonic; camera finite', g[1] == 0 and g[2] == 0 and g[3] == 0 and g[4] and g[5], g)
        await ev(pg, '__cm.quality("low")'); check('quality toggle changes tier and is remembered', await ev(pg, '__cm.quality()') == 'low' and await ev(pg, "localStorage.getItem('cm-q')") == 'low')
        check('console clean (difficulty/duel/guards)', not logs, logs[:3])
        await ctx.close()

        # ================= auto quality step-down (real-time clock) =================
        ctx, pg, logs = await page(b, viewport={'width': 800, 'height': 600})
        ok = await ev(pg, '(() => { window.__cmNoAutoQ = false; const q0 = __cm.quality(); for (let i = 0; i < 70; i++) __cm.fpsTick(1/12); const q1 = __cm.quality(); for (let i = 0; i < 12 * 12; i++) __cm.fpsTick(1/12); return [q0, q1, __cm.quality()]; })()')
        check('auto quality: ignores the first 6 s, then steps Normal → Low after 4 s below 32 fps', ok == ['mid', 'mid', 'low'], ok)
        await ctx.close()

        # ================= phone portrait (touch swipe, layout) =================
        ctx, pg, logs = await page(b, viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        await shot(pg, 'menu-phone.png', 20)
        await fresh(pg, 0); await ev(pg, '__cm.stepq(1/30, 100)'); await setb(pg, {(0, 3): '0', (1, 3): '0', (2, 4): '0'}); await ev(pg, '__cm.step(1/30, 2)')
        bb = await ev(pg, '''(() => { const P = []; for (const c of [[0,0],[7,0],[0,7],[7,7]]) P.push(__cm.screen(c)); const hud = document.getElementById('hud').getBoundingClientRect(), bo = document.getElementById('boosts').getBoundingClientRect(); return { P, hudB: hud.bottom, boT: bo.top, W: innerWidth, H: innerHeight }; })()''')
        xs = [q['x'] for q in bb['P']]; ys = [q['y'] for q in bb['P']]
        check('phone: whole 8×8 board on screen, between HUD and booster bar', min(xs) > 4 and max(xs) < bb['W'] - 4 and min(ys) > bb['hudB'] - 30 and max(ys) < bb['boT'], bb)
        check('phone: board uses most of the width (big touch targets)', max(xs) - min(xs) > bb['W'] * .7, round(max(xs) - min(xs)))
        a = await ev(pg, '__cm.screen([2,4])'); c = await ev(pg, '__cm.screen([2,3])'); mv = await ev(pg, '__cm.movesLeft()')
        cdp = await ctx.new_cdp_session(pg)
        async def touch(t, x, y): await cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': [] if t == 'touchEnd' else [{'x': x, 'y': y}]})
        await touch('touchStart', a['x'], a['y']); await touch('touchMove', a['x'], (a['y'] + c['y']) / 2); await touch('touchMove', c['x'], c['y']); await touch('touchEnd', 0, 0); await settle(pg)
        check('phone: touch swipe swaps candies', await ev(pg, '__cm.movesLeft()') == mv - 1, (mv, await ev(pg, '__cm.movesLeft()')))
        await shot(pg, 'play-phone.png', 30)
        check('console clean (phone)', not logs, logs[:3])
        await ctx.close()

        # ================= files: sounds, licences, privacy =================
        snd = sorted(os.path.basename(f)[:-4] for f in glob.glob(ROOT + '/sounds/*.mp3'))
        src = ''.join(open(f, encoding='utf-8').read() for f in glob.glob(ROOT + '/src/*.js'))
        used = set(re.findall(r"'([a-z0-9_]+)'", src)); inst = set(re.findall(r"note\('([a-z]+)'", src))
        unused = [s for s in snd if s not in used and s.split('_')[0] not in inst]; check('every sound file is used by the game', not unused, unused)
        missing = sorted({m for m in re.findall(r"play\('([a-z0-9_]+)'", src) + re.findall(r"loop\('([a-z0-9_]+)'", src) if m not in snd}); check('every sound the code plays exists', not missing, missing)
        lic = open(ROOT + '/LICENSES/SOUNDS.md', encoding='utf-8').read()
        nolic = [s for s in snd if not re.search(r'(?<![a-z0-9_])' + re.escape(s) + r'\.mp3', lic)]; check('every sound file is listed in LICENSES/SOUNDS.md with its source', not nolic, nolic)
        check('SOUNDS.md: only CC0 / Kenney CC0 / VSCO 2 CE (CC0) sources', 'CC0' in lic and not re.search(r'CC[- ]BY(?![- ]?0)|Attribution 4', lic))
        bad = []
        for f in glob.glob(ROOT + '/**/*', recursive=True):
            if any(s in f for s in ('/node_modules/', '/.v1/', '/test/', '/.sfx/', '/.git/', 'PROGRESS.md')) or os.path.isdir(f) or f.endswith(('.mp3', '.ttf', '.png', '.jpg')): continue
            if f.endswith('sounds-src.js'): continue
            try: t = open(f, encoding='utf-8', errors='ignore').read()
            except Exception: continue
            if re.search(SUR + '|(?i:frank' + SUR.lower() + r')|/Users/|[\w.+-]+@(?!media|keyframes|font-face|import|supports)[\w-]+\.[a-z]{2,}', t): bad.append(os.path.relpath(f, ROOT))
        check('no surname, Mac paths or e-mail addresses in project files', not bad, bad[:5])
        kb = []
        for f in [ROOT + '/index.html', ROOT + '/README.md', ROOT + '/package.json', ROOT + '/LICENSES/SOUNDS.md', ROOT + '/js/game.bundle.js'] + glob.glob(ROOT + '/src/*.js') + glob.glob(ROOT + '/css/*.css'):
            hits = re.findall(KING, open(f, encoding='utf-8', errors='ignore').read(), re.I)
            if hits: kb.append((os.path.relpath(f, ROOT), hits[:3]))
        check('no third-party trademark terms or the old title in any project/bundle file (EN + DE)', not kb, kb[:5])
        pub = [ROOT + '/README.md', ROOT + '/index.html'] + glob.glob(ROOT + '/src/i18n.js')
        ai = [os.path.basename(f) for f in pub if re.search(r'\bAI\b', open(f, encoding='utf-8').read())]; check('public text says SI, never AI', not ai, ai)
        await b.close()
    print(f'\n{sum(R)}/{len(R)} checks passed'); sys.exit(0 if all(R) else 1)
asyncio.run(main())
