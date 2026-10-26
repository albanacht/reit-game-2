/* browser_round23.js — anonymous play counts (telemetry.js) and the feedback
   window. GoatCounter is stubbed (nothing is sent from a file on disk anyway):
   checks which events fire, once per game, and that a missing count.js never
   breaks the game.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round23.js" [outdir] */
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
  const local = await pg.evaluate(() => !document.querySelector('script[data-goatcounter]'));
  ok(local, 'opened from disk: count.js is not loaded, nothing is sent');
  // 1. without count.js the game still runs (events are queued and dropped)
  const a = await pg.evaluate(() => { localStorage.clear(); UI.newGame(); UI.closeModal(); Financials.runQuarter(); return GameState.meta.quarter; });
  ok(a === 2, 'no GoatCounter: the game plays on');
  // 2. stub GoatCounter and play: game-start, q1-played, reached-y2, used-offer, ending
  const r = await pg.evaluate(() => { window.__sent = []; window.goatcounter = { count: v => __sent.push(v.path + (v.event ? '' : ' (not an event)')) };
    localStorage.clear(); UI.newGame(); UI.closeModal();
    const q = () => { Financials.runQuarter(); Board.evaluateQuarter(); const s = Story.S(); if (s.due) s.due = null; GameState._pendingDecision = null; };
    for (let i = 0; i < 5; i++) q();
    const p = GameState.propertyMarket.find(x => !x.listedByOwner && !Deals.blocked(x.id)); GameState.balance.cash = 300; Deals.offer(p.id, p.currentValue * 1.2); Deals.offer(p.id, p.currentValue * 1.3);
    q();
    Telemetry.ending('caretaker'); Telemetry.ending('caretaker');
    return __sent.slice(__sent.lastIndexOf('game-start')); });   // the first game's queued events arrive first
  ok(['game-start', 'q1-played', 'reached-y2', 'used-offer', 'ending-caretaker'].every(e => r.indexOf(e) > -1), 'events: ' + r.join(', '));
  ok(r.filter(e => e === 'q1-played').length === 1 && r.filter(e => e === 'ending-caretaker').length === 1 && r.filter(e => e === 'used-offer').length === 1, 'each counted once per game');
  ok(r.every(e => !/not an event/.test(e)), 'all sent as events');
  // 3. a reload does not count again; continuing is its own event
  await pg.evaluate(() => Save.save());
  await pg.reload(); await wait(800);
  const c = await pg.evaluate(() => { window.__sent = []; window.goatcounter = { count: v => __sent.push(v.path) };
    const btn = [...document.querySelectorAll('button')].find(x => /Continue/.test(x.textContent)); if (btn) btn.click();
    Financials.runQuarter(); return __sent.slice(); });
  ok(c.indexOf('game-continue') > -1 && c.indexOf('q1-played') === -1 && c.indexOf('reached-y2') === -1, 'after a reload: ' + c.join(', '));
  // 4. the feedback window, from the menu
  const f = await pg.evaluate(() => { window.__sent = []; UI.closeModal(); document.getElementById('btn-menu').click();
    const fb = [...document.querySelectorAll('#modal-actions button')].find(x => /feedback/i.test(x.textContent)); fb.click(); return !!fb; });
  await wait(200);
  await pg.screenshot({ path: OUT + '/r23_feedback.png' });
  const f2 = await pg.evaluate(() => { const t = document.getElementById('modal-title').textContent;
    document.querySelector('.fb-b[data-g="stars"][data-v="4"]').click(); document.querySelector('.fb-b[data-g="stuck"][data-v="board"]').click(); document.querySelector('.fb-b[data-g="again"][data-v="yes"]').click();
    [...document.querySelectorAll('#modal-actions button')].find(x => x.textContent === 'Send').click(); return { t, sent: __sent.slice() }; });
  ok(f && /How was it/.test(f2.t), 'Menu → Send feedback opens "' + f2.t + '"');
  ok(['feedback-stars-4', 'feedback-stuck-board', 'feedback-again-yes'].every(e => f2.sent.indexOf(e) > -1), 'three taps sent: ' + f2.sent.join(', '));
  // 5. the ending's last page has "Rate the game"
  const e = await pg.evaluate(() => { Ending.show(() => {}); const o = document.getElementById('ending-overlay'); let n = 0; while (!o.querySelector('.en-fb') && o.querySelector('.en-next') && n++ < 20) o.querySelector('.en-next').click(); return !!o.querySelector('.en-fb'); });
  ok(e, 'the last ending page offers "Rate the game"');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
