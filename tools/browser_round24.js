/* browser_round24.js — round 24 polish: the start screen (New game above
   Continue), Jenkins's building steps after the CFO, the land auction letter,
   who pays your rent (Properties), the share price at the meeting, the
   chairman's shares in his own voice and not in Year 1, directors paid in
   shares (and not counted as a share sale), the Finance layout.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round24.js" [outdir] */
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
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await wait(500);

  // 1. start screen
  const s0 = await pg.evaluate(() => ({ box: document.getElementById('continue-box').classList.contains('hidden'),
    order: document.getElementById('btn-new-game-go').compareDocumentPosition(document.getElementById('btn-continue')) & Node.DOCUMENT_POSITION_FOLLOWING }));
  ok(s0.box && s0.order, 'no save: only "Start Game"; Continue sits below it in the page');
  await pg.evaluate(() => { UI.newGame(); }); await wait(1500);
  await pg.evaluate(() => { UI.closeModal(); Financials.runQuarter(); UI.renderAll(); Save.save(); });
  await pg.reload(); await wait(600);
  const s1 = await pg.evaluate(() => ({ box: !document.getElementById('continue-box').classList.contains('hidden'), btn: document.getElementById('btn-continue').textContent, label: document.getElementById('continue-label').textContent, ng: document.getElementById('btn-new-game-go').textContent }));
  ok(s1.box && /Continue your last game/.test(s1.btn) && /only for a new game/.test(s1.label), 'with a save: "' + s1.ng + '" first, then "' + s1.btn + '" — ' + s1.label);
  await pg.screenshot({ path: OUT + '/r24_start.png' });

  // 2. Jenkins after the CFO: Asset Manager, lease up, renovate
  await pg.evaluate(() => { localStorage.clear(); UI.newGame(); }); await wait(1500);
  const j = await pg.evaluate(() => { const G = GameState; UI.closeModal(); G.balance.cash = 300;
    const titles = () => G.inbox.items.map(i => i.title);
    Inbox.message('Jenkins', 'Chief of Staff', 'Step 4: Hire a CFO', 'x', null, 'cfo');
    G.staff.push({ roleId: 'cfo', title: 'Chief Financial Officer', name: 'T CFO', salary: 0.3, skill: 6, portrait: 's01.jpg' }); UI.renderAll();
    const a = titles().filter(t => /Step 5|Done: you hired a CFO/.test(t));
    const step5 = (G.inbox.items.find(i => /Step 5/.test(i.title)) || {}).body || '';
    G.staff.push({ roleId: 'asset', title: 'Asset Manager', name: 'T AM', salary: 0.3, skill: 6, portrait: 's02.jpg' }); UI.renderAll();
    const step6 = (G.inbox.items.find(i => /Step 6/.test(i.title)) || {}).body || '';
    G.portfolio[0].leaseUpYear = G.meta.year; UI.renderAll();
    const step7 = (G.inbox.items.find(i => /Step 7/.test(i.title)) || {}).body || '';
    G.portfolio[0].renovated = true; UI.renderAll();
    return { a, step5, step6, step7, done: titles().filter(t => /Done/.test(t)) }; });
  ok(j.a.length === 2 && /Asset Manager/.test(j.step5), 'CFO hired → "Step 5: Hire an Asset Manager"');
  ok(/65% and 85%/.test(j.step6), 'Asset Manager hired → Step 6, lease up: "' + j.step6.replace(/<[^>]+>/g, '').slice(0, 140) + '…"');
  ok(/75% to 90%/.test(j.step7), 'leased up → Step 7, renovate: "' + j.step7.replace(/<[^>]+>/g, '').slice(0, 140) + '…"');
  ok(j.done.some(t => /renovated/.test(t)), 'each step ticks off: ' + j.done.join(' | '));

  // 3. the land auction letter
  const l = await pg.evaluate(() => { const G = GameState; const r0 = Math.random; Math.random = () => 0.99;
    Deals.bid('lot_02', 9); Financials.runQuarter(); Math.random = r0; Story.S().due = null; G._pendingDecision = null;
    const m = G.inbox.items.find(i => /You won Grandview/.test(i.title)); return m ? m.from + ': ' + m.title + ' — ' + m.body.replace(/<[^>]+>/g, ' ').slice(0, 160) : null; });
  ok(!!l, 'land won, a letter: "' + l + '"');

  // 4. who pays your rent
  const t = await pg.evaluate(() => { UI.renderAll(); document.querySelector('.tb-tab[data-view="properties"]').click(); const p = document.getElementById('tenantsPanel');
    return { rows: p.querySelectorAll('.tn-r').length, txt: p.textContent.slice(0, 200) }; });
  ok(t.rows >= 3 && /Who pays your rent/.test(t.txt), 'Properties: who pays your rent (' + t.rows + ' rows): "' + t.txt.slice(0, 140) + '"');
  await pg.screenshot({ path: OUT + '/r24_tenants.png' });

  // 5. the chairman's shares: silent in Year 1, then in his own voice
  const w = await pg.evaluate(() => { const G = GameState, h = G.board.brain.holdings.filter(x => x.id === 'williams');
    h.forEach(x => x.price = G.company.sharePrice * 1.3); G.meta.totalQuarters = 3; Directors.update(true); const y1 = Directors.card('williams').cause;
    G.meta.totalQuarters = 9; const j = Directors.card('williams'); return { y1, y3: (Directors.update(true), Directors.card('williams').cause), stake: !!j.stake }; });
  ok(!/own [\d,]+ shares/.test(w.y1), 'Year 1: no complaint about his shares ("' + w.y1 + '")');
  ok(/own [\d,]+ shares, down/.test(w.y3) && w.stake, 'Year 3: "' + w.y3 + '" (the meeting says it as: "I own … shares of this company, son…")');

  // 6. directors paid in shares; the share count moves; Petrova does not call it dilution
  const p = await pg.evaluate(() => { const G = GameState, s0 = G.company.sharesOutstanding, c0 = G.company.compShares || 0, n0 = G.board.brain.holdings.filter(x => x.id === 'chen').reduce((a, x) => a + x.n, 0);
    const items = Pay.meeting(G.meta.year + 1); const msgs = items.filter(i => i.effect).map(i => i.effect());
    const n1 = G.board.brain.holdings.filter(x => x.id === 'chen').reduce((a, x) => a + x.n, 0);
    Pay.L().grants.push({ y: G.meta.year - 3, n: 300000, vested: 0, tr: 0 }); const v = Pay.vest(G.meta.year);
    return { msgs, s0, s1: G.company.sharesOutstanding, comp: G.company.compShares - c0, chen: n1 - n0, v }; });
  ok(p.s1 > p.s0 && p.chen > 0, 'board pay: ' + (p.msgs.find(m => /Directors/.test(m)) || ''));
  ok(Math.abs(p.comp - (p.s1 - p.s0)) < 0.02, 'shares out ' + p.s0 + 'M → ' + p.s1 + 'M, all of it pay (' + p.comp.toFixed(2) + 'M), so Petrova’s dilution line ignores it (CEO vest: ' + p.v.toLocaleString() + ' shares)');

  // 7. the share price at the meeting, and the Finance layout
  const m = await pg.evaluate(() => { const G = GameState; for (let i = 0; i < 4; i++) { Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null; }
    Meeting.open(); return true; });
  await wait(1500); await pg.evaluate(() => Meeting.flush()); await wait(400);
  const ms = await pg.evaluate(() => { const sp = document.querySelector('#mt-chat .mt-spark'); return sp ? sp.textContent.slice(0, 120) : null; });
  ok(!!ms, 'meeting opens with the share price chart: "' + ms + '"');
  await pg.screenshot({ path: OUT + '/r24_meeting.png' });
  const f = await pg.evaluate(() => { Meeting.close && Meeting.close(); document.querySelector('.tb-tab[data-view="finance"]').click();
    const cols = [...document.querySelectorAll('#view-finance .fin-col')].map(c => Math.round(c.getBoundingClientRect().height));
    const first = document.querySelector('#view-finance .charts-grid .chart-wrap canvas').id; return { cols, first }; });
  ok(f.first === 'chart-share-price' && Math.max(...f.cols) - Math.min(...f.cols) < 260, 'Finance: share price chart first; columns ' + f.cols.join(' / ') + 'px');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
