/* ============================================================================
   cfoaid.js — round 45: THE CFO IN A CRISIS. window.CfoAid

   Boss Alex: "the CFO should be useful during a crisis." Two things, both
   only with a CFO on the Staff screen, both only in a crisis or aftershock:

   1. RENT DEFERRAL (twice per storm). The shops or offices in one of our
      multi-tenant buildings are struggling. We lend them about two quarters
      of rent now (cash out, booked as a loan to tenants). In return that
      building stops losing tenants for the rest of the storm. When the
      storm ends the tenants pay it back: in full 80% of the time, otherwise
      half of it, and the other half is written off.

   2. THE GOVERNMENT RESCUE LOAN (once per game). Only when things are dim
      but not hopeless: debt 55–65% of assets, a bond due within a year, and
      the bank can't cover it (credit line frozen, or not enough left on it).
      About 5% of our assets ($15–40M), 3 years, at the base rate. With the
      government's strings (as in 2020): while it is outstanding, no dividend
      increases and no bonus for you. Repay it early at no premium
      (Finance > Debt, "Call") and the strings go.
   ========================================================================== */

window.CfoAid = (() => {

  const rnd = () => Math.random();
  const fmt = n => Math.round(n * 100) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const money = n => '$' + Math.abs(n).toFixed(1) + 'M';
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const yq = t => 'Y' + (Math.floor((t - 1) / 4) + 1) + ' Q' + ((t - 1) % 4 + 1);
  const DEFER_MAX = 2, DEFER_Q = 2, REPAY_ODDS = 0.8;

  function C() {
    const s = Story.S();
    if (!s.cfo) s.cfo = { defers: [], used: {}, lastQ: -9, gov: null, pick: null };
    return s.cfo;
  }
  const cfo = () => window.Staff && Staff.getStaff ? Staff.getStaff('cfo') : null;
  const from = () => { const c = cfo(); return c ? c.name + ', CFO' : 'Your CFO'; };
  const face = () => { const c = cfo(); return c && c.portrait ? 'assets/staff/' + c.portrait : 'assets/faces/jenkins.jpg'; };
  const storm = () => { const ph = window.Arc && Arc.phase ? Arc.phase() : null; return ph === 'crisis' || ph === 'aftershock' ? ph : null; };
  const free = () => { const s = Story.S(); return !s.due || (Story.lowDue && Story.lowDue()); };
  const remember = (id, d, why) => { if (window.Directors && Directors.has(id)) Directors.remember(id, d, why); };
  const say = (title, body) => { if (window.Inbox) Inbox.message(from().replace(/, CFO$/, ''), 'CFO', title, body, face()); };

  /* -- 1. rent deferral ----------------------------------------------------------- */
  const active = p => C().defers.some(d => d.pid === p.id && !d.done);
  /* properties.js crisisDrop(): a building with deferred rent holds its tenants */
  function holds(p) { return !!p && active(p); }
  function candidate() {
    const G = GameState;
    return (G.portfolio || []).filter(p => (p.sector === 'retail' || p.sector === 'office') && !p.underConstruction && p.annualNOI > 0 &&
        !(window.Tenants && Tenants.isLocked(p)) && !active(p) && !C().defers.some(d => d.pid === p.id))
      .sort((a, b) => a.occupancy - b.occupancy)[0] || null;
  }
  function owed() { return fmt(C().defers.filter(d => !d.done).reduce((a, d) => a + d.amt, 0)); }

  /* -- 2. the rescue loan ------------------------------------------------------------ */
  function dueWithinYear() {
    const G = GameState;
    return (G.debtTranches || []).filter(t => !t.gov && G.quartersUntilMaturity(t.maturityYear, t.maturityQuarter) <= 4);
  }
  function bankTight(due) {
    const R = window.Revolver && GameState.revolver ? GameState.revolver : null;
    if (!R) return true;
    return R.frozen || Revolver.spendable() < due;
  }
  function govSize() { return Math.round(clamp((GameState.balance.totalAssets || 300) * 0.05, 15, 40)); }
  function govRate() { return fmt(Math.max(0.5, (GameState.market && GameState.market.baseInterestRate) || 3)); }
  function eligibleGov() {
    const G = GameState, c = C(), d2a = G.ratios.debtToAssets || 0;
    if (c.gov || !storm() || !cfo() || d2a < 0.55 || d2a > 0.65 || (G.debtTranches || []).length >= 12) return false;
    const due = dueWithinYear().reduce((a, t) => a + t.amount, 0);
    return due > 0 && bankTight(due);
  }
  /* the strings: while the loan is outstanding */
  function strings() { return (GameState.debtTranches || []).some(t => t.gov); }

  /* -- every quarter (story.js) -------------------------------------------------------- */
  function processQuarter(out) {
    const G = GameState, c = C(), now = tq(), st = storm();
    // settle deferrals once their storm is over
    c.defers.filter(d => !d.done && st !== d.storm).forEach(d => {
      d.done = true;
      if (rnd() < REPAY_ODDS) {
        G.balance.cash = fmt(G.balance.cash + d.amt); d.result = 'paid';
        say('The tenants paid us back', 'The shops and offices at <b>' + d.name + '</b> have repaid the deferred rent: ' + money(d.amt) + ' back in our account. They are still there, and still paying.');
      } else {
        const back = fmt(d.amt / 2), lost = fmt(d.amt - back);
        G.balance.cash = fmt(G.balance.cash + back); d.result = 'half';
        G._pendingUnusual = fmt((G._pendingUnusual || 0) - lost); G.balance.cash = fmt(G.balance.cash + lost);   // a loss, not cash: the cash left when we lent
        G._pendingNonCash = fmt((G._pendingNonCash || 0) - lost);
        say('Some of the deferred rent is lost', 'A few tenants at <b>' + d.name + '</b> failed anyway. We got ' + money(back) + ' back; ' + money(lost) + ' is written off this coming quarter (a one-off, not cash).');
      }
    });
    if (G.meta.gameOver || !cfo() || !st) return;
    // the government loan comes first: it is the bigger problem
    if (eligibleGov() && free()) { c.gov = 'asked'; Story.S().due = 'cfo_gov'; return; }
    // a deferral: at most two per storm, two quarters apart, about half the quarters
    const used = c.used[st] || 0;
    if (used < DEFER_MAX && now - c.lastQ >= 2 && free() && rnd() < 0.55) {
      const p = candidate(); if (!p) return;
      c.pick = p.id; c.lastQ = now; Story.S().due = 'cfo_defer';
    }
  }

  /* -- the cards ------------------------------------------------------------------------ */
  const DEFER = { id: 'cfo_defer', system: true, story: true, holdQ: 0,
    build() {
      const G = GameState, c = C(), p = (G.portfolio || []).find(x => x.id === c.pick), st = storm();
      if (!p || !st || !cfo()) return null;
      const amt = fmt(p.annualNOI / 4 * DEFER_Q), kind = p.sector === 'retail' ? 'shops' : 'office tenants', occ = Math.round(p.occupancy * 100);
      const left = (c.used[st] || 0), spend = window.Revolver && G.revolver ? Revolver.spendable() : G.balance.cash;
      return { title: 'The ' + kind + ' at ' + p.name + ' need help', from: from(), face: face(),
        body: '"Boss, the ' + kind + ' at <b>' + p.name + '</b> are struggling. Occupancy is ' + occ + '% and falling. If we lend them about two quarters of rent now, most of them stay, and they pay us back when this is over. If we don’t, the floors keep emptying."' +
              '<table class="dv-nums"><tr><td>We lend them</td><td>' + money(amt) + ' now (cash out, a loan on our books)</td></tr>' +
              '<tr><td>In return</td><td>' + p.name + ' stops losing tenants until the ' + (st === 'crisis' ? 'crisis' : 'aftershock') + ' ends</td></tr>' +
              '<tr><td>Paid back</td><td>when it ends: in full about 8 times in 10, otherwise half</td></tr>' +
              '<tr><td>Left this storm</td><td>' + (DEFER_MAX - left) + ' of ' + DEFER_MAX + '</td></tr></table>',
        choices: [
          { label: 'Defer their rent: lend ' + money(amt), detail: 'Cash −' + money(amt) + ' now. The building holds its occupancy. Hassan +0.5.',
            check: () => spend >= amt, checkMsg: 'Not enough cash and credit line',
            apply() { G.balance.cash = fmt(G.balance.cash - amt); c.defers.push({ pid: p.id, name: p.name, amt, q: tq(), storm: st, done: false }); c.used[st] = left + 1; c.pick = null;
                      remember('hassan', 0.5, 'you stood by the tenants at ' + p.name);
                      return 'Done. The ' + kind + ' at ' + p.name + ' have until the storm passes. ' + money(amt) + ' is on our books as a loan to tenants.'; } },
          { label: 'No: they are on their own', detail: 'We keep the cash. The building keeps emptying with the market.',
            apply() { c.pick = null; c.used[st] = left + 1; return 'Understood. ' + from().replace(/, CFO$/, '') + ' will tell them.'; } },
        ] };
    } };

  const GOV = { id: 'cfo_gov', system: true, story: true, holdQ: 0,
    build() {
      const G = GameState, c = C(); if (c.gov !== 'asked' || !cfo()) return null;
      const amt = govSize(), rate = govRate(), due = fmt(dueWithinYear().reduce((a, t) => a + t.amount, 0)), mkt = window.Market ? Market.getCurrentBorrowingRate() : rate + 3;
      return { title: 'A government loan, if we want it', from: from(), face: face(),
        body: '"Boss, the bank won’t cover what falls due this year, and the bond market wants ' + mkt.toFixed(1) + '%. But the government has opened an emergency lending programme for property companies, and we qualify, just. It is not a lot of money. It is cheap money, and it comes with strings."' +
              '<table class="dv-nums"><tr><td>Loan</td><td>' + money(amt) + ', 3 years, at the base rate: ' + rate.toFixed(2) + '%</td></tr>' +
              '<tr><td>Falling due within a year</td><td>' + money(due) + '</td></tr>' +
              '<tr><td>The strings, until it is repaid</td><td>no dividend increases, and no bonus for you</td></tr>' +
              '<tr><td>Repay early</td><td>any time, no premium (Finance, Debt, Call), and the strings go</td></tr></table>' +
              '<div class="dv-nums">Once a game. Okafor likes cheap money; Williams does not like being told what he may pay.</div>',
        choices: [
          { label: 'Take the government loan: ' + money(amt) + ' at ' + rate.toFixed(2) + '%', detail: 'Cash +' + money(amt) + '. No dividend increases and no bonus while it is outstanding. Okafor +1, Williams −1.', primary: true,
            apply() { const my = G.meta.year + 3, q = G.meta.quarter;
                      G.debtTranches.push({ id: 'gov' + tq(), amount: amt, rate, maturityQuarter: q, maturityYear: my, quartersUntilMaturity: 12,
                        label: rate.toFixed(2) + '% Government loan due Y' + my + 'Q' + q, gov: true, rescue: true, issuedQ: G.meta.totalQuarters + 1 });
                      G.balance.cash = fmt(G.balance.cash + amt); c.gov = 'taken'; c.govQ = tq();
                      remember('okafor', 1, 'you took the cheap government money'); remember('williams', -1, 'the government’s strings on the dividend');
                      if (window.News && News.add) News.add(G.company.name + ' takes ' + money(amt) + ' from the government’s emergency lending programme.', 'debt');
                      return 'Signed. ' + money(amt) + ' is in the account. The dividend stays where it is and your bonus waits until we repay it.'; } },
          { label: 'No: no strings', detail: 'We find the money elsewhere, or sell buildings.',
            apply() { c.gov = 'declined'; return 'Declined. The programme closes to us.'; } },
        ] };
    } };
  [DEFER, GOV].forEach(d => { if (window.World && World.DECISIONS && !World.DECISIONS.some(x => x.id === d.id)) World.DECISIONS.push(d); });

  /* "On the clock" (inbox.js) */
  function clockRows() {
    const rows = [];
    if (strings()) { const t = GameState.debtTranches.find(x => x.gov); rows.push({ tone: 'warn', k: 'Government loan: no dividend rises, no bonus', v: 'due ' + yq((t.maturityYear - 1) * 4 + t.maturityQuarter) }); }
    if (owed() > 0) rows.push({ tone: '', k: 'Deferred rent owed by tenants: ' + money(owed()), v: 'when the storm ends' });
    return rows;
  }
  function debug(o) { Object.assign(C(), o || {}); return C(); }

  return { C, holds, owed, strings, processQuarter, clockRows, eligibleGov, govSize, govRate, candidate, debug };
})();
