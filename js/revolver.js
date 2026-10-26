/* ============================================================================
   revolver.js — the revolving credit facility (design doc B.13a, round 3).

   CASH SWEEP, as in a standard corporate model:
     cash below zero  = drawn on the revolver
     cash back above  = the revolver is repaid automatically
   So the player sees ONE cash number. Below zero, the top bar shows how much
   line is left, and the Finance screen shows the facility itself.

   It replaces v1's overdraft (free money down to -$50M). Now:
   - you can draw up to the LIMIT, at a floating rate (base + spread);
   - unused line costs a small commitment fee;
   - over the limit = a missed payment = default, the game ends.

   RENEWAL every 3 years. If your numbers got worse since the last renewal, the
   bank re-prices and imposes conditions (dividend freeze, cut leverage, lift
   interest cover). Refuse, or break a condition, and the line is FROZEN:
   repay only, no new draws (Alexander's rule). Profits pay it down; once it is
   fully repaid for two quarters, the bank reopens it, smaller. Needing to draw
   MORE than you owe on a frozen line is a default.
   ========================================================================== */

window.Revolver = (() => {

  const fmt = n => Math.round(n * 100) / 100;
  const money = n => '$' + Math.abs(n).toFixed(1) + 'M';
  const RENEW_EVERY = 12;            // quarters
  const FEE = 0.25;                  // % a year on the undrawn line
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const R = () => GameState.revolver;

  function sizeFor(assets) { return Math.max(20, Math.round(assets * 0.13)); }   // ~13% of assets, $20M floor

  function init() {
    const assets = (GameState.portfolio || []).reduce((a, p) => a + p.currentValue, 0) + Math.max(0, GameState.balance.cash);
    GameState.revolver = {
      limit: sizeFor(assets), extraSpread: 0, frozen: false, frozenCap: 0, cleanQ: 0,
      renewAt: tq() + RENEW_EVERY, conditions: [], last: metrics(), crunchCut: false, history: []
    };
  }

  // -- the numbers ----------------------------------------------------------
  const drawn = () => Math.max(0, -GameState.balance.cash);
  const available = () => { const r = R(); return !r || r.frozen ? 0 : Math.max(0, r.limit - drawn()); };
  /* Floating: base rate + your credit spread, a little cheaper than a bond
     (short, senior, callable), plus any penalty spread from a bad renewal. */
  function rate() {
    const r = R(); if (!r) return 0;
    const arc = (window.Arc && Arc.spreadAdd) ? Arc.spreadAdd() : 0;
    return fmt(GameState.market.baseInterestRate + GameState.credit.spread + 2.0 + arc + r.extraSpread);   // round 17: an emergency line, dearer than any bond (was −0.3)
  }
  /* What the line costs this quarter: interest on what's drawn, fee on the rest. */
  function costQ() {
    const r = R(); if (!r) return 0;
    const d = drawn(), undrawn = r.frozen ? 0 : Math.max(0, r.limit - d);
    return fmt(d * rate() / 100 / 4 + undrawn * FEE / 100 / 4);
  }
  /* What the player can spend right now: cash plus the unused line. */
  const spendable = () => fmt(GameState.balance.cash + available());

  function metrics() {
    const G = GameState, order = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC'];
    return { d2a: G.ratios.debtToAssets || 0, cover: G.ratios.interestCoverage || 9, rating: order.indexOf(G.credit.rating) };
  }

  // -- conditions the bank can impose ---------------------------------------
  const COND = {
    divfreeze: { text: c => 'No dividend increases until Y' + yq(c.until), test: () => true },
    deleverage: { text: c => 'Debt below ' + Math.round(c.target * 100) + '% of assets by Y' + yq(c.until),
                  test: c => (GameState.ratios.debtToAssets || 0) <= c.target },
    cover: { text: c => 'Interest cover above ' + c.target.toFixed(1) + 'x by Y' + yq(c.until),
             test: c => (GameState.ratios.interestCoverage || 0) >= c.target },
  };
  function yq(t) { return (Math.floor((t - 1) / 4) + 1) + ' Q' + ((t - 1) % 4 + 1); }
  const dividendFrozen = () => { const r = R(); return !!(r && r.conditions.some(c => c.id === 'divfreeze' && tq() < c.until)); };

  // -- the quarter ------------------------------------------------------------
  /* Runs at the end of runQuarter, after cash has settled. Returns inbox lines. */
  function processQuarter() {
    const r = R(), G = GameState, out = [];
    if (!r || G.meta.gameOver) return out;
    const now = tq();

    // round 9: the first time you use the line, Jenkins explains it, with your numbers
    if (drawn() > 0 && !r.explained && window.Inbox) {
      r.explained = true;
      Inbox.message('Jenkins', 'Chief of Staff', 'We are using the credit line',
        'Boss, our cash went below zero this quarter, so the bank\u2019s credit line covered it. We owe ' + money(drawn()) + ' of our ' + money(r.limit) + ' line.<br>' +
        '<b>How it works:</b> cash below zero is drawn on the line automatically; cash above zero repays it. We pay <b>' + rate().toFixed(2) + '% a year</b> on what we draw (floating, it moves with rates) and ' + FEE + '% on the part we don\u2019t use.<br>' +
        'It is the most expensive money we have. A bond costs less. If we run past the whole line, the company defaults. Details on the Finance screen.', 'assets/faces/jenkins.jpg');
    }

    // credit crunch: banks cut undrawn lines (2008)
    if (!r.crunchCut && window.Arc && Arc.phase && Arc.phase() === 'crisis' && G.arc && G.arc.variant === 'credit_crunch') {
      r.crunchCut = true;
      const before = r.limit; r.limit = Math.max(Math.ceil(drawn()), Math.round(r.limit * 0.75));
      if (r.limit < before) out.push({ good: false, text: 'Your bank cut the credit line from ' + money(before) + ' to ' + money(r.limit) + '. Every bank is doing it.' });
    }

    // conditions that fall due
    r.conditions = r.conditions.filter(c => {
      if (now < c.until) return true;
      if (c.id === 'divfreeze') { out.push({ good: true, text: 'The bank’s dividend freeze has ended.' }); return false; }
      if (COND[c.id].test(c)) { out.push({ good: true, text: 'Bank condition met: ' + COND[c.id].text(c).replace(/ by Y.*/, '') + '.' }); return false; }
      freeze('you missed the bank’s condition (' + COND[c.id].text(c) + ')', out);
      return false;
    });

    // frozen line: repay only. What you owe can only go down.
    if (r.frozen) {
      if (drawn() > r.frozenCap + 0.05 && !forcedSales(r.frozenCap, out))
        defaultNow('Your credit line is frozen at ' + money(r.frozenCap) + ' and you needed ' + money(drawn()) + ', with nothing left to sell. A payment was missed.');
      else {
        r.frozenCap = Math.min(r.frozenCap, drawn());
        r.cleanQ = drawn() <= 0 ? (r.cleanQ || 0) + 1 : 0;
        if (r.cleanQ >= 2) { r.frozen = false; r.cleanQ = 0; r.limit = Math.max(15, Math.round(r.limit * 0.6));
          out.push({ good: true, text: 'Fully repaid. The bank reopens your credit line, smaller: ' + money(r.limit) + '.' }); }
      }
    }

    // over the limit: the lenders force sales first; only then is it a default
    if (!G.meta.gameOver && !r.frozen && drawn() > r.limit + 0.05 && !forcedSales(r.limit, out))
      defaultNow('You needed ' + money(drawn()) + ' but your credit line is ' + money(r.limit) + ', with nothing left to sell. A payment was missed.');

    // renewal
    if (!G.meta.gameOver && now >= r.renewAt) renewal(out);
    return out;
  }

  /* Lenders enforce before they give up: they force the sale of your weakest
     buildings at 15% below value until what you owe fits under the cap.
     Returns true if that worked. Real-world: distressed asset sales. */
  function forcedSales(cap, out) {
    const G = GameState, sold = [];
    while (drawn() > cap + 0.05 && G.portfolio.length) {
      const p = G.portfolio.slice().filter(x => !x.underConstruction).sort((a, b) => a.occupancy - b.occupancy)[0] || G.portfolio[0];
      const price = fmt(p.currentValue * 0.85);
      G.balance.cash = fmt(G.balance.cash + price);
      Properties.handOver(p, 'rival', price);
      sold.push(p.name + ' (' + money(price) + ')');
    }
    if (sold.length) out.push({ good: false, text: 'Your lenders forced a sale to cover what you owe: ' + sold.join(', ') + ', at 15% below value.' });
    return drawn() <= cap + 0.05;
  }

  function freeze(why, out) {
    const r = R(); if (r.frozen) return;
    r.frozen = true; r.frozenCap = drawn(); r.cleanQ = 0;
    out.push({ good: false, text: 'Credit line FROZEN: ' + why + '. Repay only, no new draws' + (drawn() > 0 ? ': ' + money(drawn()) + ' still owed, and you cannot go deeper.' : '.') });
  }

  function defaultNow(why) {
    const G = GameState;
    G.meta.gameOver = true;
    G.meta.gameOverReason = G.player.name + ', ' + G.company.name + ' has defaulted. ' + why +
      ' Lenders have appointed administrators after ' + G.meta.totalQuarters + ' quarters.';
  }

  /* Every 3 years the bank looks at you again. */
  function renewal(out) {
    const r = R(), G = GameState, now = metrics(), was = r.last;
    const assets = (G.balance.totalAssets || 0);
    // a meeting nobody answered (only happens in headless simulations): settle it
    if (G._renewalTerms) { out.push({ good: false, text: acceptTerms() }); return; }
    if (G._renewalOffer) { out.push({ good: true, text: acceptOffer('same') }); return; }
    const worse = [];
    // growth on borrowed money is fine; the bank reacts to RISKY territory
    if (now.rating > was.rating && now.rating >= 4) worse.push('rating');           // down to BB or below
    if (now.d2a > 0.45 && now.d2a > was.d2a + 0.05) worse.push('leverage');
    if (now.cover < 2.5 && now.cover < was.cover - 0.5) worse.push('cover');
    const crunch = window.Arc && Arc.phase && Arc.phase() === 'crisis';
    if (!worse.length && !crunch) {
      // the review meeting (world.js "revolver_review"): choose the size
      const base = Math.max(r.limit, sizeFor(assets));
      G._renewalOffer = { same: base, bigger: Math.min(Math.round(base * 1.5), Math.round(assets * 0.25)), smaller: Math.max(15, Math.round(base * 0.7)) };
      r.renewAt = tq() + 1;
      return;
    }
    // worse: the bank's terms wait in the inbox as a decision (world.js "revolver_renewal")
    G._renewalTerms = terms(worse, crunch, now);
    r.renewAt = tq() + 1;       // asks again next quarter if ignored
  }

  /* What the bank wants, depending on what got worse. */
  function terms(worse, crunch, now) {
    const t = tq(), conds = [];
    if (worse.indexOf('leverage') > -1 || worse.indexOf('rating') > -1)
      conds.push({ id: 'deleverage', target: Math.max(0.40, Math.round((now.d2a - 0.03) * 100) / 100), until: t + 8 });
    if (worse.indexOf('cover') > -1)
      conds.push({ id: 'cover', target: Math.max(1.75, Math.round(Math.min(now.cover + 0.3, 2.5) * 10) / 10), until: t + 8 });
    conds.push({ id: 'divfreeze', until: t + 8 });
    return { worse, crunch, spread: 0.75 + (worse.length > 1 ? 0.5 : 0) + (crunch ? 0.5 : 0), cut: 0.25, conds };
  }

  /* Called by the decision. */
  function acceptTerms() {
    const r = R(), T = GameState._renewalTerms; if (!T) return '';
    r.extraSpread = fmt(r.extraSpread + T.spread);
    r.limit = Math.max(Math.ceil(drawn()), Math.round(r.limit * (1 - T.cut)));
    r.conditions = r.conditions.filter(c => c.id !== 'divfreeze').concat(T.conds);
    r.renewAt = tq() + RENEW_EVERY; r.last = metrics();
    GameState._renewalTerms = null;
    return 'Renewed: ' + money(r.limit) + ' line, +' + T.spread.toFixed(2) + '% on the rate. Conditions: ' + T.conds.map(c => COND[c.id].text(c)).join('; ') + '.';
  }
  /* Numbers held up: the player picks the size. Bigger needs the bank's yes. */
  function bigOdds() {
    const G = GameState, cfo = window.Staff && Staff.getStaff && Staff.getStaff('cfo');
    let p = 0.5 + (cfo ? (cfo.skill - 5) * 0.06 : -0.1);
    if ((G.ratios.debtToAssets || 0) < 0.40) p += 0.2;
    if (['BB', 'B', 'CCC'].indexOf(G.credit.rating) > -1) p -= 0.3;
    return Math.max(0.1, Math.min(0.9, p));
  }
  function acceptOffer(choice) {
    const r = R(), O = GameState._renewalOffer; if (!O) return '';
    GameState._renewalOffer = null;
    r.extraSpread = Math.max(0, r.extraSpread - 0.25);
    r.renewAt = tq() + RENEW_EVERY; r.last = metrics();
    r.conditions = r.conditions.filter(c => c.id === 'divfreeze' && tq() < c.until);
    if (choice === 'bigger') {
      if (Math.random() < bigOdds()) { r.limit = O.bigger; return 'The bank agreed: a ' + money(r.limit) + ' line for 3 years. More room, and more idle line to pay for.'; }
      r.limit = O.same; return 'The bank said no to more, and renewed ' + money(r.limit) + ' for 3 years.';
    }
    r.limit = Math.max(Math.ceil(drawn()), choice === 'smaller' ? O.smaller : O.same);
    return 'Credit line renewed for 3 years: ' + money(r.limit) + '.';
  }
  /* Numbers got worse: push back. The CFO negotiates. */
  function pushOdds() {
    const cfo = window.Staff && Staff.getStaff && Staff.getStaff('cfo');
    return cfo ? Math.min(0.8, 0.3 + cfo.skill * 0.05) : 0.2;
  }
  function pushBack() {
    const T = GameState._renewalTerms; if (!T) return '';
    if (Math.random() < pushOdds()) {
      T.spread = 0.25; T.conds = T.conds.filter(c => c.id !== 'divfreeze');
      return 'Your CFO talked them down: +0.25% only, and no dividend freeze. ' + acceptTerms();
    }
    T.spread += 0.25;
    return 'The bank did not enjoy being pushed. ' + acceptTerms();
  }

  function refuseTerms() {
    const r = R(), out = [];
    GameState._renewalTerms = null; r.renewAt = tq() + RENEW_EVERY; r.last = metrics();
    freeze('you refused the bank’s terms', out);
    return out.length ? out[0].text : 'Credit line frozen.';
  }

  /* Political capital (2.0): the Chairman calls the bank's chairman. The one
     currency that works everywhere: boardroom, events, and the bank. */
  const FAVOUR = { terms: 2, bigger: 1, lift: 2, thaw: 3 };
  const cap = () => (GameState.board && GameState.board.politicalCapital) || 0;
  const payCap = n => { GameState.board.politicalCapital = cap() - n; };
  const canFavour = k => cap() >= FAVOUR[k];
  function favourTerms() {          // bad renewal: soft terms
    const T = GameState._renewalTerms; if (!T || !canFavour('terms')) return '';
    payCap(FAVOUR.terms);
    T.spread = 0.25; T.conds = []; T.cut = T.cut / 2;
    return 'Williams called the bank\u2019s chairman. ' + acceptTerms().replace(/ Conditions: \.$/, ' No conditions.');
  }
  const favourOdds = () => Math.min(0.95, bigOdds() + 0.35);
  function favourBigger() {         // good review: a bigger line, with a push
    const r = R(), O = GameState._renewalOffer; if (!O || !canFavour('bigger')) return '';
    payCap(FAVOUR.bigger);
    GameState._renewalOffer = null;
    r.extraSpread = Math.max(0, r.extraSpread - 0.25);
    r.renewAt = tq() + RENEW_EVERY; r.last = metrics();
    r.conditions = r.conditions.filter(c => c.id === 'divfreeze' && tq() < c.until);
    if (Math.random() < favourOdds()) { r.limit = O.bigger; return 'A word from the Chairman helped: a ' + money(r.limit) + ' line for 3 years.'; }
    r.limit = O.same; return 'Even the Chairman\u2019s call didn\u2019t move them. Renewed at ' + money(r.limit) + '.';
  }
  function liftCondition(i) {       // drop one bank condition
    const r = R(); if (!r || !r.conditions[i] || !canFavour('lift')) return '';
    payCap(FAVOUR.lift);
    const c = r.conditions.splice(i, 1)[0];
    return 'The bank dropped a condition: ' + COND[c.id].text(c) + '.';
  }
  function thaw() {                 // reopen a frozen line now, smaller and dearer
    const r = R(); if (!r || !r.frozen || !canFavour('thaw')) return '';
    payCap(FAVOUR.thaw);
    r.frozen = false; r.cleanQ = 0;
    r.limit = Math.max(Math.ceil(drawn()) + 5, Math.round(r.limit * 0.8));
    r.extraSpread = fmt(r.extraSpread + 0.5);
    return 'The bank reopened your line as a favour: ' + money(r.limit) + ', +0.50% on the rate.';
  }

  /* Short lines for the inbox's "On the clock" list. */
  function clockRows() {
    const r = R(), rows = []; if (!r) return rows;
    const now = tq(), q = n => n <= 0 ? 'this quarter' : n === 1 ? '1 qtr' : n + ' qtrs';
    if (r.frozen) rows.push({ tone: 'bad', k: 'Credit line frozen: repay only', v: money(drawn()) + ' owed' });
    else if (drawn() > 0) rows.push({ tone: drawn() > r.limit * 0.75 ? 'bad' : 'warn', k: 'Credit line used: ' + money(drawn()) + ' of ' + money(r.limit), v: money(available()) + ' left' });
    r.conditions.forEach(c => rows.push({ tone: 'warn', k: 'Bank: ' + COND[c.id].text(c).replace(/ (until|by) Y.*/, ''), v: q(c.until - now) }));
    if (r.renewAt - now <= 4) rows.push({ tone: '', k: 'Credit line review', v: 'in ' + q(r.renewAt - now) });
    return rows;
  }

  return { init, drawn, available, rate, costQ, spendable, processQuarter, acceptTerms, refuseTerms,
           acceptOffer, pushBack, bigOdds, pushOdds, sizeFor,
           FAVOUR, canFavour, favourTerms, favourBigger, favourOdds, liftCondition, thaw,
           dividendFrozen, clockRows, COND, yq, FEE };
})();
