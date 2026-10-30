// ============================================================
// tenants.js — WHO PAYS THE RENT, AND WHETHER THEY KEEP PAYING
// REIT SIM 2.0  ·  design doc B.4
// ============================================================
// The data lives in tenants_master.js. This module makes it move:
//   - each tenant's RENT COVERAGE (EBITDAR / rent) drifts every quarter
//   - below 1.0x a tenant is Distressed; well below, it can default
//   - leases count down, then renew or leave
//   - vacant space is re-let after some quarters of downtime
//
// ONE TENANT, MANY BUILDINGS. A tenant is a single entity in
// GameState.tenants. If Harlow Grocers fails, it leaves every centre it
// anchors at once — including the ones owned by rivals. That is what makes
// concentration a portfolio-level risk rather than a building-level one.
//
// RULES FOR EDITING THIS FILE:
// - Tuning numbers live in K below and nowhere else.
// - Single-tenant occupancy is ONLY ever 1 or 0. Nothing else may nudge it.
// - Rent is never stored per tenant: it is building NOI x share.
// - Every change that touches the player's buildings returns a news line with
//   a named tenant and a number (the B.11 rule: no line without a number).
// ============================================================

window.Tenants = (() => {

  const K = {
    /* Coverage = a slow-moving BASE (the tenant's underlying health, pushed by
       its trend) plus cycle and noise shocks that REVERT toward that base.
       The first version was a pure random walk: every recession knocked
       tenants down and nothing pulled them back, so 14 of the 40 original
       tenants failed in an average run. Real tenant credit recovers when the
       economy does; only the trend is persistent. */
    baseDrift:       0.012,  // base change per quarter per unit of trend
    reversion:       0.18,   // share of the gap to base closed each quarter
    noise:           0.035,  // +/- random wobble per quarter
    cycle: { expanding: 0.012, stable: 0, contracting: -0.02, recession: -0.045 },
    sectorBeta: { retail: 1.3, office: 1.1, industrial: 0.8, multifamily: 0.7, other: 1.0 },
    trendFlipPerYear: 0.22,  // chance per year a tenant's trend changes
    covMin: 0.3, covMax: 5.0,
    watch: 1.5, distressed: 1.0,
    // default hazard per quarter: small below 1.0x, steep below 0.8x
    defaultHazard(c) { return c >= 1.0 ? 0 : c >= 0.8 ? 0.015 : Math.min(0.4, 0.04 + (0.8 - c) * 0.6); },
    // renewal odds by coverage band
    renewOdds(c) { return c == null ? 0.9 : c >= 2.5 ? 0.85 : c >= 1.5 ? 0.72 : c >= 1.0 ? 0.5 : 0.25; },
    reletQuarters: { expanding: [2, 4], stable: [3, 5], contracting: [4, 7], recession: [5, 9] },
    newLeaseYears: [4, 9],
  };

  const rnd  = () => Math.random();
  const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const fmt  = n => Math.round(n * 100) / 100;
  const TM   = () => window.TENANTS_MASTER;

  // Every building object in the city, whoever owns it.
  const allBuildings = () =>
    (GameState.portfolio || []).concat(GameState.propertyMarket || [], GameState.cityRivals || []);
  const isMine = p => (GameState.portfolio || []).indexOf(p) !== -1;

  const credit = c => (TM() ? TM().creditLabel(c) : "");

  // ----------------------------------------------------------
  // INIT — called from Properties.init() after buildings exist
  // ----------------------------------------------------------
  function init() {
    const T = TM();
    GameState.tenants = {};
    if (!T) return;
    Object.entries(T.TENANTS).forEach(([id, t]) => {
      GameState.tenants[id] = {
        id, name: t.name, industry: t.industry, story: t.story,
        coverage: t.coverage, base: t.coverage, trend: t.trend, esc: t.esc, steady: !!t.steady,
        status: "active", history: [],
      };
    });

    allBuildings().forEach(p => attachLease(p));
    GameState._tenantNewCount = 0;
  }

  /* Copy the building's lease from the master list onto the building object,
     so it travels with the building when it is bought or sold. Years become
     quarters. */
  function attachLease(p) {
    const l = TM() && TM().LEASES[p.id];
    if (!l) return;
    if (l.type === "single") {
      p.lease = { type: "single", positions: [{ t: l.tenant, share: 1, q: l.years * 4 }] };
      p.occupancy = 1;                                   // fully let, by definition
    } else if (l.type === "multi") {
      p.lease = { type: "multi", count: l.count, anchor: !!l.anchor,
                  positions: l.majors.map(m => ({ t: m.t, share: m.share, q: m.years * 4 })) };
    } else {
      p.lease = { type: "residential", units: l.units, mgmt: l.mgmt,
                  positions: l.mgmt === "operator" ? [{ t: l.operator, share: 1, q: l.years * 4 }] : [] };
      if (l.mgmt === "operator") p.occupancy = 1;        // fixed rent: fully let from our side
    }
  }

  /* Single-tenant and operator-leased buildings do not drift. */
  function isLocked(p) {
    return p.lease && (p.lease.type === "single" ||
           (p.lease.type === "residential" && p.lease.mgmt === "operator"));
  }

  // ----------------------------------------------------------
  // THE QUARTER
  // ----------------------------------------------------------
  function processQuarter() {
    const lines = [];
    const cycle = (GameState.market && GameState.market.cycle) || "stable";
    // round 37: a tenant signed on incentives pays 25%, 50%, 75%, then full rent
    const nowQ = (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
    allBuildings().forEach(p => { if (!p.rampQ) return; const f = Math.min(1, 0.25 * (nowQ - p.rampQ + 1));
      if (f >= 1) { p.rentFactor = null; delete p.rampQ; } else p.rentFactor = f; });
    const yearTurn = GameState.meta && GameState.meta.quarter === 1;

    // 1. coverage moves
    Object.values(GameState.tenants || {}).forEach(t => {
      if (t.status !== "active" || t.coverage == null) return;
      // round 16: a steady tenant (Atlas Cold Chain) only wobbles a little around its base, whatever the economy
      if (t.steady) { t.trend = 0; t.coverage = fmt(Math.max(2.6, Math.min(3.8, (t.base || 3.2) + (rnd() * 2 - 1) * 0.12))); t.history.push(t.coverage); if (t.history.length > 20) t.history.shift(); return; }
      const beta = K.sectorBeta[sectorOf(t.id)] || 1;
      const before = t.coverage;
      if (t.base == null) t.base = t.coverage;
      t.base = Math.max(K.covMin, Math.min(K.covMax, t.base + t.trend * K.baseDrift));
      t.coverage = fmt(Math.max(K.covMin, Math.min(K.covMax,
        t.coverage + (t.base - t.coverage) * K.reversion
                   + (K.cycle[cycle] || 0) * beta
                   + (window.Arc && Arc.tenantShock ? Arc.tenantShock(sectorOf(t.id)) : 0)
                   + (rnd() * 2 - 1) * K.noise)));
      if (yearTurn && rnd() < K.trendFlipPerYear) {
        // declining tenants more often stabilise than recover outright
        t.trend = t.trend < 0 ? (rnd() < 0.7 ? 0 : 1) : t.trend > 0 ? (rnd() < 0.6 ? 0 : -1) : (rnd() < 0.5 ? -1 : 1);
      }
      // crossing a threshold is news — but only if they are in your buildings
      const mineHere = buildingsOf(t.id).filter(isMine);
      if (mineHere.length) {
        const pct = shareOfMyRent(t.id);
        if (before >= K.distressed && t.coverage < K.distressed)
          lines.push(bad(`${t.name} slipped below 1.0x rent coverage (${t.coverage}x) — it is now paying you from savings. ${pct}% of your rent.`));
        else if (before >= K.watch && t.coverage < K.watch)
          lines.push(bad(`${t.name}'s rent coverage fell to ${t.coverage}x — on Watch. ${pct}% of your rent.`));
        else if (before < K.distressed && t.coverage >= K.distressed)
          lines.push(good(`${t.name} recovered to ${t.coverage}x rent coverage.`));
      }
      t.history.push(t.coverage);
      if (t.history.length > 20) t.history.shift();
    });

    // 2. defaults
    Object.values(GameState.tenants || {}).forEach(t => {
      if (t.status !== "active" || t.coverage == null) return;
      if (window.Story && Story.protects && Story.protects(t.id)) return;   // its story decides (story.js)
      if (rnd() < K.defaultHazard(t.coverage)) {
        const hit = defaultTenant(t);
        if (hit) lines.push(hit);
      }
    });

    // 3. leases count down; expiries renew or leave; vacancies re-let
    allBuildings().forEach(p => {
      if (!p.lease) return;
      p.lease.positions.forEach(pos => {
        if (pos.vacant) {
          if (--pos.relet <= 0) {
            const line = relet(p, pos);
            if (line && isMine(p)) lines.push(line);
          }
          return;
        }
        pos.q -= 1;
        if (pos.q === 4 && isMine(p)) {
          const t = GameState.tenants[pos.t];
          if (t) lines.push(neutral(`${t.name}'s lease at ${p.name} expires in a year — ${fmt(p.annualNOI * pos.share)}M/yr of rent up for renewal.`));
        }
        if (pos.q <= 0) {
          const line = expire(p, pos);
          if (line && isMine(p)) lines.push(line);
        }
      });
      p.lease.positions = p.lease.positions.filter(pos => !pos.drop);
    });

    return lines;
  }

  // ----------------------------------------------------------
  // EVENTS ON A LEASE POSITION
  // ----------------------------------------------------------
  function vacate(p, pos) {
    pos.vacant = true;
    const [a, b] = K.reletQuarters[(GameState.market && GameState.market.cycle) || "stable"] || [3, 5];
    pos.relet = rint(a, b) + (p.location === "suburban" ? 1 : 0);
    if (p.lease.type === "single" || (p.lease.type === "residential" && p.lease.mgmt === "operator"))
      p.occupancy = 0;
    else
      p.occupancy = fmt(Math.max(0.2, p.occupancy - pos.share));
  }

  function defaultTenant(t) {
    t.status = "failed";
    t.coverage = 0;
    let myRent = 0;
    const where = [];
    buildingsOf(t.id).forEach(p => {
      p.lease.positions.forEach(pos => {
        if (pos.t !== t.id || pos.vacant) return;
        if (isMine(p)) { myRent += p.annualNOI * pos.share; where.push(p.name); }
        vacate(p, pos);
        // an anchor going dark lets in-line tenants walk (co-tenancy)
        if (p.lease.type === "multi" && p.lease.anchor && p.lease.positions[0] === pos)
          p.occupancy = fmt(Math.max(0.2, p.occupancy - 0.08));
      });
    });
    GameState._defaults = (GameState._defaults || 0) + 1;
    if (!where.length) return null;           // rivals' problem, not yours (yet)
    return bad(`${t.name} filed for bankruptcy. It vacated ${where.join(" and ")} — ${fmt(myRent)}M/yr of your rent gone.`);
  }

  function expire(p, pos) {
    const t = GameState.tenants[pos.t];
    let odds = K.renewOdds(t ? t.coverage : 1.5);
    const cycle = GameState.market && GameState.market.cycle;
    if (cycle === "recession") odds -= 0.1;
    if (cycle === "expanding") odds += 0.05;
    if (t && t.status === "active" && rnd() < odds) {
      pos.q = rint(K.newLeaseYears[0], K.newLeaseYears[1]) * 4;
      return good(`${t.name} renewed at ${p.name} for ${pos.q / 4} more years.`);
    }
    const rent = fmt(p.annualNOI * pos.share);
    vacate(p, pos);
    return bad(`${t ? t.name : "A tenant"} did not renew at ${p.name} — ${rent}M/yr of rent goes dark while you re-let.`);
  }

  /* Vacant space finds a new occupier. Single-tenant buildings get a new
     NAMED tenant; multi-tenant space folds into "other tenants". */
  function relet(p, pos) {
    pos.vacant = false;
    const years = rint(K.newLeaseYears[0], K.newLeaseYears[1]);
    if (p.lease.type === "single" || (p.lease.type === "residential" && p.lease.mgmt === "operator")) {
      const t = newTenant(p);
      pos.t = t.id; pos.q = years * 4;
      p.occupancy = 1;
      if (pos.incent) {                                   // round 37: signed on incentives (offerIncentives)
        const pct = pos.incent.pct; delete pos.incent;
        p.annualNOI = fmt(p.annualNOI * pct); p.rentFactor = 0.25; p.rampQ = (GameState.meta.year - 1) * 4 + GameState.meta.quarter;   // 25% now, 50%, 75%, full
        return good(`${p.name} re-let to ${t.name} on a ${years}-year lease at ${Math.round(pct * 100)}% of the old rent, with stepped rent: 25%, 50%, 75%, then full.`);
      }
      return good(`${p.name} re-let to ${t.name} (${t.industry}) on a ${years}-year lease, ${t.coverage}x coverage.`);
    }
    p.occupancy = fmt(Math.min(0.99, p.occupancy + pos.share));
    pos.drop = true;                                    // becomes part of "others"
    return good(`New tenants took the empty space at ${p.name} — occupancy back to ${Math.round(p.occupancy * 100)}%.`);
  }

  const NAMES = {
    industrial: { a: ["Lakeside", "Prairie", "Northgate", "Riverbend", "Ashford", "Keystone", "Granite"],
                  b: ["Tool & Die", "Fabrication", "Supply Co.", "Distribution", "Components", "Packaging"] },
    office:     { a: ["Meridian", "Harbour", "Crestview", "Oakline", "Summit", "Delta"],
                  b: ["Advisory", "Health Group", "Consulting", "Services", "Partners"] },
    multifamily:{ a: ["Riverstone", "Hearth", "Parkside", "Cornerstone"],
                  b: ["Living LLC", "Residential Partners", "Communities"] },
  };
  function newTenant(p) {
    const n = NAMES[p.sector] || NAMES.industrial;
    const id = "new_" + (++GameState._tenantNewCount);
    const name = n.a[rint(0, n.a.length - 1)] + " " + n.b[rint(0, n.b.length - 1)];
    const t = { id, name, industry: p.sector === "multifamily" ? "Apartment operator" : "Local business",
                story: "Took the space after the previous tenant left.",
                coverage: fmt(1.6 + rnd() * 1.4), trend: 0, esc: 0.02, status: "active", history: [] };
    t.base = t.coverage;
    GameState.tenants[id] = t;
    return t;
  }

  // ----------------------------------------------------------
  // QUERIES — used by the UI, the situation module and decisions
  // ----------------------------------------------------------
  function buildingsOf(tid) {
    return allBuildings().filter(p => p.lease && p.lease.positions.some(pos => pos.t === tid && !pos.vacant));
  }

  function sectorOf(tid) {
    const b = buildingsOf(tid)[0];
    return b ? b.sector : "other";
  }

  /* % of the player's full-occupancy rent that this tenant pays. */
  function shareOfMyRent(tid) {
    const mine = GameState.portfolio || [];
    const total = mine.reduce((a, p) => a + (p.annualNOI || 0), 0) || 1;
    let r = 0;
    mine.forEach(p => (p.lease ? p.lease.positions : []).forEach(pos => {
      if (pos.t === tid && !pos.vacant) r += p.annualNOI * pos.share;
    }));
    return Math.round(r / total * 1000) / 10;
  }

  /* The player's tenants, biggest first — the "Top Tenants" disclosure. */
  function myTopTenants() {
    const seen = {};
    (GameState.portfolio || []).forEach(p => (p.lease ? p.lease.positions : []).forEach(pos => {
      if (!pos.vacant && GameState.tenants[pos.t]) seen[pos.t] = true;
    }));
    return Object.keys(seen)
      .map(id => Object.assign({}, GameState.tenants[id], { pct: shareOfMyRent(id), label: credit(GameState.tenants[id].coverage) }))
      .sort((a, b) => b.pct - a.pct);
  }

  /* The player's weakest active tenant — used by the tenant-support-loan decision. */
  function myWeakest() {
    // a tenant whose story is running (story.js) is not available to random events
    const t = myTopTenants().filter(t => t.coverage != null && !(window.Story && Story.protects && Story.protects(t.id))).sort((a, b) => a.coverage - b.coverage)[0];
    return t || null;
  }

  /* Rows for a building's tenant panel. */
  function rowsFor(p) {
    if (!p || !p.lease) return [];
    return p.lease.positions.map(pos => {
      const t = GameState.tenants[pos.t] || {};
      return { id: pos.t, name: pos.vacant ? "Vacant" : t.name, industry: t.industry, vacant: !!pos.vacant,
               share: pos.share, rent: fmt(p.annualNOI * pos.share), years: Math.max(0, Math.round(pos.q / 4 * 10) / 10),
               relet: pos.relet, coverage: t.coverage, trend: t.trend, label: credit(t.coverage), story: t.story };
    });
  }

  function countLabel(p) {
    if (!p || !p.lease) return "";
    if (p.lease.type === "single") return "1 tenant";
    if (p.lease.type === "residential") return p.lease.units + " units" + (p.lease.mgmt === "operator" ? " · operator lease" : "");
    return p.lease.count + " tenants";
  }

  /* A single-tenant (or operator) building loses its occupier, without that
     tenant going bankrupt everywhere — e.g. it relocates to another state. */
  function leave(p) {
    if (!p || !p.lease) return 0;
    const pos = p.lease.positions.find(x => !x.vacant);
    if (!pos) return 0;
    const rent = fmt(p.annualNOI * pos.share);
    vacate(p, pos);
    return rent;
  }

  /* A tenant pays to leave one building early (world.js "tenant_buyout"). */
  function release(p, tid) {
    const pos = p && p.lease && p.lease.positions.find(x => x.t === tid && !x.vacant);
    if (!pos) return 0;
    const rent = fmt(p.annualNOI * pos.share);
    vacate(p, pos);
    return rent;
  }

  /* Force a tenant into default — used by decisions ("refuse the loan"). */
  function forceDefault(tid) {
    const t = GameState.tenants[tid];
    return t && t.status === "active" ? defaultTenant(t) : null;
  }

  /* Single-tenant and operator-leased buildings are 100% or 0%, nothing in
     between. Old v1 code paths (events, the Asset Manager's drift, lease-up)
     can still nudge occupancy; this puts them back. Runs every quarter before
     the P&L (financials.js) and after any player action that touches occupancy. */
  function normalize() {
    allBuildings().forEach(p => {
      if (!p.lease || !isLocked(p) || p.underConstruction) return;
      const pos = p.lease.positions[0];
      p.occupancy = pos && !pos.vacant ? 1 : 0;
    });
  }

  const good    = text => ({ good: true,  text });
  const bad     = text => ({ good: false, text });
  const neutral = text => ({ good: null,  text });

  /* round 37: an empty single-tenant building, actively marketed with incentives (needs an Asset Manager):
     a tenant signs next quarter at 90% of the old rent (100% if renovated), stepping up over 4 quarters.
     The broker's fee is a quarter's rent, counted in AFFO like a lease up. */
  function canIncent(p) {
    if (!p || !p.lease || !isLocked(p) || p.underConstruction) return { ok: false, why: 'Only for empty single-tenant buildings' };
    const pos = p.lease.positions[0];
    if (!pos || !pos.vacant) return { ok: false, why: 'Already let' };
    if (pos.relet >= 900) return { ok: false, why: 'A story is handling this building' };
    if (pos.incent || pos.relet <= 1) return { ok: false, why: 'A tenant is already signing' };
    if (!(typeof Staff !== 'undefined' && Staff.hasRole && Staff.hasRole('asset'))) return { ok: false, why: 'Needs an Asset Manager (Staff screen)' };
    return { ok: true, fee: fmt(p.annualNOI / 4), pct: p.renovated ? 1.0 : 0.9 };
  }
  function offerIncentives(p) {
    const c = canIncent(p); if (!c.ok) return { success: false, message: c.why };
    const pos = p.lease.positions[0]; pos.relet = 1; pos.incent = { pct: c.pct };
    GameState.balance.cash = fmt(GameState.balance.cash - c.fee);
    if (typeof Financials !== 'undefined' && Financials.noteSpend) Financials.noteSpend('leasing', c.fee);
    return { success: true, message: p.name + ': the brokers have a tenant. They sign next quarter at ' + Math.round(c.pct * 100) + '% of the old rent, stepping up over a year. Broker\u2019s fee $' + c.fee.toFixed(1) + 'M.' };
  }
  return { canIncent, offerIncentives, K, init, attachLease, isLocked, processQuarter, buildingsOf, shareOfMyRent,
           myTopTenants, myWeakest, rowsFor, countLabel, forceDefault, leave, release, normalize };
})();
