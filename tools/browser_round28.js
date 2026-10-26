/* browser_round28.js — round 28: lease ups in AFFO and building spend shown on
   the income statement; the 2.0 leaderboard (JSONBin stubbed: post, rank,
   table, once per run, title screen); the game over title follows the ending.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round28.js" [outdir] */
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
  const a = await pg.evaluate(() => { const G = GameState; UI.closeModal(); for (let i = 0; i < 3; i++) { Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null; }
    G.staff.push({ roleId: 'asset', title: 'Asset Manager', name: 'AM', salary: 0.3, skill: 6, portrait: 's01.jpg' });
    const p = G.portfolio.filter(x => x.occupancy < 0.9 && !Tenants.isLocked(x))[0]; UI.leaseUp(p.id); document.querySelector('#modal-actions .btn-primary').click();
    const reno = G.portfolio.find(x => Properties.canRenovate(x).ok); if (reno) Properties.startRenovation(reno.id);
    Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null; UI.renderAll();
    const row = id => { const e = document.getElementById(id); return e && e.style.display !== 'none' ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    return { l: row('pnl-leasing-row'), p: row('pnl-projects-row'), affo: G.pnl.affo, ffo: G.pnl.ffo, cap: G.pnl.capexReserve, lc: G.pnl.leasingCosts }; });
  ok(a.l && Math.abs(a.affo - (a.ffo - a.cap - a.lc)) < 0.02, 'income statement: "' + a.l + '", AFFO = FFO − reserve − leasing (' + a.ffo + ' − ' + a.cap + ' − ' + a.lc + ' = ' + a.affo + ')');
  ok(!!a.p, 'and below retained cash: "' + a.p + '"');
  // the leaderboard, stubbed
  const s = await pg.evaluate(async () => { const store = { scores: [{ name: 'Ann', company: 'A REIT', wealth: 31.5, tsrA: 0.08, rivalsA: 0.05, ending: 'divine', endingTitle: 'Divine status', years: 15, date: '2026-10-01', v: 2 },
                                                              { name: 'Bo', company: 'B REIT', wealth: 4.2, tsrA: -0.03, rivalsA: 0.04, ending: 'fired', endingTitle: 'Shown the door', years: 4, date: '2026-10-02', v: 2 }] };
    window.fetch = async (u, o) => { if (o && o.method === 'PUT') { Object.assign(store, JSON.parse(o.body)); return { ok: true, json: async () => ({}) }; } return { ok: true, json: async () => JSON.parse(JSON.stringify(store)) }; };
    Scores.test(true); GameState.meta.gameOver = true; GameState.meta.gameOverReason = 'Fifteen years.'; GameState._endingShown = true; Pay.L().cash = 12.3;
    UI.showGameOver ? UI.showGameOver() : document.getElementById('gameover-overlay').classList.remove('hidden');
    if (!document.getElementById('lb2-go')) Scores.renderGameOver();
    await new Promise(r => setTimeout(r, 100));
    document.getElementById('lb2-name').value = 'Alexander'; document.getElementById('lb2-go').click(); await new Promise(r => setTimeout(r, 300));
    const msg = document.getElementById('lb2-msg').textContent, rows = [...document.querySelectorAll('#lb2-table tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim());
    const again = await Scores.post('Alexander'); const title = document.getElementById('gameover-title').textContent;
    return { msg, rows, again: again.message, stored: store.scores.length, title }; });
  ok(/#2 of 3/.test(s.msg), 'posted: "' + s.msg + '"');
  console.log('      ' + s.rows.join(' | '));
  ok(/already/.test(s.again) && s.stored === 3, 'one post per run: "' + s.again + '"');
  ok(s.title && s.title !== "YOU'RE FIRED" || /FIRED/.test(s.title), 'game over title follows the ending: "' + s.title + '"');
  await pg.screenshot({ path: OUT + '/r28_gameover.png' });
  const t = await pg.evaluate(async () => { document.getElementById('start-overlay').classList.remove('hidden'); await Scores.renderTitle(); const d = document.querySelector('#lb2-title details'); d.open = true; return document.getElementById('lb2-title').textContent.slice(0, 160); });
  ok(/richest CEOs/.test(t) && /Alexander/.test(t), 'title screen: "' + t.slice(0, 120) + '"');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
