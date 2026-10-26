/* sim_price.js — share price and survival under three player styles.
   Run: cd /tmp/t && NODE_PATH=/tmp/t/node_modules RUNS=8 node "<repo>/tools/sim_price.js" */
const { JSDOM } = require('jsdom'); const fs = require('fs');
const P = process.env.P || '/sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2';
const html = fs.readFileSync(P + '/index.html', 'utf8');
const order = [...html.matchAll(/src="(js\/[^"]+)"/g)].map(m => m[1]);
function boot() {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window; w.alert = () => {}; w.fetch = () => Promise.reject(new Error('x')); w.Element.prototype.scrollIntoView = function () {};
  const noop = () => {}; w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => k === 'canvas' ? { width: 300, height: 150 } : k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : noop, set: () => true });
  w.console.log = () => {};
  for (const f of order) w.eval(fs.readFileSync(P + '/' + f, 'utf8'));
  w.UI.newGame(); return w;
}
const STY = {
  passive: (w, q) => {},
  grower: (w, q) => { const G = w.GameState, R = G.ratios;
    if ((R.debtToAssets || 0) < 0.42 && G.balance.cash < 40) { try { w.Financials.issueDebt(25, 7, false); } catch (e) {} }
    const aff = (G.propertyMarket || []).filter(p => p.askingPrice * 1.02 < G.balance.cash - 10).sort((a, b) => (b.annualNOI / b.askingPrice) - (a.annualNOI / a.askingPrice));
    if (aff.length) { try { w.Properties.buyProperty(aff[0].id); } catch (e) {} }
    if (q % 4 === 3 && (R.dividendCoverage || 0) > 1.15) w.Financials.setDividend(+(G.company.dividendPerShare * 1.05).toFixed(3)); },
  pump: (w, q) => { const G = w.GameState;
    if (G.balance.cash < 20) { try { w.Financials.issueDebt(20, 5, false); } catch (e) {} }
    if (q % 4 === 3) w.Financials.setDividend(+(G.company.dividendPerShare * 1.20).toFixed(3)); },
};
const N = +(process.env.RUNS || 6);
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
for (const [name, fn] of Object.entries(STY)) {
  const K = [4, 12, 20, 40, 'end']; const at = {}, pn = {}; K.forEach(k => { at[k] = []; pn[k] = []; });
  let died = 0, p0 = [], ga = [];
  for (let r = 0; r < N; r++) { const w = boot(), G = w.GameState; p0.push(G.company.sharePrice); let dead = false;
    for (let q = 0; q < 60; q++) { fn(w, q); try { w.Financials.runQuarter(); } catch (e) { break; }
      if (q === 0) { const h = G.history.slice(-1)[0]; ga.push(h.gAndA * 4 / G.balance.totalAssets * 100); }
      if (at[q + 1]) { at[q + 1].push(G.company.sharePrice); pn[q + 1].push(G.company.sharePrice / (G.ratios.navPerShare || 1)); }
      if (G.meta.gameOver) { if (!G.meta.runComplete) { died++; dead = true; } break; } }
    if (!dead) { at.end.push(G.company.sharePrice); pn.end.push(G.company.sharePrice / (G.ratios.navPerShare || 1)); } }
  console.log(`${name.padEnd(8)} G&A ${avg(ga).toFixed(1)}% of assets | open $${avg(p0).toFixed(2)} | ` +
    K.map(k => `${k === 'end' ? 'Y15' : 'Q' + k}: $${avg(at[k]).toFixed(2)} (${(avg(pn[k]) * 100).toFixed(0)}% NAV)`).join(' | ') +
    ` | bust ${died}/${N}`);
}
