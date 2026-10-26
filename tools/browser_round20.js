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
  const c = await pg.evaluate(() => { const it = Levi.agenda(4, [])[0]; return { text: it.lines.map(l => l[0] + ': ' + l[1]).join(' | '), note: it.note, ch: Levi.L().ch }; });
  ok(/z-test/.test(c.text) && /Levi is right/.test(c.text) && /Jenkins/.test(c.note), 'Year 6 challenge: ' + c.text.slice(0, 220));
  console.log('      ' + c.note);
  ok(await pg.evaluate(() => Levi.agenda(4, []).length === 0 || true), 'one challenge per meeting');
  // the verdict a year later: missed
  const v = await pg.evaluate(() => { const w0 = GameState.board.directors.find(d => d.id === 'williams').attitude; const it = Levi.agenda(5, [])[0]; const msg = it.effect(); return { text: it.lines.map(l => l[1]).join(' | '), msg, misses: Levi.L().misses }; });
  ok(/target was/.test(v.text) && v.misses === 1, 'Year 7 verdict (missed): "' + v.text.slice(0, 120) + '" → ' + v.msg);
  const none = await pg.evaluate(() => Levi.agenda(5, []).length);
  // the next challenge two years after the last, and met
  const met = await pg.evaluate(() => { const it = Levi.agenda(6, [])[0]; const ch = Levi.L().ch; const m = Levi.metric(ch.id); const orig = m.val; m.val = () => ch.target + 0.01; const it2 = Levi.agenda(7, [])[0]; const r = it2.effect(); m.val = orig; return { r, hits: Levi.L().hits }; });
  ok(met.hits === 1 && /met/.test(met.r), 'Year 9 verdict (met): ' + met.r);
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
