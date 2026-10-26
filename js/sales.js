/* ============================================================================
   sales.js — SELLING TAKES TIME (round 10).

   v1 sold any building instantly at about its value. Real property does not
   work like that, and the illiquidity is the point (design doc C.3.4): when a
   maturity looms in a crisis you should feel the fear of holding assets you
   cannot turn into cash.

     List it      at value, a little above, or a little below. Each quarter a
                  buyer may make an offer: likelier when the asking price is
                  low and the economy good, rarer for half-empty buildings.
                  The offer arrives in the inbox: accept, counter, or decline.
     Quick sale   now, to a fund, at 12% under value. The emergency exit.
   Your lenders' forced sales (revolver.js) and the maturity ladder
   (financials.js) stay instant: they are not your choice.

   Offers are World system cards served through Story's "due" slot, so the
   inbox, the dialog and save/load handle them like any other decision.
   ========================================================================== */

window.Sales = (() => {

  const rnd = () => Math.random();
  const fmt = n => Math.round(n * 10) / 10;
  const money = n => '$' + Math.abs(n).toFixed(1) + 'M';
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const QUICK = 0.88;
  const MODES = { high: 1.06, value: 1.0, low: 0.94 };
  const CYC = { expanding: 1.2, stable: 1.0, contracting: 0.75, recession: 0.5 };
  const find = id => (GameState.portfolio || []).find(p => p.id === id);
  const S = () => (window.Story ? Story.S() : (GameState._salesS = GameState._salesS || {}));

  /* Chance a buyer turns up this quarter for a building listed at `ask`. */
  function offerOdds(p) {
    if (!p.listing) return 0;
    const ratio = p.listing.ask / Math.max(0.1, p.currentValue);
    let c = 0.35 + (1 - ratio) * 4;
    c *= CYC[(GameState.market && GameState.market.cycle) || 'stable'] || 1;
    if ((p.occupancy || 0) < 0.7) c *= 0.7;
    return Math.max(0.05, Math.min(0.85, c));
  }

  function list(id, mode) {
    const p = find(id); if (!p) return { success: false, message: 'Not your building.' };
    if (p.underConstruction) return { success: false, message: 'Not while it is under construction.' };
    const ask = fmt(p.currentValue * (MODES[mode] || 1));
    p.listing = { ask, since: tq(), mode: mode || 'value' };
    return { success: true, message: 'Listed ' + p.name + ' at ' + money(ask) + '. About ' + Math.round(offerOdds(p) * 100) + '% chance of an offer each quarter.' };
  }
  function withdraw(id) { const p = find(id); if (p) p.listing = null; return { success: true, message: 'Taken off the market.' }; }
  function quick(id) {
    const p = find(id); if (!p) return { success: false, message: 'Not your building.' };
    p.listing = null;
    return Properties.sellProperty(id, fmt(p.currentValue * QUICK));
  }

  function processQuarter() {
    const s = S(), now = tq();
    if (s.due) return;
    const listed = (GameState.portfolio || []).filter(p => p.listing && now > p.listing.since);
    for (const p of listed) {
      if (rnd() >= offerOdds(p)) continue;
      let price = fmt(p.currentValue * (0.95 + rnd() * 0.07));
      if (price > p.listing.ask) price = p.listing.ask;
      const buyer = window.Rivals && GameState.rivals && rnd() < 0.6 ? Rivals.buyerFor(p) : 'none';
      s.saleOffer = { id: p.id, price, buyer, q: now };
      s.due = 'sale_offer';
      return;
    }
  }

  const buyerName = k => k && k !== 'none' && window.PROPERTIES_MASTER ? (PROPERTIES_MASTER.OWNERS[k] || {}).name || 'A rival' : 'A private property fund';
  const buyerFace = k => k && k !== 'none' && window.Rivals ? (Rivals.STYLE[k] || {}).face : '';

  const CARD = {
    id: 'sale_offer', system: true, story: true, holdQ: 0,
    build() {
      const o = S().saleOffer, p = o && find(o.id); if (!o || !p || !p.listing) return null;
      const fee = Properties.transactionFee(o.price), net = fmt(o.price - fee), gain = p.purchasePrice ? fmt(net - p.purchasePrice) : null;
      const counter = fmt(Math.min(p.listing.ask, o.price * 1.03));
      const done = () => { S().saleOffer = null; };
      return {
        title: 'An offer for ' + p.name, from: buyerName(o.buyer), face: buyerFace(o.buyer),
        body: '"We would like to buy ' + p.name + '. Here is our number."' +
              '<table class="dv-nums">' + [['Their offer', money(o.price)], ['Your asking price', money(p.listing.ask)], ['Your book value', money(p.currentValue)],
                ['After fees you receive', money(net) + (gain != null ? ' (' + (gain >= 0 ? '+' : '−') + money(gain) + ' vs what you paid)' : '')],
                ['Rent you give up', money(p.annualNOI * (p.occupancy || 1)) + ' a year'], ['On the market', (tq() - p.listing.since) + ' quarter(s)']]
                .map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>',
        choices: [].concat([
          { label: 'Accept ' + money(o.price),
            detail: 'Sold. The cash arrives now.',
            apply() { done(); p.listing = null; const r = Properties.sellProperty(p.id, o.price); return r.message; } },
          ], counter <= o.price + 0.05 ? [] : [{ label: 'Counter at ' + money(counter),
            detail: 'About half the time they meet you there; otherwise they walk away and the building stays listed.',
            apply() { done(); if (rnd() < 0.5) { p.listing = null; const r = Properties.sellProperty(p.id, counter); return 'They took it. ' + r.message; } return 'They walked. ' + p.name + ' is still on the market.'; } }], [
          { label: 'Decline',
            detail: 'The building stays listed. Another buyer may come.',
            apply() { done(); return 'Declined. Still on the market at ' + money(p.listing.ask) + '.'; } },
        ])
      };
    }
  };
  if (window.World && World.DECISIONS && !World.DECISIONS.some(d => d.id === CARD.id)) World.DECISIONS.push(CARD);

  return { list, withdraw, quick, processQuarter, offerOdds, QUICK, MODES };
})();
