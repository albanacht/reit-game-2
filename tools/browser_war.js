/* browser_war.js — round 13, the Rennick war (STORY_RENNICK_DRAFT.md v4).
   Part "win" (default): Morrow Plaza in the city, the Year 5 auction (round 33) in the
   meeting, the leak card, the follow-up debate, a weapon from Rennick's
   profile, the audit card, the crisis (blocking his sales), the takeover.
   Part "lose": Kessler's stake, the pill, Voss joining, the hostile bid.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_war.js" <outdir> [win|lose] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const OUT = process.argv[2] || '/tmp', PART = process.argv[3] || 'win';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (/war|story/.test(m.text()) && m.type() === 'warning') errs.push('warn: ' + m.text()); });
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  await pg.goto(R); await wait(300); await pg.evaluate(() => localStorage.clear());
  await pg.evaluate(() => UI.newGame()); await wait(1500); await pg.evaluate(() => { UI.closeModal(); GameState.debtTranches.forEach(t => { t.maturityYear += 10; }); });   // round 35: the bond stop would pause the war's quarters
  const meetingUp = () => pg.evaluate(() => { const m = document.getElementById('meeting'); return !!m && !m.classList.contains('hidden'); });
  const clearCards = () => pg.evaluate(() => { for (let k = 0; k < 3 && GameState._pendingDecision; k++) { UI.openPendingDecision(); const c = document.querySelector('#modal-body .decision-choice:not(.decision-choice-disabled):not(.decision-hold)'); if (c) c.click(); else { GameState._pendingDecision = null; } } UI.closeModal(); });
  const advance = async () => { await clearCards(); await pg.click('#btn-advance-quarter'); await wait(900); await pg.evaluate(() => UI.closeModal()); };
  async function toMeeting(pre) {
    for (let i = 0; i < 6; i++) { if (await meetingUp()) return true; if (pre) await pg.evaluate(pre); await advance(); }
    return meetingUp();
  }
  async function through(choose, shots) {
    const seen = [];
    for (let step = 0; step < 80; step++) {
      await wait(150); await pg.evaluate(() => Meeting.flush()); await wait(80);
      const st = await pg.evaluate(() => ({ btns: [...document.querySelectorAll('#mt-actions .mt-btn')].map(b => ({ t: b.querySelector('b').textContent, dis: b.disabled })), prompt: (document.querySelector('#mt-actions .mt-prompt') || {}).textContent || '', log: document.getElementById('mt-chat') ? document.getElementById('mt-chat').textContent.slice(-1500) : '' }));
      if (!st.btns.length) continue;
      seen.push(st.log.slice(-1500) + ' :: ' + st.btns.map(x => x.t).join(' | '));
      if (shots && shots(st)) await pg.screenshot({ path: OUT + '/' + shots(st) + '.png' });
      const last = /^(Back to work|Leave the boardroom)/.test(st.btns[0].t);
      let i = choose(st.btns, st); if (i < 0 || !st.btns[i] || st.btns[i].dis) i = st.btns.findIndex(x => !x.dis);
      await pg.evaluate(i => document.querySelectorAll('#mt-actions .mt-btn')[i].click(), i);
      if (last) break;
    }
    return seen;
  }
  const find = (re) => (btns) => btns.findIndex(x => re.test(x.t) && !x.dis);
  const card = async (pick) => pg.evaluate((pick) => {
    const id = GameState._pendingDecision && GameState._pendingDecision.id;
    UI.openPendingDecision();
    const t = document.getElementById('modal-body').textContent;
    const cs = [...document.querySelectorAll('#modal-body .decision-choice')];
    const c = cs.find(x => new RegExp(pick).test(x.textContent) && !x.classList.contains('decision-choice-disabled'));
    if (c) c.click(); UI.closeModal();
    return { id, t: t.slice(0, 300), clicked: !!c };
  }, pick);
  const forceDue = async (key) => { await pg.evaluate(k => { const o = {}; o[k] = (GameState.meta.year - 1) * 4 + GameState.meta.quarter + 1; War.debug(o); }, key); await clearCards(); await pg.click('#btn-advance-quarter'); await wait(900); await pg.evaluate(() => UI.closeModal()); };

  if (PART === 'win') {
    ok(await pg.evaluate(() => { const p = GameState.cityRivals.find(x => x.id === 'off_mpz'); return !!p && p.owner === 'none' && /Jack Morrow/.test(p.ownerNote); }), 'Morrow Plaza is in the city, Jack’s, not for sale');
    // years 1 and 2: get through the meetings
    for (const y of [1, 2]) { ok(await toMeeting(), 'Year ' + y + ' meeting'); await through(find(/Not now|Stop|Decide later/)); }
    // round 33: Jack sells at the Year 5 meeting. Jump the clock to Year 5 Q3 (playing Years 3-4 passively is not the point here)
    await pg.evaluate(() => { GameState.meta.year = 5; GameState.meta.quarter = 3; GameState.meta.totalQuarters = 18; Story.S().due = null; GameState._pendingDecision = null; });
    // Year 5: the auction (round 33: was Year 3)
    await pg.evaluate(() => { GameState.balance.cash = 140; GameState.board.politicalCapital = 6; });
    ok(await toMeeting(), 'Year 5 meeting');
    await pg.evaluate(() => { window.__r = Math.random; });
    let s3 = await through(find(/^(Bid|Match)/), st => /Morrow Plaza/.test(st.log) && /Bid:/.test(st.btns.map(x => x.t).join()) ? 'war_auction' : null);
    if (await pg.evaluate(() => War.W().stage === 'wait')) {           // a Harlow cheque took the Year 5 meeting: Jack waits a year
      ok(!s3.some(x => /Jack Morrow is retiring/.test(x)), 'a Harlow cheque at Year 5, so the auction waits for Year 6');
      await pg.evaluate(() => { GameState.balance.cash = 140; GameState.board.politicalCapital = 6; });
      ok(await toMeeting(), 'Year 6 meeting');
      s3 = await through(find(/^(Bid|Match)/), st => /Morrow Plaza/.test(st.log) && /Bid:/.test(st.btns.map(x => x.t).join()) ? 'war_auction' : null);
    }
    ok(s3.some(x => /Jack Morrow is retiring/.test(x)), 'Chen raises Morrow Plaza, Jack is in the room');
    ok(s3.some(x => /Kessler raises|Kessler bids/.test(x)), 'Kessler bids against us, round by round');
    const w0 = await pg.evaluate(() => ({ st: War.W().stage, mine: GameState.portfolio.some(p => p.id === 'off_mpz'), jack: War.W().jack, bid: War.W().bid, max: War.W().max }));
    if (w0.st !== 'war') console.log(JSON.stringify(w0), JSON.stringify(await pg.evaluate(() => ({ w: War.W(), y: GameState.meta.year, sy: GameState.board._storyYear, m: !!GameState.cityRivals.find(x => x.id === 'off_mpz') }))), s3.slice(0, 8).join('\n'));
    ok(w0.st === 'war' && w0.mine, 'won Morrow Plaza for $' + w0.bid + 'M (Jack $' + w0.jack + 'M, Kessler stops at $' + w0.max + 'M); the war has begun');
    ok(s3.some(x => /seventh seat/.test(x)), 'Chen proposes a seventh seat for the war');
    const tx = await pg.evaluate(() => ({ in: Directors.has('tex'), n: GameState.board.directors.length, pc: GameState.board.politicalCapital }));
    ok(tx.in && tx.n >= 6, 'Tex nominated into the new seat (' + tx.n + ' directors, political capital left ' + tx.pc + ')');
    // the leak
    await forceDue('leakQ');
    let c = await card('Call the editor');
    ok(c.id === 'war_leak' && c.clicked, 'the leak card: ' + c.t.slice(0, 90));
    // next meeting: hold fire or hit back
    await pg.evaluate(() => { GameState.board.politicalCapital = 6; });
    ok(await toMeeting(), 'the next meeting');
    const s4 = await through(find(/Hit back now|Not now/), st => /Stop the headlines/.test(st.log) ? 'war_debate' : null);
    ok(s4.some(x => /Stop the headlines/.test(x)), 'Petrova vs Chen in the room');
    ok(await pg.evaluate(() => War.W().freeShot), 'hit back: the next weapon is free');
    // a weapon from Rennick's profile
    await pg.evaluate(() => { showView('board'); Rivals.openProfile('ren'); }); await wait(300);
    await pg.screenshot({ path: OUT + '/war_profile.png' });
    const pc0 = await pg.evaluate(() => GameState.board.politicalCapital);
    await pg.evaluate(() => { const bt = document.querySelector('#modal-overlay .war-btn[data-war="squeeze"]'); if (bt) bt.click(); }); await wait(300);
    const sq = await pg.evaluate(() => ({ s: War.spreadFor('ren'), pc: GameState.board.politicalCapital, free: War.W().freeShot }));
    ok(sq.s > 0 && sq.pc === pc0 && !sq.free, 'the bank squeeze from his profile, free: his borrowing +' + sq.s + '%');
    await pg.evaluate(() => { UI.closeModal(); showView('map'); });
    // the audit
    const px0 = await pg.evaluate(() => GameState.portfolio.reduce((a, p) => a + (p.baseValue || 0), 0));
    await forceDue('auditQ');
    c = await card('Take it');
    const px1 = await pg.evaluate(() => GameState.portfolio.reduce((a, p) => a + (p.baseValue || 0), 0));
    ok(c.id === 'war_audit' && c.clicked && px1 < px0, 'the audit card, taken: buildings marked down ' + (px0 - px1).toFixed(1) + 'M');
    ok(await toMeeting(), 'Year 5 meeting');
    const s5 = await through(find(/Okafor/), st => /hit him back|banking friends/.test(st.log) ? 'war_hitback' : null);
    ok(s5.some(x => /banking friends/.test(x)), '"how do we hit him back": the board argues it out');
    // the crisis: block his sales
    await pg.evaluate(() => { const r = GameState.rivals.ren; r.debt = Rivals.value('ren') * 0.68; GameState.board.politicalCapital = 6; });
    await advance();
    const cr = await pg.evaluate(() => ({ st: War.W().stage, d: Rivals.d2a('ren'), lc: GameState.rivals.ren.lowCover, end: War.W().ending }));
    ok(cr.st === 'crisis', 'Rennick cracks: crisis stage, Chen’s letter ' + JSON.stringify(cr));
    await pg.evaluate(() => { showView('board'); Rivals.openProfile('ren'); }); await wait(300);
    await pg.evaluate(() => { const bt = document.querySelector('#modal-overlay .war-btn[data-war="block"]'); if (bt) bt.click(); }); await wait(300);
    await pg.screenshot({ path: OUT + '/war_crisis_profile.png' });
    const blk = await pg.evaluate(() => { UI.closeModal(); const out = [], p = Rivals.bldg('ren')[0], pc = GameState.board.politicalCapital; const r = War.blockSale('ren', p, out); return { r, d: pc - GameState.board.politicalCapital, n: War.W().blocked, t: out[0] && out[0].text }; });
    ok(blk.r && blk.d === 1 && blk.n === 1, 'blocked a sale for 1 political capital: ' + blk.t);
    // the takeover
    await pg.evaluate(() => { const r = GameState.rivals.ren; r.debt = Rivals.value('ren') * 0.5; r.price = 0.45 * (Rivals.value('ren') + r.cash - r.debt) / r.shares; GameState.board.politicalCapital = 6; GameState.board.directors.forEach(d => d.attitude = 7); });
    const before = await pg.evaluate(() => ({ n: GameState.portfolio.length, k: Rivals.bldg('ren').length, sh: GameState.company.sharesOutstanding }));
    ok(await toMeeting(() => { const r = GameState.rivals.ren; r.debt = Rivals.value('ren') * 0.5; r.price = 0.45 * (Rivals.value('ren') + r.cash - r.debt) / r.shares; r.startPrice = r.price; r.hist.forEach(h => h.price = r.price); }), 'Year 6 meeting');
    await pg.evaluate(() => { Math.random = () => 0.01; });
    const s6 = await through(find(/Half shares/), st => /buy the whole company/.test(st.log) ? 'war_takeover' : null);
    await pg.evaluate(() => { Math.random = window.__r; });
    const after = await pg.evaluate(() => ({ n: GameState.portfolio.length, gone: GameState.rivals.ren.gone, end: War.W().ending, sh: GameState.company.sharesOutstanding, pend: (GameState.ceo && GameState.ceo.pending || []).length, lg: Rivals.league(4).map(x => x.key || x.k || x.name).join(',') }));
    ok(s6.some(x => /buy the whole company/.test(x)), 'Chen moves the takeover; Voss is in the room');
    ok(after.gone && after.end === 'takeover' && after.n >= before.n + before.k, 'Rennick is ours: ' + before.k + ' buildings joined (' + before.n + ' → ' + after.n + '), shares ' + before.sh + 'M → ' + after.sh + 'M');
    ok(!/ren/.test(after.lg), 'Rennick is out of the league: ' + after.lg);
    const snap = () => pg.evaluate(() => { const G = GameState; return JSON.stringify({ q: G.meta.totalQuarters, px: G.company.sharePrice, nav: G.ratios.navPerShare, sh: G.company.sharesOutstanding, cash: G.balance.cash, td: G.balance.totalDebt, d2a: G.ratios.debtToAssets, pv: Math.round(G.portfolio.reduce((a,p)=>a+p.currentValue,0)), dps: G.company.dividendPerShare, rating: G.credit.rating, prob: G.board.probation }); });
    console.log('  after takeover', await snap());
    for (let i = 0; i < 4; i++) { await advance(); console.log('  ', await snap()); }
    ok(await pg.evaluate(() => GameState.balance.totalAssets > 0 && isFinite(GameState.company.sharePrice)), 'four more quarters run after the takeover (price $' + await pg.evaluate(() => GameState.company.sharePrice) + ')');
  } else {
    // the losing side: no auction, put the war straight on
    await pg.evaluate(() => { War.debug({ stage: 'war', leaked: true, audited: true, leakTalked: true, auditTalked: true, jabQ: 999 }); });
    const q = await pg.evaluate(() => { const G = GameState; G.ratios.debtToAssets = 0.58; G.company.sharePrice = G.ratios.navPerShare * 0.5; const out = []; for (let i = 0; i < 3; i++) War.processQuarter(out); return { st: War.W().stake, due: Story.S().due }; });
    ok(q.st >= 5 && q.due === 'war_stake', 'weak and cheap: Kessler builds ' + q.st + '% and the 5% card is due');
    await pg.evaluate(() => { GameState._pendingDecision = null; Story.S().due = 'war_stake'; GameState.board.politicalCapital = 6; });
    await advance();
    const c = await card('friendly investor');
    ok(c.id === 'war_stake' && c.clicked, 'the 5% card, answered with a friendly investor: stake now ' + await pg.evaluate(() => War.W().stake));
    // the meeting: the pill, then Kessler's seat demand
    await pg.evaluate(() => { War.debug({ stake: 11 }); GameState.board.politicalCapital = 6; });
    ok(await toMeeting(), 'meeting');
    const sA = await through(find(/Adopt the rights plan|Refuse/), st => /rights plan/.test(st.log) ? 'war_pill' : null);
    if (!sA.some(x => /rights plan/.test(x))) console.log(sA.map(x => x.slice(-300)).join('\n---\n'), JSON.stringify(await pg.evaluate(() => War.W())));
    ok(sA.some(x => /rights plan/.test(x)) && await pg.evaluate(() => !!War.W().pillUntil), 'the rights plan adopted in the room');
    ok(sA.some(x => /seat for Dale Voss/.test(x)), 'Kessler demands a seat at 10%');
    const cap = await pg.evaluate(() => { const G = GameState; G.ratios.debtToAssets = 0.58; G.company.sharePrice = G.ratios.navPerShare * 0.5; War.debug({ stake: 14 }); for (let i = 0; i < 4; i++) War.processQuarter([]); return War.W().stake; });
    ok(cap <= 14.9, 'the pill caps him at 14.9% (' + cap + '%)');
    // no pill: 15% puts Voss on our board
    const v = await pg.evaluate(() => { War.debug({ pillUntil: null, stake: 14, pauseUntil: 0 }); const G = GameState; G.ratios.debtToAssets = 0.58; G.company.sharePrice = G.ratios.navPerShare * 0.5; const out = []; for (let i = 0; i < 2; i++) War.processQuarter(out); return { st: War.W().stake, in: Directors.has('voss'), out: out.map(o => o.text).join(' ') }; });
    ok(v.in, 'at ' + v.st + '% Dale Voss joins our board: ' + v.out);
    ok(await pg.evaluate(() => Directors.votesAgainst('voss')), 'Voss votes against us');
    // the hostile bid: a friendly board rejects it, a hostile board ends the run
    const r1 = await pg.evaluate(() => { War.debug({ stake: 21, bidVoted: false }); GameState.board.directors.forEach(d => d.attitude = 7); const it = War.agenda(GameState.meta.year, []).find(x => /20% premium/.test(JSON.stringify(x.lines))); return it ? it.effect() : 'no item'; });
    ok(/rejected/.test(r1), 'friendly board: ' + r1);
    const r2 = await pg.evaluate(() => { War.debug({ stake: 21, bidVoted: false }); GameState.board.directors.forEach(d => d.attitude = 3); const it = War.agenda(GameState.meta.year, []).find(x => /20% premium/.test(JSON.stringify(x.lines))); const m = it ? it.effect() : 'no item'; return { m, over: GameState.meta.gameOver, end: War.W().ending }; });
    ok(r2.over && r2.end === 'prey', 'hostile board: "the prey", game over: ' + r2.m);
  }
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
