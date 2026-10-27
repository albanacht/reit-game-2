/* browser_round17.js — playtest round 17: rating and base rate on the HUD,
   Year 1 dividend grace, the credit line dearer than bonds, preferred shares
   on every big cheque, macro news cards in the inbox, demands that say how.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round17.js" <outdir> */
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
  await pg.evaluate(() => UI.newGame()); await wait(1500); await pg.evaluate(() => UI.closeModal());
  const hud = await pg.evaluate(() => { const t = document.body.innerText, a = t.match(/Rating . base rate\s*\n?\s*\S+ . [\d.]+%/i); return a ? [a[0]] : null; });
  ok(!!hud, 'HUD shows ' + (hud ? hud.join(' and ').replace(/\n/g, ' ') : 'nothing'));
  // Year 1: Williams is not judged on the dividend
  const advance = async n => { for (let i = 0; i < n; i++) { await pg.evaluate(() => { GameState._pendingDecision = null; UI.closeModal(); const m = document.getElementById('meeting'); if (m && !m.classList.contains('hidden')) Meeting.close(); }); await pg.click('#btn-advance-quarter'); await wait(700); } await pg.evaluate(() => UI.closeModal()); };
  await advance(3);
  const w = await pg.evaluate(() => ({ cause: Directors.card('williams').cause, mood: Directors.card('williams').attitude }));
  ok(!/no dividend rise/.test(w.cause), 'Year 1 Q3: Williams does not ask for a dividend rise yet (mood ' + w.mood.toFixed(1) + ', ' + (w.cause || 'no complaint') + ')');
  // the credit line costs more than bonds
  const rates = await pg.evaluate(() => ({ line: Revolver.rate(), b7: Financials.getCurrentBorrowingRateForTerm(7), b3: Financials.getCurrentBorrowingRateForTerm(3) }));
  ok(rates.line > rates.b7 + 1, 'credit line ' + rates.line + '% vs 7 year bonds ' + rates.b7 + '% (3 year ' + rates.b3 + '%)');
  // the CFO is found under its old name too
  const cfo = await pg.evaluate(() => { GameState.staff.push({ roleId: 'cfo', name: 'Test CFO', salary: 0.3, traits: [] }); const r = Staff.hasRole('financial'); GameState.staff = GameState.staff.filter(s => s.name !== 'Test CFO'); return r; });
  ok(cfo, 'a hired CFO now unlocks the covenant amendment and bridge lending (old "financial" checks)');
  // preferred shares on Bob's offer, with no cash
  const harlow = await pg.evaluate(() => { GameState.balance.cash = 0; Story.H().stage = 'offer'; const c = World.DECISIONS.find(x => x.id === 'story_harlow_offer').build(); const ch = c.choices.find(x => /preferred/.test(x.label) && (!x.check || x.check()));   // round 27: the first that works (alone, or split with bonds)
    const p0 = GameState.preferred.outstanding || 0; const m = ch && (!ch.check || ch.check()) ? ch.apply() : null;
    return { labels: c.choices.map(x => x.label), m, pref: (GameState.preferred.outstanding || 0) - p0, mine: GameState.portfolio.some(p => p.id === 'ind_hdc') }; });
  ok(harlow.mine && harlow.pref > 20, 'Bob’s offer paid with preferred shares: +$' + harlow.pref.toFixed(1) + 'M preferred (' + harlow.labels.join(' | ') + ')');
  const loan = await pg.evaluate(() => { Story.H().stage = 'ask'; const c = World.DECISIONS.find(x => x.id === 'story_harlow_loan').build(); return c ? c.choices.map(x => x.label).join(' | ') : 'none'; });
  ok(/preferred/.test(loan), 'Bob’s loan: ' + loan);
  // Jack's auction, no cash: raise preferred and stay in
  const morrow = await pg.evaluate(() => { GameState.preferred.outstanding = 0; GameState.preferred.issued = false; GameState.balance.cash = -25; GameState.revolver && (GameState.revolver.limit = 25); War.debug({ stage: 'wait' }); const items = War.agenda(5, []); const auc = items.find(i => i.choices && /^(Bid|Match)/.test(i.choices[0].label));
    const labels = auc ? auc.choices.map(c => c.label + (c.disabled ? ' [locked]' : '')) : []; const pc = auc && auc.choices.find(c => /preferred/.test(c.label) && !c.disabled); const m = pc ? pc.go() : null; const again = items[items.length - 1];
    return { labels, m, bidOk: again && again.choices && !again.choices[0].disabled }; });
  ok(morrow.labels.some(l => /preferred/.test(l)) && morrow.bidOk, 'Morrow Plaza without cash: ' + morrow.labels.join(' | ') + ' → then the bid opens');
  const port = await pg.evaluate(() => { const b = GameState.cityRivals.find(x => x.id === 'ind_02'); Port.debug({ stage: 'offer' }); const c = World.DECISIONS.find(x => x.id === 'port_offer').build(); return c ? c.choices.map(x => x.label).join(' | ') : 'none'; });
  ok(/preferred/.test(port), 'Port Logistics offer: ' + port);
  // macro news in the inbox: play until the central bank moves
  let macro = null;
  for (let i = 0; i < 16 && !macro; i++) { await advance(1); macro = await pg.evaluate(() => { const el = document.querySelector('.ib-macro'); return el ? el.innerText.replace(/\n+/g, ' | ').slice(0, 260) : null; }); }
  ok(!!macro, 'an economy headline in the inbox: ' + macro);
  if (macro) { await pg.evaluate(() => document.querySelector('.ib-macro').scrollIntoView()); await pg.screenshot({ path: OUT + '/r17_macro.png' }); }
  // round 17b: preferred shares are event-only, board-approved, priced off the base rate, callable after 5 years
  const pf = await pg.evaluate(() => { const G = GameState; G.preferred = { outstanding: 0, shares: 0, parValue: 25, dividendRate: 0, issued: false };
    G.staff.push({ roleId: 'cfo', name: 'Test CFO', salary: 0.3, traits: [], skill: 5 }); G.balance.cash = 5; G._preferredOffered = false;
    let life = null; for (let i = 0; i < 20; i++) { const e = Decisions.checkForEvent(); if (e && e.id === 'preferred_offer') life = e; }
    const want = Math.round((G.market.baseInterestRate + G.credit.spread + (Arc.spreadAdd ? Arc.spreadAdd() : 0) + 2.5) * 100) / 10000;
    const r = Financials.issuePreferredFor(10, 'test'); const s = Financials.prefList()[0];
    const early = Financials.redeemSeries(s.id); G.meta.totalQuarters += 20; G.balance.cash = 50; const late = Financials.redeemSeries(s.id);
    const ch = G.board.directors.find(d => d.id === Directors.chair()); const a0 = ch.attitude; ch.attitude = 1.5; const blocked = !Financials.prefBoardOK(); ch.attitude = a0;
    G.meta.totalQuarters -= 20;
    ch.attitude = 6; Story.H().stage = 'offer'; const card = World.DECISIONS.find(x => x.id === 'story_harlow_offer').build();
    return { life: !!life, rate: s.rate, want, early: early.success, earlyMsg: early.message, late: late.success, blocked, debate: /Not another dollar of debt/.test(card.body) && /board approves it/.test(card.body), body: String(card.body).slice(-300) }; });
  ok(!pf.life, 'the CFO\u2019s standing preferred offer is retired');
  ok(Math.abs(pf.rate - pf.want) < 0.0001, 'coupon = base rate + our spread + 2.5%: ' + (pf.rate * 100).toFixed(2) + '%');
  ok(!pf.early && pf.late, 'not callable in the first 5 years (' + pf.earlyMsg + '); callable after');
  ok(pf.blocked, 'a furious chairman (round 32: only furious) will not approve preferred shares');
  if (!pf.debate) console.log(pf.body);
  ok(pf.debate, 'Bob\u2019s offer card carries the board\u2019s exchange: Okafor says no to debt, Hassan suggests preferred shares, the chair approves');
  // demands say how
  const how = await pg.evaluate(() => { const m = { directorId: 'chen', metric: 'accretiveBuysThisYear', target: 1, higher: true, text: 'x' }; return Board.mandateNumbers(m).how; });
  ok(/yield/.test(how), 'demands say how: "' + how + '"');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
