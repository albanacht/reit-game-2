/* ============================================================================
   levi.js — DR. LEVI COHEN, STRATEGY ADVISOR (round 20). window.Levi

   PhD in financial econometrics, CFA charterholder, four papers nobody has
   read. Petrova writes about him in Year 2 Q3 (round 33; a meeting in Years 3-4 is the fallback).

   - He is staff, not a director: no vote, $0.6M a year, on the Staff screen.
   - Round 37 (Moneyball): no more challenges. Four gems a game: the crisis warning
     plus his cost research (belt-tightening), a mispriced suburban building at 15%
     under value, the rate call (lock in 7-year bonds), and the bottom. Ignore two
     and he resigns to write a paper about you. One awkward line at one meeting.
   - (Before round 37:) Every other meeting he set a challenge in glorious gibberish ("the
     heteroskedastic Macaulay convexity of our maturity duration"). Under the
     gibberish is a real number from your books, shown to three decimals, and
     Jenkins quietly translates. Meet it by the next meeting: Williams is
     pleased. Miss it: Williams is a tad less pleased. Miss three: Levi resigns
     to write a paper about you.
   - What he is worth: forecasts. Two quarters before the crisis (and the
     aftershock) he warns you, and he calls the bottom when recovery begins.
   ========================================================================== */

window.Levi = (() => {

  const rnd = () => Math.random();
  const fmt = n => Math.round(n * 1000) / 1000;
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const LEVI = { name: 'Dr. Levi Cohen', face: 'assets/faces/levi.jpg', role: 'Strategy advisor, PhD, CFA' };
  const SAL_Q = 0.15;                                          // $0.6M a year

  function L() {
    const s = Story.S();
    if (!s.levi) s.levi = { stage: 'wait', misses: 0, hits: 0, history: [], warned: {}, log: [] };
    if (!s.levi.gems) s.levi.gems = {};                      // round 37
    return s.levi;
  }
  const has = id => window.Directors && Directors.has(id);
  const lead = (a, b) => has(a) ? a : b;
  const remember = (id, d, why) => { if (has(id)) Directors.remember(id, d, why); };
  const say = (title, body) => { if (window.Inbox) Inbox.message(LEVI.name, LEVI.role, title, body, LEVI.face); };
  const surcharge = d => { GameState._gaSurcharge = Math.round(Math.max(0, (GameState._gaSurcharge || 0) + d) * 10000) / 10000; };
  const note = t => L().log.push({ q: tq(), t });
  const hired = () => L().stage === 'hired';

  /* The gibberish, and the real number underneath it. */
  const avgMaturity = () => {
    const G = GameState, now = tq(), T = (G.debtTranches || []).filter(t => t.maturityYear);
    const tot = T.reduce((a, t) => a + t.amount, 0);
    return tot > 0 ? T.reduce((a, t) => a + t.amount * Math.max(0, (t.maturityYear - 1) * 4 + t.maturityQuarter - now) / 4, 0) / tot : 0;
  };
  const METRICS = [
    { id: 'occ',  val: () => GameState.ratios.occupancyPortfolio || 0,
      name: 'the leptokurtic eigenvalue of our occupancy residuals', hint: 'fill the empty space' },
    { id: 'lev',  val: () => 1 - (GameState.ratios.debtToAssets || 0),
      name: 'the Altman-adjusted Bayesian z-score of our leverage posterior', hint: 'less debt' },
    { id: 'dur',  val: () => avgMaturity() / 10,
      name: 'the heteroskedastic Macaulay convexity of our maturity duration', hint: 'longer bonds, so our debt falls due later' },
    { id: 'pnav', val: () => { const n = GameState.ratios.navPerShare; return n > 0 ? GameState.company.sharePrice / n : 0; },
      name: 'the GARCH-filtered Tobin’s q of our equity drift', hint: 'the share price against NAV' },
    { id: 'cov',  val: () => Math.min(1, (GameState.ratios.interestCoverage || 0) / 6),
      name: 'the Cornish-Fisher fixed-charge kurtosis', hint: 'interest cover' },
    { id: 'div',  val: () => Math.min(1, (GameState.ratios.dividendCoverage || 0) / 2),
      name: 'the Sharpe-Sortino residual of our distribution stochastic', hint: 'cash profit covering the dividend' },
  ];
  const metric = id => METRICS.find(m => m.id === id);
  const STATS = () => {
    const z = (-(1 + rnd() * 1.4)).toFixed(2), p = (0.02 + rnd() * 0.09).toFixed(3);
    return { z, p };
  };
  const SNARK = ['which is, frankly, embarrassing', 'which I have checked four times', 'which I will not dignify with a chart', 'and I have stopped sleeping'];
  const NOD = ['Hm. Erm. Yes.', 'Right. Absolutely. The… yes.', 'I was about to say the same thing.', 'Could you… no, that’s fine.'];
  const pick = a => a[Math.floor(rnd() * a.length)];

  // ============================================================================
  // THE MEETING
  // ============================================================================
  function agenda(year, items) {
    const l = L(); items = items || [];
    // arrival: Petrova knows a man
    // round 33: he normally arrives by letter in Year 2 Q3 (processQuarter). The meeting is only a fallback,
    // for a game where the letter never got its slot (meetings about Years 3 and 4).
    if (l.stage === 'wait' && year >= 3 && year <= 4 && (has('petrova') || has('chen'))) {
      l.stage = 'offered';
      const who = lead('petrova', 'chen');
      items.push({ guest: LEVI, lines: [
        [who, 'Our models are a spreadsheet somebody’s nephew built in 2009. I know a man. PhD in financial econometrics, CFA charterholder, four published papers nobody has read.'],
        ['guest', 'Five, actually. The fifth is under review. It has been under review for three years.'],
        [lead('okafor', 'williams'), 'Another salary.']],
        choices: [
          { label: 'Hire Dr. Levi Cohen ($0.6M a year)', primary: true, detail: 'Strategy advisor: no vote. He forecasts crises and the bottom of them, and finds what the market misprices. ' + (who === 'petrova' ? 'Petrova' : 'Chen') + ' +1, Okafor −0.5.',
            go: () => { l.stage = 'hired'; l.year = year; surcharge(SAL_Q); remember(who, 1, 'you hired Levi'); remember('okafor', -0.5, 'another salary'); note('Hired.'); return 'Levi shook every hand and called the boardroom table "a fascinating dataset".'; } },
          { label: 'Pass', detail: (who === 'petrova' ? 'Petrova' : 'Chen') + ' −0.5. He goes to work for Eleanor at Wexmoor instead.',
            go: () => { l.stage = 'passed'; remember(who, -0.5, 'you passed on Levi'); note('Passed.'); return 'Levi took a job at Wexmoor the following week.'; } },
        ] });
      return items;
    }
    if (!hired()) return items;
    // round 37: no more challenges. Once, at one meeting, he says something awkward and the room reacts. No effect on anyone.
    if (!l.quipDone && year > (l.year || 0) && (year - (l.year || 0) >= 2 || rnd() < 0.4)) {
      l.quipDone = year;
      const st = STATS(), nodder = ['okafor', 'chen', 'petrova', 'hassan', 'mansour', 'grace', 'tex'].filter(has);
      items.push({ guest: LEVI, lines: [
        ['guest', 'Quick one. I ran a two-tailed z-test on ' + pick(METRICS).name + '. z = ' + st.z + ', p = ' + st.p + ', ' + pick(SNARK) + '. That is all. I just wanted someone to know.'],
        ...(nodder.length ? [[pick(nodder), pick(NOD)]] : []),
        ['williams', 'Thank you, Levi. Moving on.']] });
    }
    return items;
  }
  function quit() { const l = L(); l.stage = 'quit'; surcharge(-SAL_Q); note('Resigned.'); }

  // ============================================================================
  // EVERY QUARTER: the forecasts
  // ============================================================================
  function processQuarter(out) {
    const l = L(), s = Story.S();
    // round 33: Petrova's letter, Year 2 Q3 (or the first quarter after it with a free slot)
    if (l.stage === 'wait' && !GameState.meta.gameOver && tq() >= 7 && GameState.meta.year <= 4 && (has('petrova') || has('chen')) && (!s.due || (Story.lowDue && Story.lowDue()))) {
      l.stage = 'letter'; s.due = 'levi_offer'; return;
    }
    if (!hired() || !window.Arc || !Arc.phase || GameState.meta.gameOver) return;
    const now = tq(), ph = Arc.phase(), in2 = Arc.phase(now + 2), in1 = Arc.phase(now + 1);
    const once = (key, title, body) => { if (l.warned[key]) return; l.warned[key] = true; say(title, body); note(title); };
    if (in2 === 'crisis' && ph !== 'crisis') once('crisis', 'A regime change, in about two quarters',
      'My Markov regime-switching model, re-estimated with a Student-t copula, puts the probability of a <b>crisis within two quarters at ' + (68 + Math.floor(rnd() * 12)) + '%</b>. I would hold cash, refinance anything falling due, and not buy anything I couldn’t carry through a bad year.<br><br>I have also prepared a 40-page appendix. You will not read it.');
    if (in2 === 'aftershock' && ph !== 'aftershock') once('after', 'The tail is fatter than the market thinks',
      'The second moment of the recovery is mis-specified. Translation: <b>a second, smaller shock is likely within two quarters (' + (60 + Math.floor(rnd() * 15)) + '%)</b>. Keep some powder dry.');
    // round 34: the belt-tightening question follows each warning, once
    l.beltAsked = l.beltAsked || {};
    ['crisis', 'after'].forEach(k => { if (l.warned[k] && !l.beltAsked[k] && !l.beltFor) { const s = Story.S(); if (!s.due || (Story.lowDue && Story.lowDue())) { l.beltAsked[k] = true; l.beltFor = k; s.due = 'levi_belt'; } } });
    // round 37: the gems (Moneyball). Each one is a card; ignore two and he leaves.
    const G = GameState, free = () => !s.due || (Story.lowDue && Story.lowDue());
    if (ph === 'crisis' && in1 === 'recovery' && !l.gems.bottom && free()) { l.gems.bottom = 'asked'; s.due = 'levi_bottom'; return; }
    if (!l.gems.rates && ph === 'cheap' && G.arc && G.arc.warnStart - now >= 2 && G.arc.warnStart - now <= 4 && longDue().length && free()) { l.gems.rates = 'asked'; s.due = 'levi_rates'; return; }
    if (!l.gems.gem && G.meta.year >= 4 && ph !== 'crisis' && ph !== 'aftershock' && rnd() < 0.3 && gemPick() && free()) { l.gems.gem = 'asked'; l.gemId = gemPick().id; s.due = 'levi_gem'; return; }
    // the second year of belt-tightening: asked in its last quarter
    if (G._belt && !G._belt.y2asked && now >= G._belt.until && free()) { G._belt.y2asked = true; s.due = 'levi_belt2'; return; }
    // deferred maintenance while the second year runs, and the catch-up bill after
    if (G._belt && G._belt.y2 && now <= G._belt.until) {
      const ps = (G.portfolio || []).filter(p => !p.underConstruction && !(window.Tenants && Tenants.isLocked(p)) && p.occupancy > 0.6);
      if (ps.length) { const p = ps[Math.floor(rnd() * ps.length)]; p.occupancy = Math.max(0.5, fmt(p.occupancy - 0.01)); }
    }
    if (G._belt && G._belt.y2 && !G._belt.billed && now > G._belt.until) {
      G._belt.billed = true; const bill = fmt((G._belt.saved || 0.5) / 3);
      G.pnl.unusualItems = fmt((G.pnl.unusualItems || 0) - bill);
      if (window.Inbox) Inbox.message('Jenkins', 'Chief of Staff', 'The catch-up bill', 'Boss, two years of saving have a price: the repairs we put off are due. ' + '$' + bill.toFixed(1) + 'M this quarter. Worth it, on balance.', 'assets/faces/jenkins.jpg');
    }
  }
  /* -- round 37: helpers for the gems -- */
  function ignored() { const l = L(); l.ignored = (l.ignored || 0) + 1;
    if (l.ignored >= 2 && hired()) { quit(); say('Nobody here reads my work', 'I have now been ignored twice, which is statistically significant. I resign, effective Friday. I will be writing a paper about this company. You will be in it.'); return ' Levi has resigned. He is writing a paper about you.'; }
    return ''; }
  const spendable = () => (window.Revolver && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash;
  function longDue() { const G = GameState; return (G.debtTranches || []).filter(t => !t.rescue && !t.unsecured && G.quartersUntilMaturity(t.maturityYear, t.maturityQuarter) <= 12 && G.quartersUntilMaturity(t.maturityYear, t.maturityQuarter) > 1); }
  /* the building his model says is mispriced: suburban, privately held, not for sale, the best cap rate */
  function gemPick() {
    const G = GameState, l = L();
    if (l.gemId) { const g = (G.propertyMarket || []).concat(G.cityRivals || []).find(p => p.id === l.gemId); if (g && (G.portfolio || []).indexOf(g) < 0) return g; }
    const c = (G.propertyMarket || []).filter(p => !p.listedByOwner).concat((G.cityRivals || []).filter(p => p.owner === 'none'))
      .filter(p => p.location === 'suburban' && p.annualNOI > 0 && !p.storyLock && !p.underConstruction && p.currentValue > 5 && p.currentValue <= Math.max(20, (G.balance.totalAssets || 200) * 0.25));
    return c.sort((a, b) => Properties.stabRent(b) / b.currentValue - Properties.stabRent(a) / a.currentValue)[0] || null;
  }
  function bestListing() {
    const G = GameState; return (G.propertyMarket || []).filter(p => p.listedByOwner && p.askingPrice > 0 && p.annualNOI > 0)
      .sort((a, b) => Properties.stabRent(b) / b.askingPrice - Properties.stabRent(a) / a.askingPrice)[0] || null;
  }

  /* round 33: the arrival letter (Year 2 Q3). Same deal as the meeting version. */
  const CARD = { id: 'levi_offer', system: true, story: true, holdQ: 2,
    build() {
      const l = L(); if (l.stage !== 'letter') return null;
      const who = lead('petrova', 'chen'), W = who === 'petrova' ? 'Petrova' : 'Chen';
      return { title: 'Our models are a spreadsheet from 2009', from: Directors.name(who), face: 'assets/faces/' + who + '.jpg',
        body: '"Our forecasting is a spreadsheet somebody’s nephew built in 2009. I know a man. Dr. Levi Cohen: PhD in financial econometrics, CFA charterholder, four published papers nobody has read. He sees downturns coming. He is also… a lot."' +
              '<div class="dv"><img src="' + LEVI.face + '" alt=""><div><b>Levi:</b> "Five papers, actually. The fifth is under review. It has been under review for three years."</div></div>' +
              '<div class="dv-nums">Strategy advisor, not a director: no vote, $0.6M a year. He warns you about two quarters before a crisis, calls the bottom and the rates, and finds buildings the market misprices. A few gems a game; ignore two and he leaves.</div>',
        choices: [
          { label: 'Hire Dr. Levi Cohen ($0.6M a year)', detail: W + ' +1, Okafor −0.5. A few times a game his research finds something worth acting on. Ignore him twice and he leaves.',
            apply() { l.stage = 'hired'; l.year = GameState.meta.year - 1; surcharge(SAL_Q); remember(who, 1, 'you hired Levi'); remember('okafor', -0.5, 'another salary'); note('Hired (letter).');
                      return 'Levi starts on Monday. He has asked for a second monitor and "access to the residuals".'; } },
          { label: 'Pass', detail: W + ' −0.5. He goes to work for Eleanor at Wexmoor instead.',
            apply() { l.stage = 'passed'; remember(who, -0.5, 'you passed on Levi'); note('Passed (letter).'); return 'Levi took a job at Wexmoor the following week.'; } },
        ] };
    } };
  if (window.World && World.DECISIONS && !World.DECISIONS.some(d => d.id === CARD.id)) World.DECISIONS.push(CARD);

  /* round 34: after Levi's crisis (or aftershock) warning, a one-off choice: tighten belts for a year. */
  const BELT = { id: 'levi_belt', system: true, story: true, holdQ: 1,
    build() {
      const l = L(); if (!l.beltFor) return null;
      const after = l.beltFor === 'after', G = GameState, ga = G.pnl && G.pnl.gAndA ? G.pnl.gAndA * 4 : 0;
      const bonus = window.Pay && Pay.bonusFor ? Pay.bonusFor().amount : 0;
      return { title: after ? 'My research: brace for the second shock' : 'My research: what we can cut before it hits', from: LEVI.name + ', ' + LEVI.role, face: LEVI.face,
        body: '"I regressed every cost line we have against what it earns us. A tenth of our overheads is, statistically, decoration. ' + (after ? 'A second shock is coming. ' : 'The next two years will be hard. ') + 'Cut it for a year and suspend every bonus, yours too. Jenkins says the board likes a CEO who goes first. I would not know."' +
              '<table class="dv-nums"><tr><td>Overheads now</td><td>about $' + ga.toFixed(1) + 'M a year</td></tr><tr><td>Saving</td><td>about $' + (ga * 0.1).toFixed(1) + 'M over the year</td></tr>' +
              '<tr><td>Your cost</td><td>no bonus at the next pay committee (about $' + bonus.toFixed(1) + 'M at today’s scorecard) and no share grant this year</td></tr></table>' +
              '<div class="dv-nums">It saves less than it signals: lenders, directors and shareholders see a company getting ready.</div>',
        choices: [
          { label: 'Tighten belts for a year (1 political capital)', detail: 'Every department has to be talked into it. Overheads −10% for 4 quarters. No bonuses or share grants this year, for anyone, you included. Okafor +1, Petrova +0.5.',
            check: () => (GameState.board.politicalCapital || 0) >= 1, checkMsg: 'Needs 1 political capital',
            apply() { const G = GameState, now = tq(); G._belt = { until: now + 3, noBonusYear: G.meta.year, why: l.beltFor }; l.beltFor = null; l.belt = (l.belt || 0) + 1; l.gems.belt = 'taken';
                      remember('okafor', 1, 'you tightened belts before the storm'); remember('petrova', 0.5, 'you suspended your own bonus');
                      G.board.politicalCapital = Math.max(0, (G.board.politicalCapital || 0) - 1); note('Belts tightened.');
                      return 'Done. Overheads are down a tenth for a year and the bonus pool is closed. Jenkins has already cancelled the Christmas party’s ice sculpture.'; } },
          { label: 'Carry on as normal', detail: 'Nothing changes. Levi sighs, statistically.',
            apply() { l.beltFor = null; note('Carried on as normal.'); return 'Business as usual. Levi updated his model to include "management optimism".' + ignored(); } },
        ] };
    } };
  if (window.World && World.DECISIONS && !World.DECISIONS.some(d => d.id === BELT.id)) World.DECISIONS.push(BELT);

  /* -- round 37: the gem cards -- */
  const GEMS = [
    { id: 'levi_gem', system: true, story: true, holdQ: 2,
      build() {
        const l = L(), p = gemPick(); if (l.gems.gem !== 'asked' || !p) return null;
        const price = fmt(p.currentValue * 0.85), stab = Properties.stabRent(p), capOn = stab / price * 100, after = capOn * 1.10;
        return { title: 'My model found a mispriced building', from: LEVI.name + ', ' + LEVI.role, face: LEVI.face,
          body: '"Nobody looks at <b>' + p.name + '</b>. Suburban, unfashionable, the photos are terrible. But the owner is retiring, the rents are 10% under the area’s, and the tenants never leave. It is the Moneyball building: ugly, and it catches every ball."' +
                '<table class="dv-nums"><tr><td>Value</td><td>$' + p.currentValue.toFixed(1) + 'M</td></tr><tr><td>The owner would take</td><td>$' + price.toFixed(1) + 'M (15% under value)</td></tr>' +
                '<tr><td>Cap rate on that price</td><td>' + capOn.toFixed(1) + '%, about ' + after.toFixed(1) + '% once rents reset to the area’s</td></tr><tr><td>You borrow at about</td><td>' + (window.Market ? Market.getCurrentBorrowingRate().toFixed(1) : '?') + '%</td></tr></table>',
          choices: [
            { label: 'Buy it for $' + price.toFixed(1) + 'M', detail: 'Off the market, at 15% under value. Rents reset 10% higher. Chen +1.',
              check: () => spendable() >= price * 1.02, checkMsg: 'Not enough cash and credit line',
              apply() { const m = window.World && World.buyAt ? World.buyAt(p, price) : ''; if ((GameState.portfolio || []).indexOf(p) > -1) { p.annualNOI = fmt(p.annualNOI * 1.10); p.vb = null; remember('chen', 1, 'Levi’s building'); l.gems.gem = 'taken'; note('Bought the Moneyball building.'); return 'Bought ' + p.name + '. Levi printed the regression and pinned it in the lobby.'; } return m || 'The deal fell through.'; } },
            { label: 'Pass', detail: 'Levi will notice.', apply() { l.gems.gem = 'passed'; return 'You passed. Levi said "fine" in a way that had a confidence interval.' + ignored(); } },
          ] };
      } },
    { id: 'levi_rates', system: true, story: true, holdQ: 2,
      build() {
        const l = L(), due = longDue(); if (l.gems.rates !== 'asked' || !due.length) return null;
        const amt = fmt(due.reduce((a, t) => a + t.amount, 0)), r7 = fmt((Financials.getCurrentBorrowingRateForTerm ? Financials.getCurrentBorrowingRateForTerm(7) : 6) + 0.25), fee = fmt(amt * 0.005);
        return { title: 'Lock in long money. Now.', from: LEVI.name + ', ' + LEVI.role, face: LEVI.face,
          body: '"The yield curve is doing something I have only seen in papers about bad decades. In about a year, money will cost a lot more. $' + amt.toFixed(0) + 'M of our bonds fall due within three years. Swap them for 7-year bonds today and the storm can do what it likes."',
          choices: [
            { label: 'Swap them into 7-year bonds at ' + r7.toFixed(2) + '% ($' + fee.toFixed(1) + 'M fee)', detail: 'Nothing falls due for 7 years. Okafor +1.',
              apply() { const G = GameState, y = G.meta.year + 7; due.forEach(t => { t.maturityYear = y; t.maturityQuarter = G.meta.quarter; t.rate = r7; t.label = r7.toFixed(2) + '% Notes due Y' + y + 'Q' + G.meta.quarter; t.quartersUntilMaturity = G.quartersUntilMaturity(y, G.meta.quarter); });
                        G._pendingUnusual = fmt((G._pendingUnusual || 0) - fee); remember('okafor', 1, 'you locked in long money'); l.gems.rates = 'taken'; note('Locked in long bonds.'); return 'Done: $' + amt.toFixed(0) + 'M now falls due in Year ' + y + '.'; } },
            { label: 'Not now', detail: 'Levi will notice.', apply() { l.gems.rates = 'passed'; return 'Levi added a footnote to his paper.' + ignored(); } },
          ] };
      } },
    { id: 'levi_bottom', system: true, story: true, holdQ: 1,
      build() {
        const l = L(); if (l.gems.bottom !== 'asked') return null;
        const p = bestListing();
        return { title: 'The bottom, statistically', from: LEVI.name + ', ' + LEVI.role, face: LEVI.face,
          body: '"The cointegration between our cap rates and the base rate has broken back toward its mean. <b>The worst is about to pass.</b> Weak owners will sell in the next few quarters. This is when people get rich. Usually other people. It could be us."' +
                (p ? '<table class="dv-nums"><tr><td>My pick</td><td>' + p.name + ', asking $' + p.askingPrice.toFixed(1) + 'M, cap rate ' + (Properties.stabRent(p) / p.askingPrice * 100).toFixed(1) + '%</td></tr></table>' : ''),
          choices: [
            { label: p ? 'Make an offer on ' + p.name : 'Noted: we buy this year', detail: p ? 'Opens the offer screen.' : 'Chen +0.5.',
              apply() { l.gems.bottom = 'taken'; remember('chen', 0.5, 'you listened to Levi at the bottom'); if (p && window.Deals && Deals.openOffer) setTimeout(() => Deals.openOffer(p.id), 0); return 'Levi looked almost happy.'; } },
            { label: 'Not now', detail: 'Levi will notice.', apply() { l.gems.bottom = 'passed'; return 'Levi muttered something about "regime persistence".' + ignored(); } },
          ] };
      } },
    { id: 'levi_belt2', system: true, story: true, holdQ: 1,
      build() {
        const G = GameState, B = G._belt; if (!B || B.y2 || !B.y2asked) return null;
        const ga = G.pnl && G.pnl.gAndA ? G.pnl.gAndA * 4 : 3;
        return { title: 'Another year of belt-tightening?', from: 'Jenkins, Chief of Staff', face: 'assets/faces/jenkins.jpg',
          body: '"Boss, the year of savings ends this quarter. We can do one more, but it will start to show: repairs get put off, the buildings notice, and some of the bill comes back later."' +
                '<table class="dv-nums"><tr><td>Saves</td><td>about $' + (ga * 0.1).toFixed(1) + 'M over the year</td></tr><tr><td>Costs</td><td>2 political capital, no bonuses again, a point of occupancy a quarter somewhere, and a catch-up bill of about a third of the saving</td></tr></table>',
          choices: [
            { label: 'One more year (2 political capital)', check: () => (G.board.politicalCapital || 0) >= 2, checkMsg: 'Needs 2 political capital',
              detail: 'Overheads −10% for 4 more quarters. No bonuses next year either.',
              apply() { G.board.politicalCapital -= 2; B.until = tq() + 4; B.noBonusYear = G.meta.year + (G.meta.quarter >= 3 ? 1 : 0); B.y2 = true; B.saved = fmt(ga * 0.1); return 'Another year of savings. The maintenance team has started a betting pool.'; } },
            { label: 'End it here', detail: 'Overheads go back to normal next quarter.', apply() { return 'The savings end. The coffee machine is back.'; } },
          ] };
      } },
  ];
  GEMS.forEach(c => { if (window.World && World.DECISIONS && !World.DECISIONS.some(d => d.id === c.id)) World.DECISIONS.push(c); });

  /* The Staff screen card. */
  function staffHTML() {
    if (!hired()) return '';
    const l = L(), m = l.ch && !l.ch.done ? metric(l.ch.id) : null;
    return '<div class="staff-row"><img class="staff-portrait" src="' + LEVI.face + '" alt="Levi">' +
      '<div class="staff-info"><div class="staff-name-row"><span class="staff-name">Dr. Levi Cohen</span></div><div class="staff-title">Strategy advisor · PhD, CFA · no vote</div>' +
      '<div class="staff-trait">Runs the numbers nobody else runs: the crisis, the bottom, rates, and buildings the market misprices. ' + gemsTaken() + ' of his finds acted on' + (l.ignored ? ', ' + l.ignored + ' ignored (two and he leaves)' : '') + '.</div></div>' +
      '<div class="staff-right"><div class="staff-cost">$' + SAL_Q.toFixed(2) + 'M/q</div></div></div>';
  }
  /* The ending card. */
  function gemsTaken() { const g = L().gems || {}; return Object.keys(g).filter(k => g[k] === 'taken').length; }
  function ending() { const s = L().stage; return s === 'hired' ? 'stayed' : s === 'quit' ? 'quit' : s === 'passed' ? 'passed' : 'none'; }
  function debug(o) { Object.assign(L(), o || {}); return L(); }

  return { L, agenda, processQuarter, staffHTML, ending, debug, METRICS, metric, gemPick, gemsTaken };
})();
