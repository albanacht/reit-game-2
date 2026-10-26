/* ============================================================================
   board_tab.js — the Board screen (round 4, part 1).

   Five directors with a Football Manager-style satisfaction marker (colour,
   word, trend arrow) and the reason behind it; their red line; who they side
   with; what they remember. Below: the scorecard of exactly what they are
   judging, this year so far. Rule: no director judges you on a number you
   can't see.
   ========================================================================== */

window.BoardTab = (() => {

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const BASE = ['williams', 'petrova', 'chen', 'okafor', 'hassan', 'mansour', 'grace', 'tex', 'activist', 'voss'];

  function render() {
    const cards = document.getElementById('bd-cards');
    if (!cards || !window.Directors || !window.GameState || !GameState.board || !GameState.board.directors) return;
    const G = GameState, b = G.board;

    const top = document.getElementById('bd-top');
    if (top) {
      const q = G.meta.quarter, toGo = 5 - q;
      const meet = G.meta.year === 1 ? 'First meeting (practice, no vote) after Q4'
                 : 'Annual meeting and vote ' + (toGo === 1 ? 'after this quarter' : 'in ' + toGo + ' quarters');
      top.innerHTML =
        '<span>' + meet + '</span>' +
        '<span>Political capital <b>' + (b.politicalCapital || 0) + ' / ' + (b.maxCapital || 5) + '</b></span>' +
        (b.probation ? '<span class="bd-prob">On probation: lose the next vote and you are out</span>' : '<span class="bd-ok">Not on probation</span>') +
        (window.Story && Story.esgScore ? '<span title="60 or more: ESG funds buy your shares, share price bracket +5%">ESG score <b>' + Story.esgScore() + '</b>' +
          (Story.esgScore() >= Story.ESG_LINE ? ' \u00b7 in the ESG bracket (+5%)' : ' / 60 for the ESG bracket') + '</span>' : '') +
        (window.Pay ? (w => '<span title="Your own money, not the company\u2019s: salary, bonuses, vested shares, the dividends on them, and awards. Unvested shares are lost if the board fires you.">Your wealth <b>$' + w.total.toFixed(1) + 'M</b> ($' + w.cash.toFixed(1) + 'M cash + ' +
          w.shares.toLocaleString() + ' shares' + (w.divs ? ', $' + w.divs.toFixed(2) + 'M of dividends received so far' : '') + (w.unvested ? '; ' + w.unvested.toLocaleString() + ' unvested, $' + w.unvestedValue.toFixed(1) + 'M' : '') + ') \u00b7 ' + Pay.PKG[Pay.L().pkg].label.toLowerCase() + ' contract</span>')(Pay.wealth()) : '');
    }

    const ORDER = BASE.filter(id => (b.directors || []).some(d => d.id === id));
    cards.classList.toggle('six', ORDER.length > 5);
    cards.innerHTML = ORDER.map(id => {
      const c = Directors.card(id); if (!c) return '';
      const arrow = c.trend > 0.15 ? '<span class="up">▲</span>' : c.trend < -0.15 ? '<span class="down">▼</span>' : '<span class="flat">●</span>';
      return '<div class="bd-card">' +
        '<div class="bd-head"><img src="' + c.face + '" alt=""><div>' +
          '<div class="bd-name">' + esc(c.name) + '</div><div class="bd-role">' + esc(c.role) + '</div></div></div>' +
        '<div class="bd-mood ' + c.cls + '" title="Satisfaction ' + c.attitude.toFixed(1) + ' / 10">' + arrow + ' ' + c.label + '</div>' +
        '<div class="bd-rep" title="' + esc('Reputation ' + c.rep + ' / 100. Below ' + Directors.REP_LINE + ' at the annual meeting and the board pushes them out. ' + (c.repWhy || []).join('; ')) + '">' +
          '<span class="bd-rep-k">Reputation</span><span class="bd-rep-bar"><i style="width:' + c.rep + '%" class="' + (c.rep < Directors.REP_LINE ? 'low' : c.rep < 45 ? 'mid' : '') + '"></i><b style="left:' + Directors.REP_LINE + '%"></b></span></div>' +
        '<div class="bd-cause">' + esc(c.cause.replace(/^./, m => m.toUpperCase())) + '</div>' +
        '<div class="bd-meta' + (c.redNow ? ' crossed' : '') + '"><b>Red line:</b> ' + esc(c.red) + (c.redNow ? ' <b>(crossed)</b>' : '') + '</div>' +
        (c.ally ? '<div class="bd-meta"><b>Sides with</b> ' + c.ally + '</div>' : '') +
        (c.rival ? '<div class="bd-meta"><b>Pulls against</b> ' + c.rival + '</div>' : '') +
        (!c.ally && !c.rival ? '<div class="bd-meta"><b>Swing vote</b></div>' : '') +
        (c.stake ? '<div class="bd-meta"><b>Owns</b> ' + c.stake.n.toLocaleString() + ' shares, $' + c.stake.value.toFixed(1) + 'M <span class="' + (GameState.company.sharePrice >= c.stake.avg ? 'up' : 'down') + '">(' +
          ((GameState.company.sharePrice / c.stake.avg - 1) >= 0 ? '+' : '\u2212') + Math.abs((GameState.company.sharePrice / c.stake.avg - 1) * 100).toFixed(0) + '% on cost)</span></div>' : '') +
        (c.bond ? '<div class="bd-bond ' + (c.bond.pts > 0 ? 'pos' : 'neg') + '"><b>' + c.bond.label + ' toward you</b> ' + esc(c.bond.why) + '</div>' : '') +
        (c.memory.length ? '<div class="bd-mem"><b>Remembers</b>' + c.memory.slice(0, 2).map(m => '<div>' + esc(m) + '</div>').join('') + '</div>' : '') +
      '</div>';
    }).join('');

    // the league: you and the three rivals by total return (round 5)
    const lg = document.getElementById('bd-league');
    if (lg && window.Rivals && G.rivals) {
      const n = (G.meta.quarter - 1) || 4, rows = Rivals.league(n), pc = v => (v >= 0 ? '+' : '\u2212') + Math.abs(v * 100).toFixed(1) + '%';
      const lab = document.getElementById('bd-league-label'); if (lab) lab.textContent = 'total return, ' + (G.meta.quarter === 1 ? 'last year' : 'this year so far') + ' \u00b7 click a rival for their profile';
      lg.innerHTML = '<table class="bd-lg"><tr><th></th><th></th><th>Company</th><th>' + (G.meta.quarter === 1 ? 'Last year' : 'This year') + '</th><th>Since you started</th><th>Dividend yield</th><th>Debt / assets</th><th>Buildings</th><th>Rating</th></tr>' +
        rows.map(r => '<tr class="' + (r.key === 'you' ? 'me' : 'rv-row') + '" data-rival="' + (r.key === 'you' ? '' : r.key) + '">' +
          '<td class="rk">' + r.rank + '</td><td>' + (r.face ? '<img src="' + r.face + '" alt="">' : '') + '</td>' +
          '<td><b>' + esc(r.key === 'you' ? r.name + ' (you)' : r.name) + '</b>' + (r.ceo ? '<div class="sml-note">' + esc(r.ceo) + '</div>' : '') + '</td>' +
          '<td class="n ' + (r.ret >= 0 ? 'up' : 'down') + '">' + pc(r.ret) + '</td><td class="n">' + pc(r.since) + '</td>' +
          '<td class="n">' + (r.yld * 100).toFixed(1) + '%</td><td class="n">' + Math.round(r.lev * 100) + '%</td><td class="n">' + r.count + '</td><td class="n">' + esc(r.rating) + '</td></tr>').join('') + '</table>';
      lg.querySelectorAll('tr.rv-row').forEach(tr => tr.onclick = () => Rivals.openProfile(tr.dataset.rival));
    }

    // board changes and Grace's initiatives (round 8)
    let hp = document.getElementById('bd-history');
    if (!hp) {
      const view = document.getElementById('view-board');
      if (view) { const p = document.createElement('div'); p.className = 'panel'; p.innerHTML = '<div class="panel-header"><span class="panel-title">The board over time</span><span class="sml-note">who left, who joined, and why</span></div><div class="panel-body" id="bd-history"></div>'; view.appendChild(p); hp = p.querySelector('#bd-history'); }
    }
    if (hp) {
      const start = (b.startBoard || ['williams', 'petrova', 'chen', 'okafor', 'hassan']).map(id => Directors.name(id).replace(/^(Chairman|Director) /, '')).join(', ');
      const items = window.Story && Story.esgItems ? Story.esgItems() : [];
      hp.innerHTML = '<div class="bd-hist"><div><b>At the start:</b> ' + esc(start) + '</div>' +
        (b.history || []).map(h => '<div><span class="bd-hq">' + esc(h.label) + '</span> ' + esc(h.text) + '</div>').join('') +
        (!(b.history || []).length ? '<div class="sml-note">No changes yet.</div>' : '') + '</div>' +
        (items.length ? '<div class="bd-esg"><b>Sustainability initiatives</b> (ESG score ' + Story.esgScore() + ')' + items.map(i =>
          '<div class="bd-esg-r"><span>' + esc(i.name) + '</span><span>' + (i.rec != null ? '$' + i.rec.toFixed(2) + 'M a year' : 'one-off') + ' \u00b7 ESG +' + i.now + '</span>' +
          (i.rec != null ? '<button class="bd-esg-x" data-esg="' + i.id + '" title="Saves the cost. Grace\u2019s red line.">Cancel</button>' : '<span></span>') + '</div>').join('') + '</div>' : '');
      hp.querySelectorAll('.bd-esg-x').forEach(x => x.onclick = () => {
        const msg = Story.esgCancel(x.dataset.esg); if (msg && window.UI && UI.showToast) UI.showToast(msg, 'info');
        if (window.UI && UI.renderAll) UI.renderAll(); else render();
      });
    }

    const sc = document.getElementById('bd-scorecard');
    if (sc) {
      const rows = Directors.scorecard(), y = Directors.ytd();
      const lab = document.getElementById('bd-sc-label'); if (lab) lab.textContent = y ? y.label : 'this year so far';
      sc.innerHTML = '<table class="bd-sc">' + rows.map(r =>
        '<tr><td><img src="assets/faces/' + r.id + '.jpg" alt="" title="' + esc(Directors.card(r.id).name) + '"></td>' +
        '<td>' + esc(r.k) + '</td><td class="v">' + esc(r.v) + '</td><td class="w">' + esc(r.want) + '</td>' +
        '<td class="s">' + (r.ok == null ? '<span class="na">—</span>' : r.ok ? '<span class="ok">✓</span>' : '<span class="no">✗</span>') + '</td></tr>').join('') +
        '</table><div class="sml-note" style="margin-top:6px">Each director judges their own line. Your return is judged against the three rivals\u2019 average.</div>';
    }
  }

  return { render };
})();
