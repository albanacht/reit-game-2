/* ============================================================================
   directors.js — the board's brains (design doc B.1a §8, round 4 part 1).

   A director's mood is RECALCULATED every quarter, not nudged:
     mood = 5 + how you are doing against what they expect
              + what they remember you did (fades over 3 years)
              + spillover from their ally (or against their rival)
   So it is predictable, it never heals by itself, and every mood has a cause.
   The result is written to GameState.board.directors[i].attitude (0-10), the
   field v1's meeting and vote already read.

   Expectations move with circumstances (Situation + the Arc): in a crisis the
   Chairman accepts a dividend HOLD but never a cut; Chen WANTS buying in a
   crisis. Each director has one red line that turns them hostile at once.

   No live AI. Rules + memory at runtime; more line variety comes later as data.

   Also here: the REIT SECTOR INDEX (benchmark until rivals have real
   finances) and the SCORECARD (what each director is judging, visible to the
   player all year: "no director judges you on a number you can't see").
   ========================================================================== */

window.Directors = (() => {

  const FADE_Q = 10;                                   // memory fades over ~2.5 years
  const ALLY = { williams: 'petrova', petrova: 'williams' };
  const RIVAL = { chen: 'okafor', okafor: 'chen' };
  // 5 out of 10 is neutral, and neutral reads as Content
  // Unhappy and Furious vote against you (meeting.js AGAINST = 3)
  const LEVELS = [[7.5, 'Delighted', 'lv-5'], [4.75, 'Content', 'lv-4'], [3, 'Uneasy', 'lv-3'], [1.75, 'Unhappy', 'lv-2'], [-1, 'Furious', 'lv-1']];
  const ROLE = { williams: 'Chairman', chen: 'Growth', okafor: 'Balance sheet', petrova: 'Shareholders', hassan: 'Operations', activist: 'Activist investor',
                 mansour: 'Operations', grace: 'Sustainability', tex: 'Government affairs', voss: 'Rennick\u2019s nominee' };
  const RED = {
    williams: 'a dividend cut', petrova: 'selling more than 10% new shares in a year below 85% of NAV', chen: 'three years without buying a building',
    okafor: 'a frozen credit line or a broken bank condition', hassan: 'occupancy below 80%',
    activist: 'selling new shares below NAV',
    mansour: 'any building below 75% occupancy', grace: 'cancelling a sustainability initiative', tex: 'none: he is your friend', voss: 'none: he answers to Kessler'
  };
  const GRUMPY = { activist: -1.5 };                   // starts sour, stays demanding
  const has = id => (GameState.board.directors || []).some(d => d.id === id);
  const pnav = () => { const n = GameState.ratios.navPerShare; return n > 0 ? GameState.company.sharePrice / n : 1; };
  const rivalsPnav = () => window.Rivals && GameState.rivals && Rivals.pnavAvg ? Rivals.pnavAvg() : 0.9;
  /* The activist wants your discount no worse than the rivals' (never more than 90% of NAV). */
  const actWant = () => Math.min(0.9, Math.round(rivalsPnav() * 20) / 20);

  const fmt = n => Math.round(n * 100) / 100;
  const pct = (n, dp) => (n >= 0 ? '+' : '−') + Math.abs(n * 100).toFixed(dp == null ? 0 : dp) + '%';
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const baseName = id => { const d = (window.Board && Board.DIRECTORS || []).find(x => x.id === id); return d ? d.name : id; };
  /* round 14: the chair can change (tower.js). A new chair is called "Chair X". */
  const name = id => { const b = GameState.board || {}; return b.chair === id && id !== 'williams' ? baseName(id).replace(/^(Chairman|Director) /, 'Chair ') : baseName(id); };
  /* Who chairs the meeting: Williams, his successor, or (if you are executive
     chairman) the lead independent director speaks for the board. */
  function chair() {
    const b = GameState.board || {}, ds = b.directors || [];
    if (b.chair === 'you') return ds.some(d => d.id === 'petrova') ? 'petrova' : (ds.find(d => d.id !== 'tex' && d.id !== 'voss') || ds[0] || {}).id;
    if (b.chair && ds.some(d => d.id === b.chair)) return b.chair;
    return ds.some(d => d.id === 'williams') ? 'williams' : (ds[0] || {}).id;
  }
  /* A new chair brings a red line of their own in place of Williams's dividend rule. */
  const CHAIR_RED = {
    okafor:  { text: 'debt above 55% of assets', crossed: () => (GameState.ratios.debtToAssets || 0) > 0.55 },
    petrova: { text: 'share price below 85% of NAV', crossed: () => pnav() < 0.85 },
    chen:    { text: 'cash profit per share falling', crossed: () => { const a1 = sumLast(4, 'affoPerShare'), a0 = H().length >= 8 ? sumLast(4, 'affoPerShare', 4) : null; return a1 != null && a0 > 0.1 && a1 < a0; } },
  };
  const chairRed = id => GameState.board && GameState.board.chair === id ? CHAIR_RED[id] || null : null;
  const short = id => name(id).replace(/^(Chairman|Director) /, '');
  const face = id => 'assets/faces/' + id + '.jpg';
  const level = a => LEVELS.find(l => a >= l[0]);

  function B() {
    const b = GameState.board;
    if (!b.brain) b.brain = { memory: [], prev: {}, causes: {}, red: {}, sector: { level: 100, hist: [], lastTotal: null },
                              shares: [], owned: null, buys: [], lastBuyQ: 0, holdings: [] };
    if (!b.brain.holdings) b.brain.holdings = [];
    return b.brain;
  }

  // -- context ------------------------------------------------------------
  function crisis() {
    const s = window.Situation && Situation.get ? Situation.get().state : 'stable';
    const ph = window.Arc && Arc.phase ? Arc.phase() : null;
    return s === 'crisis' || s === 'distress' || ph === 'crisis';
  }
  const H = () => GameState.history || [];
  function ago(n, key) { const h = H(); const e = h[h.length - 1 - n]; return e ? e[key] : null; }
  function sumLast(n, key, off) { const h = H(); let t = 0, c = 0; for (let i = h.length - 1 - (off || 0); i >= 0 && c < n; i--, c++) t += h[i][key] || 0; return c ? t : null; }

  // -- memory -------------------------------------------------------------
  function remember(id, d, text) {
    if (!id || !d) return;
    const m = B().memory;
    m.push({ id, d: fmt(d), t: text || 'something you did', q: tq() });
    while (m.length > 80) m.shift();
  }
  const weight = e => Math.max(0, 1 - (tq() - e.q) / FADE_Q);
  // what they remember is capped too: a grudge can sink a mood, but not to the floor on its own
  function memoryPts(id) { return Math.max(-4, Math.min(4, B().memory.filter(e => e.id === id).reduce((t, e) => t + e.d * weight(e), 0))); }
  function memories(id) { return B().memory.filter(e => e.id === id && weight(e) > 0.15).slice(-4).reverse(); }

  /* -- bonds: friend or foe (2.0 round 7) ------------------------------------
     Memory fades in ~2.5 years. A bond does not: it is what a director thinks
     of YOU after the things you did together (backing his deal, or killing
     it). Worth up to ±2 on the mood, for good. The board stories build on it. */
  function bond(id, d, why) {
    const b = B(); b.bonds = b.bonds || {};
    const x = b.bonds[id] || { pts: 0, why: [] };
    x.pts = Math.max(-3, Math.min(3, fmt(x.pts + d)));
    if (why) { x.why.unshift(why); x.why = x.why.slice(0, 3); }
    b.bonds[id] = x;
  }
  const bondPts = id => { const x = (B().bonds || {})[id]; return x ? Math.max(-2, Math.min(2, x.pts)) : 0; };
  function bondOf(id) {
    const x = (B().bonds || {})[id]; if (!x || Math.abs(x.pts) < 1) return null;
    return { pts: x.pts, label: x.pts >= 2 ? 'Ally' : x.pts >= 1 ? 'Friendly' : x.pts <= -2 ? 'Enemy' : 'Cold', why: x.why[0] || '' };
  }

  // -- what each director is judging ----------------------------------------
  /* Returns [{pts, why}] for one director. Thresholds match the scorecard. */
  function judge(id) {
    const G = GameState, r = G.ratios, out = [], cr = crisis();
    const add = (pts, why) => out.push({ pts, why });
    if (id === 'williams') {
      const d0 = ago(4, 'dividendPerShare') != null ? ago(4, 'dividendPerShare') : (G.board.startYearDividend || G.company.dividendPerShare);
      const d1 = G.company.dividendPerShare, g = d0 > 0 ? d1 / d0 - 1 : 0, want = williamsTarget();
      const pr = payout(), over = overPaying() > 0;
      if (B().red.williams) add(-4, 'you cut the dividend');
      else if (over) {
        // round 21: he loves a good dividend, not at the cost of survival. Growth earns little while it is not earned.
        if (g > 0.005) add(0.5, 'dividend up ' + pct(g) + ' in a year, but not paid from profit');
        add(-Math.min(5, overPaying() * (pr >= 2 ? 1 : 0.6)),   // twice what we earn: a point a quarter; a little over: slower
           'dividend ' + (pr >= 9 ? 'with no cash profit behind it' : 'is ' + Math.round(pr * 100) + '% of cash profit') + ': he loves a good dividend, not at the cost of survival');
      }
      else if (d1 < d0 - 0.0005 && cutForgiven()) add(-0.5, 'you cut the dividend back to what we earn; he accepts it');
      else if ((G.meta.totalQuarters || 0) <= 4) add(0, 'no dividend target until after the first meeting');   // round 17: Year 1 is for learning
      else if (cr && g >= 0) add(0.5, 'you held the dividend through a hard year');
      else if (g >= want) add(2.5, 'dividend up ' + pct(g) + ' in a year (target ' + pct(want) + ')');
      else if (g > 0.005) add(0.5 + 1.5 * g / want, 'dividend up ' + pct(g) + ' in a year, short of the ' + pct(want) + ' target');
      else add(-1.5, 'no dividend rise in a year (target ' + pct(want) + ')');
    }
    if (id === 'petrova') {
      const y = ytd();
      if (y) { const gap = y.you - y.sector; add(Math.max(-3, Math.min(3, gap * 100 / 4)), 'total return ' + pct(y.you, 1) + ' vs ' + (y.bench === 'rivals' ? 'the rivals’ ' : 'the sector’s ') + pct(y.sector, 1) + ' (' + y.label + ')'); }
      const dil = dilution();
      if (overPaying() >= 2) { const pr = payout(); add(-Math.min(3, 0.6 * (overPaying() - 1)), 'dividend ' + (pr >= 9 ? 'with no cash profit behind it' : Math.round(pr * 100) + '% of cash profit') + ': investors price it as a one-off'); }
      // round 35: her line is cheap shares (below 85% of NAV); shares that bought buildings, once explained, she accepts
      if (B().red.petrova) add(-3, 'you sold ' + pct(cheapDilution()) + ' new shares below 85% of NAV in a year');
      else if (dil > 0.01 && !(B().explainedQ && tq() - B().explainedQ < 4)) add(-1, 'you sold ' + pct(dil) + ' new shares');
    }
    if (id === 'chen') {
      // two full years of history, and a real base: early quarters make silly percentages
      const a1 = sumLast(4, 'affoPerShare'), a0 = H().length >= 8 ? sumLast(4, 'affoPerShare', 4) : null;
      if (a1 != null && a0 && a0 > 0.1) {
        const g = a1 / a0 - 1;
        if (a1 <= 0) add(-1.5, 'cash profit per share fell below zero');
        else add(g > 0.08 ? 2 : g > 0.03 ? 1 : g >= -0.03 ? 0 : -1.5, 'cash profit per share ' + pct(g) + ' in a year');
      }
      const n = buysIn(4);
      const sk = shrink();
      if (sk > 0.15) add(-Math.min(4, sk * 10), 'sold ' + Math.round(sk * 100) + '% more of the portfolio than you bought in two years: a landlord, not a piggy bank');
      if (B().red.chen) add(-2.5, 'no building bought in three years');
      else if (n > 0) add(Math.min(2, n), n + ' building' + (n > 1 ? 's' : '') + ' bought in a year');
      else add(cr ? -1.5 : -0.5, cr ? 'no buying in a crisis, when prices are lowest' : 'no building bought this year');
    }
    if (id === 'okafor') {
      // round 18: borrowing to buy good buildings is fine; he worries above 55% (50% in a crisis), with the bond covenant at 60%
      // round 34: one line, 55%, crisis or not. Above it he wants a step a year (his demand: 3 points down), not a miracle.
      const d2a = r.debtToAssets || 0, cov = r.interestCoverage || 9, T = okaforTarget(), D = Math.round(d2a * 100);
      const was = ago(4, 'debtToAssets'), falling = was != null && was > d2a + 0.01;
      if (d2a < 0.40) add(1.5, 'debt at ' + D + '% of assets');
      else if (d2a < 0.50) add(0.5, 'debt at ' + D + '% of assets');
      else if (d2a <= OK_LINE + 0.005) add(0, 'debt at ' + D + '% of assets, close to his 55% line');
      else if (d2a <= T + 0.005) add(-0.5, 'debt at ' + D + '%, above his 55% line but on his plan (' + Math.round(T * 100) + '% this year)');
      else if (falling) add(-1, 'debt at ' + D + '%, above his plan (' + Math.round(T * 100) + '%), but coming down');
      else add(d2a >= 0.60 ? -2.5 : -1.5, 'debt at ' + D + '% of assets and not coming down (his line is 55%' + (T > OK_LINE ? ', ' + Math.round(T * 100) + '% this year' : '') + ')');
      add(cov > 3 ? 1 : cov >= 2 ? 0 : cov >= 1.5 ? -1 : -2, 'interest cover ' + cov.toFixed(1) + 'x');
      // round 19: unsecured notes. He wants them gone within a year.
      const uns = (G.debtTranches || []).filter(t => t.unsecured), U = uns.reduce((a, t) => a + t.amount, 0);
      if (U > 0) {
        const oldest = Math.min.apply(null, uns.map(t => t.issuedQ || tq()));
        add(tq() - oldest >= 4 ? -4 : -2.5, '$' + U.toFixed(0) + 'M of unsecured notes' + (tq() - oldest >= 4 ? ', still out after a year' : ': he wants them repaid within a year'));
      }
      const R = G.revolver;
      if (B().red.okafor) add(-3, 'your credit line is frozen');
      else if (R && Math.max(0, -G.balance.cash) > R.limit * 0.75) add(-1, 'credit line ' + Math.round(-G.balance.cash / R.limit * 100) + '% used');
    }
    if (id === 'hassan') {
      const o = r.occupancyPortfolio || 0;
      add(o >= 0.92 ? 2 : o >= 0.89 ? 1 : o >= 0.86 ? 0 : o >= 0.83 ? -1 : o >= 0.80 ? -2 : -3, 'occupancy ' + (o * 100).toFixed(0) + '% (target 86%)');
      const sk = shrink();
      if (sk > 0.15) add(-Math.min(3.5, sk * 8), 'sold ' + Math.round(sk * 100) + '% more of the portfolio than you bought in two years');
      const worst = G.portfolio.filter(p => !p.underConstruction).sort((a, b) => a.occupancy - b.occupancy)[0];
      if (worst && worst.occupancy < 0.70 && !(window.Tenants && Tenants.isLocked(worst))) add(-1, worst.name + ' only ' + Math.round(worst.occupancy * 100) + '% let');
    }
    if (id === 'activist') {
      const y = ytd(), pn = pnav();
      if (y) { const gap = y.you - y.sector; add(Math.max(-3, Math.min(2, gap * 100 / 3)), 'total return ' + pct(y.you, 1) + ' vs the rivals\u2019 ' + pct(y.sector, 1)); }
      const w = actWant();
      add(pn >= w + 0.1 ? 1.5 : pn >= w ? 0.5 : pn >= w - 0.1 ? -1 : -2, 'shares at ' + Math.round(pn * 100) + '% of NAV (wants ' + Math.round(w * 100) + '%, the rivals\u2019 level)');
      if (B().red.activist) add(-3, 'you sold new shares below NAV');
      const bb = GameState.company.lastBuybackYear;
      if (bb && GameState.meta.year - bb <= 1) add(1, 'you bought back shares');
    }
    if (id === 'mansour') {                                     // Hassan's job, done harder
      const o = r.occupancyPortfolio || 0;
      add(o >= 0.91 ? 2 : o >= 0.89 ? 1 : o >= 0.87 ? 0 : o >= 0.84 ? -1 : o >= 0.81 ? -2 : -3, 'occupancy ' + (o * 100).toFixed(0) + '% (she wants 87%)');   // round 35: was 90
      const worst = G.portfolio.filter(p => !p.underConstruction).sort((a, b) => a.occupancy - b.occupancy)[0];
      if (worst && worst.occupancy < 0.75) add(-1.5, worst.name + ' only ' + Math.round(worst.occupancy * 100) + '% let');
    }
    if (id === 'grace') {                                      // the ESG score, and whether you back his ideas
      const e = window.Story && Story.esgScore ? Story.esgScore() : 0;
      add(e >= 70 ? 2 : e >= 60 ? 1 : e >= 40 ? 0 : e >= 25 ? -1 : -2, 'ESG score ' + e + ' (he wants 60)');
      if (window.Story && Story.esgRefusedRecently && Story.esgRefusedRecently()) add(-1, 'you turned down his last initiative');
      if (B().red.grace) add(-3, 'you cancelled one of his initiatives');
    }
    const cr2 = chairRed(id);
    if (cr2) { if (cr2.crossed()) add(-2.5, 'as chair: ' + cr2.text); else add(0.5, 'as chair: no ' + cr2.text); }
    if (id === 'tex') add(1.5, 'he owes you his seat');
    if (id === 'voss') add(-4, 'he works for Kessler');

    // their own money (2.0): a director who bought our shares takes the price personally
    // round 11: every director owns shares from the start, so the price is personal for all of them
    const st = stakeOf(id);
    if (st && G.company.sharePrice > 0 && (G.meta.totalQuarters || 0) > 4) {   // round 24: not in the first year; you just arrived
      const ch = G.company.sharePrice / st.avg - 1;
      if (ch <= -0.10) add(Math.max(-2.5, ch * 8), 'own ' + st.n.toLocaleString() + ' shares, down ' + pct(ch) + ' on cost');
      else if (ch >= 0.15) add(Math.min(1.5, ch * 5), 'own shares up ' + pct(ch) + ' on cost');
    }
    return out;
  }
  /* -- round 35: a shock you did not cause (events.js, tower.js, the crisis) ------
     For 4 quarters what your NUMBERS do to moods counts half, and directors say
     "not your fault". What you DO is judged as usual. */
  function shock(why) { const G = GameState; G._shock = { until: tq() + 3, why: why || 'the shock hit us all' }; }
  function shockOn() { const S = GameState._shock; return S && tq() <= S.until ? S.why : null; }
  /* -- round 35: Petrova and new shares ------------------------------------------
     Every share sale is remembered with its price against NAV. Her red line is
     more than 10% new shares in 12 months sold below 85% of NAV, from Year 2. */
  function noteIssue(n, pn, proceeds) {
    const b = B(), G = GameState; b.issues = b.issues || [];
    b.issues.push({ q: tq(), n, pnav: pn, cash: proceeds || 0 }); while (b.issues.length > 30) b.issues.shift();
    if (pn < 0.85) G.board.cheapIssueThisYear = fmt((G.board.cheapIssueThisYear || 0) + n);
    if (G.meta.year === 1 && !b.y1warned && pn < 0.85 && window.Inbox && has('petrova')) {
      const y1 = b.issues.filter(x => x.q <= 4 && x.pnav < 0.85).reduce((a, x) => a + x.n, 0), base = (b.shares[0] || G.company.sharesOutstanding);
      if (y1 / base > 0.10) { b.y1warned = true;
        Inbox.message(name('petrova'), ROLE.petrova, 'This year I let it go', 'You sold ' + Math.round(y1 / base * 100) + '% new shares at ' + Math.round(pn * 100) + '% of what our buildings are worth. It is your first year, so I let it go. From next year, more than 10% in a year below 85% of NAV crosses my line. Sell shares when they are dear, not when they are cheap.', face('petrova')); }
    }
  }
  function cheapDilution() {
    const b = B(), s = b.shares, now = GameState.company.sharesOutstanding, base = s.length >= 4 ? s[s.length - 4] : (s[0] || now);
    const n = (b.issues || []).filter(x => x.q > 4 && tq() - x.q < 4 && x.pnav < 0.85).reduce((a, x) => a + x.n, 0);
    return base > 0 ? n / base : 0;
  }
  /* "Explain: the money bought buildings": true if what we bought in 12 months is worth at least what the shares raised */
  function issueInvested() {
    const b = B(), raised = (b.issues || []).filter(x => tq() - x.q < 4).reduce((a, x) => a + (x.cash || 0), 0);
    const bought = b.buys.filter(x => tq() - x.q < 4).reduce((a, x) => a + (x.v || 0), 0);
    return raised > 0 && bought >= raised * 0.9;
  }
  function explainIssue() { B().explainedQ = tq(); remember('petrova', 1.5, 'the new shares bought buildings'); }

  /* round 34: Okafor's line, and this year's step toward it: the leverage demand from the
     last meeting if there is one, else 55%. */
  const OK_LINE = 0.55;
  function okaforTarget() {
    const m = ((GameState.board && GameState.board.activeMandates) || []).find(x => x.directorId === 'okafor' && x.metric === 'debtToAssets');
    return m && m.target > OK_LINE ? m.target : OK_LINE;
  }
  // real REITs grow dividends ~3-6% a year; the Chairman asks a little more, never 10%
  function williamsTarget() { return Math.min(0.07, 0.04 + (GameState.meta.year - 1) * 0.005); }
  function dilution() {
    const s = B().shares, now = GameState.company.sharesOutstanding, then = s.length >= 4 ? s[s.length - 4] : (s[0] || now);
    return then > 0 ? now / then - 1 : 0;
  }
  const buysIn = n => B().buys.filter(b => tq() - b.q < n).reduce((t, b) => t + b.n, 0);

  /* -- round 21: paying out more than you earn, and selling the company off ----
     PAYOUT: the dividend you pay now / cash profit (AFFO) over 12 months. Above
     130% (160% in a market crisis) each quarter adds to a streak; Williams turns on you slowly, then
     Petrova. A cut that brings it back is not his red line.
     SHRINK: buildings sold minus bought over 2 years, as a share of the
     portfolio. Above 15%, Chen and Hassan object. */
  const payout = () => window.Financials && Financials.payoutRatio ? Financials.payoutRatio() : null;
  const payLine = () => (window.Arc && Arc.phase && Arc.phase() === 'crisis') ? 1.6 : 1.3;   // a market crisis, not one you made yourself
  const uncovQ = () => B().uncovQ || 0;
  /* still paying out too much right now (a cut counts at once); 0 = no */
  const overPaying = () => { const pr = payout(); return pr != null && pr > payLine() ? uncovQ() : 0; };
  const cutForgiven = () => tq() - (B().uncovLastQ || -99) <= 4;
  function watchPayout() {
    const b = B(), pr = payout(), G = GameState;
    if (G.meta.year >= 2 && pr != null && pr > payLine()) { b.uncovQ = (b.uncovQ || 0) + 1; b.uncovLastQ = tq(); }
    else b.uncovQ = Math.max(0, (b.uncovQ || 0) - 2);
    if (!window.Inbox) return;
    const P = pr == null ? '' : (pr >= 9 ? 'more than' : Math.round(pr * 100) + '% of');
    if (b.uncovQ === 2 && has('williams'))
      Inbox.message(name('williams'), ROLE.williams, 'Not at the cost of survival',
        'I love a good dividend. You know I do. But we are paying out ' + P + ' what we earn, and the difference comes out of the company itself. I want a dividend for the next fifteen years, not a big one for the next two. Bring it back within what we earn, and I will not hold the cut against you.', face('williams'));
    if (b.uncovQ === 4 && has('petrova'))
      Inbox.message(name('petrova'), ROLE.petrova, 'The market can count',
        'Our dividend is ' + P + ' our cash profit. Investors know a payout funded by the company’s own capital when they see one, and they price it that way. It flatters this year and costs us every year after.', face('petrova'));
  }
  function shrink() {
    const G = GameState, b = B(), win = q => tq() - q < 8;
    const sold = (b.sold || []).filter(x => win(x.q)).reduce((t, x) => t + x.v, 0);
    if (sold <= 0) return 0;
    const bought = b.buys.filter(x => win(x.q)).reduce((t, x) => t + (x.v || 0), 0);
    const now = G.portfolio.reduce((t, p) => t + (p.currentValue || 0), 0);
    return Math.max(0, (sold - bought) / Math.max(1, now + sold));
  }
  function watchShrink() {
    const b = B(), s = shrink();
    if (s > 0.15 && !b.shrinkWarned) {
      b.shrinkWarned = true;
      if (window.Inbox && has('chen')) Inbox.message(name('chen'), ROLE.chen, 'We are a landlord, not a piggy bank',
        'In two years we have sold ' + Math.round(s * 100) + '% more of the portfolio than we bought. Every building you sell is rent we never see again. Shareholders can sell their own shares if they want cash. Our job is to grow.', face('chen'));
      if (window.Inbox && has('hassan')) Inbox.message(name('hassan'), ROLE.hassan, 'Selling the company off',
        'I spent years getting those buildings full. Now they are going out the door one a quarter. A REIT with no buildings is a bank account with a board. Stop selling.', face('hassan'));
    }
    if (s < 0.08) b.shrinkWarned = false;
  }
  /* for properties.js: a sale counts toward the shrink, and toward the ending */
  function noteSale(v) {
    const b = B(); b.sold = b.sold || []; b.sold.push({ q: tq(), v: v || 0 });
    while (b.sold.length > 60) b.sold.shift();
    b.soldN = (b.soldN || 0) + 1; b.soldV = fmt((b.soldV || 0) + (v || 0));
  }

  // -- red lines ------------------------------------------------------------
  function redLines() {
    const G = GameState, r = {}, d0 = ago(4, 'dividendPerShare');
    r.williams = d0 != null && G.company.dividendPerShare < d0 - 0.0005 && !cutForgiven();
    r.petrova = cheapDilution() > 0.10;                     // round 35: only shares sold below 85% of NAV, from Year 2
    r.chen = G.meta.year >= 4 && tq() - (B().lastBuyQ || 0) >= 12;
    r.okafor = !!(G.revolver && G.revolver.frozen);
    r.hassan = H().length > 0 && (G.ratios.occupancyPortfolio || 1) < 0.80;
    r.activist = has('activist') && dilution() > 0.02 && pnav() < 0.95;
    r.mansour = has('mansour') && G.portfolio.some(p => !p.underConstruction && p.occupancy < 0.75);
    r.grace = has('grace') && !!(window.Story && Story.esgCancelledRecently && Story.esgCancelledRecently());
    if (G.meta.year < 2) Object.keys(r).forEach(k => { r[k] = false; });   // round 35: Year 1 is practice: no red lines
    return r;
  }

  // -- the quarterly update -----------------------------------------------
  /* Called from board.evaluateQuarter() after the books close. Returns inbox lines. */
  /* live: recompute moods mid-meeting, without a quarter's bookkeeping */
  function refresh() { return update(true); }

  function update(live) {
    const G = GameState, b = B(), dirs = G.board.directors || [];
    if (!dirs.length) return [];

    // anything that moved a mood directly since last time becomes a memory
    dirs.forEach(d => {
      if (d._shown != null && Math.abs(d.attitude - d._shown) > 0.01)
        remember(d.id, d.attitude - d._shown, G._attCause && G._attCause[d.id] || 'your recent decisions');
    });
    G._attCause = {};

    // round 35: the crisis (and the aftershock) is a shock you did not cause: 4 quarters of grace when it starts
    if (!live && window.Arc && Arc.phase) { const ph = Arc.phase(); b.shocked = b.shocked || {};
      if ((ph === 'crisis' || ph === 'aftershock') && !b.shocked[ph]) { b.shocked[ph] = true; shock(ph === 'crisis' ? 'the crisis hit us all' : 'the second shock hit us all'); } }
    // bookkeeping once a quarter: buys, share count, the sector index
    if (!live) {
      const ids = G.portfolio.map(p => p.id);
      if (b.owned) { const nw = G.portfolio.filter(p => b.owned.indexOf(p.id) === -1), n = nw.length;
                     if (n) { b.buys.push({ q: tq(), n, v: nw.reduce((t, p) => t + (p.currentValue || 0), 0) }); b.lastBuyQ = tq(); } }
      else b.lastBuyQ = tq();
      b.owned = ids; b.shares.push(fmt(G.company.sharesOutstanding - (G.company.compShares || 0)));   // round 24: shares sold, not shares paid as pay while (b.shares.length > 12) b.shares.shift();
      sectorStep();
      watchPayout(); watchShrink();
    }

    // once a year: reputations recover a little while nothing goes wrong
    if (!live && G.meta.quarter === 1 && b._repYear !== G.meta.year) {
      b._repYear = G.meta.year;
      dirs.forEach(d => { const r0 = REP0[d.id] != null ? REP0[d.id] : 55; if (rep(d.id) < r0) repChange(d.id, Math.min(3, r0 - rep(d.id)), 'a quiet year'); });
    }
    if (!G.board.startBoard) G.board.startBoard = dirs.map(d => d.id);
    if (!live) ensureStakes();

    // red lines: new breaches are remembered, and flagged
    const red = redLines(), newRed = [];
    if (!live) Object.keys(red).forEach(id => { if (red[id] && !b.red[id]) { remember(id, -1.5, 'you crossed the line: ' + RED[id]); newRed.push(id); } });
    if (!live) b.red = red;

    // raw mood per director
    const raw = {}, parts = {};
    dirs.forEach(d => {
      const j = judge(d.id); parts[d.id] = j;
      // what your NUMBERS can do to a mood is capped; beyond that only what you DID moves it
      let s = Math.max(-4, Math.min(4, j.reduce((t, x) => t + x.pts, 0)));
      if (G.meta.year === 1 || shockOn()) s = s < 0 ? s * 0.5 : s;   // a patient first year; round 35: and after a shock you did not cause
      raw[d.id] = 5 + (GRUMPY[d.id] || 0) + s + memoryPts(d.id) + bondPts(d.id);
    });
    // allies move together; rivals pull apart
    const lines = [];
    dirs.forEach(d => {
      let a = raw[d.id];
      // allies move together, rivals pull apart, and that can be the reason they give
      if (ALLY[d.id] && raw[ALLY[d.id]] != null) {
        const s = 0.25 * (raw[ALLY[d.id]] - 5); a += s;
        if (Math.abs(s) >= 0.4) parts[d.id].push({ pts: s, why: s < 0 ? short(ALLY[d.id]) + ' is unhappy with you, and they stand together' : short(ALLY[d.id]) + ' is pleased, and they stand together' });
      }
      if (RIVAL[d.id] && raw[RIVAL[d.id]] != null) {
        const s = -0.15 * (raw[RIVAL[d.id]] - 5); a += s;
        if (Math.abs(s) >= 0.4) parts[d.id].push({ pts: s, why: s < 0 ? 'you are giving ' + short(RIVAL[d.id]) + ' too much of what he wants' : 'you are not indulging ' + short(RIVAL[d.id]) });
      }
      a = Math.max(0, Math.min(10, fmt(a)));
      if (!isFinite(a)) a = isFinite(d.attitude) ? d.attitude : 5;   // round 22: a bad number upstream must not break the board
      const before = live ? d.attitude : (b.prev[d.id] != null ? b.prev[d.id] : a);
      d._trend = fmt(a - before); d.attitude = a; d._shown = a;
      // the cause shown: the biggest thing pushing in the direction of the mood
      const j = parts[d.id].slice().sort((x, y) => a < 5 ? x.pts - y.pts : y.pts - x.pts);
      const mem = memories(d.id)[0];
      b.causes[d.id] = (j[0] && Math.abs(j[0].pts) >= 0.5) ? (j[0].pts < 0 && shockOn() ? 'not your fault, ' + shockOn() + ', but ' + j[0].why : j[0].why)
                     : mem && Math.abs(mem.d) >= 0.5 ? mem.t
                     : a >= 4.75 ? 'no complaints for now' : (j[0] ? j[0].why : 'no complaints for now');
      /* Worth a letter: a red line; dropping INTO Unhappy/Furious; climbing OUT
         of them, or into Delighted. Each director writes at most once a year
         (red lines excepted), and the inbox gets at most one a quarter. */
      const L0 = level(before), L1 = level(a), bad = L => L[0] < 3, cool = tq() - (b.wrote && b.wrote[d.id] || -99) >= 4;
      if (live) return;                                        // no letters, no history mid-meeting
      if (newRed.indexOf(d.id) > -1) lines.push({ id: d.id, kind: 'red', size: 9 });
      else if (cool && G.meta.totalQuarters > 1 && L0 !== L1 && (bad(L1) && !bad(L0) || bad(L0) && !bad(L1) || L1[1] === 'Delighted'))
        lines.push({ id: d.id, kind: a > before ? 'up' : 'down', size: Math.abs(a - before) });
      b.prev[d.id] = a;
    });
    const out = lines.sort((x, y) => y.size - x.size).slice(0, lines.some(l => l.kind === 'red') ? 2 : 1);
    b.wrote = b.wrote || {}; out.forEach(l => { b.wrote[l.id] = tq(); });
    return out;
  }

  /* Letters from directors, in their own voice, always with the number. */
  const VOICE = {
    williams: { down: ['I expected a rising dividend. {c}. Fix it before we meet.', 'Shareholders bought us for income. {c}. I notice these things.'],
                up: ['{c}. That is what this company is for. Keep it coming.', 'Good. {c}. The shareholders noticed, and so did I.'],
                red: ['You cut the dividend. I will not pretend that is acceptable. We will discuss it at the meeting.'] },
    petrova: { down: ['{c}. Investors have other places to put their money.', '{c}. I field the calls from our shareholders. Give me something to tell them.'],
               up: ['{c}. Our shareholders are pleased, which means I am.', 'Nice work. {c}.'],
               red: ['More than 10% new shares in a year. You are spending our shareholders’ ownership. Stop.'] },
    chen: { down: ['{c}. Standing still is falling behind.', '{c}. Our rivals are not waiting for us.'],
            up: ['{c}. This is how a REIT grows. More, please.', 'Good. {c}. Now find the next one.'],
            red: ['Three years without a single purchase. I did not join this board to watch.'] },
    okafor: { down: ['{c}. I want a plan for the balance sheet, not a hope.', 'Careful. {c}. This is how companies end up in trouble.'],
              up: ['{c}. Prudent. Thank you.', 'The balance sheet looks sound: {c}.'],
              red: ['The bank has frozen our credit line. That is the one thing I asked you never to let happen.'] },
    hassan: { down: ['{c}. Empty space earns nothing. Fill it.', '{c}. I walked one of our buildings last week. It felt empty.'],
              up: ['{c}. The buildings are working. Good.', 'Nice. {c}. The tenants are happy, the space is full.'],
              red: ['Occupancy below 80%. Our buildings are half asleep. This needs your attention now.'] },
    mansour: { down: ['{c}. Every empty unit is rent we will never see again.', '{c}. I ran stores for twenty years. This would not have survived a Monday.'],
             up: ['{c}. Now that is a well-let portfolio.', '{c}. Good. Keep the leasing team hungry.'],
             red: ['A building below 75% occupancy. In my old job, that manager would be gone by Friday.'] },
    grace: { down: ['{c}. Investors are watching our ESG score, and so am I.', '{c}. I have three initiatives ready. Just say the word.'],
            up: ['{c}. This is what leadership looks like!', '{c}. The bees send their thanks.'],
            red: ['You cancelled an initiative behind my back. I am drafting a statement.'] },
    tex: { down: ['{c}. Even I can\u2019t spin this one, friend.'], up: ['{c}. Nice work. Drinks are on me.'], red: [] },
    activist: { down: ['{c}. Sterling Park did not buy 5% of this company to watch it drift.', '{c}. I have a 41-page letter about this. I can write a longer one.'],
                up: ['{c}. Better. Not good. Better.', '{c}. Keep going, and I may stop sending letters.'],
                red: ['You sold new shares below NAV. You handed our discount to strangers. My fund will vote accordingly.'] },
  };
  function letters(list) {
    if (!window.Inbox) return;
    list.forEach(x => {
      const v = VOICE[x.id], pool = v && v[x.kind]; if (!pool) return;
      const c = (B().causes[x.id] || '').replace(/^./, m => m.toUpperCase());
      const body = pool[Math.floor(Math.random() * pool.length)].replace('{c}', c);
      const L = level(GameState.board.directors.find(d => d.id === x.id).attitude);
      const title = x.kind === 'red' ? 'Line crossed: ' + RED[x.id]
                  : x.kind === 'up' ? (L[1] === 'Delighted' ? 'Delighted' : 'Less worried')
                  : (L[1] === 'Furious' ? 'Furious' : 'Not happy');
      Inbox.message(name(x.id), ROLE[x.id], title, body + (GameState.board.probation && x.kind !== 'up' ? '<br><i>You are on probation. This will weigh at the meeting.</i>' : ''), face(x.id));
    });
  }

  // -- REIT sector index (benchmark) ---------------------------------------
  /* Moves like a typical REIT share: 0.6x the city's property value change
     (prices anchor on dividends), plus a typical dividend yield, plus noise.
     (First version used 1.4x leverage: +15% in recovery years, which made
     Petrova furious with every player.) Replaced by the rival
     league table once rivals have real finances. */
  function sectorStep() {
    const G = GameState, s = B().sector;
    const total = [].concat(G.portfolio || [], G.propertyMarket || [], G.cityRivals || []).reduce((t, p) => t + (p.currentValue || 0), 0);
    if (s.lastTotal) {
      const yieldQ = ((G.market.baseInterestRate || 3) + 2.0) / 100 / 4;
      // REIT shares follow property values only partly (prices are anchored on dividends)
      const r = 0.6 * (total / s.lastTotal - 1) + yieldQ + (Math.random() - 0.5) * 0.016;
      s.level = fmt(s.level * (1 + r));
    }
    s.lastTotal = total;
    s.hist.push({ q: tq(), level: s.level }); while (s.hist.length > 70) s.hist.shift();
  }

  /* Total return "this year so far" for you and the sector. At the start of a
     year (Q1 turn) it shows the year just finished. */
  function ytd() {
    const h = H(), s = B().sector.hist, G = GameState;
    let n = (G.meta.quarter - 1) || 4;
    n = Math.min(n, h.length, s.length - 1);
    if (n < 1) return null;
    const p0 = h.length > n ? h[h.length - 1 - n].sharePrice : (G._p0 || h[0].sharePrice), p1 = h[h.length - 1].sharePrice;
    let divs = 0; for (let i = h.length - n; i < h.length; i++) divs += h[i].dividendPerShare || 0;
    const you = p0 ? (p1 + divs) / p0 - 1 : 0;
    // round 5: the benchmark is the three rivals' average (the sector index was a stand-in)
    const rivals = window.Rivals && G.rivals;
    const sector = rivals ? Rivals.avg(n) : s[s.length - 1].level / s[s.length - 1 - n].level - 1;
    return { you, sector, label: G.meta.quarter === 1 ? 'last year' : 'this year so far', n, bench: rivals ? 'rivals' : 'sector' };
  }

  // -- the scorecard: what each director is judging, visible all year -------
  function scorecard() {
    const G = GameState, r = G.ratios, rows = [], cr = crisis(), y = ytd();
    // same base as the Chairman's judgement: 12 months ago, or the start of the year
    const d0 = ago(4, 'dividendPerShare') != null ? ago(4, 'dividendPerShare') : (G.board.startYearDividend || null),
          d1 = G.company.dividendPerShare, g = d0 > 0 && H().length ? d1 / d0 - 1 : null;
    const a1 = sumLast(4, 'affoPerShare'), a0 = H().length >= 8 ? sumLast(4, 'affoPerShare', 4) : null, ag = a1 != null && a0 > 0.1 ? a1 / a0 - 1 : null;
    const d2a = r.debtToAssets || 0, okT = okaforTarget(), cov = r.interestCoverage, occ = r.occupancyPortfolio;
    rows.push({ id: 'petrova', k: 'Total return, ' + (y ? y.label : 'this year'), v: y ? pct(y.you, 1) : '—', want: y ? (y.bench === 'rivals' ? 'rivals avg ' : 'sector ') + pct(y.sector, 1) : '', ok: y ? y.you >= y.sector - 0.005 : null });
    const y1 = (G.meta.totalQuarters || 0) <= 4;
    rows.push({ id: 'williams', k: 'Dividend growth, 12 months', v: g == null ? '—' : pct(g, 1), want: y1 ? 'from Year 2' : cr ? 'no cut (crisis)' : '≥ ' + pct(williamsTarget()), ok: g == null || y1 ? null : cr ? g >= 0 : g >= williamsTarget() });
    const pr = payout();
    if (!y1 && pr != null) { const pv = pr >= 9 ? 'no profit' : Math.round(pr * 100) + '%', pw = '\u2264 ' + Math.round(payLine() * 100) + '%';
      rows.push({ id: 'williams', k: 'Dividend / cash profit, 12 months', v: pv, want: pw, ok: pr <= payLine() });
      rows.push({ id: 'petrova', k: 'Dividend / cash profit, 12 months', v: pv, want: pw, ok: pr <= payLine() }); }
    const sk = shrink();
    if (sk > 0) ['chen', 'hassan'].forEach(id => rows.push({ id, k: 'Portfolio sold, net of buys, 2 years', v: Math.round(sk * 100) + '%', want: '\u2264 15%', ok: sk <= 0.15 }));
    rows.push({ id: 'chen', k: 'Cash profit per share growth', v: ag == null ? '—' : pct(ag, 1), want: '≥ +3%', ok: ag == null ? null : ag >= 0.03 });
    rows.push({ id: 'chen', k: 'Buildings bought, 12 months', v: String(buysIn(4)), want: '≥ 1', ok: G.meta.totalQuarters < 4 ? null : buysIn(4) >= 1 });
    rows.push({ id: 'okafor', k: 'Debt / assets', v: Math.round(d2a * 100) + '%', want: '\u2264 ' + Math.round(okT * 100) + '%' + (okT > OK_LINE ? ' this year' : ''), ok: H().length ? d2a <= okT + 0.005 : null });
    const U0 = (G.debtTranches || []).reduce((t, x) => t + (x.unsecured ? x.amount : 0), 0);
    if (U0 > 0) rows.push({ id: 'okafor', k: 'Unsecured notes', v: '$' + U0.toFixed(0) + 'M', want: 'none', ok: false });
    rows.push({ id: 'okafor', k: 'Interest cover', v: cov ? cov.toFixed(1) + 'x' : '—', want: '≥ 2.0x', ok: cov ? cov >= 2 : null });
    rows.push({ id: 'hassan', k: 'Occupancy', v: occ ? Math.round(occ * 100) + '%' : '—', want: '≥ 86%', ok: occ ? occ >= 0.86 : null });
    if (has('activist')) rows.push({ id: 'activist', k: 'Share price / NAV', v: Math.round(pnav() * 100) + '%', want: '≥ ' + Math.round(actWant() * 100) + '% (rivals)', ok: H().length ? pnav() >= actWant() : null });
    rows.push({ id: 'mansour', k: 'Occupancy', v: occ ? Math.round(occ * 100) + '%' : '—', want: '≥ 87%', ok: occ ? occ >= 0.87 : null });
    const esg = window.Story && Story.esgScore ? Story.esgScore() : 0;
    rows.push({ id: 'grace', k: 'ESG score', v: String(esg), want: '≥ 60', ok: esg >= 60 });
    const ch = GameState.board.chair, cr3 = ch && CHAIR_RED[ch];
    if (cr3) rows.push({ id: ch, k: 'The chair\u2019s red line', v: cr3.crossed() ? 'crossed' : 'clear', want: 'no ' + cr3.text, ok: !cr3.crossed() });
    return rows.filter(x => has(x.id));
  }

  /* Everything the Board tab needs about one director. */
  function card(id) {
    ensureStakes();                                          // the stakes exist from day one
    const d = GameState.board.directors.find(x => x.id === id); if (!d) return null;
    const a = d.attitude, L = level(a), prev = B().prev[id], b = B();
    const hist = b.hist && b.hist[id];
    return { id, name: name(id), role: ROLE[id], face: face(id), attitude: a, label: L[1], cls: L[2],
             trend: d._trend || 0, cause: b.causes[id] || '', red: RED[id] + (chairRed(id) ? '; as chair: ' + chairRed(id).text : ''), redNow: !!b.red[id],
             ally: ALLY[id] ? short(ALLY[id]) : null, rival: RIVAL[id] ? short(RIVAL[id]) : null,
             memory: memories(id).map(e => e.t + (e.d > 0 ? ' (+)' : ' (−)')), bond: bondOf(id),
             rep: rep(id), repWhy: (B().repWhy || {})[id] || [], stake: stakeOf(id) };
  }

  /* Votes against you only when unhappy AND one of their own scorecard lines
     is failing. Sympathy for an ally or an old grudge alone is not enough. */
  function votesAgainst(id, own) {
    if (id === 'voss') return true;                          // Kessler's man, always
    if (id === 'williams' && window.Tower && Tower.williamsAgainst()) return true;   // the year after you refused his tower
    if (id === 'tex' && !own) return false;                // your nominee (meeting.js: unless 4 are already against, or unpaid)
    const d = (GameState.board.directors || []).find(x => x.id === id);
    if (id === 'tex') return !!d && d.attitude < 3;          // unpaid: his own way, no scorecard of his own
    return !!d && d.attitude < 3 && scorecard().some(r => r.id === id && r.ok === false);
  }

  /* -- reputation (2.0 round 8) ----------------------------------------------
     How the rest of the board and the shareholders see a director, 0 to 100.
     Their own calls going right or wrong move it (a deal they pushed, a
     scandal). Below REP_LINE at the annual meeting they are pushed out,
     unless you spend political capital to save them (meeting.js). */
  const REP0 = { williams: 75, okafor: 70, petrova: 65, hassan: 60, chen: 60, activist: 50, mansour: 55, grace: 55, tex: 40, voss: 45 };
  const REP_LINE = 30;
  function rep(id) {
    const b = B(); b.rep = b.rep || {};
    if (b.rep[id] == null) b.rep[id] = REP0[id] != null ? REP0[id] : 55;
    return b.rep[id];
  }
  function repChange(id, d, why) {
    if (!has(id) || !d) return;
    const b = B(); rep(id);
    b.rep[id] = Math.max(0, Math.min(100, Math.round(b.rep[id] + d)));
    b.repWhy = b.repWhy || {}; b.repWhy[id] = [(d > 0 ? '+' : '\u2212') + Math.abs(Math.round(d)) + ' ' + (why || '')].concat(b.repWhy[id] || []).slice(0, 3);
  }

  /* -- directors' own shares (round 11) --------------------------------------
     Every director owns a stake from the start (Sterling Park's is its 5%).
     It is on their card, and its gain or loss moves their mood. */
  const STAKE = { williams: 120000, petrova: 40000, chen: 60000, okafor: 25000, hassan: 30000, mansour: 20000, grace: 8000, tex: 50000, activist: 500000 };
  function giveStake(id) {
    const b = B(), px = GameState.company.sharePrice;
    if (!STAKE[id] || !px || b.holdings.some(h => h.id === id && h.start)) return;
    b.holdings.push({ id, n: STAKE[id], price: px, q: tq(), start: true });
  }
  function ensureStakes() { const b = B(); if (b.stakesDone) return; b.stakesDone = true; (GameState.board.directors || []).forEach(d => giveStake(d.id)); }
  /* round 24: directors are paid too. Their cash fees sit in overheads; once a
     year each also gets shares worth BOARD_SHARES ($M), new shares, so their
     stake (and its average cost) moves with the company. */
  const BOARD_SHARES = 0.1;
  function boardGrant() {
    const G = GameState, px = G.company.sharePrice; if (!px) return null;
    const ds = (G.board.directors || []).filter(d => d.id !== 'voss'); if (!ds.length) return null;
    const n = Math.round(BOARD_SHARES * 1e6 / px / 100) * 100;
    ds.forEach(d => B().holdings.push({ id: d.id, n, price: px, q: tq(), fee: true }));
    G.company.sharesOutstanding = fmt(G.company.sharesOutstanding + n * ds.length / 1e6);
    G.company.compShares = fmt((G.company.compShares || 0) + n * ds.length / 1e6);   // pay, not a share sale: Petrova and the activist do not count it
    return { n, count: ds.length, total: n * ds.length };
  }
  function stakeOf(id) {
    const hs = B().holdings.filter(h => h.id === id && !h.sold); if (!hs.length) return null;
    const n = hs.reduce((a, h) => a + h.n, 0), cost = hs.reduce((a, h) => a + h.n * h.price, 0);
    return { n, avg: cost / n, value: n * GameState.company.sharePrice / 1e6 };
  }

  /* -- the board changes (2.0 round 8) -------------------------------------- */
  function logBoard(text) {
    const b = GameState.board; b.history = b.history || [];
    b.history.push({ q: tq(), label: 'Y' + GameState.meta.year + ' Q' + GameState.meta.quarter, text });
  }
  function addDirector(id, attitude, text) {
    const G = GameState, b = G.board;
    if (has(id)) return false;
    b.directors.push({ id, attitude: attitude, mandates: [] });
    B().prev[id] = attitude; rep(id); giveStake(id);
    logBoard(text || name(id) + ' joined the board.');
    return true;
  }
  function removeDirector(id, text) {
    const G = GameState, b = G.board;
    if (!has(id)) return false;
    b.directors = b.directors.filter(d => d.id !== id);
    b.activeMandates = (b.activeMandates || []).filter(m => m.directorId !== id);
    logBoard(text || name(id) + ' left the board.');
    return true;
  }

  /* The activist takes a seat (world.js "activist"): a sixth director, a
     sixth of the board's fees on top, and a grudge from day one. */
  const ACT_FEE_Q = 0.075;                              // ~$0.3M a year: board fees up by a sixth
  function addActivist() {
    const G = GameState, b = G.board;
    if (has('activist')) return '';
    addDirector('activist', 3.5, 'Director Marlowe (Sterling Park Capital, activist) joined: a sixth seat.');
    b.activist = { since: tq(), feeQ: ACT_FEE_Q };
    G._gaSurcharge = Math.round(((G._gaSurcharge || 0) + ACT_FEE_Q) * 10000) / 10000;
    remember('activist', -1, 'he thinks management is the discount');
    refresh();
    return 'Director Marlowe of Sterling Park joins the board: six directors now. Board fees up by a sixth (+$' + (ACT_FEE_Q * 4).toFixed(1) + 'M a year).';
  }

  /* Personal moments for the meeting (2.0). A director buys our shares with
     his own money when they are really cheap against NAV, and from then on
     takes the share price personally. An unhappy holder sells. */
  function personal() {
    const G = GameState, b = B(), now = tq(), pn = pnav(), out = [];
    const mine = b.holdings.filter(h => !h.sold);
    // an unhappy holder sells (insiders selling is noticed)
    mine.forEach(h => {
      const d = (G.board.directors || []).find(x => x.id === h.id);
      if (!h.start && !h.fee && d && d.attitude < 3 && now - h.q >= 4) {   // round 24: nor their fee shares          // they sell what they bought, not their founding stake
        h.sold = now; const ch = G.company.sharePrice / h.price - 1;
        G.company.sharePrice = fmt(G.company.sharePrice * 0.985);
        out.push({ id: h.id, kind: 'sold', text: 'I sold my ' + h.n.toLocaleString() + ' shares last week, ' + pct(ch) + ' on what I paid. I couldn\u2019t watch any more.' });
      }
    });
    /* a buy: only at a really good moment. Cheap against NAV, cheaper than the
       rivals, and at least 10% off its two-year high. One every two years. */
    const lastBuy = b.holdings.filter(h => !h.start && !h.fee).reduce((m, h) => Math.max(m, h.q), -99);
    const hi = H().slice(-8).reduce((m, e) => Math.max(m, e.sharePrice || 0), 0);
    const dip = hi > 0 ? G.company.sharePrice / hi - 1 : 0;
    if (pn < 0.7 && pn < rivalsPnav() - 0.1 && dip <= -0.10 && now - lastBuy >= 8 && G.meta.year >= 2) {
      const cand = (G.board.directors || []).filter(d => d.id !== 'activist' && d.attitude >= 4.75 && !b.holdings.some(h => h.id === d.id && !h.sold && !h.start && !h.fee))
                     .sort((x, y) => y.attitude - x.attitude)[0];
      if (cand) {
        const n = 10000, price = G.company.sharePrice;
        b.holdings.push({ id: cand.id, n, price, q: now });
        if (window.Financials && Financials.capLog) Financials.capLog('director', short(cand.id) + ' bought ' + n.toLocaleString() + ' shares');
        out.push({ id: cand.id, kind: 'bought', text: 'Something personal. I bought ' + n.toLocaleString() + ' of our shares last week at $' + price.toFixed(2) +
                   '. We trade at ' + Math.round(pn * 100) + '% of what our buildings are worth, ' + Math.round(-dip * 100) + '% off the high. I hope you make that a good decision.' });
      }
    }
    return out;
  }

  /* Hints: a director passes on something useful he heard. One per meeting. */
  function hint() {
    const G = GameState, r = G.ratios, pn = pnav(), list = [];
    const dR = window.Rivals && G.rivals ? Rivals.distressed() : null;
    if (dR) { const O = (window.PROPERTIES_MASTER && PROPERTIES_MASTER.OWNERS || {})[dR] || {}; list.push({ id: 'chen', text: 'I had dinner with a banker. ' + (O.name || 'One of our rivals') + ' is in trouble with its lenders. Their buildings may come cheap this year.' }); }
    const ph = window.Arc && Arc.phase ? Arc.phase() : null;
    if (ph === 'warning') list.push({ id: 'okafor', text: 'My contacts at the banks are nervous. They are quietly cutting credit lines. I would not borrow short this year.' });
    if (ph === 'cheap' && (G.market.baseInterestRate || 3) < 3) list.push({ id: 'okafor', text: 'Money is cheap right now. It will not stay that way. Long fixed-rate debt is worth a look.' });
    /* round 25: Petrova on shares, by band: below 70% of NAV buy back; 70-95% do not
       sell new ones; from 95% new shares are fine if the money goes into buildings.
       She says it only when the band changes, not at every meeting. */
    const band = pn < 0.70 ? 'buy' : pn < 0.85 ? 'hold' : 'issue', bb = B();   // round 35: 85%, the same line as her red line
    if (bb.petBand !== band) {
      const P = Math.round(pn * 100);
      list.push({ id: 'petrova', band, text: band === 'buy' ? 'At ' + P + '% of NAV our shares are cheap. I would buy some back: every dollar buys more than a dollar of buildings.'
        : band === 'hold' ? 'We trade at ' + P + '% of NAV. I would not sell new shares at this discount: it is an expensive way to raise money.'
        : 'We trade at ' + P + '% of NAV. I do not mind new shares at this price, as long as the money goes into buildings.' });
    }
    const worst = (G.portfolio || []).filter(p => !p.underConstruction).sort((a, b) => a.occupancy - b.occupancy)[0];
    if (worst && worst.occupancy < 0.78) list.push({ id: 'hassan', text: 'I drove past ' + worst.name + '. ' + Math.round(worst.occupancy * 100) + '% let, and it looks it. A lease-up drive would pay for itself.' });
    if (G.balance.cash > Math.max(40, (G.balance.totalAssets || 0) * 0.08)) list.push({ id: 'chen', text: 'We are sitting on $' + Math.round(G.balance.cash) + 'M of cash. Cash earns almost nothing. Buildings earn rent.' });
    if ((r.interestCoverage || 9) < 2.2) list.push({ id: 'okafor', text: 'Interest cover is ' + (r.interestCoverage || 0).toFixed(1) + 'x. One bad quarter and the rating agencies will notice. I would pay some debt down.' });
    const pool = list.filter(x => has(x.id));
    const pick = pool.length ? (pool.find(x => x.band) || pool[Math.floor(Math.random() * pool.length)]) : null;   // a change in Petrova's advice comes first
    if (pick && pick.band) B().petBand = pick.band;
    return pick;
  }

  /* round 32: start counting buys from day one (buys in Year 1 Q1 were missed: the
     first snapshot of what you own was taken after them, so Chen said you bought nothing) */
  function startTracking() { const b = B(); b.owned = (GameState.portfolio || []).map(p => p.id); b.lastBuyQ = 0; b.buys = []; }
  return { shock, shockOn, noteIssue, cheapDilution, issueInvested, explainIssue, okaforTarget, OK_LINE, startTracking, boardGrant, BOARD_SHARES, noteSale, shrink, payout, uncovQ, overPaying, cutForgiven, update, refresh, letters, votesAgainst, remember, scorecard, ytd, card, level, crisis, RED, ROLE, williamsTarget, name, face,
           addActivist, personal, hint, has, pnav, actWant, bond, bondOf,
           rep, repChange, REP_LINE, REP0, addDirector, removeDirector, logBoard, chair, CHAIR_RED };
})();
