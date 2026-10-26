/* browser_round21.js — round 21: the "sell everything, pay it out" exploit.
   The market prices only the dividend cash profit can pay (the rest is a
   one-off, and the share goes ex-dividend by it), Williams and Petrova turn
   on an uncovered dividend, a cut back to what we earn is forgiven, Chen and
   Hassan object to a shrinking portfolio, and the ending says what you sold.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round21.js" */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear());
  await pg.evaluate(() => UI.newGame()); await wait(1500); await pg.evaluate(() => UI.closeModal());
  await pg.evaluate(() => {
    window.__q = () => { const G = GameState; Financials.runQuarter(); Board.evaluateQuarter(); const s = Story.S(); if (s.due) s.due = null; G._pendingDecision = null; };
    window.__mood = id => { const d = GameState.board.directors.find(x => x.id === id); return d ? d.attitude : null; };
    window.__titles = () => GameState.inbox.items.filter(i => i.kind === 'message').map(i => i.from + ': ' + i.title);
  });
  const a = await pg.evaluate(() => { for (let i = 0; i < 5; i++) __q(); const G = GameState;
    return { y: G.meta.year, q: G.meta.quarter, pr: Financials.payoutRatio(), streak: Directors.uncovQ(), w: __mood('williams'), affo: Financials.trailingAffoPS() }; });
  ok(a.y === 2 && a.pr < 1 && a.streak === 0, 'Year ' + a.y + ' Q' + a.q + ': normal play, payout ' + Math.round(a.pr * 100) + '% of cash profit, no streak (Williams ' + a.w.toFixed(1) + ')');

  // 1. an uncovered raise gets no instant price bump, and the market prices only what profit pays
  const p = await pg.evaluate(() => { const G = GameState, px0 = G.company.sharePrice, aq = Financials.trailingAffoPS() / 4;
    const r = Financials.setDividend(Math.round(aq * 3 * 100) / 100);
    const px1 = G.company.sharePrice, sd = Financials.sustainableDividend(G.company.dividendPerShare * 4);
    const nav0 = G.ratios.navPerShare; __q();
    return { ok: r.success, px0, px1, sd, div: G.company.dividendPerShare, why: (G._priceWhy.bad || []).join(' | '), px2: G.company.sharePrice, nav0 }; });
  ok(p.ok && Math.abs(p.px1 - p.px0) < 0.01, 'dividend raised to 3x cash profit ($' + p.div + '/qtr): no instant bump ($' + p.px0 + ' → $' + p.px1 + ')');
  ok(p.sd.excess > 0 && p.sd.covered < p.div * 4, 'priced as $' + p.sd.covered.toFixed(2) + ' of income + $' + p.sd.excess.toFixed(2) + ' one-off a year');
  ok(/not covered by cash profit/.test(p.why), 'why the price moved: "' + p.why.slice(0, 160) + '"');
  ok(p.px2 / p.nav0 < 0.9, 'no premium to NAV from the payout: $' + p.px2 + ' vs NAV $' + p.nav0.toFixed(2));

  // 2. Williams slowly turns furious, then Petrova; letters, scorecard, demand
  const w = await pg.evaluate(() => { const out = []; for (let i = 0; i < 6; i++) { __q(); out.push({ s: Directors.uncovQ(), w: __mood('williams'), p: __mood('petrova'), wl: Directors.card('williams').label, pl: Directors.card('petrova').label }); }
    const sc = Directors.scorecard().filter(x => /Dividend \/ cash profit/.test(x.k)).map(x => x.id + ' ' + x.v + ' (' + x.want + ') ' + x.ok);
    const msgs = GameState.inbox.items.filter(i => i.kind === 'message' && /survival|market can count/.test(i.title)).map(i => i.from + ': ' + i.title + ' — ' + i.body);
    return { out, sc, msgs, cause: Directors.card('williams').cause, demand: Board.demandFor('williams'), votes: Directors.votesAgainst('williams') }; });
  console.log('      streak/Williams/Petrova by quarter: ' + w.out.map(x => x.s + ':' + x.w.toFixed(1) + '/' + x.p.toFixed(1)).join('  '));
  ok(w.out[0].w > w.out[5].w && w.out[5].wl === 'Furious', 'Williams falls quarter by quarter to ' + w.out[5].wl + ' (' + w.out[0].w.toFixed(1) + ' → ' + w.out[5].w.toFixed(1) + ')');
  ok(w.out[5].p < w.out[0].p - 1 && /Uneasy|Unhappy|Furious/.test(w.out[5].pl), 'Petrova follows: ' + w.out[5].pl + ' (' + w.out[5].p.toFixed(1) + ')');
  ok(w.msgs.some(m => /Williams.*Not at the cost of survival.*love a good dividend/.test(m)), 'Williams writes: "' + (w.msgs.find(m => /survival/.test(m)) || '').slice(0, 200) + '"');
  ok(w.msgs.some(m => /market can count/.test(m)), 'Petrova writes: "' + (w.msgs.find(m => /market can count/.test(m)) || '').slice(0, 160) + '"');
  ok(/not at the cost of survival/.test(w.cause), 'his card: "' + w.cause + '"');
  ok(w.sc.length === 2 && w.sc.every(s => /false$/.test(s)), 'scorecard: ' + w.sc.join('; '));
  ok(w.demand && w.demand.metric === 'payoutOk', 'his demand: "' + (w.demand || {}).text + '"');
  ok(w.votes, 'he would vote against you');

  // 3. cut back to what we earn: not his red line
  const c = await pg.evaluate(() => { const G = GameState, aq = Financials.trailingAffoPS() / 4, floor = (G.board.startYearDividend || 0.1) * 0.5;
    const r = Financials.setDividend(Math.max(Math.round(floor * 100 + 1) / 100, Math.round(aq * 0.9 * 100) / 100));
    __q(); return { msg: r.message, red: !!G.board.brain.red.williams, cause: Directors.card('williams').cause, forgiven: Directors.cutForgiven(), streak: Directors.uncovQ(), pr: Financials.payoutRatio() }; });
  ok(!c.red && c.forgiven && (c.pr > 1.3 || !/survival/.test(c.cause)), 'cutting back is not a red line (' + c.msg.slice(0, 70) + '); payout now ' + Math.round(c.pr * 100) + '%, streak ' + c.streak + '; his card: "' + c.cause + '"');

  // 4. selling the company off: Chen and Hassan
  await pg.evaluate(() => { localStorage.clear(); UI.newGame(); UI.closeModal(); for (let i = 0; i < 6; i++) __q(); });
  const s = await pg.evaluate(() => { const G = GameState, ch0 = __mood('chen'), ha0 = __mood('hassan');
    G.portfolio.filter(p => !p.underConstruction && !p.storyLock).slice(0, 3).forEach(p => Properties.sellProperty(p.id)); __q();
    const msgs = GameState.inbox.items.filter(i => i.kind === 'message' && /piggy bank|Selling the company off/.test(i.title)).map(i => i.from + ': ' + i.title + ' — ' + i.body);
    return { sk: Directors.shrink(), ch0, ch1: __mood('chen'), ha0, ha1: __mood('hassan'), msgs, sc: Directors.scorecard().filter(x => /Portfolio sold/.test(x.k)).map(x => x.id + ' ' + x.v + ' ' + x.ok),
             cc: (Directors.card('chen').cause), hj: Directors.card('hassan').cause }; });
  ok(s.sk > 0.15, 'three buildings sold: ' + Math.round(s.sk * 100) + '% of the portfolio, net of buys');
  ok(s.msgs.some(m => /Chen.*piggy bank/.test(m)) && s.msgs.some(m => /Hassan.*Selling the company off/.test(m)), 'letters: ' + s.msgs.map(m => m.slice(0, 120)).join(' || '));
  ok(s.ch1 < s.ch0 && s.ha1 < s.ha0, 'Chen ' + s.ch0.toFixed(1) + ' → ' + s.ch1.toFixed(1) + ', Hassan ' + s.ha0.toFixed(1) + ' → ' + s.ha1.toFixed(1));
  ok(s.sc.length === 2 && s.sc.every(x => /false$/.test(x)), 'scorecard: ' + s.sc.join('; '));

  // 5. the ending says what you sold
  const e = await pg.evaluate(() => { const G = GameState; G.portfolio.filter(p => !p.underConstruction && !p.storyLock).slice(0, 2).forEach(p => Properties.sellProperty(p.id));
    return { lines: Ending.mainCard().lines, n: G.board.brain.soldN }; });
  ok(e.n >= 4 && e.lines.some(l => /^You sold \d+ buildings for \$/.test(l)), 'ending: "' + (e.lines.find(l => /You sold/.test(l)) || '') + '"');

  // 6. Board tab renders with the new rows
  const t = await pg.evaluate(() => { UI.renderAll(); if (UI.showTab) UI.showTab('board'); return document.body.textContent.indexOf('Dividend / cash profit') > -1; });
  ok(t, 'Board tab shows the new scorecard row');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
