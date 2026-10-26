/* sim_capital.js — political capital, measured (round 12). Same bots as
   sim_econ.js; at each year end it runs the meeting's bookkeeping (demands
   judged, capital earned, next demands set) with no cap, and prints what a
   player earns a year.
   (based on sim_econ.js: the economics, measured (round 10). Plays full 15-year runs
   in real Chrome with simple bots, straight through the engine (no dialogs),
   and prints what the money does each year: rent, overheads, interest,
   retained cash, leverage, rating, price vs NAV, return vs the rivals.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/sim_econ.js" [bot] [runs]
   bots: passive | steady | grower                                             */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const BOT = process.argv[2] || 'steady', RUNS = +(process.argv[3] || 2);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(R); await wait(300);
  for (let run = 0; run < RUNS; run++) {
    const res = await pg.evaluate(bot => {
      localStorage.clear(); UI.newGame(); UI.closeModal();
      const G = GameState, rows = [], yr = {};
      const pnav = () => G.ratios.navPerShare > 0 ? G.company.sharePrice / G.ratios.navPerShare : 0;
      for (let q = 0; q < 60 && !G.meta.gameOver; q++) {
        // ---- the bot's turn
        const d2a = G.ratios.debtToAssets || 0.3, h = G.history, last = h[h.length - 1];
        if (bot !== 'passive' && last) {
          // dividend: pay ~80% of cash profit per share, smoothed, never above it
          const affo4 = h.slice(-4).reduce((a, e) => a + (e.affoPerShare || 0), 0) / Math.min(4, h.length);
          const want = Math.max(0.01, Math.round(affo4 * 0.8 * 100) / 100);
          const cur = G.company.dividendPerShare;
          if (G.meta.quarter === 1) Financials.setDividend(want > cur * 1.08 ? Math.round(cur * 1.06 * 100) / 100 : Math.min(cur, want) === want && want < cur * 0.95 ? want : cur);
        }
        if (bot === 'grower' || bot === 'steady') {
          const cap = bot === 'grower' ? 0.52 : 0.45;
          if (d2a < cap - 0.05 && G.meta.totalQuarters >= 1) {
            const mk = G.propertyMarket.filter(p => p.askingPrice > 5 && !p.underConstruction)
              .sort((a, b) => (b.annualNOI * b.occupancy / b.askingPrice) - (a.annualNOI * a.occupancy / a.askingPrice))[0];
            if (mk) {
              const assets = G.balance.totalAssets || 200, debt = G.balance.totalDebt || 70;
              const room = (cap * assets - debt) / (1 - cap);
              const need = mk.askingPrice * 1.02 - Math.max(0, G.balance.cash - 10);
              if (need < room && need > 0) Financials.issueDebt(Math.ceil(need), 7, false);
              if (G.balance.cash > mk.askingPrice * 1.02 || (window.Revolver && Revolver.spendable() > mk.askingPrice * 1.02 + 10)) Properties.buyProperty(mk.id);
            }
          }
        }
        // ---- the quarter
        for (const t of (GameState.debtTranches || []).slice()) { const left = (t.maturityYear - 1) * 4 + t.maturityQuarter - ((GameState.meta.year - 1) * 4 + GameState.meta.quarter); const sp = window.Revolver && GameState.revolver ? Revolver.spendable() : GameState.balance.cash; if (left >= 0 && left <= 1 && sp < t.amount + 25) Financials.issueDebt(Math.ceil(t.amount), 5, false); }   // round 19: bots refinance maturing bonds
        Financials.runQuarter(); Board.evaluateQuarter();
        if (G.meta.quarter === 1 && G.meta.totalQuarters > 1) {              // the meeting's bookkeeping, no cap
          G.board.maxCapital = 999; const pc0 = G.board.politicalCapital;
          const res = (G.board.activeMandates || []).length ? Board.evaluateMandates() : [];
          Board.earnPoliticalCapital();
          window.__pc = window.__pc || []; window.__pc.push({ y: G.meta.year - 1, earned: G.board.politicalCapital - pc0, met: res.filter(r => r.achieved).length, n: res.length });
          G.board.politicalCapital = 0;                                           // spend it all: we measure income
          Board.generateDemands({}); Board.resetYearTracking();
        }
        if (window.Story) { const s = Story.S(); if (s.due) s.due = null; }
        const p = G.pnl, y = G.meta.year;
        yr[y] = yr[y] || { noi: 0, ga: 0, int: 0, li: 0, capex: 0, unusual: 0, div: 0, rc: 0, n: 0 };
        const Y = yr[y]; Y.noi += p.noi; Y.ga += p.gAndA; Y.int += p.interestExpense; Y.capex += p.capexReserve || 0; Y.unusual += p.unusualItems || 0; Y.div += p.dividendsPaid; Y.rc += p.retainedCash; Y.n++; Y.li += p.loanInterest || 0;
        Y.d2a = G.ratios.debtToAssets; Y.rating = G.credit.rating; Y.price = G.company.sharePrice; Y.pnav = pnav(); Y.props = G.portfolio.length; Y.assets = G.balance.totalAssets;
        Y.rivalPnav = window.Rivals && Rivals.pnavAvg ? Rivals.pnavAvg() : 0; Y.y = window.Directors ? Directors.ytd() : null; Y.cyc = G.market.cycle; Y.rate = G.market.baseInterestRate;
      }
      const pcs = window.__pc || []; window.__pc = [];
      return { yr, pcs, over: G.meta.gameOver ? G.meta.gameOverReason : null };
    }, BOT);
    const tot = res.pcs.reduce((s, p) => s + p.earned, 0), met = res.pcs.reduce((s, p) => s + p.met, 0), n = res.pcs.reduce((s, p) => s + p.n, 0);
    console.log(BOT + ' run ' + (run + 1) + ': political capital earned ' + tot + ' over ' + res.pcs.length + ' years (' + (tot / Math.max(1, res.pcs.length)).toFixed(1) + ' a year); demands met ' + met + ' of ' + n + '. By year: ' + res.pcs.map(p => p.earned).join(' '));
  }
  if (errs.length) console.log('errors', JSON.stringify(errs.slice(0, 3)));
  await b.close();
})();
