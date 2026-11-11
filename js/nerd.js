/* ============================================================================
   nerd.js — round 43: STATS FOR NERDS. window.Nerd

   Folded away at the bottom of Finance; normal players never need it.
     1. Yield vs WACC: what our buildings earn (NOI ÷ value) against what our
        money costs, debt and equity weighted by market value. Cost of equity
        is the cash-profit (AFFO) yield on the share price, the analysts' way;
        Jenkins's beginner version uses the dividend yield.
     2. Deal history: every building bought and sold, best and worst deal.
     3. Lifetime totals, also shown as career stats on the game-over screen.
   ========================================================================== */

window.Nerd = (() => {

  const fmt = n => Math.round(n * 100) / 100;
  const money = n => (n < 0 ? '−' : '') + '$' + Math.abs(n).toFixed(1) + 'M';
  const pc = (n, d) => (n == null || !isFinite(n)) ? '—' : (n * 100).toFixed(d == null ? 1 : d) + '%';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const yq = q => 'Y' + (Math.floor((q - 1) / 4) + 1) + ' Q' + ((q - 1) % 4 + 1);
  const N = () => GameState._nerd || (GameState._nerd = { deals: {}, pts: [], peak: 0, probation: 0 });

  /* -- each quarter (financials.js, after the history entry) ---------------------- */
  function record() {
    const G = GameState, n = N(), now = tq();
    // the deals: anything new in the portfolio is a buy (the starting four are "start")
    const first = !n.init; n.init = true;
    (G.portfolio || []).forEach(p => {
      const d = n.deals[p.id], pr = p.purchasePrice || p.currentValue;
      if (!d || d.sold) n.deals[p.id] = { id: p.id, name: p.name, q: first ? 1 : now, start: first, price: pr, y0: pr > 0 ? p.annualNOI / pr : null };
      const e = n.deals[p.id]; e.value = p.currentValue; e.name = p.name;
    });
    n.peak = Math.max(n.peak || 0, (G.portfolio || []).length);
    // yield vs WACC
    const ps = (G.portfolio || []).filter(p => !p.underConstruction && p.currentValue > 0), val = ps.reduce((a, p) => a + p.currentValue, 0);
    const py = val > 0 ? (G.pnl.noi || 0) * 4 / val : null;
    const tr = G.debtTranches || [], D = tr.reduce((a, t) => a + t.amount, 0) + Math.max(0, -G.balance.cash);
    const kd = D > 0 ? (tr.reduce((a, t) => a + t.amount * t.rate / 100, 0) + Math.max(0, -G.balance.cash) * ((window.Revolver && Revolver.rate ? Revolver.rate() : 7) / 100)) / D : null;
    const h = G.history || [], last4 = h.slice(-4), aps = last4.reduce((a, e) => a + (e.coreAffoPerShare != null ? e.coreAffoPerShare : (e.affoPerShare || 0)), 0) * (4 / Math.max(1, last4.length));
    const px = G.company.sharePrice || 0, E = px * (G.company.sharesOutstanding || 0);
    const ke = px > 0 ? Math.max(0, aps / px) : null;
    const w = (D + E) > 0 && kd != null && ke != null ? (D * kd + E * ke) / (D + E) : (ke != null ? ke : kd);
    n.pts.push({ q: now, py, kd, ke, w, dw: (D + E) > 0 ? D / (D + E) : 0 });
    while (n.pts.length > 64) n.pts.shift();
  }
  /* properties.js sellProperty */
  function sold(p, price) {
    const n = N(), d = n.deals[p.id] || { id: p.id, name: p.name, q: 1, start: true, price: p.purchasePrice || p.currentValue };
    d.sold = tq(); d.salePrice = price; d.name = p.name; n.deals[p.id] = d;
  }
  function noteProbation() { N().probation = (N().probation || 0) + 1; }

  /* -- the deals, with their result ----------------------------------------------- */
  function dealRows() {
    const now = tq();
    return Object.values(N().deals).map(d => {
      const end = d.sold ? d.salePrice : d.value, yrs = Math.max(0.25, ((d.sold || now) - d.q) / 4);
      const g = d.price > 0 && end != null ? end / d.price - 1 : null;
      return Object.assign({}, d, { end, yrs, gain: g, cagr: g != null ? Math.pow(1 + g, 1 / yrs) - 1 : null, money: end != null && d.price ? end - d.price : null });
    }).sort((a, b) => a.q - b.q);
  }
  function bestWorst() {
    const r = dealRows().filter(d => d.money != null && !d.start);
    if (!r.length) return { best: null, worst: null };
    const s = r.slice().sort((a, b) => b.money - a.money);
    return { best: s[0], worst: s.length > 1 ? s[s.length - 1] : null };
  }
  function totals() {
    const G = GameState, h = G.history || [], P = window.Pay ? Pay.L() : { log: [] };
    return { divs: h.reduce((a, e) => a + (e.dividendsPaid || 0), 0), bonus: (P.log || []).reduce((a, e) => a + (e.bonus || 0) + (e.extra || 0), 0),
             peak: N().peak || (G.portfolio || []).length, bought: dealRows().filter(d => !d.start).length, sold: dealRows().filter(d => d.sold).length, probation: N().probation || 0 };
  }

  /* -- the chart: two lines, the gap shaded ---------------------------------------- */
  function chart() {
    const P = N().pts.filter(p => p.py != null && p.w != null);
    if (P.length < 2) return '<div class="nd-empty">The chart starts after two quarters.</div>';
    const W = 640, H = 170, all = P.map(p => p.py).concat(P.map(p => p.w)), hi = Math.max.apply(null, all) * 1.12, lo = Math.max(0, Math.min.apply(null, all) * 0.85);
    const x = i => 34 + i * (W - 44) / (P.length - 1), y = v => H - 18 - (v - lo) / Math.max(1e-4, hi - lo) * (H - 30);
    const line = k => P.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[k]).toFixed(1)).join(' ');
    const area = 'M' + P.map((p, i) => x(i).toFixed(1) + ' ' + y(p.py).toFixed(1)).join(' L') + ' L' + P.slice().reverse().map((p, k) => x(P.length - 1 - k).toFixed(1) + ' ' + y(p.w).toFixed(1)).join(' L') + ' Z';
    const ticks = [lo, (lo + hi) / 2, hi].map(v => '<text x="2" y="' + (y(v) + 3).toFixed(1) + '" font-size="9.5" fill="#7a8796">' + (v * 100).toFixed(1) + '%</text>').join('');
    const l = P[P.length - 1];
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '">' + ticks +
      '<path d="' + area + '" fill="' + (l.py >= l.w ? 'rgba(24,121,78,.12)' : 'rgba(194,65,12,.12)') + '"/>' +
      '<path d="' + line('w') + '" fill="none" stroke="#c2410c" stroke-width="2" stroke-dasharray="5 3"/>' +
      '<path d="' + line('py') + '" fill="none" stroke="#18794e" stroke-width="2.4"/>' +
      '<text x="34" y="' + (H - 3) + '" font-size="9.5" fill="#7a8796">' + yq(P[0].q) + '</text><text x="' + (W - 8) + '" y="' + (H - 3) + '" font-size="9.5" fill="#7a8796" text-anchor="end">' + yq(l.q) + '</text></svg>' +
      '<div class="nd-legend"><span style="color:#18794e">━</span> Portfolio yield ' + pc(l.py) + ' &nbsp; <span style="color:#c2410c">╍</span> WACC ' + pc(l.w) +
      ' (debt ' + pc(l.kd) + ' × ' + pc(l.dw, 0) + ', equity ' + pc(l.ke) + ' × ' + pc(1 - l.dw, 0) + ') &nbsp; <b>Spread ' + (l.py >= l.w ? '+' : '−') + (Math.abs(l.py - l.w) * 100).toFixed(1) + ' pts</b></div>';
  }

  function html() {
    const rows = dealRows(), bw = bestWorst(), t = totals();
    const deal = d => '<tr' + (bw.best && d.id === bw.best.id ? ' class="nd-best"' : bw.worst && d.id === bw.worst.id ? ' class="nd-worst"' : '') + '><td>' + esc(d.name) + '</td><td>' + (d.start ? 'start' : yq(d.q)) + '</td><td>' + money(d.price || 0) + '</td><td>' + pc(d.y0) + '</td>' +
      '<td>' + (d.sold ? 'sold ' + yq(d.sold) + ', ' + money(d.salePrice) : 'held, worth ' + money(d.value || 0)) + '</td><td>' + d.yrs.toFixed(1) + '</td>' +
      '<td class="' + ((d.money || 0) >= 0 ? 'up' : 'down') + '">' + (d.money == null ? '—' : (d.money >= 0 ? '+' : '') + money(d.money) + ' (' + pc(d.cagr) + '/yr)') + '</td></tr>';
    return '<div class="nd-sec"><b>Yield vs WACC</b><span>What our buildings earn against what our money costs, debt and equity together. Cost of equity here is the cash-profit yield on the share price (analysts’ shortcut); above the line, growth creates value; below it, every new building destroys some.</span></div>' + chart() +
      '<div class="nd-sec"><b>Deal history</b><span>Value change only; the rent collected comes on top.' + (bw.best ? ' Best: ' + esc(bw.best.name) + ' (' + money(bw.best.money) + ').' : '') + (bw.worst ? ' Worst: ' + esc(bw.worst.name) + ' (' + money(bw.worst.money) + ').' : '') + '</span></div>' +
      (rows.length ? '<table class="nd-t"><tr><th>Building</th><th>Bought</th><th>Price</th><th>Yield then</th><th>Now</th><th>Years</th><th>Gain</th></tr>' + rows.map(deal).join('') + '</table>' : '<div class="nd-empty">No deals yet.</div>') +
      '<div class="nd-sec"><b>Lifetime</b></div><div class="nd-tot">' +
      [['Dividends paid', money(t.divs)], ['Your bonuses', money(t.bonus)], ['Most buildings at once', t.peak], ['Bought / sold', t.bought + ' / ' + t.sold], ['Years on probation', t.probation]].map(r => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('') + '</div>';
  }
  function render() { const b = document.getElementById('nerd-body'); if (b && b.closest('details') && b.closest('details').open) b.innerHTML = html(); }

  /* the game-over screen: career stats under the leaderboard */
  function careerHTML() {
    const t = totals(), bw = bestWorst();
    return '<div class="nd-career"><div class="nd-sec"><b>Career stats</b></div><div class="nd-tot">' +
      [['Dividends paid', money(t.divs)], ['Bonuses taken', money(t.bonus)], ['Most buildings', t.peak], ['Bought / sold', t.bought + ' / ' + t.sold],
       ['Best deal', bw.best ? esc(bw.best.name) + ' ' + (bw.best.money >= 0 ? '+' : '') + money(bw.best.money) : '—'], ['Worst deal', bw.worst ? esc(bw.worst.name) + ' ' + (bw.worst.money >= 0 ? '+' : '') + money(bw.worst.money) : '—'],
       ['Years on probation', t.probation]].map(r => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('') + '</div></div>';
  }

  return { record, sold, noteProbation, dealRows, bestWorst, totals, html, render, careerHTML, N };
})();
