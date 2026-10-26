/* ============================================================================
   deal.js — the quick report shown before you buy or sell (design doc B.12f).

   One screen for both audiences: arrows and plain words for newcomers, the
   real numbers for finance players. Every figure comes from the same engine
   functions the purchase itself uses, so the preview can't lie.
   ========================================================================== */

window.Deal = (() => {

  const f1 = n => Math.round(n * 10) / 10;
  const m  = n => (n < 0 ? '−' : '') + '$' + Math.abs(n).toFixed(1) + 'M';
  const ps = n => (n < 0 ? '−' : '+') + '$' + Math.abs(n).toFixed(3);
  const pc = n => (n * 100).toFixed(1) + '%';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // G&A and capex reserve the engine charges per $M of property (financials.js)
  const GA_PER_Q = 0.0015, CAPEX_PER_Q = 0.005 / 4;

  function row(label, value, tone, note) {
    const arrow = tone === 'up' ? '▲ ' : tone === 'down' ? '▼ ' : '';
    return '<tr class="dp-' + (tone || 'flat') + '"><td>' + label + (note ? '<div class="dp-note">' + note + '</div>' : '') +
           '</td><td>' + arrow + value + '</td></tr>';
  }

  /* Who pays the rent, and what could go wrong with them. */
  function risks(p, buying) {
    const out = [], l = p.lease;
    const T = GameState.tenants || {};
    if (l && l.type === 'single') out.push(['bad', 'One tenant pays all the rent. If it leaves, income goes to zero.']);
    if (l) l.positions.forEach(pos => {
      const t = T[pos.t];
      if (!t || pos.vacant) return;
      if (pos.share >= 0.2 && pos.q <= 8) out.push(['warn', esc(t.name) + '’s lease (' + Math.round(pos.share * 100) + '% of this rent) ends in ' + (pos.q / 4).toFixed(1) + ' years.']);
      if (t.coverage != null && t.coverage < 1.3 && pos.share >= 0.1) out.push(['bad', esc(t.name) + ' is weak: its profit covers the rent only ' + t.coverage.toFixed(1) + 'x.']);
      if (buying && window.Tenants) {
        const mine = GameState.portfolio.reduce((a, b) => a + b.annualNOI, 0);
        const theirs = GameState.portfolio.reduce((a, b) => a + (b.lease ? b.lease.positions.filter(x => x.t === pos.t && !x.vacant).reduce((s, x) => s + b.annualNOI * x.share, 0) : 0), 0);
        const after = (theirs + p.annualNOI * pos.share) / (mine + p.annualNOI);
        if (after > 0.15) out.push(['warn', esc(t.name) + ' would pay ' + Math.round(after * 100) + '% of all your rent. One tenant, a lot of eggs.']);
      }
    });
    if (p.location === 'suburban') out.push(['warn', 'Suburban: bad events hit these harder (about 1.35x).']);
    if (p.location === 'tier1') out.push(['good', 'Prime location: bad events hit it softer (about 0.55x).']);
    if (p.occupancy < 0.85 && !(l && l.type === 'single')) out.push(['warn', 'Only ' + Math.round(p.occupancy * 100) + '% let. Room to fill, or a reason it is empty.']);
    return out;
  }

  function preview(p, mode) {
    const G = GameState, sh = G.company.sharesOutstanding || 1;
    const cash = G.balance.cash, debt = G.balance.totalDebt, assets = G.balance.totalAssets || 1;
    const buying = mode === 'buy';
    const price = buying ? (p.askingPrice || p.currentValue) : p.currentValue;
    const fee = Properties.transactionFee ? Properties.transactionFee(price) : f1(price * 0.01);
    /* Rent actually collected, as the P&L counts it: empty space still costs
       its share of running costs. Round 3: the preview used full rent, which
       overstated yields by about a point. */
    const noiY = p.underConstruction ? 0 : p.annualNOI * (p.occupancy - 0.30) / 0.70;
    const yieldOn = noiY / price;
    const rate = Financials.getCurrentBorrowingRateForTerm ? Financials.getCurrentBorrowingRateForTerm(5) / 100 : 0.05;
    // cash profit per quarter this building adds (or removes): rent, less the overhead and upkeep the engine charges for it
    const addQ = noiY / 4 - price * GA_PER_Q - price * CAPEX_PER_Q;
    const affoPS = (G.history.length ? G.history[G.history.length - 1].affoPerShare : 0) || 0;

    let html = '<div class="dp">';
    if (buying) {
      const cashAfter = cash - price - fee;
      const d2aAfter = debt / Math.max(1, assets - fee);
      const spread = yieldOn - rate;
      html += '<div class="dp-lead">You pay <b>' + m(price + fee) + '</b> (' + m(price) + ' + ' + m(fee) + ' fees) for <b>' + m(noiY) + ' a year</b> of rent after running costs.</div>';
      html += '<table>' +
        row('Cash', m(cash) + ' → ' + m(cashAfter), 'down',
            (typeof Revolver !== 'undefined' && GameState.revolver && price + fee > Revolver.spendable() + 0.01)
              ? 'More than your cash and credit line together. You can’t afford this.'
              : cashAfter < 0 ? m(-cashAfter) + ' drawn on your credit line' : cashAfter < 5 ? 'Tight. Almost nothing left for surprises.' : '') +
        row('Rent you collect', '+' + m(noiY) + ' / yr', 'up') +
        row('Cash profit per share', ps(addQ / sh) + ' / qtr' + (affoPS > 0 ? ' (' + (addQ / sh / affoPS * 100 >= 0 ? '+' : '') + (addQ / sh / affoPS * 100).toFixed(0) + '%)' : ''),
            addQ >= 0 ? 'up' : 'down', 'AFFO: rent minus overhead and upkeep this building adds') +
        row('Yield on price', pc(yieldOn), '', 'What the building earns on what you pay (cap rate)') +
        row('If you borrowed for it', pc(rate) + ' interest', '', 'Your 5-year borrowing rate today') +
        row('Spread', (spread >= 0 ? '+' : '') + pc(spread), spread >= 0 ? 'up' : 'down',
            spread >= 0 ? 'Earns more than borrowing costs: debt-funded, it pays for itself' : 'Earns LESS than borrowing costs: debt-funded, it loses money') +
        row('Debt / assets', pc(debt / assets) + ' → ' + pc(d2aAfter), d2aAfter > 0.5 ? 'down' : '') +
        '</table>';
    } else {
      const cyc = G.market.cycle, mod = cyc === 'expanding' ? 1.02 : cyc === 'contracting' ? 0.97 : cyc === 'recession' ? 0.93 : 1.0;
      const sale = f1(p.currentValue * mod * 0.995), net = f1(sale - (Properties.transactionFee ? Properties.transactionFee(sale) : sale * 0.01));
      const gain = p.purchasePrice ? net - p.purchasePrice : null;
      const d2aAfter = debt / Math.max(1, assets - p.currentValue + net);
      html += '<div class="dp-lead">You get about <b>' + m(net) + '</b> after fees' + (cyc === 'recession' || cyc === 'contracting' ? ' (a weak market: buyers pay less)' : '') +
              ', and give up <b>' + m(noiY) + ' a year</b> of rent. A rival will probably buy it.</div>';
      html += '<table>' +
        row('Cash', m(cash) + ' → ' + m(cash + net), 'up') +
        (gain != null ? row('Gain vs what you paid', (gain >= 0 ? '+' : '') + m(gain), gain >= 0 ? 'up' : 'down') : '') +
        row('Rent you lose', '−' + m(noiY) + ' / yr', 'down') +
        row('Cash profit per share', ps(-addQ / sh) + ' / qtr', 'down', 'Unless you put the cash to work') +
        row('Debt / assets', pc(debt / assets) + ' → ' + pc(d2aAfter), d2aAfter < debt / assets ? 'up' : '') +
        '</table>';
    }
    const r = risks(p, buying);
    if (r.length) html += '<div class="dp-h">' + (buying ? 'Know before you buy' : 'What you are letting go') + '</div>' +
      r.map(x => '<div class="dp-risk dp-r-' + x[0] + '">' + x[1] + '</div>').join('');
    return html + '</div>';
  }

  return { preview };
})();
