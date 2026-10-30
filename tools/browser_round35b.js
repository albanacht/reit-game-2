/* browser_round35b.js — round 35: when Harlow goes bust, three ways out.
   Each path in its own game: buy the centre, lend Bob money, Harlow goes bust,
   then: the chairman's call (Hassan out, Mansour in, a grocer at 85%), the CFO's
   rescue facility (bonds due in two years refinanced, waiver, 70% recovered),
   the takeover by Gary (Family Groceries, the stake, Nora) or a turnaround firm
   (and its failure). Also: Mansour at 87%, the CFO's random placement retired,
   the share price no longer collapses.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round35b.js" [outdir] */
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
  await pg.goto(R); await wait(300);
  /* a game where we own the centre, lent Bob $24M, and Harlow has just gone bust */
  const setup = (cfo) => pg.evaluate(cfo => {
    localStorage.clear(); UI.newGame(); UI.closeModal(); const G = GameState; Story.S().due = null; G._pendingDecision = null;
    Levi.debug({ stage: 'passed' }); Gary.S().stage = 'tender';
    G.meta.year = 4; G.meta.quarter = 2; G.meta.totalQuarters = 13; G.balance.cash = 200;
    if (cfo) G.staff.push({ roleId: 'financial', title: 'CFO', name: 'Test CFO', salary: 0.3, skill: 7, traitId: null, portrait: 's01.jpg' });
    Story.debug('offer', { due: 'story_harlow_offer' }); const o = World.DECISIONS.find(x => x.id === 'story_harlow_offer').build();
    o.choices.find(c => /^Buy it for/.test(c.label) && !/preferred/.test(c.label)).apply(); Story.S().due = null;
    Story.debug('ask', { due: 'story_harlow_loan' }); const l = World.DECISIONS.find(x => x.id === 'story_harlow_loan').build();
    const lend = l.choices.find(c => /^Lend/.test(c.label) && !/preferred/.test(c.label)); const loanLine = (l.body.match(/With this loan[^<]*<\/td><td>([^<]*)/) || [])[1] || '';
    lend.apply(); Story.S().due = null;
    const px0 = G.company.sharePrice; Story.debugBust('ran out of cash'); const card = World.DECISIONS.find(x => x.id === 'story_harlow_after').build();
    window.__card = card; window.__px0 = px0;
    return { due: Story.S().due, title: card && card.title, labels: card ? card.choices.map(c => c.label + (c.check && !c.check() ? ' [locked]' : '')) : [], loanLine, dc: G.portfolio.some(p => p.id === 'ind_hdc') };
  }, cfo);
  const pickApply = re => pg.evaluate(src => { const c = window.__card.choices.find(x => new RegExp(src).test(x.label)); const m = c.apply(); Story.S().due = null; return m; }, re.source);
  const q = n => pg.evaluate(n => { const out = []; for (let i = 0; i < n; i++) { Financials.runQuarter(); Board.evaluateQuarter(); Story.S().due = null; GameState._pendingDecision = null; } return out; }, n);

  // A. the chairman's call
  let s = await setup(false);
  ok(s.due === 'story_harlow_after' && s.dc && s.labels.length >= 5, 'bust: "' + s.title + '" [' + s.labels.map(x => x.slice(0, 38)).join(' | ') + ']');
  ok(/of your cash profit goes with it/.test(s.loanLine), 'the loan card said: "' + s.loanLine + '"');
  let m = await pickApply(/makes a call/);
  let a = await pg.evaluate(() => { const G = GameState, p = G.portfolio.find(x => x.id === 'ind_hdc'); return { hassan: Directors.has('hassan'), mansour: Directors.has('mansour'), tenant: p.lease.positions[0].t, rent: p.annualNOI, old: Story.H().oldRent, inst: (Story.H().instal || []).length }; });
  ok(!a.hassan && a.mansour && /story_tenant/.test(a.tenant) && Math.abs(a.rent - a.old * 0.85) < 0.05 && a.inst === 4, 'chairman: "' + m + '" Hassan out, Mansour in, a grocer at 85% (' + a.rent + ' of ' + a.old + '), 4 instalments from the court');
  await q(2);
  a = await pg.evaluate(() => { const p = GameState.portfolio.find(x => x.id === 'ind_hdc'); return { rf: p.rentFactor, res: Story.H().result, sc: Directors.scorecard().find(r => r.id === 'mansour') }; });
  ok((a.rf == null || a.rf === 1) && a.res === 'bust_williams' && a.sc && a.sc.want === '≥ 87%', 'two quarters later the grocer pays full rent; Mansour wants ' + (a.sc && a.sc.want));

  // B. the CFO's rescue facility
  s = await setup(true);
  const b0 = await pg.evaluate(() => { const G = GameState; return { due: G.debtTranches.filter(t => G.quartersUntilMaturity(t.maturityYear, t.maturityQuarter) <= 8).reduce((x, t) => x + t.amount, 0), n: G.debtTranches.length }; });
  m = await pickApply(/rescue facility/);
  let bb = await pg.evaluate(() => { const G = GameState; return { due: G.debtTranches.filter(t => G.quartersUntilMaturity(t.maturityYear, t.maturityQuarter) <= 8).reduce((x, t) => x + t.amount, 0), resc: G.debtTranches.filter(t => t.rescue).map(t => t.amount + ' at ' + t.rate + '%'), cov: G.credit.covenantLimit, inst: (Story.H().instal || []).reduce((x, i) => x + i.amt, 0), st: Story.H().stage }; });
  ok(b0.due > 0 && bb.due === 0 && bb.resc.length === 1 && bb.cov === 0.7 && bb.inst > 0 && bb.st === 'relet', 'CFO: "' + m + '" $' + b0.due + 'M due in 2 years → ' + bb.resc[0] + ', limit 70%, $' + bb.inst.toFixed(1) + 'M coming back, centre to market');
  await q(5);
  bb = await pg.evaluate(() => ({ cov: GameState.credit.covenantLimit, inst: (Story.H().instal || []).length }));
  ok(bb.cov === 0.6 && bb.inst === 0, 'a year on: the waiver ended (limit ' + Math.round(bb.cov * 100) + '%), all the money is back');

  // C1. Gary takes over: Family Groceries, the stake, Nora
  s = await setup(false);
  await pg.evaluate(() => { window.__rnd = Math.random; Math.random = () => 0.1; });
  m = await pickApply(/Gary runs it/);
  await pg.evaluate(() => { Math.random = window.__rnd; });
  let c = await pg.evaluate(() => { const G = GameState, p = G.portfolio.find(x => x.id === 'ind_hdc'); return { name: G.tenants.harlow_grocers.name, stake: Story.otherAssets(), rent: p.annualNOI, old: Story.H().oldRent, rf: p.rentFactor, nora: !!Story.H().nora }; });
  ok(/Family Groceries/.test(c.name) && c.stake > 0 && Math.abs(c.rent - c.old * 0.85) < 0.05 && c.rf === 0 && c.nora, 'Gary: "' + m + '" stake $' + c.stake + 'M on the books, no rent yet, then 85%');
  for (let i = 0; i < 5; i++) { await pg.evaluate(() => { Financials.runQuarter(); Board.evaluateQuarter(); }); if (await pg.evaluate(() => Story.S().due === 'story_family_nora')) break; await pg.evaluate(() => { Story.S().due = null; }); }
  c = await pg.evaluate(() => { const p = GameState.portfolio.find(x => x.id === 'ind_hdc'); const k = World.DECISIONS.find(x => x.id === 'story_family_nora').build(); return { due: Story.S().due, title: k && k.title, rf: p.rentFactor, li: GameState.pnl.loanInterest }; });
  ok(c.due === 'story_family_nora' && /brother-in-law/.test(c.title || ''), 'Nora runs it: "' + c.title + '"');
  m = await pg.evaluate(() => { const k = World.DECISIONS.find(x => x.id === 'story_family_nora').build(); const r = k.choices[0].apply(); Story.S().due = null; return { r, nb: GameState._noBonusYear === GameState.meta.year }; });
  ok(m.nb, 'quieted with a food drive; your bonus is waived this year: "' + m.r.slice(0, 80) + '"');

  // C2. the turnaround firm: safe (round 36: it no longer fails, even on the unluckiest roll)
  s = await setup(false);
  await pg.evaluate(() => { window.__rnd = Math.random; Math.random = () => 0.01; });
  m = await pickApply(/turnaround firm/);
  await pg.evaluate(() => { Math.random = window.__rnd; });
  await q(5);
  c = await pg.evaluate(() => ({ stake: Story.otherAssets(), rescue: Story.H().rescue, active: GameState.tenants.harlow_grocers.status, rf: GameState.portfolio.find(x => x.id === 'ind_hdc').rentFactor }));
  ok(c.stake > 0 && c.rescue === 'turnaround' && c.active === 'active' && (c.rf == null || c.rf === 1), 'turnaround firm, a year on: Harlow trading, paying rent, our stake worth $' + c.stake + 'M');

  // F. the yacht: if you made Bob sell it, the endings remember
  const y = await pg.evaluate(() => { const H = Story.H(), card = () => (Ending.cards().find(x => /Bob Harlow/.test(x.label)) || {});
    H.result = 'bust'; H.stage = 'done'; H.yachtSold = false; const a = card(); H.yachtSold = true; const b = card(); H.result = 'repaid'; const c = card();
    return { a: a.key + ': ' + (a.lines || [])[0], b: b.key + ': ' + (b.lines || [])[0], c: c.key + ': ' + (c.lines || []).join(' ') }; });
  ok(/^harlow_bust: .*auction/.test(y.a) && /^harlow_cold: .*already sold the yacht/.test(y.b) && /never got over selling the yacht/.test(y.c), 'yacht endings: ' + y.b + ' | ' + y.c);

  // D. the share price: no 70% crash (bust, then a year of quarters)
  s = await setup(false);
  await pickApply(/Market it ourselves/);
  const px = await pg.evaluate(() => { const p0 = window.__px0; let lo = 99; for (let i = 0; i < 6; i++) { Financials.runQuarter(); Board.evaluateQuarter(); Story.S().due = null; GameState._pendingDecision = null; lo = Math.min(lo, GameState.company.sharePrice); } return { p0, lo }; });
  ok(px.lo > px.p0 * 0.45, 'share price after the bust, worst quarter: $' + px.p0.toFixed(2) + ' → $' + px.lo.toFixed(2) + ' (' + Math.round((px.lo / px.p0 - 1) * 100) + '%), not a 70% crash');

  // E. the CFO's random private placement is retired
  const pp = await pg.evaluate(() => { const G = GameState; G.staff.push({ roleId: 'financial', title: 'CFO', name: 'X', salary: 0.3, skill: 7 }); G.ratios.debtToAssets = 0.58; G.meta.year = 6; return typeof Decisions !== 'undefined' && Decisions.checkPrivatePlacement ? Decisions.checkPrivatePlacement() : 'n/a'; });
  ok(pp == null || pp === 'n/a', 'the CFO’s random $100M placement no longer appears (' + pp + ')');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
