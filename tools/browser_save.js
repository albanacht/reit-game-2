/* browser_save.js — save & continue in a real headless Chrome: play, reload
   the page, press Continue, and check nothing was lost.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_save.js" <outdir> */
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
  const closeAll = () => pg.evaluate(() => { UI.closeModal(); GameState._pendingBoardMeeting = false;
    if (window.Meeting && document.getElementById('meeting') && !document.getElementById('meeting').classList.contains('hidden')) { Meeting.flush(); Meeting.close(); }
    document.querySelectorAll('#annual-report-overlay,#board-meeting-overlay').forEach(o => o.classList.add('hidden')); });
  const fp = () => pg.evaluate(() => ({
    date: GameState.meta.year + 'Q' + GameState.meta.quarter, tq: GameState.meta.totalQuarters,
    cash: GameState.balance.cash, price: GameState.company.sharePrice, shares: GameState.company.sharesOutstanding,
    props: GameState.portfolio.map(p => p.id).sort().join(','), rivals: GameState.cityRivals.length,
    inbox: (GameState.inbox || { items: [] }).items.length, pending: !!GameState._pendingDecision,
    pendTitle: GameState._pendingDecision ? GameState._pendingDecision.headline : '',
    deck: (GameState._deck || []).length, tenants: Object.keys(GameState.tenants || {}).length,
    hist: GameState.history.length, staff: GameState.staff.length }));

  await pg.goto(R); await wait(500);
  await pg.evaluate(() => localStorage.clear()); await pg.reload(); await wait(500);
  ok(await pg.evaluate(() => document.getElementById('btn-continue').classList.contains('hidden')), 'fresh browser: no Continue button');

  // play: new game, a purchase, then quarters until a decision is waiting
  await pg.evaluate(() => { document.getElementById('input-reit-name').value = 'Albanacht'; document.getElementById('btn-new-game-go').click(); });
  await wait(900); await closeAll();
  await pg.evaluate(() => { const p = GameState.propertyMarket.filter(x => x.askingPrice < GameState.balance.cash - 5)[0]; if (p) Properties.buyProperty(p.id); UI.renderAll(); });
  for (let i = 0; i < 16; i++) {
    const s = await fp(); if (s.pending) break;
    await pg.click('#btn-advance-quarter'); await wait(700); await closeAll();
  }
  const before = await fp();
  console.log('before reload:', JSON.stringify(before));
  const size = await pg.evaluate(k => (localStorage.getItem(k) || '').length, 'reitsim2.save');
  console.log('save size: ' + (size / 1024).toFixed(0) + ' KB');

  // close the "tab": reload the page
  await pg.reload(); await wait(700);
  ok(await pg.evaluate(() => !document.getElementById('btn-continue').classList.contains('hidden')), 'after reload: Continue button shown');
  console.log('continue label:', await pg.evaluate(() => document.getElementById('continue-label').textContent));
  await pg.click('#btn-continue'); await wait(700);
  const after = await fp();
  console.log('after continue:', JSON.stringify(after));
  for (const k of ['date', 'tq', 'cash', 'price', 'shares', 'props', 'rivals', 'inbox', 'pending', 'deck', 'tenants', 'hist', 'staff'])
    ok(before[k] === after[k], 'same ' + k + (before[k] === after[k] ? '' : ` (${before[k]} -> ${after[k]})`));
  ok(!(await pg.evaluate(() => document.getElementById('start-overlay').classList.contains('hidden') === false)), 'start screen hidden after Continue');
  await pg.screenshot({ path: OUT + '/save_continued.png' });

  // the game keeps working after loading
  if (after.pending) { await pg.click('#btn-advance-quarter'); await wait(300);
    await pg.evaluate(() => { const c = document.querySelector('.decision-choice:not(.decision-choice-disabled)'); c && c.click(); }); await wait(300); }
  await closeAll();
  const q0 = (await fp()).tq; await pg.click('#btn-advance-quarter'); await wait(800); await closeAll();
  ok((await fp()).tq === q0 + 1, 'loaded game advances a quarter');

  // menu -> new game deletes the save
  await pg.evaluate(() => UI.openMenu()); await wait(100);
  await pg.evaluate(() => [...document.querySelectorAll('#modal-actions button')].find(x => /new game/i.test(x.textContent)).click()); await wait(200);
  await pg.evaluate(() => [...document.querySelectorAll('#modal-actions button')].find(x => /Delete/.test(x.textContent)).click()); await wait(200);
  ok(await pg.evaluate(() => !localStorage.getItem('reitsim2.save') && !document.getElementById('start-overlay').classList.contains('hidden')),
     'Menu > new game deletes the save and shows the start screen');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
