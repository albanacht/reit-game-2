/* browser_roundB.js — round 10, the economics: buildings valued on what they
   earn, share issues priced against NAV, the CFO's covenant amendment, and
   selling that takes time (list, offer in the inbox, accept / quick sale).
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_roundB.js" <outdir> */
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
  const q = () => pg.evaluate(() => { Financials.runQuarter(); Board.evaluateQuarter(); });

  // valuation follows occupancy and NOI
  const v = await pg.evaluate(() => {
    const p = GameState.portfolio.find(x => !Tenants.isLocked(x)); const v0 = p.currentValue;
    Properties.recalculatePropertyValues(); const v1 = p.currentValue;
    p.occupancy = Math.max(0.5, p.occupancy - 0.25); for (let i = 0; i < 6; i++) Properties.recalculatePropertyValues(); const v2 = p.currentValue;
    p.occupancy = 0.97; for (let i = 0; i < 6; i++) Properties.recalculatePropertyValues(); const v3 = p.currentValue;
    return { name: p.name, v0, v1, v2, v3 };
  });
  // round 35b: valued on stabilised rent minus the refill (3 years of the missing rent): a vacancy dents value, it does not halve it
  ok(Math.abs(v.v1 - v.v0) / v.v0 < 0.03 && v.v2 < v.v1 * 0.95 && v.v2 > v.v1 * 0.85 && v.v3 > v.v2 * 1.05, 'value follows occupancy, gently: ' + v.name + ' ' + v.v0 + ' -> emptier ' + v.v2 + ' -> full ' + v.v3);

  // price vs NAV at the start, and share issues priced against NAV
  const pn = await pg.evaluate(() => { Financials.runQuarter(); return GameState.company.sharePrice / GameState.ratios.navPerShare; });
  ok(pn > 0.6 && pn < 0.95, 'starting company trades at ' + Math.round(pn * 100) + '% of NAV (was ~52%)');
  const iss = await pg.evaluate(() => {
    const C = GameState.company, nav = GameState.ratios.navPerShare, out = {};
    const snap = () => JSON.stringify({ s: C.sharesOutstanding, p: C.sharePrice, c: GameState.balance.cash, y: C.equityIssuanceYear, n: C.equityIssuanceCount });
    const s0 = snap();
    C.sharePrice = nav * 1.05; C.equityIssuanceYear = 0; let p0 = C.sharePrice; Financials.issueEquity(0.5); out.above = 1 - C.sharePrice / p0;
    Object.assign(C, (o => ({ sharesOutstanding: o.s, equityIssuanceYear: 0, equityIssuanceCount: 0 }))(JSON.parse(s0)));
    C.sharePrice = nav * 0.6; p0 = C.sharePrice; Financials.issueEquity(0.5); out.below = 1 - C.sharePrice / p0;
    return out;
  });
  ok(iss.above < 0.03 && iss.below > 0.08, 'share issue: price drop ' + (iss.above * 100).toFixed(1) + '% above NAV, ' + (iss.below * 100).toFixed(1) + '% at 60% of NAV');

  // the covenant: shown, and a CFO can amend it once
  await pg.evaluate(() => { showView('finance'); UI.renderAll(); }); await wait(300);
  ok(await pg.evaluate(() => /Bond covenant: total debt at most 60%/.test(document.getElementById('rcf-body').textContent)), 'Finance shows the bond covenant');
  const am0 = await pg.evaluate(() => Financials.amendCovenant().success);
  const am1 = await pg.evaluate(() => { const c = (Staff.getAvailableRoles ? null : null); GameState.staff = GameState.staff || []; GameState.staff.push({ roleId: 'financial', name: 'Test CFO', skill: 6, salary: 0.1, quartersEmployed: 2 }); const r = Financials.amendCovenant(); return { ok: r.success, lim: Financials.covenantLimit(), msg: r.message }; });
  ok(!am0 && am1.ok && am1.lim === 0.65, 'covenant: refused without a CFO, amended to 65% with one (' + am1.msg.slice(0, 60) + ')');
  await pg.screenshot({ path: OUT + '/rB_finance.png' });

  // selling: list, an offer arrives, accept
  await pg.evaluate(() => showView('map'));
  const id = await pg.evaluate(() => { const p = GameState.portfolio.find(x => !x.storyLock); Sales.list(p.id, 'low'); return p.id; });
  ok(await pg.evaluate(id => !!GameState.portfolio.find(p => p.id === id).listing, id), 'listed (still ours until a buyer comes)');
  let got = false;
  for (let i = 0; i < 10 && !got; i++) {
    await pg.evaluate(() => { const s = Story.S(); if (s.due && s.due !== 'sale_offer') s.due = null; if (GameState._pendingDecision && GameState._pendingDecision.id !== 'sale_offer') { GameState._pendingDecision = null; } UI.closeModal(); const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) Meeting.close(); });
    await pg.click('#btn-advance-quarter'); await wait(1000); await pg.evaluate(() => UI.closeModal());
    got = await pg.evaluate(() => !!GameState._pendingDecision && GameState._pendingDecision.id === 'sale_offer');
  }
  ok(got, 'a buyer made an offer (inbox decision)');
  if (got) {
    await pg.evaluate(() => UI.openPendingDecision()); await wait(300); await pg.screenshot({ path: OUT + '/rB_offer.png' });
    const c0 = await pg.evaluate(() => GameState.balance.cash);
    await pg.evaluate(() => document.querySelectorAll('#modal-body .decision-choice')[0].click()); await wait(300); await pg.evaluate(() => UI.closeModal());
    const sold = await pg.evaluate(id => ({ gone: !GameState.portfolio.find(p => p.id === id), cash: GameState.balance.cash }), id);
    ok(sold.gone && sold.cash > c0, 'accepted: sold, cash ' + c0 + ' -> ' + sold.cash);
  }
  // quick sale
  const qs = await pg.evaluate(() => { const p = GameState.portfolio.find(x => !x.storyLock); const v = p.currentValue, c0 = GameState.balance.cash; const r = Sales.quick(p.id); return { ok: r.success, got: GameState.balance.cash - c0, v }; });
  ok(qs.ok && qs.got < qs.v * 0.9 && qs.got > qs.v * 0.8, 'quick sale at ~12% under value (value ' + qs.v + ', cash in ' + qs.got.toFixed(1) + ')');
  ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
