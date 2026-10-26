/* browser_round19.js — round 19: secured bonds to the covenant, then
   unsecured notes (CFO, +2%, 10% more) that Okafor wants gone within a year;
   refinancing room for bonds about to fall due; and no automatic rollover:
   a bond that cannot be repaid is a default.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round19.js" <outdir> */
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
  await pg.evaluate(() => UI.newGame()); await wait(1500); await pg.evaluate(() => UI.closeModal());
  const r = await pg.evaluate(() => { const G = GameState, out = {};
    G.meta.year = 2; G.meta.quarter = 1; G.meta.totalQuarters = 5; G.company.debtIssuanceQuarter = 0;
    const room0 = Financials.debtRoom(); out.room0 = room0;
    const big = Financials.issueDebt(fmt2(room0.secured + 20), 7, false); out.big = big.message;
    const fill = Financials.issueDebt(Math.floor(room0.secured), 7, false); out.fill = fill.success;
    out.noCfo = Financials.issueDebt(10, 5, true).message;
    G.staff.push({ roleId: 'cfo', name: 'Test CFO', salary: 0.3, traits: [], skill: 5 });
    const m0 = G.board.directors.find(d => d.id === 'okafor').attitude;
    const room1 = Financials.debtRoom(); out.room1 = room1;
    const un = Financials.issueDebt(Math.min(10, Math.floor(room1.unsecured)), 3, true); out.un = un.message; out.unOk = un.success;
    out.rate = (G.debtTranches.find(t => t.unsecured) || {}).rate; out.secRate = Financials.getCurrentBorrowingRateForTerm(3);
    Directors.update && Directors.update();
    out.okCause = Directors.card('okafor').cause; out.demand = Board.demandFor('okafor').text; out.sc = (Directors.scorecard().find(x => /Unsecured/.test(x.k)) || {}).v;
    out.over = Financials.issueDebt(fmt2(Financials.debtRoom().unsecured + 15), 3, true).message;
    return out;
    function fmt2(n) { return Math.round(n * 10) / 10; } });
  ok(/capped at 60%/.test(r.big), 'secured bonds stop at the covenant: "' + r.big + '"');
  ok(r.fill, 'secured room used up ($' + r.room0.secured + 'M)');
  ok(/need a CFO/.test(r.noCfo), 'unsecured without a CFO: "' + r.noCfo + '"');
  ok(r.unOk && r.rate >= r.secRate + 1.99, 'unsecured notes with a CFO at ' + r.rate + '% (secured 3 year ' + r.secRate + '%): ' + r.un);
  ok(/unsecured/.test(r.okCause + r.demand) && /Repay all/.test(r.demand), 'Okafor: "' + r.demand + '" (scorecard: ' + r.sc + ')');
  ok(/stop at 70%/.test(r.over), 'unsecured stops at 70%: "' + r.over + '"');
  // refinancing room and the default
  const d = await pg.evaluate(() => { const G = GameState; G.debtTranches = [{ id: 'x1', amount: 50, rate: 5, maturityYear: G.meta.year, maturityQuarter: G.meta.quarter + 1, quartersUntilMaturity: 1, label: '5% Test Notes' }];
    const room = Financials.debtRoom().refinancing; G.balance.cash = 0; G.revolver.limit = 10; G.revolver.frozen = false; UI.renderAll();
    const clock = ((document.getElementById('inbox-list') || {}).textContent.match(/Bond \$50\.0M due[^]{0,90}/) || [''])[0];
    G._pendingDecision = null; Story.S().due = null; Financials.runQuarter();
    return { room, clock, over: G.meta.gameOver, why: G.meta.gameOverReason, kind: Ending.kind() }; });
  ok(d.room === 50, 'a bond due within 2 quarters can be refinanced: $' + d.room + 'M of extra room');
  ok(/NOT enough/.test(d.clock), 'on the clock: "' + d.clock.slice(0, 110) + '"');
  ok(d.over && /defaulted/.test(d.why) && d.kind === 'receivers', 'unpaid at maturity: default, game over ("' + d.why.slice(0, 120) + '"), ending: ' + d.kind);
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
