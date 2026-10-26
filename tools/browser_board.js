/* browser_board.js — round 8: reputation, a director pushed out at the
   meeting and replaced (Grace), Grace's ESG initiatives and the price bracket,
   cancelling one (his red line), the lobbyist Tex, and the Harlow exposé.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_board.js" <outdir> */
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
  await pg.evaluate(() => UI.newGame()); await wait(1200); await pg.evaluate(() => UI.closeModal());
  const meetingUp = () => pg.evaluate(() => { const m = document.getElementById('meeting'); return !!m && !m.classList.contains('hidden'); });
  const pendingId = () => pg.evaluate(() => GameState._pendingDecision ? GameState._pendingDecision.id : null);
  async function answerPending(pick) {
    for (let i = 0; i < 3; i++) {
      const p = await pendingId(); if (!p) return;
      await pg.evaluate(i => { UI.openPendingDecision(); const c = [...document.querySelectorAll('#modal-body .decision-choice:not(.decision-choice-disabled):not(.decision-hold)')][i] || document.querySelector('#modal-body .decision-choice:not(.decision-choice-disabled)'); c && c.click(); }, pick && pick[p] != null ? pick[p] : 0);
      await wait(300); await pg.evaluate(() => UI.closeModal());
    }
  }
  async function playToMeeting(pick) {
    for (let i = 0; i < 6; i++) {
      if (await meetingUp()) return true;
      await answerPending(pick);
      await pg.evaluate(() => { const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) Meeting.close(); }); await pg.click('#btn-advance-quarter'); await wait(1000); await pg.evaluate(() => UI.closeModal());
    }
    return meetingUp();
  }
  async function clickThrough(choose) {
    const seen = [];
    for (let step = 0; step < 50; step++) {
      await wait(200); await pg.evaluate(() => Meeting.flush()); await wait(100);
      const st = await pg.evaluate(() => ({ btns: [...document.querySelectorAll('#mt-actions .mt-btn')].map(b => ({ t: b.querySelector('b').textContent, dis: b.disabled })),
        prompt: (document.querySelector('#mt-actions .mt-prompt') || {}).textContent || '' }));
      if (!st.btns.length) continue;
      seen.push(st.prompt + ' :: ' + st.btns.map(x => x.t).join(' | '));
      const last = /^(Back to work|Leave the boardroom)/.test(st.btns[0].t);
      let i = choose(st.prompt, st.btns); if (i < 0 || st.btns[i].dis) i = st.btns.findIndex(x => !x.dis);
      if (/seat/.test(st.prompt) || /takes the seat/.test(st.prompt)) await pg.screenshot({ path: OUT + '/board_' + seen.length + '.png' });
      await pg.evaluate(i => document.querySelectorAll('#mt-actions .mt-btn')[i].click(), i);
      if (last) break;
    }
    return seen;
  }

  ok(await pg.evaluate(() => Directors.rep('hassan') === 60 && Directors.rep('williams') === 75), 'reputations start: Hassan 60, Williams 75');
  ok(await playToMeeting(), 'Year 1 meeting (practice)');
  await clickThrough(() => 0);
  // Hassan disgraced before the Year 2 meeting
  await pg.evaluate(() => Directors.repChange('hassan', -55, 'test: a scandal'));
  ok(await playToMeeting(), 'Year 2 meeting');
  const seen = await clickThrough((p, btns) => /Hassan’s seat/.test(p) ? btns.findIndex(x => /Let Hassan go/.test(x.t)) : /takes the seat/.test(p) ? btns.findIndex(x => /Grace/.test(x.t)) : 0);
  console.log('     ' + seen.filter(x => /seat/.test(x)).join('\n     '));
  const after = await pg.evaluate(() => ({ ids: GameState.board.directors.map(d => d.id), hist: GameState.board.history.map(h => h.text) }));
  ok(after.ids.indexOf('hassan') === -1 && after.ids.indexOf('grace') > -1, 'Hassan out, Grace in: ' + after.ids.join(', '));
  console.log('     history: ' + after.hist.join(' / '));

  // Grace's first initiative arrives next quarter
  await pg.evaluate(() => { const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) Meeting.close(); }); await pg.click('#btn-advance-quarter'); await wait(1000); await pg.evaluate(() => UI.closeModal());
  for (let i = 0; i < 3 && (await pendingId()) !== 'story_esg'; i++) { await answerPending(); await pg.evaluate(() => { const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) Meeting.close(); }); await pg.click('#btn-advance-quarter'); await wait(1000); await pg.evaluate(() => UI.closeModal()); }
  ok((await pendingId()) === 'story_esg', 'Grace proposes an initiative');
  await pg.evaluate(() => UI.openPendingDecision()); await wait(300); await pg.screenshot({ path: OUT + '/board_esg.png' });
  await pg.evaluate(() => { GameState.balance.cash += 20; UI.closeModal(); UI.openPendingDecision(); });   // afford even the one-offs
  const e0 = await pg.evaluate(() => ({ s: Story.esgScore(), ga: GameState._gaSurcharge || 0 }));
  await pg.evaluate(() => document.querySelector('#modal-body .decision-choice').click()); await wait(300); await pg.evaluate(() => UI.closeModal());
  const e1 = await pg.evaluate(() => ({ s: Story.esgScore(), ga: GameState._gaSurcharge || 0, items: Story.esgItems() }));
  ok(e1.s > e0.s && e1.items.length === 1, 'backed it: ESG ' + e0.s + ' -> ' + e1.s + ' (' + e1.items[0].name + ')');
  // into the bracket
  await pg.evaluate(() => { const e = Story.S().esg; e.items.push({ id: 'offsets', name: 'Carbon offsets', rec: 0.6, pts: Math.max(30, 62 - Story.esgScore()), q: 1, y: 1 }); });   // round 21: enough to clear 60 whatever the base
  const eb = await pg.evaluate(() => ({ s: Story.esgScore(), p: Story.esgPremium(), n: Story.S().esg.items.length }));
  ok(eb.s >= 60 && eb.p === 1.05, 'ESG 60+: price bracket x1.05 (' + JSON.stringify(eb) + ')');
  await answerPending(); await pg.evaluate(() => { const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) Meeting.close(); }); await pg.click('#btn-advance-quarter'); await wait(1000); await pg.evaluate(() => UI.closeModal());
  ok(await pg.evaluate(() => (GameState._priceWhy && GameState._priceWhy.good || []).some(g => /ESG/.test(g))), 'price reasons mention ESG funds');
  // cancel one on the Board tab: Grace's red line
  await pg.evaluate(() => { showView('board'); BoardTab.render(); }); await wait(300);
  await pg.screenshot({ path: OUT + '/board_tab.png', fullPage: false });
  await pg.evaluate(() => { const x = document.querySelector('.bd-esg-x'); x && x.click(); }); await wait(200);
  await answerPending(); await pg.evaluate(() => { const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) Meeting.close(); }); await pg.click('#btn-advance-quarter'); await wait(1000); await pg.evaluate(() => UI.closeModal());
  ok(await pg.evaluate(() => GameState.board.brain.red.grace === true), 'cancelled an initiative: Grace’s red line crossed');

  // the lobbyist: Chen disgraced, 5 capital, nominate Tex
  await pg.evaluate(() => { showView('map'); Directors.repChange('chen', -50, 'test'); GameState.board.politicalCapital = 5; });
  ok(await playToMeeting(), 'Year 3 meeting');
  await clickThrough((p, btns) => /Chen’s seat/.test(p) ? btns.findIndex(x => /Let Chen go/.test(x.t)) : /takes the seat/.test(p) ? btns.findIndex(x => /Tex/.test(x.t)) : 0);
  const br = await pg.evaluate(() => ({ ids: GameState.board.directors.map(d => d.id), pc: GameState.board.politicalCapital, rep: Directors.rep('tex'), vote: Directors.votesAgainst('tex') }));
  ok(br.ids.indexOf('tex') > -1 && br.ids.indexOf('chen') === -1 && br.vote === false, 'Tex nominated (capital left ' + br.pc + ', reputation ' + br.rep + ')');
  await pg.evaluate(() => { Story.S().brennanPressQ = 1; });
  await answerPending(); await pg.evaluate(() => { const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) Meeting.close(); }); await pg.click('#btn-advance-quarter'); await wait(1000); await pg.evaluate(() => UI.closeModal());
  ok(await pg.evaluate(() => Directors.rep('tex') <= 25), 'press story: Tex’s reputation ' + await pg.evaluate(() => Directors.rep('tex')));

  // Tex's motion at the next meeting: a good year (checks stubbed to 4 of 5), take it in shares
  const unit = await pg.evaluate(() => { const c = Story.texChecks(); return { n: c.length, cash: Story.awardOdds('cash', c).approve, sh: Story.awardOdds('shares', c).approve }; });
  ok(unit.n === 5, 'five checks; approval odds now: cash ' + unit.cash + '%, shares ' + unit.sh + '%');
  await pg.evaluate(() => { window.__tc = Story.texChecks; Story.texChecks = () => window.__tc().map((c, i) => Object.assign(c, { ok: i < 4 })); GameState.board._texMotionQ = null; GameState.board.politicalCapital = 3; });
  ok(await playToMeeting(), 'next meeting');
  const sh0 = await pg.evaluate(() => GameState.company.sharesOutstanding);
  const tr = await clickThrough((p, btns) => /Tex\u2019s motion/.test(p) ? btns.findIndex(x => /shares/.test(x.t)) : /seat/.test(p) ? btns.findIndex(x => /Save|Let/.test(x.t)) : 0);
  const motion = tr.filter(x => /Tex\u2019s motion/.test(x));
  const res = await pg.evaluate(() => ({ c: Story.CEO(), sh: GameState.company.sharesOutstanding, chat: [...document.querySelectorAll('#mt-chat .mt-line')].map(e => e.textContent).filter(t => /motion|award is approved|motion fails/.test(t)).slice(-1)[0] || '' }));
  const awarded = await pg.evaluate(() => (Story.CEO().awards || []).some(a => a.kind === 'shares'));
  ok(motion.length === 1 && (awarded ? /approved/.test(res.chat) : /fails/.test(res.chat)), 'Tex moved the award and the board voted: ' + res.chat.replace(/\s+/g, ' ').slice(0, 90));
  await pg.evaluate(() => { Story.texChecks = window.__tc; });

  // the Harlow exposé (forced): sell the yacht
  await pg.evaluate(() => { GameState._pendingDecision = null; Story.debug('decide', { lent: true, bought: true, loan: { amt: 24, rate: 0.1, prov: 0, accrued: 0.6, paid: 0, streak: 1, missed: 1, due: 99, ext: 0 }, due: 'story_harlow_press' }); });
  await pg.evaluate(() => { const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) Meeting.close(); }); await pg.click('#btn-advance-quarter'); await wait(1000); await pg.evaluate(() => UI.closeModal());
  for (let i = 0; i < 3 && (await pendingId()) !== 'story_harlow_press'; i++) { await answerPending(); await pg.evaluate(() => { const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) Meeting.close(); }); await pg.click('#btn-advance-quarter'); await wait(1000); await pg.evaluate(() => UI.closeModal()); }
  ok((await pendingId()) === 'story_harlow_press', 'the jet and yacht story');
  await pg.evaluate(() => UI.openPendingDecision()); await wait(300); await pg.screenshot({ path: OUT + '/board_press.png' });
  const c0 = await pg.evaluate(() => GameState.balance.cash);
  await pg.evaluate(() => document.querySelectorAll('#modal-body .decision-choice')[2].click()); await wait(300); await pg.evaluate(() => UI.closeModal());
  const y = await pg.evaluate(() => ({ amt: Story.H().loan.amt, cash: GameState.balance.cash, pen: Story.H().penalty }));
  ok(y.amt === 20 && Math.abs(y.cash - c0 - 4) < 0.01 && y.pen === 5, 'yacht sold: $4M back, loan $20M, maturity odds −5');
  ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
