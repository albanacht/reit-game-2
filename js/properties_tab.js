/* ============================================================================
   properties.js — the Properties tab.

   The map answers "where". This answers "which": sorting, comparing, spotting
   the weak assets, shopping the market. Three sections in one scroll:
     1. Your portfolio   2. On the market   3. Rest of the city
   ========================================================================== */

window.PROPS = (() => {

  const R = window.REIT;
  const OWN = () => R.OWNERS;

  let grp = 'none', filter = null, sortK = 'v', sortDir = -1;
  const open = new Set();

  /* -- the three buckets --------------------------------------------------- */
  const mine   = () => R.city().mine;
  const market = () => R.city().market.filter(p => p.listed);
  const rest   = () => { const c = R.city();
                         return c.market.filter(p => !p.listed).concat(c.rivals); };
  const lots   = () => R.city().lots;

  /* -- small pieces -------------------------------------------------------- */
  function occBar(o) {
    const c = o >= 92 ? '#18794e' : o >= 84 ? '#b8860b' : '#c2410c';
    return o + '%<span class="bar"><i style="width:' + o + '%;background:' + c + '"></i></span>';
  }
  function nameCell(o, sub) {
    return '<div class="nm">' + R.photoImg(o.ph) +
           '<div><div class="t1">' + R.esc(o.n) + '</div>' +
           '<div class="t2">' + sub + '</div></div></div>';
  }
  const typeSub = p => R.TN[p.t] + ' &middot; ' + R.TI[p.ti] + (p.count ? ' &middot; ' + p.count : '') +
    (p.jv ? ' &middot; <b>JV ' + p.jv.mine + '% yours</b>' : '');

  function statusBadge(p) {
    if (R.listedByMe(p))         return '<span class="badge b-listed">Listed ' + R.money(p.ask) + '</span>';
    if (p.status === 'renovating') return '<span class="badge b-reno">Renovating</span>';
    if (p.status === 'leaseup')    return '<span class="badge b-lease">Leasing up</span>';
    if (p.status === 'land')       return '<span class="badge b-lot">Land</span>';
    if (p.status === 'building')   return '<span class="badge b-reno">Building</span>';
    return '<span class="badge b-active">Active</span>';
  }

  /* -- KPI chips ----------------------------------------------------------- */
  function kpis() {
    const m = mine();
    const s = R.summarise(m);
    const basis = m.reduce((a, p) => a + (p.basis || 0), 0);
    const wyoc  = basis ? (s.noi / basis * 100) : 0;
    const low    = m.filter(p => p.occ < 85).length;
    const listed = m.filter(R.listedByMe).length;

    const box = (k, v, cls, f) =>
      '<div class="kpi ' + (cls || '') + (filter === f ? ' on' : '') + '"' +
      (f ? ' data-f="' + f + '"' : '') + '>' +
      '<div class="k">' + k + '</div><div class="v">' + v + '</div></div>';

    document.getElementById('kpis').innerHTML =
      box('Portfolio value', R.money(s.value)) +
      box('Annual NOI',      R.money(s.noi)) +
      box('Avg cap rate',    s.cap + '%') +
      box('Weighted YoC',    wyoc.toFixed(1) + '%') +
      box('Avg occupancy',   s.occ + '%') +
      box('Low occupancy',   low,    'click warn', 'low') +
      box('Listed for sale', listed, 'click',      'listed');

    document.querySelectorAll('.kpi[data-f]').forEach(el => el.onclick = () => {
      filter = (filter === el.dataset.f) ? null : el.dataset.f;
      render();
    });
  }

  /* -- columns ------------------------------------------------------------- */
  const COLS_MINE = [['n','Property','l'],['v','Value'],['noi','NOI / yr'],['cap','Cap / YoC'],
                     ['occ','Occupancy'],['status','Status','l'],['act','','l']];
  const COLS_MKT  = [['n','Property','l'],['ask','Asking'],['noi','NOI / yr'],['cap','Cap rate'],
                     ['occ','Occupancy'],['qlist','Listed','l'],['act','','l']];
  const COLS_REST = [['n','Property','l'],['v','Est. value'],['cap','Cap rate'],['occ','Occupancy'],
                     ['o','Owner','l'],['act','','l']];

  function head(cols) {
    return '<thead><tr>' + cols.map(c => {
      const arrow = (sortK === c[0] && c[0] !== 'act')
        ? ' <span class="arrow">' + (sortDir === 1 ? '&#9650;' : '&#9660;') + '</span>' : '';
      return '<th class="' + (c[2] || '') + '" data-k="' + c[0] + '">' + c[1] + arrow + '</th>';
    }).join('') + '</tr></thead>';
  }

  function sortRows(rows) {
    return rows.slice().sort((a, b) => {
      let x = a[sortK], y = b[sortK];
      if (sortK === 'n') { x = a.n; y = b.n; }
      if (sortK === 'o') { x = (OWN()[a.o]||OWN().none).short; y = (OWN()[b.o]||OWN().none).short; }
      if (sortK === 'act' || sortK === 'status') { x = a.occ; y = b.occ; }
      if (typeof x === 'string') return sortDir * x.localeCompare(y);
      return sortDir * ((x || 0) - (y || 0));
    });
  }

  /* -- rows ---------------------------------------------------------------- */
  function rowMine(p) {
    const yoc = p.yoc != null ? '<div class="sml">YoC ' + R.pct(p.yoc) + '</div>' : '';
    return '<tr class="row' + (R.listedByMe(p) ? ' listed' : '') + '" data-id="' + p.id + '">' +
      '<td class="l">' + nameCell(p, typeSub(p)) + '</td>' +
      '<td>' + R.money(p.v) + '</td>' +
      '<td>' + R.money(p.noi) + '</td>' +
      '<td>' + R.pct(p.cap) + yoc + '</td>' +
      '<td>' + occBar(p.occ) + '</td>' +
      '<td class="l">' + statusBadge(p) +
        (R.listedByMe(p) ? '<div class="sml">' + p.qlist + ' qtrs listed</div>' : '') + '</td>' +
      '<td class="l"><button class="act" data-v1="sell" data-id="' + p.id + '">Sell</button></td></tr>' + drawer(p, 7);
  }

  function rowMarket(p) {
    return '<tr class="row" data-id="' + p.id + '">' +
      '<td class="l">' + nameCell(p, typeSub(p)) + '</td>' +
      '<td>' + R.money(p.ask) + '<div class="sml">est ' + R.money(p.v) + '</div></td>' +
      '<td>' + R.money(p.noi) + '</td>' +
      '<td>' + R.pct(p.cap) + '</td>' +
      '<td>' + occBar(p.occ) + '</td>' +
      '<td class="l"><span class="sml">' + (p.qlist || 0) + ' qtrs</span></td>' +
      '<td class="l"><button class="act buy" data-v1="buy" data-id="' + p.id + '">Buy</button> <button class="act" data-a="offer" data-id="' + p.id + '" title="Offer less than the asking price">Offer</button></td>' +
      '</tr>' + drawer(p, 7);
  }

  function rowLot(l) {
    const rsv = window.Deals && Deals.reserved(l);
    return '<tr class="row">' +
      '<td class="l">' + nameCell({ n:l.name, ph:l.photo }, 'Vacant land &middot; zoned ' + R.TN[l.zone]) + '</td>' +
      '<td>~' + R.money(l.cost) + '</td>' +
      '<td class="sml">&mdash;</td><td class="sml">&mdash;</td><td class="sml">&mdash;</td>' +
      '<td class="l"><span class="badge b-lot">' + (rsv ? '&#128274; Reserved' : 'Auction') + '</span></td>' +
      '<td class="l"><button class="act bid" data-a="bid" data-id="' + l.id + '"' + (rsv ? ' title="' + R.esc(rsv) + '"' : '') + '>' + (rsv ? 'Why reserved?' : 'Place bid') + '</button></td></tr>';
  }

  function rowRest(p) {
    const o = OWN()[p.o] || OWN().none;
    return '<tr class="row" data-id="' + p.id + '">' +
      '<td class="l">' + nameCell(p, typeSub(p)) + '</td>' +
      '<td>' + R.money(p.v) + '</td>' +
      '<td>' + R.pct(p.cap) + '</td>' +
      '<td>' + occBar(p.occ) + '</td>' +
      '<td class="l">' + (R.isRival(p) ? '<a class="rv-link" data-rival="' + p.o + '"><span class="dot" style="background:' + o.color + '"></span>' + o.short + '</a>' : '<span class="dot" style="background:' + o.color + '"></span>' + o.short) + '</td>' +
      '<td class="l">' + (function () {   // round 22: every building takes an offer (deals.js), unless something blocks it
        const why = window.Deals && Deals.blocked(p.id);
        return why ? '<button class="act mute" title="' + R.esc(why) + '" data-a="offer" data-id="' + p.id + '">' + (/war/.test(why) ? 'At war' : 'Not now') + '</button>'
                   : '<button class="act" data-a="offer" data-id="' + p.id + '">Make an offer</button>';
      })() +
      '</td></tr>' + drawer(p, 6);
  }

  /* -- expandable detail --------------------------------------------------- */
  function drawer(p, cols) {
    if (!open.has(p.id)) return '';

    let capital;
    if (p.basis) {
      const gain = p.v - p.basis, pc = gain / p.basis * 100;
      capital =
        (p.jv ? dl('Ownership', p.jv.mine + '% &middot; JV with ' + R.esc(p.jv.partner)) : '') +
        dl('Cost basis', R.money(p.basis)) +
        dl('Held', R.heldLabel(p.held)) +
        dl('Current value', R.money(p.v)) +
        dl('Gain / loss', '<span style="color:' + (gain >= 0 ? 'var(--good)' : 'var(--bad)') + '">' +
           (gain >= 0 ? '+' : '') + R.money(gain) + ' (' + (gain >= 0 ? '+' : '') + pc.toFixed(0) + '%)</span>') +
        dl('Yield on cost', R.pct(p.yoc));
    } else {
      capital = dl('Cost basis', '<span class="sml">not disclosed</span>') +
                dl('Current value', R.money(p.v)) +
                dl('Going-in yield', R.pct(p.cap));
    }

    const story = p.story
      ? '<p style="margin:0 0 8px;font-size:12px;">' + R.esc(p.story) + '</p>'
      : '<div class="soon">No history written for this building yet.</div>';

    return '<tr class="dr"><td colspan="' + cols + '"><div class="drawer">' +
      '<div><h4>Capital</h4><div class="dl">' + capital + '</div></div>' +
      '<div><h4>Tenants &amp; leases</h4>' + tenantPanel(p) + '</div>' +
      '<div><h4>About</h4>' + story + ownerActions(p) +
        '<div style="margin-top:8px"><button class="act" data-a="map" data-id="' + p.id + '">' +
        'Locate on map</button></div></div>' +
      '</div></td></tr>';
  }

  /* -- what you can do with a building you own ---------------------------
     These are v1's Portfolio-list actions, moved here when that list retired.
     They call the same UI.confirm* functions, so the rules are unchanged. */
  function ownerActions(p) {
    if (!R.isMine(p)) return '';
    const raw = p._raw || {};
    const b = (a, t, tip) => '<button class="act" data-v1="' + a + '" data-id="' + p.id + '"' +
      (tip ? ' title="' + tip + '"' : '') + '>' + t + '</button>';
    const out = [];
    if (raw.underConstruction) {
      out.push(raw.devId ? '<span class="sml">Development: see the Dealroom</span>' :
               '<span class="sml">' + (raw.constructionType === 'renovation' ? 'Renovating' : 'Repositioning') +
               ', ' + raw.constructionQuartersLeft + ' qtr left</span>');
    } else {
      const locked = window.Tenants && Tenants.isLocked && Tenants.isLocked(raw);
      if (!locked && raw.occupancy < 0.90 && window.Staff && Staff.hasRole && Staff.hasRole('asset')) {
        out.push(raw.leaseUpYear === GameState.meta.year
          ? '<span class="sml">Leased up this year</span>'
          : b('lease', 'Lease up', 'Pay brokers and incentives to fill space now'));
      }
      if (Properties.canRenovate && Properties.canRenovate(raw).ok)
        out.push(b('renovate', 'Renovate $' + (raw.currentValue * 0.10).toFixed(1) + 'M'));
      if (Properties.canReposition && Properties.canReposition(raw).ok)
        out.push(b('reposition', 'Reposition $' + (raw.currentValue * 0.15).toFixed(1) + 'M'));
    }
    out.push(b('sell', 'Sell'));
    return '<div class="own-acts" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">' + out.join('') + '</div>';
  }

  /* -- who pays the rent (tenants.js) ------------------------------------- */
  const CREDIT_CLASS = { Strong:'c-strong', Fine:'c-fine', Watch:'c-watch', Distressed:'c-bad', Government:'c-gov' };
  function tenantPanel(p) {
    const raw = p._raw || {};
    const l = raw.lease;
    if (!l) return '<div class="soon">No lease data for this building.</div>';

    if (l.type === 'residential' && l.mgmt !== 'operator') {
      const who = l.mgmt === 'thirdparty' ? 'a third-party manager' : 'your in-house team';
      return '<div class="tn-res"><b>' + l.units + ' units</b> &middot; ' + p.occ + '% occupied<br>' +
             '<span class="sml">Hundreds of households on one-year leases, run by ' + who + '.</span></div>';
    }

    const rows = p.tenants.map(t => {
      if (t.vacant)
        return '<div class="tn tn-vacant"><div class="tn-n">Vacant</div>' +
               '<div class="sml">' + R.money(t.rent) + '/yr of rent dark &middot; re-letting, ~' + (t.relet || '?') + ' qtrs</div></div>';
      const arrow = t.trend > 0 ? ' &#9650;' : t.trend < 0 ? ' &#9660;' : '';
      const cov = t.coverage == null ? '' : t.coverage.toFixed(1) + 'x' + arrow + ' ';
      return '<div class="tn"><div class="tn-n">' + R.esc(t.name) +
             ' <span class="cb ' + (CREDIT_CLASS[t.label] || '') + '">' + cov + t.label + '</span></div>' +
             '<div class="sml">' + R.esc(t.industry || '') + ' &middot; ' + R.money(t.rent) + '/yr' +
             (l.type === 'multi' ? ' (' + Math.round(t.share * 100) + '% of rent)' : '') +
             ' &middot; ' + t.years + ' yrs left</div></div>';
    }).join('');

    let foot = '';
    if (l.type === 'multi') {
      const others = Math.max(0, (l.count || 0) - l.positions.length);
      if (others) foot = '<div class="sml" style="margin-top:4px">+ ' + others + ' smaller tenants</div>';
    } else if (l.type === 'single') {
      foot = '<div class="sml" style="margin-top:4px">Single tenant, triple-net: they pay taxes, insurance and upkeep. ' +
             '100% let or empty — nothing in between.</div>';
    } else {
      foot = '<div class="sml" style="margin-top:4px">Master-leased to an operator: fixed rent, their credit risk.</div>';
    }
    return rows + foot;
  }
  const dl = (k, v) => '<span class="k">' + k + '</span><span class="v">' + v + '</span>';

  /* -- grouping ------------------------------------------------------------ */
  function groupRows(rows, renderer, cols) {
    if (grp === 'none') return sortRows(rows).map(renderer).join('');
    const keys = {};
    rows.forEach(p => { (keys[p[grp]] = keys[p[grp]] || []).push(p); });
    return Object.keys(keys).sort().map(k => {
      const g = keys[k], s = R.summarise(g);
      const label = (grp === 't' ? R.TN[k] : R.TI[k]) + ' (' + g.length + ')';
      return '<tr class="grp"><td class="l" colspan="3">' + label + '</td>' +
        '<td colspan="' + (cols - 3) + '" style="text-align:right">' +
        R.money(s.value) + ' value &middot; ' + R.money(s.noi) + ' NOI &middot; ' + s.cap + '% cap' +
        '</td></tr>' + sortRows(g).map(renderer).join('');
    }).join('');
  }

  /* -- render -------------------------------------------------------------- */
  function render() {
    // Same guard as map.js — refresh() can arrive before init().
    if (!document.getElementById('tMine')) return;
    let m = mine();
    if (filter === 'low')    m = m.filter(p => p.occ < 85);
    if (filter === 'listed') m = m.filter(R.listedByMe);

    document.getElementById('filterNote').textContent =
      filter === 'low'    ? 'Filtered: occupancy below 85% — click the chip again to clear' :
      filter === 'listed' ? 'Filtered: currently listed — click the chip again to clear' : '';

    document.getElementById('tMine').innerHTML =
      head(COLS_MINE) + '<tbody class="body">' + groupRows(m, rowMine, 7) + '</tbody>';

    document.getElementById('tMarket').innerHTML =
      head(COLS_MKT) + '<tbody class="body">' +
      sortRows(market()).map(rowMarket).join('') + lots().map(rowLot).join('') + '</tbody>';

    document.getElementById('tRest').innerHTML =
      head(COLS_REST) + '<tbody class="body">' + sortRows(rest()).map(rowRest).join('') + '</tbody>';

    document.getElementById('n1').textContent = mine().length;
    document.getElementById('n2').textContent = market().length + lots().length;
    document.getElementById('n3').textContent = rest().length;

    document.querySelectorAll('.toggle[data-g]').forEach(b => b.classList.toggle('on', b.dataset.g === grp));

    kpis();
    tenantsPanel();
    wire();
  }

  /* -- round 24: who pays your rent, and how healthy they are ------------------
     A ring of the biggest tenants' share of your rent (named tenants only; the
     rest is apartments and small tenants), and each one's rent cover: their
     profit divided by the rent they owe. Below 1.0x they pay you from savings. */
  const RING = ['#2f6fb0', '#e69500', '#14a38b', '#7a5cd0', '#d33b3b', '#5a9bd8', '#b8860b', '#3a4756'];
  const HEALTH = { Strong: '#18794e', Fine: '#2f6fb0', Watch: '#b8860b', Distressed: '#c2410c', Government: '#5a6b7d' };
  function tenantsPanel() {
    const box = document.getElementById('tenantsPanel');
    if (!box || !window.Tenants || !Tenants.myTopTenants) return;
    const all = Tenants.myTopTenants().filter(t => t.pct > 0), top = all.slice(0, 7);
    if (!top.length) { box.innerHTML = ''; return; }
    const named = top.reduce((a, t) => a + t.pct, 0), rest = Math.max(0, 100 - named);
    const segs = top.map((t, i) => ({ v: t.pct, c: RING[i % RING.length] })).concat(rest > 0.5 ? [{ v: rest, c: '#d8e2ec' }] : []);
    let a0 = -Math.PI / 2;
    const arc = (v, c) => { const a1 = a0 + v / 100 * 2 * Math.PI, r = 46, R = 60, cx = 64, cy = 64, big = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rr, a) => (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
      const d = 'M' + p(R, a0) + ' A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + p(R, a1) + ' L' + p(r, a1) + ' A' + r + ' ' + r + ' 0 ' + big + ' 0 ' + p(r, a0) + ' Z';
      a0 = a1; return '<path d="' + d + '" fill="' + c + '"/>'; };
    const biggest = top[0], warn = biggest && biggest.pct > 15;
    const arrow = t => t.trend > 0 ? ' \u25b2' : t.trend < 0 ? ' \u25bc' : '';
    box.innerHTML = '<div class="tn-panel"><svg viewBox="0 0 128 128" width="128" height="128">' + segs.map(s => arc(s.v, s.c)).join('') +
      '<text x="64" y="62" text-anchor="middle" font-size="15" font-weight="800" fill="#2b3a4a">' + Math.round(named) + '%</text><text x="64" y="78" text-anchor="middle" font-size="9" fill="#7a8796">named tenants</text></svg>' +
      '<div class="tn-list"><div class="tn-h"><b>Who pays your rent</b> <span class="sml">share of your rent \u00b7 rent cover (their profit \u00f7 rent; below 1.0x they pay from savings)</span></div>' +
      top.map((t, i) => '<div class="tn-r"><i style="background:' + RING[i % RING.length] + '"></i><span class="tn-nm">' + R.esc(t.name) + '</span><span class="tn-pc">' + t.pct.toFixed(1) + '%</span>' +
        '<span class="tn-cv" style="color:' + (HEALTH[t.label] || '#5a6b7d') + '">' + (t.coverage != null ? t.coverage.toFixed(1) + 'x' + arrow(t) + ' ' : '') + t.label + '</span></div>').join('') +
      (rest > 0.5 ? '<div class="tn-r"><i style="background:#d8e2ec"></i><span class="tn-nm">Apartments and small tenants</span><span class="tn-pc">' + rest.toFixed(1) + '%</span><span class="tn-cv"></span></div>' : '') +
      (warn ? '<div class="tn-warn">' + R.esc(biggest.name) + ' pays ' + biggest.pct.toFixed(0) + '% of your rent. Above 15%, one tenant\u2019s trouble is your trouble.</div>' : '') +
      '</div></div>';
  }

  function wire() {
    document.querySelectorAll('#tab-properties th[data-k]').forEach(th => th.onclick = () => {
      const k = th.dataset.k;
      if (k === 'act') return;
      if (sortK === k) sortDir *= -1; else { sortK = k; sortDir = (k === 'n' || k === 'o') ? 1 : -1; }
      render();
    });

    document.querySelectorAll('#tab-properties tr.row').forEach(tr => tr.onclick = e => {
      if (e.target.closest('button')) return;
      const id = tr.dataset.id;
      if (!id) return;
      open.has(id) ? open.delete(id) : open.add(id);
      render();
    });

    document.querySelectorAll('#tab-properties .rv-link').forEach(a => a.onclick = e => { e.stopPropagation(); if (window.Rivals) Rivals.openProfile(a.dataset.rival); });
    const V1 = { sell:'confirmSellProperty', buy:'confirmBuyProperty', lease:'leaseUp',
                 renovate:'confirmRenovate', reposition:'confirmReposition' };
    document.querySelectorAll('#tab-properties button[data-v1]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const fn = window.UI && UI[V1[b.dataset.v1]];
      if (fn) fn(b.dataset.id);
    });

    document.querySelectorAll('#tab-properties button[data-a]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      R.modal(b.dataset.a, b.dataset.id);
    });
  }

  function init() {
    if (!document.getElementById('tMine')) return;   // properties tab not present
    document.querySelectorAll('.toggle[data-g]').forEach(b => b.onclick = () => { grp = b.dataset.g; render(); });
    document.getElementById('restToggle').onclick = function () {
      const t = document.getElementById('tRest');
      t.classList.toggle('collapsed');
      this.textContent = t.classList.contains('collapsed') ? 'show' : 'hide';
    };
    render();
  }

  /* Open one of your buildings from elsewhere (the map). */
  function focus(id) {
    if (typeof showView === 'function') showView('properties');
    open.add(id); render();
    const tr = document.querySelector('#tab-properties tr.row[data-id="' + id + '"]');
    if (tr && tr.scrollIntoView) tr.scrollIntoView({ block: 'center' });
  }

  return { init, render, focus };
})();
