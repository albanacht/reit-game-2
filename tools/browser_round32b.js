/* browser_round32b.js — round 32: a guest (Levi) is seated from the first line of the meeting. */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear());
  await pg.evaluate(() => UI.newGame()); await wait(1300);
  await pg.evaluate(() => { const G = GameState; UI.closeModal(); G.meta.year = 3; G.meta.quarter = 1; G.board._storyYear = 0; G.board._meetingYear = 0; Levi.L().stage = 'wait'; Meeting.open(); });
  await wait(300);
  const g = await pg.evaluate(() => [...document.querySelectorAll('#mt-portraits .mt-p.guest')].map(x => x.textContent.trim().replace(/\s+/g, ' ')));
  ok(g.some(x => /Levi|Cohen/.test(x)), 'guest seated from the first line: ' + g.join(', '));
  await pg.screenshot({ path: '/tmp/o/r32_guest.png' });
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' / ') : ''));
  await b.close();
})();
