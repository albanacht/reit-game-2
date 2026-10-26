/* browser_inbox.js — plays the inbox in a real headless Chrome and takes
   screenshots. Needs: cd /tmp/pp && npm i @sparticuz/chromium puppeteer-core
   Run: cd /tmp/pp && node "<repo>/tools/browser_inbox.js" <outdir>          */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = '/sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const OUT = process.argv[2] || '/tmp';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  await pg.goto('file://' + R); await wait(400);
  await pg.evaluate(() => UI.newGame());
  // the board's welcome letter: wait for it, press Begin like a player
  for (let i = 0; i < 20; i++) {
    await wait(200);
    const up = await pg.evaluate(() => !document.getElementById('modal-overlay').classList.contains('hidden'));
    if (up) { await pg.evaluate(() => document.querySelector('#modal-actions button').click()); break; }
  }
  await wait(600);
  const clearOverlays = () => pg.evaluate(() => {
    UI.closeModal(); GameState._pendingBoardMeeting = false;
    document.querySelectorAll('#annual-report-overlay,#board-meeting-overlay,#gameover-overlay').forEach(o => o.classList.add('hidden'));
    if (window.Meeting && document.getElementById('meeting') && !document.getElementById('meeting').classList.contains('hidden')) { Meeting.flush(); Meeting.close(); }
  });
  const inbox = () => pg.evaluate(() => ({
    kinds: (GameState.inbox ? GameState.inbox.items : []).reduce((a, i) => (a[i.kind] = (a[i.kind] || 0) + 1, a), {}),
    count: (document.getElementById('inbox-count') || {}).textContent,
    badge: (document.querySelector('.tb-tab[data-view="map"] .tb-badge') || {}).textContent || '',
    adv: document.getElementById('btn-advance-quarter').textContent,
    modalOpen: !document.getElementById('modal-overlay').classList.contains('hidden'),
    date: document.getElementById('tb-date').textContent }));

  let s = await inbox();
  console.log('turn 1:', JSON.stringify(s));
  ok(s.kinds.message >= 2 && !s.modalOpen, 'Jenkins tutorial arrives as inbox messages, no popup');
  await pg.screenshot({ path: OUT + '/inbox_turn1.png' });

  // open the first message
  await pg.click('#inbox-list .ib-msg'); await wait(150);
  ok(await pg.evaluate(() => !!document.querySelector('#inbox-list .ib-msg.open')), 'clicking a message opens it');

  // play until a decision is waiting
  let shot = false;
  for (let i = 0; i < 16; i++) {
    await pg.click('#btn-advance-quarter'); await wait(1500); await clearOverlays(); await wait(200);
    s = await inbox();
    if (/Decide first/.test(s.adv)) {
      console.log('decision waiting:', JSON.stringify(s));
      ok(!!(await pg.$('#inbox-list .ib-decision')), 'decision is pinned in the inbox');
      await pg.evaluate(() => showView('map'));
      await pg.screenshot({ path: OUT + '/inbox_decision.png' }); shot = true;
      const before = s.date;
      await pg.click('#btn-advance-quarter'); await wait(300);        // should OPEN the decision, not advance
      s = await inbox();
      ok(s.modalOpen && s.date === before, 'Advance opens the decision instead of running the quarter');
      await pg.evaluate(() => { const c = document.querySelector('.decision-choice:not(.decision-choice-disabled)'); c && c.click(); });
      await wait(300); s = await inbox();
      ok(!/Decide first/.test(s.adv) && s.date === before, 'answering unblocks Advance, still the same turn');
      ok(!!(await pg.$('#inbox-list .ib-decided')), 'answered decision stays in the inbox as a record');
      await pg.screenshot({ path: OUT + '/inbox_after.png' });
      break;
    }
  }
  ok(shot, 'a decision appeared within 16 quarters');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
