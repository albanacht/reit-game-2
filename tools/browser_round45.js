/* browser_round45.js — round 45 fixes from Boss Alex's run:
   1. an unhappy director never complains about something he liked (Chen and "you hit back at Kessler");
   2. Granite's vote against Tex is skipped if Tex left earlier in the same meeting;
   3. the CFO no longer promises a rescue.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round45.js" */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  await pg.goto(R); await wait(300);
  await pg.evaluate(() => { localStorage.clear(); UI.newGame(); UI.closeModal(); }); await wait(600);

  // 1. Chen: unhappy, last memory is a good one. The cause must not be it.
  const c1 = await pg.evaluate(() => { const B = GameState.board; B.memory = B.memory || [];
    Directors.remember('chen', -1.2, 'you passed on the Elm Street deal'); Directors.remember('chen', 1, 'you hit back at Kessler');
    GameState.board.directors.find(d => d.id === 'chen').attitude = 3; Directors.refresh();
    const c = Directors.card('chen'); return { a: GameState.board.directors.find(d => d.id === 'chen').attitude, cause: c.cause, kind: c.causeKind }; });
  ok(!/hit back/.test(c1.cause), 'Chen (mood ' + c1.a + '): cause "' + c1.cause + '" (' + c1.kind + '), not his own advice');

  // 2. Granite targets Tex; Tex leaves before the item runs: no vote, no reputation hit
  const c2 = await pg.evaluate(() => { const x = IndexFund.X(); x.stage = 'in';
    if (!Directors.has('tex')) Directors.addDirector('tex', 6, 'test');
    x.targets = [{ id: 'tex', why: 'a friend of the CEO', year: null }]; x.visited = 1;
    const items = IndexFund.agenda(3, []); const it = items.find(i => /against Tex/.test(JSON.stringify(i.lines || '')));
    const before = it.when(); Directors.removeDirector('tex', 'test left'); return { found: !!it, before, after: it.when() }; });
  ok(c2.found && c2.before === true && c2.after === false, 'Granite vs Tex: runs while he sits (' + c2.before + '), skipped once he has left (' + c2.after + ')');

  // 3. Dahl's request count is taken when he speaks
  const c3 = await pg.evaluate(() => { const x = IndexFund.X(); x.visited = null; x.targets = []; Directors.addDirector('tex', 6, 'back for the test');
    const items = IndexFund.agenda(4, []); const open = items.find(i => typeof i.lines === 'function');
    const t1 = open.lines()[0][1]; Directors.removeDirector('tex', 'gone'); const t2 = open.lines()[0][1];
    const ask = items.find(i => i.when && /step down/.test(JSON.stringify(i.lines))); return { t1, t2, skip: ask ? ask.when() === false : null }; });
  ok(/request/.test(c3.t1) && !/I have 1 request/.test(c3.t2) && c3.skip === true, 'Dahl: "' + c3.t1.slice(-40) + '" → "' + c3.t2.slice(-40) + '"; the Tex request is skipped');

  const c4 = await pg.evaluate(() => JSON.stringify(Staff.ROLES ? Staff.ROLES.cfo : '') + document.body.innerHTML);
  ok(!/rescue facility in a squeeze/.test(c4), 'the CFO no longer promises a rescue facility in a squeeze');

  // ---- the CFO in a crisis ----
  const fresh = async () => { await pg.evaluate(() => { localStorage.clear(); UI.newGame(); UI.closeModal(); }); await wait(500);
    await pg.evaluate(() => { Story.S().due = null; GameState._pendingDecision = null; GameState.debtTranches.forEach(t => { t.maturityYear += 12; });
      GameState.staff.push({ roleId: 'cfo', title: 'CFO', name: 'Margaret Liu', salary: 0.4, skill: 6 }); }); };
  const crisis = () => pg.evaluate(() => { const A = GameState.arc, q = GameState.totalQuartersElapsed(); A.warnStart = q - 2; A.crisisStart = q - 1; A.crisisEnd = q + 8; A.afterStart = 999; A.afterEnd = 999; A.variant = 'credit_crunch'; return Arc.phase(); });

  // 5. rent deferral: card, cash out, the building holds, a twin without it slides; repaid after
  await fresh(); await crisis();
  const d = await pg.evaluate(() => { const G = GameState; G.balance.cash = 100;
    const ps = G.portfolio.filter(p => !Tenants.isLocked(p)); ps.forEach((p, i) => { p.sector = i % 2 ? 'office' : 'retail'; p.occupancy = 0.92; });
    const c = CfoAid.C(); c.pick = CfoAid.candidate().id; const card = World.DECISIONS.find(x => x.id === 'cfo_defer').build();
    const p = G.portfolio.find(x => x.id === c.pick), other = ps.find(x => x !== p), cash0 = G.balance.cash, ta0 = Story.otherAssets();
    const msg = card.choices[0].apply(); const cash1 = G.balance.cash, ta1 = Story.otherAssets();
    for (let i = 0; i < 4; i++) { Properties.quarterlyUpdate(); }
    const res = { title: card.title, msg, lent: cash0 - cash1, asset: ta1 - ta0, held: p.occupancy, slid: other.occupancy, drop: Properties.crisisDrop ? Properties.crisisDrop(p) : null };
    // the storm ends: settle
    const A = G.arc, q = G.totalQuartersElapsed(); A.crisisEnd = q - 1; Math.random = () => 0.1; const cb = G.balance.cash; CfoAid.processQuarter([]);
    res.back = G.balance.cash - cb; res.owed = CfoAid.owed(); return res; });
  ok(d.lent > 0 && Math.abs(d.asset - d.lent) < 0.02 && d.held >= 0.89 && d.slid < d.held - 0.03 && Math.abs(d.back - d.lent) < 0.02 && d.owed === 0,
     'deferral "' + d.title + '": lent $' + d.lent.toFixed(1) + 'M (on the books), held ' + Math.round(d.held * 100) + '% vs ' + Math.round(d.slid * 100) + '% next door; repaid $' + d.back.toFixed(1) + 'M');

  // 6. at most two per storm
  const two = await pg.evaluate(() => { const c = CfoAid.C(); c.used = { crisis: 2 }; c.lastQ = -9; Story.S().due = null; const r = Math.random; Math.random = () => 0; CfoAid.processQuarter([]); Math.random = r; return Story.S().due; });
  ok(two !== 'cfo_defer', 'no third deferral in the same storm');

  // 7. the government loan: eligible at 55-65% with a bond due and the line frozen; not at 70%
  await fresh(); await crisis();
  const g = await pg.evaluate(() => { const G = GameState, R = G.revolver; R.frozen = true; R.frozenCap = 0;
    G.debtTranches[0].maturityYear = G.meta.year; G.debtTranches[0].maturityQuarter = Math.min(4, G.meta.quarter + 2);
    G.ratios.debtToAssets = 0.70; const at70 = CfoAid.eligibleGov(); G.ratios.debtToAssets = 0.62; const at62 = CfoAid.eligibleGov(); G.ratios.debtToAssets = 0.50; const at50 = CfoAid.eligibleGov(); G.ratios.debtToAssets = 0.62;
    Story.S().due = null; CfoAid.processQuarter([]); const due = Story.S().due; const card = World.DECISIONS.find(x => x.id === 'cfo_gov').build();
    const cash0 = G.balance.cash, d0 = G.company.dividendPerShare; card.choices[0].apply();
    const t = G.debtTranches.find(x => x.gov), up = Financials.setDividend(d0 * 1.1);
    Pay.L().lastMeeting = null; const pm = Pay.meeting(G.meta.year).map(i => (i.lines[0] || [])[1] || '').join(' ');
    const call = Financials.getCallInfo(t.id); const rc = Financials.retireDebt(t.id); const up2 = Financials.setDividend(d0 * 1.05);
    return { at70, at62, at50, due, title: card.title, got: G.balance.cash - cash0 + (call ? call.total : 0), rate: t.rate, base: G.market.baseInterestRate, blocked: !up.success, pay: /government loan forbids/.test(pm), prem: call.premium, ok2: up2.success, again: CfoAid.eligibleGov() }; });
  ok(!g.at70 && g.at62 && !g.at50 && g.due === 'cfo_gov', 'government loan: offered at 62% (not at 70% or 50%) with a bond due and the line frozen');
  ok(Math.abs(g.rate - g.base) < 0.01 && g.blocked && g.pay && g.prem === 0 && g.ok2 && !g.again,
     '"' + g.title + '": at the base rate ' + g.rate + '%; dividend rise blocked, no bonus; repaid at par, strings gone, once a game');
  await pg.screenshot({ path: (process.argv[2] || '/tmp') + '/r45_gov.png' });
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
