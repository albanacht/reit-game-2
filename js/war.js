/* ============================================================================
   war.js — STORY 3: THE RENNICK WAR (round 13; STORY_RENNICK_DRAFT.md v4).

   Act 0  Year 3 meeting: Jack Morrow retires and sells Morrow Plaza. Chen
          wants it, Okafor objects. An auction against Kessler in the room.
          Win and the war starts; pass and Rennick grows (no war).
   War    Kessler attacks between meetings (a leak, then a short report by a
          forensic audit firm, then a jab every year or so). Every attack has
          a political answer, a money answer, or take the hit. The board
          argues about each one at the next meeting.
   Weapons (Rennick's profile, once a year each): the bank squeeze, our own
          leak, and in his crisis a standing order to block his asset sales.
          Tex doubles every political hit; a Head of IR fights the press war.
   Act 3  When his books crack (debt above 58% or uncovered dividend in a
          crisis), his lenders make him sell. We block, never buy.
   Act 4  His price below 60% of his NAV: Chen moves the takeover at the
          meeting. Three gates: our board, Kessler's resistance, his
          shareholders. Success: his buildings and debt are ours.
   Losing When WE are weak (our price under 65% of NAV, debt over 55%),
          Kessler buys our shares: 5% (news), 10% (he wants a seat), 15%
          (Dale Voss joins our board), 20% (a hostile bid: if our board
          accepts it, the run ends). Defences: a friendly investor, rallying
          the shareholders, a shareholder rights plan, fixing the numbers.

   Beats between meetings are World system cards served through Story's
   "due" slot; meeting beats come through Story.agenda() (story.js asks
   War.agenda()). Rennick's books live in rivals.js; this file only pushes
   on them (his borrowing cost, his price, his blocked sales, his frozen
   credit). Rewards go to you through Pay.reward().
   ========================================================================== */

window.War = (() => {

  const rnd = () => Math.random();
  const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const fmt = n => Math.round(n * 100) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const money = n => '$' + Math.abs(n).toFixed(1) + 'M';
  const pc = n => Math.round(n) + '%';
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const FACE = k => 'assets/faces/' + k + '.jpg';
  const KESSLER = { name: 'Brett Kessler', face: 'assets/faces/ceo_ren.jpg', role: 'CEO, Rennick Capital' };
  const JACK = { name: 'Jack Morrow', face: FACE('jack'), role: 'owner, Morrow Plaza' };
  const VOSS = { name: 'Dale Voss', face: FACE('voss'), role: 'CFO, Rennick Capital' };
  const NORA = 'Nora Whitlock', PAPER = 'Riverton Ledger', MPZ = 'off_mpz', K = 'ren';

  function W() {
    const s = Story.S();
    if (!s.war) s.war = { stage: 'wait', heat: 0, stake: 0, used: {}, log: [] };
    return s.war;
  }
  const has = id => window.Directors && Directors.has(id);
  const tex = () => has('tex');
  const ir = () => !!(window.Staff && Staff.hasRole && Staff.hasRole('ir'));
  const cap = () => (GameState.board && GameState.board.politicalCapital) || 0;
  const spendPC = n => { GameState.board.politicalCapital = Math.max(0, cap() - n); };
  const cash = d => { GameState.balance.cash = fmt(GameState.balance.cash + d); };
  const oneOff = d => { GameState._pendingUnusual = fmt((GameState._pendingUnusual || 0) - d); };
  const spend = () => (window.Revolver && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash;
  const price = (f) => { GameState.company.sharePrice = fmt(GameState.company.sharePrice * f); };
  const remember = (id, d, why) => { if (window.Directors && has(id)) Directors.remember(id, d, why); };
  const say = (from, role, title, body, face) => { if (window.Inbox) Inbox.message(from, role, title, body, face); };
  const nums = rows => '<table class="dv-nums">' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
  const voice = (id, text) => !has(id) ? '' : '<div class="dv"><img src="' + FACE(id) + '" alt=""><div><b>' + Directors.name(id).replace(/^(Chairman|Director) /, '') + ':</b> ' + text + '</div></div>';
  const lead = (a, b) => has(a) ? a : b;
  const R = () => GameState.rivals && GameState.rivals[K];
  const alive = () => !!R() && !R().gone;
  const navPS = () => { const r = R(); return r && r.shares ? (Rivals.value(K) + r.cash - r.debt) / r.shares : 0; };
  const ourPnav = () => { const n = GameState.ratios.navPerShare; return n > 0 ? GameState.company.sharePrice / n : 1; };
  const active = () => ['war', 'crisis'].indexOf(W().stage) > -1;
  const heat = d => { const w = W(); w.heat = clamp((w.heat || 0) + d, 0, 100); };
  const note = t => W().log.push({ q: tq(), t });
  const hitMult = () => (1 - (window.Agents ? Agents.strength('war') : 0)) * (ir() ? 0.5 : 1) * (W().vossIn ? 1.25 : 1) * (W().lakeside ? 1.25 : 1);   // round 15: Rennick bought Gary's firm and reads our leases          // a Head of IR halves it; Voss on our board leaks to Kessler

  // -- the building -------------------------------------------------------------
  const mpz = () => (GameState.portfolio || []).concat(GameState.cityRivals || [], GameState.propertyMarket || []).find(p => p.id === MPZ) || null;
  function ensure() {
    const M = window.PROPERTIES_MASTER, G = GameState;
    if (!M || !M.SPECIALS || !M.SPECIALS.morrow_plaza || !window.Properties || !G.cityRivals || mpz()) return;
    if (['wait', 'bid'].indexOf(W().stage) < 0) return;
    const p = Properties.fromMaster(M.SPECIALS.morrow_plaza, false);
    p.owner = 'none'; p.askingPrice = null; p.listedByOwner = false; p.storyLock = true;
    p.ownerNote = 'Jack Morrow’s building since 1986. Not for sale (yet).';
    G.cityRivals.push(p);
  }

  // ============================================================================
  // THE MEETING (Story.agenda calls this)
  // ============================================================================
  function agenda(year, items) {
    const w = W(); items = items || [];
    if (!alive()) return items;
    // Act 0: Jack's building, the Year 3 meeting
    const harlowBig = items.some(it => it.card === 'story_harlow_offer' || it.card === 'story_harlow_loan');     // never two big cheques at one meeting
    if ((w.stage === 'wait' || w.stage === 'bid') && year >= 3 && !harlowBig && mpz() && !(GameState.portfolio || []).some(p => p.id === MPZ)) {
      w.stage = 'bid'; w.jack = fmt(mpz().currentValue); w.max = fmt(w.jack * (1.06 + rnd() * 0.06)); w.bid = w.jack;
      items.push({ guest: JACK, lines: [
        [lead('chen', 'petrova'), 'Jack Morrow is retiring and selling Morrow Plaza: office, about ' + money(w.jack) + ', a 9% yield on rent locked in for years. Kessler is already circling. We should have it.'],
        ['guest', 'Thirty-eight years I polished that lobby. I would like it to go to someone who will keep the lights on. Best price wins, though. Florida is not cheap.'],
        [lead('okafor', 'williams'), 'Another ' + money(w.jack) + ' of borrowing. This is how companies die.']] });
      items.push(auctionItem(items));
      return items;
    }
    // Tex: the seventh seat, raised again while the war runs
    if (active() && !tex() && (w.texOffers || 0) > 0 && w.texOffers < 3 && w.texYear !== year) { w.texYear = year; items.push(texItem()); }
    // after the leak: Petrova against Chen
    if (w.leaked && !w.leakTalked && active()) {
      w.leakTalked = true;
      items.push({ lines: [['petrova', 'That Ledger story was Kessler. Our shareholders asked me about it for a week. Stop the headlines.'],
                           [lead('chen', 'williams'), 'Stop them? Hit him back, or he does it again.']],
        choices: [
          { label: 'Hold fire', detail: 'Kessler’s next attack waits a year. Chen −1.', go: () => { w.holdUntil = tq() + 4; remember('chen', -1, 'you held fire on Kessler'); remember('petrova', 0.5, 'you kept us out of the papers'); return 'You held fire. The war cools, for now.'; } },
          { label: 'Hit back now', detail: 'Your next weapon against Rennick costs no political capital (Chen’s contacts). Chen +1, Petrova −0.5.', go: () => { w.freeShot = true; heat(10); remember('chen', 1, 'you hit back at Kessler'); remember('petrova', -0.5, 'more headlines'); return 'Chen made some calls. Your next shot at Rennick is on him (open Rennick’s profile in the league table).'; } },
        ] });
    }
    // after the audit: the whole board on how to hit back
    if (w.audited && !w.auditTalked && active()) {
      w.auditTalked = true;
      const lines = [[lead('chen', 'petrova'), 'Kessler paid people to call us liars. My proposal: our banking friends call his lenders. Let him pay more for every dollar.']];
      if (tex()) lines.push(['tex', 'Make that a double. I know his lenders in Dallas.']);
      lines.push([lead('okafor', 'petrova'), 'Or we pay down debt and let him wear himself out.'], ['williams', 'Or we end this quietly. I can have lunch with Kessler’s chairman.']);
      items.push({ lines, choices: [
        { label: 'Chen’s way: the bank squeeze (2 political capital)', detail: 'His borrowing cost +' + (tex() ? '1.0' : '0.5') + '% for a year' + (tex() ? ' (Tex doubles it)' : '') + '. Chen +1, Okafor −0.5. You have ' + cap() + '.',
          disabled: cap() < 2 && !w.freeShot, why: 'Needs 2 political capital', go: () => { const m = weapon('squeeze'); remember('chen', 1, 'you squeezed Rennick'); remember('okafor', -0.5, 'more war'); return m; } },
        { label: 'Okafor’s way: pay down debt and wait', detail: 'Nothing happens to Kessler. Okafor +1, Chen −1.', go: () => { remember('okafor', 1, 'you kept your head'); remember('chen', -1, 'you let Kessler off'); return 'The board noted it. Kessler did not.'; } },
        { label: 'Williams’s way: a quiet truce (2 political capital)', detail: 'The war ends: no more attacks, no takeover. Ending: the truce. Williams +1, Chen −1.5.',
          disabled: cap() < 2, why: 'Needs 2 political capital', go: () => { spendPC(2); end('truce'); remember('williams', 1, 'you made peace'); remember('chen', -1.5, 'you made peace with Kessler'); return 'Williams and Rennick’s chairman had lunch. The war is over. Nobody won.'; } },
      ] });
    }
    // the shareholder rights plan, once Kessler holds 5% of us
    if (w.stake >= 5 && !w.pillUntil && !w.pillAsked && (W().stage !== 'done')) {
      w.pillAsked = true;
      items.push({ lines: [['williams', 'Kessler owns ' + w.stake.toFixed(1) + '% of us. I propose a shareholder rights plan: if anyone crosses 15% without this board’s blessing, every other shareholder buys new shares at half price.'],
                           ['petrova', 'A poison pill. The governance people will crucify us. Our shareholders should decide who owns this company.']],
        choices: [
          { label: 'Adopt the rights plan (' + (tex() ? 1 : 2) + ' political capital)', detail: 'Kessler cannot go above 14.9%: no seat by force, no hostile bid. Lasts 3 years. Petrova −1.5, share price −2% (proxy advisers). He may fight it at the next meeting.',
            disabled: cap() < (tex() ? 1 : 2), why: 'Not enough political capital', go: () => { spendPC(tex() ? 1 : 2); w.pillUntil = tq() + 12; w.pillFight = rnd() < 0.6; remember('petrova', -1.5, 'the poison pill'); remember('williams', 1, 'the rights plan'); price(0.98); return 'Adopted. Kessler is capped at 14.9%.'; } },
          { label: 'No pill', detail: 'Petrova +0.5. Kessler can keep buying.', go: () => { remember('petrova', 0.5, 'no poison pill'); return 'No pill. Petrova looked relieved.'; } },
        ] });
    }
    // Kessler fights the pill with a proxy fight
    if (w.pillUntil && w.pillFight && !w.pillFought && tq() > (w.pillQ || 0)) {
      w.pillFought = true;
      const y = window.Directors ? Directors.ytd() : null, beat = !!(y && y.you > y.sector), odds = beat ? 70 : 35;
      items.push({ guest: KESSLER, lines: [['guest', 'Your shareholders deserve a choice, not a pill. I am asking them to scrap it.']],
        effect: () => { if (rnd() * 100 < odds) return 'The shareholders voted with us (' + (beat ? 'we beat the rivals last year' : 'barely') + '). The pill stays.'; w.pillUntil = null; return 'The shareholders sided with Kessler. The pill is gone, and he is buying again.'; } });
    }
    // Kessler asks for a seat at 10%
    if (w.stake >= 10 && !w.seatAsked && !w.vossIn) {
      w.seatAsked = true;
      items.push({ guest: KESSLER, lines: [['guest', 'I own ' + w.stake.toFixed(1) + '% of this company. I want a seat for Dale Voss. You can give it to me, or I can take it at 15%.']],
        choices: [
          { label: 'Give Voss the seat', detail: 'Dale Voss joins the board now: he votes against you every time and leaks to Kessler (his attacks land 25% harder). Kessler stops buying for a year.', go: () => { vossJoins(); w.pauseUntil = tq() + 4; return 'Dale Voss took his seat. He did not smile.'; } },
          { label: 'Refuse', detail: 'He keeps buying. At 15% Voss joins anyway.', go: () => { remember('williams', 0.5, 'you refused Kessler a seat'); return 'Refused. Kessler said "see you at 15%".'; } },
        ] });
    }
    // the hostile bid at 20%: the board decides
    if (w.stake >= 20 && !w.bidVoted) {
      w.bidVoted = true;
      const dirs = GameState.board.directors || [], against = dirs.filter(d => d.id === 'voss' || d.attitude < 4.5).length;
      items.push({ guest: KESSLER, lines: [['guest', 'Rennick offers every shareholder a 20% premium for the whole company. Your board should let them decide.']],
        effect: () => {
          if (against * 2 > dirs.length) { end('prey'); GameState.meta.gameOver = true; GameState.meta.gameOverReason = 'Rennick Capital took over ' + GameState.company.name + '. The board recommended Kessler’s offer, ' + against + ' to ' + (dirs.length - against) + '. Kessler kept the buildings and let the CEO go.'; if (window.Pay) Pay.onFired(); return 'The board recommended the offer, ' + against + ' to ' + (dirs.length - against) + '. It is over.'; }
          w.stake = 14; return 'The board rejected Kessler’s bid, ' + (dirs.length - against) + ' to ' + against + '. He sold some shares in a temper (stake 14%).';
        } });
    }
    // Act 4: the takeover
    if (active() && Rivals.pnav(K) > 0 && Rivals.pnav(K) < 0.6 && w.toYear !== year) {
      w.toYear = year;
      items.push(takeoverItem());
    }
    return items;
  }

  /* The auction, round by round, as meeting items appended to the list. */
  function auctionItem(list) {
    const w = W(), p = mpz(), fee = Properties.transactionFee(w.bid);
    const can = spend() >= w.bid + fee;
    return { lines: w.bid > w.jack ? [['note', 'Kessler bids ' + money(w.bid) + '.']] : [],
      choices: [
        { label: (w.bid > w.jack ? 'Match: ' : 'Bid: ') + money(w.bid), primary: true,
          detail: 'Morrow Plaza at ' + money(w.bid) + (w.bid > w.jack ? ' (' + Math.round((w.bid / w.jack - 1) * 100) + '% over Jack’s price)' : ', Jack’s asking price') + '. Rent about ' + money(p.annualNOI) + ' a year.' + (can ? '' : ' You cannot afford it: cash plus credit line is ' + money(spend()) + '.'),
          disabled: !can, why: 'Not enough cash plus credit line',
          go: () => {
            const next = fmt(w.bid * 1.04);
            if (next > w.max) { return win(list); }                // Kessler stops
            w.bid = next; list.push(auctionItem(list)); return 'Kessler raises to ' + money(w.bid) + '.';
          } },
        ...(!can && !w.prefRaised && window.Financials && Financials.prefChoice ? [(() => { const amt = Math.ceil(w.jack * 1.15); const pc = Financials.prefChoice({ label: '', detail: 'stay in the auction.', apply: () => '' }, amt, { why: 'Morrow Plaza' });
            return { label: 'Raise ' + money(pc.amount) + ' with preferred shares, then bid', detail: pc.detail, disabled: !pc.check(), why: pc.checkMsg,
                     go: () => { const m = pc.apply(); w.prefRaised = true; list.push({ lines: Financials.prefDebate(pc.rate) }); list.push(auctionItem(list)); return m; } }; })()] : []),
        ...(!can && !w.prefRaised && window.Financials && Financials.splitChoice ? [(() => { const amt = Math.ceil(w.jack * 1.15); const sc = Financials.splitChoice({ label: '', detail: 'stay in the auction.', apply: () => '' }, amt, { why: 'Morrow Plaza' });   // round 27
            return { label: sc.label + ', then bid', detail: sc.detail, disabled: !sc.check(), why: sc.checkMsg,
                     go: () => { const m = sc.apply(); w.prefRaised = true; list.push(auctionItem(list)); return m; } }; })()] : []),
        { label: 'Stop: let Kessler have it', detail: 'Rennick buys Morrow Plaza. No war. Chen −1.5.',
          go: () => { pass(); return 'Kessler bought Morrow Plaza. He waved at you on the way out.'; } },
      ] };
  }
  function win(list) {
    const w = W(), p = mpz(), price0 = w.bid;
    GameState.cityRivals = (GameState.cityRivals || []).filter(x => x !== p); p.ownerNote = null; p.storyLock = false;
    World.buyAt(p, price0); p.vb = null;
    w.stage = 'war'; w.q0 = tq(); w.heat = 60; w.leakQ = tq() + rint(2, 3);
    remember('chen', 1, 'you won Morrow Plaza'); remember('okafor', -1, 'you borrowed for Morrow Plaza');
    note('Won Morrow Plaza for ' + money(price0) + '. The war began.');
    if (!ir()) say('Jenkins', 'Chief of Staff', 'This is now a press war',
      'Boss, Kessler does not lose quietly. Expect him in the papers. We need someone who talks to investors for a living: <b>a Head of Investor Relations</b> (Staff screen) halves the damage from his stories, and makes ours land harder.', FACE('jenkins'));
    if (list && !tex()) list.push(texItem());
    return 'Sold to us for ' + money(price0) + '. Jack shook your hand. Kessler did not. The war has begun.';
  }
  /* Tex comes with the war (round 13b): Chen proposes a seventh seat for
     someone who knows the banks. Offered when the war starts and at the next
     two meetings while it runs, unless Tex is already on the board. */
  function texItem() {
    const w = W(); w.texOffers = (w.texOffers || 0) + 1;
    const first = w.texOffers === 1;
    return { lines: [[lead('chen', 'williams'), first ? 'Kessler fights with banks and newspapers. We need someone on this board who knows both. I propose a seventh seat.' : 'The seventh seat is still open. Kessler is not slowing down.'],
                     [lead('petrova', 'okafor'), 'If the CEO fills it with a friend, the governance people will notice.']],
      choices: [
        { label: 'Nominate your friend Tex Brennan (3 political capital)', primary: true,
          detail: 'Texas real estate, knows Rennick\u2019s lenders in Dallas. In the war he doubles the bank squeeze and our leak, blocks two sales for the price of one, makes the rights plan and the friendly investor cheaper, and adds 20 points to beating Kessler\u2019s resistance in a takeover. As before: 1 political capital at every meeting to hold his seat, board fees +$0.3M a year, Petrova \u22121 for good. You have ' + cap() + '.',
          disabled: cap() < 3, why: 'Needs 3 political capital', go: () => {
            spendPC(3);
            Directors.addDirector('tex', 6, 'Tex Brennan (your nominee) joined the board, in a new seventh seat for the Rennick war.');
            if (window.Story && Story.onDirectorJoin) Story.onDirectorJoin('tex');
            note('Tex joined the board.');
            return 'Tex Brennan took the seventh seat. "Howdy, y\u2019all. I hear we have a Kessler problem."'; } },
        { label: w.texOffers >= 3 ? 'No (last time it is offered)' : 'Not now', detail: w.texOffers >= 3 ? 'The seventh seat is dropped. Tex can still join later if a director leaves.' : 'Chen will raise it again at the next meeting.',
          go: () => 'The seat stays empty for now.' },
      ] };
  }
  function pass() {
    const w = W(), p = mpz();
    p.ownerNote = null; p.storyLock = false;
    World.toRival(p, K, fmt(w.jack * 1.04));
    w.stage = 'done'; w.ending = 'none';
    remember('chen', -1.5, 'you let Kessler have Morrow Plaza');
  }

  // ============================================================================
  // BETWEEN MEETINGS: Kessler's attacks (cards), his stake, his crisis
  // ============================================================================
  function processQuarter(out) {
    ensure();
    const w = W(), s = Story.S(), now = tq();
    if (!alive()) return;
    if (w.stage === 'bid') return;
    if (!active()) return;
    if (W().vossIn && !has('voss')) { w.vossIn = false; note('Voss left our board.'); }
    heat(-2); w.press = fmt((w.press || 0) * 0.9);
    // the crisis: Rennick cracks
    const r = R(), d = Rivals.d2a(K), ph = window.Arc && Arc.phase ? Arc.phase() : null;
    if (w.stage === 'war' && (d > 0.58 || (r.lowCover > 0 && (ph === 'crisis' || ph === 'aftershock')))) {
      w.stage = 'crisis';
      say(Directors.name(lead('chen', 'petrova')), 'Director', 'Rennick is cracking',
        'Rennick’s debt is ' + pc(d * 100) + ' of its assets and its lenders are nervous. They will make Kessler sell buildings. <b>Do not buy them</b>: every dollar we pay keeps him alive. Block the sales instead (Rennick’s profile in the league table: 1 political capital a sale' + (tex() ? ', Tex makes it two' : '') + '). When his share price falls below 60% of his NAV, I will move that we buy the whole company.', FACE(lead('chen', 'petrova')));
    }
    if (s.due) return;
    const held = w.holdUntil && now < w.holdUntil;
    if (!w.leaked && now >= (w.leakQ || 999) && !held) { w.leaked = true; s.due = 'war_leak'; w.auditQ = now + rint(4, 6); return; }
    if (w.leaked && !w.audited && now >= (w.auditQ || 999) && !held) { w.audited = true; s.due = 'war_audit'; w.jabQ = now + rint(4, 6); return; }
    if (w.audited && now >= (w.jabQ || 999) && !held) { w.jabQ = now + rint(4, 6); s.due = 'war_jab'; return; }
    stakeQuarter(out);
  }

  /* Kessler buys our shares when we are the weaker one. */
  function stakeQuarter(out) {
    const w = W(), now = tq(), s = Story.S(), G = GameState;
    if (w.pauseUntil && now < w.pauseUntil) return;
    const weak = ourPnav() < 0.65 && (G.ratios.debtToAssets || 0) > 0.55;
    if (!weak || ourPnav() > 0.8) return;
    const before = w.stake;
    w.stake = fmt(Math.min(w.pillUntil && now < w.pillUntil ? 14.9 : 25, w.stake + (1.5 + rnd() * 1.5) * (window.IndexFund && IndexFund.included() ? 0.5 : 1)));   // index funds will not sell to him
    if (before < 5 && w.stake >= 5 && !s.due) { price(1.03); s.due = 'war_stake'; }
    if (before < 15 && w.stake >= 15 && !w.vossIn) {
      vossJoins();
      out.push({ good: false, text: 'Rennick now owns ' + w.stake.toFixed(1) + '% of us. Dale Voss has taken a seat on our board.' });
    }
  }
  function vossJoins() {
    const w = W(); if (w.vossIn || !window.Directors) return;
    Directors.addDirector('voss', 2, 'Dale Voss joined the board as Rennick’s nominee (Rennick owns ' + w.stake.toFixed(1) + '%).');
    w.vossIn = true; note('Voss joined our board.');
  }

  /* Rennick tries to sell a building (rivals.js asks first). */
  function blockSale(k, p, out) {
    const w = W();
    if (k !== K || w.stage !== 'crisis' || !w.blocking) return false;
    if (w.freeBlock) { w.freeBlock = false; }
    else { if (cap() < 1) { if (window.Inbox) say(Directors.name(lead('chen', 'petrova')), 'Director', 'We could not stop that sale', 'Kessler sold ' + p.name + '. We had no political capital left to talk the buyer out of it.', FACE(lead('chen', 'petrova'))); return false; }
           spendPC(1); if (tex()) w.freeBlock = true; }
    w.blocked = (w.blocked || 0) + 1; w.press = fmt((w.press || 0) + 0.04);
    out.push({ text: 'Kessler tried to sell ' + p.name + '. Your contacts talked the buyer out of it (' + (w.blocked) + ' blocked).', w: 8 });
    note('Blocked the sale of ' + p.name + '.');
    return true;
  }
  const frozen = k => k === K && W().freezeUntil && tq() < W().freezeUntil;
  /* The market's doubts about Rennick: every leak, squeeze and blocked sale
     lowers what investors will pay for his shares, fading 10% a quarter.
     rivals.js multiplies his fair price by this. */
  const drag = k => k === K && active() ? 1 - Math.min(0.3, W().press || 0) : 1;
  const spreadFor = k => k === K && W().spreadUntil && tq() < W().spreadUntil ? (W().spread || 0) : 0;

  // ============================================================================
  // OUR WEAPONS (Rennick's profile)
  // ============================================================================
  const COST = { squeeze: 2, leak: 1 };
  function canUse(kind) { const w = W(); return active() && (w.used[kind] !== GameState.meta.year) && (w.freeShot || cap() >= COST[kind]); }
  function weapon(kind) {
    const w = W(), r = R(), y = GameState.meta.year;
    if (!active()) return 'There is no war.';
    if (w.used[kind] === y) return 'Already used this year.';
    if (w.freeShot) w.freeShot = false; else { if (cap() < COST[kind]) return 'Not enough political capital.'; spendPC(COST[kind]); }
    w.used[kind] = y; heat(15);
    if (kind === 'squeeze') {
      w.spread = tex() ? 1.0 : 0.5; w.spreadUntil = tq() + 4; r.rate = fmt(r.rate + w.spread);
      if (w.stage === 'crisis') w.freezeUntil = tq() + 2;
      w.press = fmt((w.press || 0) + 0.03);
      note('The bank squeeze.');
      return 'Our banking friends called Rennick’s lenders. His borrowing cost +' + w.spread.toFixed(1) + '% for a year' + (w.stage === 'crisis' ? ', and his credit is frozen for two quarters' : '') + '.';
    }
    const drop = (tex() ? 0.10 : 0.06) + (ir() ? 0.03 : 0);
    r.price = fmt(r.price * (1 - drop)); w.press = fmt((w.press || 0) + drop); note('Our leak.');
    return 'Nora ran his interest cover on the front page. Rennick’s shares −' + Math.round(drop * 100) + '%.';
  }
  function profileHTML(k) {
    const w = W();
    if (k !== K || !active()) return '';
    const b = (id, label, ok, why) => '<button class="war-btn" data-war="' + id + '"' + (ok ? '' : ' disabled title="' + why + '"') + '>' + label + '</button>';
    return '<div class="rv-sub">The war</div><div class="war-panel">' +
      '<div class="war-heat"><span>How hot the war is</span><span class="bar"><i style="width:' + Math.round(w.heat) + '%"></i></span><b>' + Math.round(w.heat) + '</b></div>' +
      (w.freeShot ? '<div class="sml-note">Your next shot is free (Chen’s contacts).</div>' : '') +
      b('squeeze', 'The bank squeeze: ' + (w.freeShot ? 'free' : '2 political capital') + ' (his borrowing +' + (tex() ? '1.0' : '0.5') + '%)', canUse('squeeze'), w.used.squeeze === GameState.meta.year ? 'Once a year' : 'Needs 2 political capital') + ' ' +
      b('leak', 'Our own leak: ' + (w.freeShot ? 'free' : '1 political capital') + ' (his shares −' + Math.round(((tex() ? 0.10 : 0.06) + (ir() ? 0.03 : 0)) * 100) + '%)', canUse('leak'), w.used.leak === GameState.meta.year ? 'Once a year' : 'Needs 1 political capital') +
      (w.stage === 'crisis' ? '<div style="margin-top:6px">' + b('block', w.blocking ? 'Blocking his sales: ON (press to stop)' : 'Block his sales: 1 political capital each' + (tex() ? ' (Tex: two for one)' : ''), true, '') + '<span class="sml-note">' + (w.blocked || 0) + ' blocked so far. Do not buy them: cash keeps him alive.</span></div>' : '') +
      '<div class="sml-note" style="margin-top:6px">Rennick: debt ' + Math.round(Rivals.d2a(K) * 100) + '% of assets, price ' + Math.round(Rivals.pnav(K) * 100) + '% of NAV (takeover below 60%). Your political capital: ' + cap() + '.</div></div>';
  }
  function wireProfile(k) {
    document.querySelectorAll('#modal-overlay .war-btn').forEach(bt => bt.onclick = () => {
      const kind = bt.dataset.war; let msg;
      if (kind === 'block') { W().blocking = !W().blocking; msg = W().blocking ? 'Standing order: block Rennick’s sales (1 political capital each).' : 'You stopped blocking his sales.'; }
      else msg = weapon(kind);
      if (window.UI) { UI.showToast(msg, 'info'); UI.renderAll(); Rivals.openProfile(K); }
    });
  }

  // ============================================================================
  // THE TAKEOVER
  // ============================================================================
  const MIX = { shares: { label: 'Mostly our shares (75/25)', f: 0.75 }, half: { label: 'Half shares, half debt', f: 0.5 }, debt: { label: 'Mostly debt (25/75)', f: 0.25 } };
  function deal(mixKey) {
    const r = R(), G = GameState, f = MIX[mixKey].f, offer = fmt(r.price * 1.25 * r.shares), V = Rivals.value(K);
    const newShares = fmt(offer * f / G.company.sharePrice), newDebt = fmt(offer * (1 - f));
    const assetsAfter = (G.balance.totalAssets || 0) + V + Math.max(0, r.cash);
    const debtAfter = (G.balance.totalDebt || 0) + r.debt + newDebt;
    return { offer, perShare: fmt(r.price * 1.25), navDisc: Math.round((1 - r.price * 1.25 / Math.max(0.01, navPS())) * 100), newShares, dilution: Math.round(newShares / G.company.sharesOutstanding * 100),
             newDebt, theirDebt: r.debt, buildings: Rivals.bldg(K).length, value: V, d2aAfter: debtAfter / Math.max(1, assetsAfter), f };
  }
  function boardOdds(mixKey) {
    const D = deal(mixKey), dirs = GameState.board.directors || [];
    const per = dirs.map(d => {
      let p = 0.45 + 0.08 * (d.attitude - 5);
      if (d.id === 'chen') p += 0.4; if (d.id === 'tex') p = 0.97; if (d.id === 'voss') p = 0;
      if (d.id === 'okafor') p -= (1 - D.f) * 0.5; if (d.id === 'petrova') p -= D.f * 0.4;
      return { id: d.id, p: clamp(p, 0.02, 0.97) };
    });
    let dist = [{ yes: 0, chair: null, pr: 1 }];
    per.forEach(x => { const n = []; dist.forEach(s => { n.push({ yes: s.yes + 1, chair: x.id === 'williams' ? true : s.chair, pr: s.pr * x.p }); n.push({ yes: s.yes, chair: x.id === 'williams' ? false : s.chair, pr: s.pr * (1 - x.p) }); }); dist = n; });
    const N = per.length; return { per, p: dist.reduce((a, s) => a + (s.yes * 2 > N || (s.yes * 2 === N && s.chair) ? s.pr : 0), 0) };
  }
  const resistOdds = usePC => clamp((usePC ? 75 : 40) + (tex() ? 20 : 0), 5, 95);
  const holderOdds = () => clamp(45 + (0.6 - Rivals.pnav(K)) * 150, 30, 90);
  function takeoverItem() {
    const lim = Financials.covenantLimit ? Financials.covenantLimit() : 0.6;
    return { guest: VOSS, lines: [[lead('chen', 'petrova'), 'Rennick trades at ' + Math.round(Rivals.pnav(K) * 100) + '% of its NAV. I move that we buy the whole company.'],
                                   ['guest', 'Brett will not make this call, so I am here. Our lenders want this over. Make an offer and I will put it to our board.'],
                                   [lead('okafor', 'petrova'), 'Mind the covenant: we cannot go above ' + Math.round(lim * 100) + '% debt to assets.']],
      choices: Object.keys(MIX).map(k => {
        const D = deal(k), bo = boardOdds(k), ok = D.d2aAfter <= lim + 0.0001, usePC = cap() >= 2;
        const total = Math.round(bo.p * resistOdds(usePC) / 100 * holderOdds());
        return { label: MIX[k].label + ': about ' + total + '% to close', disabled: !ok, why: 'Would breach your bond covenant (debt ' + Math.round(D.d2aAfter * 100) + '% of assets)',
          detail: money(D.offer) + ' for Rennick (' + D.buildings + ' buildings worth ' + money(D.value) + ', ' + D.navDisc + '% under NAV). ' + D.newShares.toFixed(1) + 'M new shares (' + D.dilution + '% dilution) + ' + money(D.newDebt) + ' new debt, plus his ' + money(D.theirDebt) + ' of debt. Debt after: ' + Math.round(D.d2aAfter * 100) + '% of assets. Gates: our board ' + Math.round(bo.p * 100) + '%, Kessler’s resistance ' + resistOdds(usePC) + '%' + (usePC ? ' (2 political capital)' : ' (no capital to spend)') + (tex() ? ' with Tex' : '') + ', his shareholders ' + Math.round(holderOdds()) + '%.',
          go: () => attempt(k, usePC) };
      }).concat([{ label: 'Not now', detail: 'Chen −1. He will raise it again next year if Rennick is still this cheap.', go: () => { remember('chen', -1, 'you passed on Rennick'); return 'Not this year.'; } }]) };
  }
  function attempt(mixKey, usePC) {
    const w = W(), D = deal(mixKey);
    const board = rnd() < boardOdds(mixKey).p;
    if (!board) { remember('chen', -0.5, 'the board blocked the takeover'); return 'Our board voted it down. Kessler heard within the hour.'; }
    if (usePC) spendPC(2);
    const resist = rnd() * 100 < resistOdds(usePC), holders = rnd() * 100 < holderOdds();
    if (!resist || !holders) {
      oneOff(2); price(0.95); heat(30);
      return (resist ? 'Rennick’s shareholders' : 'Kessler’s board') + ' turned us down. $2M of advisers’ fees gone, and Kessler gloats in the Ledger (our price −5%).';
    }
    absorb(D);
    return 'Done. Rennick Capital is ours: ' + D.buildings + ' buildings join our portfolio.';
  }
  function absorb(D) {
    const r = R(), G = GameState;
    Rivals.bldg(K).forEach(p => {
      G.cityRivals = G.cityRivals.filter(x => x !== p);
      p.owner = null; p.purchasePrice = fmt(p.currentValue); p.quarterOwned = 0; p.vb = null; p.listedByOwner = false; p.askingPrice = null;
      G.portfolio.push(p);
    });
    const yrs = (q => ({ maturityYear: G.meta.year + q, maturityQuarter: G.meta.quarter }));
    if (r.debt > 0) G.debtTranches.push(Object.assign({ id: 'ren_' + tq(), amount: fmt(r.debt), rate: fmt(r.rate), quartersUntilMaturity: 16, label: 'Rennick bonds (assumed)' }, yrs(4)));
    if (D.newDebt > 0) G.debtTranches.push(Object.assign({ id: 'ren_acq_' + tq(), amount: fmt(D.newDebt), rate: fmt(Market.getCurrentBorrowingRate() + 0.5), quartersUntilMaturity: 28, label: 'Acquisition bonds' }, yrs(7)));
    cash(Math.max(0, r.cash));
    G.company.sharesOutstanding = fmt(G.company.sharesOutstanding + D.newShares);
    r.gone = true; r.goneQ = tq();
    const w = W(); end('takeover');
    remember('chen', 2, 'the Rennick takeover'); if (window.Directors) Directors.repChange('chen', 15, 'the Rennick takeover he pushed');
    if (window.Pay) Pay.reward('the Rennick takeover', 3.0, 200000);
    say(KESSLER.name, 'Former CEO, Rennick Capital', 'Congratulations, I suppose',
      'Enjoy the buildings. Mind the roof on Meridian Tower. I will be in touch, one way or another.', KESSLER.face);
  }
  function end(kind) { const w = W(); w.stage = 'done'; w.ending = kind; note('Ending: ' + kind + '.'); }

  // ============================================================================
  // THE CARDS (between meetings)
  // ============================================================================
  const CARDS = [
    { id: 'war_leak', system: true, story: true,
      build() {
        const m = hitMult();
        return attackCard('The Ledger: "Meridian overpaid for Morrow Plaza"', 'Nora Whitlock’s front page, fed by Kessler: we overpaid for Morrow Plaza and our NAV is inflated. Our phones have not stopped.', [
          { label: 'Call the editor (1 political capital)', detail: 'Share price −' + (3 * m).toFixed(1) + '%.', pc: 1, hit: 0.03 * m },
          { label: 'A PR campaign ($0.5M)', detail: 'Share price −' + (4 * m).toFixed(1) + '%, and Nora runs our side of the story too.', cost: 0.5, hit: 0.04 * m },
          { label: 'Say nothing', detail: 'Share price −' + (7 * m).toFixed(1) + '%. Petrova −1.', hit: 0.07 * m, pet: -1 },
        ], (ir() ? 'Your Head of IR halves every hit.' : 'A Head of IR would halve these hits.'));
      } },
    { id: 'war_audit', system: true, story: true,
      build() {
        const m = hitMult();
        return attackCard('A short report: "Valuations stale, tenant risk hidden"', 'Kessler paid a forensic accounting firm to publish a report on us. Our auditors now want an impairment test: any building worth less than its book gets written down.', [
          { label: 'Friends at the big funds vouch for us (' + (tex() ? 1 : 2) + ' political capital)', detail: 'Share price −' + (3 * m).toFixed(1) + '%, no extra test.', pc: tex() ? 1 : 2, hit: 0.03 * m },
          { label: 'An independent valuation ($0.3M)', detail: 'Share price −' + (4 * m).toFixed(1) + '%; the test uses the appraiser’s numbers (usually no write-down).', cost: 0.3, hit: 0.04 * m },
          { label: 'Sue for defamation ($1.0M)', detail: 'About half the time they retract: our price recovers +4% and Nora writes about Kessler instead. Otherwise the money is gone and the hit lands (−' + (8 * m).toFixed(1) + '%).', cost: 1.0, sue: true, hit: 0.08 * m },
          { label: 'Take it', detail: 'Share price −' + (8 * m).toFixed(1) + '%, and the full impairment test (about 3% off every building’s book value).', hit: 0.08 * m, impair: true },
        ], (ir() ? 'Your Head of IR halves every hit.' : 'A Head of IR would halve these hits.'));
      } },
    { id: 'war_jab', system: true, story: true,
      build() {
        const m = hitMult();
        const t = ['Kessler on CNBC: "Meridian is a melting ice cube"', 'Kessler tells analysts our tenants are leaving', 'A Rennick-friendly analyst cuts us to SELL'][Math.floor(rnd() * 3)];
        return attackCard(t, 'Another shot from Kessler. The heat is ' + Math.round(W().heat) + '.', [
          { label: 'Answer it (1 political capital)', detail: 'Share price −' + (2 * m).toFixed(1) + '%.', pc: 1, hit: 0.02 * m },
          { label: 'A PR campaign ($0.5M)', detail: 'Share price −' + (2.5 * m).toFixed(1) + '%.', cost: 0.5, hit: 0.025 * m },
          { label: 'Ignore him', detail: 'Share price −' + (5 * m).toFixed(1) + '%.', hit: 0.05 * m },
        ], '');
      } },
    { id: 'war_stake', system: true, story: true,
      build() {
        const w = W();
        return { title: 'Rennick discloses a ' + w.stake.toFixed(1) + '% stake in us', from: NORA + ', ' + PAPER, face: FACE('journalist'),
          body: 'Kessler has been buying our shares on the market. At 10% he will want a seat on our board; at 15% Dale Voss gets one; at 20% he can bid for the whole company. Our price is up 3% on the news: the market smells a deal.' +
                nums([['His stake', w.stake.toFixed(1) + '%'], ['He buys while', 'our price is under 65% of NAV and our debt over 55% (you: ' + Math.round(ourPnav() * 100) + '% and ' + Math.round((GameState.ratios.debtToAssets || 0) * 100) + '%)']]) +
                voice('okafor', '"Do not buy back shares now. Fewer shares out there means a bigger percentage for him."'),
          choices: [
            { label: 'A friendly investor (' + (tex() ? 1 : 2) + ' political capital)', detail: 'We sell new shares to a friendly fund: about 4% more shares, his stake falls 3 to 5 points. Petrova −0.5.',
              check: () => cap() >= (tex() ? 1 : 2), checkMsg: 'Not enough political capital',
              apply() { spendPC(tex() ? 1 : 2); const n = fmt(GameState.company.sharesOutstanding * 0.04); GameState.company.sharesOutstanding = fmt(GameState.company.sharesOutstanding + n); cash(fmt(n * GameState.company.sharePrice * 0.95)); w.stake = fmt(Math.max(0, w.stake - 3 - rnd() * 2)); remember('petrova', -0.5, 'shares sold to a friendly fund'); return 'A friendly fund bought ' + n.toFixed(2) + 'M new shares. Kessler’s stake is down to ' + w.stake.toFixed(1) + '%.'; } },
            { label: 'Rally the shareholders (' + (ir() ? 1 : 2) + ' political capital)', detail: 'Calls to our biggest holders: they will not sell to him. His buying pauses for a year.',
              check: () => cap() >= (ir() ? 1 : 2), checkMsg: 'Not enough political capital',
              apply() { spendPC(ir() ? 1 : 2); w.pauseUntil = tq() + 4; return 'Our biggest holders promised not to sell to Rennick this year.'; } },
            { label: 'An investor roadshow ($0.5M)', detail: 'The same, paid in money: his buying pauses for a year.',
              apply() { oneOff(0.5); w.pauseUntil = tq() + 4; return 'A week of breakfasts with fund managers. His buying pauses.'; } },
            { label: 'Wait', detail: 'Fix the numbers instead: above 80% of NAV he stops buying on his own.', apply() { return 'Noted. The board will discuss it at the meeting.'; } },
          ] };
      } },
  ];
  /* An attack card with three or four answers. */
  function attackCard(title, body, opts, foot) {
    const w = W();
    return { title, from: NORA + ', ' + PAPER, face: FACE('journalist'),
      body: body + (foot ? '<div class="dv-nums">' + foot + '</div>' : '') + voice(lead('petrova', 'williams'), '"Whatever we do, do it today."'),
      choices: opts.map(o => ({ label: o.label, detail: o.detail,
        check: o.pc ? () => cap() >= o.pc : o.cost ? () => spend() >= o.cost : null, checkMsg: o.pc ? 'Not enough political capital' : 'Not enough cash',
        apply() {
          if (o.pc) spendPC(o.pc); if (o.cost) oneOff(o.cost);
          heat(10);
          if (o.sue) { if (rnd() < (window.Agents ? Agents.chance('war', 0.5) : 0.5)) { price(1.04); heat(15); return 'The short seller retracted. Our price +4%, and Nora wrote about Kessler instead.'; } price(1 - o.hit); return 'The case went nowhere. $1M gone, and the hit landed: price −' + (o.hit * 100).toFixed(1) + '%.'; }
          price(1 - o.hit);
          if (o.pet) remember('petrova', o.pet, 'Kessler’s story went unanswered');
          if (o.impair) { if (window.IndexFund) IndexFund.writeDown(fmt((GameState.portfolio || []).reduce((t, p) => t + p.currentValue, 0) * 0.03)); (GameState.portfolio || []).forEach(p => { p.baseValue = fmt((p.baseValue || p.currentValue) * 0.97); }); return 'Price −' + (o.hit * 100).toFixed(1) + '%. The auditors marked every building down about 3%.'; }
          return 'Price −' + (o.hit * 100).toFixed(1) + '%.';
        } })) };
  }
  if (window.World && World.DECISIONS) CARDS.forEach(c => { if (!World.DECISIONS.some(d => d.id === c.id)) World.DECISIONS.push(c); });

  /* The war's ending, for the Year 15 screen. */
  function ending() {
    const w = W();
    if (w.ending) return { takeover: 'The takeover: you bought Rennick.', truce: 'The truce: both of you survived.', prey: 'The prey: Kessler took you over.', none: 'No war: you let Kessler have Jack\u2019s building.' }[w.ending] || '';
    if (w.stage === 'crisis' || w.blocked) return 'The siege: you blocked his sales and he is a shadow, but you never closed.';
    if (w.stage === 'war') return 'The cold war: fifteen years of headlines, and nobody won.';
    return '';
  }

  /* For tests: jump the war to a stage. */
  function debug(o) { Object.assign(W(), o || {}); return W(); }

  return { W, ending, ensure, agenda, processQuarter, blockSale, frozen, spreadFor, drag, weapon, canUse, profileHTML, wireProfile, deal, boardOdds, debug, ourPnav };
})();
