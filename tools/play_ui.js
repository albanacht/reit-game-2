const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'warning') errs.push('warn ' + m.text()); });
  await pg.goto('file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html'); await wait(400);
  await pg.evaluate(() => { localStorage.clear(); const t = document.getElementById('input-tutorial'); if (t) t.checked = false; UI.newGame(); UI.closeModal(); }); await wait(800);
  let seen = 0;
  for (let i = 0; i < 24; i++) {
    // answer anything waiting: decisions (first enabled choice), meetings (click through)
    for (let k = 0; k < 40; k++) {
      const st = await pg.evaluate(() => { const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) { Meeting.flush && Meeting.flush(); const b = [...document.querySelectorAll('#mt-actions .mt-btn')].find(x => !x.disabled); if (b) { b.click(); return 'meet'; } return 'meetwait'; }
        const mo = document.getElementById('modal-overlay'); if (!mo.classList.contains('hidden')) { const t = document.getElementById('modal-title').textContent; if (/bond falls due/i.test(t)) return 'BOND:' + t; const c = document.querySelector('#modal-body .decision-choice:not(.decision-choice-disabled):not(.decision-hold)'); if (c) { c.click(); return 'dec'; } UI.closeModal(); return 'closed'; }
        if (GameState._pendingDecision) { UI.openPendingDecision(); return 'open'; } return 'free'; });
      if (st.startsWith('BOND')) { console.log('   ' + st); await pg.evaluate(() => { const b = [...document.querySelectorAll('#modal-actions button')].find(x => /^Refinance/.test(x.textContent)); b && b.click(); }); await wait(300);
        const t2 = await pg.evaluate(() => document.getElementById('modal-title').textContent + ' || ' + document.getElementById('modal-body').textContent.slice(0, 160)); console.log('   after refinance: ' + t2);
        await pg.evaluate(() => { const b = [...document.querySelectorAll('#modal-actions button')].find(x => /Repay and continue|Continue/.test(x.textContent)); b && b.click(); }); await wait(900); continue; }
      if (st === 'free') break; await wait(120);
    }
    await pg.evaluate(() => { GameState.balance.cash = Math.max(GameState.balance.cash, 5); });
    await pg.click('#btn-advance-quarter'); await wait(700);
    const r = await pg.evaluate(seen => { const G = GameState, items = G.inbox.items || [];
      const nw = items.slice(seen).filter(i => /Jenkins|Levi|Petrova|Director Chen/.test(i.from || '') && !/^(Not happy|Delighted|Less worried|Furious|Line crossed|The market can count|Not at the cost)/.test(i.title)).map(i => (i.from || '').split(' ').pop() + ': ' + i.title);
      return { q: G.meta.year + 'Q' + G.meta.quarter, ph: Arc.phase(), levi: Levi.L().stage, due: Story.S().due, over: G.meta.gameOver ? G.meta.gameOverReason.slice(0, 80) : '', nw, n: items.length }; }, seen);
    seen = r.n;
    console.log(r.q, r.ph, 'levi=' + r.levi, 'due=' + r.due, r.over, JSON.stringify(r.nw));
    if (r.over) break;
  }
  console.log(errs.slice(0, 5).join(' | ') || 'no errors');
  await b.close();
})();
