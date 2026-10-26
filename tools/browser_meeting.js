/* browser_meeting.js — the annual board meeting in a real headless Chrome.
   Plays to the end of Year 1 (practice) and Year 2 (vote), clicking through.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_meeting.js" <outdir> */
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
  await pg.evaluate(() => UI.newGame()); await wait(1300); await pg.evaluate(() => UI.closeModal());
  const meetingUp = () => pg.evaluate(() => { const m = document.getElementById('meeting'); return !!m && !m.classList.contains('hidden'); });

  async function playToMeeting() {
    for (let i = 0; i < 6; i++) {
      if (await meetingUp()) return true;
      await pg.evaluate(() => { if (GameState._pendingDecision) { UI.openPendingDecision(); const c = document.querySelector('.decision-choice:not(.decision-choice-disabled)'); c && c.click(); } UI.closeModal(); });
      await pg.click('#btn-advance-quarter'); await wait(1200); await pg.evaluate(() => UI.closeModal());
    }
    return meetingUp();
  }
  /* click through: skip the typing, then press a button (choice index per stage) */
  async function clickThrough(choose, shots) {
    const transcript = [];
    for (let step = 0; step < 140; step++) {
      await wait(250); await pg.evaluate(() => Meeting.flush());
      await wait(150);
      const btns = await pg.evaluate(() => [...document.querySelectorAll('#mt-actions .mt-btn')].map(b => ({ t: b.querySelector('b').textContent, dis: b.disabled })));
      if (!btns.length) continue;
      const prompt = await pg.evaluate(() => (document.querySelector('#mt-actions .mt-prompt') || {}).textContent || '');
      if (shots[step]) await pg.screenshot({ path: OUT + '/' + shots[step] + '.png' });
      if (btns.length === 1 && /Back to work|Leave/.test(btns[0].t)) await pg.screenshot({ path: OUT + '/meeting_end_' + (shots.tag || 'x') + '.png' });
      if (btns.length > 1 && /wants an answer/.test(prompt)) await pg.screenshot({ path: OUT + '/meeting_agenda_' + (shots.tag || 'x') + '.png' });
      if (btns.length === 1) { transcript.push('> ' + btns[0].t); await pg.evaluate(() => document.querySelector('#mt-actions .mt-btn').click());
        if (/Back to work|Leave/.test(btns[0].t)) break; continue; }
      const i = choose(prompt, btns); transcript.push('> [' + prompt + '] ' + btns[i].t);
      await pg.evaluate(i => document.querySelectorAll('#mt-actions .mt-btn')[i].click(), i);
      if (/^Back to work/.test(btns[i].t)) break;              // round 15: Back to work now sits next to Resign
    }
    const lines = await pg.evaluate(() => [...document.querySelectorAll('#mt-chat .mt-line, #mt-chat .mt-note')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    return { transcript, lines };
  }

  ok(await playToMeeting(), 'end of Year 1: the meeting opens by itself');
  const title1 = await pg.evaluate(() => document.getElementById('mt-title').textContent);
  console.log('     ' + title1);
  await wait(2500); await pg.screenshot({ path: OUT + '/meeting_open.png' });
  const r1 = await clickThrough((p, b) => 0, { tag: 'y1' });
  console.log('     chat:\n       ' + r1.lines.slice(0, 14).join('\n       '));
  console.log('     you chose: ' + r1.transcript.join(' | '));
  ok(!(await meetingUp()) && await pg.evaluate(() => (GameState.board.activeMandates || []).length === 2), 'practice meeting closes with 2 demands set, no vote');
  ok(await pg.evaluate(() => !GameState.board.probation && !GameState.meta.gameOver), 'no vote in Year 1');

  ok(await playToMeeting(), 'end of Year 2: meeting with a vote');
  const r2 = await clickThrough((p, b) => /wants an answer/.test(p) ? 0 : /Demand/.test(p) ? 0 : 0, { tag: 'y2' });
  console.log('     chat (end):\n       ' + r2.lines.slice(-8).join('\n       '));
  const st = await pg.evaluate(() => ({ prob: !!GameState.board.probation, over: GameState.meta.gameOver, demands: (GameState.board.activeMandates || []).length,
    stamps: [...document.querySelectorAll('#mt-portraits .mt-stamp')].map(s => s.textContent) }));
  console.log('     result: ' + JSON.stringify(st));
  ok(st.demands === 2 && !st.over, 'Year 2 meeting finishes (vote cast, demands set)');
  ok(await pg.evaluate(() => !document.getElementById('meeting') || document.getElementById('meeting').classList.contains('hidden')), 'meeting closed, back to the game');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
