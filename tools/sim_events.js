/* sim_events.js — what reaches the inbox over whole runs, played through the UI.
   Decisions are drawn at the end of a quarter and wait in the inbox (B.12d).
   Run: cd /tmp/t && NODE_PATH=/tmp/t/node_modules RUNS=10 node "<repo>/tools/sim_events.js" */
const { JSDOM } = require('jsdom'); const fs = require('fs');
const P = '/sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2';
const html = fs.readFileSync(P + '/index.html', 'utf8');
const order = [...html.matchAll(/src="(js\/[^"]+)"/g)].map(m => m[1]);
const RUNS = +(process.env.RUNS || 10);
let quarters = 0, decisions = 0, harm = 0, good = 0, neutral = 0, silent = 0, errs = [];
const byTitle = {}, byYear = {}, perYear = [];
for (let r = 0; r < RUNS; r++) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window; w.alert = () => {}; w.fetch = () => Promise.reject(new Error('x'));
  w.Element.prototype.scrollIntoView = function () {};
  const noop = () => {}; w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => k === 'canvas' ? { width: 300, height: 150 } : k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : noop, set: () => true });
  w.console.log = () => {}; w.console.error = m => errs.push(String(m).slice(0, 120));
  for (const f of order) { try { w.eval(fs.readFileSync(P + '/' + f, 'utf8')); } catch (e) { errs.push('LOAD ' + f + ': ' + e.message); } }
  try { w.UI.newGame(); } catch (e) { errs.push('newGame: ' + e.message); }
  const G = w.GameState, d = w.document;
  for (let press = 0; press < 130 && G.meta.totalQuarters < 60 && !G.meta.gameOver; press++) {
    try { w.UI.advanceQuarter(); } catch (e) { errs.push('advance: ' + e.message); break; }
    if (d.querySelector('.decision-choice:not(.decision-choice-disabled)')) { try { w.UI.makeDecision(0); } catch (e) { errs.push('decide: ' + e.message); } }
  }
  const items = (G.inbox || { items: [] }).items, yrs = {};
  items.forEach(i => {
    if (i.kind === 'decision') { decisions++; byTitle[i.title] = (byTitle[i.title] || 0) + 1;
      const y = Math.floor((i.turn - 1) / 4) + 1; byYear[y] = (byYear[y] || 0) + 1; yrs[y] = (yrs[y] || 0) + 1; }
    if (i.kind === 'event') { if (i.tone === 'bad') harm++; else if (i.tone === 'good') good++; else neutral++; }
  });
  perYear.push(Math.max(0, ...Object.values(yrs)));
  const byTurn = {}; items.forEach(i => { if (i.kind === 'event') byTurn[i.turn] = 1; });
  for (let t = 2; t <= G.meta.totalQuarters + 1; t++) if (!byTurn[t]) silent++;
  quarters += G.meta.totalQuarters;
}
console.log(`${RUNS} runs, ${quarters} quarters played through the UI`);
console.log(`events in the inbox : ${(harm / quarters).toFixed(2)} red + ${(good / quarters).toFixed(2)} green + ${(neutral / quarters).toFixed(2)} blue per quarter`);
console.log(`quiet quarters      : ${(silent / quarters * 100).toFixed(0)}% had no event`);
console.log(`decisions           : ${(decisions / RUNS).toFixed(1)} per run; most in any one year of a run: ${Math.max(...perYear)}`);
console.log('by year:', JSON.stringify(byYear));
console.log('\nwhich decisions:');
Object.entries(byTitle).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}  ${k}`));
console.log(errs.length ? '\nERRORS:\n  ' + [...new Set(errs)].slice(0, 8).join('\n  ') : '\nno errors');
