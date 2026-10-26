/* browser_round25.js — round 25: Petrova's share advice by band (only when it
   changes), interest rates named among the price reasons, the ending gallery
   (unlock badge, title screen, Dealroom line).
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round25.js" [outdir] */
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
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear());
  await pg.evaluate(() => UI.newGame()); await wait(1300);
  await pg.evaluate(() => { UI.closeModal(); for (let i = 0; i < 5; i++) { Financials.runQuarter(); Story.S().due = null; GameState._pendingDecision = null; } });

  // 1. Petrova by band, once per change
  const p = await pg.evaluate(() => { const G = GameState, nav = G.ratios.navPerShare, out = {};
    const pet = () => { for (let k = 0; k < 6; k++) { const h = Directors.hint(); if (h && h.id === 'petrova') return h.text; } return null; };
    G.company.sharePrice = nav * 0.6; out.buy = pet(); out.again = pet();
    G.company.sharePrice = nav * 0.8; out.hold = pet();
    G.company.sharePrice = nav * 1.0; out.issue = pet();
    G.company.sharePrice = nav * 0.72; out.demand = Board.demandFor('petrova').mandateId;
    return out; });
  ok(/buy some back/.test(p.buy || ''), 'below 70% of NAV: "' + p.buy + '"');
  ok(p.again === null, 'same band next time: Petrova says nothing');
  ok(/would not sell new shares/.test(p.hold || ''), '70-95%: "' + p.hold + '"');
  ok(/do not mind new shares/.test(p.issue || ''), 'from 95%: "' + p.issue + '"');
  ok(p.demand !== 'pet_buyback', 'at 72% of NAV she no longer demands a buyback (' + p.demand + ')');

  // 2. interest rates among the price reasons
  const r = await pg.evaluate(() => { const G = GameState, h = G.history; h[h.length - 4].baseInterestRate = G.market.baseInterestRate - 1;
    Financials.fairPrice(G.pnl, false); const bad = (G._priceWhy.bad || []).join(' | ');
    h[h.length - 4].baseInterestRate = G.market.baseInterestRate + 1; Financials.fairPrice(G.pnl, false); const good = (G._priceWhy.good || []).join(' | ');
    return { bad, good }; });
  ok(/interest rates up 1\.00 points/.test(r.bad), 'rates up: "' + (r.bad.match(/interest rates up[^|]+/) || [''])[0] + '"');
  ok(/interest rates down 1\.00 points/.test(r.good), 'rates down: "' + (r.good.match(/interest rates down[^|]+/) || [''])[0] + '"');

  // 3. the ending gallery
  const e = await pg.evaluate(() => { localStorage.removeItem('reitsim2.endings'); Ending.show(() => {}); const o = document.getElementById('ending-overlay');
    const badge = (o.querySelector('.en-badge') || {}).textContent || ''; o.classList.add('hidden');
    Ending.show(() => {}); const badge2 = (o.querySelector('.en-badge') || {}).textContent || ''; o.classList.add('hidden');
    const g = Ending.gallery(); return { badge, badge2, kinds: Object.keys(g.main), cards: Object.keys(g.cards).length, kind: Ending.kind() }; });
  ok(/New ending unlocked: 1 of 9/.test(e.badge) && !e.badge2, 'first time "' + e.kind + '": "' + e.badge + '"; the second time no badge');
  ok(e.kinds.length === 1, 'remembered across games: ' + e.kinds.join(', ') + ' + ' + e.cards + ' story outcomes');
  const t = await pg.evaluate(() => { UI.renderAll(); document.querySelector('.tb-tab[data-view="stories"]').click(); const d = (document.querySelector('#stories-body .dr-end') || {}).textContent || '';
    document.getElementById('btn-menu').click(); [...document.querySelectorAll('#modal-actions button')].find(x => /title screen/.test(x.textContent)).click();
    return { d, g: (document.getElementById('endings-gallery') || {}).textContent || '' }; });
  ok(/Endings found: 1 of 9/.test(t.d), 'Dealroom: "' + t.d + '"');
  await pg.evaluate(() => { const d = document.querySelector('#endings-gallery details'); if (d) d.open = true; });
  await wait(200); await pg.screenshot({ path: OUT + '/r25_gallery.png' });
  ok(/Endings found: 1 of 9/.test(t.g) && /\u2605/.test(t.g), 'title screen gallery: "' + t.g.slice(0, 80) + '"');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
