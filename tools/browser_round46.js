/* browser_round46.js — round 46, Boss Alex's Year 4 bankruptcy:
   1. spendable money with the credit line in use is the unused line, not cash + line
      (it counted a draw twice);
   2. a bond the line can repay is repaid, not defaulted;
   3. the bond panel only offers a refinance the covenant allows, and greys out what can't work;
   4. rivals' moves are labelled as rival news.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round46.js" [outdir] */
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
  const fresh = async () => { await pg.evaluate(() => { localStorage.clear(); UI.newGame(); UI.closeModal(); }); await wait(500);
    await pg.evaluate(() => { Story.S().due = null; GameState._pendingDecision = null; }); };
  await pg.goto(R); await wait(300); await fresh();

  // 1. spendable with the line in use
  const s1 = await pg.evaluate(() => { const G = GameState; G.revolver.limit = 21; G.revolver.frozen = false; G.balance.cash = -17; return { sp: Revolver.spendable(), av: Revolver.available() }; });
  ok(Math.abs(s1.sp - 4) < 0.01 && Math.abs(s1.av - 4) < 0.01, '$17M drawn on a $21M line: $' + s1.sp + 'M left to spend (was −$13M)');

  // 2. a bond the line can repay is repaid
  const s2 = await pg.evaluate(() => { const G = GameState; G.revolver.limit = 30; G.balance.cash = -5;
    const t = G.debtTranches[0]; t.amount = 10; t.maturityYear = G.meta.year + (G.meta.quarter === 4 ? 1 : 0); t.maturityQuarter = G.meta.quarter === 4 ? 1 : G.meta.quarter + 1;
    G.debtTranches.slice(1).forEach(x => { x.maturityYear += 12; }); Financials.runQuarter(); return { over: G.meta.gameOver, why: G.meta.gameOverReason, left: G.debtTranches.some(x => x.id === t.id) }; });
  ok(!s2.over && !s2.left, 'a $10M bond with $5M drawn on a $30M line: repaid from the line, no default' + (s2.over ? ' — ' + s2.why : ''));

  // 3. the bond panel: refinance capped at the covenant room, greyed when there is none
  await fresh();
  const s3 = await pg.evaluate(async () => { const G = GameState; G.revolver.limit = 10; G.balance.cash = -9;
    const t = G.debtTranches[0]; t.amount = 35; t.maturityYear = G.meta.year + (G.meta.quarter === 4 ? 1 : 0); t.maturityQuarter = G.meta.quarter === 4 ? 1 : G.meta.quarter + 1;
    G.debtTranches.slice(1).forEach(x => { x.maturityYear += 12; });
    const read = () => { const o = document.getElementById('modal-overlay'); return [...o.querySelectorAll('#modal-actions button')].map(x => ({ t: x.textContent, off: x.disabled })); };
    // a: plenty of covenant room: the full shortfall
    document.getElementById('btn-advance-quarter').click(); await new Promise(r => setTimeout(r, 300)); const a = read(); UI.closeModal();
    // b: almost no room: what the covenant allows, and says so
    const room = Financials.debtRoom; Financials.debtRoom = () => Object.assign(room(), { secured: 12, unsecured: 0 });
    document.getElementById('btn-advance-quarter').click(); await new Promise(r => setTimeout(r, 300)); const bb = read(); UI.closeModal();
    // c: none: greyed, with the reason
    Financials.debtRoom = () => Object.assign(room(), { secured: 0, unsecured: 0 });
    document.getElementById('btn-advance-quarter').click(); await new Promise(r => setTimeout(r, 300)); const c = read(); UI.closeModal(); Financials.debtRoom = room;
    return { a, b: bb, c }; });
  const ra = s3.a.find(x => /Refinance/.test(x.t)), rb = s3.b.find(x => /Refinance/.test(x.t)), rc = s3.c.find(x => /Refinance/.test(x.t));
  ok(ra && !ra.off && /\$34\.0M/.test(ra.t), 'room to spare: "' + (ra || {}).t + '"');
  ok(rb && !rb.off && /\$12\.0M/.test(rb.t) && /still short/.test(rb.t), 'little room: "' + (rb || {}).t + '"');
  ok(rc && rc.off && /covenant allows no more/.test(rc.t), 'no room: greyed, "' + (rc || {}).t + '"');
  const un = s3.c.find(x => /Unsecured/.test(x.t));
  ok(un && un.off && /needs a CFO/.test(un.t), 'no CFO: unsecured notes greyed, "' + (un || {}).t + '"');

  // 4. rival news is labelled
  await fresh();
  const s4 = await pg.evaluate(() => { const G = GameState, out = []; for (let i = 0; i < 8; i++) { const r = Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null; (r.firedEvents || []).filter(e => e.isRival).forEach(e => out.push(e.headline)); } return out; });
  ok(s4.length === 0 || s4.every(h => /^◆ Rival news: /.test(h)), 'rivals: ' + (s4[0] || '(no rival moves in 8 quarters)'));
  // 5. Rennick never sells a building before the war squeezes him; in the war's crisis stage he does
  const s5 = await pg.evaluate(() => { const run = stage => { localStorage.clear(); UI.newGame(); UI.closeModal(); const G = GameState, A = G.arc; A.warnStart = 1; A.crisisStart = 2; A.crisisEnd = 30; A.afterStart = 999; A.afterEnd = 999;
      if (stage) War.debug({ stage }); let n = 0;
      for (let i = 0; i < 16; i++) { G.rivals.ren.debt *= 1.05; const q = Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null; if (stage) War.W().stage = stage;
        n += (q.firedEvents || []).filter(e => e.isRival && /Rennick (sold|put)/.test(e.headline)).length; if (G.meta.gameOver) break; }
      return n; }; return { before: run(null), war: run('crisis') }; });
  ok(s5.before === 0 && s5.war > 0, 'Rennick under heavy debt in a crisis: ' + s5.before + ' sales before the war, ' + s5.war + ' once the war squeezes him');
  // 6. "the trap": bank conditions are lifted when met; Williams does not punish a rise you may not make
  await fresh();
  const s6 = await pg.evaluate(() => { const G = GameState, r = G.revolver; G.meta.totalQuarters = 12; G.meta.year = 4; const t = G.totalQuartersElapsed();
    const set = () => { r.conditions = [{ id: 'deleverage', target: 0.51, until: t + 6 }, { id: 'divfreeze', until: t + 6 }]; };
    set(); G.ratios.debtToAssets = 0.55; const held = Revolver.dividendFrozen(), n1 = r.conditions.length;
    G.meta.totalQuarters = 12; G.meta.year = 4; { const A = G.arc, q = G.totalQuartersElapsed(); A.warnStart = q + 20; A.crisisStart = q + 24; A.crisisEnd = q + 30; A.afterStart = 999; A.afterEnd = 999; }
    for (let i = 0; i < 6; i++) G.history.push(Object.assign({}, G.history[G.history.length - 1] || {}, { dividendPerShare: G.company.dividendPerShare })); const sg = Situation.get; Situation.get = () => ({ state: 'stable' }); Directors.refresh(); const w1 = Directors.card('williams').cause;
    const row = Directors.scorecard().find(x => x.id === 'williams' && /Dividend growth/.test(x.k)); Situation.get = sg;
    G.ratios.debtToAssets = 0.48; const free = Revolver.dividendFrozen(), n2 = r.conditions.length, up = Financials.setDividend(G.company.dividendPerShare * 1.05).success;
    const T = (() => { G._renewalTerms = null; const A = G.arc, q = G.totalQuartersElapsed(); A.warnStart = q - 2; A.crisisStart = q - 1; A.crisisEnd = q + 8; r.renewAt = q; r.last = { d2a: 0.48, cover: 9, rating: 3 }; G.credit.rating = 'BBB'; Revolver.processQuarter(); return G._renewalTerms; })();
    return { held, n1, w1, want: row && row.want, okRow: row && row.ok, free, n2, up, crisisOnly: T ? T.conds.map(c => c.id).join(',') : 'no terms' }; });
  ok(s6.held && s6.n1 === 2 && !/no dividend rise/.test(s6.w1) && /forbids a rise/.test(s6.want || '') && s6.okRow === true, 'debt 55% (bank wants 51%): frozen, and Williams: "' + s6.w1 + '" / scorecard "' + s6.want + '"');
  ok(!s6.free && s6.n2 === 0 && s6.up, 'debt cut to 48%: the bank lifts both conditions at once, and the dividend can rise');
  ok(!/divfreeze/.test(s6.crisisOnly), 'a renewal in a crisis with sound numbers: no dividend freeze (conditions: ' + (s6.crisisOnly || 'none') + ')');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
