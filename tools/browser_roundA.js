/* browser_roundA.js — round 9, Alexander's playtest fixes: the date chip,
   map clicks (buy / open your building), single-tenant occupancy, the inbox
   showing one turn, "read more" on the economy, Jenkins's Year 2 nudge and
   credit line letter, buybacks on the credit line, the NAV chart.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_roundA.js" <outdir> */
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
  await pg.evaluate(() => UI.newGame());
  let letter = '';
  for (let i = 0; i < 30 && !/Year 1 is yours/.test(letter); i++) { await wait(150); letter = await pg.evaluate(() => (document.getElementById('inbox-list') || {}).textContent || ''); }
  ok(/Year 1 is yours/.test(letter), 'welcome: a short letter from Williams in the inbox (round 17)');
  await pg.evaluate(() => UI.closeModal());
  ok(await pg.evaluate(() => /Year 1\s*Q1/.test(document.getElementById('tb-date').textContent)), 'date chip by the buttons: ' + await pg.evaluate(() => document.getElementById('tb-date').textContent));
  await pg.screenshot({ path: OUT + '/rA_topbar.png', clip: { x: 700, y: 0, width: 740, height: 60 } });

  // map: click a building on the market opens the purchase; click yours opens its row
  const mk = await pg.evaluate(() => { const p = GameState.propertyMarket.find(x => x.listedByOwner) || GameState.propertyMarket[0]; return p.id; });
  await pg.evaluate(id => document.querySelector('#markers .mk[data-id="' + id + '"]').click(), mk); await wait(400);
  ok(await pg.evaluate(() => !document.getElementById('modal-overlay').classList.contains('hidden') && /Buy|Acquire|purchase/i.test(document.getElementById('modal-overlay').textContent)), 'map: clicking a building for sale opens the purchase');
  await pg.evaluate(() => UI.closeModal());
  const mine = await pg.evaluate(() => GameState.portfolio[0].id);
  await pg.evaluate(id => document.querySelector('#markers .mk[data-id="' + id + '"]').click(), mine); await wait(400);
  ok(await pg.evaluate(id => !document.getElementById('view-properties').classList.contains('hidden') && !!document.querySelector('#tab-properties tr.row[data-id="' + id + '"]'), mine), 'map: clicking your building opens it on Properties');
  await pg.evaluate(() => showView('map'));

  // single-tenant: 100% or 0%, whatever nudges it
  const st = await pg.evaluate(() => { const all = GameState.portfolio.concat(GameState.cityRivals, GameState.propertyMarket); const p = all.find(x => Tenants.isLocked(x) && x.occupancy === 1); p.occupancy = 0.98; return p.id; });
  await pg.click('#btn-advance-quarter'); await wait(1100); await pg.evaluate(() => UI.closeModal());
  ok(await pg.evaluate(id => GameState.portfolio.concat(GameState.cityRivals, GameState.propertyMarket).find(x => x.id === id).occupancy === 1, st), 'single-tenant building back to 100%');
  ok(await pg.evaluate(() => document.querySelectorAll('#inbox-list .ib-turn').length === 1), 'inbox: only the latest turn');

  // the economy: force a rate move and read more
  await pg.evaluate(() => { GameState.market.rateHoldQuarters = 0; window.__rr = Arc.rollRate; Arc.rollRate = () => ({ delta: 0.5, msg: 'hike' }); });
  await pg.click('#btn-advance-quarter'); await wait(1100); await pg.evaluate(() => { UI.closeModal(); Arc.rollRate = window.__rr; });
  const ev = await pg.evaluate(() => { const e = document.querySelector('#inbox-list .ib-macro.has-more, #inbox-list .ib-event.has-more'); if (!e) return null; const t = e.textContent; e.click(); return t; });
  await wait(200);
  const more = await pg.evaluate(() => (document.querySelector('#inbox-list .ib-more') || {}).textContent || '');
  ok(!!ev && /central bank/i.test(ev) && more.length > 20, 'rate move in the inbox, with a story: "' + more.slice(0, 80) + '"');
  await pg.screenshot({ path: OUT + '/rA_inbox.png', clip: { x: 1050, y: 60, width: 390, height: 700 } });

  // Year 2: Jenkins's nudge
  for (let i = 0; i < 4 && await pg.evaluate(() => (GameState.meta.year - 1) * 4 + GameState.meta.quarter < 5); i++) {
    await pg.evaluate(() => { if (GameState._pendingDecision) { UI.openPendingDecision(); const c = document.querySelector('#modal-body .decision-choice:not(.decision-choice-disabled)'); c && c.click(); } UI.closeModal(); const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) Meeting.close(); });
    await pg.click('#btn-advance-quarter'); await wait(1100); await pg.evaluate(() => UI.closeModal());
  }
  await pg.evaluate(() => { const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) Meeting.close(); });
  ok(await pg.evaluate(() => GameState.inbox.items.some(i => /Year 2: fill the empty space/.test(i.title || ''))), 'Jenkins in Year 2: hire an Asset Manager, lease up one building');

  // buyback on the credit line, and Jenkins explains the line
  const bb = await pg.evaluate(() => { GameState.balance.cash = 1; GameState.company.lastBuybackYear = 0; const r = Financials.buybackShares(0.3); return { ok: r.success, cash: GameState.balance.cash, log: (GameState.company.capLog || []).length }; });
  ok(bb.ok && bb.cash < 0 && bb.log > 0, 'buyback paid partly from the credit line (cash ' + bb.cash + ')');
  await pg.evaluate(() => { if (GameState._pendingDecision) { UI.openPendingDecision(); const c = document.querySelector('#modal-body .decision-choice:not(.decision-choice-disabled)'); c && c.click(); } UI.closeModal(); });
  await pg.click('#btn-advance-quarter'); await wait(1100); await pg.evaluate(() => UI.closeModal());
  ok(await pg.evaluate(() => GameState.inbox.items.some(i => /using the credit line/.test(i.title || ''))), 'Jenkins explains the credit line the first time we use it');

  // the chart
  await pg.evaluate(() => showView('finance')); await wait(400);
  await pg.evaluate(() => document.getElementById('chart-share-price').scrollIntoView()); await wait(200);
  await pg.screenshot({ path: OUT + '/rA_chart.png' });
  ok(await pg.evaluate(() => /NAV per share/.test(document.querySelector('.charts-grid').textContent)), 'chart: share price vs NAV per share');
  ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
