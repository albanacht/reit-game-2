/* ============================================================================
   gary.js — STORY 6: GARY (round 15). window.Gary

   Your brother-in-law Gary runs Lakeside Property Services. He wants the
   contract to manage our buildings, and offers you 40% of his firm.

   The legal US way, simplified: a RELATED-PARTY TRANSACTION. An executive may
   own part of a firm that does business with the company if it is disclosed
   in the proxy statement (any deal over $120,000 with an executive's family)
   and approved by the independent directors, on terms someone can call
   "market" (the fee sits at the top of the range). No kickbacks: you BUY
   the stake at a fair price, sit out the vote, and earn its share of profits.

   Act 1  Year 3 (inbox): the offer. Stake + board vote / contract only /
          open tender.
   Vote   next meeting: you leave the room; the independent directors vote
          (odds from mood). Or withdraw.
   Run    the company pays 3.5% of rent instead of 2.5% (the extra 1% is in
          overheads); Lakeside earns ~30% on our fees; your 40% comes to you
          every quarter. The lake house summers count too ($0.1M a year).
   Act 2  is Gary any good? 4 in 10 decent; 6 in 10 a boiler fails in
          January (a building −5 points occupancy, ~$1M of repairs).
   Act 3  a year or more in, Nora prints page 212; Petrova raises it in the
          room: keep it / sell your stake back / end the contract.
   Exit   from Year 10, a national manager buys Lakeside at ~6x profit: your
          40% becomes a lump sum. During the Rennick war, the buyer is Rennick.
   ========================================================================== */

window.Gary = (() => {

  const rnd = () => Math.random();
  const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const fmt = n => Math.round(n * 100) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const money = n => '$' + (Math.abs(n) >= 10 ? Math.abs(n).toFixed(0) : Math.abs(n).toFixed(2).replace(/\.?0+$/, '')) + 'M';   // round 30: $10M was printed as $1M
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const FACE = k => 'assets/faces/' + k + '.jpg';
  const GARY = { name: 'Gary', face: FACE('gary'), role: 'your brother-in-law, Lakeside Property Services' };
  const FIRM = 'Lakeside Property Services', NORA = 'Nora Whitlock', PAPER = 'Riverton Ledger';
  const STAKE = 0.40, PRICE = 0.5, FEE = 0.035, LOW = 0.025, MARGIN = 0.30, LAKE = 0.025;   // LAKE: $0.1M a year, per quarter

  function S() {
    const s = Story.S();
    if (!s.gary) s.gary = { stage: 'wait', stake: 0, earned: 0, log: [] };
    return s.gary;
  }
  const has = id => window.Directors && Directors.has(id);
  const lead = (a, b) => has(a) ? a : b;
  const remember = (id, d, why) => { if (has(id)) Directors.remember(id, d, why); };
  const say = (from, role, title, body, face) => { if (window.Inbox) Inbox.message(from, role, title, body, face); };
  const oneOff = d => { GameState._pendingUnusual = fmt((GameState._pendingUnusual || 0) - d); };
  const me = () => Pay.L();
  const nums = rows => '<table class="dv-nums">' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
  const voice = (id, text) => !has(id) ? '' : '<div class="dv"><img src="' + FACE(id) + '" alt=""><div><b>' + Directors.name(id).replace(/^(Chairman|Chair|Director) /, '') + ':</b> ' + text + '</div></div>';
  const note = t => S().log.push({ q: tq(), t });
  const running = () => ['run'].indexOf(S().stage) > -1;
  const rentQ = () => Math.max(0, (GameState.pnl && GameState.pnl.netRentalRevenue) || 0);    // last quarter's rent collected
  const rentY = () => rentQ() * 4;

  /* What the company pays on top of the cheapest bid, per quarter (financials.js G&A). */
  const feeQ = () => running() || (S().stage === 'sold' && S().buyer === 'rennick' && !S().rennickEnded) ? fmt(rentQ() * (FEE - LOW)) : 0;
  /* Lakeside's profit from our contract, a year, and your share of it. */
  const profitY = () => rentY() * FEE * MARGIN;
  const mineY = () => profitY() * S().stake;

  // ============================================================================
  // EVERY QUARTER
  // ============================================================================
  function processQuarter(out) {
    const g = S(), G = GameState, s = Story.S(), now = tq();
    if (G.meta.gameOver) return;
    try { yardQuarter(out); } catch (e) { if (window.console) console.warn('yard', e); }   // round 30
    // Act 1: Gary turns up in Year 3, once we run a few buildings
    if (g.stage === 'wait') {
      if (G.meta.year >= 3 && (G.portfolio || []).length >= 3 && !s.due) { g.stage = 'offer'; s.due = 'gary_offer'; }
      return;
    }
    if (g.stage === 'run' || g.stage === 'sold') lake();
    if (g.stage !== 'run') return;
    // your 40%, every quarter
    if (g.stake > 0) { const d = fmt(rentQ() * FEE * MARGIN * g.stake); me().cash = fmt(me().cash + d); g.earned = fmt(g.earned + d); }
    // Act 2: is Gary any good?
    if (!g.quality) g.quality = rnd() < 0.4 ? 'decent' : 'corners';
    if (!g.act2Q) g.act2Q = now + rint(3, 6);
    if (!g.act2Done && now >= g.act2Q) { g.act2Done = true; act2(out); }
    // the cash-out, from Year 10
    if (g.stake > 0 && !g.saleQ && G.meta.year >= 10) g.saleQ = now + rint(0, 6);
    if (g.saleQ && now >= g.saleQ && g.stake > 0 && !s.due) { s.due = 'gary_sale'; g.saleQ = 9999; }
  }
  function lake() { const g = S(); if (g.lakeOff) return; me().cash = fmt(me().cash + LAKE); g.lakeTotal = fmt((g.lakeTotal || 0) + LAKE); }

  function act2(out) {
    const g = S(), G = GameState;
    if (g.quality === 'decent') {
      remember(lead('hassan', 'mansour'), 0.5, 'Gary’s firm runs the buildings well');
      say('Gary', 'your brother-in-law', 'Two years without a complaint', 'Two years and not one tenant complaint. Hassan said "fine" to me in the lift. I am having it engraved.<div class="dv-nums">Gary turns out to be decent at this. Buildings run normally.</div>', GARY.face);
      note('Gary turned out decent.');
      return;
    }
    const p = (G.portfolio || []).filter(x => !x.underConstruction && !x.storyLock && !(window.Tenants && Tenants.isLocked(x))).sort((a, b) => b.currentValue - a.currentValue)[0];
    if (!p) return;
    const before = p.occupancy; p.occupancy = Math.max(0.3, fmt(p.occupancy - 0.05)); oneOff(1.0);
    g.boiler = p.name;
    out.push({ good: false, text: 'The boiler failed at ' + p.name + ' in January. Lakeside had skipped the service. Occupancy ' + Math.round(before * 100) + '% → ' + Math.round(p.occupancy * 100) + '%, repairs $1.0M.', w: 8 });
    say(Directors.name(lead('hassan', 'okafor')), 'Director', 'The boiler at ' + p.name,
      'The boiler at ' + p.name + ' failed in January. Lakeside had skipped the annual service "to save the client money". Three tenants gave notice. Repairs: $1.0M.<br><i>Your brother-in-law’s firm.</i>', FACE(lead('hassan', 'okafor')));
    remember(lead('hassan', 'mansour'), -1, 'Gary’s firm let a boiler fail');
    note('The boiler failed at ' + p.name + '.');
  }

  // ============================================================================
  // THE MEETING
  // ============================================================================
  function agenda(year, items) {
    const g = S(); items = items || [];
    if (g.stage === 'vote' && g.voteYear !== year) { g.voteYear = year; items.push(voteItem()); }
    if (g.stage === 'run' && !g.page212 && tq() - (g.runQ || tq()) >= 4) { g.page212 = year; items.push(page212Item()); }
    if (g.buyer === 'rennick' && !g.rennickEnded && g.rennickAsked !== year) {
      g.rennickAsked = year;
      items.push({ lines: [[lead('chen', 'okafor'), 'Rennick now manages our buildings, through Gary\u2019s old firm. Kessler reads every lease we sign. I want that contract ended.']],
        choices: [
          { label: 'End it ($0.5M break fee)', primary: true, detail: 'Kessler loses his window into our buildings; the extra fee stops. Chen +1.', go: () => { remember('chen', 1, 'you threw Rennick out of our buildings'); return endRennick(); } },
          { label: 'Keep it for now', detail: 'His attacks keep landing 25% harder. Chen \u22121. He will ask again next year.', go: () => { remember('chen', -1, 'Rennick still manages our buildings'); return 'Rennick stays, for now.'; } },
        ] });
    }
    return items;
  }
  function voteOdds(lobby) {
    const ds = (GameState.board.directors || []).filter(d => d.id !== 'voss');
    const per = ds.map(d => {
      let p = 0.55 + 0.1 * (d.attitude - 5) + (lobby ? 0.12 : 0);
      if (d.id === 'okafor') p -= 0.15; if (d.id === 'petrova') p -= 0.2; if (d.id === 'activist') p -= 0.3; if (d.id === 'hassan' || d.id === 'mansour') p -= 0.05;
      if (d.id === 'williams') p += 0.05; if (d.id === 'tex') p = 0.97;
      return clamp(p, 0.03, 0.97);
    });
    let dist = [1]; per.forEach(p => { const n = new Array(dist.length + 1).fill(0); dist.forEach((v, k) => { n[k + 1] += v * p; n[k] += v * (1 - p); }); dist = n; });
    const need = Math.floor(per.length / 2) + 1;
    return { p: dist.slice(need).reduce((a, b) => a + b, 0), n: per.length };
  }
  function voteItem() {
    const g = S(), o = voteOdds(), fee = fmt(rentY() * FEE), extra = fmt(rentY() * (FEE - LOW));
    return { lines: [[lead('okafor', Directors.chair()), 'Item four. A related-party transaction: ' + FIRM + ', owned by the CEO’s brother-in-law, 40% by the CEO. The CEO will leave the room.'],
                     [lead('petrova', 'okafor'), 'Three and a half percent, against two and a half from the cheapest bid. We should be asking why.'],
                     [lead('williams', 'chen'), 'It is disclosed, the fairness opinion is in the pack, and the man is family. Let us vote.']],
      note: 'The contract: ' + money(fee) + ' a year (' + money(extra) + ' more than the cheapest bid). If approved, your 40% of Lakeside pays you about ' + money(fmt(rentY() * FEE * MARGIN * STAKE)) + ' a year. Disclosed in the proxy statement.',
      choices: [
        { label: 'Leave the room and let them vote (about ' + Math.round(o.p * 10) + ' in 10 it passes)', primary: true, detail: 'The independent directors decide. Okafor and Petrova are sceptical; Williams does not mind if the dividend is fine.',
          go: () => {
            if (rnd() < o.p) { g.stage = 'run'; g.runQ = tq(); note('The board approved the Lakeside contract.'); remember('petrova', -0.5, 'the Lakeside contract'); return 'You come back in. Approved. Lakeside manages our buildings from next quarter; your 40% starts paying.'; }
            g.stage = 'voted_down'; g.stake = 0; me().cash = fmt(me().cash + PRICE); g.lakeOff = true; note('The board said no to Lakeside.');
            return 'You come back in. Rejected. Gary buys your stake back at what you paid. He says the board "is not family".'; } },
        { label: 'Call around first (1 political capital), then leave the room: about ' + Math.round(voteOdds(true).p * 10) + ' in 10', detail: 'A word with each director before the vote. You have ' + ((GameState.board && GameState.board.politicalCapital) || 0) + '.',
          disabled: ((GameState.board && GameState.board.politicalCapital) || 0) < 1, why: 'Needs 1 political capital',
          go: () => { GameState.board.politicalCapital -= 1;
            if (rnd() < voteOdds(true).p) { g.stage = 'run'; g.runQ = tq(); note('The board approved the Lakeside contract.'); remember('petrova', -0.5, 'the Lakeside contract'); return 'You come back in. Approved. Lakeside manages our buildings from next quarter; your 40% starts paying.'; }
            g.stage = 'voted_down'; g.stake = 0; me().cash = fmt(me().cash + PRICE); g.lakeOff = true; note('The board said no to Lakeside.');
            return 'You come back in. Rejected, despite the calls. Gary buys your stake back at what you paid.'; } },
        { label: 'Withdraw: give Gary the contract without your stake', detail: 'Gary sells your 40% back at cost. The contract still goes to family, but you earn nothing from it except the lake house.',
          go: () => { g.stake = 0; me().cash = fmt(me().cash + PRICE); g.stage = 'run'; g.runQ = tq(); g.plainContract = true; note('Gary got the contract, no stake.'); return 'Gary manages our buildings. Your stake is his again.'; } },
        { label: 'Withdraw entirely: open tender', detail: 'Gary buys your stake back. The cheapest bidder wins. Hassan +1. Thanksgiving is cancelled.',
          go: () => { g.stake = 0; me().cash = fmt(me().cash + PRICE); g.stage = 'tender'; g.lakeOff = true; remember(lead('hassan', 'mansour'), 1, 'an open tender'); note('Open tender; Gary lost.'); return 'The cheapest bidder won. Gary is not answering your calls.'; } },
      ] };
  }
  function page212Item() {
    const g = S(), stake = g.stake > 0, inIdx = window.IndexFund && IndexFund.included();
    return { lines: [[lead('petrova', 'okafor'), 'Nora Whitlock read page 212 of our proxy statement. This morning’s Ledger: "' + (stake ? 'CEO owns 40% of the firm that manages his REIT’s buildings' : 'CEO’s brother-in-law manages REIT’s buildings') + '." It is all legal and all disclosed. It is also on the front page.'],
                     [lead('williams', 'chen'), 'Disclosed is disclosed.']],
      note: (stake ? 'Your 40% has paid you ' + money(g.earned) + ' so far, about ' + money(mineY()) + ' a year now. ' : '') + 'The company pays about ' + money(rentY() * (FEE - LOW)) + ' a year more than the cheapest bid.',
      choices: [
        { label: 'Keep it as it is', detail: 'Share price −3%. Petrova −2.' + (inIdx ? ' Granite marks your pay down at the next say on pay vote (−15).' : ''),
          go: () => { GameState.company.sharePrice = fmt(GameState.company.sharePrice * 0.97); remember('petrova', -2, 'page 212'); g.flagged = true; return 'No comment. The story ran for two days.'; } },
        ...(stake ? [{ label: 'Sell your stake back to Gary', detail: 'At cost plus 5% a year held. You keep what it has paid you. Gary still manages the buildings; the story calms down. Petrova +0.5.',
          go: () => { const yrs = (tq() - g.runQ) / 4, px = fmt(PRICE * Math.pow(1.05, yrs)); me().cash = fmt(me().cash + px); g.stake = 0; g.stage = 'run'; g.plainContract = true; g.soldBack = true; remember('petrova', 0.5, 'you sold your Lakeside stake'); note('Sold the Lakeside stake back.'); return 'Gary paid ' + money(px) + ' for your 40%. "Pleasure doing business, family."'; } }] : []),
        { label: 'End the contract', detail: 'The extra fee stops. ' + (stake ? 'Gary buys your stake back at cost. ' : '') + 'No more lake house. Petrova +1. Thanksgiving is cancelled.',
          go: () => { if (g.stake > 0) me().cash = fmt(me().cash + PRICE); g.stake = 0; g.stage = 'ended'; g.endedYear = GameState.meta.year; g.lakeOff = true; remember('petrova', 1, 'you ended the Lakeside contract'); note('Ended the Lakeside contract.'); return 'Lakeside is out. Your sister-in-law has unfollowed you.'; } },
      ] };
  }

  // ============================================================================
  // THE CARDS
  // ============================================================================
  const CARDS = [
    { id: 'gary_offer', system: true, story: true,
      build() {
        const g = S(); if (g.stage !== 'offer') return null;
        const fee = fmt(rentY() * FEE), extra = fmt(rentY() * (FEE - LOW)), yours = fmt(rentY() * FEE * MARGIN * STAKE);
        return { title: 'Gary would like to manage our buildings', from: 'Gary, your brother-in-law', face: GARY.face,
          body: '"I have built ' + FIRM + ' into something real. I would like to manage your buildings, and I would like you to own 40% of it. Fair price, $0.5M, everything above board. Family should share in family business. Also, the lake house is free most summers."' +
                nums([['His bid', money(fee) + ' a year (3.5% of rent)'], ['The cheapest bid', money(fmt(rentY() * LOW)) + ' a year (2.5%)'], ['Extra cost to the company', money(extra) + ' a year'],
                      ['Your 40% would pay you', 'about ' + money(yours) + ' a year, growing with our rent'], ['Your own cash', money(me().cash)]]) +
                '<div class="dv-nums">The legal way: a related-party transaction. You buy the stake at a fair price, it is disclosed in the proxy statement, and the independent directors vote on the contract while you leave the room.</div>' +
                voice(lead('okafor', 'petrova'), '"Whatever you decide, it goes in the proxy statement."'),
          choices: [
            { label: 'Buy 40% of Lakeside ($0.5M of your own) and put the contract to the board', detail: 'The board votes at the next meeting. The lake house is yours most summers ($0.1M a year).',
              check: () => me().cash >= PRICE, checkMsg: 'You need $0.5M of your own',
              apply() { me().cash = fmt(me().cash - PRICE); g.stake = STAKE; g.stage = 'vote'; note('Bought 40% of Lakeside.'); return 'You own 40% of ' + FIRM + '. The contract goes to the board at the next meeting.'; } },
            { label: 'Give Gary the contract, no stake', detail: 'Family business, without your money in it. The company pays the extra ' + money(extra) + ' a year; you get the lake house summers.',
              apply() { g.stage = 'run'; g.runQ = tq(); g.plainContract = true; note('Gary got the contract, no stake.'); return 'Gary is our property manager. Thanksgiving has never been warmer.'; } },
            { label: 'Run an open tender', detail: 'The cheapest bid wins. Hassan +1. Thanksgiving is going to be awkward.',
              apply() { g.stage = 'tender'; g.lakeOff = true; remember(lead('hassan', 'mansour'), 1, 'an open tender'); note('Open tender; Gary lost.'); return 'The lowest bidder won. Gary says he is "not upset".'; } },
          ] };
      } },
    { id: 'gary_sale', system: true, story: true,
      build() {
        const g = S(); if (g.stage !== 'run' || !(g.stake > 0)) return null;
        const rennick = window.War && ['war', 'crisis'].indexOf(War.W().stage) > -1 && GameState.rivals && GameState.rivals.ren && !GameState.rivals.ren.gone;
        const lump = fmt(profitY() * 2 * 6 * g.stake);           // our contract is about half of Lakeside's business
        const buyer = rennick ? 'Rennick Capital' : 'Crestline, a national property manager';
        return { title: 'Gary is selling Lakeside', from: 'Gary, your brother-in-law', face: GARY.face,
          body: '"' + buyer + ' will buy all of Lakeside at six times profit. Your 40% comes to about ' + money(lump) + '. I am buying a second lake house. You should too."' +
                nums([['Your 40%', money(lump)], ['Paid to you so far', money(g.earned)], ['The buyer', buyer]]) +
                (rennick ? voice(lead('chen', 'okafor'), '"Rennick would be managing our buildings. Kessler would see every lease we have."') : ''),
          choices: [
            { label: 'Sell: ' + money(lump) + ' to you', detail: rennick ? 'Kessler’s firm manages our buildings until we end it: his attacks land 25% harder (he sees our rent roll). Ending it costs a $0.5M break fee.' : 'The new owner keeps our contract at the normal 2.5%: the extra fee stops.',
              apply() { me().cash = fmt(me().cash + lump); g.sold = lump; g.stake = 0; g.stage = 'sold'; g.buyer = rennick ? 'rennick' : 'crestline'; g.lakeOff = false;
                        if (rennick && window.War) War.W().lakeside = true; note('Lakeside sold to ' + buyer + '.');
                        return 'Sold. ' + money(lump) + ' is yours. Gary sent a photo of a dock.'; } },
            { label: 'Keep your 40%', detail: 'Lakeside stays Gary’s and yours; the quarterly payments continue.', apply() { return 'Gary is disappointed, but understands. He mostly understands.'; } },
          ] };
      } },
  ];
  if (window.World && World.DECISIONS) CARDS.forEach(c => { if (!World.DECISIONS.some(d => d.id === c.id)) World.DECISIONS.push(c); });

  /* -- round 30: THE OLD YARD. An insider sale, legal if disclosed and approved.
     Years 9 to 12 (the busy middle years are over), once: the family company
     (you and Gary, half each) owns Riverside Salvage, a scrap yard by the river.
     Gary pitches it as "industrial outdoor storage". You pick the premium over
     its value: +5%, +15% or +30%, and may spend 2 political capital lobbying the
     independent directors. You leave the room; they vote at once.
       approve   +5% 90%, +15% 62%, +30% 38%; ±15 points from their mood; lobbying +25
       if yes    the REIT pays value + premium (NAV falls by the premium); the yard
                 joins the portfolio, let back to Riverside Salvage for 10 years
                 at about 8%; your half of the premium comes to you
       Nora      over the next two years she finds it: +5% 10%, +15% 30%, +30% 55%.
                 Price −4%, every director remembers it (Petrova most), and the
                 say on pay vote counts it (flagged).                          */
  const YARD_ID = 'ind_rsv', YARD_TENANT = 'riverside_salvage';
  const Y = () => { const g = S(); if (!g.yard) g.yard = { stage: 'wait' }; return g.yard; };
  const YARD_OK = { 0.05: 0.90, 0.15: 0.62, 0.30: 0.38 }, YARD_LEAK = { 0.05: 0.10, 0.15: 0.30, 0.30: 0.55 };
  const cap = () => (GameState.board && GameState.board.politicalCapital) || 0;
  function yardOdds(pct, lobby) {
    const ds = (GameState.board.directors || []).filter(d => d.id !== 'tex' && d.id !== 'voss');
    const avg = ds.length ? ds.reduce((a, d) => a + d.attitude, 0) / ds.length : 5;
    return clamp(YARD_OK[pct] + clamp((avg - 5) * 0.03, -0.15, 0.15) + (lobby ? 0.25 : 0), 0.05, 0.97);
  }
  function yardQuarter(out) {
    const y = Y(), G = GameState, s = Story.S(), now = tq();
    const g = S(), saleSoon = g.saleQ && g.saleQ < 9999 && now >= g.saleQ - 1;   // Gary selling Lakeside goes first
    if (y.stage === 'wait' && !saleSoon && G.meta.year >= 9 && G.meta.year <= 12 && !s.due && (G.portfolio || []).length >= 4 && rnd() < 0.35) {
      y.value = clamp(Math.round((G.balance.totalAssets || 300) * 0.035), 8, 20); y.stage = 'offer'; s.due = 'gary_yard'; return;
    }
    if (y.stage === 'done' && !y.exposed && now > y.q && now <= y.q + 8 && rnd() < YARD_LEAK[y.pct] / 8) yardLeak(out);
  }
  function yardBuy(pct) {
    const y = Y(), G = GameState, V = y.value, P = fmt(V * (1 + pct));
    const M = { id: YARD_ID, n: 'Riverside Salvage Yard', t: 'industrial', ti: 'suburban', z: 'southside', o: 'you', x: 44, y: 90, v: V, cap: 8, occ: 100,
                ph: 'industrial_riverside_salvage', noi: fmt(V * 0.08), story: 'The family scrap yard by the river, sold to the REIT by you and Gary. Let back to Riverside Salvage for 10 years.' };
    const p = Properties.fromMaster(M, true);
    Object.assign(p, { purchasePrice: P, currentValue: V, baseValue: V, vb: null, quarterOwned: 0, askingPrice: null, occupancy: 1,
                       lease: { type: 'single', positions: [{ t: YARD_TENANT, share: 1, q: 40 }] } });
    if (!G.tenants[YARD_TENANT]) G.tenants[YARD_TENANT] = { id: YARD_TENANT, name: 'Riverside Salvage', industry: 'Scrap metal (Gary)', story: 'Gary\u2019s family scrap business.', coverage: 1.8, base: 1.8, trend: 0, esc: 0.02, status: 'active', history: [] };
    G.portfolio.push(p);
    const fee = Properties.transactionFee ? Properties.transactionFee(P) : 0;
    G.balance.cash = fmt(G.balance.cash - P - fee);
    const mine = fmt((P - V) / 2); me().cash = fmt(me().cash + mine);
    Object.assign(y, { stage: 'done', pct, price: P, mine, q: tq() });
    note('The REIT bought the old yard for ' + money(P) + ' (value ' + money(V) + ').');
    return { P, V, mine };
  }
  function yardLeak(out) {
    const y = Y(); y.exposed = true; S().flagged = true;
    GameState.company.sharePrice = fmt(GameState.company.sharePrice * 0.96);
    (GameState.board.directors || []).forEach(d => { if (d.id !== 'tex' && d.id !== 'voss') remember(d.id, d.id === 'petrova' ? -4 : -2, 'the scrap yard sold to the company by the CEO\u2019s family'); });
    say(NORA, 'Reporter, ' + PAPER, 'The CEO\u2019s scrap yard', 'The Ledger, page one: "' + GameState.company.name + ' paid ' + money(y.price) + ' for a scrap yard owned by its CEO and his brother-in-law. Independent valuers put it at ' + money(y.value) + '." It was disclosed, it was approved, and it is on the front page.' +
        '<div class="dv-nums">Share price −4%. Every director remembers it; Petrova most of all. Proxy advisers will mention it at the next say on pay vote.</div>', FACE('journalist'));
    note('Nora found the yard deal.');
    if (out) out.push({ good: false, text: 'The Ledger: "The CEO\u2019s scrap yard". Share price −4%.' });
  }
  const yardEnding = () => { const y = Y(); return y.stage === 'done' && (GameState.portfolio || []).some(p => p.id === YARD_ID) ? (y.exposed ? 'exposed' : 'quiet') : y.stage === 'done' ? 'quiet' : null; };
  CARDS.push({ id: 'gary_yard', system: true, story: true, holdQ: 2,
    build() {
      const y = Y(); if (y.stage !== 'offer') return null;
      const V = y.value, row = pct => [money(V * (1 + pct)) + ' (+' + Math.round(pct * 100) + '%)', 'you pocket ' + money(V * pct / 2) + '; the board says yes about ' + Math.round(yardOdds(pct, false) * 100) + '% (' + Math.round(yardOdds(pct, true) * 100) + '% if you lobby); Nora finds it ' + Math.round(YARD_LEAK[pct] * 100) + '%'];
      const opt = (pct, lobby) => ({ label: 'Sell at +' + Math.round(pct * 100) + '%: ' + money(V * (1 + pct)) + (lobby ? ', and lobby the independent directors (2 political capital)' : ''),
        detail: 'Board yes ' + Math.round(yardOdds(pct, lobby) * 100) + '%. You get ' + money(V * pct / 2) + '. The company overpays by ' + money(V * pct) + '.',
        check: () => (!lobby || cap() >= 2) && (window.Revolver && GameState.revolver ? Revolver.spendable() : GameState.balance.cash) >= V * (1 + pct), checkMsg: lobby && cap() < 2 ? 'Not enough political capital' : 'Not enough cash and credit line',
        apply() {
          if (lobby) GameState.board.politicalCapital = cap() - 2;
          if (rnd() >= yardOdds(pct, lobby)) {
            Y().stage = 'declined'; remember('petrova', -0.5, 'you asked us to buy your family\u2019s yard'); note('The independent directors said no to the yard.');
            return 'The independent directors said no, politely. Gary said "their loss" and hung up.';
          }
          const r = yardBuy(pct);
          say(GARY.name, GARY.role, 'Pleasure doing business', 'Wired. Your half of the premium: ' + money(r.mine) + '. I told Dad. He said "a REIT bought the scrap yard?" twice.', GARY.face);
          return 'Approved. The REIT bought Riverside Salvage Yard for ' + money(r.P) + ' (value ' + money(r.V) + '). ' + money(r.mine) + ' is yours.';
        } });
      return { title: 'Gary has an idea about the old yard', from: GARY.name, face: GARY.face,
        body: '"Remember the old scrap yard by the river? Riverside Salvage. The family company still owns it, you and me, half each. Your REIT buys industrial, right? It is called <i>industrial outdoor storage</i> now, the hottest thing in real estate. Salvage leases it back, we take the cash. I had it valued at ' + money(V) + '. A <i>nice</i> price, though."' +
              nums([['Value', money(V) + ', let back at about 8% for 10 years']].concat([0.05, 0.15, 0.30].map(row))) +
              '<div class="dv-nums">Jenkins: "A related-party sale. Legal if it is disclosed and the independent directors approve it. You leave the room while they vote."</div>',
        choices: [opt(0.05, false), opt(0.15, false), opt(0.15, true), opt(0.30, false), opt(0.30, true),
          { label: 'No: keep the family out of the company', detail: 'Petrova +0.5. Gary sulks until Thanksgiving.', apply() { Y().stage = 'refused'; remember('petrova', 0.5, 'you kept your family\u2019s yard out of the company'); return 'You said no. Gary said "fine" in the voice that means it is not.'; } }] };
    } });
  if (window.World && World.DECISIONS && !World.DECISIONS.some(d => d.id === 'gary_yard')) World.DECISIONS.push(CARDS[CARDS.length - 1]);

  /* Rennick bought Lakeside: end the contract from the war profile or here. */
  function endRennick() { const g = S(); if (g.buyer !== 'rennick' || g.rennickEnded) return ''; g.rennickEnded = true; oneOff(0.5); if (window.War) War.W().lakeside = false; return 'Rennick no longer manages our buildings. Break fee $0.5M.'; }

  /* The ending card. */
  function ending() {
    const g = S();
    if (g.stage === 'sold') return g.buyer === 'rennick' ? 'rennick' : 'dock';
    if (g.stage === 'run') return 'still';
    if (g.stage === 'ended') return 'thanksgiving';
    if (g.stage === 'voted_down') return 'notfamily';
    if (g.stage === 'tender') return 'never';
    return 'none';
  }
  /* For the say on pay vote (listing.js). */
  const flagged = () => !!S().flagged;
  function debug(o) { Object.assign(S(), o || {}); return S(); }

  return { S, processQuarter, agenda, feeQ, mineY, profitY, ending, flagged, endRennick, debug, voteOdds, FIRM, Y, yardOdds, yardBuy, yardLeak, yardEnding };
})();
