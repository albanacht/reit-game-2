/* browser_round42.js — round 42, after Abe's playtest: "Issue company shares" and
   the "?" explainers, the forgotten filter, Furious votes against, Renovate always
   shown (greyed with a reason) and renovation with the tenants in, the meeting pace
   (speed switch, stamps with the words, Call the vote, one table for last year's
   demands), Jenkins teaching the why (Step 1, the Advance hint, the goodbye, the
   minutes), glossary terms in sentences with a delay, the map card delay, the AI
   note, tab icons.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round42.js" [outdir] */
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
  const fresh = async () => { await pg.evaluate(() => { localStorage.clear(); UI.newGame(); UI.closeModal(); }); await wait(700); await pg.evaluate(() => { Story.S().due = null; GameState._pendingDecision = null; GameState.debtTranches.forEach(t => { t.maturityYear += 12; }); }); };
  await pg.goto(R); await wait(300);
  const foot = await pg.evaluate(() => document.querySelector('.start-foot').textContent);
  await fresh();

  // 1. the shares label, the "?" explainers; tab icons; the AI note
  const sh = await pg.evaluate(() => { const t = [...document.querySelectorAll('.action-group-title')].map(x => x.textContent).find(x => /Issue company shares/.test(x)); UI.explain('shares'); const m = document.getElementById('modal-body').textContent; UI.closeModal();
    return { t, m, icons: document.querySelectorAll('#topbar .tb-tab .tb-ic').length }; });
  ok(sh.t && /not to you/.test(sh.m) && /NAV/.test(sh.m), '"' + sh.t.replace(/\?$/, '').trim() + '"; the "?" says: "' + sh.m.slice(0, 90) + '…"');
  ok(sh.icons === 6 && /AI-generated/.test(foot), 'six tab icons; the start screen says the pictures are AI-generated');

  // 2. Jenkins teaches the why, with our numbers; Step 1 and 2 done: "press Advance quarter"
  const jk = await pg.evaluate(() => { const it = (GameState.inbox.items || []).find(i => i.title === 'Step 1: Borrow'); return it ? it.body.replace(/<[^>]+>/g, '') : ''; });
  ok(/gap/.test(jk) && /\d\.\d%/.test(jk), 'Step 1: "' + jk.slice(0, 120) + '…"');
  const adv = await pg.evaluate(() => { Financials.issueDebt(50, 7, false); Financials.issueEquity(2); Inbox.checkTasks ? Inbox.checkTasks() : UI.renderAll(); UI.renderAll();
    return (GameState.inbox.items || []).some(i => /everything for this quarter/.test(i.title)); });
  ok(adv, 'both Year 1 Q1 steps done: Jenkins says to press Advance quarter');

  // 3. the filter: loud, one click to clear, and gone in a new game
  const fl = await pg.evaluate(() => { document.querySelector('.tb-tab[data-view="properties"]').click(); const k = document.querySelector('.kpi[data-f="low"]'); if (k) k.click();
    const chip = document.querySelector('.flt-chip'); const t = chip ? chip.textContent : ''; return t; });
  await fresh();
  const fl2 = await pg.evaluate(() => { document.querySelector('.tb-tab[data-view="properties"]').click(); return { chip: !!document.querySelector('.flt-chip'), n: document.querySelectorAll('#tMine tr.row').length, own: GameState.portfolio.length }; });
  ok(/Showing only/.test(fl) && !fl2.chip && fl2.n === fl2.own, 'filter chip "' + fl.slice(0, 50) + '…"; a new game shows all ' + fl2.n + ' buildings');

  // 4. Furious votes against, whatever the scorecard
  const fu = await pg.evaluate(() => { const d = GameState.board.directors.find(x => x.id === 'chen'); d.attitude = 1.2; return Directors.votesAgainst('chen'); });
  ok(fu === true, 'Chen at Furious (1.2) votes against');

  // 5. Renovate: greyed with a reason when New; with the tenants in, rent −10%, then +10% over a year
  await fresh();
  const rv = await pg.evaluate(() => { const G = GameState; G.balance.cash = 200; if (!Staff.hasRole('asset')) G.staff.push({ roleId: 'asset', title: 'Asset Manager', name: 'T', salary: 0.2, skill: 6 });
    const p = G.portfolio.find(x => !Tenants.isLocked(x)); p.quarterOwned = 8; p.renovated = true; p.renovatedYear = G.meta.year;
    document.querySelector('.tb-tab[data-view="properties"]').click(); PROPS.focus(p.id); UI.renderAll();
    const grey = [...document.querySelectorAll('#tab-properties button.act')].map(x => x.textContent).find(t => /Renovate:/.test(t)) || '';
    p.renovatedYear = G.meta.year - 7; p.occupancy = 0.95; const occ0 = p.occupancy, noi0 = p.annualNOI;
    const r = Properties.startRenovation(p.id); const during = { off: !!p.underConstruction, occ: p.occupancy };
    for (let i = 0; i < 6; i++) { Financials.runQuarter(); Story.S().due = null; G._pendingDecision = null; }
    return { grey, ok: r.success, during, occ0, cond: Properties.condition(p).label, ratio: p.annualNOI / noi0 }; });
  ok(/Renovate: from Year \d+ \(when Worn\)/.test(rv.grey), 'a New building shows "' + rv.grey.trim() + '"');
  ok(rv.ok && !rv.during.off && rv.during.occ === rv.occ0 && rv.cond === 'New' && rv.ratio > 1.06, 'renovating at ' + Math.round(rv.occ0 * 100) + '% let: no closure, then New; rent ×' + rv.ratio.toFixed(3) + ' after 6 quarters (drift included)');

  // 6. the meeting: speed switch, Jenkins's minutes, last year's demands in one table, Call the vote, stamps
  await fresh();
  const mt = await pg.evaluate(() => { const G = GameState; G.meta.year = 2; G.meta.quarter = 1; G.meta.totalQuarters = 5; Meeting.open(); Meeting.flush();
    const sp = [...document.querySelectorAll('#mt-speed button')].map(x => x.textContent); const chat = document.getElementById('mt-chat').textContent; Meeting.close(); return { sp, minutes: /taking the minutes/.test(chat) }; });
  ok(mt.sp.join('/') === 'Normal/Fast/Instant' && mt.minutes, 'meeting header: ' + mt.sp.join(' / ') + '; Jenkins takes the minutes at the first meeting');
  const vt = await pg.evaluate(async () => { const G = GameState; G.meta.year = 3; G.meta.totalQuarters = 9; G.board._meetingYear = 0; G.board._demandsYear = null; G.board._storyYear = null;
    G.board._lastReview = null; G.board.activeMandates = [{ directorId: 'okafor', text: 'Interest cover of at least 2.5x.', metric: 'interestCoverage', target: 2.5, higher: true }];
    Meeting.open(); const labels = []; let stamps = 0, table = false;
    for (let s = 0, idle = 0; s < 120 && idle < 15; s++) { Meeting.flush(); await new Promise(r => setTimeout(r, 40)); const bs = [...document.querySelectorAll('#mt-actions .mt-btn')]; if (!bs.length) { idle++; continue; } idle = 0;
      const t = bs.map(x => x.querySelector('b').textContent); labels.push(t[0]); table = table || /Last year\u2019s demands/.test(document.getElementById('mt-chat').textContent);
      stamps = Math.max(stamps, document.querySelectorAll('#mt-portraits .mt-stamp').length);
      const back = t.findIndex(x => /^Back to work/.test(x)); const i = back > -1 ? back : t.findIndex((x, k) => !bs[k].disabled && !/Resign/.test(x)); bs[i].click(); if (back > -1) break; }
    if (document.getElementById('meeting') && !document.getElementById('meeting').classList.contains('hidden')) Meeting.close();
    return { call: labels.includes('Call the vote'), stamps, table, labels: labels.join(' | ').slice(0, 300) }; });
  console.log('      ' + JSON.stringify(vt));
  ok(vt.call && vt.stamps >= 4 && vt.table, 'Year 2 meeting: last year’s demands in one table, "Call the vote", ' + vt.stamps + ' stamps');

  // 7. the goodbye at Year 2
  await fresh();
  const gb = await pg.evaluate(() => { const G = GameState; G.meta.year = 2; G.meta.quarter = 1; G._tutorialEnabled = true; G._tutorialShown = {}; UI.closeModal();
    const r = (UI.maybeShowTutorial ? UI.maybeShowTutorial() : null); return (G.inbox.items || []).some(i => /You know the basics/.test(i.title)) || r; });
  ok(!!gb, 'Year 2: Jenkins says goodbye ("You know the basics, boss")');

  // 8. jargon in sentences, with a delay; the map card waits too
  const gl = await pg.evaluate(async () => { UI.showModal('Test', 'Pick a cap rate above what money costs us.', []); await new Promise(r => setTimeout(r, 150));
    const sp = [...document.querySelectorAll('.ib-body .gl, .gl')].find(x => x.offsetParent && x.getBoundingClientRect().width > 0); if (!sp) return { none: true, n: document.querySelectorAll('.gl').length };
    sp.scrollIntoView(); const r = sp.getBoundingClientRect(); return { x: r.left + 3, y: r.top + 3, t: sp.textContent }; });
  let tip0 = null, tip1 = null;
  if (!gl.none) { await pg.mouse.move(gl.x, gl.y); await wait(150); tip0 = await pg.evaluate(() => { const t = document.getElementById('tipbox'); return !!t && t.style.display === 'block'; });
    await wait(700); tip1 = await pg.evaluate(() => { const t = document.getElementById('tipbox'); return t && t.style.display === 'block' ? t.textContent : null; }); }
  ok(!gl.none && tip0 === false && /Cap rate/.test(tip1 || ''), '"' + (gl.t || '?') + '" underlined in a dialog; no tip at 0.15 s, then: "' + String(tip1 || '').slice(0, 60) + '…"');
  const mc = await pg.evaluate(async () => { document.querySelector('.tb-tab[data-view="map"]').click(); MAP.render(); const mk = document.querySelector('#markers .mk'); mk.dispatchEvent(new MouseEvent('mouseenter'));
    await new Promise(r => setTimeout(r, 150)); const a = document.getElementById('card').style.display; await new Promise(r => setTimeout(r, 500)); const b2 = document.getElementById('card').style.display; mk.dispatchEvent(new MouseEvent('mouseleave')); return { a, b: b2 }; });
  ok(mc.a !== 'block' && mc.b === 'block', 'map card: hidden at 0.15 s, shown at 0.65 s');
  await pg.screenshot({ path: OUT + '/r42_top.png', clip: { x: 0, y: 0, width: 1440, height: 60 } });
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
