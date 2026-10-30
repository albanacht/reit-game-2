/* ============================================================================
   deals.js — OFFERS, LAND AND BUILDING (round 22). window.Deals

   1. OFFERS. Any building you do not own can be bid for, like signing a
      player from a rival club. The owner has a hidden price:
        private owner   value + 4 to 14% (who they are: a retiring owner or an
                        estate sells cheaper, a pension fund is patient)
        rival REIT      value + about 20%: +5% for a building it likes, −5% for
                        one it doesn't, −10% when it is in trouble
        listed          no more than its asking price
      Cheaper in a slow economy or a crisis. Your Acquisitions Lead takes 2 to
      6% off (more with skill); someone on the case (agents.js) takes off up to
      4.5% more. The answer comes next quarter, within ±5% of that price:
        your offer at or above it      yes
        within 6% under it             a counter at their price (one only)
        lower                          no, and no new offer for 4 quarters
      A private sale can draw a second bidder (20%) unless your broker has
      exclusivity. Rennick never sells to you during the war. A rival keeps
      at least 3 buildings.
   2. THE CITY MOVES. A private owner sometimes lists a building (more often
      in a recession). A Rainmaker brings you one off-market pitch a year.
   3. LAND. Bid for a lot (sealed, one round): maybe one rival bids too. Win
      it and choose small, standard or large, or hold the land. Building takes
      4/6/8 quarters, paid each quarter; halfway there is a chance of an
      overrun, and an anchor tenant may offer to pre-let. It opens part let and
      leases up. Rent is fixed when you start: cost x (today's cap rate +
      1.5%), so if yields have not risen by the end you made about 20%; if
      they have, less. The Fifth Street lot is reserved for the Chairman's
      plans (tower.js) until that story lets it go.
   ========================================================================== */

window.Deals = (() => {

  const rnd = () => Math.random();
  const fmt = n => Math.round(n * 100) / 100;
  const f1 = n => Math.round(n * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const money = n => '$' + Math.abs(n).toFixed(Math.abs(n) >= 10 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
  const pc = p => Math.round(p * 100) + '%';
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const D = () => GameState.deals || (GameState.deals = { list: [], devs: [], cool: {}, seq: 0, log: [] });
  const S = () => Story.S();
  const spendable = () => (window.Revolver && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash;
  const has = id => window.Directors && Directors.has(id);
  const remember = (id, d, why) => { if (has(id)) Directors.remember(id, d, why); };
  const say = (from, role, title, body, face) => { if (window.Inbox) Inbox.message(from, role, title, body, face); };
  const note = t => { const l = D().log; l.push({ q: tq(), t }); while (l.length > 40) l.shift(); };
  const nums = rows => '<table class="dv-nums">' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
  const OWN = k => ((window.PROPERTIES_MASTER && PROPERTIES_MASTER.OWNERS) || {})[k] || { name: k, short: k };
  const cyc = () => (GameState.market && GameState.market.cycle) || 'stable';
  const arcCrisis = () => window.Arc && Arc.phase && Arc.phase() === 'crisis';
  const MAX_OPEN = 3, OFFER_COOL = 4, SECOND_BID = 0.20, BAND = 0.05, COUNTER = 0.94;

  /* -- who owns what ---------------------------------------------------------- */
  const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  const PRIVATE = [
    ['Harold Pike', 'retiring after forty years', 0.05], ['the Brannigan estate', 'settling an inheritance', 0.04],
    ['St. Columba pension fund', 'a patient owner', 0.12], ['a Chicago family office', 'in no hurry', 0.10],
    ['the Okonkwo family trust', 'three generations of owners', 0.09], ['Lindqvist Holdings', 'a Swedish investor', 0.11],
    ['Marsh & Daughters', 'a local family firm', 0.08], ['a Toronto insurer', 'a long-term holder', 0.13],
    ['the Delgado family', 'built it in the 1990s', 0.07], ['Feld Properties', 'a small local landlord', 0.10]];
  const privOwner = p => PRIVATE[hash(p.id) % PRIVATE.length];
  function where(id) {
    const G = GameState;
    let p = (G.propertyMarket || []).find(x => x.id === id); if (p) return { p, owner: 'none' };
    p = (G.cityRivals || []).find(x => x.id === id); if (p) return { p, owner: p.owner };
    return null;
  }
  const warOn = () => !!(window.War && ['war', 'crisis'].indexOf(War.W().stage) > -1 && GameState.rivals && GameState.rivals.ren && !GameState.rivals.ren.gone);
  const rivalLive = k => !!(GameState.rivals && GameState.rivals[k] && !GameState.rivals[k].gone);
  const ownerLabel = (p, owner) => owner === 'none' ? (p.listedByOwner ? 'A private seller' : privOwner(p)[0]) : OWN(owner).name;
  const ownerFace = owner => owner !== 'none' && window.Rivals ? (Rivals.STYLE[owner] || {}).face : '';

  /* Why you cannot bid for it, or null. */
  function blocked(id) {
    const w = where(id); if (!w) return 'Not on the market.';
    const p = w.p;
    if (p.storyLock || p.ownerNote || p.id === 'ind_hdc') return 'Part of a story: not for sale this way.';
    if (p.id === 'off_mpz' && window.War && ['wait', 'bid'].indexOf(War.W().stage) > -1) return 'Jack Morrow is not selling yet.';
    if (p.id === 'ind_02' && window.Port && ['pitched', 'scheme', 'offer', 'suit'].indexOf(Port.P().stage) > -1) return 'Part of a story: not for sale this way.';
    if (w.owner === 'ren' && warOn()) return 'Kessler will not sell you a doorknob while the war is on.';
    if (w.owner !== 'none' && window.Rivals && Rivals.bldg(w.owner).length <= 3) return OWN(w.owner).short + ' will not sell one of its last three buildings.';
    const cool = D().cool[id]; if (cool && tq() < cool) return 'They said no. Try again from Y' + yq(cool) + '.';
    if (D().list.some(d => d.kind === 'offer' && d.pid === id && open(d))) return 'You already have an offer out.';
    return null;
  }
  const yq = q => (Math.floor((q - 1) / 4) + 1) + ' Q' + (((q - 1) % 4) + 1);
  const open = d => ['out', 'counter', 'rival'].indexOf(d.stage) > -1;

  /* The seller's price before the ±5%: the markup over value, all in. */
  function markup(p, owner, agentS) {
    let m, why = [];
    if (owner === 'none') {
      if (p.listedByOwner && p.askingPrice) { m = Math.min(p.askingPrice / Math.max(1, p.currentValue) - 1, 0.02 + (hash(p.id) % 5) / 100); why.push('it is listed, so the seller wants to sell'); }
      else { const o = privOwner(p); m = o[2]; why.push(o[0] + ': ' + o[1]); }
    } else {
      const St = window.Rivals && Rivals.STYLE[owner]; m = 0.20;
      if (St && St.wants(p)) { m += 0.05; why.push(OWN(owner).short + ' likes this building'); }
      else if (St) { m -= 0.05; why.push('it is not ' + OWN(owner).short + '’s kind of building'); }
      if (window.Rivals && Rivals.distressed && Rivals.distressed() === owner) { m -= 0.10; why.push(OWN(owner).short + ' is short of money'); }
      if (arcCrisis()) { m -= 0.04; why.push('a crisis'); }
    }
    const c = cyc();
    if (c === 'recession') { m -= 0.06; why.push('a recession: buyers are scarce'); }
    else if (c === 'contracting') { m -= 0.03; why.push('a slowing economy'); }
    else if (c === 'expanding') { m += 0.02; why.push('a hot market'); }
    if ((p.occupancy || 1) < 0.8) { m -= 0.02; why.push('it is half empty'); }
    if (window.Staff && Staff.hasRole && Staff.hasRole('acquisitions')) {
      const off = 0.02 + 0.04 * Staff.skillFactor('acquisitions') + (Staff.hasTrait('acquisitions', 'rainmaker') ? 0.01 : 0);
      m -= off; why.push('your Acquisitions Lead (−' + (off * 100).toFixed(1) + '%)');
    }
    if (agentS) m -= agentS * 0.10;
    return { m: Math.max(owner === 'none' ? -0.03 : 0.04, m), why };
  }
  /* Odds for an offer at x against a seller price rb (before the ±5%). */
  function odds(x, rb) {
    const u = r => clamp((r - 1 + BAND) / (2 * BAND), 0, 1);
    const yes = u(x / rb), atLeastCounter = u(x / (COUNTER * rb));
    return { yes, counter: Math.max(0, atLeastCounter - yes), no: Math.max(0, 1 - atLeastCounter) };
  }
  function quote(id, agentS) {
    const w = where(id); if (!w) return null;
    const mk = markup(w.p, w.owner, agentS);
    return { p: w.p, owner: w.owner, value: w.p.currentValue, rb: fmt(w.p.currentValue * (1 + mk.m)), m: mk.m, why: mk.why };
  }
  const fee = x => window.Properties && Properties.transactionFee ? Properties.transactionFee(x) : f1(x * 0.01);

  /* -- making an offer ------------------------------------------------------- */
  function offer(id, price, agentKey) {
    const why = blocked(id); if (why) return { success: false, message: why };
    if (D().list.filter(d => open(d)).length >= MAX_OPEN) return { success: false, message: 'Three deals at once is enough. Wait for an answer first.' };
    const q = quote(id); if (!q) return { success: false, message: 'Not on the market.' };
    price = f1(price);
    if (price < q.value * 0.8) return { success: false, message: 'Below 80% of value is an insult, not an offer.' };
    if (spendable() < price + fee(price)) return { success: false, message: 'You could not pay ' + money(price + fee(price)) + ' if they said yes (cash plus credit line: ' + money(spendable()) + ').' };
    const d = { id: 'deal:' + (++D().seq), kind: 'offer', pid: id, name: q.p.name, owner: q.owner, price, rb: markup(q.p, q.owner, 0).m, value: q.value, q: tq(), stage: 'out' };
    D().list.push(d);
    note('Offered ' + money(price) + ' for ' + d.name + ' (' + ownerLabel(q.p, q.owner) + ').');
    if (window.Telemetry) Telemetry.used('offer');
    let msg = 'Offer sent: ' + money(price) + ' for ' + d.name + '. The answer comes next quarter.';
    if (agentKey && window.Agents) { const r = Agents.assign(d.id, agentKey); msg += ' ' + r.message; }
    return { success: true, message: msg, deal: d };
  }
  function withdraw(dealId) {
    const d = D().list.find(x => x.id === dealId); if (!d || !open(d)) return { success: false, message: 'Nothing to withdraw.' };
    d.stage = 'withdrawn'; if (window.Agents) Agents.release(d.id);
    note('Withdrew the ' + (d.kind === 'lot' ? 'bid for ' : 'offer for ') + d.name + '.');
    return { success: true, message: 'Withdrawn.' };
  }

  /* Buy it: through World.buyAt, which pays the seller (a rival's books) and counts the buy. */
  function close(d, price) {
    const w = where(d.pid);
    if (!w) { d.stage = 'lost'; d.result = 'The building was gone by then.'; return d.result; }
    if (spendable() < price + fee(price)) {
      d.stage = 'lost'; d.result = 'You could not pay when they said yes. They will not take your calls for a year.';
      D().cool[d.pid] = tq() + 4; remember('chen', -0.5, 'a deal we could not pay for'); return d.result;
    }
    const msg = World.buyAt(w.p, price);
    const ok = (GameState.portfolio || []).some(p => p.id === d.pid);
    d.stage = ok ? 'won' : 'lost'; d.paid = price; d.result = msg;
    if (ok) { note('Bought ' + d.name + ' for ' + money(price) + '.'); if (w.owner !== 'none') remember('chen', 0.5, 'you took a building off ' + OWN(w.owner).short); }
    if (window.Agents) Agents.release(d.id);
    return msg;
  }

  /* -- the quarter ------------------------------------------------------------- */
  function processQuarter(out) {
    out = out || [];
    if (!window.GameState || GameState.meta.gameOver) return out;
    const now = tq();
    D().list.filter(d => d.stage === 'out' && d.q < now).forEach(d => d.kind === 'lot' ? resolveLot(d, out) : resolveOffer(d, out));
    devQuarter(out);
    // round 34: if the inbox slot was busy when we won the lot (Levi's letter, say), ask about the plan once it is free
    const waiting = D().devs.find(v => v.stage === 'land' && !v.asked);
    if (waiting && (!S().due || (Story.lowDue && Story.lowDue()))) { S().due = 'dev_plan'; S().devId = waiting.id; waiting.asked = true; }
    listings(out);
    pitch();
    rivalBuilds(out);
    return out;
  }

  function resolveOffer(d, out) {
    const w = where(d.pid);
    if (!w || w.owner !== d.owner) { d.stage = 'lost'; d.result = d.name + ' was sold to someone else first.'; say('Jenkins', 'Chief of Staff', 'Too late for ' + d.name, d.result, 'assets/faces/jenkins.jpg'); return; }
    if (d.owner === 'ren' && warOn()) { d.stage = 'lost'; d.result = 'Kessler tore up the offer on CNBC.'; return; }
    const s = window.Agents ? Agents.strength(d.id) : 0;
    const rb = w.p.currentValue * (1 + markup(w.p, d.owner, s).m), R = rb * (1 + (rnd() * 2 - 1) * BAND);
    const from = ownerLabel(w.p, d.owner), face = ownerFace(d.owner);
    if (d.price >= R) {
      const second = d.owner === 'none' && !(window.Agents && Agents.exclusive(d.id)) && rnd() < SECOND_BID && window.Rivals && Rivals.live().length;
      if (second && !S().due) {
        const k = Rivals.wantsWho(w.p);
        d.stage = 'rival'; d.rival = k; d.rivalBid = f1(d.price * (1.03 + rnd() * 0.04)); S().due = 'deal_rival'; S().dealId = d.id;
        return;
      }
      const msg = close(d, d.price);
      say(from, d.owner === 'none' ? 'Owner of ' + d.name : 'CEO, ' + OWN(d.owner).name, 'Yes to ' + money(d.price) + ' for ' + d.name,
          '"We accept." ' + msg, face);
      out.push({ good: true, text: 'Offer accepted: ' + d.name + ' is yours for ' + money(d.price) + '.' });
      return;
    }
    if (d.price >= R * COUNTER && !d.countered) {
      if (S().due) return;                                          // the inbox is busy: they answer next quarter
      d.stage = 'counter'; d.countered = true; d.counter = f1(R); S().due = 'deal_counter'; S().dealId = d.id; return;
    }
    d.stage = 'lost'; d.result = 'They said no. Their number was nearer ' + money(f1(R)) + '.';
    D().cool[d.pid] = tq() + OFFER_COOL;
    if (window.Agents) Agents.release(d.id);
    note(from + ' turned down ' + money(d.price) + ' for ' + d.name + '.');
    say(from, d.owner === 'none' ? 'Owner of ' + d.name : 'CEO, ' + OWN(d.owner).name, 'No to ' + money(d.price) + ' for ' + d.name,
        (d.owner === 'none' ? '"Thank you, but no. It is worth more to us than that."' : '"' + ((window.Rivals && Rivals.STYLE[d.owner] || {}).quote || 'No.') + ' And no."') +
        ' You can try again from Y' + yq(D().cool[d.pid]) + '.', face);
  }

  /* -- the city moves: private listings and the Rainmaker's pitch -------------- */
  function listings(out) {
    const c = cyc(), odd = c === 'recession' ? 0.22 : c === 'contracting' ? 0.16 : 0.10;
    if (rnd() >= odd) return;
    const pool = (GameState.propertyMarket || []).filter(p => !p.listedByOwner && !blocked(p.id) && !p.underConstruction);
    const p = pool[Math.floor(rnd() * pool.length)]; if (!p) return;
    const o = privOwner(p);
    p.listedByOwner = true; p.askingPrice = f1(p.currentValue * (1.02 + rnd() * 0.06)); p.daysOnMarket = 0;
    out.push({ good: null, text: o[0] + ' put ' + p.name + ' on the market at ' + money(p.askingPrice) + '.' });
  }
  function pitch() {
    if (!(window.Staff && Staff.hasTrait && Staff.hasTrait('acquisitions', 'rainmaker'))) return;
    const d = D(); if (d.pitchYear === GameState.meta.year || S().due || rnd() > 0.5) return;
    const pool = (GameState.propertyMarket || []).filter(p => !p.listedByOwner && !blocked(p.id) && p.currentValue <= spendable() * 0.9);
    const p = pool[Math.floor(rnd() * pool.length)]; if (!p) return;
    d.pitchYear = GameState.meta.year; d.pitch = { id: p.id, price: f1(p.currentValue * 1.02) }; S().due = 'deal_pitch';
  }

  /* -- land ------------------------------------------------------------------------ */
  const TIER = { cbd: 'tier1', riverfront: 'tier2', midtown: 'tier2', westside: 'suburban', southside: 'suburban', northend: 'suburban' };
  const LOT_Z = { lot_01: 'cbd', lot_02: 'midtown', lot_03: 'southside', lot_04: 'northend', lot_05: 'westside', lot_06: 'midtown' };
  const SIZES = { small: { k: 'small', label: 'Small', m: 0.6, q: 4, spread: 1.3 }, standard: { k: 'standard', label: 'Standard', m: 1, q: 6, spread: 1.5 }, large: { k: 'large', label: 'Large', m: 1.6, q: 8, spread: 1.7 } };
  const LAND = 0.30;                                   // the land is 30% of a standard project
  const lot = id => (GameState.devLots || []).find(l => l.id === id) || null;
  const tierOf = l => TIER[l.z || LOT_Z[l.id]] || 'tier2';
  const capNow = (sector, tier) => ((GameState.market.capRates[sector] || {})[tier] || 7);
  /* The Fifth Street lot waits for the Chairman's tower (tower.js) until that story lets it go. */
  function reserved(l) {
    if (!l || l.id !== 'lot_01') return null;
    const t = window.Tower ? Tower.T() : null;
    if (t && (t.stage === 'refused' || t.ending === 'never')) return null;
    if (t && t.stage === 'wait' && !has('williams') && GameState.meta.year >= 10) return null;
    return 'Reserved. Williams has plans for this lot and will not hear of selling it. Ask again later.';
  }
  function lotPlan(l, size) {
    const z = SIZES[size || 'standard'], sector = l.zone, tier = tierOf(l), cap = capNow(sector, tier);
    const land = f1(l.cost * LAND), build = f1(l.cost * (1 - LAND) * z.m), total = f1(land + build), yoc = cap + z.spread;
    const noi = fmt(total * yoc / 100), value = f1(noi / (cap / 100));
    return { sector, tier, cap, land, build, total, yoc, noi, value, gain: f1(value - total), q: z.q, size: z.k, label: z.label };
  }
  /* A rival who might bid, and how high it would go (before agents). */
  function lotRivalRange(l) {
    const c = cyc(), base = c === 'expanding' ? 1.15 : c === 'recession' ? 0.85 : c === 'contracting' ? 0.95 : 1.05;
    const guide = l.cost * LAND;
    return { lo: guide * (base - 0.15), hi: guide * (base + 0.15), p: c === 'recession' ? 0.45 : 0.70 };
  }
  function lotOdds(l, x, s) {
    const r = lotRivalRange(l), cut = 1 - (s || 0) * 0.15;
    const lo = r.lo * cut, hi = r.hi * cut, beat = clamp((x - lo) / (hi - lo), 0, 1);
    return (1 - r.p) + r.p * beat;
  }
  function bid(lid, price, agentKey) {
    const l = lot(lid); if (!l) return { success: false, message: 'That lot is gone.' };
    const rsv = reserved(l); if (rsv) return { success: false, message: rsv };
    if (l.unlockQuarter > GameState.totalQuartersElapsed()) return { success: false, message: 'That lot is not for sale yet.' };
    if (D().list.some(d => d.kind === 'lot' && d.lid === lid && open(d))) return { success: false, message: 'You already bid.' };
    if (D().list.filter(d => open(d)).length >= MAX_OPEN) return { success: false, message: 'Three deals at once is enough. Wait for an answer first.' };
    price = f1(price);
    if (price < l.cost * LAND * 0.6) return { success: false, message: 'Too low to be taken seriously.' };
    if (spendable() < price) return { success: false, message: 'You could not pay ' + money(price) + ' (cash plus credit line: ' + money(spendable()) + ').' };
    const d = { id: 'deal:' + (++D().seq), kind: 'lot', lid, name: l.name, price, q: tq(), stage: 'out' };
    D().list.push(d); note('Bid ' + money(price) + ' for ' + l.name + '.');
    if (window.Telemetry) Telemetry.used('land');
    let msg = 'Bid sealed: ' + money(price) + ' for ' + l.name + '. The auction closes next quarter.';
    if (agentKey && window.Agents) { const r = Agents.assign(d.id, agentKey); msg += ' ' + r.message; }
    return { success: true, message: msg, deal: d };
  }
  function resolveLot(d, out) {
    const l = lot(d.lid); if (!l) { d.stage = 'lost'; d.result = 'The lot was withdrawn.'; return; }
    const s = window.Agents ? Agents.strength(d.id) : 0, r = lotRivalRange(l), cut = 1 - s * 0.15;
    const rival = rnd() < r.p && window.Rivals && Rivals.live().length ? Rivals.wantsWho({ sector: l.zone, location: tierOf(l) }) : null;
    const theirs = rival ? f1((r.lo + rnd() * (r.hi - r.lo)) * cut) : 0;
    if (window.Agents) Agents.release(d.id);
    if (rival && theirs >= d.price) {
      d.stage = 'lost'; d.result = OWN(rival).short + ' won ' + l.name + ' with ' + money(theirs) + '.';
      GameState.devLots = GameState.devLots.filter(x => x !== l);
      (D().rivalLots = D().rivalLots || []).push({ lot: l, k: rival, at: tq() + 6 + Math.floor(rnd() * 3) });
      out.push({ good: false, text: 'Auction lost: ' + d.result + ' Your bid was ' + money(d.price) + '.' });
      say('Riverton Land Auctions', 'Auctioneer', 'Outbid for ' + l.name, OWN(rival).name + ' won ' + l.name + ' with ' + money(theirs) + '. Your sealed bid was ' + money(d.price) + '.' +
          '<div class="sml-note">They will build on it. Expect a new ' + OWN(rival).short + ' building there in about two years.</div>', ownerFace(rival));
      note(d.result); return;
    }
    if (spendable() < d.price) { d.stage = 'lost'; d.result = 'You won, but could not pay. The lot goes back on the market next year.'; l.unlockQuarter = tq() + 4; return; }
    d.stage = 'won'; d.paid = d.price;
    const dev = landToYou(l, d.price);
    d.result = 'You won ' + l.name + ' for ' + money(d.price) + (rival ? ' (' + OWN(rival).short + ' bid ' + money(theirs) + ')' : ' (no other bids)') + '.';
    out.push({ good: true, text: 'Auction won: ' + d.result });
    // round 24: a land purchase is news, not just a line in the cash
    const P = lotPlan(l, 'standard');
    say('Riverton Land Auctions', 'Auctioneer', 'You won ' + l.name, 'Congratulations: ' + l.name + ' is yours for ' + money(d.price) + (rival ? '. ' + OWN(rival).short + ' bid ' + money(theirs) + '.' : '. Nobody bid against you.') +
        '<table class="dv-nums"><tr><td>Paid</td><td>' + money(d.price) + ' (on your books as land)</td></tr><tr><td>Zoned for</td><td>' + l.zone + '</td></tr>' +
        '<tr><td>A standard building</td><td>' + money(P.build) + ' over ' + P.q + ' quarters, worth about ' + money(P.value) + ' when let</td></tr></table>' +
        '<div class="sml-note">Next: choose what to build (a card in your inbox, or the Dealroom). Land earns nothing until it is built.</div>', '');
    note(d.result);
    if (!S().due) { S().due = 'dev_plan'; S().devId = dev.id; dev.asked = true; }
  }
  /* The land becomes a building site on your books, worth what you paid. */
  function landToYou(l, price) {
    const M = { id: 'dev_' + l.id, n: l.name.replace(/ Lot$/, '') + ' (site)', t: l.zone, ti: tierOf(l), z: l.z || LOT_Z[l.id], o: 'you', x: l.x, y: l.y, v: price, cap: 0.01, occ: 0, ph: l.photo, noi: 0.01,
                story: 'Vacant land you bought at auction. Zoned for ' + l.zone + '.' };
    const p = Properties.fromMaster(M, true);
    Object.assign(p, { purchasePrice: price, currentValue: price, baseValue: price, underConstruction: true, constructionType: 'land', constructionQuartersLeft: 999,
                       occupancy: 0, annualNOI: 0, askingPrice: null, quarterOwned: 0, capexReserve: 0, vb: null, devId: null });
    GameState.balance.cash = fmt(GameState.balance.cash - price);
    GameState.portfolio.push(p);
    GameState.devLots = GameState.devLots.filter(x => x !== l);
    const dev = { id: 'dev:' + (++D().seq), pid: p.id, lot: Object.assign({}, l), name: l.name.replace(/ Lot$/, ''), land: price, stage: 'land', q: tq() };
    p.devId = dev.id; D().devs.push(dev);
    return dev;
  }
  const devP = dev => (GameState.portfolio || []).find(p => p.id === dev.pid) || null;

  function startBuild(devId, size) {
    const dev = D().devs.find(x => x.id === devId); if (!dev || dev.stage !== 'land') return { success: false, message: 'Nothing to build.' };
    const P = lotPlan(dev.lot, size), p = devP(dev); if (!p) return { success: false, message: 'The site is gone.' };
    Object.assign(dev, { stage: 'build', size, build: P.build, qTotal: P.q, qLeft: P.q, spent: 0, extra: 0, yoc: P.yoc, plan: P, startQ: tq() });
    p.constructionType = 'development'; p.name = dev.name;
    remember('chen', 1, 'you are building ' + dev.name);
    if (window.Telemetry) Telemetry.used('build');
    if ((GameState.ratios.debtToAssets || 0) > 0.45) remember('okafor', -0.5, 'building with borrowed money');
    note('Started building ' + dev.name + ' (' + P.label.toLowerCase() + ', ' + money(P.total) + ' all in).');
    return { success: true, message: 'Work starts on ' + dev.name + ': ' + money(P.build) + ' over ' + P.q + ' quarters, paid as you go. Chen is delighted. Okafor has questions.' };
  }

  function devQuarter(out) {
    D().devs.forEach(dev => {
      const p = devP(dev);
      if (!p) { if (dev.stage !== 'done' && dev.stage !== 'sold') { dev.stage = 'sold'; if (window.Agents) Agents.release(dev.id); } return; }
      if (dev.stage === 'build') {
        const draw = fmt(dev.build / dev.qTotal + (dev.extra || 0) / Math.max(1, dev.qLeft));
        if (dev.extra) dev.extra = fmt(dev.extra - dev.extra / Math.max(1, dev.qLeft));
        GameState.balance.cash = fmt(GameState.balance.cash - draw);
        if (window.Financials && Financials.noteSpend) Financials.noteSpend('projects', draw);   // round 28
        dev.spent = fmt(dev.spent + draw); p.currentValue = fmt(p.currentValue + draw); p.baseValue = p.currentValue; p.purchasePrice = p.currentValue;
        dev.qLeft--;
        if (!dev.halfway && dev.qLeft <= Math.floor(dev.qTotal / 2)) halfway(dev, p, out);
        if (dev.qLeft <= 0) openBuilding(dev, p, out);
      } else if (dev.stage === 'lease') leaseUp(dev, p, out);
    });
  }
  function halfway(dev, p, out) {
    dev.halfway = true;
    const s = window.Agents ? Agents.strength(dev.id) : 0, ops = window.Staff && Staff.hasRole && Staff.hasRole('operations') ? 0.7 : 1;
    if (rnd() < 0.25 * (1 - s) * ops) {
      const extra = f1(dev.build * (0.08 + rnd() * 0.10) * (1 - s * 0.5));
      dev.extra = fmt((dev.extra || 0) + extra); dev.overrun = extra;
      out.push({ good: false, text: dev.name + ': the contractor found rock under the car park. Cost overrun ' + money(extra) + ', spread over the remaining build.' });
      note('Overrun ' + money(extra) + ' at ' + dev.name + '.');
    }
    if (!S().due && rnd() < 0.6) { S().due = 'dev_prelet'; S().devId = dev.id; }
  }
  const STEP = { expanding: 0.12, stable: 0.10, contracting: 0.06, recession: 0.035 };
  function openBuilding(dev, p, out) {
    const P = dev.plan, cost = fmt(dev.land + dev.spent), noiEff = fmt((dev.land + dev.build) * dev.yoc / 100 * (dev.prelet ? 0.95 : 1));
    const occ = dev.prelet ? 0.45 : 0.20, full = fmt(noiEff / 0.92);
    p.underConstruction = false; p.constructionType = null; p.constructionQuartersLeft = 0;
    p.annualNOI = full; p.occupancy = occ; p.quarterOwned = 0; p.age = 0; p.renovated = true; p.renovatedYear = GameState.meta.year;
    p.lease = P.sector === 'multifamily' ? { type: 'residential', units: Math.round(cost * 4), mgmt: 'inhouse', positions: [] }
                                         : { type: 'multi', count: P.sector === 'industrial' ? 3 : 8, anchor: !!dev.prelet, positions: [] };
    p.story = 'Built by you on the ' + dev.lot.name + ', opened Y' + yq(tq()) + '.';
    Object.assign(dev, { stage: 'lease', cost, openQ: tq(), full });
    devValue(dev, p);
    out.push({ good: true, text: dev.name + ' is open: ' + pc(occ) + ' let' + (dev.prelet ? ' (the anchor moved in)' : '') + '. It cost ' + money(cost) + '; fully let it should be worth about ' + money(stabValue(dev)) + '.' });
    say('Jenkins', 'Chief of Staff', dev.name + ' is open', 'Ribbon cut, champagne warm. ' + dev.name + ' opened ' + pc(occ) + ' let. It fills up over the next quarters, faster in a good economy' + (window.Staff && Staff.hasRole('asset') ? ' and with your Asset Manager on it' : '') + '. Cost ' + money(cost) + '; fully let at today’s yields it is worth about ' + money(stabValue(dev)) + '.', 'assets/faces/jenkins.jpg');
    note(dev.name + ' opened, cost ' + money(cost) + '.');
  }
  const stabValue = dev => { const p = devP(dev); return p ? f1(p.annualNOI * 0.92 / (capNow(p.sector, p.location) / 100)) : 0; };
  function devValue(dev, p) {
    p.currentValue = f1(stabValue(dev) * (0.80 + 0.20 * Math.min(1, p.occupancy / 0.92)));
    p.baseValue = p.currentValue; p.vb = null;
  }
  function leaseUp(dev, p, out) {
    const s = window.Agents ? Agents.strength(dev.id) : 0, am = window.Staff && Staff.hasRole && Staff.hasRole('asset') ? 0.02 : 0;
    p.occupancy = Math.min(0.93, fmt(Math.max(p.occupancy, p.occupancy + (STEP[cyc()] || 0.1) * (1 + s) + am)));
    devValue(dev, p);
    if (p.occupancy >= 0.90 || tq() - dev.openQ >= 10) {
      dev.stage = 'done'; dev.value = p.currentValue; if (window.Agents) Agents.release(dev.id);
      const gain = f1(p.currentValue - dev.cost);
      out.push({ good: gain >= 0, text: dev.name + ' is ' + pc(p.occupancy) + ' let. Worth ' + money(p.currentValue) + ' against ' + money(dev.cost) + ' of cost: ' + (gain >= 0 ? '+' : '−') + money(gain) + '.' });
      remember('chen', gain > 0 ? 1 : -0.5, gain > 0 ? dev.name + ' made money' : dev.name + ' cost more than it is worth');
      remember('hassan', 0.5, dev.name + ' is let');
      note(dev.name + ' finished: ' + (gain >= 0 ? '+' : '−') + money(gain) + ' on cost.');
    }
  }
  /* A lot a rival won: some quarters later a new building appears, theirs. */
  function rivalBuilds(out) {
    const L = D().rivalLots || [];
    L.filter(x => !x.done && tq() >= x.at).forEach(x => {
      x.done = true; if (!rivalLive(x.k)) return;
      const l = x.lot, tier = tierOf(l), cap = capNow(l.zone, tier), v = f1(l.cost * 1.1);
      const M = { id: 'rdev_' + l.id, n: l.name.replace(/ Lot$/, '') + ' ' + ({ office: 'Tower', retail: 'Commons', industrial: 'Logistics Park', multifamily: 'Residences' }[l.zone] || 'House'),
                  t: l.zone, ti: tier, z: l.z || LOT_Z[l.id], o: x.k, x: l.x, y: l.y, v, cap, occ: 88, ph: l.photo, noi: fmt(v * cap / 100) };
      const p = Properties.fromMaster(M, false); p.owner = x.k; p.askingPrice = null;
      GameState.cityRivals.push(p); if (window.Rivals) Rivals.onAcquire(x.k, p, v);
      out.push({ good: null, text: OWN(x.k).short + ' opened ' + p.name + ' on the old ' + l.name + '.' });
    });
  }

  /* -- the inbox cards --------------------------------------------------------------- */
  const cur = () => D().list.find(d => d.id === S().dealId) || null;
  const curDev = () => D().devs.find(d => d.id === S().devId) || null;
  const CARDS = [
    { id: 'deal_counter', system: true, story: true, holdQ: 0,
      build() {
        const d = cur(); if (!d || d.stage !== 'counter') return null;
        const w = where(d.pid); if (!w) { d.stage = 'lost'; return null; }
        return { title: 'A counter-offer for ' + d.name, from: ownerLabel(w.p, d.owner), face: ownerFace(d.owner),
          body: '"Close, but not quite. Meet us at ' + money(d.counter) + ' and it is yours."' +
                nums([['You offered', money(d.price)], ['They want', money(d.counter) + ' (' + pc(d.counter / w.p.currentValue - 1) + ' over value)'], ['Value', money(w.p.currentValue)],
                      ['Rent', money(w.p.annualNOI * w.p.occupancy) + ' a year (' + (w.p.annualNOI * w.p.occupancy / d.counter * 100).toFixed(1) + '% on their price)'], ['Fees', money(fee(d.counter))]]),
          choices: [
            { label: 'Accept ' + money(d.counter), detail: 'The building is yours now.', check: () => spendable() >= d.counter + fee(d.counter), checkMsg: 'Not enough cash and credit line',
              apply() { return close(d, d.counter); } },
            { label: 'Walk away', detail: 'No more offers for this building for 2 quarters.',
              apply() { d.stage = 'lost'; d.result = 'You walked away from ' + money(d.counter) + '.'; D().cool[d.pid] = tq() + 2; if (window.Agents) Agents.release(d.id); note(d.result); return 'You walked. They will remember the number.'; } },
          ] };
      } },
    { id: 'deal_rival', system: true, story: true, holdQ: 0,
      build() {
        const d = cur(); if (!d || d.stage !== 'rival') return null;
        const w = where(d.pid); if (!w) { d.stage = 'lost'; return null; }
        const match = f1(d.rivalBid * 1.02);
        return { title: 'A bidding war for ' + d.name, from: ownerLabel(w.p, d.owner), face: window.Rivals ? (Rivals.STYLE[d.rival] || {}).face : '',
          body: '"We accepted your ' + money(d.price) + '. Then ' + OWN(d.rival).name + ' called with ' + money(d.rivalBid) + '. Your move."' +
                nums([['Your offer', money(d.price)], [OWN(d.rival).short + '’s bid', money(d.rivalBid)], ['To win', money(match) + ' (' + pc(match / w.p.currentValue - 1) + ' over value)']]) +
                '<div class="sml-note">A broker with exclusivity (Duncan Pryce) keeps rivals out of your deals.</div>',
          choices: [
            { label: 'Raise to ' + money(match), detail: 'You win it.', check: () => spendable() >= match + fee(match), checkMsg: 'Not enough cash and credit line',
              apply() { return close(d, match); } },
            { label: 'Let ' + OWN(d.rival).short + ' have it', detail: 'It becomes theirs.',
              apply() { d.stage = 'lost'; d.result = OWN(d.rival).short + ' bought it for ' + money(d.rivalBid) + '.'; if (window.Agents) Agents.release(d.id);
                        if (window.World && World.toRival) World.toRival(w.p, d.rival, d.rivalBid); note(d.result); return d.result; } },
          ] };
      } },
    { id: 'deal_pitch', system: true, story: true, holdQ: 0,
      build() {
        const x = D().pitch, w = x && where(x.id); if (!x || !w) return null;
        const am = window.Staff && Staff.getStaff('acquisitions');
        return { title: 'Off-market: ' + w.p.name, from: am ? am.name : 'Your Acquisitions Lead', face: am && am.portrait ? 'assets/staff/' + am.portrait : '',
          body: '"' + privOwner(w.p)[0] + ' will sell to us before it goes on the market. One call, no auction."' +
                nums([['Price', money(x.price) + ' (value ' + money(w.p.currentValue) + ')'], ['Rent', money(w.p.annualNOI * w.p.occupancy) + ' a year (' + (w.p.annualNOI * w.p.occupancy / x.price * 100).toFixed(1) + '%)'], ['Occupancy', pc(w.p.occupancy)]]),
          choices: [
            { label: 'Buy it: ' + money(x.price), detail: 'No bidding war, no wait.', check: () => spendable() >= x.price + fee(x.price), checkMsg: 'Not enough cash and credit line',
              apply() { D().pitch = null; const m = World.buyAt(w.p, x.price); note('Bought ' + w.p.name + ' off-market.'); return m; } },
            { label: 'Pass', detail: 'It stays private.', apply() { D().pitch = null; return 'Passed.'; } },
          ] };
      } },
    { id: 'dev_plan', system: true, story: true, holdQ: 0,
      build() {
        const dev = curDev(); if (!dev || dev.stage !== 'land') return null;
        const sz = ['small', 'standard', 'large'].map(k => lotPlan(dev.lot, k));
        return { title: 'What do we build on ' + dev.lot.name + '?', from: has('chen') ? Directors.name('chen') : 'Jenkins', face: 'assets/faces/' + (has('chen') ? 'chen' : 'jenkins') + '.jpg',
          body: 'The land is ours. Zoned for ' + dev.lot.zone + '. Rent is fixed by today’s yields: a new building earns about 1.5 points more than the market pays for one, which is the whole point of building.' +
                nums(sz.map(P => [P.label + ' (' + P.q + ' qtrs)', money(P.build) + ' to build, rent ' + money(P.noi) + ' a year when let (' + P.yoc.toFixed(1) + '% on cost), worth about ' + money(P.value) + ': +' + money(P.gain)])) +
                '<div class="sml-note">Paid quarter by quarter (cash, then the credit line). If yields rise before it opens, the gain shrinks. ' + (has('okafor') ? 'Okafor: "Every quarter it is a hole in the ground, it earns nothing."' : '') + '</div>',
          choices: sz.map(P => ({ label: 'Build ' + P.label.toLowerCase() + ': ' + money(P.build), detail: P.q + ' quarters. Worth about ' + money(P.value) + ' at today’s yields.',
                                  apply() { return startBuild(dev.id, P.size).message; } }))
            .concat([{ label: 'Hold the land for now', detail: 'Start later from the Dealroom. Land earns nothing.', apply() { return 'The land waits. A fence goes up, and a sign: "Coming soon".'; } }]) };
      } },
    { id: 'dev_prelet', system: true, story: true, holdQ: 0,
      build() {
        const dev = curDev(); if (!dev || dev.stage !== 'build' || dev.prelet != null) return null;
        const who = { office: 'Calloway & Finch, the law firm', retail: 'FreshWay, the grocer', industrial: 'Northline Parcel', multifamily: 'Riverton University (student housing)' }[dev.plan.sector] || 'An anchor tenant';
        return { title: dev.name + ': an anchor wants in', from: who, face: '',
          body: '"We will take 40% of the building before it opens, if you give us 10% off the rent." Fewer empty floors on day one, a little less rent forever.' +
                nums([['With the anchor', 'opens 45% let, rent 5% lower overall'], ['Without', 'opens 20% let, full rent, fills as the economy allows (' + cyc() + ' now)']]),
          choices: [
            { label: 'Sign the anchor', detail: 'Safer. Hassan +0.5.', apply() { dev.prelet = true; remember('hassan', 0.5, 'you pre-let ' + dev.name); note('Anchor signed at ' + dev.name + '.'); return 'Signed. The banner goes up: "' + who.split(',')[0] + ' is coming".'; } },
            { label: 'Hold out for full rent', detail: 'More rent if the market holds. Chen +0.5.', apply() { dev.prelet = false; remember('chen', 0.5, 'you held out for full rent'); return 'Full rent or nothing.'; } },
          ] };
      } },
  ];
  if (window.World && World.DECISIONS) CARDS.forEach(c => { if (!World.DECISIONS.some(d => d.id === c.id)) World.DECISIONS.push(c); });

  /* -- for agents.js: what each deal case is -------------------------------------------- */
  function caseInfo(id) {
    const d = D().list.find(x => x.id === id);
    if (d) return d.kind === 'lot'
      ? { title: 'Bid: ' + d.name, cat: 'lot', face: '', active: () => d.stage === 'out', effect: s => 'Rival bids about ' + Math.round(s * 15) + '% lower.' }
      : { title: 'Offer: ' + d.name, cat: 'deal', face: '', active: () => open(d), effect: s => 'The seller’s price about ' + (s * 10).toFixed(1) + '% of value lower.' };
    const v = D().devs.find(x => x.id === id);
    if (v) return { title: 'Site: ' + v.name, cat: 'dev', face: '', active: () => ['land', 'build', 'lease'].indexOf(v.stage) > -1,
                    effect: s => 'Overrun risk ' + pc(1 - s) + ' of normal, a smaller overrun, and leasing ' + Math.round(s * 100) + '% faster.' };
    if (/^cat:/.test(id)) { const cat = id.slice(4); return { title: Agents.CAT[cat] || cat, cat, face: '', active: () => true,
      effect: s => cat === 'lot' ? 'Rival bids about ' + Math.round(s * 15) + '% lower.' : 'The seller’s price about ' + (s * 10).toFixed(1) + '% of value lower.' }; }
    return null;
  }

  /* -- the windows: an offer, a lot ----------------------------------------------------- */
  function agentSelect(cat) {
    if (!window.Agents) return '';
    const L = Agents.people('cat:' + cat).filter(p => !p.why);
    if (!L.length) return '<div class="sml-note">Nobody free to put on it.</div>';
    return '<label class="sml-note">Put someone on it: <select id="dl-ag"><option value="">Nobody</option>' +
      L.map(p => '<option value="' + p.key + '" data-s="' + p.s + '">' + esc(p.name) + ' (' + esc(p.role) + ', ' + esc(p.costText) + ')</option>').join('') + '</select></label>';
  }
  const agS = () => { const el = document.getElementById('dl-ag'); const o = el && el.selectedOptions[0]; return o && o.value ? +o.dataset.s : 0; };
  const agK = () => { const el = document.getElementById('dl-ag'); return el ? el.value : ''; };
  const done = r => { if (window.UI) { UI.showToast(r.message, r.success ? 'success' : 'error'); UI.renderAll(); } };

  function openOffer(id) {
    const w = where(id); if (!w || !window.UI) return;
    const why = blocked(id), p = w.p, owner = w.owner;
    const head = nums([['Owner', esc(ownerLabel(p, owner))], ['Value', money(p.currentValue)], p.listedByOwner && p.askingPrice ? ['Asking', money(p.askingPrice)] : null,
                       ['Rent if fully let', money(p.annualNOI) + ' a year'], ['Occupancy', pc(p.occupancy)]].filter(Boolean));
    // round 37: the same two yields as the tables, on YOUR price (stabilised rent; rent collected now, costs 28% of gross rent)
    const stab = window.Properties && Properties.stabRent ? Properties.stabRent(p) : p.annualNOI, now = p.underConstruction ? 0 : p.annualNOI * Math.max(0, p.occupancy - 0.28) / 0.70;
    const yields = x => 'Cap rate on your price <b>' + (stab / x * 100).toFixed(1) + '%</b> · yield today <b>' + (now / x * 100).toFixed(1) + '%</b> (you borrow at about ' + (window.Market ? Market.getCurrentBorrowingRate().toFixed(1) : '?') + '%)';
    if (why) { UI.showModal('Make an offer: ' + p.name, head + '<div class="dp-lead">' + esc(why) + '</div>', owner !== 'none' && window.Rivals ? [{ label: OWN(owner).short + '’s profile', onClick: () => setTimeout(() => Rivals.openProfile(owner), 0) }] : []); return; }
    const q0 = quote(id, 0), am = window.Staff && Staff.getStaff && Staff.getStaff('acquisitions');
    const tip = am ? '<b>' + esc(am.name) + '</b> (Acquisitions Lead): "They would take about ' + money(q0.rb) + ', give or take 5%."'
                   : (owner === 'none' ? 'Private owners usually want 4 to 14% over value.' : 'Rival REITs want 15 to 25% over value, less when they are short of money or in a crisis.') + ' An Acquisitions Lead would tell you their number, and get it lower.';
    const start = Math.round(Math.min(1.4, 1 + Math.max(0, q0.m)) * 100);
    UI.showModal('Make an offer: ' + p.name,
      head + '<div class="dp-lead">' + tip + '</div><div class="sml-note">What moves their price: ' + esc(q0.why.join('; ')) + '.</div>' +
      '<div class="dl-offer"><div class="big" id="dl-px"></div><input type="range" id="dl-r" min="85" max="140" value="' + start + '" style="width:100%"><div id="dl-odds" class="sml-note"></div></div>' +
      agentSelect('deal'), [{ label: 'Send the offer', style: 'btn-primary', onClick: () => { const x = f1(p.currentValue * document.getElementById('dl-r').value / 100); done(offer(id, x, agK())); } }]
        .concat(owner !== 'none' && window.Rivals ? [{ label: OWN(owner).short + '’s profile', onClick: () => setTimeout(() => Rivals.openProfile(owner), 0) }] : []));
    const upd = () => {
      const x = f1(p.currentValue * document.getElementById('dl-r').value / 100), rb = quote(id, agS()).rb, o = odds(x, rb);
      document.getElementById('dl-px').textContent = money(x) + ' (' + (x / p.currentValue * 100 - 100 >= 0 ? '+' : '') + Math.round(x / p.currentValue * 100 - 100) + '% vs value)';
      document.getElementById('dl-odds').innerHTML = yields(x) + '<br>They say <b>yes ' + pc(o.yes) + '</b> · counter ' + pc(o.counter) + ' · no ' + pc(o.no) + '. With fees ' + money(x + fee(x)) + '.' + (owner === 'none' && !(agK() === 'x_pryce') ? ' A rival may bid too (1 in 5).' : '') +
        (spendable() < x + fee(x) ? ' <b style="color:#c2410c">More than your cash plus credit line.</b>' : '');
    };
    document.getElementById('dl-r').oninput = upd; const ag = document.getElementById('dl-ag'); if (ag) ag.onchange = upd; upd();
  }

  function openLot(lid) {
    const l = lot(lid); if (!l || !window.UI) return;
    const rsv = reserved(l), P = lotPlan(l, 'standard'), guide = f1(l.cost * LAND);
    const head = nums([['Zoned for', l.zone + ', ' + ({ tier1: 'downtown', tier2: 'midtown', suburban: 'suburban' }[P.tier])], ['Guide price for the land', money(guide)],
                       ['A standard building', money(P.build) + ' over ' + P.q + ' quarters'], ['Rent when let', money(P.noi) + ' a year (' + P.yoc.toFixed(1) + '% on cost; the market pays ' + P.cap.toFixed(1) + '%)'],
                       ['Worth when let', 'about ' + money(P.value) + ': +' + money(P.gain) + ' on ' + money(P.total)]]);
    if (rsv) { UI.showModal(l.name, head + '<div class="dp-lead">🔒 ' + esc(rsv) + '</div>', []); return; }
    if (D().list.some(d => d.kind === 'lot' && d.lid === lid && open(d))) { UI.showModal(l.name, head + '<div class="dp-lead">Your bid is in. The auction closes next quarter.</div>', []); return; }
    UI.showModal('Bid for ' + l.name, head + '<div class="dp-lead">Sealed bids, one round. The highest bid wins and pays what it bid. Small (' + money(lotPlan(l, 'small').build) + ') and large (' + money(lotPlan(l, 'large').build) + ') buildings are possible too; you choose after you win.</div>' +
      '<div class="dl-offer"><div class="big" id="dl-px"></div><input type="range" id="dl-r" min="70" max="170" value="105" style="width:100%"><div id="dl-odds" class="sml-note"></div></div>' + agentSelect('lot'),
      [{ label: 'Place the bid', style: 'btn-primary', onClick: () => done(bid(lid, f1(guide * document.getElementById('dl-r').value / 100), agK())) }]);
    const upd = () => {
      const x = f1(guide * document.getElementById('dl-r').value / 100);
      document.getElementById('dl-px').textContent = money(x) + ' (' + Math.round(x / guide * 100) + '% of guide)';
      document.getElementById('dl-odds').innerHTML = 'Chance you win: <b>' + pc(lotOdds(l, x, agS())) + '</b>. ' + (cyc() === 'recession' ? 'In a recession, fewer rivals bid.' : 'About ' + pc(lotRivalRange(l).p) + ' a rival bids too.') +
        (spendable() < x ? ' <b style="color:#c2410c">More than your cash plus credit line.</b>' : '');
    };
    document.getElementById('dl-r').oninput = upd; const ag = document.getElementById('dl-ag'); if (ag) ag.onchange = upd; upd();
  }
  function openPlan(devId) {
    const dev = D().devs.find(x => x.id === devId); if (!dev || dev.stage !== 'land' || !window.UI) return;
    const sz = ['small', 'standard', 'large'].map(k => lotPlan(dev.lot, k));
    UI.showModal('Build on ' + dev.lot.name, nums(sz.map(P => [P.label + ' (' + P.q + ' qtrs)', money(P.build) + ' to build, rent ' + money(P.noi) + ' (' + P.yoc.toFixed(1) + '% on cost), worth about ' + money(P.value)])),
      sz.map(P => ({ label: 'Build ' + P.label.toLowerCase() + ': ' + money(P.build), style: P.size === 'standard' ? 'btn-primary' : 'btn-secondary', onClick: () => done(startBuild(dev.id, P.size)) })));
  }

  /* -- for the Dealroom ------------------------------------------------------------------- */
  function rows() {
    const out = [];
    D().list.filter(open).forEach(d => {
      const w = d.kind === 'offer' ? where(d.pid) : null, l = d.kind === 'lot' ? lot(d.lid) : null;
      out.push({ id: d.id, kind: d.kind, title: d.kind === 'lot' ? 'Bid for ' + d.name : 'Offer for ' + d.name,
        now: d.kind === 'lot' ? 'Your sealed bid: ' + money(d.price) + (l ? ' (guide ' + money(l.cost * LAND) + ')' : '') + '. The auction closes at the end of this quarter.'
           : money(d.price) + ' to ' + (w ? ownerLabel(w.p, d.owner) : 'the owner') + (w ? ' (value ' + money(w.p.currentValue) + ')' : '') + '. ' +
             (d.stage === 'counter' ? 'They countered at ' + money(d.counter) + ': answer in your inbox.' : d.stage === 'rival' ? 'A rival bid too: answer in your inbox.' : 'The answer comes at the end of this quarter.'),
        canWithdraw: d.stage === 'out' });
    });
    D().devs.filter(v => ['land', 'build', 'lease'].indexOf(v.stage) > -1).forEach(v => {
      const p = devP(v);
      out.push({ id: v.id, kind: 'dev', title: v.name, canPlan: v.stage === 'land',
        now: v.stage === 'land' ? 'Land, bought for ' + money(v.land) + '. Nothing built yet.'
           : v.stage === 'build' ? 'Building (' + v.plan.label.toLowerCase() + '): ' + v.qLeft + ' quarter' + (v.qLeft === 1 ? '' : 's') + ' left, ' + money(v.spent) + ' of ' + money(v.build + (v.overrun || 0)) + ' spent.' + (v.overrun ? ' Overrun ' + money(v.overrun) + '.' : '') + (v.prelet ? ' Anchor signed.' : '')
           : 'Leasing up: ' + (p ? pc(p.occupancy) : '') + ' let, worth ' + (p ? money(p.currentValue) : '') + ' against ' + money(v.cost) + ' of cost.' });
    });
    (GameState.portfolio || []).filter(p => p.listing).forEach(p => out.push({ id: p.id, kind: 'listing', title: 'Selling ' + p.name,
      now: 'Listed at ' + money(p.listing.ask) + ' (value ' + money(p.currentValue) + '). About ' + Math.round(Sales.offerOdds(p) * 100) + '% chance of an offer each quarter.' }));
    return out;
  }
  const recent = () => D().list.filter(d => ['won', 'lost'].indexOf(d.stage) > -1).slice(-5).reverse();

  return { offer, withdraw, bid, startBuild, processQuarter, quote, odds, markup, blocked, reserved, lotPlan, lotOdds, openOffer, openLot, openPlan,
           caseInfo, rows, recent, D, where, privOwner, ownerLabel, LAND, SIZES, stabValue };
})();
