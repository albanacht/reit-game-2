/* browser_round32.js — round 32, Alexander's playtest list: Chen counts Year 1
   buys, preferred shares say what they paid for, a deal can still be paid for
   when the chair is angry (and locked choices say why), guests sit at the
   table from the start, the meeting reads in chunks (Continue), Jenkins and
   the chair speak when the economy turns, Levi comes early, the buyback box,
   and "what went wrong" when you are fired.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round32.js" [outdir] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const OUT = process.argv[2] || '/tmp';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear());
  await pg.evaluate(() => UI.newGame()); await wait(1300);
  // 1. a building bought in Year 1 Q1 counts for Chen
  const c = await pg.evaluate(() => { const G = GameState; UI.closeModal(); G.balance.cash = 200;
    const p = G.propertyMarket.find(x => x.listedByOwner); Properties.buyProperty(p.id);
    for (let i = 0; i < 4; i++) { Financials.runQuarter(); Board.evaluateQuarter(); Story.S().due = null; G._pendingDecision = null; }
    const row = Directors.scorecard().find(r => /Buildings bought/.test(r.k)); return { v: row && row.v, cause: Directors.card('chen').cause }; });
  ok(c.v === '1', 'bought in Q1, at the Year 1 meeting Chen counts it: buildings bought ' + c.v + ' ("' + c.cause + '")');
  // 2. preferred shares say what they paid for
  const pp = await pg.evaluate(() => [Financials.prefPurpose('Bob Harlow offers you his distribution centre'), Financials.prefPurpose('Bob Harlow asks for a loan'), Financials.prefPurpose('Morrow Plaza')]);
  ok(/Harlow Distribution Centre/.test(pp[0]) && /lend to Harlow/.test(pp[1]) && /Morrow/.test(pp[2]), 'preferred shares: ' + pp.join(' | '));
  // 3. an angry chair: preferred locked unless Furious; the deal can always be borrowed
  const a = await pg.evaluate(() => { const G = GameState, w = G.board.directors.find(d => d.id === 'williams'); G.balance.cash = 2;
    w.attitude = 2.5; const pc1 = Financials.prefChoice({ label: 'Lend', apply: () => '' }, 24, {}).check();
    w.attitude = 1.0; const pc2 = Financials.prefChoice({ label: 'Lend', apply: () => '' }, 24, {}); const sp = Financials.splitChoice({ label: 'Lend', detail: '', apply: () => '' }, 24, {});
    return { pc1, pc2: pc2.check(), why: pc2.checkMsg, label: sp.label, ok: sp.check(), detail: sp.detail }; });
  ok(a.pc1 && !a.pc2, 'preferred shares: approved by an Unhappy chair, refused by a Furious one ("' + a.why + '")');
  ok(a.ok && /Borrow it/.test(a.label) && /all debt/.test(a.detail), 'with a Furious chair the deal can still be borrowed: "' + a.label + '"');
  // 4. the meeting: guests from the start, chunks, locked reasons
  await pg.evaluate(() => { const G = GameState; G.board.directors.forEach(d => d.attitude = 5); G.balance.cash = 1; Story.debug('wait'); Story.H().stage = 'wait'; G.meta.year = 2; G.meta.quarter = 1; G.board._storyYear = 0; G.board._meetingYear = 0;
    const sh = Story.S(); if (sh.harlow) sh.harlow.stage = 'wait'; Meeting.open(); });
  await wait(400);
  const m = await pg.evaluate(() => ({ guests: [...document.querySelectorAll('#mt-portraits .mt-p.guest')].map(x => x.textContent.trim()), btns: [...document.querySelectorAll('#mt-actions .mt-btn')].map(x => x.textContent.trim()) }));
  await pg.evaluate(() => Meeting.flush()); await wait(300);
  const m2 = await pg.evaluate(() => [...document.querySelectorAll('#mt-actions .mt-btn')].map(x => x.textContent.trim()));
  ok(m2.length === 1 && /Continue/.test(m2[0]), 'after the opening numbers the meeting waits: [' + m2.join(' | ') + ']');
  console.log('      guests at the table from the start: ' + (m.guests.join(', ') || '(none this year)'));
  let seen = [], locked = null;
  for (let i = 0; i < 30; i++) {
    await pg.evaluate(() => Meeting.flush()); await wait(150);
    const st = await pg.evaluate(() => ({ btns: [...document.querySelectorAll('#mt-actions .mt-btn')].map(x => ({ t: x.textContent.trim().slice(0, 70), dis: x.disabled, why: (x.querySelector('.mt-why') || {}).textContent || '' })), open: !document.getElementById('meeting').classList.contains('hidden'), guests: [...document.querySelectorAll('#mt-portraits .mt-p.guest')].map(x => x.textContent.trim()) }));
    if (!st.open || !st.btns.length) break;
    if (st.guests.length) seen = st.guests;
    const l = st.btns.find(x => x.dis && x.why); if (l && !locked) locked = l;
    const i2 = st.btns.findIndex(x => !x.dis && /Continue|Accept|Back to work|Refuse|Pass|Leave/.test(x.t)); const k = i2 > -1 ? i2 : st.btns.findIndex(x => !x.dis);
    if (/Back to work|Leave the boardroom/.test(st.btns[k].t)) { await pg.evaluate(k => document.querySelectorAll('#mt-actions .mt-btn')[k].click(), k); break; }
    await pg.evaluate(k => document.querySelectorAll('#mt-actions .mt-btn')[k].click(), k);
  }
  console.log('      guests seen: ' + (seen.join(', ') || 'none') + (locked ? '; a locked choice: "' + locked.t + '" → ' + locked.why : ''));
  ok(!locked || /\S/.test(locked.why), 'locked choices say why');
  await pg.evaluate(() => { const o = document.getElementById('meeting'); if (o) o.classList.add('hidden'); });
  // 5. the economy turns: Jenkins writes, the chair says it
  const e = await pg.evaluate(() => { const G = GameState, A = G.arc, q = G.totalQuartersElapsed(); A.warnStart = q - 1; A.crisisStart = q; A.crisisEnd = q + 6; G.meta.year = Math.max(2, G.meta.year);
    Story.processQuarter(); const t = G.inbox.items.filter(i => /going dim|Storm clouds/.test(i.title)).map(i => i.title); return { phase: Arc.phase(), t }; });
  ok(e.phase === 'crisis' && e.t.indexOf('Things are going dim') > -1, 'crisis: Jenkins writes "' + e.t.join(', ') + '"');
  // 6. Levi is offered early
  const l = await pg.evaluate(() => { const L = Levi.L(); L.stage = 'wait'; const it = Levi.agenda(3, []); return it.length && it[0].guest ? it[0].guest.name : null; });
  ok(/Levi/.test(l || ''), 'Levi arrives at the Year 3 meeting: ' + l);
  // 7. the buyback box is wide enough
  const w = await pg.evaluate(() => { document.querySelector('.tb-tab[data-view="finance"]').click(); const i = document.getElementById('input-buyback-shares'); return Math.round(i.getBoundingClientRect().width); });
  ok(w >= 50, 'buyback input is ' + w + 'px wide');
  // 8. what went wrong
  const p = await pg.evaluate(() => { const G = GameState; G.history.forEach(h => h.debtToAssets = 0.6); G.credit.rating = 'B'; G.history[0].creditRating = 'A'; G.board.directors.find(d => d.id === 'okafor').attitude = 1;
    G.meta.gameOver = true; G.meta.gameOverReason = 'The board voted 4-1 to remove you.'; G._endingShown = true; UI.showGameOver(); return document.getElementById('postmortem').textContent; });
  ok(/What went wrong/.test(p) && /Debt reached 60%/.test(p) && /rating fell from A to B/.test(p), 'game over: ' + p.slice(0, 260));
  await pg.screenshot({ path: OUT + '/r32_gameover.png' });
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
