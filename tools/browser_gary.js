/* browser_gary.js — round 15: Gary's story (gary.js), the new ending cards,
   and resigning at the annual meeting.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_gary.js" <outdir> */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const OUT = process.argv[2] || '/tmp';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'warning' && /gary|story|ending/.test(m.text())) errs.push('warn: ' + m.text()); });
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear());
  await pg.evaluate(() => UI.newGame()); await wait(1500); await pg.evaluate(() => UI.closeModal());
  await pg.evaluate(() => {
    window.__setQ = (y, q) => { GameState.meta.year = y; GameState.meta.quarter = q; GameState.meta.totalQuarters = (y - 1) * 4 + q; };
    window.__gq = () => { GameState.pnl.netRentalRevenue = 8; const out = []; Gary.processQuarter(out); const q = GameState.meta.quarter + 1; if (q > 4) __setQ(GameState.meta.year + 1, 1); else __setQ(GameState.meta.year, q); return out.map(o => o.text).join(' / '); };
    window.__card = (id, re) => { const c = World.DECISIONS.find(x => x.id === id).build(); const ch = c.choices.find(x => re.test(x.label) && (!x.check || x.check())); const m = ch.apply(); Story.S().due = null; return { title: c.title, body: c.body, msg: m }; };
    window.__pick = (it, re) => { const c = it.choices.find(x => re.test(x.label) && !x.disabled) || it.choices.find(x => !x.disabled); return c.go(); };
  });
  // Act 1: the offer
  const a1 = await pg.evaluate(() => { __setQ(3, 1); Pay.L().cash = 1.2; Story.S().due = null; __gq(); return Story.S().due; });
  ok(a1 === 'gary_offer', 'Year 3: Gary’s offer arrives');
  await pg.evaluate(() => { GameState._pendingDecision = World.systemDecision ? World.systemDecision() : null; UI.openPendingDecision && UI.openPendingDecision(); }); await wait(300);
  await pg.screenshot({ path: OUT + '/gary_offer.png' });
  await pg.evaluate(() => { UI.closeModal(); GameState._pendingDecision = null; Story.S().due = 'gary_offer'; });
  const c1 = await pg.evaluate(() => { const r = __card('gary_offer', /^Buy 40%/); return { msg: r.msg, cash: Pay.L().cash, st: Gary.S().stage }; });
  ok(c1.st === 'vote' && Math.abs(c1.cash - 0.7) < 0.01, 'bought 40% of Lakeside with $0.5M of your own: ' + c1.msg);
  // the vote at the meeting
  const v = await pg.evaluate(() => { const it = Gary.agenda(3, [])[0]; const lbl = it.choices[0].label; Math.random = () => 0.01; const m = __pick(it, /Leave the room/); return { lbl, m, st: Gary.S().stage }; });
  ok(v.st === 'run', 'the independent directors vote while you are out: ' + v.lbl + ' → ' + v.m);
  // running: your share, the fee, Act 2 (corners cut)
  const run = await pg.evaluate(() => { Math.random = (() => { let s = 3; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); Gary.debug({ quality: 'corners', act2Q: (GameState.meta.year - 1) * 4 + GameState.meta.quarter + 2 }); const c0 = Pay.L().cash, out = []; for (let i = 0; i < 6; i++) out.push(__gq()); return { earned: Gary.S().earned, gain: Pay.L().cash - c0, fee: Gary.feeQ(), boiler: Gary.S().boiler, out: out.filter(Boolean).join(' / ') }; });
  ok(run.earned > 0 && run.fee > 0, 'running: your 40% paid $' + run.earned.toFixed(2) + 'M in 6 quarters (plus the lake house: $' + run.gain.toFixed(2) + 'M in all); the company pays $' + run.fee.toFixed(2) + 'M a quarter extra');
  ok(!!run.boiler, 'Gary cut corners: ' + run.out);
  // page 212
  const p = await pg.evaluate(() => { const it = Gary.agenda(GameState.meta.year, []).find(i => /page 212/.test(JSON.stringify(i.lines))); const labels = it ? it.choices.map(c => c.label).join(' | ') : ''; const m = it ? __pick(it, /Keep it/) : null; return { labels, m, flagged: Gary.flagged() }; });
  ok(p.flagged, 'Nora prints page 212; Petrova raises it: ' + p.labels + ' → kept');
  // the cash-out, from Year 10 (no war: Crestline)
  const s = await pg.evaluate(() => { __setQ(10, 1); Gary.debug({ saleQ: (10 - 1) * 4 + 1 }); Story.S().due = null; __gq(); const due = Story.S().due; const c0 = Pay.L().cash; const r = due === 'gary_sale' ? __card('gary_sale', /^Sell/) : null; return { due, r: r && r.msg, gain: Pay.L().cash - c0, end: Gary.ending(), fee: Gary.feeQ() }; });
  ok(s.due === 'gary_sale' && s.gain > 1 && s.end === 'dock' && s.fee === 0, 'Lakeside sold at 6x profit: +$' + s.gain.toFixed(2) + 'M to you; the extra fee stops (' + s.r + ')');
  // the Rennick variant
  const rv = await pg.evaluate(() => { Gary.debug({ stage: 'run', stake: 0.4, sold: 0, buyer: null }); War.debug({ stage: 'war' }); Story.S().due = 'gary_sale'; const r = __card('gary_sale', /^Sell/); const lk = War.W().lakeside; const it = Gary.agenda(GameState.meta.year, []).find(i => /Rennick now manages/.test(JSON.stringify(i.lines))); const m = it ? __pick(it, /End it/) : null; return { lk, m, after: War.W().lakeside, end: Gary.ending() }; });
  ok(rv.lk && !rv.after && rv.end === 'rennick', 'during the war Rennick buys Lakeside (his attacks +25%) until we end it: ' + rv.m);
  // the ending cards
  const e = await pg.evaluate(() => { Directors.addDirector('tex', 6, 'Tex Brennan joined'); return Ending.cards().map(c => c.label + ': ' + c.lines[0]); });
  ok(e.some(x => /^Gary/.test(x)) && e.some(x => /^Tex/.test(x)), 'ending cards include Gary and Tex: ' + e.filter(x => /Gary|Tex/.test(x)).join(' | '));
  const dv = await pg.evaluate(() => { const f = Ending.facts(); return { k: Ending.kind(), w: f.wealth, gap: f.rivalsA == null ? null : f.tsrA - f.rivalsA }; });
  ok(dv.k !== 'divine' || (dv.w >= 25 && dv.gap >= 0.02), 'divine status needs $25M+ and 2 points a year over the rivals (now: ' + dv.k + ')');
  // resign at a real meeting
  await pg.evaluate(() => { UI.newGame(); UI.closeModal(); }); await wait(1200);
  const meetingUp = () => pg.evaluate(() => { const m = document.getElementById('meeting'); return !!m && !m.classList.contains('hidden'); });
  for (let y = 1; y <= 2; y++) {
    for (let i = 0; i < 6 && !(await meetingUp()); i++) {
      await pg.evaluate(() => { for (let k = 0; k < 3 && GameState._pendingDecision; k++) { UI.openPendingDecision(); const c = document.querySelector('#modal-body .decision-choice:not(.decision-choice-disabled):not(.decision-hold)'); if (c) c.click(); else GameState._pendingDecision = null; } UI.closeModal(); });
      await pg.click('#btn-advance-quarter'); await wait(800); await pg.evaluate(() => UI.closeModal());
    }
    let resigned = false;
    for (let step = 0; step < 80; step++) {
      await wait(110); await pg.evaluate(() => Meeting.flush()); await wait(50);
      const st = await pg.evaluate(() => [...document.querySelectorAll('#mt-actions .mt-btn')].map(b => ({ t: b.querySelector('b').textContent, dis: b.disabled })));
      if (!st.length) { if (!(await meetingUp())) break; continue; }
      let i = st.findIndex(x => !x.dis);
      if (y === 2 && st.some(x => /^Resign as CEO/.test(x.t))) i = st.findIndex(x => /^Resign as CEO/.test(x.t));
      if (y === 2 && st.some(x => /^Yes: resign now/.test(x.t))) { i = st.findIndex(x => /^Yes: resign now/.test(x.t)); resigned = true; }
      const last = y !== 2 && /^(Back to work|Leave the boardroom)/.test(st[0].t);
      await pg.evaluate(i => document.querySelectorAll('#mt-actions .mt-btn')[i].click(), i);
      if (last || resigned) break;
    }
    if (y === 1) ok(!(await meetingUp()), 'Year 1 meeting done (no resign button in the practice year)');
  }
  await wait(600);
  const ex = await pg.evaluate(() => { const o = document.getElementById('ending-overlay'); return { over: GameState.meta.gameOver, res: GameState.meta.resigned, h: o && !o.classList.contains('hidden') ? o.querySelector('h1').textContent : null }; });
  ok(ex.over && ex.res && ex.h === 'The clean exit', 'resigned at the Year 2 meeting: "' + ex.h + '"');
  await pg.screenshot({ path: OUT + '/gary_exit.png' });
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
