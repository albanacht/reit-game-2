/* sim_war.js — the Rennick war over full runs, straight through the engine.
   A steady bot (sim_econ's) wins Morrow Plaza at the Year 3 meeting, answers
   every attack (political capital if it has it, else money), uses both
   weapons once a year, blocks his sales in the crisis, and moves the takeover
   when it opens. Prints when the crisis came, how cheap Rennick got, whether
   the takeover opened and closed, and how far Kessler got into us.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/sim_war.js" [runs] [fight|quiet] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const RUNS = +(process.argv[2] || 4), MODE = process.argv[3] || 'fight';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(R); await wait(300);
  for (let run = 0; run < RUNS; run++) {
    const res = await pg.evaluate(MODE => {
      localStorage.clear(); UI.newGame(); UI.closeModal();
      const G = GameState, log = [], W = War.W, tq = () => G.meta.totalQuarters;
      let minP = 9, maxD = 0, crisisQ = null, openQ = null, maxStake = 0, pcSpent = 0, blocked = 0;
      const answer = id => {
        const c = World.DECISIONS.find(x => x.id === id); if (!c) return;
        const card = c.build(); if (!card) return;
        const ok = card.choices.filter(ch => !ch.check || ch.check());
        const pick = (MODE === 'quiet' ? ok[ok.length - 1] : ok[0]) || card.choices[card.choices.length - 1];
        const pc0 = G.board.politicalCapital; pick.apply(); pcSpent += Math.max(0, pc0 - G.board.politicalCapital);
        log.push('Y' + G.meta.year + 'Q' + G.meta.quarter + ' ' + id + ': ' + pick.label.replace(/\s*\(.*/, ''));
      };
      const meeting = y => {
        const items = War.agenda(y, []);
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.effect) { log.push('Y' + y + ' meeting: ' + it.effect()); continue; }
          if (!it.choices) continue;
          const txt = JSON.stringify(it.lines);
          let ch;
          if (/^(Bid|Match)/.test(it.choices[0].label)) ch = it.choices[0];
          else if (/buy the whole company/.test(txt)) { ch = it.choices.find(c => /Half/.test(c.label) && !c.disabled) || it.choices.find(c => !c.disabled); openQ = openQ || tq(); }
          else if (/Stop the headlines/.test(txt)) ch = it.choices[MODE === 'quiet' ? 0 : 1];
          else if (/hit him back|banking friends/.test(txt)) ch = it.choices.find(c => !c.disabled && (MODE === 'quiet' ? /Okafor/.test(c.label) : /Chen/.test(c.label))) || it.choices[1];
          else if (/rights plan/.test(txt)) ch = it.choices.find(c => !c.disabled) ;
          else ch = it.choices[it.choices.length - 1];
          const pc0 = G.board.politicalCapital; const m = ch.go(); pcSpent += Math.max(0, pc0 - G.board.politicalCapital);
          log.push('Y' + y + ' meeting: ' + ch.label.replace(/\s*\(.*/, '') + ' → ' + String(m || '').slice(0, 80));
        }
      };
      for (let q = 0; q < 60 && !G.meta.gameOver; q++) {
        const d2a = G.ratios.debtToAssets || 0.3, h = G.history, last = h[h.length - 1];
        if (last) {
          const affo4 = h.slice(-4).reduce((a, e) => a + (e.affoPerShare || 0), 0) / Math.min(4, h.length);
          const want = Math.max(0.01, Math.round(affo4 * 0.8 * 100) / 100), cur = G.company.dividendPerShare;
          if (G.meta.quarter === 1) Financials.setDividend(want > cur * 1.08 ? Math.round(cur * 1.06 * 100) / 100 : want < cur * 0.95 ? want : cur);
        }
        if (d2a < 0.40 && G.meta.totalQuarters >= 1) {
          const mk = G.propertyMarket.filter(p => p.askingPrice > 5 && !p.underConstruction).sort((a, b) => (b.annualNOI * b.occupancy / b.askingPrice) - (a.annualNOI * a.occupancy / a.askingPrice))[0];
          if (mk) {
            const assets = G.balance.totalAssets || 200, debt = G.balance.totalDebt || 70, room = (0.45 * assets - debt) / 0.55;
            const need = mk.askingPrice * 1.02 - Math.max(0, G.balance.cash - 10);
            if (need < room && need > 0) Financials.issueDebt(Math.ceil(need), 7, false);
            if (G.balance.cash > mk.askingPrice * 1.02) Properties.buyProperty(mk.id);
          }
        }
        // the war, between meetings
        if (MODE === 'fight' && ['war', 'crisis'].indexOf(W().stage) > -1) {
          if (W().stage === 'crisis') W().blocking = true;
          ['leak', 'squeeze'].forEach(k => { if (War.canUse(k)) { const pc0 = G.board.politicalCapital; War.weapon(k); pcSpent += Math.max(0, pc0 - G.board.politicalCapital); } });
        }
        for (const t of (GameState.debtTranches || []).slice()) { const left = (t.maturityYear - 1) * 4 + t.maturityQuarter - ((GameState.meta.year - 1) * 4 + GameState.meta.quarter); const sp = window.Revolver && GameState.revolver ? Revolver.spendable() : GameState.balance.cash; if (left >= 0 && left <= 1 && sp < t.amount + 25) Financials.issueDebt(Math.ceil(t.amount), 5, false); }   // round 19: bots refinance maturing bonds
        Financials.runQuarter(); Board.evaluateQuarter();
        const s = Story.S();
        if (s.due) { if (/^war_/.test(s.due)) answer(s.due); s.due = null; }
        if (G.meta.quarter === 1 && G.meta.year > 1) { G.board.politicalCapital = Math.min(G.board.maxCapital || 8, (G.board.politicalCapital || 0) + 2); meeting(G.meta.year - 1); }   // a decent meeting: +2
        const r = G.rivals.ren;
        if (r && !r.gone && W().stage !== 'wait' && W().stage !== 'bid') { minP = Math.min(minP, Rivals.pnav('ren')); maxD = Math.max(maxD, Rivals.d2a('ren')); }
        if (W().stage === 'crisis' && !crisisQ) crisisQ = tq();
        maxStake = Math.max(maxStake, W().stake || 0);
      }
      blocked = W().blocked || 0;
      const r = G.rivals.ren;
      return { end: W().ending || W().stage, crisisQ, openQ, minP: minP.toFixed(2), maxD: maxD.toFixed(2), maxStake: maxStake.toFixed(1), pcSpent, blocked,
               our: (G.company.sharePrice / G.ratios.navPerShare).toFixed(2), d2a: (G.ratios.debtToAssets || 0).toFixed(2), n: G.portfolio.length, over: G.meta.gameOver ? G.meta.gameOverReason : '', log: log.slice(0, 26) };
    }, MODE);
    console.log('RUN ' + (run + 1) + ': ending ' + res.end + ' | crisis at q' + res.crisisQ + ' | takeover opened q' + res.openQ + ' | Rennick min P/NAV ' + res.minP + ', max debt ' + res.maxD + ' | blocked ' + res.blocked + ' | political capital spent ' + res.pcSpent + ' | Kessler max stake ' + res.maxStake + '% | us: P/NAV ' + res.our + ', debt ' + res.d2a + ', ' + res.n + ' buildings' + (res.over ? ' | OVER: ' + res.over : ''));
    res.log.forEach(l => console.log('   ' + l));
  }
  if (errs.length) console.log('ERRORS: ' + errs.slice(0, 5).join(' / '));
  await b.close();
})();
