/* browser_story.js — the Harlow story (story.js) in real Chrome, branch by
   branch, plus the on-hold mechanic. Forces stages with Story.debug and pins
   the dice with a stubbed Math.random where a branch must be reached.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_story.js" <outdir> [repaid] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const OUT = process.argv[2] || '/tmp', HAPPY = process.argv[3] === 'repaid', REFUSE = process.argv[3] === 'refuse';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear());
  await pg.evaluate(() => UI.newGame()); await wait(1200); await pg.evaluate(() => UI.closeModal());

  const closeMeeting = () => pg.evaluate(() => { const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) Meeting.close(); });
  const pendingId = () => pg.evaluate(() => GameState._pendingDecision ? GameState._pendingDecision.id : null);
  // run one quarter; anything else waiting (deck cards, the bank) gets its first affordable answer
  const adv = async () => {
    for (let i = 0; i < 3 && await pg.evaluate(() => !!GameState._pendingDecision && !/^story_/.test(GameState._pendingDecision.id)); i++) {
      await pg.evaluate(() => { UI.openPendingDecision(); const c = document.querySelector('.decision-choice:not(.decision-choice-disabled):not(.decision-hold)'); c && c.click(); }); await wait(300); await pg.evaluate(() => UI.closeModal());
    }
    await pg.click('#btn-advance-quarter'); await wait(1000); await pg.evaluate(() => UI.closeModal()); await closeMeeting();
  };
  async function advanceUntil(id, max) {
    for (let i = 0; i < (max || 6); i++) {
      const p = await pendingId();
      if (p === id) return true;
      if (p) { await pg.evaluate(() => { UI.openPendingDecision(); const c = document.querySelector('.decision-choice:not(.decision-choice-disabled):not(.decision-hold)'); c && c.click(); }); await wait(300); await pg.evaluate(() => UI.closeModal()); continue; }
      await adv();
    }
    return (await pendingId()) === id;
  }
  async function choose(i, shot) {
    await pg.evaluate(() => UI.openPendingDecision()); await wait(300);
    if (shot) await pg.screenshot({ path: OUT + '/' + shot + '.png' });
    const txt = await pg.evaluate(i => { const c = document.querySelectorAll('#modal-body .decision-choice')[i]; const t = c ? c.textContent.replace(/\s+/g, ' ').trim() : ''; c && c.click(); return t; }, i);
    await wait(400); await pg.evaluate(() => UI.closeModal());
    return txt;
  }
  const H = () => pg.evaluate(() => JSON.parse(JSON.stringify(Story.H())));
  const dice = v => pg.evaluate(v => { window.__r = Math.random; Math.random = () => v; }, v);
  const undice = () => pg.evaluate(() => { if (window.__r) Math.random = window.__r; });

  // the building is on the map, Harlow's, not for sale
  ok(await pg.evaluate(() => GameState.cityRivals.some(p => p.id === 'ind_hdc' && p.ownerNote)), 'Harlow Distribution Centre is in the city, not for sale');

  // ---------------- Act 0, with the money on hold first
  await adv(); await adv();
  await pg.evaluate(() => { GameState._pendingDecision = null; Story.debug('offer', { due: 'story_harlow_offer' }); });
  ok(await advanceUntil('story_harlow_offer'), 'Bob’s offer arrives');
  const cash0 = await pg.evaluate(() => { const c = GameState.balance.cash; GameState.balance.cash = 2; GameState.revolver.limit = 5; return c; });
  await pg.evaluate(() => UI.openPendingDecision()); await wait(300);
  await pg.screenshot({ path: OUT + '/harlow_offer_hold.png' });
  const holdBtn = await pg.evaluate(() => !!document.querySelector('.decision-hold'));
  ok(holdBtn, 'cannot afford it: "Put it on hold" is offered');
  await pg.evaluate(() => document.querySelector('.decision-hold').click()); await wait(300);
  ok(await pg.evaluate(() => !GameState._pendingDecision && Inbox.heldItems().length === 1), 'on hold: Advance is free, the offer waits in the inbox');
  await adv();
  ok(await pg.evaluate(() => Inbox.heldItems().length === 1), 'still on hold after a quarter');
  await pg.evaluate(c => { GameState.balance.cash = c + 40; GameState.revolver.limit = 30; UI.renderAll(); }, cash0);
  const hid = await pg.evaluate(() => Inbox.heldItems()[0].id);
  await pg.evaluate(id => UI.openHeldDecision(id), hid); await wait(300);
  await pg.screenshot({ path: OUT + '/harlow_offer.png' });
  const pre = await pg.evaluate(() => ({ eq: GameState.balance.totalEquity }));
  await pg.evaluate(() => document.querySelectorAll('#modal-body .decision-choice')[0].click()); await wait(400); await pg.evaluate(() => UI.closeModal());
  const own = await pg.evaluate(() => ({ mine: GameState.portfolio.some(p => p.id === 'ind_hdc'), share: Tenants.shareOfMyRent('harlow_grocers'), h: Story.H().stage, bond: Directors.bondOf ? Directors.card('hassan').bond : null }));
  ok(own.mine && own.h === 'owned', 'bought: the centre is ours. Harlow = ' + own.share + '% of rent');

  // ---------------- Act 1: the slide, news, late rent
  await pg.evaluate(() => { const h = Story.H(); h.over = true; h.drift = -0.03; h.at = 0; });
  await adv();
  ok((await H()).stage === 'news', 'Act 1: Jenkins: Harlow growing too fast');
  await pg.evaluate(() => { Story.H().at = 0; }); await adv();
  const late = await H();
  ok(late.stage === 'late', 'late rent: Okafor writes, cover ' + (await pg.evaluate(() => GameState.tenants.harlow_grocers.coverage)));
  // round 11: Bob brings the loan to the board meeting; here we take the inbox route (the same card)
  await pg.evaluate(() => { Story.H().stage = 'ask'; Story.S().due = 'story_harlow_loan'; });

  // ---------------- Act 2: the loan
  ok(await advanceUntil('story_harlow_loan'), 'Act 2: Bob asks for $24M');
  if (REFUSE) {
    console.log('     ' + (await choose(1)).slice(0, 200));
    await pg.evaluate(() => { Story.H().refuseBustQ = 1; }); await adv();
    const r = await pg.evaluate(() => ({ h: Story.H(), bond: Directors.card('hassan').bond, st: GameState.tenants.harlow_grocers.status }));
    ok(r.h.result === 'bust' && r.st !== 'active' && r.bond && r.bond.pts < 0, 'refused: Harlow went bust on its own; Hassan ' + r.bond.label + ' (' + r.bond.why + ')');
    ok(!errs.length, 'no page errors ' + JSON.stringify(errs)); await b.close(); return;
  }
  const c1 = await pg.evaluate(() => GameState.balance.cash);
  console.log('     ' + (await choose(0, 'harlow_loan')).slice(0, 220));
  const ln = await pg.evaluate(() => ({ cash: GameState.balance.cash, other: Story.otherAssets(), loan: Story.H().loan, row: getComputedStyle(document.getElementById('bs-loans-row')).display }));
  ok(ln.loan && Math.abs(c1 - ln.cash - 24) < 0.01 && ln.other === 24 && ln.row !== 'none', 'lent $24M: on the balance sheet as "In tenants"');
  await pg.evaluate(() => { const t = GameState.tenants.harlow_grocers; t.coverage = 1.5; t.base = 1.5; Story.H().drift = 0; });
  await adv();
  const li = await pg.evaluate(() => ({ li: GameState.pnl.loanInterest, row: getComputedStyle(document.getElementById('pnl-loanint-row')).display }));
  ok(Math.abs(li.li - 0.6) < 0.01 && li.row !== 'none', 'interest $0.6M a quarter on the income statement');

  // ---------------- Act 3: a miss
  await pg.evaluate(() => { const t = GameState.tenants.harlow_grocers; t.coverage = 0.85; t.base = 0.85; });
  ok(await advanceUntil('story_harlow_miss', 2), 'Act 3: Harlow misses, Okafor vs Hassan');
  const pc0 = await pg.evaluate(() => GameState.board.politicalCapital);
  console.log('     ' + (await choose(1, 'harlow_miss')).slice(0, 200));
  ok((await pg.evaluate(() => GameState.board.politicalCapital)) === Math.min(8, pc0 + 1), 'Bob’s way: +1 political capital');

  // ---------------- Act 4
  if (HAPPY) {
    await pg.evaluate(() => { const t = GameState.tenants.harlow_grocers; t.coverage = 1.9; t.base = 1.9; Story.H().loan.due = 0; Story.H().loan.dueYear = null; });
    await dice(0.01); await adv(); await undice();
    const r = await H();
    ok(r.result === 'repaid' && !r.loan, 'maturity: repaid in full. Cash back, provision released');
  } else {
    await pg.evaluate(() => { const t = GameState.tenants.harlow_grocers; t.coverage = 0.9; t.base = 0.9; Story.H().loan.due = 0; Story.H().loan.dueYear = null; });
    await dice(0.995); await adv(); await undice();
    ok(await advanceUntil('story_harlow_default', 2), 'maturity: Harlow cannot pay');
    console.log('     ' + (await choose(1, 'harlow_default')).slice(0, 220));
    const prov = await H();
    ok(prov.loan && prov.loan.ext === 1 && prov.loan.prov >= 7.19, 'Bob’s way: one more year, 30% provided (' + prov.loan.prov + ')');
    const before = await pg.evaluate(() => ({ price: GameState.company.sharePrice, dc: GameState.portfolio.find(p => p.id === 'ind_hdc').currentValue, cash: GameState.balance.cash }));
    await pg.evaluate(() => { Story.H().loan.due = 0; Story.H().loan.dueYear = null; GameState.balance.cash += 60; });   // round 26: keep the Y4 bond repayable, so a default does not end the test early
    for (let i = 0; i < 3 && ['done', 'aftermath'].indexOf((await H()).stage) === -1; i++) {
      if ((await pendingId()) === 'story_harlow_miss') { console.log('     (3 misses in a row: asked again) ' + (await choose(1)).slice(0, 60)); continue; }
      await dice(0.995); await adv(); await undice();
    }
    const after = await pg.evaluate(() => ({ h: Story.H(), price: GameState.company.sharePrice, dc: GameState.portfolio.find(p => p.id === 'ind_hdc').currentValue,
      failed: GameState.tenants.harlow_grocers.status, other: Story.otherAssets(), msgs: GameState.inbox.items.filter(i => i.kind === 'message').slice(-2).map(i => i.title) }));
    ok(after.h.result === 'bust' && after.failed !== 'active' && after.other === 0, 'the extra year: bankrupt. ' + after.msgs.join(' / '));
    console.log('     price ' + before.price + ' -> ' + after.price + ', centre ' + before.dc + ' -> ' + after.dc + ', Hassan discredited: ' + after.h.hassanDiscredited);
    await pg.evaluate(() => { showView('board'); BoardTab.render(); }); await wait(300);
    await pg.screenshot({ path: OUT + '/harlow_board.png' });
    await pg.evaluate(() => showView('map'));
    // round 9: the bankruptcy is a pinned card, then the Asset Manager finds a tenant
    ok(await advanceUntil('story_harlow_after', 3), 'the bankruptcy arrives as a pinned card');
    console.log('     ' + (await choose(0, 'harlow_after')).slice(0, 160));
    await pg.evaluate(() => { Story.H().at = 0; });
    ok(await advanceUntil('story_harlow_relet', 3), 'a tenant for the empty centre');
    console.log('     ' + (await choose(0, 'harlow_relet')).slice(0, 160));
    for (let i = 0; i < 7 && (await H()).stage !== 'done'; i++) await adv();
    const rl = await pg.evaluate(() => { const p = GameState.portfolio.find(x => x.id === 'ind_hdc'); return { h: Story.H(), mine: !!p, occ: p && p.occupancy, noi: p && p.annualNOI, rf: p && p.rentFactor, t: p && GameState.tenants[p.lease.positions[0].t].name }; });
    if (!rl.mine) ok(rl.h.stage === 'done', 'the lenders forced a sale of the centre meanwhile; the story closed cleanly (' + rl.h.result + ')');
    else ok(rl.h.stage === 'done' && rl.occ === 1 && Math.abs(rl.noi - rl.h.ramp.full) < rl.h.ramp.full * 0.03 && rl.rf == null, 're-let to ' + rl.t + ': rent stepped up to full $' + rl.noi + 'M, 100% occupied');
  }
  // save + reload keeps the story
  await pg.evaluate(() => Save.save()); await pg.reload(); await wait(900);
  await pg.evaluate(() => document.getElementById('btn-continue').click()); await wait(800); await pg.evaluate(() => UI.closeModal());
  ok(await pg.evaluate(() => Story.H().stage === 'done'), 'after reload the story state survives');
  await adv();
  ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
