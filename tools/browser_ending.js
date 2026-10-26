/* browser_ending.js — round 14, the visual novel ending (ending.js): sets up
   story outcomes, ends the run, clicks through every card (screenshots) to
   the score screen; then a "fired" run.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_ending.js" <outdir> */
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
  for (let i = 0; i < 4; i++) { await pg.click('#btn-advance-quarter'); await wait(700); await pg.evaluate(() => { GameState._pendingDecision = null; UI.closeModal(); const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) Meeting.close(); }); }
  await pg.evaluate(() => {
    Object.assign(Story.H(), { stage: 'done', result: 'repaid' });
    War.debug({ stage: 'done', ending: 'takeover' });
    Tower.debug({ stage: 'trophy', ending: 'trophy', seb: 'gone', williamsGone: 'honour' });
    IndexFund.debug({ stage: 'in', told: true });
    Pay.L().cash = 25;
    GameState.board.chair = 'okafor'; Directors.removeDirector('williams'); Directors.addDirector('tex', 6, 't');
    GameState.meta.gameOver = true; GameState.meta.gameWon = true; GameState.meta.gameOverReason = 'Fifteen years. Your term as CEO of My REIT is complete.';
    UI.showGameOver();
  });
  await wait(500);
  const seen = [];
  for (let i = 0; i < 20; i++) {   // round 29: more cards (the directors)
    const st = await pg.evaluate(() => { const o = document.getElementById('ending-overlay'); if (!o || o.classList.contains('hidden')) return null;
      return { label: o.querySelector('.en-label').textContent, h: (o.querySelector('h1') || {}).textContent || '', p: [...o.querySelectorAll('.en-text p')].map(x => x.textContent).join(' '), ph: !!o.querySelector('.en-ph:not(.hidden)'), src: (o.querySelector('.en-img img') || {}).src || 'faces' }; });
    if (!st) break;
    await pg.screenshot({ path: OUT + '/ending_' + i + '.png' });
    seen.push(st.label + (st.h ? ' [' + st.h + ']' : '') + ': ' + st.p.slice(0, 110) + ' {' + st.src.split('/').slice(-2).join('/') + '}');
    await pg.evaluate(() => document.querySelector('#ending-overlay .en-next').click()); await wait(300);
  }
  seen.forEach(s => console.log('   ' + s));
  ok(seen.length >= 7 && /Your ending \[(Divine status|The builder|The rich survivor|The caretaker)\]/.test(seen[0]), 'a full run: ' + seen.length + ' cards, first: ' + seen[0].slice(0, 60));
  ok(seen.some(s => /Rennick Capital is part of/.test(s)) && seen.some(s => /Celestial Heights is full/.test(s)) && seen.some(s => /140 stores/.test(s)) && seen.some(s => /Index funds own/.test(s)), 'each story has its card (Bob, Kessler, the tower, the index)');
  ok(await pg.evaluate(() => !document.getElementById('gameover-overlay').classList.contains('hidden')), 'then the score screen');
  // fired
  await pg.evaluate(() => { document.getElementById('gameover-overlay').classList.add('hidden'); UI.newGame(); UI.closeModal(); });
  await wait(1200);
  const f = await pg.evaluate(() => { GameState.meta.gameOver = true; GameState.meta.gameOverReason = 'The board voted 4-1 to remove you as CEO of My REIT after Year 3, a year after putting you on probation.'; UI.showGameOver();
    const o = document.getElementById('ending-overlay'); return { h: o.querySelector('h1').textContent, n: Ending.cards().length }; });
  ok(f.h === 'Shown the door', 'fired: "' + f.h + '", then ' + f.n + ' cards');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
