/* browser_round18.js — playtest round 18: maturing bonds repaid and reported,
   the credit line pays for anything (renovation, repositioning, lease-up),
   Okafor's 55% line, Tex's first award waits a year, preferred shares cover
   only what your cash cannot.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round18.js" <outdir> */
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
  // bonds: jump to Y4 Q1, see the clock warning, advance, see it repaid in the inbox
  const clk = await pg.evaluate(() => { const G = GameState; G.meta.year = 4; G.meta.quarter = 1; G.meta.totalQuarters = 13; UI.renderAll(); return (document.getElementById('inbox-list') || {}).textContent.match(/Bond \$35\.0M due[^\n]{0,80}/) ? (document.getElementById('inbox-list').textContent.match(/Bond \$35\.0M due.{0,60}/) || [''])[0] : ''; });
  ok(/Bond \$35\.0M due/.test(clk), 'on the clock: "' + clk + '"');
  const c0 = await pg.evaluate(() => GameState.balance.cash);
  await pg.evaluate(() => { GameState._pendingDecision = null; }); await pg.click('#btn-advance-quarter'); await wait(1000); await pg.evaluate(() => UI.closeModal());
  const m = await pg.evaluate(() => ({ cash: GameState.balance.cash, debt: GameState.debtTranches.map(t => t.id).join(','), inbox: ((document.getElementById('inbox-list') || {}).textContent.match(/[^.]*matured[^.]*\./) || [''])[0] }));
  ok(!/d001/.test(m.debt) && /matured/.test(m.inbox), 'the 5% notes matured at Y4 Q2: repaid (cash ' + c0.toFixed(1) + ' → ' + m.cash.toFixed(1) + '), in the inbox: "' + m.inbox.trim() + '"');
  // the credit line pays for a renovation and a repositioning
  const reno = await pg.evaluate(() => { const G = GameState; G.balance.cash = 0; if (!Staff.hasRole('asset')) G.staff.push({ roleId: 'asset', name: 'Test AM', salary: 0.2, traits: [], skill: 5 });
    const p = G.portfolio.find(x => x.location !== 'tier1' && !x.underConstruction && !x.storyLock); p.quarterOwned = 4; p.occupancy = 0.8; p.renovated = false;
    const r = Properties.startRenovation(p.id); return { ok: r.success, msg: r.message, cash: G.balance.cash }; });
  ok(reno.ok && reno.cash < 0, 'renovation with no cash: paid from the credit line (' + reno.msg + '; cash now ' + reno.cash + ')');
  // Okafor: 52% is not a complaint "limit 45%"
  const ok52 = await pg.evaluate(() => { const G = GameState; G.ratios.debtToAssets = 0.52; G.ratios.interestCoverage = 3.2; const j = Directors.card('okafor'); const sc = Directors.scorecard().find(r => r.id === 'okafor' && /Debt/.test(r.k)); return { want: sc.want, ok: sc.ok, demand: Board.demandFor('okafor').text }; });
  ok(ok52.want === '< 55%' && ok52.ok && !/debt down/.test(ok52.demand), 'Okafor at 52% debt: his line is ' + ok52.want + ' (met); demand: "' + ok52.demand + '"');
  const ok58 = await pg.evaluate(() => { GameState.ratios.debtToAssets = 0.58; Directors.update && Directors.update(); return Board.demandFor('okafor').text; });
  ok(/55%/.test(ok58), 'at 58% he asks: "' + ok58 + '"');
  // Tex: his join is recorded, his award motion waits a year
  const tex = await pg.evaluate(() => { Directors.addDirector('tex', 6, 'Tex joined'); Story.onDirectorJoin('tex'); return { joinQ: GameState.board.texJoinQ, now: (GameState.meta.year - 1) * 4 + GameState.meta.quarter }; });
  ok(tex.joinQ === tex.now, 'Tex’s seat date is recorded (his first award motion waits for the next annual meeting)');
  // preferred shares only cover what cash cannot
  const pf = await pg.evaluate(() => { GameState.balance.cash = 20; const pc = Financials.prefChoice({ label: 'Buy', detail: 'x', apply: () => 'bought' }, 60); return { amt: pc.amount, detail: pc.detail.slice(0, 90) }; });
  ok(Math.abs(pf.amt - 45) < 0.2, 'a $60M deal with $20M cash: $' + pf.amt + 'M of preferred shares (' + pf.detail + ')');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
