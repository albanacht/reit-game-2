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
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
