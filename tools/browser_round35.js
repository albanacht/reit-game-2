/* browser_round35.js — round 35, Boss Alex's list: the bond stop one quarter
   earlier (with the real starting bond), no random pandemic, events explained,
   the small funny events, the board's grace after a shock, Petrova's 85% line,
   the Acquisitions Lead's pay, the guests section at meetings.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round35.js" [outdir] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const OUT = process.argv[2] || '/tmp';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'warning') errs.push('warn: ' + m.text()); });
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  const fresh = () => pg.evaluate(() => { localStorage.clear(); UI.newGame(); UI.closeModal(); Story.S().due = null; GameState._pendingDecision = null;
    Levi.debug({ stage: 'passed' }); Gary.S().stage = 'tender'; const eo = document.getElementById('ending-overlay'); if (eo) eo.classList.add('hidden'); });
  await pg.goto(R); await wait(300); await fresh(); await wait(400);

  // 1. the real starting bond: due Y4 Q2, the stop comes when you press Advance in Y4 Q1
  await pg.evaluate(() => { const G = GameState; G.meta.year = 4; G.meta.quarter = 1; G.meta.totalQuarters = 12; G.balance.cash = 2; if (G.revolver) { G.revolver.limit = 0; G.revolver.drawn = 0; } UI.renderAll(); });
  const bond0 = await pg.evaluate(() => GameState.debtTranches.map(t => t.label + ' $' + t.amount).join(', '));
  await pg.click('#btn-advance-quarter'); await wait(500);
  let p = await pg.evaluate(() => ({ open: !document.getElementById('modal-overlay').classList.contains('hidden'), title: document.getElementById('modal-title').textContent, q: GameState.meta.year + 'Q' + GameState.meta.quarter, over: GameState.meta.gameOver }));
  ok(p.open && /bond falls due/i.test(p.title) && p.q === '4Q1' && !p.over, 'the starting bond (' + bond0 + '): Advance in Y4 Q1 stops: "' + p.title + '"');
  await pg.evaluate(() => { const b = [...document.querySelectorAll('#modal-actions button')].find(x => /^Refinance/.test(x.textContent)); b.click(); }); await wait(300);
  await pg.evaluate(() => { if (GameState.revolver) GameState.revolver.limit = 30; const b = [...document.querySelectorAll('#modal-actions button')].find(x => /Repay and continue/.test(x.textContent)); b && b.click(); }); await wait(1500);
  p = await pg.evaluate(() => ({ q: GameState.meta.year + 'Q' + GameState.meta.quarter, over: GameState.meta.gameOver, left: GameState.debtTranches.some(t => t.id === 'd001') }));
  ok(p.q === '4Q2' && !p.over && !p.left, 'refinanced and repaid: the quarter runs to ' + p.q + ', no default');

  // 2. no random pandemic; events explain themselves in the inbox
  await fresh();
  const ev = await pg.evaluate(() => {
    const r = { sup: Arc.suppresses('pandemic_shock') };
    const pan = Events.EVENT_CATALOGUE.find(e => e.id === 'pandemic_shock'), real = Events.rollEvents;
    Events.rollEvents = () => { Events.rollEvents = real; const x = pan.apply(); x.harmful = true; return [x]; };
    GameState.meta.year = 3; GameState.meta.quarter = 1; GameState.meta.totalQuarters = 8; UI.closeModal();
    return r; });
  await pg.click('#btn-advance-quarter'); await wait(1200);
  const ev2 = await pg.evaluate(() => { const it = (GameState.inbox.items || []).filter(i => /Pandemic/.test(i.title || '')).pop(); return { more: it ? it.more : null, shock: Directors.shockOn() }; });
  ok(ev.sup, 'the random pandemic is off (the crisis storyline owns big shocks)');
  ok(ev2.more && /Rent relief/.test(ev2.more) && /Lawyers/.test(ev2.more), 'the event explains its one-off: "' + (ev2.more || '').slice(0, 150) + '…"');
  ok(/hit us all/.test(ev2.shock || ''), 'and the board gives a year of grace: "' + ev2.shock + '"');

  // 3. the small funny events, each once a game
  await fresh();
  const fn = await pg.evaluate(() => { const G = GameState, seen = {};
    G.meta.year = 3; for (let i = 0; i < 400; i++) { (World.rollBackground() || []).forEach(x => { const t = x.text || ''; const k = /film crew/.test(t) ? 'film' : /birds/.test(t) ? 'birds' : /influencer/.test(t) ? 'influencer' : /sewage/.test(t) ? 'sewage' : /fountain/.test(t) ? 'fountain' : null; if (k) { seen[k] = (seen[k] || 0) + 1; seen[k + '_t'] = t; } }); }
    return seen; });
  const kinds = ['film', 'birds', 'influencer', 'sewage', 'fountain'].filter(k => fn[k]);
  ok(kinds.length >= 4 && kinds.every(k => fn[k] === 1), 'funny events seen once each: ' + kinds.join(', ') + (fn.fountain ? '' : ' (no flats owned: no fountain)'));
  console.log('      e.g. ' + (fn.birds_t || fn.film_t || ''));

  // 4. the grace: numbers count half, "not your fault"
  await fresh();
  const gr = await pg.evaluate(() => { const G = GameState; G.meta.year = 3; Financials.runQuarter(); G.ratios.debtToAssets = 0.63; G.ratios.interestCoverage = 1.4;
    Directors.refresh(); const a0 = G.board.directors.find(d => d.id === 'okafor').attitude;
    Directors.shock('the hurricane hit us all'); Directors.refresh(); const a1 = G.board.directors.find(d => d.id === 'okafor').attitude;
    return { a0, a1, cause: Directors.card('okafor').cause }; });
  ok(gr.a1 > gr.a0 && /^not your fault, the hurricane hit us all, but/.test(gr.cause), 'after a shock Okafor is gentler (' + gr.a0 + ' → ' + gr.a1 + '): "' + gr.cause + '"');

  // 5. Petrova: no red line in Year 1, the 85% line from Year 2, the right fix, the explanation
  await fresh();
  const pe = await pg.evaluate(() => { const G = GameState, r = {}, setP = pn => { G.company.sharePrice = (G.ratios.navPerShare || 14) * pn; };
    Financials.runQuarter(); setP(0.7); G.company.equityIssuanceYear = 0; r.i1 = Financials.issueEquity(1.5).success;
    Directors.update(); r.y1red = !!Directors.card('petrova').redNow; r.letter = (G.inbox.items || []).some(i => i.title === 'This year I let it go');
    G.meta.year = 2; G.meta.quarter = 2; G.meta.totalQuarters = 6; Directors.update(); r.y2carry = !!Directors.card('petrova').redNow;
    setP(0.9); G.company.equityIssuanceYear = 0; r.i2 = Financials.issueEquity(1.5).success; Directors.update(); r.dear = !!Directors.card('petrova').redNow;
    G.meta.year = 3; G.meta.quarter = 2; G.meta.totalQuarters = 10; setP(0.7); G.company.equityIssuanceYear = 0; r.i3 = Financials.issueEquity(1.6).success; Directors.update(); Directors.update();
    r.cheapRed = !!Directors.card('petrova').redNow; r.cause = Directors.card('petrova').cause; r.dem = (Board.demandFor('petrova') || {}).text;
    r.inv0 = Directors.issueInvested();
    const m = G.propertyMarket.filter(x => !x.underConstruction).sort((a, b) => b.askingPrice - a.askingPrice)[0]; G.balance.cash = 500; Properties.buyProperty(m.id); Directors.update(); r.inv1 = Directors.issueInvested();
    return r; });
  ok(pe.i1 && !pe.y1red && pe.letter && !pe.y2carry, 'Year 1: 15% new shares at 70% of NAV is no red line, just "This year I let it go" (and it does not carry into Year 2)');
  ok(pe.i2 && !pe.dear, 'Year 2: new shares at 90% of NAV do not cross her line');
  ok(pe.i3 && pe.cheapRed && /below 85% of NAV/.test(pe.cause), 'Year 3: 16% at 70% of NAV does: "' + pe.cause + '"');
  ok(/No new shares below 85% of NAV/.test(pe.dem || ''), 'her fix is about shares: "' + pe.dem + '"');
  ok(!pe.inv0 && pe.inv1, '"Explain: the money bought buildings" only once the money is in buildings');

  // 6. the Acquisitions Lead's pay
  await fresh();
  const aq = await pg.evaluate(() => { const roles = {}; for (let i = 0; i < 6; i++) { Staff.refreshTalentMarket ? Staff.refreshTalentMarket() : null; (GameState._talentMarket || []).forEach(c => { (roles[c.roleId] = roles[c.roleId] || []).push(c.salary); }); }
    const mx = k => roles[k] ? Math.max.apply(null, roles[k]) : null; return { acq: mx('acquisitions'), cfo: mx('cfo'), all: Object.keys(roles).map(k => k + ' ≤ ' + mx(k)).join(', ') }; });
  ok(aq.acq == null || aq.acq <= 0.42, 'Acquisitions Lead pay now in line with the others: ' + aq.all);

  // 7. guests sit apart, with their role
  await fresh();
  await pg.evaluate(() => { const G = GameState; G.meta.year = 4; G.meta.quarter = 1; G.board._storyYear = 0; G.board._meetingYear = 0; Levi.debug({ stage: 'wait' }); Meeting.open(); });
  await wait(400);
  const gs = await pg.evaluate(() => ({ div: !!document.querySelector('#mt-portraits .mt-gdiv'), roles: [...document.querySelectorAll('#mt-portraits .mt-grole')].map(x => x.textContent), chips: [...document.querySelectorAll('#mt-portraits .guest .mt-mood')].map(x => x.textContent) }));
  await pg.screenshot({ path: OUT + '/r35_guests.png', clip: { x: 0, y: 0, width: 1440, height: 330 } });
  ok(gs.div && gs.roles.length >= 1 && gs.chips.every(c => /Waiting|Speaking/.test(c)), 'guests behind a divider: ' + gs.roles.join(' | ') + ' [' + gs.chips.join(', ') + ']');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
