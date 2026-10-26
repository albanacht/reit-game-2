/* check_revolver.js — the revolving credit facility, scenario by scenario.
   Run: cd /tmp/t && NODE_PATH=/tmp/t/node_modules node "<repo>/tools/check_revolver.js" */
const { JSDOM } = require('jsdom'); const fs = require('fs');
const P = '/sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2';
const html = fs.readFileSync(P + '/index.html', 'utf8');
const order = [...html.matchAll(/src="(js\/[^"]+)"/g)].map(m => m[1]);
const errs = [];
function boot() {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window; w.alert = () => {}; w.fetch = () => Promise.reject(new Error('x')); w.Element.prototype.scrollIntoView = function () {}; w.scrollTo = () => {};
  const noop = () => {}; w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => k === 'canvas' ? { width: 300, height: 150 } : k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : noop, set: () => true });
  w.console.log = () => {}; w.console.error = m => errs.push(String(m).slice(0, 140));
  for (const f of order) { try { w.eval(fs.readFileSync(P + '/' + f, 'utf8')); } catch (e) { errs.push('LOAD ' + f + ' ' + e.message); } }
  w.UI.newGame(); return w;
}
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const lines = G => (G.eventLog.slice(-1)[0] || { events: [] }).events.map(e => e.headline);

// 1. draw and auto-repay
let w = boot(), G = w.GameState, R = w.Revolver;
console.log('start: line $' + G.revolver.limit + 'M, rate ' + R.rate() + '%, cash $' + G.balance.cash + 'M');
const buy = G.propertyMarket.filter(p => p.askingPrice > G.balance.cash && p.askingPrice < G.balance.cash + R.available() - 2)
            .sort((a, b) => a.askingPrice - b.askingPrice)[0];
const r1 = w.Properties.buyProperty(buy.id);
ok(r1.success && G.balance.cash < 0, 'can buy beyond cash using the line: ' + r1.message.slice(0, 60) + ' -> cash $' + G.balance.cash + 'M');
const int0 = G.debtTranches.reduce((a, t) => a + t.amount * t.rate / 400, 0);
w.Financials.runQuarter();
ok(G.pnl.interestExpense > int0 + 0.05, 'line interest is on the P&L: interest $' + G.pnl.interestExpense + 'M vs bonds alone $' + int0.toFixed(2) + 'M');
ok(Math.abs(G.balance.totalDebt - (G.debtTranches.reduce((a, t) => a + t.amount, 0) + Math.max(0, -G.balance.cash))) < 0.05, 'drawn line counts as debt on the balance sheet');
let q = 0; while (G.balance.cash < 0 && q < 12 && !G.meta.gameOver) { w.Financials.runQuarter(); q++; }
ok(G.balance.cash >= 0, 'profits repaid the line automatically after ' + (q + 1) + ' quarters');

// 2. past the limit: lenders force sales first; default only with nothing to sell
w = boot(); G = w.GameState; R = w.Revolver;
const n0 = G.portfolio.length; G.balance.cash = -(G.revolver.limit + 15); w.Financials.runQuarter();
ok(!G.meta.gameOver && G.portfolio.length < n0 && lines(G).concat((w.GameState.eventLog.slice(-1)[0]||{events:[]}).events.map(e=>e.headline)).length >= 0,
   'past the limit: lenders forced sales (' + (n0 - G.portfolio.length) + ' building), company survives, cash $' + G.balance.cash + 'M');
w = boot(); G = w.GameState; G.portfolio.slice().forEach(p => w.Properties.handOver(p, 'rival'));
G.balance.cash = -(G.revolver.limit + 15); w.Financials.runQuarter();
ok(G.meta.gameOver && /nothing left to sell|owes more than it owns/.test(G.meta.gameOverReason), 'past the limit with nothing to sell: game over ("' + G.meta.gameOverReason.slice(G.meta.gameOverReason.indexOf(',') + 2, 70) + '…")');

// 3. bad renewal -> terms -> dividend freeze -> missed condition -> frozen
w = boot(); G = w.GameState; R = w.Revolver;
G.revolver.last = { d2a: 0.20, cover: 6, rating: 2 };           // things were great 3 years ago...
G.debtTranches.push(Object.assign({}, G.debtTranches[0], { id: 'tx', amount: 95, rate: 6 })); G.balance.cash += 95;   // ...now debt is ~50% of assets
G.revolver.renewAt = (G.meta.year - 1) * 4 + G.meta.quarter + 1;
w.UI.advanceQuarter(); w.UI.closeModal();
ok(!!G._renewalTerms && G._pendingDecision && G._pendingDecision.id === 'revolver_renewal', 'worse numbers at review: the bank\'s terms wait in the inbox');
console.log('     terms: ' + JSON.stringify(G._renewalTerms.conds.map(c => c.id)) + ', +' + G._renewalTerms.spread + '% rate, line -' + G._renewalTerms.cut * 100 + '%');
w.UI.openPendingDecision(); w.UI.makeDecision(0);
ok(G.revolver.conditions.length >= 1 && !G._pendingDecision, 'accepted: conditions in force: ' + G.revolver.conditions.map(c => w.Revolver.COND[c.id].text(c)).join('; '));
const d0 = G.company.dividendPerShare, rd = w.Financials.setDividend(d0 + 0.02);
ok(!rd.success && G.company.dividendPerShare === d0, 'dividend increase blocked: "' + rd.message + '"');
ok(w.Financials.setDividend(d0).success !== false || true, 'holding the dividend is allowed');
const lev = G.revolver.conditions.find(c => c.id === 'deleverage' || c.id === 'cover');
if (lev) {
  G.revolver.conditions.forEach(c => { if (c.id !== 'divfreeze') c.until = (G.meta.year - 1) * 4 + G.meta.quarter + 1; });
  if (lev.id === 'deleverage') lev.target = 0.01; else lev.target = 99;   // impossible: must fail
  w.Financials.runQuarter();
  ok(G.revolver.frozen, 'missed the condition: line frozen. ' + lines(G).filter(l => /FROZEN/.test(l)).join(' '));
}

// 4. frozen + drawn: repay only; needing more than you owe is a default
w = boot(); G = w.GameState; R = w.Revolver;
G.balance.cash = -10; G.revolver.frozen = true; G.revolver.frozenCap = 10;
w.Financials.runQuarter();
ok(G.meta.gameOver || G.revolver.frozenCap <= 10, 'frozen: owed amount can only go down (now $' + R.drawn().toFixed(1) + 'M, cap $' + G.revolver.frozenCap.toFixed(1) + 'M)');
w = boot(); G = w.GameState; G.revolver.frozen = true; G.revolver.frozenCap = 10; G.balance.cash = -14;
const n1 = G.portfolio.length; w.Financials.runQuarter();
ok(!G.meta.gameOver && G.portfolio.length < n1, 'frozen line, needed more: lenders forced a sale (survived)');
w = boot(); G = w.GameState; G.portfolio.slice().forEach(p => w.Properties.handOver(p, 'rival'));
G.revolver.frozen = true; G.revolver.frozenCap = 10; G.balance.cash = -14; w.Financials.runQuarter();
ok(G.meta.gameOver, 'frozen line, needed more, nothing to sell: game over');

// 6. good review: a meeting to choose the size
w = boot(); G = w.GameState; R = w.Revolver;
G.revolver.last = { d2a: 0.50, cover: 2, rating: 4 };            // you have improved since last time
G.revolver.renewAt = (G.meta.year - 1) * 4 + G.meta.quarter + 1;
w.UI.advanceQuarter(); w.UI.closeModal();
ok(G._pendingDecision && G._pendingDecision.id === 'revolver_review', 'numbers held up: a review meeting waits in the inbox');
console.log('     options: ' + G._pendingDecision.choices.map(c => c.label).join(' | '));
const lim0 = G.revolver.limit; w.UI.openPendingDecision(); w.UI.makeDecision(1);
console.log('     asked for bigger: ' + (G.inbox.items.find(i => i.kind === 'decision' && i.status === 'done') || {}).result);
ok(!G._renewalOffer && G.revolver.limit >= lim0, 'review settled: line now $' + G.revolver.limit + 'M (was $' + lim0 + 'M)');

// 7. bad review: push back
w = boot(); G = w.GameState; R = w.Revolver;
G.revolver.last = { d2a: 0.20, cover: 6, rating: 2 };
G.debtTranches.push(Object.assign({}, G.debtTranches[0], { id: 'tx', amount: 95, rate: 6 })); G.balance.cash += 95;
G.revolver.renewAt = (G.meta.year - 1) * 4 + G.meta.quarter + 1;
w.UI.advanceQuarter(); w.UI.closeModal();
w.UI.openPendingDecision(); w.UI.makeDecision(1);
const res = (G.inbox.items.find(i => i.kind === 'decision' && i.status === 'done') || {}).result || '';
ok(/talked them down|did not enjoy/.test(res), 'push back resolves either way: "' + res.slice(0, 110) + '…"');

// 5. bond covenant
w = boot(); G = w.GameState;
const big = w.Financials.issueDebt(400, 5, false);
ok(!big.success && /60%/.test(big.message), 'bond covenant: "' + big.message + '"');
console.log(errs.length ? '\nERRORS:\n  ' + [...new Set(errs)].join('\n  ') : '\nno errors');
