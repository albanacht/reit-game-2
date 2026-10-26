/* browser_fixes3.js — Alexander's fix list (round 6): start screen, map SALE
   tags, inbox mark-read, Finance cash + chart titles, numbers on meeting
   choices, the activist as a 6th director, personal share buys, political
   capital at the bank. Real headless Chrome.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_fixes3.js" <outdir> */
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
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await wait(500);
  ok(await pg.evaluate(() => /Borrow cheap/.test(document.querySelector('.start-loop').textContent) && document.querySelectorAll('#start-overlay .start-more details').length >= 2), 'start screen: loop sentence, rules folded away');
  await pg.evaluate(() => UI.newGame()); await wait(1200); await pg.evaluate(() => UI.closeModal());

  // map: bigger markers, SALE tag
  const mk = await pg.evaluate(() => ({ sale: document.querySelectorAll('#tab-map .mk-sale').length, w: (document.querySelector('#tab-map .mk svg') || {}).getAttribute ? document.querySelector('#tab-map .mk svg').getAttribute('width') : null }));
  ok(mk.sale > 0, 'map: ' + mk.sale + ' SALE tags (marker width ' + mk.w + ')');
  await pg.screenshot({ path: OUT + '/f3_map.png' });

  const meetingUp = () => pg.evaluate(() => { const m = document.getElementById('meeting'); return !!m && !m.classList.contains('hidden'); });
  async function playToMeeting() {
    for (let i = 0; i < 6; i++) {
      if (await meetingUp()) return true;
      await pg.evaluate(() => { if (GameState._pendingDecision) { UI.openPendingDecision(); const c = document.querySelector('.decision-choice:not(.decision-choice-disabled)'); c && c.click(); } UI.closeModal(); });
      await pg.click('#btn-advance-quarter'); await wait(1200); await pg.evaluate(() => UI.closeModal());
    }
    return meetingUp();
  }
  // inbox: earlier messages read on a new quarter; "mark read" clears the rest
  await pg.click('#btn-advance-quarter'); await wait(1200); await pg.evaluate(() => UI.closeModal());
  const unread = () => pg.evaluate(() => GameState.inbox.items.filter(i => i.kind === 'message' && !i.read).length);
  const u1 = await unread();
  await pg.evaluate(() => { const c = document.querySelector('#views .ib-count'); c && c.click(); });
  ok((await unread()) === 0, 'inbox: ' + u1 + ' unread, after "mark read" 0');

  // Finance: cash headline + chart titles
  await pg.evaluate(() => showView('finance')); await wait(400);
  const fin = await pg.evaluate(() => ({ cls: document.getElementById('bs-cash').className, size: getComputedStyle(document.getElementById('bs-cash')).fontSize,
    titles: [...document.querySelectorAll('.chart-h b')].map(x => x.textContent) }));
  ok(/bs-value/.test(fin.cls) && parseInt(fin.size) >= 22, 'finance: cash is the headline (' + fin.size + ', ' + fin.cls + ')');
  ok(fin.titles.length === 6, 'finance: 6 chart titles: ' + fin.titles.join(' | '));
  await pg.evaluate(() => document.querySelector('.charts-grid').scrollIntoView()); await wait(200);
  await pg.screenshot({ path: OUT + '/f3_charts.png' });
  await pg.evaluate(() => showView('map'));

  // Year 1 meeting: numbers on every choice
  ok(await playToMeeting(), 'Year 1 meeting opens');
  let sawTarget = false, sawNums = false, eased = null;
  for (let step = 0; step < 40; step++) {
    await wait(200); await pg.evaluate(() => Meeting.flush()); await wait(100);
    const st = await pg.evaluate(() => ({ btns: [...document.querySelectorAll('#mt-actions .mt-btn')].map(b => ({ t: b.querySelector('b').textContent, d: (b.querySelector('span') || {}).textContent || '', dis: b.disabled })),
      prompt: (document.querySelector('#mt-actions .mt-prompt') || {}).textContent || '', chat: document.getElementById('mt-chat').textContent }));
    if (/Target [≥≤]|Pass or fail/.test(st.chat)) sawTarget = true;
    if (st.btns.some(x => /Met: \+[0-9.]+ mood/.test(x.d))) sawNums = true;
    if (!st.btns.length) continue;
    if (/Demand 1/.test(st.prompt)) await pg.screenshot({ path: OUT + '/f3_demand.png' });
    let i = 0;
    if (/Demand/.test(st.prompt)) { const pb = st.btns.findIndex(x => /Push back/.test(x.t) && !x.dis); if (pb > -1 && !eased) { i = pb; eased = st.btns[pb].d; } }
    const last = /^(Back to work|Leave the boardroom)/.test(st.btns[0].t);
    await pg.evaluate(i => document.querySelectorAll('#mt-actions .mt-btn')[i].click(), i);
    if (last) break;
  }
  ok(sawTarget, 'demands show "Target ≥ X · Now/Last year: Y"');
  ok(sawNums, 'accept shows the mood numbers');
  console.log('     push back said: ' + eased);
  const mand = await pg.evaluate(() => GameState.board.activeMandates.map(m => m.directorId + ': ' + m.text + ' [' + m.response + ']'));
  console.log('     demands: ' + mand.join(' / '));

  // the activist takes a seat
  const ga0 = await pg.evaluate(() => GameState._gaSurcharge || 0);
  const msg = await pg.evaluate(() => Directors.addActivist());
  const act = await pg.evaluate(() => ({ n: GameState.board.directors.length, ga: GameState._gaSurcharge, att: GameState.board.directors.find(d => d.id === 'activist').attitude }));
  ok(act.n === 6 && Math.abs(act.ga - ga0 - 0.075) < 1e-6, 'activist seated: 6 directors, G&A +$0.075M/qtr (' + msg + ')');
  await pg.evaluate(() => { showView('board'); BoardTab.render(); }); await wait(300);
  ok(await pg.evaluate(() => document.querySelectorAll('#bd-cards .bd-card').length === 6 && /Marlowe/.test(document.getElementById('bd-cards').textContent)), 'Board tab: 6 cards incl. Marlowe');
  ok(await pg.evaluate(() => [...document.querySelectorAll('.bd-sc td')].some(td => /NAV/.test(td.textContent))), 'scorecard: activist line (price / NAV)');
  await pg.screenshot({ path: OUT + '/f3_board.png' });
  await pg.evaluate(() => showView('map'));

  // personal share purchase: only when really cheap vs NAV
  const pers = await pg.evaluate(() => {
    const G = GameState, p0 = G.company.sharePrice, nav = G.ratios.navPerShare;
    G.board.directors.forEach(d => { if (d.id !== 'activist') d.attitude = 6; });
    G.company.sharePrice = nav * 0.85; const none = Directors.personal().length;
    G.company.sharePrice = nav * 0.4; G.meta.year = Math.max(2, G.meta.year); const got = Directors.personal();
    G.company.sharePrice = p0;
    return { none, got };
  });
  ok(pers.none === 0 && pers.got.length === 1 && pers.got[0].kind === 'bought', 'personal buy after a dip to 40% of NAV, not at 85%: "' + (pers.got[0] || {}).text + '"');

  // political capital at the bank
  const fav = await pg.evaluate(() => {
    const G = GameState, r = G.revolver; G.board.politicalCapital = 5;
    r.frozen = true; r.frozenCap = 0;
    const m = Revolver.thaw();
    return { m, frozen: r.frozen, cap: G.board.politicalCapital };
  });
  ok(!fav.frozen && fav.cap === 2, 'favour: frozen line reopened for 3 capital (' + fav.m + ')');

  // Year 2 meeting with six: six portraits, six votes
  await pg.evaluate(() => { GameState.board.politicalCapital = 2; });
  ok(await playToMeeting(), 'Year 2 meeting opens');
  await wait(400);
  ok(await pg.evaluate(() => document.querySelectorAll('#mt-portraits .mt-p').length === 6), 'meeting: 6 portraits');
  for (let step = 0; step < 90; step++) {
    await wait(200); await pg.evaluate(() => Meeting.flush()); await wait(100);
    const st = await pg.evaluate(() => [...document.querySelectorAll('#mt-actions .mt-btn')].map(b => b.querySelector('b').textContent));
    if (!st.length) continue;
    const last = st.length === 1 && /Back to work|Leave/.test(st[0]);
    if (last) await pg.screenshot({ path: OUT + '/f3_vote.png' });
    await pg.evaluate(() => document.querySelector('#mt-actions .mt-btn').click());
    if (last) break;
  }
  const votes = await pg.evaluate(() => document.querySelectorAll('#mt-portraits .mt-stamp').length);
  const chat = await pg.evaluate(() => [...document.querySelectorAll('#mt-chat .mt-line')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(t => /Marlowe|board backs|against\./.test(t)));
  ok(votes === 6 || (await pg.evaluate(() => GameState.meta.gameOver)), 'vote: ' + votes + ' stamps');
  console.log('     ' + chat.slice(-4).join('\n     '));
  ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
