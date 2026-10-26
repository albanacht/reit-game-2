/* browser_pay.js — round 12: your own money. The pay committee at the
   meeting (contract mix, bonus or waive, a share grant each year, vesting a
   third a year), salary every quarter, a story's special recognition, and
   unvested shares forfeited when fired. Also political capital's new cap.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_pay.js" <outdir> */
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
  ok(await pg.evaluate(() => GameState.board.maxCapital === 8), 'political capital cap is 8');
  const meetingUp = () => pg.evaluate(() => { const m = document.getElementById('meeting'); return !!m && !m.classList.contains('hidden'); });
  async function toMeeting() {
    for (let i = 0; i < 6; i++) {
      if (await meetingUp()) return true;
      await pg.evaluate(() => { for (let k = 0; k < 3 && GameState._pendingDecision; k++) { UI.openPendingDecision(); const c = document.querySelector('#modal-body .decision-choice:not(.decision-choice-disabled):not(.decision-hold)'); if (c) c.click(); else GameState._pendingDecision = null; } UI.closeModal(); });
      await pg.click('#btn-advance-quarter'); await wait(900); await pg.evaluate(() => UI.closeModal());
    }
    return meetingUp();
  }
  async function through(choose, shot) {
    const seen = [];
    for (let step = 0; step < 70; step++) {
      await wait(150); await pg.evaluate(() => Meeting.flush()); await wait(80);
      const st = await pg.evaluate(() => ({ btns: [...document.querySelectorAll('#mt-actions .mt-btn')].map(b => ({ t: b.querySelector('b').textContent, dis: b.disabled })) }));
      if (!st.btns.length) continue;
      seen.push(st.btns.map(x => x.t).join(' | '));
      if (shot && st.btns.some(x => /Mostly shares/.test(x.t))) await pg.screenshot({ path: OUT + '/' + shot + '.png' });
      const last = /^(Back to work|Leave the boardroom)/.test(st.btns[0].t);
      let i = choose(st.btns); if (i < 0 || st.btns[i].dis) i = st.btns.findIndex(x => !x.dis);
      await pg.evaluate(i => document.querySelectorAll('#mt-actions .mt-btn')[i].click(), i);
      if (last) break;
    }
    return seen;
  }
  const c0 = await pg.evaluate(() => Pay.wealth().cash);
  ok(await toMeeting(), 'Year 1 meeting');
  const s1 = await through(btns => { const k = btns.findIndex(x => /Mostly shares/.test(x.t)); if (k > -1) return k; const t = btns.findIndex(x => /Take the bonus/.test(x.t)); return t > -1 ? t : 0; }, 'pay_contract');
  const w1 = await pg.evaluate(() => ({ w: Pay.wealth(), pkg: Pay.L().pkg, grants: Pay.L().grants.length }));
  ok(s1.some(x => /Mostly salary \| Balanced|Mostly salary/.test(x)) && w1.pkg === 'stock', 'contract chosen in the room: mostly shares');
  ok(w1.w.cash > c0 && w1.grants === 1 && w1.w.unvested > 0, 'salary paid ($' + w1.w.cash + 'M so far), a share grant of ' + w1.w.unvested.toLocaleString() + ' unvested');
  // a story's special recognition, paid at the next meeting
  await pg.evaluate(() => { Pay.reward('a test deal', 0.4); GameState.board.directors.forEach(d => d.attitude = 6); });
  ok(await toMeeting(), 'Year 2 meeting');
  const cash1 = await pg.evaluate(() => Pay.wealth().cash);
  const s2 = await through(btns => { const t = btns.findIndex(x => /Take the bonus/.test(x.t)); return t > -1 ? t : 0; });
  const w2 = await pg.evaluate(() => ({ w: Pay.wealth(), log: Pay.L().log }));
  ok(w2.w.shares > 0, 'a third of last year’s grant vested: ' + w2.w.shares.toLocaleString() + ' shares');
  const rec = await pg.evaluate(() => [...document.querySelectorAll('#mt-chat .mt-note')].map(e => e.textContent).find(t => /Special recognition: a test deal/.test(t)) || '');
  ok(!!rec && (w2.log.some(l => l.bonus > 0.39) || /not approved/.test(rec)), 'special recognition reviewed by the pay committee: ' + rec.slice(0, 140));
  await pg.evaluate(() => { showView('board'); BoardTab.render(); }); await wait(200);
  ok(await pg.evaluate(() => /Your wealth \$/.test(document.getElementById('bd-top').textContent)), 'Board tab shows your wealth: ' + await pg.evaluate(() => document.getElementById('bd-top').textContent.match(/Your wealth[^·]*/)[0]));
  await pg.screenshot({ path: OUT + '/pay_board.png' });
  // fired: unvested shares are left behind
  const f = await pg.evaluate(() => { const u = Pay.unvested(); Pay.onFired(); return { u, after: Pay.unvested(), forfeited: Pay.wealth().forfeited }; });
  ok(f.u > 0 && f.after === 0 && f.forfeited > 0, 'fired: ' + f.u.toLocaleString() + ' unvested shares forfeited ($' + f.forfeited + 'M)');
  ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
