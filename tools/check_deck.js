/* check_deck.js — every decision card, every choice, forced in a mid-game
   state, then four more quarters. Catches crashes and NaN, and prints what
   each choice says so the text can be read in one place.
   Run: cd /tmp/t && NODE_PATH=/tmp/t/node_modules node "<repo>/tools/check_deck.js" [cardId] */
const { JSDOM } = require('jsdom'); const fs = require('fs');
const P = '/sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2';
const html = fs.readFileSync(P + '/index.html', 'utf8');
const order = [...html.matchAll(/src="(js\/[^"]+)"/g)].map(m => m[1]);
const only = process.argv[2];
function boot() {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window; w.alert = () => {}; w.fetch = () => Promise.reject(new Error('x'));
  w.Element.prototype.scrollIntoView = function () {};
  const noop = () => {}; w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => k === 'canvas' ? { width: 300, height: 150 } : k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : noop, set: () => true });
  w.console.log = () => {};
  for (const f of order) w.eval(fs.readFileSync(P + '/' + f, 'utf8'));
  w.UI.newGame(); return w;
}
function midGame(w) {
  const G = w.GameState;
  for (let i = 0; i < 10; i++) w.Financials.runQuarter();
  G.balance.cash = 120;
  ['cfo', 'acquisitions'].forEach(r => { if (!w.Staff.hasRole(r)) { const c = w.Staff.generateCandidate(r, []); c.skill = 8; c.quartersEmployed = 4; G.staff.push(c); } });
  return G;
}
const bad = v => typeof v !== 'number' || !isFinite(v);
let fails = 0, runs = 0;
const probe = boot().World.DECISIONS;
for (const d of probe) {
  if (only && d.id !== only) continue;
  let n = 1;
  for (let i = 0; i < n; i++) {
    const w = boot(), G = midGame(w);
    const card = w.World.DECISIONS.find(x => x.id === d.id);
    if (card.when && !card.when()) { if (i === 0) console.log(`---- ${d.id}: not eligible in this state (its rule held it back)`); break; }
    let built;
    try { built = card.build(); } catch (e) { console.log(`FAIL ${d.id}: build() threw ${e.message}`); fails++; break; }
    if (!built) { console.log(`---- ${d.id}: build() returned nothing in this state`); break; }
    n = built.choices.length;
    if (i === 0) console.log(`\n== ${d.id} | ${built.title}${built.from ? ' | from ' + built.from : ''}`);
    const ch = built.choices[i];
    const gated = typeof ch.check === 'function' && !ch.check();
    let msg;
    try { const r = w.World.applyChoice(built, i); msg = r.success ? r.message : 'NOT APPLIED: ' + r.message; if (!r.success) fails++; }
    catch (e) { msg = 'THREW ' + e.message; fails++; }
    let after = '';
    try { for (let q = 0; q < 4 && !G.meta.gameOver; q++) w.Financials.runQuarter(); }
    catch (e) { after = ' | LATER QUARTER THREW ' + e.message; fails++; }
    const nums = [G.balance.cash, G.company.sharePrice, G.company.sharesOutstanding, G.balance.totalEquity];
    if (nums.some(bad)) { after += ' | NaN in ' + JSON.stringify(nums); fails++; }
    runs++;
    console.log(`  [${i}] ${ch.label}${gated ? ' (gated: ' + (ch.checkMsg || '') + ')' : ''}\n      -> ${String(msg).replace(/<[^>]+>/g, '')}${after}`);
  }
}
console.log(`\n${runs} choices applied, ${fails} problems`);
