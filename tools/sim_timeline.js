/* sim_timeline.js — WHEN things happen. Full 15-year runs with the sim_stories
   bot (random choices at every meeting and card); records each quarter the arc
   phase, every story's stage changes, each inbox decision card, each meeting
   agenda item and each letter. Writes JSON for the event-density chart.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/sim_timeline.js" [runs] [out.json] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const RUNS = +(process.argv[2] || 10), OUTF = process.argv[3] || '/tmp/o/timeline.json';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(R); await wait(300);
  const all = [];
  for (let run = 0; run < RUNS; run++) {
    const res = await pg.evaluate(() => {
      localStorage.clear(); UI.newGame(); UI.closeModal();
      const G = GameState, ev = [], pick = a => a[Math.floor(Math.random() * a.length)];
      const Q = () => (G.meta.year - 1) * 4 + G.meta.quarter;
      const push = (kind, sys, what) => ev.push({ q: Q(), kind, sys, what: String(what || '').replace(/<[^>]+>/g, '').slice(0, 90) });
      const snap = () => { const o = {}; const t = (k, f) => { try { const v = f(); if (v != null) o[k] = String(v); } catch (e) {} };
        t('harlow', () => Story.H().stage); t('war', () => War.W().stage); t('tower', () => Tower.T().stage); t('index', () => IndexFund.X().stage);
        t('levi', () => Levi.L().stage); t('gary', () => Gary.S().stage); t('yard', () => Gary.Y().stage); t('port', () => Port.P().stage);
        t('chair', () => Directors.chair()); t('board', () => G.board.directors.map(d => d.id).sort().join(','));
        t('tex', () => (Story.S().tex || {}).stage); t('mayor', () => Mayor.M().stage + (Mayor.M().choice ? ':' + Mayor.M().choice : '') + (Mayor.M().invDone ? ':inquiry' : '')); t('pr', () => (PR.P() || {}).stage);
        return o; };
      let prev = snap();
      const diff = () => { const now = snap(); Object.keys(now).forEach(k => { if (now[k] !== prev[k]) push('stage', k, (prev[k] || '-') + ' → ' + now[k]); }); prev = now; };
      let inboxN = (G.inbox && G.inbox.items || []).length;
      const letters = () => { const it = (G.inbox && G.inbox.items) || []; const nw = it.length - inboxN; if (nw > 0) it.slice(-nw).forEach(m => { if (m.kind === 'message' || m.from) push('letter', m.from || '?', m.title); }); inboxN = it.length; };
      const play = items => { for (let i = 0; i < items.length && i < 40; i++) { const it = items[i];
        const tag = it.guest ? it.guest.name : (it.lines && it.lines[0] ? it.lines[0][0] + ': ' + it.lines[0][1] : (it.card || it.note || 'item'));
        push('agenda', it.guest ? 'guest' : 'item', tag);
        if (it.effect) { it.effect(); continue; }
        if (it.choices) { const ok = it.choices.filter(c => !c.disabled); const c = /^(Bid|Match)/.test(ok[0] && ok[0].label) ? ok[0] : pick(ok); if (c) c.go(); continue; }
        if (it.card) { Story.S().due = it.card; } } };
      const card = id => { const c = World.DECISIONS.find(x => x.id === id); if (!c) return; const k = c.build(); if (!k) return; push('card', id, k.title); const ok = k.choices.filter(ch => !ch.check || ch.check()); const ch = pick(ok.length ? ok : k.choices); ch.apply(); };
      for (let q = 0; q < 60 && !G.meta.gameOver; q++) {
        const d2a = G.ratios.debtToAssets || 0.3, h = G.history;
        if (h.length) { const affo4 = h.slice(-4).reduce((a, e) => a + (e.affoPerShare || 0), 0) / Math.min(4, h.length); const want = Math.max(0.01, Math.round(affo4 * 0.8 * 100) / 100), cur = G.company.dividendPerShare;
          if (G.meta.quarter === 1) Financials.setDividend(want > cur * 1.08 ? Math.round(cur * 1.06 * 100) / 100 : want < cur * 0.95 ? want : cur); }
        if (d2a < 0.40 && G.meta.totalQuarters >= 1) { const mk = G.propertyMarket.filter(p => p.askingPrice > 5 && !p.underConstruction).sort((a, b) => (b.annualNOI * b.occupancy / b.askingPrice) - (a.annualNOI * a.occupancy / a.askingPrice))[0];
          if (mk) { const assets = G.balance.totalAssets || 200, debt = G.balance.totalDebt || 70, room = (0.45 * assets - debt) / 0.55, need = mk.askingPrice * 1.02 - Math.max(0, G.balance.cash - 10);
            if (need < room && need > 0) Financials.issueDebt(Math.ceil(need), 7, false); if (G.balance.cash > mk.askingPrice * 1.02) Properties.buyProperty(mk.id); } }
        for (const t of (GameState.debtTranches || []).slice()) { const left = (t.maturityYear - 1) * 4 + t.maturityQuarter - ((GameState.meta.year - 1) * 4 + GameState.meta.quarter); const sp = window.Revolver && GameState.revolver ? Revolver.spendable() : GameState.balance.cash; if (left >= 0 && left <= 1 && sp < t.amount + 25) { const rr = Financials.issueDebt(Math.ceil(t.amount), 5, false); if (!rr.success) { push('bot', 'refi', 'refinance failed: the sim hands the bot the cash, so the run reaches Year 15'); G.balance.cash += t.amount + 5; } } }   // round 19: bots refinance maturing bonds
        for (const t of (G.debtTranches || [])) { const left = (t.maturityYear - 1) * 4 + t.maturityQuarter - Q(); if (left >= 0 && left <= 1 && G.balance.cash < t.amount + 3) { push('bot', 'refi', 'bond due without the cash: the sim tops up'); G.balance.cash += t.amount + 3; } }
        Financials.runQuarter(); Board.evaluateQuarter(); letters(); diff();
        if (G._pendingDecision) { push('card', 'random', G._pendingDecision.title || G._pendingDecision.id || 'decision'); G._pendingDecision = null; }
        for (let k = 0; k < 3; k++) { const s = Story.S(); if (!s.due) break; const id = s.due; card(id); if (s.due === id) s.due = null; }
        diff(); letters();
        if (G.meta.quarter === 1 && G.meta.year > 1) {
          const y = G.meta.year - 1; G.board.politicalCapital = Math.min(8, (G.board.politicalCapital || 0) + 2);
          push('meeting', 'board', 'Year ' + y + ' meeting');
          play(Story.agenda(y)); play(Pay.meeting(y)); diff(); letters();
        }
      }
      return { arc: Object.assign({}, G.arc), q: G.meta.totalQuarters, over: G.meta.gameOverReason || '', ev };
    });
    all.push(res);
    console.log('RUN ' + (run + 1) + ' ' + res.q + 'q ' + res.over.slice(0, 60) + ' | events ' + res.ev.length + ' | crisis q' + res.arc.crisisStart + '-' + res.arc.crisisEnd);
  }
  fs.writeFileSync(OUTF, JSON.stringify(all));
  console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 6).join(' / ') : 'no errors');
  await b.close();
})();
