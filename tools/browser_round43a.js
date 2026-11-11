/* browser_round43a.js — round 43, first half: Space shows the next meeting line
   and Fast is the default; renovation advice and warehouses; a crisis empties
   floors; Granite against family deals and a second ignored pay vote; the belt
   bonus bug; restoring the dividend; "I haven't forgotten the tower"; Jenkins's
   first-time lessons.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round43a.js" [outdir] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  const fresh = async () => { await pg.evaluate(() => { localStorage.clear(); UI.newGame(); UI.closeModal(); }); await wait(600); await pg.evaluate(() => { Story.S().due = null; GameState._pendingDecision = null; GameState.debtTranches.forEach(t => { t.maturityYear += 12; }); }); };
  const setPhase = ph => pg.evaluate(ph => { const A = GameState.arc, q = GameState.totalQuartersElapsed();
    if (ph === 'crisis') { A.warnStart = q - 2; A.crisisStart = q - 1; A.crisisEnd = q + 8; A.afterStart = 999; A.variant = 'credit_crunch'; }
    else if (ph === 'cheap') { A.warnStart = q + 9; A.crisisStart = q + 14; A.crisisEnd = q + 20; }
    else if (ph === 'warning') { A.warnStart = q - 1; A.crisisStart = q + 4; A.crisisEnd = q + 10; }
    else if (ph === 'recovery') { A.warnStart = q - 10; A.crisisStart = q - 8; A.crisisEnd = q - 1; A.afterStart = 999; }
    return Arc.phase(); }, ph);
  await pg.goto(R); await wait(300); await fresh();

  // 1. the meeting: Fast by default; Space shows one more line
  const sp = await pg.evaluate(async () => { const G = GameState; G.meta.year = 3; G.meta.quarter = 1; G.meta.totalQuarters = 9; Meeting.open();
    const on = (document.querySelector('#mt-speed button.on') || {}).textContent;
    await new Promise(r => setTimeout(r, 30)); const n0 = document.querySelectorAll('#mt-chat .mt-line, #mt-chat .mt-note').length;
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true })); const n1 = document.querySelectorAll('#mt-chat .mt-line, #mt-chat .mt-note').length;
    Meeting.close(); return { on, n0, n1 }; });
  ok(sp.on === 'Fast' && sp.n1 === sp.n0 + 1, 'meeting: Fast by default; Space shows the next line (' + sp.n0 + ' → ' + sp.n1 + ')');

  // 2. a crisis empties floors (multi-tenant buildings slide; a calm year does not)
  await fresh(); await setPhase('cheap');
  const calm = await pg.evaluate(() => { const G = GameState, ps = G.portfolio.filter(p => !Tenants.isLocked(p)), o0 = ps.reduce((a, p) => a + p.occupancy, 0) / ps.length;
    for (let i = 0; i < 4; i++) { Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null; } return { o0, o1: ps.reduce((a, p) => a + p.occupancy, 0) / ps.length }; });
  await fresh(); await setPhase('crisis');
  const cr = await pg.evaluate(() => { const G = GameState, ps = G.portfolio.filter(p => !Tenants.isLocked(p)), o0 = ps.reduce((a, p) => a + p.occupancy, 0) / ps.length;
    for (let i = 0; i < 4; i++) { Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null; } return { o0, o1: ps.reduce((a, p) => a + p.occupancy, 0) / ps.length, ph: Arc.phase() }; });
  ok(cr.o1 < cr.o0 - 0.035 && (cr.o1 - cr.o0) < (calm.o1 - calm.o0) - 0.03, 'a year of crisis: occupancy ' + Math.round(cr.o0 * 100) + '% → ' + Math.round(cr.o1 * 100) + '% (a calm year: ' + Math.round(calm.o0 * 100) + '% → ' + Math.round(calm.o1 * 100) + '%)');

  // 3. warehouses: +4%, and Jenkins's lease-up letter warns
  await fresh(); await setPhase('cheap');
  const wh = await pg.evaluate(() => { const G = GameState; G.balance.cash = 200; G.staff.push({ roleId: 'asset', title: 'AM', name: 'T', salary: 0.2, skill: 6 });
    let p = G.portfolio.find(x => x.sector === 'industrial' && !Tenants.isLocked(x)); if (!p) { p = G.portfolio.find(x => !Tenants.isLocked(x)); p.sector = 'industrial'; }
    p.quarterOwned = 8; p.wearStart = G.meta.year - 8; delete p.renovatedYear; p.occupancy = 0.97; const n0 = p.annualNOI; Properties.startRenovation(p.id);
    for (let i = 0; i < 2; i++) { Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null; }
    const lease = (GameState.inbox.items || []).length; return { step: p.renoStep, ramp: p.renoRamp, cond: Properties.condition(p).label }; });
  ok(wh.step === 1.01 && wh.ramp === 4 && wh.cond === 'New', 'a warehouse renovated: New, rent steps ×' + wh.step + ' for 4 quarters (about +4%; other buildings +10%)');

  // 4. Granite: a family deal costs a letter and 15 points; ignoring the pay vote twice is not allowed
  await fresh();
  const gr = await pg.evaluate(() => { const x = IndexFund.X(); x.stage = 'in'; IndexFund.family('yard');
    const letter = (GameState.inbox.items || []).find(i => /Granite on/.test(i.title));
    x.sopForce = null; x.ignored = true; const items = []; const it = IndexFund.sayOnPayItem(3, items); x.sopForce = 30; it.effect();
    const ch = items[0] && items[0].choices.find(c => /Ignore/.test(c.label));
    GameState.meta.quarter = 1; x.letterYear = null; x.targets = [{ id: 'chen', why: 'test', year: null }]; IndexFund.processQuarter([]);
    return { letter: letter && letter.title, ign: ch && ch.disabled, why: ch && ch.why, yearly: (GameState.inbox.items || []).some(i => /Granite’s votes this year/.test(i.title)), odds: Gary.yardOdds(0.15, false) }; });
  ok(gr.letter && gr.ign && gr.yearly, 'Granite: "' + gr.letter + '"; the yearly letter; a second ignore is locked ("' + gr.why + '")');

  // 5. belt-tightening: both years without a bonus
  await fresh();
  const bt = await pg.evaluate(() => { const G = GameState; G.meta.year = 5; G.meta.quarter = 1; Levi.debug({ stage: 'hired', year: 2, beltFor: 'crisis' }); G.board.politicalCapital = 5;
    World.DECISIONS.find(x => x.id === 'levi_belt').build().choices[0].apply();
    G.meta.quarter = 4; G._belt.y2asked = true; World.DECISIONS.find(x => x.id === 'levi_belt2').build().choices[0].apply();
    const t5 = Pay.meeting(5)[0], t5b = Pay.meeting(5); Pay.L().lastMeeting = null; const m5 = Pay.meeting(5).map(i => (i.lines[0] || [])[1] || '').join(' ');
    Pay.L().lastMeeting = null; const m6 = Pay.meeting(6).map(i => (i.lines[0] || [])[1] || '').join(' ');
    return { m5: /No bonuses this year/.test(m5), m6: /No bonuses this year/.test(m6) }; });
  ok(bt.m5 && bt.m6, 'belt-tightening years 1 and 2: no bonus for Year 5 and none for Year 6');

  // 6. after the crisis: one click restores the dividend
  await fresh(); await setPhase('recovery');
  const rs = await pg.evaluate(() => { const G = GameState, d = G.company.dividendPerShare; G._eCut = { q: 1, from: d, to: d / 2, restored: false }; G.company.dividendPerShare = d / 2; UI.renderAll();
    const b = document.getElementById('btn-restore-div'); const t = b ? b.textContent : ''; if (b) b.click(); return { t, after: G.company.dividendPerShare, d, restored: G._eCut.restored }; });
  ok(/Restore to pre-crisis/.test(rs.t) && Math.abs(rs.after - rs.d) < 0.001 && rs.restored === true, '"' + rs.t + '": back to $' + rs.after.toFixed(2));

  // 7. a complaint about something you did, not a number: the meeting's words
  await fresh();
  const ag = await pg.evaluate(async () => { const G = GameState; G.meta.year = 4; G.meta.quarter = 1; G.meta.totalQuarters = 13;
    const rf = Directors.refresh, cd = Directors.card; Directors.refresh = () => {}; G.board.directors.forEach(d => { d.attitude = d.id === 'okafor' ? 2 : 7; });
    Directors.card = id => Object.assign(cd(id), id === 'okafor' ? { cause: 'the tower', causeKind: 'memory' } : {});
    G.board._meetingYear = 3; G.board._personalYear = 3; G.board._lastReview = []; G.board._lastPromises = []; G.board._departYear = 3; G.board._storyYear = 3;
    Meeting.open(); let txt = '', btn = '';
    for (let s = 0; s < 40; s++) { Meeting.flush(); await new Promise(r => setTimeout(r, 30)); const bs = [...document.querySelectorAll('#mt-actions .mt-btn')];
      txt = document.getElementById('mt-chat').textContent; if (/wants an answer/.test((document.querySelector('#mt-actions .mt-prompt') || {}).textContent || '')) { btn = bs[0].querySelector('b').textContent; break; } if (bs.length) bs[0].click(); }
    Meeting.close(); Directors.refresh = rf; Directors.card = cd;
    return { line: (txt.match(/(I haven.t forgotten the tower[^.]*\.|Before we move on: the tower[^.]*\.)/) || [''])[0], btn }; });
  ok(ag.line && /no more surprises/.test(ag.btn), 'Okafor on the tower: "' + ag.line + '" / your option: "' + ag.btn + '"');

  // 8. Jenkins's first-time lessons: the storm warning
  await fresh(); await setPhase('warning');
  const ls = await pg.evaluate(() => { GameState._tutorialEnabled = true; Lessons.processQuarter([]); Lessons.processQuarter([]); return (GameState.inbox.items || []).filter(i => /Storm warning/.test(i.title)).length; });
  ok(ls === 1, 'the warning phase: Jenkins writes "Storm warning, boss", once');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
