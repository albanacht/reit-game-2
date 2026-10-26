/* browser_round22.js — round 22: the Dealroom. Offers on any building (yes,
   counter, no, a bidding war, the war ban, the Acquisitions Lead), land
   auctions (the reserved tower lot, win, build, pre-let, open, lease up; a
   lot lost to a rival who builds on it), agents on cases (story and deals),
   PR campaigns, IR softening bad news, staff fixes, the Dealroom tab.
   Math.random is pinned where a branch must be forced.
   Run: cd /tmp/pp && NODE_PATH=/tmp/pp/node_modules node "<repo>/tools/browser_round22.js" [outdir] */
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
  await pg.evaluate(() => UI.newGame()); await wait(1200); await pg.evaluate(() => UI.closeModal());
  await pg.evaluate(() => {
    window.__R = Math.random;
    window.__pin = v => { Math.random = () => v; }; window.__unpin = () => { Math.random = window.__R; };
    // one quarter; any card that comes up is answered by `pick` (a label regexp) or its first choice
    window.__q = (pick) => { const G = GameState; Financials.runQuarter(); Board.evaluateQuarter(); const s = Story.S(); const seen = [];
      for (let i = 0; i < 3 && s.due; i++) { const c = World.systemDecision(); if (!c) break; seen.push(c.id); let k = 0; if (pick) { const j = c.choices.findIndex(x => pick.test(x.label)); if (j > -1) k = j; } World.applyChoice(c, k); if (s.due === c.id) s.due = null; }
      G._pendingDecision = null; return seen; };
    GameState.balance.cash = 300; GameState.board.politicalCapital = 8;
  });

  // 1. a private building nobody is selling takes an offer, not a click-to-buy
  const m = await pg.evaluate(() => { const p = GameState.propertyMarket.find(x => !x.listedByOwner && !Deals.blocked(x.id)); UI.confirmBuyProperty(p.id);
    const t = document.getElementById('modal-title').textContent, odds = (document.getElementById('dl-odds') || {}).textContent || '';
    const r = document.getElementById('dl-r'); r.value = 85; r.oninput(); const low = document.getElementById('dl-odds').textContent; r.value = 130; r.oninput(); const high = document.getElementById('dl-odds').textContent;
    UI.closeModal(); return { t, odds, low, high, id: p.id }; });
  ok(/Make an offer/.test(m.t) && /yes \d+%/.test(m.odds), 'clicking a private building opens an offer: "' + m.odds.slice(0, 120) + '"');
  ok(/yes 0%/.test(m.low) && /yes 100%/.test(m.high), 'the odds move with the price (85%: "' + m.low.slice(0, 40) + '", 130%: "' + m.high.slice(0, 40) + '")');

  // 2. accepted (pinned: no second bidder, their price exactly as quoted)
  const a = await pg.evaluate(id => { const q = Deals.quote(id); __pin(0.5); const r = Deals.offer(id, q.rb * 1.01); __q(); __unpin();
    const d = Deals.D().list.find(x => x.pid === id); return { r: r.message, stage: d.stage, mine: GameState.portfolio.some(p => p.id === id), msg: GameState.inbox.items.slice(-6).map(i => i.title).join(' | ') }; }, m.id);
  ok(a.stage === 'won' && a.mine, 'offer at their price: accepted, the building is ours (' + a.msg.slice(0, 120) + ')');

  // 3. a counter, then a no with a cooldown
  const c = await pg.evaluate(() => { const p = GameState.propertyMarket.find(x => !x.listedByOwner && !Deals.blocked(x.id)), q = Deals.quote(p.id);
    __pin(0.5); Deals.offer(p.id, q.rb * 0.97); const seen = __q(/Walk/); __unpin(); const d = Deals.D().list.find(x => x.pid === p.id);
    const p2 = GameState.propertyMarket.find(x => !x.listedByOwner && !Deals.blocked(x.id)), q2 = Deals.quote(p2.id);
    __pin(0.5); Deals.offer(p2.id, q2.value * 0.85); __q(); __unpin(); const d2 = Deals.D().list.find(x => x.pid === p2.id);
    return { seen, stage: d.stage, counter: d.counter, rb: q.rb, st2: d2.stage, res2: d2.result, blk: Deals.blocked(p2.id) }; });
  ok(c.seen.indexOf('deal_counter') > -1 && Math.abs(c.counter - c.rb) < 0.2 && c.stage === 'lost', 'offer 3% under: a counter at $' + c.counter + 'M (we walked)');
  ok(c.st2 === 'lost' && /Try again from/.test(c.blk), 'offer at 85% of value: no ("' + c.res2 + '"), then "' + c.blk + '"');

  // 4. a bidding war on a private sale (pinned low: the second bidder appears)
  const bw = await pg.evaluate(() => { const p = GameState.propertyMarket.find(x => !x.listedByOwner && !Deals.blocked(x.id)), q = Deals.quote(p.id);
    Deals.offer(p.id, q.rb * 1.06); __pin(0.1); const seen = __q(/Raise/); __unpin(); const d = Deals.D().list.find(x => x.pid === p.id);
    return { seen, stage: d.stage, rival: d.rival, bid: d.rivalBid, paid: d.paid }; });
  ok(bw.seen.indexOf('deal_rival') > -1 && bw.stage === 'won' && bw.paid > bw.bid, 'a second bidder (' + bw.rival + ' at $' + bw.bid + 'M): we raised and won at $' + bw.paid + 'M');

  // 5. a rival's building: their markup, the Acquisitions Lead, the war ban
  const rv = await pg.evaluate(() => { const G = GameState, p = G.cityRivals.find(x => x.owner !== 'ren' && !Deals.blocked(x.id)); if (!p) return { none: G.cityRivals.map(x => x.owner + ':' + Deals.blocked(x.id)).join(' ') };
    const own = p.owner, q0 = Deals.quote(p.id); const cash0 = G.rivals[own].cash;
    G.staff.push({ roleId: 'acquisitions', title: 'Acquisitions Lead', name: 'Test Lead', salary: 0.5, skill: 8, traitId: null, portrait: 's01.jpg' });
    const q1 = Deals.quote(p.id);
    __pin(0.5); Deals.offer(p.id, q1.rb * 1.01); __q(); __unpin();
    const won = G.portfolio.some(x => x.id === p.id), cash1 = G.rivals[own].cash;
    const ren = G.cityRivals.find(x => x.owner === 'ren'); War.W().stage = 'war'; const blk = Deals.blocked(ren.id); War.W().stage = 'wait';
    return { owner: own, m0: q0.m, m1: q1.m, won, cashUp: cash1 > cash0, blk, why: q0.why.join('; ') }; });
  if (rv.none) console.log('      no rival building: ' + rv.none);
  ok(rv.m0 >= 0.15, 'a rival wants ' + Math.round(rv.m0 * 100) + '% over value (' + rv.why + ')');
  ok(rv.m1 < rv.m0 - 0.05, 'with a skilled Acquisitions Lead: ' + Math.round(rv.m1 * 100) + '% over value');
  ok(rv.won && rv.cashUp, 'bought from ' + rv.owner + '; their books got the money');
  ok(/doorknob/.test(rv.blk), 'Rennick at war: "' + rv.blk + '"');

  // 6. land: the reserved tower lot, then win, plan, build, pre-let, open, lease up
  const l = await pg.evaluate(() => { const G = GameState, out = {};
    out.rsv = Deals.bid('lot_01', 50).message;
    __pin(0.99); out.bid = Deals.bid('lot_02', 9).message; out.seen = __q(/standard/i); __unpin();
    const dev = Deals.D().devs[0]; out.stage = dev && dev.stage; out.size = dev && dev.size;
    out.occ0 = G.ratios.occupancyPortfolio;
    const trace = [];
    for (let i = 0; i < 16 && dev && dev.stage !== 'done'; i++) { const s = __q(/Sign the anchor/); const p = G.portfolio.find(x => x.id === dev.pid); trace.push(dev.stage + (s.length ? '[' + s.join(',') + ']' : '') + (p ? ' ' + Math.round(p.occupancy * 100) + '%' : '')); }
    out.trace = trace.join(' > '); out.final = dev && dev.stage; out.cost = dev && dev.cost; const p = G.portfolio.find(x => x.id === dev.pid); out.value = p && p.currentValue; out.prelet = dev && dev.prelet;
    out.noi = p && p.annualNOI;
    return out; });
  ok(/Reserved/.test(l.rsv), 'Fifth Street lot: "' + l.rsv.slice(0, 70) + '"');
  ok(l.seen.indexOf('dev_plan') > -1 && l.stage === 'build' && l.size === 'standard', 'won the Grandview lot; "what do we build?" card: standard');
  console.log('      ' + l.trace);
  ok(l.final === 'done' && l.value > l.cost * 0.85, 'built and let (an overrun or rising yields can eat the gain): worth $' + l.value + 'M against $' + l.cost + 'M of cost' + (l.prelet ? ' (anchor signed)' : ''));

  // 7. a lot lost to a rival, who builds on it later
  const lr = await pg.evaluate(() => { const G = GameState; const l = G.devLots.find(x => x.id !== 'lot_01'); if (!l) return null; l.unlockQuarter = 0;
    __pin(0.01); Deals.bid(l.id, l.cost * 0.3 * 0.7); __q(); __unpin();
    const d = Deals.D().list.filter(x => x.kind === 'lot').pop(), rl = (Deals.D().rivalLots || []).slice(-1)[0]; if (rl) rl.at = 0; __q();
    const built = G.cityRivals.find(p => p.id === 'rdev_' + l.id);
    return { res: d.result, built: built && built.name + ' (' + built.owner + ')' }; });
  ok(lr && /won/.test(lr.res) && lr.built, 'lost a lot: "' + (lr && lr.res) + '"; later they opened ' + (lr && lr.built));

  // 8. agents: a story case (Harlow) and a deal case
  const ag = await pg.evaluate(() => { const G = GameState, h = Story.H(); Story.debug('loan', { loan: { amt: 20, rate: 0.10, due: Story.S ? (G.meta.year * 4 + 8) : 40, streak: 0 } });
    const cases = Agents.storyCases().map(c => c.id);
    const cov = 1.0, before = Story.maturityOdds(cov).repay;
    G.staff.push({ roleId: 'cfo', title: 'Chief Financial Officer', name: 'Test CFO', salary: 0.4, skill: 7, traitId: null, portrait: 's02.jpg' });
    const ppl = Agents.people('harlow').map(p => p.name + ' ' + p.costText + ' s=' + p.s + (p.why ? ' (' + p.why + ')' : ''));
    const pick = Agents.people('harlow').find(p => !p.why);
    const r = Agents.assign('harlow', pick.key), after = Story.maturityOdds(cov).repay;
    const again = Agents.assign('harlow', pick.key).message;
    // Port leak, through the same door
    return { cases, ppl, msg: r.message, before, after, again, busy: Agents.people('war').find(p => p.key === pick.key) }; });
  ok(ag.cases.indexOf('harlow') > -1, 'story cases open: ' + ag.cases.join(', '));
  console.log('      people for Harlow: ' + ag.ppl.join(' | '));
  ok(ag.after > ag.before, 'assigned: "' + ag.msg + '" Bob repays ' + ag.before + '% → ' + ag.after + '%');
  ok(/already/.test(ag.again), 'one person per case: "' + ag.again + '"');
  const pk = await pg.evaluate(() => { const r = Agents.risk, out = {}; const base = 0.2;
    Port.P().stage = 'scheme'; out.active = Agents.storyCases().some(c => c.id === 'port');
    const k = Agents.people('port').find(p => !p.why); out.who = k && k.name; if (k) Agents.assign('port', k.key);
    out.leak = Agents.risk('port', base); Port.P().stage = 'wait'; return out; });
  ok(pk.active && pk.leak < 0.2, 'Port Logistics leak with ' + pk.who + ' on it: 20% → ' + Math.round(pk.leak * 100) + '%');

  // 9. PR: a campaign lifts the price for a while
  const pr = await pg.evaluate(() => { const P = PR.P(); P.offer = 'investorday'; Story.S().due = 'pr_offer'; const c = World.systemDecision(); const body = c.body; World.applyChoice(c, 0); Story.S().due = null;
    const prem = PR.premium(); __q(); const why = (GameState._priceWhy.good || []).join(' | '); return { title: c.title, prem, why, body: body.replace(/<[^>]+>/g, ' ').slice(0, 160) }; });
  ok(pr.prem > 1.02 && /investor day/i.test(pr.why), pr.title + ': fair price x' + pr.prem.toFixed(3) + '; reasons: "' + pr.why.slice(-80) + '"');

  // 10. IR wins back part of a bad-news drop; a slight lift otherwise
  const ir = await pg.evaluate(() => { const G = GameState; G.staff.push({ roleId: 'ir', title: 'Head of Investor Relations', name: 'Test IR', salary: 0.3, skill: 6, traitId: 'silvertongue', portrait: 's03.jpg' });
    __q(); const before = G.company.sharePrice; G.company.sharePrice = +(before * 0.85).toFixed(2); __q();
    const feed = (G.eventLog || []).slice(-1)[0]; const txt = JSON.stringify(feed || {}); return { note: (txt.match(/Test IR[^"]+/) || [''])[0], irNote: G._irNote }; });
  ok(/won back/.test(ir.note || ir.irNote || ''), 'IR after a 15% drop: "' + ((ir.note || ir.irNote) || '').slice(0, 140) + '"');

  // 11. staff fixes
  const st = await pg.evaluate(() => { const G = GameState, out = {};
    out.acq = Staff.ROLES ? '' : ''; const cfo = G.staff.find(s => s.roleId === 'cfo'); const r0 = Financials.getCurrentBorrowingRateForTerm(5);
    cfo.traitId = 'disciplined'; G.meta.year = Math.max(G.meta.year, 3); G.company.debtIssuanceQuarter = 0;
    const r = Financials.issueDebt(5, 5, false); const t = G.debtTranches[G.debtTranches.length - 1]; out.rate = t.rate; out.r0 = r0;
    const s = { roleId: 'asset', title: 'Asset Manager', name: 'Test AM', salary: 0.3, skill: 5, traitId: 'connected', boardTarget: 'okafor', portrait: 's04.jpg' }; G.staff.push(s);
    Staff.processYearEnd(); out.mem = Directors.card('okafor').memory.join(' | ');
    out.trait = Staff.TRAITS.rainmaker.desc + ' / ' + Staff.TRAITS.steady.desc + ' / ' + Staff.TRAITS.silvertongue.desc;
    return out; });
  ok(Math.abs(st.rate - (st.r0 - 0.25)) < 0.02, 'Disciplined CFO: new 5-year bond at ' + st.rate + '% (market ' + st.r0 + '%)');
  ok(/keeps in touch/.test(st.mem), 'Connected staff: Okafor remembers "' + st.mem.slice(0, 80) + '"');
  console.log('      traits: ' + st.trait);

  // 12. the Dealroom tab, the gala moved, occupancy without building sites
  const dr = await pg.evaluate(() => { UI.renderAll(); document.querySelector('.tb-tab[data-view="stories"]').click(); const t = document.getElementById('stories-body').textContent;
    const fin = (document.getElementById('rcf-body') || {}).textContent || '';
    const g0 = GameState.board.politicalCapital; GameState.board.politicalCapital = 3; GameState.board.galaYear = 0; Journal.render(); document.getElementById('dr-gala').click();
    return { tab: document.querySelector('.tb-tab[data-view="stories"]').textContent, has: ['Deals in progress', 'Stories', 'Influence', 'Campaigns'].filter(k => t.indexOf(k) > -1), galaFin: /charity gala/.test(fin), pc: GameState.board.politicalCapital }; });
  ok(dr.tab === 'Dealroom' && dr.has.length === 4, 'Dealroom tab: ' + dr.has.join(', '));
  ok(!dr.galaFin && dr.pc === 4, 'the gala left Finance and works from the Dealroom (capital 3 → ' + dr.pc + ')');
  await pg.screenshot({ path: OUT + '/r22_dealroom.png' });
  const sh = await pg.evaluate(() => { const p = GameState.propertyMarket.find(x => !x.listedByOwner && !Deals.blocked(x.id)); Deals.openOffer(p.id); return true; });
  await wait(200); await pg.screenshot({ path: OUT + '/r22_offer.png' }); await pg.evaluate(() => UI.closeModal());
  await pg.evaluate(() => Deals.openLot((GameState.devLots.find(l => l.id !== 'lot_01') || GameState.devLots[0]).id)); await wait(200); await pg.screenshot({ path: OUT + '/r22_lot.png' }); await pg.evaluate(() => UI.closeModal());

  // 13. save and reload keeps the deals
  const sv = await pg.evaluate(() => { Save.save(); const n = Deals.D().list.length; return n; });
  await pg.reload(); await wait(800);
  const sv2 = await pg.evaluate(() => { const btn = [...document.querySelectorAll('button')].find(b => /Continue/.test(b.textContent)); if (btn) btn.click(); return true; }); await wait(800);
  const sv3 = await pg.evaluate(() => GameState.deals ? GameState.deals.list.length : -1);
  ok(sv3 === sv, 'deals survive a reload (' + sv + ' → ' + sv3 + ')');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' / ') : ''));
  await b.close();
})();
