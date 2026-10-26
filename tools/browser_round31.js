/* browser_round31.js — round 31: the Dealroom shows building works and tenants
   to watch (weak rent cover, empty space being re-let, rent stepping up), and
   Jenkins explains the Dealroom and political capital when they first matter.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round31.js" [outdir] */
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
  const j = await pg.evaluate(() => { const G = GameState; UI.closeModal(); for (let i = 0; i < 7; i++) { Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null; }
    G.board.politicalCapital = 4; Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null;
    return G.inbox.items.filter(i => /Not everything for sale|political capital to spend/.test(i.title)).map(i => i.title); });
  ok(j.length === 2, 'Jenkins: ' + j.join(' | '));
  const d = await pg.evaluate(() => { const G = GameState;
    G.staff.push({ roleId: 'asset', title: 'Asset Manager', name: 'AM', salary: 0.3, skill: 6, portrait: 's01.jpg' });
    const reno = G.portfolio.find(x => Properties.canRenovate(x).ok) || G.portfolio[0]; if (Properties.canRenovate(reno).ok) Properties.startRenovation(reno.id); else Object.assign(reno, { underConstruction: true, constructionType: 'renovation', constructionQuartersLeft: 1 });
    const t = Tenants.myTopTenants()[0]; G.tenants[t.id].coverage = 0.9; G.tenants[t.id].trend = -1;
    const multi = G.portfolio.find(p => p.lease && p.lease.type === 'multi' && p.lease.positions.length); if (multi) { multi.lease.positions[0].vacant = true; multi.lease.positions[0].relet = 3; }
    G.portfolio[1].rentFactor = 0.5;
    UI.renderAll(); document.querySelector('.tb-tab[data-view="stories"]').click(); Journal.render();
    return document.getElementById('stories-body').textContent; });
  ok(/Building works/.test(d) && /Renovating/.test(d), 'Dealroom: building works');
  ok(/Tenants to watch/.test(d) && /Paying you from savings/.test(d) && /Empty space at/.test(d) && /Rent stepping up: 50%/.test(d), 'Dealroom: tenants to watch (weak cover, empty space, rent stepping up)');
  await pg.screenshot({ path: OUT + '/r31_dealroom.png' });
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
