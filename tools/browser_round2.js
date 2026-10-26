/* browser_round2.js — "understand what happened": start screen, letter,
   tutorial ticks, tooltips, run-to-year-end, because-lines. Real Chrome.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round2.js" <outdir> */
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
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await wait(500);
  await pg.screenshot({ path: OUT + '/r2_start.png' });
  ok(await pg.evaluate(() => /Borrow cheap/.test(document.querySelector('.start-loop').textContent)), 'start screen: core loop sentence');

  await pg.evaluate(() => document.getElementById('btn-new-game-go').click()); await wait(900);
  const letter = await pg.evaluate(() => (document.getElementById('inbox-list') || {}).textContent || '');
  ok(/Year 1 is yours/.test(letter) && !/legend/.test(letter), 'welcome: Williams\u2019s short inbox letter');
  await pg.evaluate(() => UI.closeModal()); await wait(400);

  const chips = () => pg.evaluate(() => [...document.querySelectorAll('#inbox-list .ib-msg')].map(m => m.querySelector('.ib-title').textContent));
  console.log('     inbox:', JSON.stringify(await chips()));
  ok((await chips()).some(t => /Borrow.*To do/.test(t)), 'Step 1 shows "To do"');
  // do step 1 the way a player would: Finance > Borrow
  await pg.evaluate(() => { showView('finance'); document.getElementById('input-debt-amount').value = 50; document.getElementById('input-debt-years').value = 7;   /* round 27: 7 years max */ document.getElementById('btn-issue-debt').click(); });
  await wait(300); await pg.evaluate(() => [...document.querySelectorAll('#modal-actions button')].find(b => /Secured/.test(b.textContent)).click());
  await wait(400); await pg.evaluate(() => showView('map')); await wait(300);
  const after = await chips();
  console.log('     inbox:', JSON.stringify(after));
  ok(after.some(t => /Borrow.*Done/.test(t)) && after.some(t => /Done: you borrowed/.test(t)), 'Step 1 ticks to Done, Jenkins confirms');
  await pg.screenshot({ path: OUT + '/r2_inbox.png', clip: { x: 1060, y: 60, width: 380, height: 640 } });

  // tooltip on hover
  await pg.evaluate(() => showView('finance')); await wait(300);
  const tagged = await pg.evaluate(() => document.querySelectorAll('[data-tip]').length);
  const affo = await pg.$('.pnl-table td.has-tip');
  if (affo) { const bx = await affo.boundingBox(); await pg.mouse.move(bx.x + 10, bx.y + 6); await wait(200); }
  const tip = await pg.evaluate(() => { const t = document.getElementById('tipbox'); return t && t.style.display === 'block' ? t.textContent : ''; });
  console.log('     terms with tooltips on Finance: ' + tagged + ' | hover shows: "' + tip.slice(0, 60) + '"');
  ok(tagged >= 25 && tip.length > 10, 'tooltips on terms, shown on hover');
  await pg.screenshot({ path: OUT + '/r2_tip.png', clip: { x: 0, y: 330, width: 900, height: 420 } });
  await pg.mouse.move(5, 5);

  // run to year end
  await pg.evaluate(() => showView('map'));
  const q0 = await pg.evaluate(() => GameState.meta.totalQuarters);
  await pg.click('#btn-run-year');
  for (let i = 0; i < 30; i++) { await wait(300); if (await pg.evaluate(() => document.getElementById('btn-run-year').textContent.indexOf('Stop') === -1)) break; }
  const st = await pg.evaluate(() => ({ q: GameState.meta.totalQuarters, label: GameState.meta.year + 'Q' + GameState.meta.quarter,
    toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).pop() || '' }));
  console.log('     ran from quarter ' + q0 + ' to ' + st.q + ' (' + st.label + '). ' + st.toast);
  ok(st.q > q0 && /Stopped/.test(st.toast), 'Year end runs several quarters and says why it stopped');

  // because-lines after a couple more quarters
  await pg.evaluate(() => { for (let i = 0; i < 3; i++) { if (GameState._pendingDecision) { UI.openPendingDecision(); const c = document.querySelector('.decision-choice:not(.decision-choice-disabled)'); c && c.click(); }
    UI.advanceQuarter(); UI.closeModal(); GameState._pendingBoardMeeting = false;
    document.querySelectorAll('#annual-report-overlay,#board-meeting-overlay').forEach(o => o.classList.add('hidden')); } });
  await wait(500);
  const whys = await pg.evaluate(() => GameState.inbox.items.filter(i => i.kind === 'summary' && ((i.why && i.why.length) || i.price)).length);
  ok(whys > 0, 'quarter results carry "because" lines (' + whys + ' quarters explained)');
  await pg.screenshot({ path: OUT + '/r2_because.png', clip: { x: 1060, y: 60, width: 380, height: 700 } });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
