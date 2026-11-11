/* browser_round43b.js — round 43, second half: the quarterly results card, the
   inbox drawer on every tab, the staff seats, letters showing their gist, stats
   for nerds (Yield vs WACC, deal history, lifetime) and the career stats.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round43b.js" [outdir] */
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
  await pg.goto(R); await wait(300);
  await pg.evaluate(() => { localStorage.clear(); UI.newGame(); UI.closeModal(); }); await wait(700);
  await pg.evaluate(() => { Story.S().due = null; GameState._pendingDecision = null; GameState.debtTranches.forEach(t => { t.maturityYear += 12; }); });

  // 1. letters show their gist; the drawer on other tabs
  const gs = await pg.evaluate(() => { UI.renderAll(); const g = document.querySelector('.ib-msg:not(.open) .ib-gist'); return g ? g.textContent : ''; });
  ok(/more/.test(gs) && gs.length < 140, 'a closed letter shows its gist: "' + gs + '"');
  const dr = await pg.evaluate(async () => { showView('finance'); await new Promise(r => setTimeout(r, 50)); const d = document.getElementById('ib-drawer'), inside = !!d.querySelector('#inbox'), h = document.getElementById('ibd-handle').textContent;
    document.getElementById('ibd-handle').click(); const open = document.body.classList.contains('ib-open'); document.getElementById('ibd-handle').click();
    showView('map'); const back = !!document.querySelector('#view-map .home-rail #inbox'); return { inside, h, open, back, hidden: d.classList.contains('hidden') }; });
  ok(dr.inside && /Inbox/.test(dr.h) && dr.open && dr.back && dr.hidden, 'on Finance the inbox is a drawer ("' + dr.h + '"), it opens, and returns to its column on the Map');

  // 2. the quarterly results card
  for (let i = 0; i < 2; i++) { await pg.evaluate(() => { Story.S().due = null; GameState._pendingDecision = null; UI.closeModal(); UI.advanceQuarter(); }); await wait(900);
    await pg.evaluate(() => { UI.closeModal(); const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) Meeting.close(); }); }
  await pg.evaluate(() => { showView('map'); UI.renderAll(); });
  const rc = await pg.evaluate(() => { const it = (GameState.inbox.items || []).filter(i => i.kind === 'summary').pop(); const el = document.querySelector('.ib-summary.rc');
    return { card: !!(it && it.card), tiles: el ? el.querySelectorAll('.rc-t').length : 0, jen: el ? (el.querySelector('.rc-jen') || {}).textContent : '', det: el ? !!el.querySelector('.rc-detail') : null }; });
  ok(rc.card && rc.tiles === 4 && rc.jen && rc.det === false, 'results card: 4 tiles, details folded, Jenkins: "' + (rc.jen || '').trim() + '"');
  await pg.screenshot({ path: OUT + '/r43_results.png', clip: { x: 1060, y: 60, width: 380, height: 520 } });

  // 3. staff: five seats, an empty seat shows its candidates
  const st = await pg.evaluate(() => { showView('staff'); UI.renderAll(); const seats = document.querySelectorAll('.seats .seat'); const e = document.querySelector('.seats .seat.empty');
    const role = e ? e.querySelector('.seat-role').textContent : ''; if (e) e.click(); const head = (document.querySelector('#talent-market-header .panel-title') || {}).textContent || '';
    return { n: seats.length, role, head, cands: document.querySelectorAll('#talent-market .candidate-card').length }; });
  ok(st.n === 5 && st.head.indexOf(st.role) > -1, 'staff: ' + st.n + ' seats; clicking "' + st.role + '" shows "' + st.head + '" (' + st.cands + ' candidates)');
  await pg.screenshot({ path: OUT + '/r43_staff.png' });

  // 4. stats for nerds: folded; Yield vs WACC, deal history with a buy and a sale, lifetime
  const nd = await pg.evaluate(() => { const G = GameState; G.balance.cash = 300;
    const m = G.propertyMarket.filter(p => p.listedByOwner).sort((a, c) => a.askingPrice - c.askingPrice)[0]; Properties.buyProperty(m.id);
    for (let i = 0; i < 3; i++) { Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null; }
    Properties.sellProperty(G.portfolio[0].id); Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null;
    showView('finance'); const d = document.getElementById('nerd-stats'); const closed = !d.open; d.open = true; Nerd.render();
    const t = document.getElementById('nerd-body').textContent; return { closed, svg: !!document.querySelector('#nerd-body svg'), rows: document.querySelectorAll('#nerd-body .nd-t tr').length - 1, sold: /sold Y/.test(t), wacc: (t.match(/WACC [\d.]+%/) || [''])[0], spread: (t.match(/Spread [+−][\d.]+ pts/) || [''])[0] }; });
  ok(nd.closed && nd.svg && nd.rows >= 5 && nd.sold && nd.wacc && nd.spread, 'stats for nerds (folded): ' + nd.wacc + ', ' + nd.spread + '; ' + nd.rows + ' deals incl. a sale');
  await pg.screenshot({ path: OUT + '/r43_nerd.png', fullPage: true });

  // 5. career stats on the game-over screen
  const cs = await pg.evaluate(() => { const G = GameState; Scores.test(true); window.fetch = async () => ({ ok: true, json: async () => ({ scores: [] }) }); G.meta.gameOver = true; G.meta.gameOverReason = 'Test.'; G._endingShown = true; UI.showGameOver();
    return document.getElementById('nerd-career').textContent; });
  ok(/Career stats/.test(cs) && /Dividends paid/.test(cs), 'game over: "' + cs.replace(/\s+/g, ' ').slice(0, 110) + '…"');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
