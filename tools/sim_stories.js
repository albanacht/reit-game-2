/* sim_stories.js — every story over full 15-year runs, straight through the
   engine: a steady bot plays the meeting agendas (Story.agenda: Harlow, the
   war, the tower, the index) and the pay committee, answering each item with
   a choice picked at random among those it can afford, and answers every inbox
   story card the same way. Prints how each run ends and each story's outcome.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/sim_stories.js" [runs] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const RUNS = +(process.argv[2] || 4);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'warning' && /story|war|tower|index|ending/.test(m.text())) errs.push('warn: ' + m.text()); });
  await pg.goto(R); await wait(300);
  for (let run = 0; run < RUNS; run++) {
    const res = await pg.evaluate(() => {
      localStorage.clear(); UI.newGame(); UI.closeModal();
      const G = GameState, log = [], pick = a => a[Math.floor(Math.random() * a.length)];
      const play = items => { for (let i = 0; i < items.length && i < 40; i++) { const it = items[i];
        if (it.effect) { const m = it.effect(); if (m) log.push('Y' + G.meta.year + ' ' + String(m).slice(0, 70)); continue; }
        if (it.choices) { const ok = it.choices.filter(c => !c.disabled); const c = /^(Bid|Match)/.test(ok[0] && ok[0].label) ? ok[0] : pick(ok); if (c) { const m = c.go(); log.push('Y' + (G.meta.year - 1) + ' ' + c.label.slice(0, 50) + ' → ' + String(m || '').slice(0, 60)); } continue; }
        if (it.card) { Story.S().due = it.card; } } };
      const card = id => { const c = World.DECISIONS.find(x => x.id === id); if (!c) return; const k = c.build(); if (!k) return; const ok = k.choices.filter(ch => !ch.check || ch.check()); const ch = pick(ok.length ? ok : k.choices); const m = ch.apply(); log.push('Y' + G.meta.year + 'Q' + G.meta.quarter + ' ' + id + ': ' + ch.label.slice(0, 40)); };
      for (let q = 0; q < 60 && !G.meta.gameOver; q++) {
        const d2a = G.ratios.debtToAssets || 0.3, h = G.history;
        if (h.length) { const affo4 = h.slice(-4).reduce((a, e) => a + (e.affoPerShare || 0), 0) / Math.min(4, h.length); const want = Math.max(0.01, Math.round(affo4 * 0.8 * 100) / 100), cur = G.company.dividendPerShare;
          if (G.meta.quarter === 1) Financials.setDividend(want > cur * 1.08 ? Math.round(cur * 1.06 * 100) / 100 : want < cur * 0.95 ? want : cur); }
        if (d2a < 0.40 && G.meta.totalQuarters >= 1) { const mk = G.propertyMarket.filter(p => p.askingPrice > 5 && !p.underConstruction).sort((a, b) => (b.annualNOI * b.occupancy / b.askingPrice) - (a.annualNOI * a.occupancy / a.askingPrice))[0];
          if (mk) { const assets = G.balance.totalAssets || 200, debt = G.balance.totalDebt || 70, room = (0.45 * assets - debt) / 0.55, need = mk.askingPrice * 1.02 - Math.max(0, G.balance.cash - 10);
            if (need < room && need > 0) Financials.issueDebt(Math.ceil(need), 7, false); if (G.balance.cash > mk.askingPrice * 1.02) Properties.buyProperty(mk.id); } }
        for (const t of (GameState.debtTranches || []).slice()) { const left = (t.maturityYear - 1) * 4 + t.maturityQuarter - ((GameState.meta.year - 1) * 4 + GameState.meta.quarter); const sp = window.Revolver && GameState.revolver ? Revolver.spendable() : GameState.balance.cash; if (left >= 0 && left <= 1 && sp < t.amount + 25) { const rr = Financials.issueDebt(Math.ceil(t.amount), 5, false); if (!rr.success) log.push('Y' + G.meta.year + 'Q' + G.meta.quarter + ' REFI FAIL ' + rr.message); } }   // round 19: bots refinance maturing bonds
        Financials.runQuarter(); Board.evaluateQuarter();
        for (let k = 0; k < 3; k++) { const s = Story.S(); if (!s.due) break; const id = s.due; card(id); if (s.due === id) s.due = null; }
        if (G.meta.quarter === 1 && G.meta.year > 1) {
          const y = G.meta.year - 1; G.board.politicalCapital = Math.min(8, (G.board.politicalCapital || 0) + 2);
          play(Story.agenda(y)); play(Pay.meeting(y));
        }
      }
      const t = Tower.T(), w = War.W(), x = IndexFund.X(), hh = Story.H();
      let ending = '';
      try { ending = Ending.kind() + ' | ' + Ending.cards().map(c => c.label).join(', '); } catch (e) { ending = 'ERR ' + e.message; }
      return { over: G.meta.gameOverReason.slice(0, 80), q: G.meta.totalQuarters, harlow: hh.result || hh.stage, war: w.ending || w.stage, tower: (t.stage + '/' + (t.road || '-') + '/' + (t.fin || '-') + ' cost ' + (t.cost || 0).toFixed(0)), index: x.stage + (x.dropped ? ' (dropped ' + x.dropped + ')' : '') + ' sop ' + JSON.stringify((x.sop || []).map(s => s.p)),
               chair: Directors.chair() + (G.board.chair ? ' (' + G.board.chair + ')' : ''), dirs: G.board.directors.map(d => d.id).join(','), wealth: Pay.wealth().total, cut: Pay.L().cut || 1, ending, log: log.filter(l => /REFI|Sebastian|tower|Celestial|chair|Chair|Williams|Granite|index|pay|Dahl|Fjordhavn|lot|Calder/i.test(l)).slice(0, 24) };
    });
    console.log('RUN ' + (run + 1) + ' (' + res.q + 'q): ' + res.over);
    console.log('   harlow ' + res.harlow + ' | war ' + res.war + ' | tower ' + res.tower + ' | index ' + res.index + ' | chair ' + res.chair + ' | board ' + res.dirs + ' | wealth $' + res.wealth + 'M cut ' + res.cut);
    console.log('   ending: ' + res.ending);
    res.log.forEach(l => console.log('     ' + l));
  }
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 6).join(' / ') : 'no errors');
  await b.close();
})();
