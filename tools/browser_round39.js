/* browser_round39.js — round 39: Hassan resigns after a Harlow bust (unless
   Gary's Family Groceries kept the stores open), Tex's term is not charged when
   his reputation is below the line, never more than 4 options on a card, the
   last meeting sets no demands, and as executive chairman you get tributes, no
   vote, and one demand a year before that.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round39.js" [outdir] */
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const R = 'file:///sessions/relaxed-zealous-gauss/mnt/REIT 2.0/reit-game-2/index.html';
const OUT = process.argv[2] || '/tmp';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: [...chromium.args, '--allow-file-access-from-files'], executablePath: await chromium.executablePath(), headless: true });
  const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'warning') errs.push('warn: ' + m.text()); });
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  const fresh = () => pg.evaluate(() => { localStorage.clear(); UI.newGame(); UI.closeModal(); Story.S().due = null; GameState._pendingDecision = null; GameState.debtTranches.forEach(t => { t.maturityYear += 12; }); });
  const meetingUp = () => pg.evaluate(() => { const m = document.getElementById('meeting'); return !!m && !m.classList.contains('hidden'); });
  /* open the meeting for the year just ended and click through; choose(prompt, labels) picks a button */
  async function meet(choose) {
    await pg.evaluate(() => { GameState.board._meetingYear = 0; GameState.board._departYear = null; GameState.board._storyYear = null; GameState.board._demandsYear = null; GameState.board._personalYear = null; Meeting.open(); });
    const steps = [];
    for (let s = 0; s < 150 && await meetingUp(); s++) {
      await wait(120); await pg.evaluate(() => Meeting.flush()); await wait(60);
      const btns = await pg.evaluate(() => [...document.querySelectorAll('#mt-actions .mt-btn')].map(b => ({ t: b.querySelector('b').textContent, dis: b.disabled })));
      if (!btns.length) continue;
      const prompt = await pg.evaluate(() => (document.querySelector('#mt-actions .mt-prompt') || {}).textContent || '');
      steps.push(btns.map(x => x.t).join(' / '));
      const back = btns.findIndex(x => /^Back to work/.test(x.t));
      let i = back > -1 ? back : (choose ? choose(prompt, btns.map(x => x.t)) : -1);
      if (i == null || i < 0 || !btns[i] || btns[i].dis) i = btns.findIndex(x => !x.dis && !/Resign/.test(x.t));
      await pg.evaluate(i => document.querySelectorAll('#mt-actions .mt-btn')[i].click(), i);
      if (back > -1) break;
    }
    const chat = await pg.evaluate(() => [...document.querySelectorAll('#mt-chat .mt-line, #mt-chat .mt-note')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' || '));
    if (await meetingUp()) await pg.evaluate(() => Meeting.close());
    return { steps, chat };
  }
  const bust = rescue => pg.evaluate(rescue => {
    const G = GameState; Story.S().due = null; G._pendingDecision = null; Levi.debug({ stage: 'passed' }); Gary.S().stage = 'tender';
    G.meta.year = 5; G.meta.quarter = 1; G.meta.totalQuarters = 16; G.balance.cash = 250;
    Story.debug('offer', { due: 'story_harlow_offer' }); World.DECISIONS.find(x => x.id === 'story_harlow_offer').build().choices.find(c => /^Buy it for/.test(c.label) && !/preferred/.test(c.label)).apply(); Story.S().due = null;
    Story.debug('ask', { due: 'story_harlow_loan' }); World.DECISIONS.find(x => x.id === 'story_harlow_loan').build().choices.find(c => /^Lend/.test(c.label) && !/preferred/.test(c.label)).apply(); Story.S().due = null;
    Story.debugBust('ran out of cash'); const card = World.DECISIONS.find(x => x.id === 'story_harlow_after').build();
    const labels = card.choices.map(c => c.label); const c = card.choices.find(x => new RegExp(rescue).test(x.label)); const msg = c ? c.apply() : 'no ' + rescue; Story.S().due = null; G._pendingDecision = null;
    if (Directors.has('hassan') && Directors.rep('hassan') < 40) Directors.repChange('hassan', 50 - Directors.rep('hassan'), 'test');   // well above the line
    return { labels, msg, hassan: Directors.has('hassan'), rescue: Story.H().rescue };
  }, rescue.source);

  await pg.goto(R); await wait(300);

  // 1. never more than 4 options: the cards that had more, and a sweep of every card that builds
  await fresh();
  const cnt = await pg.evaluate(() => { const G = GameState, out = {};
    G.balance.cash = 300; G.board.politicalCapital = 6;
    const Y = Gary.Y(); Y.stage = 'offer'; Y.value = Y.value || 10; out.yard = World.DECISIONS.find(x => x.id === 'gary_yard').build().choices.length;
    const M = Mayor.M ? Mayor.M() : null; if (M) { M.stage = 'offer'; M.bld = G.portfolio[0].id; const k = World.DECISIONS.find(x => x.id === 'mayor_offer').build(); out.mayor = k ? k.choices.length : 'none'; M.stage = 'none'; }
    Y.stage = 'none';
    const big = []; World.DECISIONS.forEach(d => { let k = null; try { k = d.build(); } catch (e) {} if (k && k.choices && k.choices.length > 4) big.push(d.id + ':' + k.choices.length); });
    out.big = big; return out; });
  ok(cnt.yard === 4 && (cnt.mayor === 4 || cnt.mayor === 'none') && !cnt.big.length, 'at most 4 options: Gary’s yard ' + cnt.yard + ', the mayor ' + cnt.mayor + '; every card that builds now: ' + (cnt.big.join(', ') || 'none over 4'));
  const hold = await pg.evaluate(() => { const G = GameState, Y = Gary.Y(); Y.stage = 'offer'; G.balance.cash = 0; G.revolver && (G.revolver.limit = 0);
    G._pendingDecision = World.DECISIONS.find(x => x.id === 'gary_yard').build(); Object.assign(G._pendingDecision, { id: 'gary_yard', isWorld: true, headline: 'x', holdQ: 0 });
    UI.openPendingDecision(); const n = document.querySelectorAll('#modal-body .decision-choice').length, h = !!document.querySelector('.decision-hold'); UI.closeModal(); G._pendingDecision = null; Y.stage = 'none'; return { n, h }; });
  ok(hold.n === 4 && !hold.h, 'the yard card on screen: ' + hold.n + ' options, no "on hold"');

  // 2. Hassan after the bust: CFO rescue or marketing it ourselves → he offers to resign; Gary's takeover → he stays
  await fresh();
  let bs = await bust(/Market it ourselves/);
  ok(bs.labels.length <= 4 && bs.hassan, 'the bust card: [' + bs.labels.map(x => x.slice(0, 34)).join(' | ') + ']');
  let m = await meet((p, L) => L.findIndex(x => /^Let Hassan go/.test(x)));
  const hs = await pg.evaluate(() => Directors.has('hassan'));
  ok(/Hassan has offered his resignation/.test(m.chat) && /brought Bob Harlow to this board/.test(m.chat) && !hs, 'marketed it ourselves: Hassan offered to resign at reputation 50 and left');
  await fresh();
  bs = await bust(/Gary runs it/);
  m = await meet(() => 0);
  ok(bs.rescue === 'family' && !/Hassan has offered his resignation/.test(m.chat) && await pg.evaluate(() => Directors.has('hassan')), 'Gary’s Family Groceries kept the stores open: Hassan stays');

  // 3. Tex's term with his reputation below the line: no renewal charge, the save renews it
  await fresh();
  const tx = await pg.evaluate(() => { const G = GameState, b = G.board; G.meta.year = 6; G.meta.totalQuarters = 21; Directors.addDirector('tex', 6); b.texMeetings = 2; b.politicalCapital = 3;
    Directors.repChange('tex', 25 - Directors.rep('tex'), 'test'); window.__earn = Board.earnPoliticalCapital; Board.earnPoliticalCapital = () => []; return true; });
  m = await meet((p, L) => L.findIndex(x => /^Save Tex/.test(x)));
  const t2 = await pg.evaluate(() => { Board.earnPoliticalCapital = window.__earn; return { has: Directors.has('tex'), rep: Directors.rep('tex'), pc: GameState.board.politicalCapital }; });
  ok(/no renewal charge/.test(m.chat) && t2.has && t2.rep >= 35 && t2.pc === 1, 'Tex at 25 at his renewal: no charge, saved for 2 (capital 3 → ' + t2.pc + ', reputation ' + t2.rep + ')');

  // 4. the last meeting: no demands, a closing line each, then the vote
  await fresh();
  await pg.evaluate(() => { const G = GameState; G.meta.year = 15; G.meta.quarter = 1; G.meta.totalQuarters = 57; G.board.probation = null; Directors.refresh(); });
  m = await meet(() => 0);
  const md = await pg.evaluate(() => (GameState.board.activeMandates || []).length);
  ok(/The last meeting/.test(m.chat) && /One more year. Don/.test(m.chat) && /Now, the vote/.test(m.chat) && md === 0, 'the last meeting: no demands (' + md + '), Okafor’s closing line, then the vote');

  // 5. the last meeting as executive chairman: tributes, no vote
  await fresh();
  await pg.evaluate(() => { const G = GameState; G.meta.year = 15; G.meta.quarter = 1; G.meta.totalQuarters = 57; G.board.chair = 'you'; Directors.refresh(); });
  m = await meet(() => 0);
  ok(/The balance sheet disagrees with me/.test(m.chat) && !/Now, the vote/.test(m.chat) && /Meeting closed/.test(m.chat), 'chairman at the last meeting: tributes ("' + ((m.chat.match(/I disagreed[^|]*/) || [''])[0]).trim() + '"), no vote');

  // 6. executive chairman before that: one demand a year
  await fresh();
  await pg.evaluate(() => { const G = GameState; G.meta.year = 13; G.meta.quarter = 1; G.meta.totalQuarters = 49; G.board.chair = 'you'; Directors.refresh(); });
  m = await meet(() => 0);
  const n1 = await pg.evaluate(() => (GameState.board.activeMandates || []).length);
  ok(n1 <= 1 && /one demand from the board|No demands from the board/.test(m.chat), 'chairman in Year 12: ' + n1 + ' demand');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
