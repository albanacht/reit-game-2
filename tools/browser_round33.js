/* browser_round33.js — round 33: the timeline reshuffle and the Mayor.
   Levi by letter in Year 2 Q3; Morrow Plaza (the Rennick war) from the Year 5
   meeting; Port Logistics from Year 9; the index letter only at $140M and from
   Year 6, with a crisis buffer; the Mayor's floors in Year 12 (pre-let into the
   tower, or an office building), every choice through the investigation.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round33.js" [outdir] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const OUT = process.argv[2] || '/tmp';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'warning' && /mayor|levi|tower|index|port|war/.test(m.text())) errs.push('warn: ' + m.text()); });
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  const fresh = async () => { await pg.evaluate(() => { localStorage.clear(); UI.newGame(); UI.closeModal(); Story.S().due = null; GameState._pendingDecision = null; }); await wait(300); };
  await pg.goto(R); await wait(300); await fresh();
  await pg.evaluate(() => {
    window.__card = (id, re) => { const c = World.DECISIONS.find(x => x.id === id).build(); const ch = c.choices.find(x => re.test(x.label) && (!x.check || x.check())); const m = ch.apply(); Story.S().due = null; return { title: c.title, label: ch.label, msg: m, body: c.body, n: c.choices.length, labels: c.choices.map(x => x.label) }; };
    window.__at = (y, q) => { GameState.meta.year = y; GameState.meta.quarter = q; GameState.meta.totalQuarters = (y - 1) * 4 + q - 1; };
  });

  // 1. Levi by letter
  const lv = await pg.evaluate(() => {
    const r = {}; __at(2, 2); Levi.processQuarter([]); r.q2 = Story.S().due;
    __at(2, 3); Levi.processQuarter([]); r.q3 = Story.S().due; r.stage = Levi.L().stage;
    const c = __card('levi_offer', /^Hire/); r.title = c.title; r.msg = c.msg; r.hired = Levi.L().stage; r.ly = Levi.L().year;
    const it = Levi.agenda(2, []); r.challenge = it.length && /z-test/.test(JSON.stringify(it[0].lines));
    return r; });
  ok(!lv.q2 && lv.q3 === 'levi_offer' && lv.stage === 'letter', 'Levi: nothing in Y2 Q2; Petrova’s letter in Y2 Q3 ("' + lv.title + '")');
  ok(lv.hired === 'hired' && lv.challenge, 'hired from the inbox; his first challenge comes at the Year 2 meeting');
  const lv2 = await pg.evaluate(() => { Levi.debug({ stage: 'wait' }); const a = Levi.agenda(2, []).length; const b = Levi.agenda(3, []); return { a, b: b.length && b[0].guest && b[0].guest.name }; });
  ok(lv2.a === 0 && /Levi/.test(lv2.b || ''), 'the meeting is only a fallback: not at the Year 2 meeting, yes at Year 3 if the letter never came');

  // 2. the war from the Year 5 meeting
  await fresh();
  const w = await pg.evaluate(() => { War.ensure && War.ensure(); const a = War.agenda(3, []).length, c = War.agenda(4, []).length; const d = War.agenda(5, []); return { a, c, d: d.length && d[0].guest && d[0].guest.name }; });
  ok(w.a === 0 && w.c === 0 && /Morrow/.test(w.d || ''), 'Rennick war: no Morrow Plaza at Years 3-4; Jack Morrow at the Year 5 meeting');

  // 3. Port from Year 9
  await fresh();
  const pt = await pg.evaluate(() => { const a = Port.agenda(5, []).length, b = Port.agenda(8, []).length; const c = Port.agenda(10, []); return { a, b, c: c.length, st: Port.P().stage, line: c[0] && c[0].lines[0][1].slice(0, 60) }; });
  ok(pt.a === 0 && pt.b === 0 && pt.c === 1 && pt.st === 'pitched', 'Port Logistics: not at Years 5 or 8; Chen pitches at Year 10: "' + pt.line + '…"');

  // 4. the index
  await fresh();
  const ix = await pg.evaluate(() => {
    const G = GameState, r = {}, n0 = () => (G.inbox.items || []).filter(i => /We could join/.test(i.title)).length;
    const setCap = m => { G.company.sharePrice = m / G.company.sharesOutstanding; };
    __at(4, 1); setCap(200); IndexFund.processQuarter([]); r.y4 = n0();
    __at(6, 1); setCap(120); IndexFund.processQuarter([]); r.y6small = n0();
    setCap(150); IndexFund.processQuarter([]); r.y6close = n0();
    // the crisis buffer: in at 115M (66% of 175M)
    const x = IndexFund.X(); x.stage = 'in'; x.inQ = 0; x.ni = [1, 1, 1, 1]; setCap(115);
    const A = G.arc, q = G.totalQuartersElapsed(); A.warnStart = q - 2; A.crisisStart = q - 1; A.crisisEnd = q + 6;
    __at(6, 2); IndexFund.processQuarter([]); r.crisis = x.stage + ' (' + Arc.phase() + ')';
    A.crisisEnd = q - 1; A.afterStart = 99; A.afterEnd = 99; G.meta.quarter = 4; IndexFund.processQuarter([]); r.calm = x.stage + ' (' + Arc.phase() + ')';
    return r; });
  ok(ix.y4 === 0, 'index: no letter in Year 4, even at $200M');
  ok(ix.y6small === 0 && ix.y6close === 1, 'index: Year 6, no letter at $120M; the letter at $150M');
  ok(/^in/.test(ix.crisis) && /^out/.test(ix.calm), 'index buffer: at 66% of the size test we stay in during a crisis (' + ix.crisis + '), out in normal times (' + ix.calm + ')');

  // 5. the Mayor: an office building (no tower), every choice
  const mayorRun = (choice, lobby, exposeRnd) => pg.evaluate((choice, lobby, exposeRnd) => {
    localStorage.clear(); UI.newGame(); UI.closeModal(); Story.S().due = null; GameState._pendingDecision = null;
    const G = GameState, r = {};
    const p = G.propertyMarket.find(x => x.sector === 'office' && !x.underConstruction) || G.propertyMarket[0];
    G.balance.cash = 500; Properties.buyProperty(p.id); const mine = G.portfolio.find(x => x.id === p.id); mine.sector = 'office'; mine.occupancy = 0.7; mine.storyLock = false;
    G.portfolio.filter(x => x.id !== p.id).forEach(x => { x.occupancy = 0.95; });
    __at(12, 3); Mayor.processQuarter([]); r.due = Story.S().due; r.bld = Mayor.M().bld === p.id;
    const noi0 = mine.annualNOI, occ0 = mine.occupancy, cash0 = Pay.L().cash, pc0 = (G.board.politicalCapital = 3);
    if (choice === 'refuse' && G.rivals && G.rivals.ren) r.ren0 = G.rivals.ren.price;
    const re = { clean: /^Clean/, sweet: /^Sweetheart/, skim: lobby ? /lobby/ : /^Give the fit-out/, refuse: /^Refuse/ }[choice];
    const c = __card('mayor_offer', re); r.labels = c.labels; r.msg = c.msg;
    r.noi1 = mine.annualNOI / noi0; r.occ1 = mine.occupancy - occ0; r.cash1 = Pay.L().cash - cash0;
    const real = Math.random; Math.random = () => exposeRnd; __at(14, 2); Mayor.processQuarter([]); Math.random = real;
    r.noi2 = mine.annualNOI / noi0; r.cash2 = Pay.L().cash - cash0; r.pc = G.board.politicalCapital - pc0; r.end = Mayor.ending(); r.over = !!G.meta.gameOver;
    if (r.ren0) r.ren = G.rivals.ren.price / r.ren0;
    const L = (G.inbox && G.inbox.items) || []; r.letter = L.length ? L[L.length - 1].title : '(no letters: ' + JSON.stringify(Mayor.M()).slice(0, 200) + ')';
    const card = Ending.cards().find(x => x.label === 'Mayor Frank Kowalczyk'); r.card = card ? card.lines.join(' ') : null;
    return r; }, choice, lobby, exposeRnd);

  const mc = await mayorRun('clean', false, 0);
  ok(mc.due === 'mayor_offer' && mc.bld && mc.labels.length === 5, 'Year 12: Frank’s card, 5 choices: ' + mc.labels.map(l => l.slice(0, 28)).join(' | '));
  ok(Math.abs(mc.occ1 - 0.15) < 0.01 && Math.abs(mc.noi1 - (1 + 0.15 * -0.15)) < 0.01 && mc.end === 'clean', 'clean: +15 points let at 85% rent; investigation finds nothing. Ending: "' + mc.card + '"');
  const ms = await mayorRun('sweet', false, 0);
  ok(Math.abs(ms.noi1 - 1.03) < 0.01 && Math.abs(ms.noi2 - 1) < 0.01 && ms.end === 'sweet_exposed', 'sweetheart: rent +3% on the building, exposed: back to market (' + ms.letter + ')');
  const mk = await mayorRun('skim', false, 0);
  ok(Math.abs(mk.cash1 - 3) < 0.01 && Math.abs(mk.cash2 - (3 - 7.5)) < 0.01 && !mk.over && mk.end === 'skim_exposed', 'skim: +$3M to you; exposed: $7.5M fine, still CEO. "' + mk.card + '"');
  const mq = await mayorRun('skim', true, 0.3);
  ok(Math.abs(mq.cash2 - 3) < 0.01 && mq.pc === -2 && mq.end === 'skim_quiet', 'skim + lobbying (2 political capital): 20% odds, a 0.3 roll stays quiet; you keep $3M');
  const mr = await mayorRun('refuse', false, 0);
  ok(mr.pc === 2 && mr.occ1 === 0 && /said no/.test(mr.letter) && (!mr.ren0 || mr.ren < 0.9), 'refuse: no lease; the Ledger "' + mr.letter + '": +2 political capital' + (mr.ren0 ? ', Rennick ×' + mr.ren.toFixed(2) : '') + '. "' + mr.card + '"');

  // 6. the Mayor in the tower: pre-let while it is built
  await fresh();
  const tw = await pg.evaluate(() => {
    const G = GameState, r = {};
    const it = Tower.agenda(8, []); it[0].choices[0].go(); G.balance.cash = 400;
    const it2 = Tower.agenda(9, []); (it2[0].choices.find(c => /^Build it \(/.test(c.label)) || it2[0].choices[0]).go();
    __at(10, 1); const o = []; Tower.processQuarter(o); __card('tower_plot', /^Buy it/); Tower.processQuarter(o); __card('tower_finance', /^Construction loan/);
    for (let i = 0; i < 3; i++) { Tower.processQuarter(o); if (Story.S().due === 'tower_overrun') __card('tower_overrun', /./); }
    G.portfolio.forEach(x => { if (x.id !== 'off_cel') x.occupancy = 0.95; });
    r.stage = Tower.T().stage; __at(12, 3); Story.S().due = null; Mayor.processQuarter([]); r.due = Story.S().due; r.pre = Mayor.M().pre;
    const c = __card('mayor_offer', /^Clean/); r.body = /before it opens/.test(c.body); r.city = JSON.stringify(Tower.T().city);
    Tower.debug({ forceRoad: 'B' });
    for (let i = 0; i < 14 && Tower.T().stage === 'build'; i++) { Tower.processQuarter(o); if (Story.S().due === 'tower_overrun') __card('tower_overrun', /./); }
    const p = Tower.tower(); r.open = Tower.T().stage; r.occ = p && p.occupancy; return r; });
  ok(tw.stage === 'build' && tw.due === 'mayor_offer' && tw.pre && tw.body, 'tower under construction in Year 12: Frank asks to pre-let it');
  ok(tw.open === 'open' && Math.abs(tw.occ - 0.85) < 0.01, 'the tower opens ' + Math.round(tw.occ * 100) + '% let (70% + the city’s 15%); city lease ' + tw.city);

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
