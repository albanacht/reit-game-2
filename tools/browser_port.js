/* browser_port.js — round 16: Port Logistics (port.js). Atlas Cold Chain as a
   steady tenant, Chen's item with Tex backing him, each result (she sells /
   she holds / it leaks), the lawsuit, the mayor's favour, the ending card,
   and the item in a real meeting.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_port.js" <outdir> */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const OUT = process.argv[2] || '/tmp';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'warning' && /port|story|ending/.test(m.text())) errs.push('warn: ' + m.text()); });
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear());
  await pg.evaluate(() => UI.newGame()); await wait(1500); await pg.evaluate(() => UI.closeModal());
  await pg.evaluate(() => {
    window.__setQ = (y, q) => { GameState.meta.year = y; GameState.meta.quarter = q; GameState.meta.totalQuarters = (y - 1) * 4 + q; };
    window.__pq = () => { const out = []; Port.processQuarter(out); const q = GameState.meta.quarter + 1; if (q > 4) __setQ(GameState.meta.year + 1, 1); else __setQ(GameState.meta.year, q); return out.map(o => o.text).join(' / '); };
    window.__card = (id, re) => { const c = World.DECISIONS.find(x => x.id === id).build(); const ch = c.choices.find(x => re.test(x.label) && (!x.check || x.check())); const m = ch.apply(); Story.S().due = null; return { title: c.title, msg: m }; };
    window.__pick = (it, re) => { const c = it.choices.find(x => re.test(x.label) && !x.disabled) || it.choices.find(x => !x.disabled); return c.go(); };
    window.__rnd = Math.random;
    window.__back = () => { const pl = GameState.portfolio.find(x => x.id === 'ind_02'); if (pl) { GameState.portfolio = GameState.portfolio.filter(x => x !== pl); pl.owner = 'wex'; GameState.cityRivals.push(pl); } ['chen', 'tex'].forEach(id => Directors.has(id) && Directors.repChange(id, 60 - Directors.rep(id), 'test')); };
  });
  // Atlas Cold Chain
  const a = await pg.evaluate(() => { const p = GameState.cityRivals.find(x => x.id === 'ind_02'); const t = GameState.tenants.atlas_cold_chain; const cov = [], q0 = p.lease.positions[0].q;
    GameState.market.cycle = 'recession'; for (let i = 0; i < 12; i++) { Tenants.processQuarter(); cov.push(t.coverage); } GameState.market.cycle = 'stable';
    return { owner: p.owner, v: p.currentValue, noi: p.annualNOI, occ: p.occupancy, lease: p.lease.type + ' ' + p.lease.positions[0].t + ' ' + q0 + 'q', min: Math.min(...cov), max: Math.max(...cov), status: t.status }; });
  ok(a.owner === 'wex' && a.lease === 'single atlas_cold_chain 60q' && a.occ === 1, 'Port Logistics: Wexmoor’s, $' + a.v + 'M, rent $' + a.noi + 'M, ' + a.lease);
  ok(a.min >= 2.6 && a.max <= 3.8 && a.status === 'active', 'Atlas through 12 quarters of recession: rent cover ' + a.min + ' to ' + a.max + 'x, never in trouble');
  // Act 1: Chen proposes, Tex backs
  const act1 = await pg.evaluate(() => { Directors.addDirector('tex', 6, 'Tex Brennan joined'); GameState.board.politicalCapital = 6; GameState.balance.totalAssets = 400; __setQ(5, 1);
    const it = Port.agenda(10, []); const x = it[0]; return { n: it.length, who: x ? x.lines.map(l => l[0]).join(',') : '', labels: x ? x.choices.map(c => c.label + ' :: ' + (c.detail || '').slice(0, 90)).join('\n      ') : '' }; });
  ok(act1.n === 1 && /^chen,chen,tex,okafor,petrova$/.test(act1.who), 'the meeting item: Chen proposes, Tex backs him, Okafor and Petrova object');
  console.log('      ' + act1.labels);
  // she sells
  const s1 = await pg.evaluate(() => { const it = Port.agenda(10, [])[0] || null; return it; });
  const sells = await pg.evaluate(() => { Port.debug({ stage: 'wait' }); const it = Port.agenda(10, [])[0]; const m = __pick(it, /through the mayor/); const pc = GameState.board.politicalCapital;
    Port.debug({ resultQ: 0 }); Math.random = () => 0.3; __pq(); Math.random = __rnd; const due = Story.S().due; GameState.balance.cash = 200;
    const c = due === 'port_offer' ? __card('port_offer', /^Buy it/) : null; return { m, pc, due, c: c && c.msg, mine: GameState.portfolio.some(p => p.id === 'ind_02'), stage: Port.P().stage }; });
  ok(sells.pc === 4 && sells.due === 'port_offer' && sells.mine, 'through the mayor (2 capital): she sells at 15% off and we buy it: ' + sells.c);
  // the emails come out a year later; the lawsuit; blame Chen
  const late = await pg.evaluate(() => { __setQ(Port.P().boughtYear + 1, 4); Math.random = () => 0.01; const o = __pq(); Math.random = __rnd; const r0 = Directors.rep('chen');
    const it = Port.agenda(GameState.meta.year, []).find(i => i.guest); const labels = it ? it.choices.map(c => c.label).join(' | ') : ''; const m = it ? __pick(it, /^Blame/) : '';
    return { o, labels, m, r0, r1: Directors.rep('chen'), stage: Port.P().stage }; });
  ok(/emails are in the Ledger/.test(late.o) && /Settle/.test(late.labels) && late.stage === 'blamed', 'a year later the emails come out; Eleanor sues at the meeting (' + late.labels + ')');
  ok(late.r1 <= late.r0 - 35, 'blamed Chen: reputation ' + late.r0 + ' → ' + late.r1 + ' (below 30 he is out at the next meeting)');
  // she holds: Chen and Tex lose reputation
  const held = await pg.evaluate(() => { __back(); Story.S().port = null; const tr = Directors.rep('tex'), cr = Directors.rep('chen'); Port.debug({ stage: 'scheme', route: 'tex', texBacked: true, q0: 1, resultQ: 0, odds: Port.odds('tex') });
    Math.random = () => 0.95; const o = __pq(); Math.random = __rnd; return { o, tex: [tr, Directors.rep('tex')], chen: [cr, Directors.rep('chen')], st: Port.P().stage }; });
  ok(held.st === 'held' && held.tex[1] === held.tex[0] - 15 && held.chen[1] === held.chen[0] - 15, 'Tex’s route, she holds: ' + held.o + ' (Tex ' + held.tex.join(' → ') + ')');
  // the mayor's favour
  const fav = await pg.evaluate(() => { Port.debug({ favourAsked: false, q0: 1 }); Story.S().due = null; __setQ(6, 4); __pq(); const due = Story.S().due; const c = due === 'port_mayor' ? __card('port_mayor', /^Pay/) : null; const pc0 = GameState.board.politicalCapital; __setQ(7, 1); const o = __pq(); return { due, c: c && c.msg, gain: GameState.board.politicalCapital - pc0, o }; });
  ok(fav.due === 'port_mayor' && fav.gain === 1, 'the mayor’s favour: paid $0.5M; next year +1 political capital (' + fav.o + ')');
  // the ending card
  const e = await pg.evaluate(() => Ending.cards().filter(c => /Eleanor/.test(c.label)).map(c => c.lines.join(' ')).join(''));
  ok(/Eleanor/.test(e), 'ending card: ' + e);
  // a real meeting with Chen's item
  await pg.evaluate(() => { __back(); War.debug({ stage: 'done' }); Story.H().stage = 'done'; Story.S().port = null; GameState.board.politicalCapital = 6; __setQ(10, 4); GameState.board._storyYear = 0; (GameState.debtTranches || []).forEach(t => { t.maturityYear += 10; }); GameState.balance.cash = 300; GameState._pendingDecision = null; Story.S().due = null; });
  const meetingUp = () => pg.evaluate(() => { const m = document.getElementById('meeting'); return !!m && !m.classList.contains('hidden'); });
  for (let i = 0; i < 3 && !(await meetingUp()); i++) {
    await pg.evaluate(() => { for (let k = 0; k < 3 && GameState._pendingDecision; k++) { UI.openPendingDecision(); const c = document.querySelector('#modal-body .decision-choice:not(.decision-choice-disabled):not(.decision-hold)'); if (c) c.click(); else GameState._pendingDecision = null; } UI.closeModal(); });
    await pg.click('#btn-advance-quarter'); await wait(900); await pg.evaluate(() => UI.closeModal());
  }
  let shot = false, seen = false;
  for (let step = 0; step < 80 && (await meetingUp()); step++) {
    await wait(110); await pg.evaluate(() => Meeting.flush()); await wait(50);
    const st = await pg.evaluate(() => ({ btns: [...document.querySelectorAll('#mt-actions .mt-btn')].map(b => ({ t: b.querySelector('b').textContent, dis: b.disabled })), log: (document.getElementById('mt-chat') || {}).textContent || '' }));
    if (!st.btns.length) continue;
    if (/pure gold/.test(st.log)) seen = true;
    if (!shot && st.btns.some(x => /through the mayor/.test(x.t))) { shot = true; await pg.screenshot({ path: OUT + '/port_meeting.png' }); }
    const last = /^(Back to work|Leave the boardroom)/.test(st.btns[0].t);
    let i = st.btns.findIndex(x => /through the mayor/.test(x.t) && !x.dis); if (i < 0) i = st.btns.findIndex(x => !x.dis);
    await pg.evaluate(i => document.querySelectorAll('#mt-actions .mt-btn')[i].click(), i);
    if (last) break;
  }
  ok(seen && shot, 'in the room at the Year 10 meeting (round 33): Chen’s item and its choices');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
