/* ============================================================================
   rivals.js — the three rival REITs (design doc B.6, round 5).

   Each rival is a real company with simple books built from ITS OWN buildings
   (which now follow the market, occupancy and ageing like yours):
     rent collected - interest - head office - upkeep = cash profit (AFFO)
     dividend = a share of AFFO, by personality; cut when it isn't covered
     share price = the same idea as yours: dividend-yield anchor, pulled a
       little toward asset value, stressed by debt and recession
   and a simple brain, by personality, every quarter: buy what it likes from
   the market, sell what it doesn't, sell under pressure, pay down debt.

     Wexmoor  cautious: low debt, quality industrial/apartments, buys in a crisis
     Rennick  aggressive: high debt, office/retail trophies, sells in a crisis
     Halden   yield chaser: suburban anything, pays out almost everything

   Their total return makes the LEAGUE TABLE, which replaces the sector index
   as the benchmark the board judges you against.
   ========================================================================== */

window.Rivals = (() => {

  const KEYS = ['wex', 'ren', 'hal'];
  const STYLE = {
    wex: { ceo: 'Eleanor Whitcombe', face: 'assets/faces/ceo_wex.jpg', quote: 'We buy quality, and we never overpay.',
           style: 'Cautious. Low debt, quality industrial and apartments. Buys when others panic.',
           lev: 0.30, maxLev: 0.42, payout: 0.70, spread: 1.2, buyP: 0.10, crisisBuyP: 0.35, sellP: 0.03, crisisSellP: 0.0,
           wants: p => (p.sector === 'industrial' || p.sector === 'multifamily') && p.location !== 'suburban' },
    ren: { ceo: 'Brett Kessler', face: 'assets/faces/ceo_ren.jpg', quote: 'Second place is the first loser.',
           style: 'Aggressive. Heavy borrowing, office and retail trophies. Exposed when rates jump.',
           lev: 0.50, maxLev: 0.62, payout: 0.85, spread: 2.2, buyP: 0.22, crisisBuyP: 0.04, sellP: 0.04, crisisSellP: 0.30,
           wants: p => p.sector === 'office' || p.sector === 'retail' },
    hal: { ceo: 'Walter Halden', face: 'assets/faces/ceo_hal.jpg', quote: 'The suburbs pay the rent. Downtown pays the architects.',
           style: 'Yield chaser. Cheap suburban property, almost all profit paid out. Fragile in a downturn.',
           lev: 0.40, maxLev: 0.52, payout: 0.92, spread: 1.8, buyP: 0.16, crisisBuyP: 0.06, sellP: 0.03, crisisSellP: 0.15,
           wants: p => p.location === 'suburban' },
  };

  const fmt = n => Math.round(n * 100) / 100;
  const money = n => '$' + Math.abs(n).toFixed(1) + 'M';
  const rnd = () => Math.random();
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const OWN = k => { const O = (window.PROPERTIES_MASTER && PROPERTIES_MASTER.OWNERS) || {}; return O[k] || { name: k, short: k }; };
  const R = k => GameState.rivals && GameState.rivals[k];

  // -- their buildings --------------------------------------------------------
  const bldg = k => (GameState.cityRivals || []).filter(p => p.owner === k);
  const value = k => bldg(k).reduce((t, p) => t + (p.currentValue || 0), 0);
  const noiQ = k => bldg(k).reduce((t, p) => t + (p.underConstruction ? 0 : (p.annualNOI / 4) * (p.occupancy - 0.3) / 0.7), 0);
  const assets = k => value(k) + Math.max(0, R(k).cash);
  const d2a = k => { const a = assets(k); return a > 0 ? (R(k).debt + Math.max(0, -R(k).cash)) / a : 1; };

  function marketRate(k) {
    const arc = window.Arc && Arc.spreadAdd ? Arc.spreadAdd() : 0;
    return (GameState.market.baseInterestRate || 3) + STYLE[k].spread + 0.5 + arc + (window.War && War.spreadFor ? War.spreadFor(k) : 0);
  }

  // -- set-up ---------------------------------------------------------------------
  function init() {
    GameState.rivals = {};
    const used = [];
    KEYS.forEach(k => {
      const S = STYLE[k], V = value(k);
      const r = { key: k, cash: fmt(V * 0.05), debt: fmt(V * S.lev), rate: marketRate(k), shares: 0, dps: 0, price: 0, startPrice: 0,
                  hist: [], moves: [], staff: [], rating: 'BBB', lowCover: 0 };
      GameState.rivals[k] = r;
      r.shares = Math.max(4, Math.round((V + r.cash - r.debt) / 16 * 10) / 10);      // NAV ~ $16 a share, like yours
      const affo = affoQ(k); r.dps = fmt(Math.max(0.01, S.payout * affo / r.shares));
      r.price = fmt(fair(k)); r.startPrice = r.price;
      // two key people each, from the shared face pool (never offered to you while they work there)
      ['cfo', 'acquisitions'].forEach(role => {
        if (!window.Staff || !Staff.generateCandidate) return;
        const c = Staff.generateCandidate(role, used); used.push(c.portrait);
        r.staff.push({ role, title: c.title, name: c.name, portrait: c.portrait, skill: c.skill, stars: c.stars });
      });
    });
  }

  // -- the books ----------------------------------------------------------------
  function affoQ(k) {
    const r = R(k), V = value(k);
    return noiQ(k) - r.debt * r.rate / 400 - V * 0.0025 - V * 0.00125;      // rent - interest - head office (1%/yr) - upkeep
  }
  function fair(k) {
    const r = R(k), S = STYLE[k], V = value(k), nav = (V + r.cash - r.debt) / r.shares;
    const base = GameState.market.baseInterestRate || 3, cyc = GameState.market.cycle;
    let stress = 0;
    if (d2a(k) > 0.55) stress += 0.25; else if (d2a(k) > 0.45) stress += 0.10;
    if (r.lowCover > 0) stress += 0.2;
    if (r.cash < 0) stress += 0.15;
    if (cyc === 'recession') stress += 0.10; else if (cyc === 'contracting') stress += 0.05; else if (cyc === 'expanding') stress -= 0.05;
    stress = Math.max(0, Math.min(1, stress));
    const y = (base + 2.5 + 4.5 * stress) / 100;
    if (nav <= 0) return 0.5;
    const anchor = r.dps * 4 / y;
    // round 10: the same two legs as the player's price (financials.js fairPrice)
    const drag = window.War && War.drag ? War.drag(k) : 1;                 // round 13: the war's damage to his name
    return Math.max(nav * 0.3, Math.min(nav * 1.6, (0.5 * anchor + 0.5 * nav * (1 - 0.35 * stress)) * drag));
  }

  /* Share price against NAV, for the activist and the directors (2.0). */
  const live = () => KEYS.filter(k => R(k) && !R(k).gone);      // round 13: a rival can be taken over (war.js)
  function pnav(k) { const r = R(k); if (!r || r.gone || !r.shares) return 0; const nav = (value(k) + r.cash - r.debt) / r.shares; return nav > 0 ? r.price / nav : 0; }
  function pnavAvg() { const v = live().map(pnav).filter(x => x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0.9; }

  // -- the quarter ----------------------------------------------------------------
  function processQuarter() {
    if (!GameState.rivals) return [];
    const out = [], crisis = window.Arc && Arc.phase && Arc.phase() === 'crisis';
    live().forEach(k => {
      const r = R(k), S = STYLE[k];
      r.rate = fmt(r.rate * 0.9 + marketRate(k) * 0.1);                 // debt reprices slowly
      const affo = affoQ(k), div = r.dps * r.shares;
      r.lowCover = affo < div ? r.lowCover + 1 : 0;
      // dividend: cut after two uncovered quarters; otherwise creep toward the payout target
      if (r.lowCover >= 2 && r.dps > 0.01) {
        r.dps = fmt(r.dps * 0.7); r.lowCover = 0;
        move(k, OWN(k).short + ' cut its dividend by 30%.', 4, out);
      } else {
        const target = S.payout * Math.max(0, affo) / r.shares;
        if (target > r.dps * 1.02) r.dps = fmt(Math.min(target, r.dps * 1.02));
      }
      r.cash = fmt(r.cash + affo - r.dps * r.shares);

      // behaviour
      const V = value(k), lev = d2a(k);
      if (r.cash < -0.05 * V || lev > S.maxLev + 0.05) {
        const p = bldg(k).sort((a, b) => a.occupancy - b.occupancy)[0];
        if (p && bldg(k).length > 2 && window.War && War.blockSale && War.blockSale(k, p, out)) { /* round 13: you talked the buyer out of it */ }
        else if (p && bldg(k).length > 2) { const px = fmt(p.currentValue * 0.88); dispose(k, p, px); move(k, OWN(k).short + ' sold ' + p.name + ' under pressure, for ' + money(px) + '. It is on the market.', 6, out); }
        else if (r.price > 0.5) {
          // down to its last buildings: a rescue share sale at a deep discount (it survives, its shareholders don't enjoy it)
          const n = fmt(r.shares * 0.35), px = fmt(r.price * 0.7), raised = fmt(n * px);
          r.shares = fmt(r.shares + n); r.cash = fmt(r.cash + raised); r.price = fmt(r.price * 0.85);
          move(k, OWN(k).short + ' sold new shares at a 30% discount to stay afloat (' + money(raised) + ').', 7, out);
        }
      } else if (rnd() < (crisis ? S.crisisSellP : S.sellP)) {
        const pool = bldg(k).filter(p => !S.wants(p)); const p = (pool.length ? pool : bldg(k)).sort((a, b) => a.currentValue - b.currentValue)[0];
        if (p && bldg(k).length > 2 && window.War && War.blockSale && War.blockSale(k, p, out)) { /* blocked */ }
        else if (p && bldg(k).length > 2) { const px = fmt(p.currentValue); dispose(k, p, px); move(k, OWN(k).short + ' put ' + p.name + ' up for sale (' + money(px) + ').', 2, out); }
      } else if (lev < S.maxLev - 0.05 && rnd() < (crisis ? S.crisisBuyP : S.buyP)) {
        const room = Math.max(0, r.cash - 0.03 * V) + Math.max(0, S.maxLev * (V + 1) - r.debt);
        const p = (GameState.propertyMarket || []).filter(x => !x.underConstruction && S.wants(x) && (x.askingPrice || x.currentValue) <= room * 0.6)
                  .sort((a, b) => (b.annualNOI / (b.askingPrice || b.currentValue)) - (a.annualNOI / (a.askingPrice || a.currentValue)))[0];
        if (p) { const px = fmt(p.askingPrice || p.currentValue); takeFromMarket(k, p, px); move(k, OWN(k).short + ' bought ' + p.name + ' for ' + money(px) + '.', 3, out); }
      }
      // keep the books tidy: pay down debt with spare cash, borrow to cover a hole
      // pay debt down to its target level, never to zero (a yield chaser stays levered)
      const excess = r.debt - S.lev * assets(k);
      if (r.cash > 0.08 * V && excess > 0) { const pay = fmt(Math.min(excess, r.cash - 0.05 * V)); r.debt = fmt(r.debt - pay); r.cash = fmt(r.cash - pay); }
      if (r.cash < 0 && window.War && War.frozen && War.frozen(k)) {
        // round 13: his lenders will not lend (the bank squeeze in a crisis): a rescue share sale at a deep discount
        const n = fmt(r.shares * 0.2), px = fmt(r.price * 0.65), raised = fmt(n * px);
        r.shares = fmt(r.shares + n); r.cash = fmt(r.cash + raised); r.price = fmt(r.price * 0.85);
        move(k, OWN(k).short + '\u2019s banks refused to lend. It sold new shares at a 35% discount (' + money(raised) + ').', 7, out);
      }
      if (r.cash < 0) { r.debt = fmt(r.debt - r.cash + 0.02 * V); r.cash = fmt(0.02 * V); }

      // rating and price
      const cover = (noiQ(k) - V * 0.0025) / Math.max(0.01, r.debt * r.rate / 400);
      const L = d2a(k);
      r.rating = L < 0.35 && cover > 3 ? 'A' : L < 0.45 && cover > 2.2 ? 'BBB' : L < 0.55 ? 'BB' : 'B';
      r.price = fmt(Math.max(0.5, (r.price * 0.65 + fair(k) * 0.35) * (1 + (rnd() - 0.5) * 0.02)));
      r.hist.push({ q: tq(), price: r.price, dps: r.dps }); while (r.hist.length > 70) r.hist.shift();
    });
    // the inbox hears about the biggest move only (two if someone is in trouble)
    return out.sort((a, b) => b.w - a.w).slice(0, out.some(o => o.w >= 6) ? 2 : 1).map(o => ({ good: null, text: o.text }));
  }
  function move(k, text, w, out) { const r = R(k); r.moves.push({ q: tq(), text }); while (r.moves.length > 12) r.moves.shift(); out.push({ text, w }); }

  /* Buildings changing hands between a rival and the open market. */
  function takeFromMarket(k, p, px) {
    GameState.propertyMarket = GameState.propertyMarket.filter(x => x !== p);
    p.owner = k; p.listedByOwner = false; p.askingPrice = null; p.baseValue = p.currentValue; p.vb = null;
    GameState.cityRivals.push(p);
    onAcquire(k, p, px, true);
  }
  function dispose(k, p, px) {
    GameState.cityRivals = GameState.cityRivals.filter(x => x !== p);
    p.owner = null; p.listedByOwner = true; p.askingPrice = fmt(px * 1.02);
    GameState.propertyMarket.push(p);
    onDispose(k, px);
  }
  /* The rival pays: cash first, the rest borrowed. */
  function onAcquire(k, p, px, already) {
    const r = R(k); if (!r) return;
    const fromCash = Math.max(0, Math.min(px, r.cash - 0.03 * value(k)));
    r.cash = fmt(r.cash - fromCash); r.debt = fmt(r.debt + (px - fromCash));
    if (!already) { p.baseValue = p.currentValue; p.vb = null; }
  }
  function onDispose(k, px) { const r = R(k); if (r) r.cash = fmt(r.cash + px); }

  /* Who buys what you (or the lenders) sell: the rival who wants it and can afford it. */
  function buyerFor(p) {
    const ok = live().filter(k => STYLE[k].wants(p) && d2a(k) < STYLE[k].maxLev);
    const any = live().sort((a, b) => d2a(a) - d2a(b));
    return (ok.length ? ok : any)[0];
  }
  /* Who bids against you for a building: the rival whose taste it fits. */
  function wantsWho(p) { const L = live(), ok = L.filter(k => STYLE[k].wants(p)); return ok.length ? ok[Math.floor(rnd() * ok.length)] : L[Math.floor(rnd() * L.length)]; }
  /* A rival in trouble (for the "rival must sell" decision). */
  function distressed() { return live().filter(k => d2a(k) > STYLE[k].maxLev || R(k).cash < 0 || R(k).lowCover > 0).sort((a, b) => d2a(b) - d2a(a))[0] || null; }

  // -- returns and the league table ---------------------------------------------
  function ret(k, n) {
    const h = R(k).hist; if (h.length < 2) return 0;
    n = Math.min(n, h.length - 1);
    const p0 = h[h.length - 1 - n].price, p1 = h[h.length - 1].price;
    let d = 0; for (let i = h.length - n; i < h.length; i++) d += h[i].dps;
    return p0 ? (p1 + d) / p0 - 1 : 0;
  }
  function sinceStart(k) {
    const r = R(k), d = r.hist.reduce((t, h) => t + h.dps, 0);
    return r.startPrice ? (r.price + d) / r.startPrice - 1 : 0;
  }
  function yourReturn(n) {
    const h = GameState.history || []; if (h.length < 2) return 0;
    n = Math.min(n, h.length - 1);
    const p0 = h[h.length - 1 - n].sharePrice, p1 = h[h.length - 1].sharePrice;
    let d = 0; for (let i = h.length - n; i < h.length; i++) d += h[i].dividendPerShare || 0;
    return p0 ? (p1 + d) / p0 - 1 : 0;
  }
  function yourSinceStart() {
    const h = GameState.history || [], p0 = GameState._p0 || (h[0] && h[0].sharePrice);
    if (!h.length || !p0) return 0;
    return (h[h.length - 1].sharePrice + h.reduce((t, x) => t + (x.dividendPerShare || 0), 0)) / p0 - 1;
  }
  /* n = quarters to measure over (this year so far, or last year at Q1). */
  function league(n) {
    const G = GameState, rows = live().map(k => ({ key: k, name: OWN(k).name, short: OWN(k).short, face: STYLE[k].face, ceo: STYLE[k].ceo,
        ret: ret(k, n), since: sinceStart(k), yld: R(k).price ? R(k).dps * 4 / R(k).price : 0, lev: d2a(k), count: bldg(k).length, value: value(k), rating: R(k).rating }));
    rows.push({ key: 'you', name: G.company.name, short: 'You', face: null, ret: yourReturn(n), since: yourSinceStart(),
                yld: G.company.sharePrice ? G.company.dividendPerShare * 4 / G.company.sharePrice : 0,
                lev: G.ratios.debtToAssets || 0, count: G.portfolio.length, value: G.portfolio.reduce((t, p) => t + p.currentValue, 0), rating: G.credit.rating });
    return rows.sort((a, b) => b.ret - a.ret).map((r, i) => Object.assign(r, { rank: i + 1 }));
  }
  /* Average rival return over n quarters: the board's benchmark. */
  const avg = n => { const L = live(); return L.length ? L.reduce((t, k) => t + ret(k, n), 0) / L.length : 0; };

  // -- the profile ------------------------------------------------------------------
  function profileHTML(k) {
    const r = R(k), S = STYLE[k], o = OWN(k), pc = v => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + '%';
    const nav = (value(k) + r.cash - r.debt) / r.shares, n = (GameState.meta.quarter - 1) || 4;
    return '<div class="rv">' +
      '<div class="rv-head"><img src="' + S.face + '" alt=""><div><div class="rv-ceo">' + S.ceo + ', CEO</div>' +
      '<div class="rv-quote">“' + S.quote + '”</div><div class="rv-style">' + S.style + '</div></div></div>' +
      '<div class="rv-grid">' +
        cellH('Share price', '$' + r.price.toFixed(2)) + cellH('Total return since you started', pc(sinceStart(k))) +
        cellH('Return, ' + (GameState.meta.quarter === 1 ? 'last year' : 'this year'), pc(ret(k, n))) + cellH('Dividend yield', (r.price ? r.dps * 4 / r.price * 100 : 0).toFixed(1) + '%') +
        cellH('Buildings', bldg(k).length + ' (' + money(value(k)) + ')') + cellH('Debt / assets', Math.round(d2a(k) * 100) + '%') +
        cellH('Credit rating', r.rating) + cellH('Price / NAV', nav > 0 ? Math.round(r.price / nav * 100) + '%' : '—') +
      '</div>' +
      '<div class="rv-sub">Key people</div>' + r.staff.map(s => '<div class="rv-staff"><img src="assets/staff/' + s.portrait + '" alt=""><div><b>' + s.name + '</b><span>' + s.title + '</span></div></div>').join('') +
      '<div class="rv-sub">Recent moves</div>' + (r.moves.length ? r.moves.slice(-4).reverse().map(m => '<div class="rv-move">' + m.text + '</div>').join('') : '<div class="rv-move">Nothing yet.</div>') +
      (window.War && War.profileHTML ? War.profileHTML(k) : '') +
      '</div>';
  }
  const cellH = (k, v) => '<div class="rv-c"><span>' + k + '</span><b>' + v + '</b></div>';
  function openProfile(k) {
    if (!R(k) || !window.UI) return;
    UI.showModal(OWN(k).name, profileHTML(k), []);
    const box = document.querySelector('#modal-overlay .modal-box'); if (box) box.classList.add('wide');
    if (window.War && War.wireProfile) War.wireProfile(k);
  }

  return { init, processQuarter, league, avg, ret, pnav, pnavAvg, buyerFor, wantsWho, distressed, onAcquire, onDispose, openProfile, live, value, affoQ, R,
           STYLE, KEYS, bldg, d2a, staffPortraits: () => KEYS.flatMap(k => (R(k) ? R(k).staff.map(s => s.portrait) : [])) };
})();
