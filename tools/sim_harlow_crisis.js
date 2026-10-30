/* sim_harlow_crisis.js — how hard does the crisis hit a reasonable player who
   takes Bob Harlow's deals (buys the distribution centre, lends him money)?
   Steady bot: dividend 80% of cash profit, buys while debt < 40%, refinances
   bonds 1 quarter ahead (as the bond stop lets a player), no cash top-ups.
   Prints per year: share price, debt/assets, rating, payout, retained cash,
   and how each run ended.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/sim_harlow_crisis.js" [runs] [harlow=1|0] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const RUNS = +(process.argv[2] || 3), HARLOW = (process.argv[3] || '1') === '1', RESCUE = process.argv[4] || 'makes a call';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(R); await wait(300);
  for (let run = 0; run < RUNS; run++) {
    const res = await pg.evaluate((HARLOW, RESCUE) => {
      localStorage.clear(); UI.newGame(); UI.closeModal();
      const G = GameState, rows = [], pick = a => a[0];
      const card = id => { const c = World.DECISIONS.find(x => x.id === id); if (!c) return; const k = c.build(); if (!k) return;
        const ok = k.choices.filter(ch => !ch.check || ch.check());
        let ch = ok[ok.length - 1] || k.choices[k.choices.length - 1];                               // default: the cautious last choice
        if (id === 'story_harlow_offer') ch = HARLOW ? (ok.find(x => /^Buy it for/.test(x.label) && !/preferred/.test(x.label)) || ok.find(x => /Half bonds|Borrow it/.test(x.label)) || ok.find(x => /^Buy/.test(x.label)) || ch) : (ok.find(x => /Pass|No/.test(x.label)) || ch);
        if (id === 'story_harlow_loan') ch = HARLOW ? (ok.find(x => /^Lend/.test(x.label) && !/preferred/.test(x.label)) || ok.find(x => /Half bonds|Borrow it/.test(x.label)) || ok.find(x => /^Lend/.test(x.label)) || ch) : (ok.find(x => /Refuse|No/.test(x.label)) || ch);
        if (id === 'story_harlow_after') ch = ok.find(x => new RegExp(RESCUE).test(x.label)) || ch;
        if (id === 'levi_offer') ch = ok[0]; if (id === 'levi_belt') ch = ok[0];
        ch.apply(); };
      const play = items => items.forEach(it => { if (it.effect) { it.effect(); return; } if (it.choices) { const ok = it.choices.filter(c => !c.disabled);
        const c = (it.card === 'story_harlow_offer' && HARLOW) ? ok[0] : ok.find(x => /Pass|No|Decline|Refuse|Hold|Not now|Keep/.test(x.label)) || ok[0]; if (c) c.go(); }
        if (it.card) Story.S().due = it.card; });
      let minPx = 99, minQ = '';
      for (let q = 0; q < 60 && !G.meta.gameOver; q++) {
        const h = G.history;
        if (h.length && G.meta.quarter === 1) { const affo4 = h.slice(-4).reduce((a, e) => a + (e.affoPerShare || 0), 0) / Math.min(4, h.length);
          const want = Math.max(0.01, Math.round(affo4 * 0.8 * 100) / 100), cur = G.company.dividendPerShare;
          // round 37: in a crisis, a player halves the dividend the approved way; otherwise trims gently
          if (want < cur * 0.9 && Financials.canEmergencyCut && Financials.canEmergencyCut().ok) Financials.emergencyCut(); else if (want >= cur * 0.95 || !Financials.canEmergencyCut || !Financials.canEmergencyCut().show) Financials.setDividend(want); }
        const d2a = G.ratios.debtToAssets || 0.3;
        if (d2a < 0.40 && q >= 1) { const mk = G.propertyMarket.filter(p => p.askingPrice > 5 && p.listedByOwner).sort((a, b) => Properties.stabRent(b) / b.askingPrice - Properties.stabRent(a) / a.askingPrice)[0];
          if (mk && Properties.stabRent(mk) / mk.askingPrice * 100 > Market.getCurrentBorrowingRate() + 0.5) { const need = mk.askingPrice * 1.02 - Math.max(0, G.balance.cash - 10), room = (0.45 * G.balance.totalAssets - G.balance.totalDebt) / 0.55;
            if (need < room && need > 0) Financials.issueDebt(Math.ceil(need), 7, false); if (G.balance.cash > mk.askingPrice * 1.02) Properties.buyProperty(mk.id); } }
        for (const t of (G.debtTranches || []).slice()) { const left = G.quartersUntilMaturity(t.maturityYear, t.maturityQuarter); const sp = Revolver.spendable();
          if (left <= 1 && sp < t.amount) Financials.issueDebt(Math.ceil(t.amount - Math.max(0, sp) + 1), 5, false); }
        Financials.runQuarter(); Board.evaluateQuarter();
        for (let k = 0; k < 3; k++) { const s = Story.S(); if (!s.due) break; const id = s.due; card(id); if (s.due === id) s.due = null; }
        if (G._pendingDecision) { const k = G._pendingDecision; const ok = (k.choices || []).filter(c => !c.check || c.check()); try { (ok[ok.length - 1] || k.choices[0]).apply && (ok[ok.length - 1] || k.choices[0]).apply(); } catch (e) {} G._pendingDecision = null; }
        if (G.meta.quarter === 1 && G.meta.year > 1) { G.board.politicalCapital = Math.min(8, (G.board.politicalCapital || 0) + 1); play(Story.agenda(G.meta.year - 1)); play(Pay.meeting(G.meta.year - 1)); }
        if (G.company.sharePrice < minPx) { minPx = G.company.sharePrice; minQ = 'Y' + G.meta.year + 'Q' + G.meta.quarter; }
        if (G.meta.quarter === 4 || G.meta.gameOver) rows.push('Y' + G.meta.year + ' ' + Arc.phase().slice(0, 4) + ' px ' + G.company.sharePrice.toFixed(2) + ' d2a ' + Math.round((G.ratios.debtToAssets || 0) * 100) + '% ' + G.credit.rating +
          ' payout ' + Math.round((Financials.payoutRatio ? Financials.payoutRatio() || 0 : 0) * 100) + '% ret ' + (G.pnl.retainedCash || 0).toFixed(1) + ' harlow ' + (Story.H().result || Story.H().stage));
      }
      return { over: G.meta.gameOverReason.slice(0, 90), q: G.meta.totalQuarters, minPx, minQ, crisis: 'q' + G.arc.crisisStart + '-' + G.arc.crisisEnd + ' ' + G.arc.variant, rows };
    }, HARLOW, RESCUE);
    console.log('RUN ' + (run + 1) + ' (' + res.q + 'q, crisis ' + res.crisis + '): ' + res.over + ' | lowest price $' + res.minPx.toFixed(2) + ' at ' + res.minQ);
    res.rows.forEach(r => console.log('   ' + r));
  }
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 4).join(' / ') : 'no errors');
  await b.close();
})();
