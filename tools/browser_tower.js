/* browser_tower.js — round 14, Celestial Heights (STORY_TOWER_DRAFT.md).
   Drives the story through its own agenda items and cards (no 9 years of
   play), then plays a real board meeting with the new chair.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_tower.js" <outdir> [A|B] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const OUT = process.argv[2] || '/tmp', ROAD = process.argv[3] || 'A';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'warning' && /tower|war|story/.test(m.text())) errs.push('warn: ' + m.text()); });
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear());
  await pg.evaluate(() => UI.newGame()); await wait(1500); await pg.evaluate(() => UI.closeModal());

  // helpers inside the page
  await pg.evaluate(() => {
    window.__pick = (it, re) => { const c = it.choices.find(x => re.test(x.label) && !x.disabled) || it.choices.find(x => !x.disabled); return { label: c.label, msg: c.go() }; };
    window.__card = (id, re) => { const c = World.DECISIONS.find(x => x.id === id).build(); const ch = c.choices.find(x => re.test(x.label) && (!x.check || x.check())); const m = ch.apply(); Story.S().due = null; return { title: c.title, label: ch.label, msg: m, body: c.body }; };
    window.__q = () => { const out = []; Tower.processQuarter(out); GameState.meta.quarter++; if (GameState.meta.quarter > 4) { GameState.meta.quarter = 1; GameState.meta.year++; } GameState.meta.totalQuarters++; return out; };
  });

  // Act 1, Year 8: the nephew
  const a1 = await pg.evaluate(() => { const it = Tower.agenda(8, []); return { n: it.length, guest: it[0] && it[0].guest.name, r: it[0] && __pick(it[0], /Welcome/) }; });
  ok(a1.n === 1 && /Sebastian/.test(a1.guest), 'Year 8: Williams introduces Sebastian: ' + (a1.r && a1.r.msg));
  ok(await pg.evaluate(() => GameState._gaSurcharge >= 0.2), 'his $0.8M a year is in overheads');
  // Act 2, Year 9: the task
  const a2 = await pg.evaluate(() => { GameState.balance.cash = 260; const it = Tower.agenda(9, []); return { note: it[0].note, r: __pick(it[0], /^Build it \(/), t: Tower.T() }; });
  ok(a2.t.stage === 'plot' && a2.t.size === 'full', 'Year 9: the task is set. ' + a2.note);
  // Act 3: the lot and the money
  await pg.evaluate(() => { GameState.meta.year = 10; GameState.meta.quarter = 1; });
  const lotDue = await pg.evaluate(() => { __q(); return Story.S().due; });
  ok(lotDue === 'tower_plot', 'the Fifth Street lot card arrives');
  const c1 = await pg.evaluate(() => __card('tower_plot', /^Buy it/));
  ok(await pg.evaluate(() => !!Tower.tower() && Tower.tower().underConstruction && !(GameState.devLots || []).some(l => l.id === 'lot_01')), 'bought: ' + c1.label + '. The tower is on the books as "under construction"');
  const finDue = await pg.evaluate(() => { __q(); return Story.S().due; });
  ok(finDue === 'tower_finance', 'the financing card arrives');
  await pg.evaluate(() => { UI.renderAll(); Story.S().due = 'tower_finance'; GameState._pendingDecision = World.systemDecision ? World.systemDecision() : null; }); await wait(200);
  await pg.evaluate(() => { UI.openPendingDecision && UI.openPendingDecision(); }); await wait(300);
  await pg.screenshot({ path: OUT + '/tower_finance.png' });
  await pg.evaluate(() => { UI.closeModal(); GameState._pendingDecision = null; });
  const c2 = await pg.evaluate(() => __card('tower_finance', /^Construction loan/));
  ok(/bank will lend/.test(c2.msg), 'financed: ' + c2.msg);
  // Act 4: ten quarters of building
  const b0 = await pg.evaluate(() => ({ cash: GameState.balance.cash, v: Tower.tower().currentValue }));
  let overrun = false, calder = false;
  for (let i = 0; i < 12; i++) {
    const st = await pg.evaluate(road => { Tower.debug({ forceRoad: road }); __q(); const s = Story.S().due, t = Tower.T(); return { due: s, stage: t.stage, qLeft: t.qLeft }; }, ROAD);
    if (st.due === 'tower_overrun') { overrun = true; await pg.evaluate(() => __card('tower_overrun', /^Pay it/)); }
    if (!calder && st.stage === 'build' && st.qLeft <= 7) { calder = true; await pg.evaluate(() => { const it = Tower.agenda(GameState.meta.year, []).find(x => /Calder/.test(JSON.stringify(x.lines))); return it ? __pick(it, /Sign/) : null; }); }
    if (st.stage === 'open') break;
  }
  const b1 = await pg.evaluate(() => ({ cash: GameState.balance.cash, v: Tower.tower().currentValue, loan: (GameState.debtTranches.find(x => /tower/.test(x.id)) || {}).amount, t: Tower.T() }));
  ok(overrun, 'the overrun card came mid-build (paid)');
  ok(b1.t.calder === true, 'Calder & Rowe signed at a meeting during the build');
  ok(b1.t.stage === 'open' && b1.t.road === ROAD, 'completed on road ' + b1.t.road + ': cost $' + b1.t.cost + 'M, valued $' + b1.v + 'M, written down $' + b1.t.impair + 'M; construction loan now $' + b1.loan + 'M of bonds');
  const c3 = await pg.evaluate(() => __card('tower_open', /Understood/));
  ok(/opens/.test(c3.title), 'opening card: ' + c3.title);
  // Act 5 and 6: the path, then (road A) the fall, at the same meeting
  await pg.evaluate(() => { GameState.board.politicalCapital = 2; });
  const m = await pg.evaluate(() => {
    const items = Tower.agenda(GameState.meta.year, []);
    const out = { n: items.length, lines: items.map(x => JSON.stringify(x.lines).slice(0, 120)) };
    const path = items.find(x => x.choices && x.choices.some(c => /Hold/.test(c.label)));
    out.path = path ? __pick(path, /Hold/).msg : null;
    const fall = items.find(x => /step down/.test(JSON.stringify(x.lines)));
    const retire = items.find(x => x.effect);
    if (fall) out.fall = __pick(fall, /Let him fall/).msg;
    const succ = items.find(x => x.choices && x.choices.some(c => /^Back /.test(c.label)));
    out.succ = succ ? succ.choices.map(c => c.label + (c.disabled ? ' [locked]' : '')).join(' | ') : null;
    if (succ) { Math.random = () => 0.01; out.chairMsg = __pick(succ, /Back Okafor/).msg; }
    out.chair = Directors.chair(); out.name = Directors.name(out.chair); out.williams = Directors.has('williams');
    return out;
  });
  ok(!!m.path, 'the meeting picks the path: ' + m.path);
  if (ROAD === 'A') {
    ok(!!m.fall && !m.williams, 'road A: Petrova moves that Williams step down; he falls: ' + m.fall);
    ok(!!m.succ, 'the succession follows in the same meeting: ' + m.succ);
    ok(m.chair === 'okafor' && /Chair Okafor/.test(m.name), 'new chair: ' + m.name + ' (' + m.chairMsg + ')');
  } else {
    ok(m.williams, 'road B: Williams stays for now');
  }
  // a real meeting with whoever chairs now
  await pg.evaluate(() => { Math.random = Math.random; GameState.meta.year = 13; GameState.meta.quarter = 4; GameState.board._storyYear = 0; });
  const meetingUp = () => pg.evaluate(() => { const m = document.getElementById('meeting'); return !!m && !m.classList.contains('hidden'); });
  for (let i = 0; i < 4 && !(await meetingUp()); i++) {
    await pg.evaluate(() => { for (let k = 0; k < 3 && GameState._pendingDecision; k++) { UI.openPendingDecision(); const c = document.querySelector('#modal-body .decision-choice:not(.decision-choice-disabled):not(.decision-hold)'); if (c) c.click(); else GameState._pendingDecision = null; } UI.closeModal(); });
    await pg.click('#btn-advance-quarter'); await wait(900); await pg.evaluate(() => UI.closeModal());
  }
  ok(await meetingUp(), 'a full board meeting runs' + (ROAD === 'A' ? ' without Williams' : ''));
  const seen = [];
  for (let step = 0; step < 70; step++) {
    await wait(120); await pg.evaluate(() => Meeting.flush()); await wait(60);
    const st = await pg.evaluate(() => ({ btns: [...document.querySelectorAll('#mt-actions .mt-btn')].map(b => ({ t: b.querySelector('b').textContent, dis: b.disabled })), log: (document.getElementById('mt-chat') || {}).textContent || '' }));
    if (!st.btns.length) continue;
    if (step === 3) await pg.screenshot({ path: OUT + '/tower_meeting.png' });
    const last = /^(Back to work|Leave the boardroom)/.test(st.btns[0].t);
    let i = st.btns.findIndex(x => !x.dis);
    await pg.evaluate(i => document.querySelectorAll('#mt-actions .mt-btn')[i].click(), i);
    seen.push(st.log.slice(-300));
    if (last) { break; }
  }
  const log = await pg.evaluate(() => (document.getElementById('mt-chat') || {}).textContent || '');
  ok(ROAD !== 'A' || /Chair Okafor/.test(log), 'the new chair runs the meeting');
  ok(/board backs you|against\. You keep|Thank you for your service/.test(log), 'the vote happened');
  await pg.screenshot({ path: OUT + '/tower_meeting_end.png' });
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
