/* browser_index.js — round 14, the index (listing.js): the checklist, the
   candidate review, joining, Granite's stewardship visit, Granite voting
   against a director, say on pay (lost: cut or ignore), being dropped, and a
   real meeting with Henrik Dahl in the room.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_index.js" <outdir> */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const OUT = process.argv[2] || '/tmp';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'warning' && /index|story|war|tower/.test(m.text())) errs.push('warn: ' + m.text()); });
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear());
  await pg.evaluate(() => UI.newGame()); await wait(1500); await pg.evaluate(() => UI.closeModal());
  await pg.evaluate(() => {
    window.__setQ = (y, q) => { GameState.meta.year = y; GameState.meta.quarter = q; GameState.meta.totalQuarters = (y - 1) * 4 + q; };
    window.__iq = (ni) => { GameState.pnl.netIncome = ni; const out = []; IndexFund.processQuarter(out); return out.map(o => o.text).join(' / '); };
    window.__pick = (it, re) => { const c = it.choices.find(x => re.test(x.label) && !x.disabled) || it.choices.find(x => !x.disabled); return c.go(); };
  });
  // the checklist arrives when 2 of 3 tests pass
  const t0 = await pg.evaluate(() => { __setQ(5, 1); GameState.company.sharePrice = 20; GameState.company.sharesOutstanding = 10; for (let i = 0; i < 4; i++) __iq(3); return { told: IndexFund.X().told, tests: IndexFund.tests().map(t => (t.ok ? 'ok ' : 'no ') + t.k + ' = ' + t.v) }; });
  ok(t0.told, 'the checklist letter: ' + t0.tests.join(' | '));
  const c1 = await pg.evaluate(() => { const p0 = GameState.company.sharePrice; __setQ(5, 2); const o = __iq(3); return { st: IndexFund.X().stage, o, up: GameState.company.sharePrice / p0 }; });
  ok(c1.st === 'candidate' && c1.up > 1.02, 'Q2 review: a candidate (+3%): ' + c1.o);
  await pg.evaluate(() => { __setQ(5, 3); __iq(3); });
  const c2 = await pg.evaluate(() => { const p0 = GameState.company.sharePrice; __setQ(5, 4); const o = __iq(3); return { st: IndexFund.X().stage, o, up: GameState.company.sharePrice / p0, prem: IndexFund.premium() }; });
  ok(c2.st === 'in' && c2.up > 1.04 && c2.prem === 1.03, 'Q4 review: in the index (+5%, bracket x1.03): ' + c2.o);
  // the stewardship visit, with a pill and Tex
  const v = await pg.evaluate(() => {
    War.debug({ pillUntil: 999 }); Directors.addDirector('tex', 6, 'test');
    const items = IndexFund.agenda(5, []);
    const out = { n: items.length, lines: items.map(i => JSON.stringify(i.lines).slice(0, 90)) };
    const pill = items.find(i => /poison pills/.test(JSON.stringify(i.lines))), tex = items.find(i => /Brennan/.test(JSON.stringify(i.lines)));
    out.pill = pill ? __pick(pill, /Keep it/) : null; out.tex = tex ? __pick(tex, /Keep Tex/) : null;
    out.targets = IndexFund.X().targets.map(t => t.id + ': ' + t.why);
    return out;
  });
  ok(v.n === 4 && v.pill && v.tex, 'Henrik Dahl’s visit: intro, the pill, Tex, say on pay (' + v.n + ' items)');
  ok(v.targets.length === 2, 'kept both: Granite votes against ' + v.targets.join(' and '));
  const r6 = await pg.evaluate(() => { const r0 = Directors.rep('tex'); const items = IndexFund.agenda(6, []); items.filter(i => i.effect).forEach(i => i.effect()); return { r0, r1: Directors.rep('tex'), n: items.length }; });
  ok(r6.r1 === r6.r0 - 10, 'next year Granite votes against Tex: reputation ' + r6.r0 + ' → ' + r6.r1);
  // say on pay: lost, cut
  const sop = await pg.evaluate(() => {
    IndexFund.debug({ sopForce: 41 }); const items = Pay.meeting(6);
    const take = items.find(i => i.choices && /Take the bonus/.test(i.choices[0].label)); if (take) take.choices[0].go();
    const s = items.find(i => i.effect && !i.lines.length && /Say on pay|say on pay/.test(String(i.effect).slice(0, 0) + 'Say on pay')) ;
    let msg = ''; for (const it of items.slice()) { if (it.effect) { const m = it.effect(); if (/Say on pay/.test(m)) msg = m; } }
    const resp = items.find(i => i.guest && /voted for your pay/.test(JSON.stringify(i.lines)));
    const r = resp ? __pick(resp, /Cut your pay/) : null;
    return { msg, r, cut: Pay.L().cut, bonus: Pay.bonusFor().amount };
  });
  ok(/fails/.test(sop.msg) && sop.cut === 0.75, 'say on pay lost (41%): ' + sop.r + ' (cut ' + sop.cut + ')');
  // dropped: too small
  const d = await pg.evaluate(() => { __setQ(6, 2); GameState.company.sharePrice = 10; const o = __iq(3); return { st: IndexFund.X().stage, o, prem: IndexFund.premium() }; });
  ok(d.st === 'out' && d.prem === 1, 'dropped at the next review: ' + d.o);
  // a real meeting with Dahl: back in, a fresh visit
  await pg.evaluate(() => { IndexFund.debug({ stage: 'in', inQ: 1, visited: null, targets: [], sopForce: null }); Pay.L().lastMeeting = 0; GameState.company.sharePrice = 20; __setQ(6, 4); GameState.board._storyYear = 0; War.debug({ pillUntil: null }); });
  const meetingUp = () => pg.evaluate(() => { const m = document.getElementById('meeting'); return !!m && !m.classList.contains('hidden'); });
  for (let i = 0; i < 3 && !(await meetingUp()); i++) {
    await pg.evaluate(() => { for (let k = 0; k < 3 && GameState._pendingDecision; k++) { UI.openPendingDecision(); const c = document.querySelector('#modal-body .decision-choice:not(.decision-choice-disabled):not(.decision-hold)'); if (c) c.click(); else GameState._pendingDecision = null; } UI.closeModal(); });
    await pg.click('#btn-advance-quarter'); await wait(900); await pg.evaluate(() => UI.closeModal());
  }
  ok(await meetingUp(), 'meeting');
  let shot = false;
  for (let step = 0; step < 80; step++) {
    await wait(120); await pg.evaluate(() => Meeting.flush()); await wait(60);
    const st = await pg.evaluate(() => ({ btns: [...document.querySelectorAll('#mt-actions .mt-btn')].map(b => ({ t: b.querySelector('b').textContent, dis: b.disabled })), log: (document.getElementById('mt-chat') || {}).textContent || '' }));
    if (!st.btns.length) continue;
    if (!shot && /Henrik Dahl/.test(st.log)) { shot = true; await pg.screenshot({ path: OUT + '/index_dahl.png' }); }
    const last = /^(Back to work|Leave the boardroom)/.test(st.btns[0].t);
    const i = st.btns.findIndex(x => !x.dis);
    await pg.evaluate(i => document.querySelectorAll('#mt-actions .mt-btn')[i].click(), i);
    if (last) break;
  }
  const log = await pg.evaluate(() => (document.getElementById('mt-chat') || {}).textContent || '');
  if (!/Henrik Dahl/.test(log)) console.log(log.slice(0, 1500), await pg.evaluate(() => JSON.stringify({ st: IndexFund.X().stage, v: IndexFund.X().visited, y: GameState.meta.year, sy: GameState.board._storyYear })));
  ok(/Henrik Dahl/.test(log) && /Say on pay/.test(log), 'in the room: Henrik Dahl, and the say on pay vote in the pay committee');
  await pg.screenshot({ path: OUT + '/index_meeting_end.png' });
  await pg.evaluate(() => { showView('map'); UI.renderAll(); }); await wait(300);
  const clock = await pg.evaluate(() => (document.body.textContent.match(/National REIT 100[^\n]{0,80}/) || [''])[0]);
  ok(/National REIT 100/.test(clock), 'the inbox clock shows the index: ' + clock.slice(0, 90));
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
