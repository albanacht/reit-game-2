/* browser_round40.js — round 40: Lease up fills a tenant's empty space first;
   as executive chairman you sit at the table and open the meeting.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round40.js" [outdir] */
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
  await pg.goto(R); await wait(300);
  await pg.evaluate(() => { localStorage.clear(); UI.newGame(); UI.closeModal(); Story.S().due = null; GameState._pendingDecision = null; GameState.debtTranches.forEach(t => { t.maturityYear += 12; }); });

  // 1. a named tenant leaves a multi-tenant building: Lease up fills that space next quarter
  const r = await pg.evaluate(() => { const G = GameState; G.balance.cash = 100;
    if (!Staff.hasRole('asset')) G.staff.push({ roleId: 'asset', title: 'Asset Manager', name: 'T', salary: 0.2, skill: 6 });
    const p = G.portfolio.find(x => x.lease && x.lease.type === 'multi' && x.lease.positions.some(q => !q.vacant)); if (!p) return { none: true };
    const pos = p.lease.positions.find(q => !q.vacant); const name = G.tenants[pos.t] ? G.tenants[pos.t].name : '?';
    pos.vacant = true; pos.relet = 5; p.occupancy = Math.max(0.5, p.occupancy - pos.share); p.leaseUpYear = 0; const o0 = p.occupancy;
    UI.leaseUp(p.id); const txt = document.getElementById('modal-body').textContent; document.querySelector('#modal-actions .btn-primary').click(); UI.closeModal();
    const relet = pos.relet; Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null;
    return { name, txt: txt.slice(0, 90), relet, vacant: pos.vacant || p.lease.positions.indexOf(pos) > -1 && pos.vacant, o0, o1: p.occupancy, share: pos.share }; });
  ok(!r.none && r.relet === 1 && !r.vacant && r.o1 > r.o0 + r.share * 0.5, 'Lease up with ' + r.name + '’s space empty: "' + r.txt + '…"; filled next quarter, occupancy ' + Math.round(r.o0 * 100) + '% → ' + Math.round(r.o1 * 100) + '%');

  // 2. executive chairman: your seat at the table, you open the meeting
  const m = await pg.evaluate(() => { const G = GameState; G.meta.year = 13; G.meta.quarter = 1; G.meta.totalQuarters = 49; G.board.chair = 'you'; G.board._meetingYear = 0; Directors.refresh(); Meeting.open(); Meeting.flush();
    const seat = document.querySelector('#mt-portraits .mt-p.you'); const first = (document.querySelector('#mt-chat .mt-line') || {}).textContent || '';
    const out = { seat: !!seat && /Chairman/.test(seat.textContent), first: first.slice(0, 80) }; Meeting.close(); return out; });
  ok(m.seat && /chair today|Thank you all for coming/.test(m.first), 'chairman: your seat at the head of the table; you open: "' + m.first + '"');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
