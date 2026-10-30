/* browser_round37.js — round 37: cheaper overheads, the crisis at 80%, the
   Economy cell, yields on the Rest of the city and on your offer price, the new
   Levi (gems, no challenges), belt-tightening years 1 and 2, offer incentives on
   an empty single-tenant building, the emergency dividend cut.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round37.js" [outdir] */
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
  const card = (id, re) => pg.evaluate((id, src) => { const k = World.DECISIONS.find(x => x.id === id).build(); if (!k) return { none: true };
    const c = src ? k.choices.find(x => new RegExp(src).test(x.label)) : null; const out = { title: k.title, labels: k.choices.map(x => x.label + (x.check && !x.check() ? ' [locked]' : '')) };
    if (c) { out.msg = c.apply(); Story.S().due = null; } return out; }, id, re ? re.source : null);
  const setPhase = ph => pg.evaluate(ph => { const A = GameState.arc, q = GameState.totalQuartersElapsed();
    if (ph === 'crisis') { A.warnStart = q - 2; A.crisisStart = q - 1; A.crisisEnd = q + 6; }
    else if (ph === 'cheap') { A.warnStart = q + 3; A.crisisStart = q + 8; A.crisisEnd = q + 14; }
    else if (ph === 'recovery') { A.warnStart = q - 10; A.crisisStart = q - 8; A.crisisEnd = q - 1; }
    return Arc.phase(); }, ph);
  await pg.goto(R); await wait(300); await fresh(); await wait(400);

  // 1. overheads and the Economy cell
  const ga = await pg.evaluate(() => { const G = GameState, v = G.portfolio.reduce((a, p) => a + p.currentValue, 0); Financials.runQuarter(); return { ga: G.pnl.gAndA, base: 0.2 + v * 0.001, sev: G.arc.sev }; });
  ok(ga.ga >= ga.base - 0.01 && ga.sev <= 0.8 + 1e-9, 'overheads: $' + ga.ga.toFixed(2) + 'M a quarter (formula part $' + ga.base.toFixed(2) + 'M); crisis strength ' + ga.sev);
  const eco = []; for (const ph of ['cheap', 'crisis', 'recovery']) { const real = await setPhase(ph); await pg.evaluate(() => UI.renderAll()); eco.push(real + ' → ' + await pg.evaluate(() => { const c = [...document.querySelectorAll('#tb-hud .hud')].find(x => /Economy/.test(x.textContent)); return c ? c.querySelector('.v').textContent : 'none'; })); }
  ok(/Calm/.test(eco[0]) && /Crisis/.test(eco[1]) && /Recovering/.test(eco[2]), 'top bar shows the economy: ' + eco.join(' | '));

  // 2. yields in the Rest of the city, and on the offer price
  await fresh(); await setPhase('cheap');
  const y = await pg.evaluate(() => { UI.renderAll(); document.querySelector('.tb-tab[data-view="properties"]').click(); const t = document.getElementById('restToggle'); if (t) t.click();
    const heads = [...document.querySelectorAll('#tRest th')].map(x => x.textContent.trim());
    const p = (GameState.cityRivals || []).concat(GameState.propertyMarket).find(x => x.annualNOI > 0 && !x.listedByOwner && !Deals.blocked(x.id));
    Deals.openOffer(p.id); const txt = document.getElementById('modal-body').textContent; UI.closeModal(); return { heads, txt: (txt.match(/Cap rate on your price.*?%\)/) || [''])[0] }; });
  ok(y.heads.some(h => /Yield today/.test(h)), 'Rest of the city columns: ' + y.heads.filter(Boolean).join(', '));
  ok(/Cap rate on your price \d/.test(y.txt) && /yield today \d/.test(y.txt), 'offer screen: "' + y.txt + '"');

  // 3. Levi: no challenges, one awkward line, the gems, quits after two ignored
  await fresh(); await setPhase('cheap');
  const lv = await pg.evaluate(() => { const G = GameState; G.meta.year = 4; G.meta.quarter = 2; G.meta.totalQuarters = 13; Levi.debug({ stage: 'hired', year: 2 });
    const all = [3, 4, 5, 6, 7].map(y => Levi.agenda(y, [])), js = JSON.stringify(all);
    return { n: all.reduce((a, x) => a + x.length, 0), z: /z-test/.test(js), target: /by the next meeting/.test(js), pick: Levi.gemPick() && Levi.gemPick().name }; });
  ok(lv.n === 1 && lv.z && !lv.target, 'Levi at five meetings: one awkward line in total, no targets, no mood effects');
  const g1 = await pg.evaluate(() => { const G = GameState; G.balance.cash = 300; const L = Levi.L(); L.gems.gem = 'asked'; L.gemId = Levi.gemPick().id; const p = Levi.gemPick(); const v = p.currentValue, n0 = p.annualNOI; window.__gp = { id: p.id, v, n0 }; return { name: p.name, v }; });
  let k = await card('levi_gem', /^Buy it/);
  const g2 = await pg.evaluate(() => { const p = GameState.portfolio.find(x => x.id === window.__gp.id); return p ? { mine: true, noi: p.annualNOI / window.__gp.n0, paid: p.purchasePrice / window.__gp.v } : { mine: false }; });
  ok(g2.mine && Math.abs(g2.noi - 1.10) < 0.01 && Math.abs(g2.paid - 0.85) < 0.02, 'the Moneyball building: "' + k.title + '": bought ' + g1.name + ' at 85% of value, rents +10%');
  await pg.evaluate(() => { const G = GameState; G.debtTranches.forEach(t => { t.maturityYear = G.meta.year + 2; }); Levi.L().gems.rates = 'asked'; });
  k = await card('levi_rates', /^Not now/);
  const q1 = await pg.evaluate(() => ({ ig: Levi.L().ignored, st: Levi.L().stage }));
  await pg.evaluate(() => { Levi.L().gems.bottom = 'asked'; });
  k = await card('levi_bottom', /^Not now/);
  const q2 = await pg.evaluate(() => ({ ig: Levi.L().ignored, st: Levi.L().stage, letter: (GameState.inbox.items || []).some(i => i.title === 'Nobody here reads my work') }));
  ok(q1.ig === 1 && q1.st === 'hired' && q2.ig === 2 && q2.st === 'quit' && q2.letter, 'ignored twice (rates, the bottom): Levi resigns, "Nobody here reads my work"');

  // 4. belt-tightening: year 1 costs 1 political capital; year 2 costs 2, defers maintenance, sends a bill
  await fresh(); await setPhase('cheap');
  const bt = await pg.evaluate(() => { const G = GameState; G.meta.year = 4; G.meta.totalQuarters = 13; Levi.debug({ stage: 'hired', year: 2, beltFor: 'crisis' }); G.board.politicalCapital = 4; return true; });
  k = await card('levi_belt', /^Tighten belts/);
  const b1 = await pg.evaluate(() => ({ pc: GameState.board.politicalCapital, belt: JSON.stringify(GameState._belt) }));
  ok(b1.pc === 3 && /until/.test(b1.belt), 'year 1 of belt-tightening (' + k.title + '): political capital 4 → ' + b1.pc);
  const b2 = await pg.evaluate(() => { const G = GameState; for (let i = 0; i < 4; i++) { Financials.runQuarter(); if (Story.S().due === 'levi_belt2') break; Story.S().due = null; } return Story.S().due; });
  k = await card('levi_belt2', /^One more year/);
  const b3 = await pg.evaluate(() => { const G = GameState, occ0 = G.portfolio.map(p => p.occupancy); let bill = false; for (let i = 0; i < 6; i++) { Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null; if ((G.inbox.items || []).some(x => x.title === 'The catch-up bill')) bill = true; }
    return { pc: G.board.politicalCapital, y2: G._belt && G._belt.y2, bill, drift: G.portfolio.reduce((a, p, i) => a + (occ0[i] - p.occupancy), 0) }; });
  ok(b2 === 'levi_belt2' && b3.y2 && b3.pc === 1 && b3.bill, 'year 2 (2 political capital): the second year runs, maintenance is deferred, then "The catch-up bill"');

  // 5. offer incentives on an empty single-tenant building
  await fresh(); await setPhase('cheap');
  const inc = await pg.evaluate(() => { const G = GameState; G.balance.cash = 300;
    let p = G.portfolio.find(x => Tenants.isLocked(x));
    if (!p) { const m = G.propertyMarket.filter(x => x.listedByOwner && Tenants.isLocked(x))[0] || (G.cityRivals || []).find(x => Tenants.isLocked(x)); if (m) { World.buyAt(m, m.currentValue); p = G.portfolio.find(x => x.id === m.id); } }
    if (!p) return { none: true };
    const pos = p.lease.positions[0]; pos.vacant = true; pos.relet = 6; p.occupancy = 0; const n0 = p.annualNOI;
    const noAm = Tenants.canIncent(p).why;
    G.staff.push({ roleId: 'asset', title: 'Asset Manager', name: 'Test AM', salary: 0.2, skill: 6, traitId: null, portrait: 's01.jpg' });
    const r = Tenants.offerIncentives(p); const steps = [];
    for (let i = 0; i < 6; i++) { Financials.runQuarter(); steps.push(p.occupancy + '/' + (p.rentFactor == null ? 1 : p.rentFactor)); }
    return { name: p.name, noAm, msg: r.message, ok: r.success, rent: p.annualNOI / n0, steps: steps.join(' ') }; });
  ok(!inc.none && /Asset Manager/.test(inc.noAm) && inc.ok && Math.abs(inc.rent - 0.9) < 0.03 && /^1\/0\.25 1\/0\.5 1\/0\.75 1\/1/.test(inc.steps), 'offer incentives on ' + inc.name + ': needs an Asset Manager first; then "' + (inc.msg || '').slice(0, 70) + '"; rent at 90%, occupancy/rent factor by quarter: ' + inc.steps);

  // 6. the emergency dividend cut
  await fresh();
  await setPhase('cheap');
  const e0 = await pg.evaluate(() => Financials.canEmergencyCut().show);
  await pg.evaluate(() => { const G = GameState; G.meta.year = 5; G.meta.quarter = 2; G.meta.totalQuarters = 17; for (let i = 0; i < 4; i++) Financials.runQuarter(); });
  await setPhase('crisis');
  const ec = await pg.evaluate(() => { const G = GameState; G.company.dividendPerShare = 0.6; G.board.politicalCapital = 3;
    const c = Financials.canEmergencyCut(); UI.renderAll(); document.querySelector('.tb-tab[data-view="finance"]').click(); const btn = document.getElementById('btn-emergency-cut');
    const p0 = G.company.sharePrice, r = Financials.emergencyCut(); Directors.update();
    return { why: c.why, ok: c.ok, btn: !!btn && !btn.disabled, msg: r.message, div: G.company.dividendPerShare, pc: G.board.politicalCapital, px: G.company.sharePrice / p0, red: !!Directors.card('williams').redNow, again: Financials.canEmergencyCut().ok }; });
  ok(!e0 && ec.ok && ec.btn && Math.abs(ec.div - 0.3) < 0.011 && ec.pc === 2 && ec.px > 0.9 && !ec.red && !ec.again, 'emergency cut: hidden in calm times; in the crisis the button halves $0.60 → $' + ec.div + ', 1 political capital, price ×' + ec.px.toFixed(2) + ', no red line, once per crisis' + (ec.why ? ' (' + ec.why + ')' : ''));
  await setPhase('recovery');
  const rd = await pg.evaluate(() => (Board.demandFor('williams') || {}).text);
  ok(/Restore the dividend to \$0\.60/.test(rd || ''), 'after the crisis Williams asks for it back: "' + rd + '"');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
