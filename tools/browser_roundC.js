/* browser_roundC.js — round 11, the board: directors' own shares, two
   demands tied to complaints (a promise becomes the demand), the trade
   option, and Harlow in the board room (Bob as a guest: the offer, the loan,
   the yearly review, the loan falling due at a meeting).
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_roundC.js" <outdir> */
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
  const meetingUp = () => pg.evaluate(() => { const m = document.getElementById('meeting'); return !!m && !m.classList.contains('hidden'); });
  async function toMeeting() {
    for (let i = 0; i < 6; i++) {
      if (await meetingUp()) return true;
      await pg.evaluate(() => { for (let k = 0; k < 3 && GameState._pendingDecision; k++) { UI.openPendingDecision(); const c = document.querySelector('#modal-body .decision-choice:not(.decision-choice-disabled):not(.decision-hold)'); if (c) c.click(); else { GameState._pendingDecision = null; } } UI.closeModal(); });
      await pg.click('#btn-advance-quarter'); await wait(900); await pg.evaluate(() => UI.closeModal());
    }
    return meetingUp();
  }
  async function through(choose, shots) {
    const seen = [];
    for (let step = 0; step < 60; step++) {
      await wait(150); await pg.evaluate(() => Meeting.flush()); await wait(80);
      const st = await pg.evaluate(() => ({ btns: [...document.querySelectorAll('#mt-actions .mt-btn')].map(b => ({ t: b.querySelector('b').textContent, dis: b.disabled })), prompt: (document.querySelector('#mt-actions .mt-prompt') || {}).textContent || '' }));
      if (!st.btns.length) continue;
      seen.push(st.prompt + ' :: ' + st.btns.map(x => x.t).join(' | '));
      if (shots && shots(st.prompt)) await pg.screenshot({ path: OUT + '/' + shots(st.prompt) + '.png' });
      const last = /^(Back to work|Leave the boardroom)/.test(st.btns[0].t);
      let i = choose(st.prompt, st.btns); if (i < 0 || !st.btns[i] || st.btns[i].dis) i = st.btns.findIndex(x => !x.dis);
      await pg.evaluate(i => document.querySelectorAll('#mt-actions .mt-btn')[i].click(), i);
      if (last) break;
    }
    return seen;
  }

  // directors' own shares
  await pg.click('#btn-advance-quarter'); await wait(900); await pg.evaluate(() => UI.closeModal());
  await pg.evaluate(() => { showView('board'); BoardTab.render(); }); await wait(200);
  ok(await pg.evaluate(() => /Owns 120,000 shares/.test(document.getElementById('bd-cards').textContent)), 'Williams owns 120,000 shares, on his card');
  await pg.evaluate(() => showView('map'));

  // Year 1 meeting: promise to the unhappy director, two demands, the promise first
  await pg.evaluate(() => GameState.board.directors.find(d => d.id === 'okafor').attitude = 2);
  ok(await toMeeting(), 'Year 1 meeting');
  await through((p, b) => /wants an answer/.test(p) ? 0 : 0);
  const dm = await pg.evaluate(() => GameState.board.activeMandates.map(m => ({ id: m.directorId, t: m.text, p: !!m.promise })));
  ok(dm.length === 2, 'two demands: ' + dm.map(m => m.id + (m.p ? ' (promise)' : '') + ': ' + m.t).join(' / '));

  // Year 2 meeting: Bob's offer, with Bob as a guest
  await pg.evaluate(() => { Story.H().offerNow = true; GameState.balance.cash = 90; });
  ok(await toMeeting(), 'Year 2 meeting');
  let guest = false;
  const s2 = await through((p, b) => /distribution centre/.test(p) ? 0 : 0, p => /distribution centre/.test(p) ? 'rC_offer' : null);
  ok(s2.some(x => /distribution centre/.test(x)), 'Bob’s offer is on the agenda');
  ok(await pg.evaluate(() => GameState.portfolio.some(p => p.id === 'ind_hdc')), 'bought it in the room');

  // the loan, at the next meeting
  await pg.evaluate(() => { const h = Story.H(); h.stage = 'late'; GameState.balance.cash = 60; const t = GameState.tenants.harlow_grocers; t.coverage = 1.2; t.base = 1.2; });
  ok(await toMeeting(), 'Year 3 meeting');
  const s3 = await through((p, b) => /loan/.test(p) ? 0 : 0, p => /asks for a loan/.test(p) ? 'rC_loan' : null);
  const L = await pg.evaluate(() => Story.H().loan);
  ok(s3.some(x => /asks for a loan/.test(x)) && L && L.dueYear === 5, 'Bob asked the board in person; lent, due at the Year 5 meeting');

  // review then maturity at the meeting
  await pg.evaluate(() => { const L = Story.H().loan; L.missed = 1; });
  ok(await toMeeting(), 'Year 4 meeting');
  const s4 = await through((p, b) => /keep or call/.test(p) ? 0 : 0);
  ok(s4.some(x => /keep or call/.test(x)), 'the yearly review: keep or call the loan');
  await pg.evaluate(() => { const t = GameState.tenants.harlow_grocers; t.coverage = 2.4; t.base = 2.4; });
  ok(await toMeeting(), 'Year 5 meeting: the loan falls due here');
  await pg.evaluate(() => { window.__r = Math.random; Math.random = () => 0.01; });
  await wait(300); await pg.evaluate(() => Meeting.flush()); await pg.evaluate(() => { Math.random = window.__r; });
  await through(() => 0);
  const h = await pg.evaluate(() => Story.H());
  ok(h.result === 'repaid' || h.stage === 'decide' || h.stage === 'loan' || h.stage === 'aftermath' || h.stage === 'done', 'maturity handled in the room: ' + (h.result || h.stage));
  ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
