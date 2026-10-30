/* browser_round34.js — round 34, Boss Alex's list: Okafor's one line (55%) and
   his step-a-year demand; Chen's push back at a minimum target; the Finance row
   with preferred shares; building costs 28% of gross rent; belt-tightening after
   Levi's warning; the bond due stop (refinance, shares, extension, default); the
   ending cards without a skip.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round34.js" [outdir] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const OUT = process.argv[2] || '/tmp';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'warning' && /levi|story|bond|pay/.test(m.text())) errs.push('warn: ' + m.text()); });
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  const fresh = () => pg.evaluate(() => { localStorage.clear(); UI.newGame(); UI.closeModal(); Story.S().due = null; GameState._pendingDecision = null; });
  await pg.goto(R); await wait(300); await fresh(); await wait(500);

  // 1. Okafor: one line, 55%; a step a year above it
  const ok1 = await pg.evaluate(() => {
    const G = GameState, r = {}; Financials.runQuarter(); const row = () => Directors.scorecard().find(x => x.id === 'okafor' && x.k === 'Debt / assets');
    G.ratios.debtToAssets = 0.51; r.a = row();
    const A = G.arc, q = G.totalQuartersElapsed(); A.warnStart = q - 2; A.crisisStart = q - 1; A.crisisEnd = q + 6; r.crisis = Directors.crisis(); r.b = row();
    G.ratios.debtToAssets = 0.62; const d = Board.demandFor('okafor'); r.dem = d && d.text; r.t = d && d.target;
    G.board.activeMandates = [d]; r.c = row(); Directors.refresh(); r.cause = Directors.card('okafor').cause;
    G.ratios.debtToAssets = 0.565; r.d2 = Board.demandFor('okafor').text;
    return r; });
  ok(ok1.a.want === '≤ 55%' && ok1.a.ok && ok1.crisis && ok1.b.want === '≤ 55%' && ok1.b.ok, 'Okafor at 51%: ≤ 55% and fine, in a crisis too');
  ok(Math.abs(ok1.t - 0.59) < 0.001 && /59%/.test(ok1.dem) && ok1.c.want === '≤ 59% this year', 'at 62% he asks for one step: "' + ok1.dem + '"; scorecard "' + ok1.c.want + '"');
  ok(/55%/.test(ok1.d2), 'at 56.5% he asks for 55%: "' + ok1.d2 + '"');
  console.log('      his reason at 62%: "' + ok1.cause + '"');

  // 2. Chen's push back at a target of 1
  const ch = await pg.evaluate(() => ({ a: Board.mandateNumbers({ metric: 'acquisitionsThisYear', target: 1, higher: true }).binary, b: Board.mandateNumbers({ metric: 'acquisitionsThisYear', target: 2, higher: true }).binary }));
  ok(ch.a === true && ch.b === false, 'Chen: "buy 1" can only be waived this year; "buy 2" can still be eased to 1');

  // 3. building costs 28% of gross rent
  await fresh();
  const nx = await pg.evaluate(() => { const G = GameState; Financials.runQuarter(); const exp = G.portfolio.filter(p => !p.underConstruction).reduce((a, p) => a + p.annualNOI / 4 * (p.occupancy - 0.28) / 0.70, 0); return { noi: G.pnl.noi, exp, gpr: G.pnl.grossPotentialRent, opex: G.pnl.operatingExpenses }; });
  ok(Math.abs(nx.noi - nx.exp) < 0.3 && Math.abs(nx.opex / nx.gpr - 0.28) < 0.01, 'costs are 28% of gross rent ($' + nx.opex.toFixed(2) + 'M of $' + nx.gpr.toFixed(2) + 'M); NOI $' + nx.noi.toFixed(2) + 'M a quarter');

  // 4. the Finance row with preferred shares
  await fresh();
  const fin = await pg.evaluate(() => { const G = GameState; Financials.issuePreferredFor && Financials.issuePreferredFor(30, 'Bob Harlow offers you his distribution centre'); G.balance.cash = -6.7;
    UI.renderAll(); document.querySelector('.tb-tab[data-view="finance"]').click();
    const g = document.getElementById('preferred-redeem-group'), i = document.getElementById('input-buyback-shares'), grid = document.querySelector('#views .fin-moves .actions-grid');
    return { shown: g && g.style.display !== 'none', w: g ? Math.round(g.getBoundingClientRect().width) : 0, gw: Math.round(grid.getBoundingClientRect().width), inp: Math.round(i.getBoundingClientRect().width), cash: document.getElementById('action-cash-avail').textContent }; });
  await pg.screenshot({ path: OUT + '/r34_finance.png', clip: { x: 0, y: 40, width: 1440, height: 420 } });
  ok(fin.shown && fin.w > fin.gw * 0.9 && fin.inp >= 70, 'preferred shares on their own full-width strip (' + fin.w + 'px of ' + fin.gw + 'px); buyback box ' + fin.inp + 'px');
  ok(/−\$6\.7M \(credit line in use\)/.test(fin.cash), 'negative cash reads "' + fin.cash + '"');

  // 5. belt-tightening after Levi's warning
  await fresh();
  const bt = await pg.evaluate(() => {
    const G = GameState, r = {}; Levi.debug({ stage: 'hired', year: 1 }); G.meta.year = 4; G.meta.quarter = 3; G.meta.totalQuarters = 14;
    const A = G.arc, q = G.totalQuartersElapsed(); A.warnStart = q - 1; A.crisisStart = q + 2; A.crisisEnd = q + 10;
    Levi.processQuarter([]); r.due = Story.S().due; r.warned = !!Levi.L().warned.crisis;
    const c = World.DECISIONS.find(x => x.id === 'levi_belt').build(); r.title = c.title; r.n = c.choices.length;
    G.board.politicalCapital = 3; const pc0 = 3; Financials.runQuarter(); const ga0 = G.pnl.gAndA;
    r.msg = c.choices[0].apply(); Story.S().due = null; r.pc = (G.board.politicalCapital || 0) - pc0; r.belt = JSON.stringify(G._belt);
    Financials.runQuarter(); r.ratio = G.pnl.gAndA / ga0;
    const it = Pay.meeting(G._belt.noBonusYear);
    r.pay = it.map(x => (x.lines[0] || [])[1] || '').join(' | '); r.grant = it.some(x => x.effect && /Granted/.test(String(x.effect)));
    return r; });
  ok(bt.warned && bt.due === 'levi_belt' && bt.n === 2, 'Levi warns, then Jenkins asks: "' + bt.title + '"');
  ok(bt.pc === -1 && Math.abs(bt.ratio - 0.9) < 0.04, 'tightened: overheads ×' + bt.ratio.toFixed(2) + ', costs 1 political capital (round 37)');
  ok(/No bonuses this year/.test(bt.pay), 'the pay committee: "' + bt.pay.slice(0, 90) + '"');

  // 6. the bond due stop
  const bondSetup = () => pg.evaluate(() => { localStorage.clear(); UI.newGame(); UI.closeModal(); const G = GameState; Story.S().due = null; G._pendingDecision = null;
    G.meta.year = 3; G.meta.quarter = 2; G.meta.totalQuarters = 9; G.company.equityIssuanceYear = 0; Levi.debug({ stage: 'passed' }); Gary.S().stage = 'tender';   // keep story cards out of the way
    G.debtTranches.forEach(t => { t.maturityYear = 20; }); G.debtTranches.push({ id: 'tdue', amount: 14, rate: 5, maturityYear: 3, maturityQuarter: 2, quartersUntilMaturity: 0, label: '5% Test Notes due Y3Q2' });
    G.balance.cash = 2; if (G.revolver) { G.revolver.limit = 0; G.revolver.drawn = 0; } const eo = document.getElementById('ending-overlay'); if (eo) eo.classList.add('hidden'); UI.renderAll(); });
  const panel = () => pg.evaluate(() => ({ open: !document.getElementById('modal-overlay').classList.contains('hidden'), title: document.getElementById('modal-title').textContent,
    btns: [...document.querySelectorAll('#modal-actions button')].map(x => x.textContent), q: GameState.meta.year + 'Q' + GameState.meta.quarter, over: GameState.meta.gameOver }));
  const press = re => pg.evaluate(src => { const b = [...document.querySelectorAll('#modal-actions button')].find(x => new RegExp(src).test(x.textContent)); if (b) b.click(); return !!b; }, re.source);
  await bondSetup(); await pg.click('#btn-advance-quarter'); await wait(400);
  let p = await panel();
  await pg.screenshot({ path: OUT + '/r34_bond.png' });
  ok(p.open && /A bond falls due/.test(p.title) && p.q === '3Q2' && !p.over, 'Advance stops: "' + p.title + '" [' + p.btns.join(' | ') + ']');
  ok(p.btns.some(x => /^Refinance/.test(x)) && p.btns.some(x => /^Sell .*new shares/.test(x)) && p.btns.some(x => /one more year/.test(x)) && p.btns.some(x => /Declare default/.test(x)) && !p.btns.some(x => /building/i.test(x)), 'four ways: refinance, shares, extension, default (no building sale)');
  await press(/^Refinance/); await wait(300); p = await panel();
  ok(p.open && /Bond covered/.test(p.title) && p.btns.some(x => /Repay and continue/.test(x)), 'refinanced: "' + p.title + '"');
  await pg.evaluate(() => { if (GameState.revolver) GameState.revolver.limit = 30; });   // the quarter's bills need the usual credit line
  await press(/Repay and continue/); await wait(1500); p = await panel();
  if (p.q !== '3Q3' || p.over) console.log('      DEBUG', JSON.stringify(p));
  ok(p.q === '3Q3' && !p.over && await pg.evaluate(() => !GameState.debtTranches.some(t => t.id === 'tdue')), 'repaid, the quarter runs: now ' + p.q);
  await bondSetup(); await pg.click('#btn-advance-quarter'); await wait(400);
  const pr0 = await pg.evaluate(() => GameState.company.sharePrice);
  await press(/one more year/); await wait(300); p = await panel();
  const ext = await pg.evaluate(() => { const t = GameState.debtTranches.find(x => x.id === 'tdue'); return { y: t.maturityYear, rate: t.rate, hit: !!GameState._ratingHit, px: GameState.company.sharePrice }; });
  ok(ext.y === 4 && ext.rate === 7 && ext.hit && ext.px < pr0 && /extended/.test(p.title) && p.btns.some(x => /^Continue/.test(x)), 'extension: due Y4 at 7%, rating marked down, price ' + pr0 + ' → ' + ext.px + ' ("' + p.title + '")');
  await pg.evaluate(() => { if (GameState.revolver) GameState.revolver.limit = 30; });
  await press(/^Continue/); await wait(1500); await pg.evaluate(() => { UI.closeModal(); const m = document.getElementById('meeting'); if (m) m.classList.add('hidden'); GameState.meta.quarter = 2; GameState.meta.year = 4; GameState.meta.totalQuarters = 13; GameState.balance.cash = 2; if (GameState.revolver) { GameState.revolver.limit = 0; GameState.revolver.drawn = 0; } Story.S().due = null; GameState._pendingDecision = null; GameState._pendingOffer = null; });
  await pg.click('#btn-advance-quarter'); await wait(400); p = await panel();
  ok(p.open && !p.btns.some(x => /one more year/.test(x)), 'a year later: no second extension [' + p.btns.join(' | ') + ']');
  await press(/Declare default/); await wait(3000);   // the ending screen can take a moment
  const dft = await pg.evaluate(() => ({ over: GameState.meta.gameOver, why: GameState.meta.gameOverReason, ending: !!document.getElementById('ending-overlay') && !document.getElementById('ending-overlay').classList.contains('hidden'),
    skip: !!document.querySelector('#ending-overlay .en-skip'), btns: [...document.querySelectorAll('#ending-overlay button')].map(x => x.textContent) }));
  ok(dft.over && /defaulted/.test(dft.why), 'declare default: the game ends');
  ok(dft.ending && !dft.skip && !dft.btns.some(x => /Skip/.test(x)), 'the ending cards, no skip: [' + dft.btns.join(' | ') + ']');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
