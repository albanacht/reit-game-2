/* browser_round20.js — round 20: Dr. Levi Cohen (levi.js) and the Stories tab
   (journal.js). Levi's arrival, a gibberish challenge with Jenkins's
   translation, the verdict a year later, his crisis forecast, his Staff card,
   and the Stories tab listing what you have met.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round20.js" <outdir> */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const OUT = process.argv[2] || '/tmp';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'warning' && /levi|story/.test(m.text())) errs.push('warn: ' + m.text()); });
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear());
  await pg.evaluate(() => UI.newGame()); await wait(1500); await pg.evaluate(() => UI.closeModal());
  await pg.evaluate(() => { window.__pick = (it, re) => { const c = it.choices.find(x => re.test(x.label) && !x.disabled) || it.choices.find(x => !x.disabled); return c.go(); }; });
  const a = await pg.evaluate(() => { const g0 = GameState._gaSurcharge || 0; const it = Levi.agenda(3, [])[0]; const lines = it.lines.map(l => l[0]).join(','); const m = __pick(it, /Hire/); return { lines, m, g: (GameState._gaSurcharge || 0) - g0, st: Levi.L().stage }; });
  ok(a.st === 'hired' && Math.abs(a.g - 0.15) < 0.001, 'Year 3 (fallback; the letter is in round 33): Petrova brings Levi (' + a.lines + '); hired at $0.6M a year: ' + a.m);
  // round 37: the yearly challenges are retired (Moneyball Levi: browser_round37.js). At most one awkward line, no targets.
  const c = await pg.evaluate(() => { const all = [4, 5, 6, 7, 8].map(y => Levi.agenda(y, [])), js = JSON.stringify(all); return { n: all.reduce((a, x) => a + x.length, 0), target: /by the next meeting|target was/.test(js), w: GameState.board.directors.find(d => d.id === 'williams').attitude }; });
  ok(c.n <= 1 && !c.target, 'no more challenges at the meetings (' + c.n + ' awkward line)');
  // the crisis forecast
  const f = await pg.evaluate(() => { const ph = Arc.phase; const now = (GameState.meta.year - 1) * 4 + GameState.meta.quarter; Arc.phase = t => (t || now) >= now + 2 ? 'crisis' : 'cheap'; const out = []; Levi.processQuarter(out); Arc.phase = ph; UI.renderAll();
    return ((document.getElementById('inbox-list') || {}).textContent.match(/A regime change[^]{0,160}/) || [''])[0]; });
  ok(/crisis within two quarters/.test(f), 'his forecast in the inbox: "' + f.slice(0, 150) + '"');
  // staff card
  await pg.evaluate(() => { showView('staff'); UI.renderAll(); }); await wait(300);
  ok(await pg.evaluate(() => /Dr\. Levi Cohen/.test(document.getElementById('staff-roster').textContent)), 'Levi on the Staff screen');
  await pg.screenshot({ path: OUT + '/r20_staff.png' });
  // the Stories tab
  await pg.evaluate(() => { Story.H().stage = 'loan'; Story.H().loan = { amt: 24, dueYear: 6 }; War.debug({ stage: 'war', heat: 60, leaked: true, log: [{ q: 13, t: 'Won Morrow Plaza. The war began.' }] }); Gary.debug({ stage: 'run', stake: 0.4, earned: 0.6, log: [{ q: 9, t: 'Bought 40% of Lakeside.' }] }); });
  await pg.evaluate(() => document.querySelector('.tb-tab[data-view="stories"]').click()); await wait(300);
  const st = await pg.evaluate(() => [...document.querySelectorAll('#stories-body .jr-card b')].map(x => x.textContent));
  ok(st.length >= 4 && st.indexOf('Bob Harlow') > -1 && st.indexOf('The Rennick war') > -1 && st.indexOf('Dr. Levi Cohen') > -1, 'Stories tab: ' + st.join(', '));
  await pg.screenshot({ path: OUT + '/r20_stories.png' });
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
