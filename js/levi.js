/* ============================================================================
   levi.js — DR. LEVI COHEN, STRATEGY ADVISOR (round 20). window.Levi

   PhD in financial econometrics, CFA charterholder, four papers nobody has
   read. Petrova writes about him in Year 2 Q3 (round 33; a meeting in Years 3-4 is the fallback).

   - He is staff, not a director: no vote, $0.6M a year, on the Staff screen.
   - Every other meeting he sets a challenge in glorious gibberish ("the
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
          { label: 'Hire Dr. Levi Cohen ($0.6M a year)', primary: true, detail: 'Strategy advisor: no vote. He forecasts crises and the bottom of them, and sets the board a challenge every other year. ' + (who === 'petrova' ? 'Petrova' : 'Chen') + ' +1, Okafor −0.5.',
            go: () => { l.stage = 'hired'; l.year = year; surcharge(SAL_Q); remember(who, 1, 'you hired Levi'); remember('okafor', -0.5, 'another salary'); note('Hired.'); return 'Levi shook every hand and called the boardroom table "a fascinating dataset".'; } },
          { label: 'Pass', detail: (who === 'petrova' ? 'Petrova' : 'Chen') + ' −0.5. He goes to work for Eleanor at Wexmoor instead.',
            go: () => { l.stage = 'passed'; remember(who, -0.5, 'you passed on Levi'); note('Passed.'); return 'Levi took a job at Wexmoor the following week.'; } },
        ] });
      return items;
    }
    if (!hired()) return items;
    // the verdict on last year's challenge
    if (l.ch && l.ch.year < year && !l.ch.done) {
      const m = metric(l.ch.id), v = fmt(m.val()), met = v >= l.ch.target - 0.0005;
      l.ch.done = true; l.ch.final = v; l.ch.met = met; l.history.push({ y: year, id: l.ch.id, met, v, target: l.ch.target });
      if (met) { l.hits++; items.push({ guest: LEVI, lines: [['guest', 'The ' + m.name.replace(/^the /, '') + ': ' + v.toFixed(3) + '. Target ' + l.ch.target.toFixed(3) + '. The residuals are… normal. I’m genuinely moved.'], ['williams', 'Well done. I think.']],
        effect: () => { remember('williams', 0.5, 'you did what Levi asked'); return 'Levi’s challenge met. Williams +0.5.'; } }); }
      else { l.misses++; items.push({ guest: LEVI, lines: [['guest', v.toFixed(3) + '. The target was ' + l.ch.target.toFixed(3) + '. I’ll need to re-specify the model. Possibly the company.'], ['williams', 'Levi asked for one number.']],
        effect: () => { remember('williams', -0.5, 'you ignored Levi’s number'); if (l.misses >= 3) { quit(); return 'Levi has resigned to write a paper about you. Williams −0.5.'; } return 'Levi’s challenge missed. Williams −0.5.'; } }); }
      return items;
    }
    // a new challenge, every other meeting
    if ((!l.ch || l.ch.done) && (!l.ch || year - l.ch.year >= 2) && year > l.year) {
      const used = (l.history || []).map(h => h.id), pool = METRICS.filter(m => used.indexOf(m.id) < 0 && m.val() > 0.02);
      const m = pick(pool.length ? pool : METRICS), v = fmt(m.val()), st = STATS();
      l.ch = { id: m.id, year, base: v, target: fmt(v + 0.03) };
      const nodder = ['okafor', 'chen', 'petrova', 'hassan', 'mansour', 'grace', 'tex'].filter(has);
      items.push({ guest: LEVI, lines: [
        ['guest', 'I ran a two-tailed z-test on ' + m.name + '. z = ' + st.z + ', p = ' + st.p + ', ' + pick(SNARK) + '. Current reading: ' + v.toFixed(3) + '. I’d like ' + l.ch.target.toFixed(3) + ' by the next meeting. Plus or minus nothing.'],
        ...(nodder.length ? [[pick(nodder), pick(NOD)]] : []),
        ['williams', 'Levi is right. Make the… that number… work by next year.']],
        note: 'Levi’s number: ' + v.toFixed(3) + ' → ' + l.ch.target.toFixed(3) + ' by the next meeting. Jenkins, quietly: "I think he means: ' + m.hint + '."' });
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
    if (ph === 'crisis' && in1 === 'recovery') once('bottom', 'The bottom, statistically',
      'The cointegration between our cap rates and the base rate has broken back toward its mean. <b>The worst is about to pass.</b> Weak owners will have to sell in the next few quarters. This is when people get rich. Usually other people. It could be us.');
  }

  /* round 33: the arrival letter (Year 2 Q3). Same deal as the meeting version. */
  const CARD = { id: 'levi_offer', system: true, story: true, holdQ: 2,
    build() {
      const l = L(); if (l.stage !== 'letter') return null;
      const who = lead('petrova', 'chen'), W = who === 'petrova' ? 'Petrova' : 'Chen';
      return { title: 'Our models are a spreadsheet from 2009', from: Directors.name(who), face: 'assets/faces/' + who + '.jpg',
        body: '"Our forecasting is a spreadsheet somebody’s nephew built in 2009. I know a man. Dr. Levi Cohen: PhD in financial econometrics, CFA charterholder, four published papers nobody has read. He sees downturns coming. He is also… a lot."' +
              '<div class="dv"><img src="' + LEVI.face + '" alt=""><div><b>Levi:</b> "Five papers, actually. The fifth is under review. It has been under review for three years."</div></div>' +
              '<div class="dv-nums">Strategy advisor, not a director: no vote, $0.6M a year. He warns you about two quarters before a crisis, calls the bottom, and sets the board a number to hit every other year (Williams likes it when you hit it).</div>',
        choices: [
          { label: 'Hire Dr. Levi Cohen ($0.6M a year)', detail: W + ' +1, Okafor −0.5. He sets his first challenge at the next board meeting.',
            apply() { l.stage = 'hired'; l.year = GameState.meta.year - 1; surcharge(SAL_Q); remember(who, 1, 'you hired Levi'); remember('okafor', -0.5, 'another salary'); note('Hired (letter).');
                      return 'Levi starts on Monday. He has asked for a second monitor and "access to the residuals".'; } },
          { label: 'Pass', detail: W + ' −0.5. He goes to work for Eleanor at Wexmoor instead.',
            apply() { l.stage = 'passed'; remember(who, -0.5, 'you passed on Levi'); note('Passed (letter).'); return 'Levi took a job at Wexmoor the following week.'; } },
        ] };
    } };
  if (window.World && World.DECISIONS && !World.DECISIONS.some(d => d.id === CARD.id)) World.DECISIONS.push(CARD);

  /* The Staff screen card. */
  function staffHTML() {
    if (!hired()) return '';
    const l = L(), m = l.ch && !l.ch.done ? metric(l.ch.id) : null;
    return '<div class="staff-row"><img class="staff-portrait" src="' + LEVI.face + '" alt="Levi">' +
      '<div class="staff-info"><div class="staff-name-row"><span class="staff-name">Dr. Levi Cohen</span></div><div class="staff-title">Strategy advisor · PhD, CFA · no vote</div>' +
      '<div class="staff-trait">' + (m ? 'Current challenge: ' + m.name + ': ' + fmt(m.val()).toFixed(3) + ' → ' + l.ch.target.toFixed(3) + ' <span class="text-muted">(Jenkins: "' + m.hint + '")</span>' : 'Forecasts crises and the bottom of them. ' + l.hits + ' challenge' + (l.hits === 1 ? '' : 's') + ' met, ' + l.misses + ' missed.') + '</div></div>' +
      '<div class="staff-right"><div class="staff-cost">$' + SAL_Q.toFixed(2) + 'M/q</div></div></div>';
  }
  /* The ending card. */
  function ending() { const s = L().stage; return s === 'hired' ? 'stayed' : s === 'quit' ? 'quit' : s === 'passed' ? 'passed' : 'none'; }
  function debug(o) { Object.assign(L(), o || {}); return L(); }

  return { L, agenda, processQuarter, staffHTML, ending, debug, METRICS, metric };
})();
