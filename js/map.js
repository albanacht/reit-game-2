/* ============================================================================
   map.js — the Riverton data map.

   Markers are drawn from PROPERTIES_MASTER, never generated.
     shape  = sector      (office bar, retail slab, multifamily gable, industrial shed)
     size   = tier        (tier1 widest, gold dot)
     colour = active heatmap layer
     $ badge = actively listed for sale
   ========================================================================== */

window.MAP = (() => {

  const R = window.REIT;
  /* Owner metadata still comes from the master list (colours, names); the
     PROPERTIES themselves now come from live GameState via REIT.city(). */
  const OWN = () => R.OWNERS;

  // 2.0: 50% bigger (Alexander: they are the key data points)
  const TIER_W = { tier1:60, tier2:46, suburban:36 };

  let mode = 'owner';
  let wrap, card, mapEl;

  /* -- marker geometry ----------------------------------------------------- */
  function shape(sector, c) {
    const S = 'stroke="#fff" stroke-width="1.6" vector-effect="non-scaling-stroke"';
    if (sector === 'office')
      return '<rect x="14" y="8" width="12" height="34" rx="1" fill="' + c + '" ' + S + '/>';
    if (sector === 'retail')
      return '<rect x="5" y="27" width="30" height="15" rx="1" fill="' + c + '" ' + S + '/>';
    if (sector === 'multifamily')
      return '<path d="M9,42 L9,25 L20,12 L31,25 L31,42 Z" fill="' + c + '" ' + S + '/>';
    return '<rect x="5" y="27" width="30" height="15" fill="' + c + '" ' + S + '/>' +
           '<path d="M5,27 L14,19 L23,27 Z" fill="' + c + '" ' + S + '/>' +
           '<rect x="26" y="15" width="4" height="12" fill="' + c + '" ' + S + '/>';
  }

  function colourOf(p) {
    if (mode === 'owner') return (OWN()[p.o] || OWN().none).color;
    if (mode === 'cap')   return R.capColor(p.cap);
    if (mode === 'occ')   return R.occColor(p.occ);
    return R.valColor(p.v);
  }

  function glyph(p) {
    const c = colourOf(p);
    const gold = p.ti === 'tier1'
      ? '<circle cx="20" cy="43.5" r="2.6" fill="#ecc84b" stroke="#fff" stroke-width="1"/>' : '';
    // for sale: a tilted SALE tag instead of a $ badge
    const sale = p.listed ? '<span class="mk-sale">SALE</span>' : '';
    return '<svg width="' + TIER_W[p.ti] + '" viewBox="0 0 40 46">' + shape(p.t, c) + gold + '</svg>' + sale;
  }

  /* -- card ---------------------------------------------------------------- */
  function place(anchor) {
    const mr = mapEl.getBoundingClientRect(), br = anchor.getBoundingClientRect();
    let lx = br.left - mr.left + 16, ly = br.top - mr.top - 6;
    if (lx > mr.width - 256) lx = br.left - mr.left - 256;
    card.style.left = lx + 'px';
    card.style.top = Math.max(2, ly) + 'px';
    card.style.display = 'block';
  }
  const hide = () => card.style.display = 'none';

  function showProperty(p, anchor) {
    const o = OWN()[p.o] || OWN().none;

    /* The action line encodes the whole trading model in one sentence. */
    let act;
    if (R.isMine(p))
      act = bar('#2f6fb0', p.listed ? 'LISTED AT ' + R.money(p.ask) + ' &mdash; click for details' : 'Click: details, lease up, sell');
    else if (p.note)
      act = bar('#5a6b7d', R.esc(p.note));
    else if (p.listed)
      act = bar('#14a85a', 'FOR SALE &mdash; click to buy at ' + R.money(p.ask || p.v));
    else if (p.o === 'none')
      act = bar('#5a6b7d', 'Privately held &mdash; click to make an offer');
    else if (atWar(p))
      act = bar('#3a4756', 'Held by ' + o.short + ' &mdash; at war: click for their profile');
    else
      act = bar('#3a4756', 'Held by ' + o.short + ' &mdash; click to make an offer');

    card.innerHTML =
      '<div class="cardbox"><div class="chead">' +
        '<div class="tx"><div class="nm">' + R.esc(p.n) + '</div>' +
        '<div class="tt">' + R.TN[p.t] + ' &middot; ' + R.TI[p.ti] + '</div></div>' +
        R.photoImg(p.ph, 'thumb') +
      '</div><div class="divl"></div><div class="grid">' +
        row('Owner', '<span style="color:' + o.color + '">' + o.short + '</span>' +
            (p.jv ? ' &middot; ' + p.jv.mine + '% (JV)' : '')) +
        row('Est. value', R.money(p.v)) +
        row('Cap rate', R.pct(p.cap)) +
        row('Occupancy', p.occ + '%') +
        row('Ann. NOI', R.money(p.noi)) +
        row('Tenants', p.count || '—') +
        (p.tenants && p.tenants.length === 1 && !p.tenants[0].vacant && (p._raw.lease || {}).type === 'single'
          ? row('Occupier', R.esc(p.tenants[0].name) +
                (p.tenants[0].coverage != null ? ' &middot; ' + p.tenants[0].coverage.toFixed(1) + 'x' : ''))
          : '') +
      '</div>' + act + '</div>';
    place(anchor);
  }

  /* round 22: Rennick's buildings at war open his profile (the war's weapons live there) */
  const atWar = p => p.o === 'ren' && window.War && ['war', 'crisis'].indexOf(War.W().stage) > -1;
  function showLot(l, anchor) {
    const rsv = window.Deals && Deals.reserved(l), mine = window.Deals && Deals.D().list.some(d => d.kind === 'lot' && d.lid === l.id && d.stage === 'out');
    card.innerHTML =
      '<div class="cardbox"><div class="chead">' +
        '<div class="tx"><div class="nm">' + R.esc(l.name || l.n) + '</div>' +
        '<div class="tt" style="color:#e69500">VACANT LAND</div></div>' +
        R.photoImg(l.photo, 'thumb') +
      '</div><div class="divl"></div><div class="grid">' +
        row('Zoned for', R.TN[l.zone]) +
        row('Land + build', '~' + R.money(l.cost)) +
        row('Status', rsv ? 'Reserved' : mine ? 'Your bid is in' : 'Open for bids') +
      '</div>' + bar(rsv ? '#7a8796' : '#c8892b', rsv ? '&#128274; RESERVED: THE CHAIRMAN HAS PLANS' : mine ? 'AUCTION CLOSES THIS QUARTER' : 'CLICK TO BID') +
      '</div>';
    place(anchor);
  }

  const row = (k, v) => '<span class="k">' + k + '</span><span class="v">' + v + '</span>';
  const bar = (bg, t) => '<div class="cardact" style="background:' + bg + '">' + t + '</div>';

  /* -- render -------------------------------------------------------------- */
  function render() {
    /* Defensive: renderAll() in ui.js calls REIT.refresh() on every quarter,
       and that can happen before init() has found the DOM (or when the map tab
       does not exist at all). A view that is not ready must no-op, never throw
       — a crash here would take the whole game down with it. */
    if (!wrap) { wrap = document.getElementById('markers'); if (!wrap) return; }
    if (!card)  card  = document.getElementById('card');
    if (!mapEl) mapEl = document.getElementById('map');
    wrap.innerHTML = '';

    const C = R.city();

    C.all.forEach(p => {
      const el = document.createElement('div');
      el.className = 'mk' + (R.isMine(p) ? ' mine' : '');
      el.style.left = p.x + '%';
      el.style.top  = p.y + '%';
      el.dataset.id = p.id;
      el.innerHTML = glyph(p);
      el.onmouseenter = () => showProperty(p, el);
      el.onmouseleave = hide;
      // round 5: a rival's building opens the rival's profile
      /* 2.0 round 9: the map is the home screen, so a click acts: a rival's
         building opens their profile, yours opens its row on Properties,
         one on the market opens the purchase (with the deal preview). */
      el.onclick = () => {
        if (R.isRival(p) && window.Rivals && GameState.rivals && (atWar(p) || !window.Deals)) { hide(); Rivals.openProfile(p.o); return; }
        if (R.isRival(p) && window.Deals) { hide(); Deals.openOffer(p.id); return; }
        if (p.note) { showProperty(p, el); return; }
        hide();
        if (R.isMine(p)) { if (window.PROPS && PROPS.focus) PROPS.focus(p.id); return; }
        if (window.UI && UI.confirmBuyProperty) UI.confirmBuyProperty(p.id);
      };
      wrap.appendChild(el);
    });

    /* Only lots that have actually been released, so the map and the
       properties tab always show the same city. Future lots stay hidden
       until their unlockQuarter — releasing one should feel like news. */
    C.lots.forEach(l => {
      const el = document.createElement('div');
      el.className = 'lot';
      el.style.left = l.x + '%';
      el.style.top  = l.y + '%';
      el.dataset.id = l.id;
      el.textContent = '+';
      el.onmouseenter = () => showLot(l, el);
      el.onmouseleave = hide;
      el.onclick = () => { hide(); if (window.Deals) Deals.openLot(l.id); else showLot(l, el); };
      if (window.Deals && Deals.reserved(l)) el.classList.add('lot-locked');
      wrap.appendChild(el);
    });

    legend();
  }

  function legend() {
    const dot = (c, t) => '<span style="color:' + c + '">&#9679;</span> ' + t;
    const L = {
      owner: Object.keys(OWN()).map(k => dot(OWN()[k].color, OWN()[k].short)).join(' &nbsp;') +
             '<br><span class="lg-sale">SALE</span> for sale &nbsp;<span style="color:#c8892b">&#9632;</span> development lot',
      cap:   dot(R.capColor(6.6), 'low') + ' &rarr; ' + dot(R.capColor(10.4), 'high cap rate'),
      occ:   dot(R.occColor(75), 'low') + ' &rarr; ' + dot(R.occColor(98), 'full occupancy'),
      val:   dot(R.valColor(20), 'low') + ' &rarr; ' + dot(R.valColor(120), 'high value')
    };
    document.getElementById('legend').innerHTML = L[mode];
  }

  /* Called when the properties tab says "locate on map". */
  function flash(id) {
    const el = wrap.querySelector('[data-id="' + id + '"]');
    if (!el) return;
    el.scrollIntoView({ block:'center', behavior:'smooth' });
    let n = 0;
    const t = setInterval(() => {
      el.style.transform = (n % 2)
        ? 'translate(-50%,-100%) scale(1.6)' : 'translate(-50%,-100%)';
      if (++n > 5) { clearInterval(t); el.style.transform = ''; }
    }, 180);
  }

  function init() {
    wrap  = document.getElementById('markers');
    if (!wrap) return;                       // map tab not present
    card  = document.getElementById('card');
    mapEl = document.getElementById('map');

    /* NOTE: this used to be '.toolbar .opt', which never matched the merged
       markup ('.v2-toolbar') — the colour buttons were dead from the merge
       until this change. */
    document.querySelectorAll('.map-ctl .seg button').forEach(b => b.onclick = e => {
      e.stopPropagation();
      mode = b.dataset.m;
      document.querySelectorAll('.map-ctl .seg button').forEach(x => x.classList.toggle('on', x === b));
      render();
    });

    /* Marker positions are percentages, so a resize needs no recalculation,
       but the open card would be left pointing at nothing. */
    window.addEventListener('resize', hide);
    render();
  }

  return { init, render, flash };
})();
