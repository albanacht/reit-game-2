/* ============================================================================
   pay.js — YOUR OWN MONEY (round 12).

   The second half of the score (design doc: personal wealth AND the
   company's total return, side by side). Everything that pays YOU goes
   through this ledger, so every story can reward you without being rewritten.

     Salary     paid every quarter (part of the company's G&A)
     Bonus      decided by the pay committee at each annual meeting: a target
                times how much of the scorecard you hit, plus any special
                recognition the stories have earned you. You can waive it.
     Shares     a grant every year (long-term incentive), vesting a third a
                year. Fired, and the unvested shares are gone.
     Contract   at the first meeting and every third one after (Years 1, 4,
                7, 10, 13) you choose the mix: mostly salary, balanced, or
                mostly shares. Taking the salary IS the safe extraction; the
                game never says so.
     Rewards    Pay.reward(reason, cash, shares) from any story; paid at the
                next meeting if the board is content enough to approve it.
   Tex's special awards (story.js) land in the same ledger.
   ========================================================================== */

window.Pay = (() => {

  const fmt = n => Math.round(n * 100) / 100;
  const money = n => '$' + Math.abs(n).toFixed(2).replace(/0$/, '') + 'M';
  const PKG = {
    salary:   { label: 'Mostly salary', salary: 0.70, bonus: 0.25, ltip: 0.30, mood: { petrova: -1, chen: -0.5 },
                why: 'Safe money, whatever happens to the share price. The board reads it as "here for the paycheck".' },
    balanced: { label: 'Balanced', salary: 0.35, bonus: 0.35, ltip: 0.80, mood: {},
                why: 'The market standard: a third cash, two thirds shares.' },
    stock:    { label: 'Mostly shares', salary: 0.25, bonus: 0.25, ltip: 1.20, mood: { petrova: 1, chen: 0.5 },
                why: 'Most of your pay is shares that vest over 3 years. If the price rises you do best. Fired, and the unvested ones are gone.' },
  };

  function L() {
    const G = GameState;
    if (!G.ceo) G.ceo = { cash: 0, shares: 0, awards: [] };
    const c = G.ceo;
    if (!c.pkg) Object.assign(c, { pkg: 'balanced', grants: [], pending: [], log: [], forfeited: 0, contractYear: 0 });
    return c;
  }
  /* round 14: after a lost say-on-pay vote the board may cut bonus target and grants (listing.js) */
  const pkg = () => { const P = PKG[L().pkg] || PKG.balanced, k = L().cut || 1; return k === 1 ? P : Object.assign({}, P, { bonus: P.bonus * k, ltip: P.ltip * k }); };
  const price = () => GameState.company.sharePrice || 1;

  /* every quarter, inside the quarter (story.js processQuarter) */
  /* every quarter: your salary, and (round 21) the dividend on the shares you own outright */
  function quarter() {
    if (GameState.meta.gameOver) return;
    const c = L(); c.cash = fmt(c.cash + pkg().salary / 4);
    const d = fmt((c.shares || 0) * (GameState.company.dividendPerShare || 0) / 1e6);
    if (d > 0) { c.cash = fmt(c.cash + d); c.divs = fmt((c.divs || 0) + d); }
  }
  /* the company's side of the salary (financials.js calcGA) */
  const salaryQ = () => pkg().salary / 4;

  function unvested() { return L().grants.reduce((a, g) => a + g.n - g.vested, 0); }
  function wealth() {
    const c = L(), px = price(), u = unvested();
    return { cash: fmt(c.cash), shares: c.shares, sharesValue: fmt(c.shares * px / 1e6), unvested: u, unvestedValue: fmt(u * px / 1e6),
             total: fmt(c.cash + c.shares * px / 1e6), forfeited: c.forfeited, divs: fmt(c.divs || 0) };
  }

  /* the pay committee's bonus: target × scorecard hit rate (80% of lines = full target, up to 1.5x) */
  function bonusFor() {
    const rows = window.Directors ? Directors.scorecard().filter(r => r.ok != null) : [];
    const hit = rows.length ? rows.filter(r => r.ok).length / rows.length : 0.5;
    const y = window.Directors && Directors.ytd ? Directors.ytd() : null;
    let mult = Math.min(1.5, hit / 0.8) + (y && y.you > y.sector ? 0.25 : 0);
    if (GameState.board.probation) mult *= 0.5;
    return { amount: fmt(pkg().bonus * Math.min(1.5, mult)), hit: Math.round(hit * 100), beat: !!(y && y.you > y.sector), probation: !!GameState.board.probation };
  }

  function reward(reason, cash, shares) { L().pending.push({ reason, cash: cash || 0, shares: shares || 0, q: GameState.meta.totalQuarters }); }

  /* Vest a third of each grant per year after it was made. */
  function vest(year) {
    const c = L(); let n = 0;
    c.grants.forEach(g => {
      const due = Math.min(3, year - g.y) - g.tr;
      for (let k = 0; k < due; k++) { const t = Math.round(g.n / 3); g.vested += t; g.tr += 1; n += t; }
    });
    c.grants = c.grants.filter(g => g.tr < 3);
    if (n > 0) { c.shares += n; GameState.company.sharesOutstanding = fmt(GameState.company.sharesOutstanding + n / 1e6); GameState.company.compShares = fmt((GameState.company.compShares || 0) + n / 1e6); }
    return n;
  }
  function onFired() {
    const c = L(), u = unvested();
    if (u > 0) { c.forfeited = fmt(c.forfeited + u * price() / 1e6); c.grants = []; }
    return u;
  }

  /* The pay committee at the annual meeting: items for meeting.js.
     Each item: { lines: [[who, text]], effect: () => text } or { lines, choices: [{label, detail, go}] } */
  function meeting(year) {
    const c = L(), items = [], b = GameState.board;
    if (c.lastMeeting === year) return items;
    c.lastMeeting = year;
    const chair = window.Directors && Directors.has('petrova') ? 'petrova' : 'williams';
    // 1. shares vesting
    const vestN = (() => { const g = c.grants.reduce((a, x) => a + Math.max(0, Math.min(3, year - x.y) - x.tr) * Math.round(x.n / 3), 0); return g; })();
    if (vestN > 0) items.push({ lines: [], effect: () => { const n = vest(year); return 'Vested: ' + n.toLocaleString() + ' shares (' + money(n * price() / 1e6) + ') are now yours.'; } });
    // 2. the bonus (and any special recognition)
    const B = bonusFor(), pend = c.pending.slice(), extra = pend.reduce((a, p) => a + p.cash, 0);
    const avg = (b.directors || []).reduce((a, d) => a + d.attitude, 0) / Math.max(1, (b.directors || []).length);
    const approveExtra = extra > 0 && avg >= 4.5;
    const total = fmt(B.amount + (approveExtra ? extra : 0));
    const why = 'Target ' + money(pkg().bonus) + ' × ' + B.hit + '% of the scorecard' + (B.beat ? ', +25% for beating the rivals' : '') + (B.probation ? ', halved: you are on probation' : '') +
                (pend.length ? '. Special recognition: ' + pend.map(p => p.reason + ' (' + money(p.cash) + ')').join('; ') + (approveExtra ? '' : ' (not approved: the board is not content enough)') : '');
    c.pending = [];
    items.push({ lines: [[chair, 'The pay committee. ' + (total > 0 ? 'Your bonus for the year is ' + money(total) + '.' : 'There is no bonus this year.')]],
      note: why,
      choices: total > 0 ? [
        { label: 'Take the bonus: ' + money(total), detail: 'Into your own account. The company books it as a one-off cost.', primary: true,
          go: () => { c.cash = fmt(c.cash + total); GameState._pendingUnusual = fmt((GameState._pendingUnusual || 0) - total); c.log.push({ y: year, bonus: total, extra: approveExtra ? extra : 0 }); return 'Paid: ' + money(total) + '.'; } },
        { label: 'Waive it', detail: 'You give it back to the shareholders. Petrova +1, Williams +0.5.',
          go: () => { if (window.Directors) { Directors.remember('petrova', 1, 'you waived your bonus'); Directors.remember('williams', 0.5, 'you waived your bonus'); } c.log.push({ y: year, bonus: 0, waived: total }); return 'Waived. Petrova will mention it to the shareholders.'; } },
      ] : null });
    // round 14: in the index, the shareholders vote on your pay (listing.js)
    if (window.IndexFund && IndexFund.sayOnPayItem) { const sop = IndexFund.sayOnPayItem(year, items); if (sop) items.push(sop); }
    // 3. the contract: Years 1, 4, 7, 10, 13
    if (year % 3 === 1) {
      const px = price();
      items.push({ lines: [[chair, year === 1 ? 'And your contract. How do you want to be paid?' : 'Your contract is up for renewal. Same terms, or a different mix?']],
        choices: Object.keys(PKG).map(k => { const P = PKG[k];
          return { label: P.label + (c.pkg === k && c.contractYear ? ' (current)' : ''), primary: k === c.pkg,
            detail: 'Salary ' + money(P.salary) + ' a year, bonus target ' + money(P.bonus) + ', shares worth ' + money(P.ltip) + ' granted each year (vesting over 3 years; about ' + Math.round(P.ltip / px * 1e6).toLocaleString() + ' at today’s price). ' + P.why + (c.cut ? ' Bonus and shares are ' + Math.round(c.cut * 100) + '% of these since the pay vote.' : '') +
                    (Object.keys(P.mood).length ? ' ' + Object.keys(P.mood).map(id => (window.Directors ? Directors.name(id).replace(/^(Chairman|Director) /, '') : id) + ' ' + (P.mood[id] > 0 ? '+' : '−') + Math.abs(P.mood[id])).join(', ') + '.' : ''),
            go: () => { const changed = c.pkg !== k; c.pkg = k; c.contractYear = year;
              if (changed || year === 1) Object.keys(P.mood).forEach(id => window.Directors && Directors.remember(id, P.mood[id], 'your pay package: ' + P.label.toLowerCase()));
              return 'Contract: ' + P.label.toLowerCase() + ', for three years.'; } }; }) });
    }
    // 4. this year's share grant
    items.push({ lines: [], effect: () => { const n = Math.round(pkg().ltip / price() * 1e6); c.grants.push({ y: year, n, vested: 0, tr: 0 }); return 'Granted: ' + n.toLocaleString() + ' shares (' + money(pkg().ltip) + '), vesting a third a year. They join the share count as they vest.'; } });
    // round 24: the directors are paid as well (fees in overheads, plus shares once a year)
    if (year >= 1 && window.Directors && Directors.boardGrant) items.push({ lines: [], effect: () => { const g = Directors.boardGrant(); return g ? 'Directors\u2019 pay: each of the ' + g.count + ' directors receives ' + g.n.toLocaleString() + ' new shares (' + money(Directors.BOARD_SHARES) + ' each; their cash fees are in your overheads). Shares outstanding: ' + GameState.company.sharesOutstanding.toFixed(2) + 'M.' : ''; } });
    return items;
  }

  return { L, PKG, quarter, salaryQ, wealth, bonusFor, reward, vest, onFired, meeting, unvested };
})();
