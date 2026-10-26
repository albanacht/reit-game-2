/* ============================================================================
   listing.js — STORY 5: THE INDEX (round 14). window.IndexFund

   Joining the National REIT 100, the index the Granite REIT ETF tracks.
   How it works in real life, simplified: nobody applies. Twice a year (end
   of Q2 and Q4) the index provider checks three tests:
     1. size: market cap at least $175M
     2. free float: no outside holder above 10% (Kessler's stake counts)
     3. profit: positive GAAP net income last quarter and over the last four
        (depreciation and write-downs count, so the tower can block it)
   Pass a review: an analyst puts us on the candidates list (price +3%).
   Pass the next one: announced (+5%), in from the next quarter: index funds
   own about 15% of us, the price bracket is 3% higher for good, new shares
   cost 1 point less, and Kessler finds it harder to buy a stake.
   Fall below 75% of the size test, post a loss year, or let Kessler reach
   15%: dropped at the next review (−5%, forced selling).

   The price of being in: Henrik Dahl, Granite's head of stewardship, visits
   the first meeting after we join with governance asks (the poison pill, an
   executive chairman, the CEO's friend on the board). Refuse one and Granite
   votes against a director every year (reputation −10). And from then on the
   shareholders vote on your pay every year ("say on pay"): lose the vote and
   the board must cut it, or ignore them and pay for that too.
   ========================================================================== */

window.IndexFund = (() => {

  const rnd = () => Math.random();
  const fmt = n => Math.round(n * 100) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const money = n => '$' + Math.abs(n).toFixed(Math.abs(n) >= 10 ? 0 : 1) + 'M';
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const FACE = k => 'assets/faces/' + k + '.jpg';
  const INDEX = 'National REIT 100', ETF = 'the Granite REIT Index ETF';
  const DAHL = { name: 'Henrik Dahl', face: FACE('dahl'), role: 'Head of Stewardship, Granite Funds' };
  const ANALYST = 'Marcus Oyelaran', ANROLE = 'Index strategist, Halverson Bank';
  const SIZE = 175, PREMIUM = 1.03;

  function X() {
    const s = Story.S();
    if (!s.idx) s.idx = { stage: 'out', ni: [], writes: 0, asks: {}, targets: [], log: [] };
    return s.idx;
  }
  const has = id => window.Directors && Directors.has(id);
  const lead = (a, b) => has(a) ? a : b;
  const cap = () => (GameState.board && GameState.board.politicalCapital) || 0;
  const spendPC = n => { GameState.board.politicalCapital = Math.max(0, cap() - n); };
  const remember = (id, d, why) => { if (has(id)) Directors.remember(id, d, why); };
  const say = (from, role, title, body, face) => { if (window.Inbox) Inbox.message(from, role, title, body, face); };
  const price = f => { GameState.company.sharePrice = fmt(GameState.company.sharePrice * f); };
  const note = t => X().log.push({ q: tq(), t });

  const mcap = () => GameState.company.sharePrice * GameState.company.sharesOutstanding;
  const kessler = () => window.War && War.W ? (War.W().stake || 0) : 0;
  const lastQ = () => { const n = X().ni; return n.length ? n[n.length - 1] : null; };
  const last4 = () => { const n = X().ni; return n.length >= 4 ? n.slice(-4).reduce((a, b) => a + b, 0) : null; };

  /* The three tests, as the checklist shows them. */
  function tests() {
    const m = mcap(), k = kessler(), q = lastQ(), y = last4();
    return [
      { k: 'Size: market cap at least ' + money(SIZE), v: money(m), ok: m >= SIZE },
      { k: 'Free float: no outside holder above 10%', v: k > 0 ? 'Rennick ' + k.toFixed(1) + '%' : 'yes', ok: k < 10 },
      { k: 'Profit: GAAP net income positive, last quarter and last 4', v: q == null ? 'not enough history' : money(q) + (q < 0 ? ' loss' : '') + ' / ' + (y == null ? '—' : money(y) + (y < 0 ? ' loss' : '')), ok: q != null && y != null && q > 0 && y > 0 },
    ];
  }
  const allOk = () => tests().every(t => t.ok);
  const included = () => X().stage === 'in';
  const premium = () => included() ? PREMIUM : 1;
  const isReview = () => GameState.meta.quarter === 2 || GameState.meta.quarter === 4;
  const quartersToReview = () => { const q = GameState.meta.quarter; return q <= 2 ? 2 - q : 4 - q; };

  /* A write-down this quarter (the tower, the auditors) hits GAAP profit. */
  function writeDown(amt) { if (amt > 0) X().writes = fmt((X().writes || 0) + amt); }

  // ============================================================================
  // EVERY QUARTER (story.js processQuarter). GameState.pnl is still last
  // quarter's here, so that is the quarter we record.
  // ============================================================================
  function processQuarter(out) {
    const x = X(), G = GameState;
    if (G.meta.totalQuarters < 1) return;
    x.ni.push(fmt((G.pnl.netIncome || 0) - (x.writes || 0))); x.writes = 0;
    while (x.ni.length > 8) x.ni.shift();
    if (G.meta.year < 4) return;
    // the first time we are close: the checklist
    if (!x.told && tests().filter(t => t.ok).length >= 2) {
      x.told = true;
      const ir = window.Staff && Staff.getStaff && Staff.getStaff('ir');
      say(ir ? ir.name : 'Director Petrova', ir ? 'Head of Investor Relations' : 'Director', 'We could join the ' + INDEX,
        'The ' + INDEX + ' is the index ' + ETF + ' tracks. Nobody applies: twice a year (end of Q2 and Q4) the index provider checks three tests, and if we pass twice in a row we are in. Index funds would then own about 15% of us, for good.' +
        rows() + '<div class="dv-nums">Being in: share price bracket +3% for good, a one-off jump when it is announced, cheaper share issues. The catch: index funds vote. On governance, and on your pay.</div>',
        ir ? null : FACE('petrova'));
    }
    if (!isReview()) return;
    const ok = allOk();
    if (x.stage === 'out' && ok && !(x.coolUntil && tq() < x.coolUntil)) {
      x.stage = 'candidate'; price(1.03); note('On the candidates list.');
      say(ANALYST, ANROLE, 'Candidate for the ' + INDEX, 'Our note to clients this morning: ' + GameState.company.name + ' now passes every test for the ' + INDEX + '. If it still does at the next review, it is in. Traders are buying ahead of the index funds: share price +3%.' + rows(), null);
      out.push({ good: true, text: 'Analysts name us a candidate for the ' + INDEX + '. Share price +3%.', w: 8 });
    } else if (x.stage === 'candidate') {
      if (ok) {
        x.stage = 'in'; x.inQ = tq(); x.inYear = G.meta.year; price(1.05); note('Joined the index.');
        out.push({ good: true, text: 'We join the ' + INDEX + '. Index funds must buy our shares: price +5%.', w: 10 });
        say(ANALYST, ANROLE, 'In: the ' + INDEX, 'Confirmed: ' + GameState.company.name + ' joins the ' + INDEX + '. ' + ETF + ' and the other index funds now hold about 15% of our shares, and will for as long as we stay in. Expect a call from Granite’s stewardship team.', null);
        remember('petrova', 1.5, 'we joined the ' + INDEX);
      } else {
        x.stage = 'out'; price(0.98); note('Missed the index.');
        out.push({ good: false, text: 'We failed the index review after all. Traders sell: price −2%.' });
      }
    } else if (x.stage === 'in' && tq() > x.inQ) {
      const why = mcap() < SIZE * 0.75 ? 'too small (market cap ' + money(mcap()) + ')' : (last4() != null && last4() < 0) ? 'a loss over the last four quarters' : kessler() >= 15 ? 'Rennick holds ' + kessler().toFixed(1) + '% of us' : null;
      if (why) {
        x.stage = 'out'; x.dropped = (x.dropped || 0) + 1; x.coolUntil = tq() + 4; price(0.95); note('Dropped from the index.');
        out.push({ good: false, text: 'Dropped from the ' + INDEX + ': ' + why + '. Index funds must sell: price −5%.', w: 10 });
        remember('petrova', -1.5, 'we were dropped from the ' + INDEX);
      }
    }
  }
  function rows() { return '<table class="dv-nums">' + tests().map(t => '<tr><td>' + (t.ok ? '✓ ' : '✗ ') + t.k + '</td><td>' + t.v + '</td></tr>').join('') + '</table>'; }

  /* "On the clock" lines in the inbox. */
  function clockRows() {
    const x = X(); if (!x.told || GameState.meta.gameOver) return [];
    const n = tests().filter(t => t.ok).length, q = quartersToReview(), when = q === 0 ? 'this quarter' : q === 1 ? '1 qtr' : q + ' qtrs';
    if (x.stage === 'in') return [{ tone: n < 3 ? 'warn' : '', k: 'In the ' + INDEX + ': ' + n + ' of 3 tests met. Next review', v: when }];
    return [{ tone: x.stage === 'candidate' ? 'warn' : '', k: (x.stage === 'candidate' ? 'Index candidate: pass again to join' : INDEX + ': ' + n + ' of 3 tests met') + '. Next review', v: when }];
  }

  // ============================================================================
  // THE MEETING: Granite's stewardship visit, and Granite's votes against
  // ============================================================================
  function agenda(year, items) {
    const x = X(); items = items || [];
    if (!included()) return items;
    // every year: directors Granite is voting against
    (x.targets || []).forEach(tg => {
      if (!has(tg.id) || tg.year === year) return; tg.year = year;
      items.push({ lines: [['note', 'Granite voted its 15% against ' + Directors.name(tg.id).replace(/^(Chairman|Chair|Director) /, '') + ' at the shareholders’ meeting (' + tg.why + ').']],
        effect: () => { if (window.Directors) Directors.repChange(tg.id, -10, 'Granite votes against: ' + tg.why); return Directors.name(tg.id) + '’s reputation −10 (now ' + Directors.rep(tg.id) + ').'; } });
    });
    if (x.visited) return items;
    x.visited = year;
    const asks = [];
    const now = tq();
    if (window.War && War.W().pillUntil && War.W().pillUntil > now) asks.push('pill');
    if (GameState.board.chair === 'you') asks.push('chair');
    if (has('tex')) asks.push('tex');
    items.push({ guest: DAHL, lines: [['guest', 'Thank you for having me. Granite now owns about 15% of this company through our index funds, and we cannot sell. So we vote. ' + (asks.length ? 'I have ' + asks.length + ' request' + (asks.length > 1 ? 's' : '') + ', and one announcement.' : 'Just one announcement.')]] });
    const refuse = (id, why, msg) => { x.targets.push({ id, why, year: null }); return msg; };
    if (asks.indexOf('pill') > -1) items.push({ guest: DAHL, lines: [['guest', 'Your shareholder rights plan. We vote against poison pills everywhere. Please drop it.'], ['petrova', 'I said so when we adopted it.']],
      choices: [
        { label: 'Drop the pill', detail: 'Kessler is no longer capped at 14.9%. Petrova +1.', go: () => { War.W().pillUntil = null; remember('petrova', 1, 'you dropped the pill'); x.asks.pill = 'agreed'; return 'The rights plan is withdrawn.'; } },
        { label: 'Keep it', detail: 'Granite votes against the chair every year: reputation −10 a year.', go: () => { x.asks.pill = 'refused'; return refuse(Directors.chair(), 'the poison pill', 'Mr Dahl wrote something down.'); } },
      ] });
    if (asks.indexOf('chair') > -1) items.push({ guest: DAHL, lines: [['guest', 'A CEO who chairs the board that sets his own pay. Granite will not support that. We ask for an independent chair.']],
      choices: [
        { label: 'Step down as chairman', detail: (has('petrova') ? 'Petrova' : 'The lead director') + ' takes the chair (red line: ' + (Directors.CHAIR_RED.petrova ? Directors.CHAIR_RED.petrova.text : 'none') + ').', go: () => { GameState.board.chair = has('petrova') ? 'petrova' : Directors.chair(); Directors.logBoard('The CEO gave up the chair; ' + Directors.name(GameState.board.chair) + ' took it.'); x.asks.chair = 'agreed'; return Directors.name(GameState.board.chair) + ' is the new chair.'; } },
        { label: 'Stay chairman', detail: 'Granite votes against Petrova, the lead director, every year (reputation −10 a year) for not stopping it.', go: () => { x.asks.chair = 'refused'; return refuse(lead('petrova', Directors.chair()), 'an executive chairman', 'Mr Dahl closed his folder.'); } },
      ] });
    if (asks.indexOf('tex') > -1) items.push({ guest: DAHL, lines: [['guest', 'Mr Brennan. A friend of the CEO from a Dallas deal, on the committee that votes on the CEO’s pay. We ask that he step down.'], ['tex', 'Well, I never.']],
      choices: [
        { label: 'Ask Tex to step down', detail: 'Tex leaves the board (no more political capital to hold his seat). Petrova +1.', go: () => { Directors.removeDirector('tex', 'Tex Brennan stepped down at Granite’s request.'); remember('petrova', 1, 'Tex left'); x.asks.tex = 'agreed'; return 'Tex shook your hand. "No hard feelings, partner. Mostly."'; } },
        { label: 'Keep Tex', detail: 'Granite votes against Tex every year: reputation −10 a year. Below 30, he is out anyway.', go: () => { x.asks.tex = 'refused'; return refuse('tex', 'a friend of the CEO', '"They can vote all they like," said Tex.'); } },
      ] });
    items.push({ guest: DAHL, lines: [['guest', 'And the announcement. From this year your shareholders vote on your pay at every annual meeting. It is advisory. In practice, a board that ignores it does not stay a board for long.']] });
    return items;
  }

  // ============================================================================
  // SAY ON PAY (pay.js asks for this item after the bonus)
  // ============================================================================
  function sayOnPayItem(year, items) {
    if (!included() || !window.Pay) return null;
    const x = X();
    return { lines: [], effect: () => {
      const c = Pay.L(), log = c.log.filter(e => e.y === year).pop(), P = Pay.PKG[c.pkg] || Pay.PKG.balanced, y = Directors.ytd ? Directors.ytd() : null;
      let p = 88, why = [];
      if (y && y.you < y.sector) { p -= 20; why.push('returns below the rivals'); }
      if (log && log.bonus > P.bonus * (c.cut || 1) * 1.25) { p -= 15; why.push('a big bonus'); }
      if (log && log.extra > 0) { p -= 15; why.push('a special award'); }
      if (GameState.board.chair === 'you') { p -= 10; why.push('you chair the board'); }
      if (c.pkg === 'salary') { p -= 8; why.push('mostly salary, not shares'); }
      if (c.pkg === 'stock') p += 5;
      if (window.Staff && Staff.hasRole && Staff.hasRole('ir')) p += 8;
      p += Math.round((window.Agents ? Agents.strength('pay') : 0) * 30);   // round 22: someone working the vote
      if (GameState.board.probation) { p -= 10; why.push('probation'); }
      if (x.ignored) { p -= 10; why.push('last year’s vote was ignored'); }
      if (window.Gary && Gary.flagged()) { p -= 15; why.push('the Lakeside contract'); }
      p = Math.round(clamp(p + (rnd() - 0.5) * 16, 20, 98));
      if (x.sopForce != null) p = x.sopForce;                 // tests
      x.sop = x.sop || []; x.sop.push({ y: year, p });
      if (p >= 70) return 'Say on pay: ' + p + '% of shareholders voted for your pay.';
      if (p >= 50) return 'Say on pay: ' + p + '% for. It passes, but Granite writes to the board: below 70% is a warning' + (why.length ? ' (' + why.join(', ') + ')' : '') + '.';
      items.push({ guest: DAHL, lines: [['guest', 'Only ' + p + '% of your shareholders voted for your pay' + (why.length ? ': ' + why.join(', ') : '') + '. Granite voted against. We expect the board to respond.'],
                                        [lead('petrova', Directors.chair()), 'We have to answer this.']],
        choices: [
          { label: 'Cut your pay by a quarter', primary: true, detail: 'Bonus target and share grants −25% from now on. Petrova +1. Granite is satisfied.', go: () => { c.cut = fmt((c.cut || 1) * 0.75); x.ignored = false; remember('petrova', 1, 'you took the pay cut'); return 'Your bonus target and share grants are cut by a quarter.'; } },
          { label: 'Ignore the vote', detail: 'Your pay stays. Granite votes against the chair every year (reputation −10), next year’s vote starts 10 points lower. Petrova −1.5.', go: () => { x.ignored = true; remember('petrova', -1.5, 'you ignored the pay vote'); if (!x.targets.some(t => t.why === 'ignoring the pay vote')) x.targets.push({ id: Directors.chair(), why: 'ignoring the pay vote', year: year }); return 'The board noted the vote. Nothing changes.'; } },
        ] });
      return 'Say on pay: only ' + p + '% for. The vote fails.';
    } };
  }

  /* The ending card. */
  function ending() { const x = X(); return x.stage === 'in' ? 'in' : x.dropped ? 'dropped' : x.told ? 'never' : 'none'; }
  function debug(o) { Object.assign(X(), o || {}); return X(); }

  return { X, tests, included, premium, writeDown, processQuarter, clockRows, agenda, sayOnPayItem, ending, debug, SIZE, INDEX };
})();
