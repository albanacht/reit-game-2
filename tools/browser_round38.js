/* browser_round38.js — round 38: fewer pauses at the end of the meeting, map
   labels, the Properties arrow, works and leasing in the Dealroom, interest on
   cash, building condition and repeat renovation, the scrip offer only in a real
   crisis, no "on hold" for belt-tightening, Levi's pick you can pay for, Tex
   never re-offered and his 3-year term, the crisis tools (cut, pledge, trust,
   Hassan's credit, Williams's restore demand), the gala every 2 years.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round38.js" [outdir] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const OUT = process.argv[2] || '/tmp';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'warning') errs.push('warn: ' + m.text()); });
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  const fresh = () => pg.evaluate(() => { localStorage.clear(); UI.newGame(); UI.closeModal(); Story.S().due = null; GameState._pendingDecision = null; GameState.debtTranches.forEach(t => { t.maturityYear += 10; }); });
  const setPhase = ph => pg.evaluate(ph => { const A = GameState.arc, q = GameState.totalQuartersElapsed();
    if (ph === 'crisis') { A.warnStart = q - 2; A.crisisStart = q - 1; A.crisisEnd = q + 6; A.afterStart = 999; }
    else if (ph === 'cheap') { A.warnStart = q + 3; A.crisisStart = q + 8; A.crisisEnd = q + 14; }
    else if (ph === 'recovery') { A.warnStart = q - 10; A.crisisStart = q - 8; A.crisisEnd = q - 1; A.afterStart = 999; }
    return Arc.phase(); }, ph);
  const mem = id => pg.evaluate(id => Directors.card(id).memory.join(' | '), id);
  await pg.goto(R); await wait(300); await fresh(); await wait(400);

  // 1. the end of the meeting: no Continue between the pay items and Back to work
  const meetingUp = () => pg.evaluate(() => { const m = document.getElementById('meeting'); return !!m && !m.classList.contains('hidden'); });
  for (let i = 0; i < 6 && !(await meetingUp()); i++) {
    await pg.evaluate(() => { if (GameState._pendingDecision) { UI.openPendingDecision(); const c = document.querySelector('.decision-choice:not(.decision-choice-disabled)'); c && c.click(); } UI.closeModal(); });
    await pg.click('#btn-advance-quarter'); await wait(1000); await pg.evaluate(() => UI.closeModal());
  }
  const steps = [];
  for (let s = 0; s < 120 && await meetingUp(); s++) {
    await wait(200); await pg.evaluate(() => Meeting.flush()); await wait(100);
    const btns = await pg.evaluate(() => [...document.querySelectorAll('#mt-actions .mt-btn')].map(b => ({ t: b.querySelector('b').textContent, dis: b.disabled })));
    if (!btns.length) continue;
    steps.push(btns.map(x => x.t).join(' / '));
    const back = btns.findIndex(x => /^Back to work/.test(x.t));
    const i = back > -1 ? back : Math.max(0, btns.findIndex(x => !x.dis));
    await pg.evaluate(i => document.querySelectorAll('#mt-actions .mt-btn')[i].click(), i);
    if (back > -1) break;
  }
  const bi = steps.findIndex(x => /Back to work/.test(x));
  ok(bi > 1 && !/^Continue$/.test(steps[bi - 1]), 'meeting end: "' + steps.slice(Math.max(0, bi - 2), bi + 1).map(x => x.slice(0, 40)).join('" → "') + '"');

  // 2. map labels and the toggle; the Properties arrow and hint
  await fresh(); await setPhase('cheap');
  const mp = await pg.evaluate(() => { UI.renderAll(); MAP.render(); const own = document.querySelectorAll('.mk-lbl.own').length, sale = document.querySelectorAll('.mk-lbl.sale').length, t1 = (document.querySelector('.mk-lbl.own') || {}).textContent;
    document.getElementById('map-labels').click(); const off = document.querySelectorAll('.mk-lbl').length; document.getElementById('map-labels').click();
    return { own, sale, t1, off, n: GameState.portfolio.length }; });
  ok(mp.own === mp.n && mp.off === 0 && /^\$[\d.]+M · [\d.]+% · \d+%$/.test(mp.t1), 'map: ' + mp.own + ' of our buildings labelled ("' + mp.t1 + '"), ' + mp.sale + ' for sale; Labels: off hides them');
  const pt = await pg.evaluate(() => { document.querySelector('.tb-tab[data-view="properties"]').click(); return { chev: document.querySelectorAll('#tMine .chev').length, hint: /Click a building to open it/.test(document.getElementById('tab-properties').textContent), cond: [...document.querySelectorAll('#tMine .cond')].map(x => x.textContent) }; });
  ok(pt.chev > 0 && pt.hint && pt.cond.length > 0, 'Properties: arrows on rows, the hint line, condition shown (' + [...new Set(pt.cond)].join(', ') + ')');

  // 3. interest on cash
  const ci = await pg.evaluate(() => { const G = GameState; G.balance.cash = 100; const r = Financials.cashRate(); Financials.runQuarter(); return { got: G.pnl.cashInterest, r, want: 100 * r / 400 }; });
  ok(Math.abs(ci.got - ci.want) < 0.02 && ci.got > 0, 'interest on cash: $100M at ' + ci.r.toFixed(2) + '% → $' + ci.got + 'M this quarter');

  // 4. condition and renovating again
  await fresh(); await setPhase('cheap');
  const rv = await pg.evaluate(() => { const G = GameState; G.balance.cash = 300; if (!Staff.hasRole('asset')) G.staff.push({ roleId: 'asset', title: 'Asset Manager', name: 'T', salary: 0.2, skill: 6 });
    const p = G.portfolio.find(x => !Tenants.isLocked(x)); p.quarterOwned = 8; p.occupancy = 0.82;
    p.renovated = true; p.renovatedYear = G.meta.year - 2; const a = Properties.condition(p).label, ra = Properties.canRenovate(p);
    p.renovatedYear = G.meta.year - 7; const c = Properties.condition(p).label, rc = Properties.canRenovate(p);
    p.renovatedYear = G.meta.year - 11; const d = Properties.condition(p).label;
    return { a, ra: ra.ok, why: ra.reason, c, rc: rc.ok, d }; });
  ok(rv.a === 'New' && !rv.ra && rv.c === 'Worn' && rv.rc && rv.d === 'Tired', 'condition: 2 years New (renovate: "' + rv.why + '"), 7 years Worn (renovate again: yes), 11 years Tired');

  // 5. the Dealroom shows leasing in motion
  const dr = await pg.evaluate(() => { const G = GameState, p = G.portfolio.find(x => !Tenants.isLocked(x) && !x.underConstruction); p.occupancy = 0.8; UI.leaseUp(p.id); document.querySelector('#modal .btn-primary, .modal .btn-primary') && document.querySelector('#modal .btn-primary, .modal .btn-primary').click(); UI.closeModal();
    if (p.leaseUpYear !== G.meta.year) p.leaseUpYear = G.meta.year;
    Journal.render(); return /Leased up /.test(document.getElementById('stories-body').textContent) && /Building works and leasing/.test(document.getElementById('stories-body').textContent); });
  ok(dr, 'Dealroom: "Building works and leasing" lists this year’s lease-up');

  // 6. the CFO's scrip offer: only in a crisis with the dividend uncovered
  const sc = await pg.evaluate(() => { const d = World.DECISIONS.find(x => x.id === 'scrip_dividend'), G = GameState; G.balance.cash = 2; G.ratios.dividendCoverage = 0.8; return d.when(); });
  await setPhase('crisis');
  const sc2 = await pg.evaluate(() => { const d = World.DECISIONS.find(x => x.id === 'scrip_dividend'), G = GameState; G.ratios.dividendCoverage = 0.8; const a = d.when(); G.ratios.dividendCoverage = 1.3; return { a, b: d.when() }; });
  ok(!sc && sc2.a && !sc2.b, 'scrip dividend: not in calm times (cash low), yes in a crisis with cover 0.8x, no at 1.3x');

  // 7. belt-tightening year 2 short of capital: no "on hold"
  await fresh(); await setPhase('cheap');
  const hd = await pg.evaluate(() => { const G = GameState; G._belt = { until: 99, y2asked: true }; G.board.politicalCapital = 0; Story.S().due = 'levi_belt2';
    G._pendingDecision = World.systemDecision(); UI.openPendingDecision(); const h = !!document.querySelector('.decision-hold'); const t = document.getElementById('modal-body').textContent; UI.closeModal(); G._pendingDecision = null; Story.S().due = null;
    return { hq: 0, h, end: /End it here/.test(t) }; });
  ok(!hd.h && hd.end, 'belt-tightening year 2 with no political capital: "End it here", no "put it on hold"');

  // 8. Levi's pick at the bottom: one you can pay for, at most a fifth of assets
  const lb = await pg.evaluate(() => { const G = GameState; G.balance.cash = 5; Levi.debug({ stage: 'hired', year: 2 }); Levi.L().gems.bottom = 'asked';
    const k = World.DECISIONS.find(x => x.id === 'levi_bottom').build(); const m = (k.body.match(/asking \$([\d.]+)M/) || [])[1];
    const R = Financials.debtRoom(), cap = Math.min(Math.max(15, G.balance.totalAssets * 0.2), Math.max(0, (window.Revolver && G.revolver ? Revolver.spendable() : G.balance.cash)) + Math.max(0, R.secured - R.refinancing));
    const big = Math.max.apply(null, G.propertyMarket.filter(p => p.listedByOwner).map(p => p.askingPrice));
    return { m: m ? +m : null, cap, big }; });
  ok(lb.m == null || lb.m <= lb.cap + 0.01, 'Levi’s bottom pick: ' + (lb.m == null ? 'none affordable' : '$' + lb.m + 'M') + ' (limit $' + lb.cap.toFixed(1) + 'M; the biggest listing is $' + lb.big.toFixed(1) + 'M)');

  // 9. Tex: never re-offered once gone; a 3-year term at 2 political capital
  const tx = await pg.evaluate(() => { const G = GameState, w = War.W(); Directors.addDirector('tex', 6); Directors.removeDirector('tex', 'test');
    w.stage = 'war'; w.texOffers = 1; w.texYear = 0; const items = War.agenda(G.meta.year + 1, []);
    return { seat: JSON.stringify(items).indexOf('seventh seat') > -1, formerly: !!G.board.formerly.tex }; });
  ok(!tx.seat && tx.formerly, 'Tex forced off: the "seventh seat" item never comes back');
  await fresh(); await setPhase('cheap');
  const tt = await pg.evaluate(() => { const G = GameState, b = G.board; Directors.addDirector('tex', 6); b.texMeetings = 2; b.politicalCapital = 1; G.meta.year = 4; b._meetingYear = 0;
    const earn = Board.earnPoliticalCapital; Board.earnPoliticalCapital = () => []; Meeting.open(); Board.earnPoliticalCapital = earn; const out = { has: Directors.has('tex'), pc: b.politicalCapital, note: (b._lastEarned || []).join(' ') }; Meeting.close && Meeting.close(); return out; });
  ok(!tt.has && tt.pc === 1 && /term ended/.test(tt.note), 'Tex at his third meeting with 1 political capital: term ends, no reputation hit ("' + tt.note.slice(-90) + '")');
  const t2 = await pg.evaluate(() => { const G = GameState, b = G.board; b.formerly = {}; Directors.addDirector('tex', 6); b.texMeetings = 0; b.politicalCapital = 3; G.meta.year = 5; b._meetingYear = 0;
    Meeting.open(); const a = { has: Directors.has('tex'), pc: b.politicalCapital }; if (Meeting.close) Meeting.close(); return a; });
  ok(t2.has && t2.pc >= 3, 'Tex at his first meeting: no capital spent (' + t2.pc + ' left)');

  // 10. the crisis tools: the cut (covered), Okafor and Williams, the pledge, broken
  await fresh(); await setPhase('crisis');
  await pg.evaluate(() => { for (let i = 0; i < 3; i++) { Financials.runQuarter(); Story.S().due = null; GameState._pendingDecision = null; } });
  const cr = await pg.evaluate(() => { const G = GameState; G.board.politicalCapital = 4; G.company.dividendPerShare = Math.max(0.1, G.company.dividendPerShare);
    const pr = Financials.payoutRatio(), c = Financials.canEmergencyCut(), r = Financials.emergencyCut(), p0 = Crisis.canPledge(), pl = Crisis.pledge();
    return { pr, ok: c.ok, cut: r.success, pledgeOk: p0.ok, pl: pl.success, due: G._pledge && G._pledge.dueTq, pc: G.board.politicalCapital }; });
  const wm = await mem('williams'), om = await mem('okafor');
  ok(cr.ok && cr.cut && /emergency dividend cut, which he approved \(−\)/.test(wm) && /balance sheet in the crisis \(\+\)/.test(om), 'emergency cut with payout at ' + (cr.pr == null ? '?' : Math.round(cr.pr * 100) + '%') + ': allowed; Williams −1, Okafor +1');
  ok(cr.pledgeOk && cr.pl && /pledged the dividend back \(\+\)/.test(wm), 'pledge the dividend back: Williams +1, due ' + cr.due);
  const br = await pg.evaluate(() => { const G = GameState, pc0 = G.board.politicalCapital; let out = []; for (let i = 0; i < 14 && G._pledge; i++) { out = Crisis.processQuarter([]); if (!G._pledge) break; G.meta.quarter++; if (G.meta.quarter > 4) { G.meta.quarter = 1; G.meta.year++; } }
    return { gone: !G._pledge, out: out.map(x => x.text).join(' '), pc: pc0 - G.board.politicalCapital }; });
  ok(br.gone && /broke your pledge/.test(br.out) && br.pc === 1, 'pledge missed: "' + br.out + '" (political capital −' + br.pc + ')');

  // 11. after the crisis: Williams asks for the dividend back (three real choices)
  await fresh(); await setPhase('recovery');
  await pg.evaluate(() => { for (let i = 0; i < 3; i++) { Financials.runQuarter(); Story.S().due = null; GameState._pendingDecision = null; } });
  const rs = await pg.evaluate(() => { const G = GameState, d = G.company.dividendPerShare; G._eCut = { q: 1, from: d, to: d / 2, restored: false }; G.company.dividendPerShare = d / 2;
    const items = []; Crisis.agenda(4, items); const it = items[0]; if (!it || !it.choices) return { none: true, n: items.length, pr: Financials.payoutRatio() };
    const labels = it.choices.map(c => c.label + (c.disabled ? ' [locked]' : '')); const half = it.choices[1].go(); const after = G.company.dividendPerShare;
    return { labels, after, d, restore: G._restore }; });
  ok(rs.labels && rs.labels.length === 3 && Math.abs(rs.after - rs.d * 0.75) < 0.006 && rs.restore, 'Williams wants it back: [' + (rs.labels || []).join(' | ') + ']; halfway: $' + (rs.after || 0).toFixed(2));
  const rs2 = await pg.evaluate(() => { const G = GameState; G.company.dividendPerShare = G._restore.from; const out = Crisis.processQuarter([]); return { out: out.map(x => x.text).join(' '), done: !G._restore && G._eCut.restored === true }; });
  ok(rs2.done && /kept your promise/.test(rs2.out), 'the rest restored in time: "' + rs2.out + '"');

  // 12. ask the market for trust; Hassan's credit once a quarter
  await fresh(); await setPhase('crisis');
  const tr = await pg.evaluate(() => { const G = GameState; G.board.politicalCapital = 3; G.balance.cash = 50; const a = Crisis.canTrust(), r = Crisis.trust(), b2 = Crisis.canTrust();
    Journal.render(); const btn = document.getElementById('dr-trust');
    Crisis.credit(); Crisis.credit();
    return { a: a.ok, r: r.success, again: b2.ok, why: b2.why, pc: G.board.politicalCapital, boost: PR.active().some(x => x.id === 'trust'), btn: !!btn }; });
  const hm = await mem(await pg.evaluate(() => Directors.has('hassan') ? 'hassan' : 'mansour'));
  ok(tr.a && tr.r && !tr.again && tr.pc === 2 && tr.boost && tr.btn, 'ask the market for trust: done once (−1 political capital, +3% for 2 quarters); again: "' + tr.why + '"');
  ok((hm.match(/fought to fill the buildings/g) || []).length === 1, 'Hassan +0.5 for fighting for tenants, once a quarter');

  // 13. the gala: every 2 years, dearer each time
  await fresh();
  const gl = await pg.evaluate(() => { const G = GameState, b = G.board; b.politicalCapital = 1; G.meta.year = 3; const r1 = Board.hostGala(); const r2 = Board.hostGala(); G.meta.year = 4; const r3 = Board.hostGala(); G.meta.year = 5; const c = Board.galaCost(); const r4 = Board.hostGala();
    return { r1: r1.success, r2: r2.success, r3: r3.success, c, r4: r4.success }; });
  ok(gl.r1 && !gl.r2 && !gl.r3 && gl.c === 1 && gl.r4, 'gala: Year 3 yes, again in Year 3 or 4 no, Year 5 yes at $' + gl.c + 'M');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
