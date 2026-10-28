/* ============================================================================
   shell.js — the 2.0 view layer's shared foundation.

   Loads AFTER ui.js. It does NOT own the page: v1's ui.js still runs the
   header, the quarter loop, the board and the capital actions. This file only
   provides what the two new tabs (Map, Properties) need.

   THE ONE IMPORTANT JOB — the adapter.
   v1 stores properties one way; the 2.0 views were written against the master
   list's shape. Rather than rewrite both views, everything funnels through
   view() below, so the views keep their own vocabulary and there is exactly
   one place where the two shapes meet.
   ========================================================================== */

window.REIT = (() => {

  const TN = { office:'Office', industrial:'Industrial', retail:'Retail', multifamily:'Multifamily' };
  const TI = { tier1:'Tier 1', tier2:'Tier 2', suburban:'Suburban' };

  /* Owners: taken from the master list so colours match the map legend. */
  const OWNERS = (window.PROPERTIES_MASTER && window.PROPERTIES_MASTER.OWNERS) || {
    you:{ short:'You', color:'#1f9d55' }, none:{ short:'Private', color:'#8393a3' }
  };

  /* -- formatting --------------------------------------------------------- */
  const money = v => '$' + Number(v || 0).toFixed(1) + 'M';
  const pct   = v => Number(v || 0).toFixed(1) + '%';
  const esc   = s => String(s == null ? '' : s)
                      .replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));

  function heldLabel(q) {
    if (q == null) return '—';
    const y = Math.floor(q / 4), r = q % 4;
    if (!y) return q + ' qtr' + (q === 1 ? '' : 's');
    return y + 'y' + (r ? ' ' + r + 'q' : '');
  }

  const photoSrc = key => 'assets/photos/' + key + '.jpg';
  function photoImg(key, cls) {
    if (!key) return '<div class="' + (cls || '') + '" style="background:#dde7f0;width:40px;height:40px;border-radius:6px"></div>';
    return '<img class="' + (cls || '') + '" src="' + photoSrc(key) + '" alt="" loading="lazy">';
  }

  /* -- colour ramps ------------------------------------------------------- */
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const cl01 = t => Math.max(0, Math.min(1, t));
  /* round 35b: colours by cap rate again */
  const capColor = c => { const t = cl01((c - 6.5) / 4);   return `rgb(${lerp(40,240,t)},${lerp(150,60,t)},${lerp(205,55,t)})`; };
  const occColor = o => { const t = cl01((o - 74) / 24);   return `rgb(${lerp(214,45,t)},${lerp(70,165,t)},${lerp(60,90,t)})`; };
  const valColor = v => { const t = cl01((v - 15) / 110);  return `rgb(${lerp(150,20,t)},${lerp(190,70,t)},${lerp(225,140,t)})`; };

  /* -- the clock, now real ------------------------------------------------ */
  const clock = {
    get quarter() { return GameState.meta ? GameState.totalQuartersElapsed() : 1; },
    year()  { return GameState.meta ? GameState.meta.year : 1; },
    q()     { return GameState.meta ? GameState.meta.quarter : 1; }
  };

  /* ==========================================================================
     THE ADAPTER — v1 property object  →  the shape the 2.0 views expect.
     ======================================================================== */
  function view(p, owner) {
    if (!p) return null;
    const value = p.currentValue || 0;
    const noi   = p.annualNOI || 0;
    /* round 35: honest yields. annualNOI is rent after costs IF FULLY LET; what you collect today is
       less (empty space still costs: financials.js, costs 28% of gross rent). The old "cap rate" was
       full rent / a value priced on actual rent = area rate / occupancy: emptier looked better. */
    const now   = p.underConstruction ? 0 : noi * Math.max(0, (p.occupancy || 0) - 0.28) / 0.70;
    const CR    = GameState.market && GameState.market.capRates && GameState.market.capRates[p.sector];
    const area  = CR ? CR[p.location] : null;
    const isListed = owner === 'you' ? false : !!p.listedByOwner && p.askingPrice > 0;
    // round 35b: CAP RATE = stabilised rent / price (properties.js); YIELD TODAY = rent collected now / price
    const stab  = p.underConstruction ? 0 : (window.Properties && Properties.stabRent ? Properties.stabRent(p) : noi);
    const price = isListed ? p.askingPrice : value;
    return {
      id:     p.id,
      n:      p.name,
      t:      p.sector,
      ti:     p.location,
      o:      owner || 'none',
      v:      Math.round(value * 10) / 10,
      /* Live cap rate, not the baseline — what the asset actually yields now. */
      cap:    price > 0 ? Math.round(stab / price * 1000) / 10 : 0,      // round 35b: cap rate on the price (asking, or value)
      yNow:   price > 0 ? Math.round(now / price * 1000) / 10 : 0,       // round 35b: yield today on the same price
      areaCap: area,
      atAsk:  isListed,
      noiNow: Math.round(now * 100) / 100,
      occ:    Math.round((p.occupancy || 0) * 100),
      noi:    Math.round(noi * 100) / 100,
      ph:     p.photo,
      x:      p.x, y: p.y,
      listed: owner === 'you' ? !!p.listing : !!p.listedByOwner,   // yours: listed by you (sales.js)
      ask:    owner === 'you' && p.listing ? p.listing.ask : p.askingPrice,
      qlist:  owner === 'you' && p.listing ? Math.max(0, (GameState.meta.year - 1) * 4 + GameState.meta.quarter - p.listing.since) : (p.daysOnMarket || 0),
      basis:  p.purchasePrice,
      held:   p.quarterOwned,
      yoc:    (p.purchasePrice > 0) ? Math.round(noi / p.purchasePrice * 1000) / 10 : null,
      status: p.constructionType === 'land' ? 'land' : p.constructionType === 'development' ? 'building' : p.underConstruction ? (p.renovating ? 'renovating' : 'leaseup') : 'active',
      story:  p.story || '',
      traits: p.traits || [],
      count:  window.Tenants ? Tenants.countLabel(p) : '',
      tenants: window.Tenants ? Tenants.rowsFor(p) : [],
      /* joint venture (world.js jv_partner): value and NOI are already YOUR share */
      jv:     p.jv ? { partner: p.jv.partner, mine: Math.round((1 - p.jv.share) * 100) } : null,
      note:   p.ownerNote || null,             // story buildings (Harlow's distribution centre)
      _raw:   p
    };
  }

  /* The whole city, rebuilt from live state each time it is asked for. */
  function city() {
    const mine   = (GameState.portfolio     || []).map(p => view(p, 'you'));
    const market = (GameState.propertyMarket || []).map(p => view(p, 'none'));
    const rivals = (GameState.cityRivals     || []).map(p => view(p, p.owner));
    const lots   = (GameState.devLots        || [])
                     .filter(l => l.unlockQuarter <= clock.quarter);
    return { mine, market, rivals, lots, all: mine.concat(market, rivals) };
  }

  /* Portfolio roll-up, used by the KPI chips and group subtotals. */
  function summarise(list) {
    const v = list.reduce((a, p) => a + p.v, 0);
    const noi = list.reduce((a, p) => a + p.noi, 0), noiNow = list.reduce((a, p) => a + (p.noiNow != null ? p.noiNow : p.noi), 0);
    const stab = list.reduce((a, p) => a + (p.cap || 0) / 100 * p.v, 0);
    return {
      count: list.length,
      value: Math.round(v * 10) / 10,
      noi:   Math.round(noi * 100) / 100,
      cap:   v ? Math.round(stab / v * 10000) / 100 : 0,     // round 35b: cap rate (stabilised rent / value)
      yNow:  v ? Math.round(noiNow / v * 10000) / 100 : 0,   // round 35b: rent collected today / value
      occ:   v ? Math.round(list.reduce((a, p) => a + p.occ * p.v, 0) / v * 10) / 10 : 0
    };
  }

  const byId = id => city().all.find(p => p.id === id)
                  || (GameState.devLots || []).find(l => l.id === id)
                  || null;

  const isMine  = p => p.o === 'you';
  const isRival = p => p.o !== 'you' && p.o !== 'none';
  /* A property WE have put on the market, versus one someone else is selling.
     v1 sells instantly via Properties.sellProperty, so listedByMe is always
     false today — it becomes real when the slow-sale model lands (B.3). */
  const listedByMe    = p => isMine(p) && !!p.listed;
  const listedByOther = p => !isMine(p) && !!p.listed;

  /* -- the deal modal -----------------------------------------------------
     Shared by the map cards and the properties table, so "make an offer"
     means the same thing wherever it is clicked. Buying routes into v1's
     real Properties.buyProperty(); the rest are not wired to the engine yet. */
  function closeModal() {
    const m = document.getElementById('v2mask');
    if (m) m.style.display = 'none';
  }

  function ensureMask() {
    let m = document.getElementById('v2mask');
    if (!m) {
      m = document.createElement('div');
      m.id = 'v2mask';
      m.innerHTML = '<div id="v2modal"></div>';
      document.body.appendChild(m);
      m.onclick = e => { if (e.target.id === 'v2mask') closeModal(); };
    }
    return m;
  }

  function modal(action, id) {
    const o = byId(id);
    if (!o) return;
    const isLot = !o.t;
    const name  = o.n || o.name;
    let title = '', cta = 'Confirm', body = '', base = 0, min = 85, max = 140, start = 100;

    if (action === 'list') {
      title = 'List for sale'; cta = 'List property'; base = o.v; min = 80; max = 130; start = 105;
      body = note('Set an asking price. Below valuation sells fast; above it may sit for quarters.');
    } else if (action === 'buy') {
      title = 'Buy this property'; cta = 'Complete purchase'; base = o.ask || o.v;
      body = note('Cash purchase at the asking price, plus transaction fees. This one is live — it will actually buy the building.');
    } else if ((action === 'offer' || action === 'bid') && window.Deals) {   // round 22: wired (deals.js)
      if (action === 'offer') Deals.openOffer(id); else Deals.openLot(id);
      return;
    } else if (action === 'offer') {
      title = 'Unsolicited offer'; cta = 'Submit offer'; base = o.v;
      body = note('Not yet wired to the engine. In the finished game the owner takes one to two quarters to accept, counter or refuse.');
    } else if (action === 'bid') {
      title = 'Bid for development land'; cta = 'Place bid'; base = o.cost; min = 90; max = 160;
      body = note('Not yet wired to the engine. Auctions will resolve over two quarters, with rivals bidding against you.');
    } else if (action === 'map') {
      title = 'Locate on map'; cta = 'Go to map';
      body = note('Switches to the map and highlights this property.');
    }

    if (base) {
      body += '<div class="big" id="v2pv">' + money(base * start / 100) + '</div>' +
              '<div class="sml" id="v2pn"></div>' +
              '<input type="range" id="v2pr" min="' + min + '" max="' + max + '" value="' + start + '">';
    }

    ensureMask();
    document.getElementById('v2modal').innerHTML =
      '<div class="mh">' + photoImg(o.ph) +
        '<div><div style="font-weight:800">' + esc(name) + '</div>' +
        '<div class="sml">' + title + '</div></div></div>' +
      '<div class="mb">' + body + '</div>' +
      '<div class="mf"><button class="btn2" id="v2mc">Cancel</button>' +
      '<button class="btn2 p" id="v2mo">' + cta + '</button></div>';
    document.getElementById('v2mask').style.display = 'flex';

    const pr = document.getElementById('v2pr');
    if (pr) {
      const upd = () => {
        const f = pr.value / 100;
        document.getElementById('v2pv').textContent = money(base * f);
        const d = (f - 1) * 100;
        document.getElementById('v2pn').textContent =
          (d >= 0 ? '+' : '') + d.toFixed(0) + '% vs ' +
          (action === 'list' ? 'valuation' : action === 'bid' ? 'guide price' : 'asking');
      };
      pr.oninput = upd; upd();
    }

    document.getElementById('v2mc').onclick = closeModal;
    document.getElementById('v2mo').onclick = () => {
      closeModal();
      if (action === 'map') {
        if (typeof showView === 'function') showView('map');
        if (window.MAP && MAP.flash) MAP.flash(id);
        return;
      }
      if (action === 'buy' && window.Properties && Properties.buyProperty) {
        const r = Properties.buyProperty(id);
        if (window.UI && UI.refreshAll) UI.refreshAll();
        if (window.PROPS) PROPS.render();
        if (window.MAP)   MAP.render();
        alert(r.message);
      }
    };
  }
  const note = t => '<p style="margin:0 0 10px;color:var(--v2-muted);font-size:12px;">' + t + '</p>';

  /* Called by v1's newGame and after each quarter so the new tabs stay live. */
  function refresh() {
    if (window.MAP   && MAP.render)   MAP.render();
    if (window.PROPS && PROPS.render) PROPS.render();
    if (window.Inbox && Inbox.render) Inbox.render();
    hud();
    noResultsYet();
    creditLine();
    if (window.BoardTab) BoardTab.render();
    if (window.Journal) { const v = document.getElementById('view-stories'); if (v && !v.classList.contains('hidden')) Journal.render(); }
  }

  /* Finance: the revolving credit facility (revolver.js). */
  function creditLine() {
    const box = document.getElementById('rcf-body');
    if (!box || !window.Revolver || !window.GameState || !GameState.revolver) return;
    const R = GameState.revolver, m = v => '$' + v.toFixed(1) + 'M';
    const used = Revolver.drawn(), pct = R.limit ? Math.min(100, used / R.limit * 100) : 0;
    const row = (k, v, cls) => '<div class="rcf-r"><span class="has-tip-k">' + k + '</span><b class="' + (cls || '') + '">' + v + '</b></div>';
    box.innerHTML =
      '<div class="rcf-bar"><div style="width:' + pct.toFixed(0) + '%" class="' + (pct > 75 ? 'hi' : '') + '"></div></div>' +
      row('Line', m(R.limit)) +
      row('Drawn', m(used), used > 0 ? 'down' : '') +
      row('Available', R.frozen ? 'frozen' : m(Revolver.available()), R.frozen ? 'down' : '') +
      row('Rate on what you draw', Revolver.rate().toFixed(2) + '% (floating)') +
      row('Fee on the unused line', Revolver.FEE.toFixed(2) + '% a year') +
      row('Next review', 'Y' + Revolver.yq(R.renewAt)) +
      (function () {   // round 10: the bond covenant, where you can see it
        const lim = Financials.covenantLimit(), d2a = GameState.ratios.debtToAssets || 0, cfo = window.Staff && Staff.hasRole && Staff.hasRole('financial');
        return '<div class="rcf-c"><b>Bond covenant:</b> total debt at most ' + Math.round(lim * 100) + '% of assets (you: ' + Math.round(d2a * 100) + '%).' +
          (lim < 0.65 ? ' <button class="rcf-fav" id="rcf-amend"' + (cfo ? '' : ' disabled title="Needs a CFO"') + '>Ask bondholders for 65% (' + (cfo ? 'consent fee $' + Financials.consentFee() + 'M' : 'needs a CFO') + ')</button>' : ' <span class="sml-note">Amended once already.</span>') + '</div>';
      })() +
      (R.conditions.length ? '<div class="rcf-c"><b>Bank conditions</b>' + R.conditions.map((c, i) => '<div>\u2022 ' + Revolver.COND[c.id].text(c) +
          ' <button class="rcf-fav" data-lift="' + i + '"' + (Revolver.canFavour('lift') ? '' : ' disabled') + ' title="The Chairman asks the bank to drop it">Lift (' + Revolver.FAVOUR.lift + ' capital)</button></div>').join('') + '</div>' : '') +
      (R.frozen ? '<div class="rcf-c bad"><b>Frozen: repay only.</b> No new draws; profits pay down the ' + m(used) + ' you owe. Needing more than that is a default. Fully repaid for two quarters, the bank reopens the line, smaller.' +
          '<div style="margin-top:6px"><button class="rcf-fav" data-thaw="1"' + (Revolver.canFavour('thaw') ? '' : ' disabled') + '>Call in a favour: reopen now (' + Revolver.FAVOUR.thaw + ' capital)</button> <span class="sml-note">line 80% of today, +0.50% rate</span></div></div>' : '') +
      '<div class="sml-note">Political capital: ' + ((GameState.board && GameState.board.politicalCapital) || 0) + ' / ' + ((GameState.board && GameState.board.maxCapital) || 8) + '. The Chairman can call the bank for you. ' +
        'More ways to earn and spend it in the Dealroom.</div>' +
      '<div class="sml-note" style="margin-top:6px">Cash below zero draws on this line automatically; cash above zero repays it. Run past the line and the company defaults.</div>';
    const am = document.getElementById('rcf-amend');
    if (am) am.onclick = e => { e.stopPropagation(); const r = Financials.amendCovenant(); if (window.UI && UI.showToast) UI.showToast(r.message, r.success ? 'success' : 'error'); if (window.UI && UI.renderAll) UI.renderAll(); };
    box.querySelectorAll('.rcf-fav:not(#rcf-amend)').forEach(bt => bt.onclick = () => {
      const msg = bt.dataset.thaw ? Revolver.thaw() : Revolver.liftCondition(+bt.dataset.lift);
      if (msg && window.UI && UI.showToast) UI.showToast(msg, 'success');
      if (window.UI && UI.renderAll) UI.renderAll(); else creditLine();
    });
  }

  /* Before the first quarter closes, the income statement and ratios are all
     zero. To a newcomer "$0.0M" and a red "0.00x" read as "you're broke", so
     show a dash and say why instead (round 2). */
  function noResultsYet() {
    const none = !(window.GameState && GameState.history && GameState.history.length);
    const fin = document.getElementById('view-finance');
    if (!fin) return;
    fin.classList.toggle('no-results', none);
    if (!none) return;
    fin.querySelectorAll('.pnl-table td:last-child, .ratio-value').forEach(td => {
      if (td.closest('.ratios-grid') && /NAV\/Share/.test((td.previousElementSibling || {}).textContent || '')) return;
      td.textContent = '\u2014'; td.className = td.className.replace(/text-(green|red|yellow)/g, '');
    });
    let note = document.getElementById('fin-first-q');
    if (!note) {
      note = document.createElement('div'); note.id = 'fin-first-q'; note.className = 'fin-note';
      note.textContent = 'Results appear after your first quarter. Make your moves, then press Advance quarter.';
      const pnl = fin.querySelector('.pnl-table'); if (pnl) pnl.parentNode.insertBefore(note, pnl);
    }
  }

  /* -- top bar: name, date and the five numbers that matter ----------------
     Everything else lives on the Finance screen. */
  function hud() {
    const box = document.getElementById('tb-hud');
    if (!box || !window.GameState) return;
    const G = GameState, co = G.company || {}, bal = G.balance || {};
    const t = G.meta || {}, hist = G.history || [];

    const nm = document.getElementById('tb-co');
    if (nm) nm.textContent = (co.name || 'My REIT').toUpperCase();
    const sub = document.getElementById('tb-sub');
    if (sub) sub.textContent = 'Riverton';
    const dt = document.getElementById('tb-date');
    if (dt) dt.innerHTML = 'Year ' + Math.min(15, t.year || 1) + ' <b>Q' + (t.quarter || 1) + '</b><span>of 15</span>';

    /* Starting price for TSR. Captured once per game; newGame() builds a
       fresh GameState, so this resets itself. */
    if (G._p0 == null) G._p0 = hist.length ? (hist[0].sharePrice || 10) : (co.sharePrice || 10);
    const price = co.sharePrice || 0;
    const divs  = hist.reduce((a, h) => a + (h.dividendPerShare || 0), 0);
    const tsr   = G._p0 ? ((price + divs) / G._p0 - 1) * 100 : 0;

    const last  = hist.length ? hist[hist.length - 1] : null;
    const rc    = last ? last.retainedCash : null;
    const d2a   = bal.totalAssets ? bal.totalDebt / bal.totalAssets * 100 : 0;
    const sit   = window.Situation && Situation.get ? Situation.get() : null;

    /* Cash below zero is the credit line in use (revolver.js): say how much is left. */
    const cashCell = c => {
      const R = window.Revolver && G.revolver ? G.revolver : null;
      if (c >= 0 || !R) return cell('Cash', '$' + c.toFixed(1) + 'M');
      const left = R.frozen ? 'line frozen' : '$' + Revolver.available().toFixed(0) + 'M line left';
      return '<div class="hud" title="Below zero you are drawing on your credit line. Run past it and the company defaults.">' +
        '<div class="k">Cash</div><div class="v down">\u2212$' + (-c).toFixed(1) + 'M</div><div class="sub">' + left + '</div></div>';
    };
    const signed = (v, dp, unit) => (v >= 0 ? '+' : '\u2212') + Math.abs(v).toFixed(dp) + unit;
    const cell = (k, v, extra, cls, opt) =>
      '<div class="hud' + (opt ? ' opt' : '') + '"><div class="k">' + k + '</div>' +
      '<div class="v' + (cls ? ' ' + cls : '') + '">' + v + (extra || '') + '</div></div>';

    box.innerHTML =
      cashCell(bal.cash || 0) +
      cell('Retained last qtr',
           rc == null ? '\u2014' : '<span class="' + (rc >= 0 ? 'up' : 'down') + '">' +
             (rc >= 0 ? '\u25b2 ' : '\u25bc ') + '$' + Math.abs(rc).toFixed(1) + 'M</span>', '', '', true) +
      cell('Share price', '$' + price.toFixed(2),
           hist.length ? '<span class="s ' + (tsr >= 0 ? 'up' : 'down') + '" title="Total return since you took over, dividends included">' +
             signed(tsr, 0, '%') + '</span>' : '') +
      cell('Debt / assets', d2a.toFixed(0) + '%', '', d2a > 60 ? 'down' : '', true) +
      '<div class="hud" title="Your credit rating sets the spread you pay over the central bank base rate on new bonds and the credit line. It follows debt / assets and interest cover; like the real agencies, it counts preferred shares as half debt and their dividends next to interest."><div class="k">Rating \u00b7 base rate</div><div class="v"><span class="' + (/^A/.test(G.credit.rating) ? 'up' : /^B{1,2}$/.test(G.credit.rating) || /^C/.test(G.credit.rating) ? 'down' : '') + '">' + (G.credit.rating || '\u2014') + '</span> \u00b7 ' + (G.market.baseInterestRate || 0).toFixed(2) + '%</div></div>' +
      cell('Situation', sit ? sit.label : 'Stable', '', 'sit-' + (sit ? sit.state : 'stable'));
    // round 20: the retained-cash cell is the first to go on narrower screens (the inbox shows it every quarter)
    box.innerHTML = box.innerHTML.replace('<div class="hud opt"><div class="k">Retained last qtr', '<div class="hud opt hud-rc"><div class="k">Retained last qtr');
  }

  function init() {
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    if (window.MAP)   MAP.init();
    if (window.PROPS) PROPS.init();
  }

  return { TN, TI, OWNERS, money, pct, esc, heldLabel, photoSrc, photoImg,
           capColor, occColor, valColor, clock,
           view, city, summarise, byId, isMine, isRival, listedByMe, listedByOther,
           modal, closeModal, refresh, hud, init };
})();

/* NO self-boot here. shell.js loads before map.js and properties_tab.js, so
   calling REIT.init() at this point would run before MAP and PROPS exist.
   index.html boots the view layer explicitly after every module is loaded. */
