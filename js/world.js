// ============================================================
// world.js — THE WORLD ACTING ON YOU
// REIT SIM 2.0  ·  replaces the v1 events.js / decisions.js selection logic
// ============================================================
// WHAT WAS WRONG IN v1 (measured, not guessed — see tools/sim_events.js)
//   - 23 decision popups per run, but only 10 decision types existed, and TWO
//     of them were 49% of everything the player ever saw.
//   - Cause: every decision had its own eligibility gate, then first-eligible
//     won the single slot. Permissive events (zoning) were eligible nearly
//     every quarter and monopolised it; strict events (a tenant actually
//     failing) almost never got a turn. Shuffling the check order did not help,
//     because shuffling first-eligible-wins is still first-eligible-wins.
//   - The 23 "random" events never popped up at all. They were appended as
//     text to the quarter report, so the half of the world carrying the most
//     texture was something you scrolled past.
//   - Benign events fired unthrottled while harmful ones were rationed, giving
//     a measured benign:harmful ratio of 1.81 : 1. The world was twice as
//     generous as it was dangerous.
//
// THE TWO LAYERS
//   BACKGROUND — frequent, small, never blocking. Always attached to a NAMED
//     property with a NUMBER. This is the texture: buildings lose a tenant,
//     rents tick up, a road opens. Shown in the quarter card, not a modal.
//   DECISIONS — at most ONE PER YEAR, blocking, a genuine choice. Drawn from a
//     SHUFFLED DECK WITHOUT REPLACEMENT, so across a 15-year run you see 15
//     DIFFERENT decisions, and a different 15 next run.
//
// THE DECK IS THE WHOLE FIX. Independent probability rolls always let the
// likeliest option dominate. A deck cannot: once a card is drawn it is gone.
//
// RULES FOR EDITING THIS FILE:
// - Content lives in CATALOGUE arrays. Selection logic never mentions a
//   specific event by id.
// - Every decision declares validIn (situation states) so nothing offers you
//   an acquisition while you are insolvent.
// - Every background event must name a property and carry a number.
// ============================================================

window.World = (() => {

  const rnd   = () => Math.random();
  const pick  = a => a[Math.floor(rnd() * a.length)];
  const fmt   = n => Math.round(n * 100) / 100;
  const money = n => "$" + fmt(n) + "M";
  const S     = () => (window.Situation ? Situation.get() : { state: "stable", isBad: false });

  // ==========================================================================
  // LAYER 1 — BACKGROUND
  // Small, frequent, always about a specific building. No popup, no choice.
  // Each returns a line for the quarter card, or null if it cannot apply.
  // ==========================================================================

  // story buildings (story.js, e.g. Harlow's centre) are scripted: random events leave them alone
  const mine = () => (GameState.portfolio || []).filter(p => !p.underConstruction && !p.storyLock);
  const bySector = s => mine().filter(p => p.sector === s);

  /* Buildings whose occupancy can drift. Single-tenant and operator-leased
     buildings are 100% or 0% — small nudges make no sense for them. */
  const drifting = () => mine().filter(p => !(window.Tenants && Tenants.isLocked(p)));

  function nudgeOcc(p, delta) {
    if (window.Tenants && Tenants.isLocked(p)) {
      // a big enough blow means the single occupier leaves outright
      if (delta <= -0.1) { Tenants.leave(p); return -100; }
      return 0;
    }
    const before = p.occupancy;
    p.occupancy = Math.max(0.35, Math.min(0.99, fmt(p.occupancy + delta)));
    return Math.round((p.occupancy - before) * 1000) / 10;   // percentage points
  }
  function nudgeNOI(p, pctChange) {
    const before = p.annualNOI;
    p.annualNOI = fmt(p.annualNOI * (1 + pctChange));
    return fmt(p.annualNOI - before);
  }

  const BACKGROUND = [
    {
      id: "lease_signed", good: true, weight: 10,
      when: () => drifting().some(p => p.occupancy < 0.95),
      fire() {
        const p = pick(drifting().filter(x => x.occupancy < 0.95));
        const pp = nudgeOcc(p, 0.02 + rnd() * 0.04);
        return { good: true, text: `${p.name} signed a new tenant — occupancy +${pp}pp to ${Math.round(p.occupancy*100)}%.` };
      }
    },
    {
      id: "tenant_left", good: false, weight: 10,
      when: () => drifting().some(p => p.occupancy > 0.55),
      fire() {
        const p = pick(drifting().filter(x => x.occupancy > 0.55));
        const pp = nudgeOcc(p, -(0.02 + rnd() * 0.05));
        return { good: false, text: `A tenant at ${p.name} did not renew — occupancy ${pp}pp to ${Math.round(p.occupancy*100)}%.` };
      }
    },
    {
      id: "rent_escalation", good: true, weight: 7,
      when: () => mine().length > 0,
      fire() {
        const p = pick(mine());
        const d = nudgeNOI(p, 0.02 + rnd() * 0.02);
        return { good: true, text: `Contractual rent escalations at ${p.name} — NOI +${money(d)}/yr.` };
      }
    },
    {
      id: "opex_creep", good: false, weight: 7,
      when: () => mine().length > 0,
      fire() {
        const p = pick(mine());
        const d = nudgeNOI(p, -(0.015 + rnd() * 0.025));
        return { good: false, text: `Insurance and utilities repriced at ${p.name} — NOI ${money(d)}/yr.` };
      }
    },
    {
      id: "capex_surprise", good: false, weight: 5,
      when: () => mine().length > 0,
      fire() {
        const p = pick(mine());
        const cost = fmt(p.currentValue * (0.004 + rnd() * 0.008));
        GameState.balance.cash = fmt(GameState.balance.cash - cost);
        const what = pick(["a roof replacement", "a failed chiller", "elevator modernisation", "a parking deck repair"]);
        return { good: false, text: `Unplanned ${what} at ${p.name} — ${money(cost)} out of cash.` };
      }
    },
    {
      id: "submarket_improves", good: true, weight: 4,
      when: () => mine().length > 1,
      fire() {
        const p = pick(mine());
        const d = nudgeNOI(p, 0.03 + rnd() * 0.03);
        const why = pick(["a new transit stop opened nearby", "the district got streetscape money",
                          "a large employer moved in down the road"]);
        return { good: true, text: `Near ${p.name}, ${why} — NOI +${money(d)}/yr.` };
      }
    },
    {
      id: "submarket_decays", good: false, weight: 4,
      when: () => drifting().length > 1,
      fire() {
        const p = pick(drifting());
        const pp = nudgeOcc(p, -(0.015 + rnd() * 0.03));
        const why = pick(["a nearby block went vacant", "the neighbourhood lost its grocery anchor",
                          "reported break-ins rose sharply"]);
        return { good: false, text: `Around ${p.name}, ${why} — occupancy ${pp}pp.` };
      }
    },
    {
      id: "flight_to_quality", good: false, weight: 5,
      when: () => drifting().some(p => p.sector === "office" && p.location !== "tier1"),
      fire() {
        const p = pick(drifting().filter(x => x.sector === "office" && x.location !== "tier1"));
        const pp = nudgeOcc(p, -(0.02 + rnd() * 0.04));
        return { good: false, text: `Tenants at ${p.name} traded up to newer space downtown — occupancy ${pp}pp. Commodity office keeps losing to Class A.` };
      }
    },
    {
      id: "logistics_demand", good: true, weight: 5,
      when: () => bySector("industrial").length > 0,
      fire() {
        const p = pick(bySector("industrial"));
        const d = nudgeNOI(p, 0.03 + rnd() * 0.04);
        return { good: true, text: `Distribution demand pushed asking rents at ${p.name} — NOI +${money(d)}/yr.` };
      }
    },
    {
      id: "apartment_turnover", good: false, weight: 4,
      when: () => bySector("multifamily").length > 0,
      fire() {
        const p = pick(bySector("multifamily"));
        const cost = fmt(p.currentValue * 0.003);
        GameState.balance.cash = fmt(GameState.balance.cash - cost);
        return { good: false, text: `Heavy unit turnover at ${p.name} — ${money(cost)} of make-ready costs.` };
      }
    },
  ];

  // How many background lines per quarter, and how the balance tilts.
  // v1 measured 1.81 benign per harmful. A world that hands out nearly twice as
  // much good news as bad cannot feel dangerous. Below, the tilt follows the
  // CYCLE instead of being a constant.
  function badOdds() {
    const c = GameState.market ? GameState.market.cycle : "stable";
    return { expanding: 0.38, stable: 0.50, contracting: 0.62, recession: 0.72 }[c] || 0.5;
  }

  function rollBackground() {
    const out = consequences();
    const n = 1 + (rnd() < 0.55 ? 1 : 0) + (rnd() < 0.2 ? 1 : 0);   // 1-3 per quarter
    const usedIds = {};
    for (let i = 0; i < n; i++) {
      const wantBad = rnd() < badOdds();
      const pool = BACKGROUND.filter(e =>
        e.good !== wantBad && !usedIds[e.id] && (!e.when || e.when()));
      if (!pool.length) continue;
      // weighted draw
      const total = pool.reduce((a, e) => a + e.weight, 0);
      let r = rnd() * total, chosen = pool[0];
      for (const e of pool) { r -= e.weight; if (r <= 0) { chosen = e; break; } }
      const res = chosen.fire();
      if (res) { usedIds[chosen.id] = true; out.push(res); }
    }
    return out;
  }

  // ==========================================================================
  // LAYER 2 — DECISIONS
  // At most one per year. Shuffled deck, no replacement.
  // ==========================================================================

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function ensureDeck() {
    if (!GameState._deck || !GameState._deck.length) {
      GameState._deck = shuffle(DECISIONS.filter(d => !d.system).map(d => d.id));
      GameState._deckRecycled = (GameState._deckRecycled || 0) + 1;
    }
    return GameState._deck;
  }

  /* ONE per year, and only from Y2 (Y1 is orientation). We walk the deck from
     the top and take the first card that FITS the current situation; anything
     that does not fit stays in the deck for later rather than being burned. */
  function checkDecision() {
    const G = GameState;
    if (G.meta.year < 2) return null;
    if (G._lastDecisionYear === G.meta.year) return null;      // one per year, hard
    // land it somewhere in the year rather than always Q1
    const q = G.meta.quarter;
    const odds = { 1: 0.22, 2: 0.3, 3: 0.4, 4: 1.0 }[q];        // guaranteed by Q4
    if (rnd() > odds) return null;

    const deck = ensureDeck();
    for (let i = 0; i < deck.length; i++) {
      const d = DECISIONS.find(x => x.id === deck[i]);
      if (!d) { deck.splice(i, 1); i--; continue; }
      if (d.validIn && d.validIn.indexOf(S().state) === -1) continue;
      if (d.when && !d.when()) continue;
      deck.splice(i, 1);                                        // drawn — gone
      G._lastDecisionYear = G.meta.year;
      const built = d.build();
      if (!built) return null;
      built.id = d.id;
      /* ui.js already knows how to render a decision: it wants .headline and
         .choices[].label/.detail. Emit that shape rather than teaching the UI
         a second one. */
      built.headline = built.title;
      built.isWorld = true;
      return built;
    }
    return null;
  }

  // -- helpers the catalogue uses -------------------------------------------
  const worst = () => mine().slice().sort((a, b) => a.occupancy - b.occupancy)[0];
  const best  = () => mine().slice().sort((a, b) => b.currentValue - a.currentValue)[0];
  const anyMine = () => mine().length ? pick(mine()) : null;
  function cash(d) { GameState.balance.cash = fmt(GameState.balance.cash + d); }
  function pc(d)   { const b = GameState.board;
                     b.politicalCapital = Math.max(0, Math.min(b.maxCapital, b.politicalCapital + d)); }
  function attitude(id, d) { GameState._attCause = GameState._attCause || {};
                             if (GameState._decisionCtx) GameState._attCause[id] = GameState._decisionCtx;
                             const x = (GameState.board.directors || []).find(v => v.id === id);
                             if (x) x.attitude = Math.max(0, Math.min(10, x.attitude + d)); }
  /* One-off cash items. Decisions are answered DURING the turn, and runQuarter
     zeroes unusualItems when it starts, so an in-turn charge must be held
     until then (financials.js picks up _pendingUnusual). v1 wrote straight
     to pnl.unusualItems and every such charge was silently erased.
     unusualNow() is for consequences that run inside the quarter itself. */
  function unusual(d)    { GameState._pendingUnusual = fmt((GameState._pendingUnusual || 0) + d); }
  function unusualNow(d) { GameState.pnl.unusualItems = fmt((GameState.pnl.unusualItems || 0) + d); }


  // -- helpers for deck 2 --------------------------------------------------
  // what the player can spend: cash plus the unused credit line (revolver.js)
  const spend = () => (window.Revolver && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash;
  const RIVALS = ["wex", "ren", "hal"];
  // faces shown with a decision in the inbox and the decision dialog
  const FACE = k => "assets/faces/" + k + ".jpg";
  const CEO_FACE = r => FACE("ceo_" + r);
  const OWNFULL = k => { const O = (window.PROPERTIES_MASTER && PROPERTIES_MASTER.OWNERS) || {}; return (O[k] && O[k].name) || "A rival"; };
  const staffFace = s => s && s.portrait ? "assets/staff/" + s.portrait : FACE("jenkins");
  const OWN = k => { const O = (window.PROPERTIES_MASTER && PROPERTIES_MASTER.OWNERS) || {}; return (O[k] && O[k].short) || "A rival"; };
  const arcPhase = () => (window.Arc && Arc.phase ? Arc.phase() : null);
  const priceToNav = () => { const n = GameState.ratios.navPerShare; return n > 0 ? GameState.company.sharePrice / n : 1; };
  const divYield = () => GameState.company.sharePrice > 0 ? GameState.company.dividendPerShare * 4 / GameState.company.sharePrice : 0;
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;

  /* A building for sale that the player could plausibly buy (deterministic,
     so when() and build() agree). */
  function inReach() {
    const c = GameState.balance.cash;
    return (GameState.propertyMarket || [])
      .filter(p => !p.underConstruction && (p.askingPrice || p.currentValue) >= 8 && (p.askingPrice || p.currentValue) <= c + 15)
      .sort((a, b) => (b.annualNOI / (b.askingPrice || b.currentValue)) - (a.annualNOI / (a.askingPrice || a.currentValue)))[0] || null;
  }
  /* Buy any building (market or rival) at a set price, through the normal
     purchase path so fees, news and the board's acquisition count all apply. */
  function buyAt(p, price) {
    const seller = p.owner && GameState.rivals && GameState.rivals[p.owner] ? p.owner : null;   // round 5: rivals get paid
    GameState.cityRivals = (GameState.cityRivals || []).filter(x => x !== p);
    if (GameState.propertyMarket.indexOf(p) === -1) GameState.propertyMarket.push(p);
    p.askingPrice = fmt(price); p.owner = null;
    const r = Properties.buyProperty(p.id);
    if (r.success) {
      GameState.board.acquisitionsThisYear = (GameState.board.acquisitionsThisYear || 0) + 1;
      if (seller && window.Rivals) Rivals.onDispose(seller, price);
    }
    return r.message;
  }
  function toRival(p, r, price) {
    const seller = p.owner && GameState.rivals && GameState.rivals[p.owner] ? p.owner : null;
    GameState.propertyMarket = GameState.propertyMarket.filter(x => x !== p);
    GameState.cityRivals = (GameState.cityRivals || []).filter(x => x !== p);
    p.owner = r; p.listedByOwner = false; p.askingPrice = null;
    GameState.cityRivals.push(p);
    if (window.Rivals && GameState.rivals) {                      // the money moves too
      const px = price || p.currentValue;
      if (seller) Rivals.onDispose(seller, px);
      Rivals.onAcquire(r, p, px);
    }
  }
  function rivalWith(n) {
    const c = {}; (GameState.cityRivals || []).forEach(p => { c[p.owner] = (c[p.owner] || 0) + 1; });
    const k = RIVALS.filter(r => (c[r] || 0) >= n).sort((a, b) => c[b] - c[a])[0];
    return k || null;
  }
  const starStaff = () => (GameState.staff || []).filter(s => s.skill >= 7 && (s.quartersEmployed || 0) >= 2)
                                                  .sort((a, b) => b.skill - a.skill)[0] || null;
  function skilled() {
    const g = id => window.Staff && Staff.getStaff ? Staff.getStaff(id) : null;
    return [g("cfo"), g("acquisitions")].filter(s => s && s.skill >= 6).sort((a, b) => b.skill - a.skill)[0] || null;
  }
  function shortOfCash() {
    const c = GameState.balance.cash;
    const due = (GameState.debtTranches || []).filter(t => ((t.maturityYear - 1) * 4 + t.maturityQuarter) - tq() <= 4)
                                              .reduce((a, t) => a + t.amount, 0);
    return c < 12 || due > c;
  }
  const jvTarget = () => mine().filter(p => !p.jv && p.currentValue >= 30).sort((a, b) => b.currentValue - a.currentValue)[0] || null;
  function buyoutCandidate() {
    let best = null;
    mine().forEach(p => {
      if (!p.lease || p.lease.type === "residential") return;
      p.lease.positions.forEach(pos => {
        const t = GameState.tenants && GameState.tenants[pos.t];
        if (pos.vacant || !t || t.status !== "active" || pos.q < 8 || (window.Story && Story.protects && Story.protects(t.id))) return;
        if (!best || pos.share > best.pos.share) best = { p, pos, t };
      });
    });
    return best;
  }

  /* Delayed consequences of deck-2 choices. Runs inside the quarter, first
     thing in rollBackground, so its lines land in that quarter's inbox. */
  function consequences() {
    const out = [], G = GameState;
    if (G._inIndex && divYield() < 0.045) {
      G._inIndex = false; G.company.sharePrice = fmt(G.company.sharePrice * 0.95);
      out.push({ good: false, text: "Removed from the Premium Yield REIT Index: your yield fell below 4.5% and index funds sold. Share price -5%." });
    }
    if (G._contam) {
      const p = mine().find(x => x.id === G._contam.id);
      if (!p) G._contam = null;
      else if (rnd() < 0.07) {
        const f = fmt(p.currentValue * 0.12); unusualNow(-f); G._contam = null;
        out.push({ good: false, text: `The regulator found the leaking tank at ${p.name}. Cleanup order and fine: ${money(f)}.` });
      }
    }
    if (G._deferRepay && G._deferRepay.left > 0) {
      unusualNow(G._deferRepay.per); G._deferRepay.left -= 1;
      out.push({ good: true, text: `Tenants repaid ${money(G._deferRepay.per)} of deferred rent.` });
      if (G._deferRepay.left <= 0) G._deferRepay = null;
    }
    if (G._gary && G._gary.since && G.meta.quarter === 4 && rnd() < 0.10) {
      G._gary.since = null;                                  // only once
      attitude("petrova", -2); attitude("hassan", -1); G.company.sharePrice = fmt(G.company.sharePrice * 0.97);
      out.push({ good: false, text: "An analyst found Gary's contract on page 212 of the proxy statement. Share price -3%. Petrova is asking about lake houses." });
    }
    return out;
  }

  // ==========================================================================
  // THE DECISION CATALOGUE
  // Grounded in what actually happens to REITs. Sources noted per entry.
  // ==========================================================================
  const DECISIONS = [

    // ---- TENANT CREDIT ----------------------------------------------------
    {
      id: "tenant_support_loan", system: true,     // round 7: replaced by story.js "the tenant who keeps borrowing"
      validIn: ["stable", "distress", "overheated", "crisis"],
      when: () => { const t = window.Tenants && Tenants.myWeakest(); return !!(t && t.coverage < 1.3); },
      build() {
        const t = Tenants.myWeakest();
        const rent = fmt((GameState.portfolio || []).reduce((a, p) =>
          a + (p.lease ? p.lease.positions.filter(x => x.t === t.id && !x.vacant)
                                     .reduce((b, x) => b + p.annualNOI * x.share, 0) : 0), 0));
        const loan = fmt(Math.max(1, rent * 1.5));
        return {
          title: `${t.name} asks you for a loan`,
          body: `<b>${t.name}</b> pays you <b>${money(rent)}/yr</b> — ${t.pct}% of your rent — and its rent coverage has fallen to <b>${t.coverage}x</b>. ` +
                `Its CFO says it cannot make the next payments without help and asks for <b>${money(loan)}</b> as a short-term facility.<br><br>` +
                `<i>This is the Medical Properties Trust sequence: lending to a tenant so it can keep paying you rent. It keeps the space let today, and puts a loan to a company that cannot pay onto your balance sheet.</i>`,
          choices: [
            { label: `Lend ${money(loan)}`,
              detail: "Rent keeps coming. You now hold their credit risk twice — as landlord and as lender.",
              apply() { cash(-loan);
                        const g = GameState.tenants[t.id];
                        if (g) { g.coverage = fmt(g.coverage + 0.45); g.base = Math.max(g.base || 0, g.coverage); g.trend = 0; }
                        GameState._tenantLoans = fmt((GameState._tenantLoans || 0) + loan);
                        return `Lent ${money(loan)}. ${t.name} is back to ${g ? g.coverage : "?"}x — for now.`; } },
            { label: "Refuse. Let them fail.",
              detail: "They default. You take the vacancy now and re-let clean.",
              apply() { const line = Tenants.forceDefault(t.id);
                        return line ? line.text : `${t.name} failed.`; } },
          ]
        };
      }
    },
    {
      id: "anchor_goes_dark",
      validIn: ["stable", "distress", "opportunity", "overheated"],
      when: () => bySector("retail").length > 0,
      build() {
        const p = pick(bySector("retail"));
        return {
          title: "Anchor bankruptcy triggers co-tenancy",
          body: `The anchor at <b>${p.name}</b> filed and is closing. Co-tenancy clauses in the in-line leases have triggered: those tenants may now <b>reset their rent to roughly half</b> for about a year, or walk.<br><br>` +
                `<i>Standard co-tenancy terms in US retail leases. This is why anchor loss is a cliff, not a slope.</i>`,
          choices: [
            { label: "Pay to backfill fast",
              detail: "Heavy tenant improvement money to land a replacement anchor this year.",
              apply() { const c = fmt(p.currentValue * 0.09); cash(-c); nudgeOcc(p, -0.08);
                        return `Spent ${money(c)} on TI and a broker. A replacement is signing — co-tenancy avoided.`; } },
            { label: "Let the rent resets run",
              detail: "No cash out. In-line rents halve for a year and some tenants leave.",
              apply() { const d = nudgeNOI(p, -0.35); const pp = nudgeOcc(p, -0.15);
                        return `Rents reset across the centre — NOI ${money(d)}/yr, occupancy ${pp}pp.`; } },
          ]
        };
      }
    },

    // ---- STRUCTURAL / SECTOR ---------------------------------------------
    {
      id: "wfh_structural",
      validIn: ["stable", "distress", "opportunity", "overheated"],
      when: () => bySector("office").length > 0,
      build() {
        const p = pick(bySector("office"));
        return {
          title: "Your office tenants want half the space",
          body: `Two tenants at <b>${p.name}</b> are up for renewal and both want to cut their footprint by roughly half. Office attendance has settled far below pre-pandemic levels and the whole market is repricing commodity space.<br><br>` +
                `<i>US office occupancy has been running around 54% of pre-pandemic levels, with vacancy near 19% — and a sharp split between Class A and everything below it.</i>`,
          choices: [
            { label: "Renew them small, keep the credit",
              detail: "Less rent, but the space stays occupied and the tenants stay solvent.",
              apply() { const d = nudgeNOI(p, -0.18); nudgeOcc(p, -0.04);
                        return `Renewed at reduced footprints — NOI ${money(d)}/yr, but no vacancy.`; } },
            { label: "Hold out for full-floor tenants",
              detail: "Refuse the downsizing. If nobody bites, the floors go dark.",
              apply() { if (rnd() < 0.35) { const d = nudgeNOI(p, 0.05);
                          return `A full-floor tenant appeared — NOI +${money(d)}/yr. The gamble paid.`; }
                        const pp = nudgeOcc(p, -0.22);
                        return `They left. ${p.name} occupancy ${pp}pp and the floors sit empty.`; } },
          ]
        };
      }
    },
    {
      id: "logistics_hub_arrives",
      validIn: ["stable", "opportunity", "overheated"],
      when: () => bySector("industrial").length > 0,
      build() {
        const p = pick(bySector("industrial"));
        return {
          title: "A national operator is building its own hub",
          body: `A major logistics company has bought land on the far side of Riverton and will build a one-million-square-foot automated facility. Your tenants at <b>${p.name}</b> will be able to lease newer, better-located space in about two years.<br><br>` +
                `<i>Purpose-built logistics supply is the single biggest driver of obsolescence in older industrial stock.</i>`,
          choices: [
            { label: "Lock your tenants in now on long leases",
              detail: "Give rent concessions today to secure term before the new supply lands.",
              apply() { const d = nudgeNOI(p, -0.10); GameState._lockedIn = true;
                        return `Signed early renewals at ${money(d)}/yr below market — but they cannot leave.`; } },
            { label: "Do nothing and ride the rents up first",
              detail: "Collect market rent now. Face the competition when it opens.",
              apply() { const d = nudgeNOI(p, 0.06);
                        GameState._pendingOversupply = { id: p.id, quarters: 8 };
                        return `NOI +${money(d)}/yr for now. The new facility opens in about two years.`; } },
          ]
        };
      }
    },
    {
      id: "state_tax_poaching",
      validIn: ["stable", "distress", "overheated"],
      when: () => bySector("office").length > 0 || bySector("industrial").length > 0,
      build() {
        const pool = bySector("office").concat(bySector("industrial"));
        const p = pick(pool);
        return {
          title: "A neighbouring state is buying your tenants",
          body: `A neighbouring state has announced relocation grants and a decade of property-tax abatement for employers who move. Two tenants at <b>${p.name}</b> have been approached directly.<br><br>` +
                `<i>Sun Belt states are projected to add roughly 11 million people over the next decade against about 475,000 everywhere else — incentive competition for employers is real and persistent.</i>`,
          choices: [
            { label: "Match it out of your own pocket",
              detail: "Fund an abatement equivalent yourself to keep them.",
              apply() { const c = fmt(p.annualNOI * 0.8); cash(-c);
                        return `Paid ${money(c)} to keep both tenants. They signed five more years.`; } },
            { label: "Lobby the city for a local abatement",
              detail: "Costs political capital, uncertain, but no cash.",
              apply() { pc(-2);
                        if (rnd() < 0.55) return `The city granted the abatement. Both tenants stayed.`;
                        const pp = nudgeOcc(p, -0.16);
                        return `The council declined. One tenant left — occupancy ${pp}pp.`; } },
            { label: "Let them go",
              detail: "Take the vacancy and re-lease at market.",
              apply() { const pp = nudgeOcc(p, -0.20);
                        return `Both relocated. ${p.name} occupancy ${pp}pp.`; } },
          ]
        };
      }
    },
    {
      id: "office_conversion_offer",
      validIn: ["stable", "distress", "opportunity"],
      when: () => bySector("office").some(p => p.occupancy < 0.75),
      build() {
        const p = pick(bySector("office").filter(x => x.occupancy < 0.75));
        const price = fmt(p.currentValue * 0.72);
        return {
          title: "A residential developer wants your empty tower",
          body: `A multifamily developer has offered <b>${money(price)}</b> for <b>${p.name}</b> — about 28% below your carrying value — to convert it to apartments. The city is offering conversion incentives.<br><br>` +
                `<i>Roughly 55,000 office-to-apartment conversions were planned in 2024, up 357% on 2021, as values fell far enough to make the maths work.</i>`,
          choices: [
            { label: `Sell at ${money(price)}`,
              detail: "Crystallise the loss, free the capital, remove the vacancy problem.",
              apply() { Properties.handOver(p, 'none');   // stays in the city
                        cash(price);
                        return `Sold ${p.name} for ${money(price)}. The loss is booked and the building is someone else's problem.`; } },
            { label: "Refuse. It will lease eventually.",
              detail: "Keep the asset and the vacancy.",
              apply() { attitude("chen", -1);
                        return `You held. Chen thinks you are anchoring on the price you paid.`; } },
          ]
        };
      }
    },

    // ---- CAPITAL / BALANCE SHEET -----------------------------------------
    {
      id: "sale_leaseback_offer",
      validIn: ["opportunity", "stable"],
      when: () => false,               // round 17: Harlow is the sale-and-leaseback story; this nameless one bolted onto an existing building
      build() {
        const size = fmt(28 + rnd() * 40);
        return {
          title: "A sale-leaseback portfolio comes to market",
          body: `An operator needs cash and will sell you <b>${money(size)}</b> of property and lease it straight back on a long term at an attractive yield. Their credit is weak — that is precisely why they are selling.<br><br>` +
                `<i>Sale-leaseback sellers are cash-hungry by definition, which is what makes the resulting tenant roster fragile.</i>`,
          choices: [
            { label: "Buy the portfolio",
              detail: "High going-in yield, one weak tenant across several buildings.",
              apply() { if (GameState.balance.cash < size) return "You could not fund it.";
                        cash(-size);
                        const p = anyMine();
                        if (p) { p.currentValue = fmt(p.currentValue + size); p.annualNOI = fmt(p.annualNOI + size * 0.092); }
                        GameState._weakTenantExposure = fmt((GameState._weakTenantExposure || 0) + size);
                        return `Acquired at a 9.2% going-in yield. Your exposure to one operator just grew by ${money(size)}.`; } },
            { label: "Pass",
              detail: "The yield is compensation for credit risk you would rather not hold.",
              apply() { attitude("okafor", 1); attitude("chen", -1);
                        return `You passed. Okafor approved; Chen did not.`; } },
          ]
        };
      }
    },
    {
      id: "refi_wall",
      validIn: ["distress", "crisis", "overheated"],
      when: () => (GameState.debtTranches || []).length > 0,
      build() {
        const t = (GameState.debtTranches || []).slice().sort((a,b) =>
          (a.quartersUntilMaturity||99) - (b.quartersUntilMaturity||99))[0];
        if (!t) return null;
        return {
          title: "Your lender will not roll the loan",
          body: `<b>${t.label}</b> matures soon and the bank has declined to extend on the current terms. They will refinance at a materially higher rate, or you find the money elsewhere.<br><br>` +
                `<i>Refinancing risk is the mechanism that actually kills leveraged REITs — not operations.</i>`,
          choices: [
            { label: "Accept the repricing",
              detail: "Roll it, at a punitive spread.",
              apply() { t.rate = fmt(t.rate + 2.2); t.quartersUntilMaturity = 12; t.maturityYear = GameState.meta.year + 3; t.maturityQuarter = GameState.meta.quarter;   // round 18: the date must move too, or it matures on the old one
                        return `Rolled at ${t.rate}% — ${money(t.amount * 0.022)}/yr of extra interest.`; } },
            { label: "Sell an asset to repay it",
              detail: "Forced seller, weak price, but the debt goes away.",
              apply() { const p = worst(); if (!p) return "Nothing to sell.";
                        const px = fmt(p.currentValue * 0.88);
                        Properties.handOver(p, 'none');   // stays in the city
                        cash(px);
                        return `Sold ${p.name} for ${money(px)} — 12% below carrying value. Everyone knew you had to sell.`; } },
          ]
        };
      }
    },
    {
      id: "defer_impairment",
      validIn: ["distress", "crisis"],
      when: () => mine().some(p => p.occupancy < 0.70),
      build() {
        const p = pick(mine().filter(x => x.occupancy < 0.70));
        const hit = fmt(p.currentValue * 0.18);
        return {
          title: "The auditors want a writedown",
          body: `The valuers say <b>${p.name}</b> should be marked down by <b>${money(hit)}</b>. Your CFO points out the impairment test allows judgement about recoverability, and a credible leasing plan would support holding the carrying value another year.<br><br>` +
                `<i>Impairment timing is genuine management judgement. Deferring is legal and defensible. Doing it repeatedly is a pattern analysts eventually price in.</i>`,
          choices: [
            { label: "Take the writedown now",
              detail: "Book the loss, clean the balance sheet, disappoint the board.",
              apply() { p.baseValue = fmt((p.baseValue || p.currentValue) - hit);
                        p.currentValue = fmt(p.currentValue - hit);
                        attitude("petrova", -1); attitude("okafor", 2);   // non-cash: value only
                        return `Marked ${p.name} down ${money(hit)}. Okafor respects it. The market will not.`; } },
            { label: "Defer it — the leasing plan supports recovery",
              detail: "Carrying value holds. Analyst suspicion accumulates.",
              apply() { GameState._deferrals = (GameState._deferrals || 0) + 1;
                        attitude("petrova", 1);
                        const n = GameState._deferrals;
                        return `Deferred. That is ${n} deferral${n>1?"s":""} now — Hartline has started asking about it.`; } },
          ]
        };
      }
    },

    // ---- OPPORTUNITY ------------------------------------------------------
    {
      id: "distressed_seller",
      validIn: ["opportunity"],
      build() {
        const size = fmt(20 + rnd() * 30);
        return {
          title: "A forced seller needs to close this quarter",
          body: `A private owner is facing his own maturity and will sell a building worth about <b>${money(size)}</b> at roughly <b>18% below</b> market — but the money has to be wired this quarter.<br><br>` +
                `<i>Buying from distressed sellers at wide cap rates is how REITs make their best returns. It requires liquidity precisely when everyone else is short of it.</i>`,
          choices: [
            { label: "Buy it",
              detail: "Requires the cash now.",
              apply() { const px = fmt(size * 0.82);
                        if (spend() < px) return "You did not have the money. The moment passed.";
                        cash(-px);
                        const p = anyMine();
                        if (p) { p.currentValue = fmt(p.currentValue + size); p.baseValue = fmt((p.baseValue||p.currentValue) + size);
                                 p.annualNOI = fmt(p.annualNOI + size * 0.085); }
                        attitude("chen", 2);
                        return `Bought ${money(size)} of property for ${money(px)}. Chen is delighted.`; } },
            { label: "Pass — stay liquid",
              detail: "Cash has option value when the cycle turns.",
              apply() { attitude("okafor", 1); attitude("chen", -2);
                        return `You passed. Chen is furious; Okafor is not.`; } },
          ]
        };
      }
    },
    {
      id: "data_centre_interest",
      validIn: ["opportunity", "stable"],
      when: () => bySector("industrial").length > 0,
      build() {
        const p = pick(bySector("industrial"));
        const premium = fmt(p.currentValue * 1.45);
        return {
          title: "A data-centre developer wants your site",
          body: `A hyperscale developer has identified <b>${p.name}</b> for its power capacity and fibre access. They will pay <b>${money(premium)}</b> — a 45% premium — but need vacant possession, which means terminating your tenant's lease early.<br><br>` +
                `<i>Data centres are the most aggressively bid property type in the market, and power access is the binding constraint.</i>`,
          choices: [
            { label: "Take the premium, buy out the lease",
              detail: "Pay the tenant to leave, then sell well above carrying value.",
              apply() { const buyout = fmt(p.annualNOI * 1.2);
                        Properties.handOver(p, 'none');   // stays in the city
                        cash(premium - buyout); attitude("petrova", 2);
                        return `Sold for ${money(premium)} less ${money(buyout)} of lease buyout. A clean gain.`; } },
            { label: "Keep the income",
              detail: "A reliable industrial tenant is worth more than a one-off gain.",
              apply() { return `You kept ${p.name}. The developer bought the site next door instead.`; } },
          ]
        };
      }
    },

    // ---- GOVERNANCE / REPUTATION -----------------------------------------
    {
      id: "short_report",
      validIn: ["distress", "crisis", "overheated"],
      build() {
        return {
          title: "A short seller has published on you", face: FACE("journalist"), from: "The financial press",
          body: `A research firm has published a report alleging your carrying values are stale and your tenant credit is weaker than disclosed. The stock is down sharply on the day and journalists are calling.<br><br>` +
                `<i>Short reports on REITs almost always attack the same two things: valuation judgement and tenant quality.</i>`,
          choices: [
            { label: "Rebut line by line, publicly",
              detail: "Costs political capital and management time. Usually works if the numbers hold.",
              apply() { pc(-2);
                        const clean = (GameState._deferrals || 0) < 2;
                        if (clean) { GameState.company.sharePrice = fmt(GameState.company.sharePrice * 1.04);
                                     return `Your disclosure held up. The report was picked apart and the stock recovered.`; }
                        GameState.company.sharePrice = fmt(GameState.company.sharePrice * 0.92);
                        return `The rebuttal drew attention to your deferred impairments. It went worse than saying nothing.`; } },
            { label: "Say nothing and keep operating",
              detail: "No engagement. The story runs its course either way.",
              apply() { GameState.company.sharePrice = fmt(GameState.company.sharePrice * 0.96);
                        attitude("petrova", -2);
                        return `No comment. The stock drifted lower and Petrova fielded the calls.`; } },
          ]
        };
      }
    },
    {
      id: "green_retrofit_mandate",
      validIn: ["stable", "opportunity", "overheated"],
      when: () => mine().length > 2,
      build() {
        const cost = fmt(mine().reduce((s, p) => s + p.currentValue, 0) * 0.02);
        return {
          title: "The city passes a building-emissions ordinance",
          body: `Buildings above a size threshold must meet emissions limits within four years or pay penalties. Compliance across your portfolio is estimated at <b>${money(cost)}</b>.<br><br>` +
                `<i>Local emissions ordinances now bind in several major US markets and are priced into institutional bids.</i>`,
          choices: [
            { label: "Retrofit now, in one programme",
              detail: "Expensive immediately, cheaper than doing it late, and tenants pay more for compliant space.",
              apply() { cash(-cost); mine().forEach(p => nudgeNOI(p, 0.02));
                        attitude("hassan", 2);
                        return `Spent ${money(cost)}. Rents firmed across the portfolio and Hassan is pleased.`; } },
            { label: "Do the minimum and pay penalties",
              detail: "Preserve cash now. A recurring drag later.",
              apply() { GameState._penaltyPerQuarter = fmt((GameState._penaltyPerQuarter || 0) + cost * 0.02);
                        return `Deferred. Penalties of about ${money(cost*0.02)}/quarter begin once the deadline passes.`; } },
          ]
        };
      }
    },

    // ======================================================================
    // DECK 2 (design doc B.1f). Each card has an eligibility rule and one
    // dry line in italics. The satire is in what people say, never in a
    // verdict from the game.
    // ======================================================================

    // ---- RIVALS ------------------------------------------------------------
    {
      id: "bidding_war",
      validIn: ["stable", "opportunity", "overheated", "distress"],
      when: () => !!inReach(),
      build() {
        const p = inReach(), r = window.Rivals && GameState.rivals ? Rivals.wantsWho(p) : pick(RIVALS), ask = p.askingPrice || p.currentValue;
        const hi = fmt(ask * 1.06);
        return {
          title: `${OWN(r)} wants the same building`, face: CEO_FACE(r), from: OWNFULL(r),
          body: `${OWN(r)} has bid for <b>${p.name}</b> (asking ${money(ask)}). The seller takes the first firm offer this quarter.<br><br>` +
                `<i>${OWN(r)}'s CEO told the press he "doesn't lose deals". He has lost four this year.</i>`,
          choices: [
            { label: `Pre-empt: offer ${money(hi)} (+6%)`,
              detail: "Yours today. You paid up, and everyone saw.",
              check: () => spend() >= hi * 1.03, checkMsg: `Need about ${money(hi * 1.03)} cash`,
              apply() { const m = buyAt(p, hi); attitude("chen", 1); return m; } },
            { label: "Walk away",
              detail: `${OWN(r)} gets it, and gets bigger.`,
              apply() { toRival(p, r, ask); return `${OWN(r)} bought ${p.name}.`; } },
            { label: `Tell the seller about ${OWN(r)}'s financing`,
              detail: "Their lender is nervous. A quiet word and the seller takes your offer at asking. Words travel.",
              costType: "capital", cost: 1,
              check: () => spend() >= ask * 1.03, checkMsg: `Need about ${money(ask * 1.03)} cash`,
              apply() { pc(-1); const m = buyAt(p, ask);
                        if (rnd() < 0.25) { attitude("petrova", -2); attitude("hassan", -1);
                          return m + ` It leaked. Petrova spent a morning explaining "market colour" to a journalist.`; }
                        return m + " Nobody will ever know. Probably."; } },
          ]
        };
      }
    },
    {
      id: "staff_poached",
      validIn: ["stable", "opportunity", "overheated", "distress", "crisis"],
      when: () => !!starStaff(),
      build() {
        const s = starStaff(), r = pick(RIVALS);
        const grant = fmt(s.salary * 3), shares = fmt(grant / Math.max(0.5, GameState.company.sharePrice));
        return {
          title: `${OWN(r)} wants your ${s.title}`, face: CEO_FACE(r), from: OWNFULL(r),
          body: `${OWN(r)} has offered <b>${s.name}</b>, your ${s.title}, 40% more money. ${s.name.split(" ")[0]} is "keeping an open mind".<br><br>` +
                `<i>That is what people say after they have said yes.</i>`,
          choices: [
            { label: "Match it (+40% salary)",
              detail: `${money(s.salary)} a quarter becomes ${money(s.salary * 1.4)}. For ever.`,
              apply() { s.salary = fmt(s.salary * 1.4); return `${s.name} stays, at ${money(s.salary)} a quarter.`; } },
            { label: `Retention shares (${shares}M new shares)`,
              detail: "Shares that vest only if they stay. Cheaper in cash, a little dilution.",
              apply() { GameState.company.sharesOutstanding = fmt(GameState.company.sharesOutstanding + shares);
                        attitude("petrova", -1);
                        return `${s.name} stays, holding ${shares}M shares that vest in three years.`; } },
            { label: "Let them go",
              detail: `${OWN(r)} gets a good ${s.title}. You get the vacancy.`,
              apply() { GameState.staff = GameState.staff.filter(x => x !== s);
                        // round 5: they really do join the rival
                        const rv = GameState.rivals && GameState.rivals[r];
                        if (rv) { rv.staff = rv.staff.filter(x => x.role !== s.roleId).concat([{ role: s.roleId, title: s.title, name: s.name, portrait: s.portrait, skill: s.skill, stars: s.stars }]); }
                        return `${s.name} left for ${OWN(r)}. The farewell card was signed by nine people and a plant.`; } },
          ]
        };
      }
    },
    {
      id: "activist",
      validIn: ["stable", "opportunity", "overheated", "distress", "crisis"],
      // activists hunt laggards: cheap against NAV AND cheaper than the rivals
      when: () => GameState.meta.year >= 3 && priceToNav() < 0.8 && !(window.Directors && Directors.has("activist")) &&
                  priceToNav() < ((window.Rivals && GameState.rivals && Rivals.pnavAvg) ? Rivals.pnavAvg() : 0.9) - 0.1,
      build() {
        const pnav = Math.round(priceToNav() * 100);
        const bbShares = fmt(GameState.company.sharesOutstanding * 0.05);
        const bbCost = fmt(bbShares * GameState.company.sharePrice);
        return {
          title: "An activist fund has bought 5% of you", face: FACE("activist"), from: "Sterling Park Capital",
          body: `Sterling Park Capital owns 5% and has published a letter: your shares trade at <b>${pnav}% of NAV</b> and "management appears to be the discount". They want a board seat, a buyback, or both.<br><br>` +
                `<i>The letter is 41 pages long. Page 3 is a photo of your car.</i>`,
          choices: [
            { label: "Give them a board seat",
              detail: `Director Marlowe joins: a 6th vote, grumpy from day one (mood 3.5/10), always has a demand, wants your price / NAV up to the rivals' level (${Math.round(Directors.actWant() * 100)}% now, you are at ${pnav}%) and your return ahead of theirs. Board fees +$0.3M a year. Petrova +1.`,
              apply() { attitude("petrova", 1);
                        return Directors.addActivist() + " Board meetings now run forty minutes longer."; } },
            { label: `Buy back 5% of shares (${money(bbCost)})`,
              detail: "Shrinks the discount. Spends cash you might want later.",
              check: () => spend() >= bbCost, checkMsg: `Need ${money(bbCost)} cash`,
              apply() { cash(-bbCost); GameState.company.sharesOutstanding = fmt(GameState.company.sharesOutstanding - bbShares);
                        GameState.company.sharePrice = fmt(GameState.company.sharePrice * 1.03);
                        attitude("petrova", 2); attitude("okafor", -1);
                        return `Bought back ${bbShares}M shares. Sterling Park called it "a start".`; } },
            { label: "Fight them",
              detail: "2 political capital to rally the other shareholders. 55% chance they sell out. Lose, and Marlowe gets the seat anyway, already annoyed (and Williams −1).",
              costType: "capital", cost: 2,
              apply() { pc(-2);
                        if (rnd() < 0.55) { GameState.company.sharePrice = fmt(GameState.company.sharePrice * 0.98);
                          return "Shareholders backed you. Sterling Park sold out quietly and at a loss."; }
                        attitude("williams", -1); const msg = Directors.addActivist();
                        Directors.remember("activist", -1, "you fought his fund in public");
                        return "You lost the vote. " + msg + " He has not forgotten the fight."; } },
          ]
        };
      }
    },
    {
      id: "rival_distress",
      validIn: ["stable", "opportunity", "overheated", "distress", "crisis"],
      // round 5: a rival in real trouble (its own books), or the crisis with a big rival
      when: () => { const d = window.Rivals && GameState.rivals ? Rivals.distressed() : null;
                    return (d && Rivals.bldg(d).length >= 2) || ((arcPhase() === "crisis" || arcPhase() === "recovery") && !!rivalWith(3)); },
      build() {
        const d = window.Rivals && GameState.rivals ? Rivals.distressed() : null;
        const r = d && Rivals.bldg(d).length >= 2 ? d : rivalWith(3);
        // the three smallest: what a stressed owner sells first to raise cash fast
        const three = GameState.cityRivals.filter(p => p.owner === r).sort((a, b) => a.currentValue - b.currentValue).slice(0, 3);
        const val = fmt(three.reduce((a, p) => a + p.currentValue, 0)), all = fmt(val * 0.85);
        const best = three.slice().sort((a, b) => (b.annualNOI / b.currentValue) - (a.annualNOI / a.currentValue))[0];
        const one = fmt(best.currentValue * 0.85);
        const other = pick(RIVALS.filter(x => x !== r));
        return {
          title: `${OWN(r)} has to sell, this quarter`, face: CEO_FACE(r), from: OWNFULL(r),
          body: `${OWN(r)}'s lenders want cash. It offers <b>${three.map(p => p.name).join(", ")}</b> (worth ${money(val)}) at <b>85% of value</b>, all three or one, closing this quarter.<br><br>` +
                `<i>The press release calls it "portfolio optimisation". Their CFO's profile now says "open to new challenges".</i>`,
          choices: [
            { label: `Buy all three (${money(all)})`,
              detail: "The cheapest property you will ever buy. Needs the cash now.",
              check: () => spend() >= all * 1.03, checkMsg: `Need about ${money(all * 1.03)} cash`,
              apply() { const got = three.filter(p => { buyAt(p, fmt(p.currentValue * 0.85)); return GameState.portfolio.indexOf(p) > -1; });
                        three.filter(p => got.indexOf(p) === -1).forEach(p => toRival(p, other));
                        attitude("chen", 2); attitude("okafor", -1);
                        return `Bought ${got.length} building${got.length === 1 ? "" : "s"} from ${OWN(r)} at 85% of value.`; } },
            { label: `Take the best one: ${best.name} (${money(one)})`,
              detail: "The highest-yielding of the three.",
              check: () => spend() >= one * 1.03, checkMsg: `Need about ${money(one * 1.03)} cash`,
              apply() { const m = buyAt(best, one); three.filter(p => p !== best).forEach(p => toRival(p, other, fmt(p.currentValue * 0.85))); attitude("chen", 1);
                        return m + ` ${OWN(other)} took the other two.`; } },
            { label: "Pass",
              detail: `${OWN(other)} buys them instead.`,
              apply() { three.forEach(p => toRival(p, other, fmt(p.currentValue * 0.85))); attitude("chen", -2);
                        return `${OWN(other)} bought all three. Chen watched it happen.`; } },
          ]
        };
      }
    },

    // ---- CAPITAL MARKETS -------------------------------------------------
    {
      id: "index_inclusion",
      validIn: ["stable", "opportunity", "overheated", "distress"],
      when: () => !GameState._inIndex && divYield() >= 0.055 && (GameState.ratios.dividendCoverage || 0) >= 1.0,
      build() {
        const y = (divYield() * 100).toFixed(1);
        const n = fmt(GameState.company.sharesOutstanding * 0.08);
        const px = fmt(GameState.company.sharePrice * 1.03), raise = fmt(n * px);
        return {
          title: "You are joining a high-yield REIT index",
          body: `Your dividend yield of <b>${y}%</b> gets you into the Riverton Premium Yield REIT Index. Index funds must buy about 4% of your shares on the effective date. <b>Stay above a 4.5% yield or you are removed, and they sell.</b><br><br>` +
                `<i>The index committee has never seen one of your buildings. It has seen your dividend.</i>`,
          choices: [
            { label: `Sell them new shares (${n}M at ${money(px).replace("M", "")})`,
              detail: `Raise ${money(raise)} into guaranteed demand, at a premium. No price drop this time.`,
              apply() { GameState._inIndex = true; cash(raise);
                        GameState.company.sharesOutstanding = fmt(GameState.company.sharesOutstanding + n); attitude("petrova", -1);
                        return `Raised ${money(raise)} from index funds. They did not ask any questions. They never do.`; } },
            { label: "Let the price run",
              detail: "Share price +5% as the funds buy.",
              apply() { GameState._inIndex = true; GameState.company.sharePrice = fmt(GameState.company.sharePrice * 1.05); attitude("petrova", 1);
                        return "Included. The stock rose 5% on the day, for reasons unrelated to anything you did."; } },
          ]
        };
      }
    },
    {
      id: "rating_watch",
      validIn: ["stable", "opportunity", "overheated", "distress", "crisis"],
      when: () => (GameState.ratios.debtToAssets || 0) > 0.48 || ((GameState.ratios.interestCoverage || 9) < 2.0 && GameState.debtTranches.length > 0),
      build() {
        const w = worst(), largest = GameState.debtTranches.slice().sort((a, b) => b.amount - a.amount)[0];
        const n = fmt(GameState.company.sharesOutstanding * 0.12), px = fmt(GameState.company.sharePrice * 0.93), raise = fmt(n * px);
        return {
          title: "The rating agency has put you on negative watch",
          body: `Leverage is ${Math.round((GameState.ratios.debtToAssets || 0) * 100)}% of assets and interest cover ${(GameState.ratios.interestCoverage || 0).toFixed(1)}x. Your rating (<b>${GameState.credit.rating}</b>) will be cut unless you show a plan this quarter.<br><br>` +
                `<i>The analyst covers 140 companies. Your call is booked for eleven minutes.</i>`,
          choices: [
            { label: `Sell ${w ? w.name : "a building"} and repay debt`,
              detail: "Your weakest building goes; the proceeds pay down your largest loan.",
              check: () => !!w && !!largest, checkMsg: "Nothing to sell or repay",
              apply() { const r = Properties.sellProperty(w.id); if (!r.success) return r.message;
                        const pay = Math.min(largest.amount, fmt(r.salePrice * 0.95));
                        largest.amount = fmt(largest.amount - pay); cash(-pay);
                        GameState.debtTranches = GameState.debtTranches.filter(t => t.amount > 0.05);
                        attitude("okafor", 2); return `${r.message} Repaid ${money(pay)} of debt. The agency noted your "constructive engagement".`; } },
            { label: `Issue shares (${n}M at a 7% discount)`,
              detail: `Raise ${money(raise)}. The price falls about 6%.`,
              apply() { cash(raise); GameState.company.sharesOutstanding = fmt(GameState.company.sharesOutstanding + n);
                        GameState.company.sharePrice = fmt(GameState.company.sharePrice * 0.94);
                        attitude("petrova", -2); attitude("okafor", 1);
                        return `Raised ${money(raise)}. The rating holds. Petrova does not.`; } },
            { label: "Accept the downgrade",
              detail: "One notch down now, and no upgrade for a year whatever you do. New debt costs more.",
              apply() { const order = ["AAA","AA","A","BBB","BB","B","CCC"];
                        const i = Math.min(6, order.indexOf(GameState.credit.rating) + 1);
                        GameState.credit.rating = order[i]; GameState.credit.upgradeLockQ = 4; attitude("okafor", -2);
                        return `Downgraded to ${order[i]}. The agency's press release used the word "headwinds" six times.`; } },
          ]
        };
      }
    },
    {
      id: "scrip_dividend",
      validIn: ["stable", "opportunity", "overheated", "distress", "crisis"],
      when: () => GameState.company.dividendPerShare > 0 && !(GameState._scripQ > 0) &&
                  (GameState.balance.cash < 5 || (GameState.ratios.dividendCoverage || 9) < 0.9),
      build() {
        const cfo = window.Staff && Staff.getStaff && Staff.getStaff("cfo");
        const who = cfo ? cfo.name : "Jenkins";
        const d = GameState.company.dividendPerShare;
        return {
          title: "Pay the dividend in shares?", face: cfo ? staffFace(cfo) : FACE("jenkins"),
          from: cfo ? cfo.name + ", CFO" : "Jenkins, Chief of Staff",
          body: `${who}: "We are paying out more than we earn. REITs did this in 2009: pay 90% of the dividend in new shares for a year. The dividend per share stays at $${d.toFixed(2)}. It just is not cash."<br><br>` +
                `<i>"Technically," ${who.split(" ")[0]} adds, "it is still a dividend. Please do not ask what technically means."</i>`,
          choices: [
            { label: "Pay 90% in shares for a year",
              detail: "Keeps the cash. The headline dividend never changes. The share count rises every quarter.",
              apply() { GameState._scripQ = 4; attitude("petrova", -2);
                        return "Scrip dividend for four quarters. Williams checked the dividend per share, saw it unchanged, and went back to lunch."; } },
            { label: "Cut the dividend in half",
              detail: "Honest and immediate. Williams will take it personally.",
              apply() { Financials.setDividend(fmt(d * 0.5)); attitude("okafor", 1);
                        return `Dividend cut to $${fmt(d * 0.5).toFixed(2)}.`; } },
            { label: "Keep paying cash",
              detail: "Nothing changes, including the hole.",
              apply() { attitude("okafor", -1); return "Cash dividend maintained. Okafor asked for the cash-flow forecast. Twice."; } },
          ]
        };
      }
    },

    // ---- TENANTS AND BUILDINGS -------------------------------------------
    {
      id: "tenant_buyout",
      validIn: ["stable", "opportunity", "overheated", "distress", "crisis"],
      when: () => !!buyoutCandidate(),
      build() {
        const { p, pos, t } = buyoutCandidate();
        const rent = fmt(p.annualNOI * pos.share), fee = fmt(rent * 1.5), yrs = Math.round(pos.q / 4);
        return {
          title: `${t.name} wants to buy its way out`,
          body: `${t.name} pays <b>${money(rent)}/yr</b> at ${p.name} with ${yrs} years left. It offers <b>${money(fee)}</b>, eighteen months of rent, to leave now.<br><br>` +
                `<i>Their letter says the space "no longer aligns with our journey". The journey is to a cheaper building across the river.</i>`,
          choices: [
            { label: `Take ${money(fee)} and re-let`,
              detail: "Cash today, a vacancy to fill.",
              apply() { cash(fee); Tenants.release(p, t.id); return `${t.name} paid ${money(fee)} and left ${p.name}.`; } },
            { label: "Refuse. A lease is a lease.",
              detail: "They stay and pay. They will not enjoy it.",
              apply() { return `${t.name} stays. Their Christmas card this year is just a signature.`; } },
            { label: "Blend and extend",
              detail: "Cut their rent 10% for five more years on the lease.",
              apply() { p.annualNOI = fmt(p.annualNOI - rent * 0.10); pos.q += 20;
                        return `${t.name} signs five more years at 10% less. Longer income, lower income.`; } },
          ]
        };
      }
    },
    {
      id: "tax_reassessment",
      validIn: ["stable", "opportunity", "overheated", "distress", "crisis"],
      when: () => mine().length >= 2,
      build() {
        const ps = mine().slice(0, Math.min(3, mine().length)), p0 = ps[0];
        const hit = fmt(ps.reduce((a, p) => a + p.annualNOI * 0.04, 0));
        const odds = 0.55 + (window.Staff && Staff.hasRole && Staff.hasRole("asset") ? 0.2 : 0);
        return {
          title: "The county has reassessed your buildings",
          body: `Property tax assessments on <b>${ps.map(p => p.name).join(", ")}</b> are up 20%. If it stands, NOI falls about <b>${money(hit)}/yr</b>.<br><br>` +
                `<i>The assessor valued ${p0.name} using a comparable sale of a building twice its size. The form has no box for that.</i>`,
          choices: [
            { label: "Appeal ($0.3M in fees)",
              detail: `Usually works${odds > 0.6 ? ", and your Asset Manager has done this before" : ""}.`,
              apply() { cash(-0.3);
                        if (rnd() < odds) return "Appeal won. The assessor has been asked to use buildings of the same size.";
                        ps.forEach(p => nudgeNOI(p, -0.04)); return `Appeal lost. NOI down ${money(hit)}/yr and $0.3M in fees.`; } },
            { label: "Accept it",
              detail: "No fees. The tax rises.",
              apply() { ps.forEach(p => nudgeNOI(p, -0.04)); return `Accepted. NOI down ${money(hit)}/yr.`; } },
            { label: "Have a word with the county board",
              detail: "Political capital, spent locally.",
              costType: "capital", cost: 1,
              apply() { pc(-1);
                        if (rnd() < 0.15) { attitude("hassan", -1); return "Reassessment withdrawn. The local paper noticed the timing."; }
                        return "The reassessment was withdrawn for \"clerical reasons\"."; } },
          ]
        };
      }
    },
    {
      id: "contamination",
      validIn: ["stable", "opportunity", "overheated", "distress", "crisis"],
      when: () => bySector("industrial").length > 0 && !GameState._contam,
      build() {
        const p = pick(bySector("industrial")), c = fmt(p.currentValue * 0.06), sale = fmt(p.currentValue * 0.8);
        return {
          title: `Contamination found at ${p.name}`,
          body: `A routine survey found an old fuel tank leaking under <b>${p.name}</b>. Cleanup is about <b>${money(c)}</b>.<br><br>` +
                `<i>The previous owner's disclosure said "no known issues". He was right: nobody had looked.</i>`,
          choices: [
            { label: `Clean it up (${money(c)})`,
              detail: "Expensive, final.",
              apply() { cash(-c); attitude("hassan", 1); return `Cleaned up for ${money(c)}. The regulator sent a letter saying nothing, which is the good outcome.`; } },
            { label: `Sell as-is (${money(sale)}, 20% off)`,
              detail: "Somebody else's fuel tank now.",
              apply() { cash(sale); Properties.handOver(p, "none");
                        return `Sold ${p.name} for ${money(sale)}. The buyer's survey will be more thorough than yours.`; } },
            { label: "Leave it for now",
              detail: "No cost today. The regulator may find it first.",
              apply() { GameState._contam = { id: p.id, name: p.name };
                        return `Noted, filed, not mentioned. ${p.name} keeps operating.`; } },
          ]
        };
      }
    },
    {
      id: "building_fire",
      validIn: ["stable", "opportunity", "overheated", "distress", "crisis"],
      when: () => mine().length > 1,
      build() {
        const p = anyMine(), ded = fmt(Math.max(0.3, p.currentValue * 0.02)), up = fmt(p.currentValue * 0.12), site = fmt(p.currentValue * 0.92);
        return {
          title: `Fire at ${p.name}`,
          body: `An electrical fire has closed <b>${p.name}</b>. Insurance covers the rebuild and the lost rent, less a <b>${money(ded)}</b> deductible.<br><br>` +
                `<i>The fire marshal found the cause in an hour. The insurer will need eighteen months to agree with him.</i>`,
          choices: [
            { label: `Rebuild as it was (${money(ded)})`,
              detail: "Back as before. A few tenants will not come back.",
              apply() { cash(-ded); const d = nudgeOcc(p, -0.05); return `Rebuilt. Occupancy ${d}pp.`; } },
            { label: `Rebuild better (${money(ded + up)})`,
              detail: "Spend more while the walls are open: NOI +10%, value +12%.",
              check: () => spend() >= ded + up, checkMsg: `Need ${money(ded + up)} cash`,
              apply() { cash(-(ded + up)); nudgeNOI(p, 0.10);
                        p.baseValue = fmt((p.baseValue || p.currentValue) * 1.12); p.currentValue = fmt(p.currentValue * 1.12);
                        return `${p.name} reopens better than before. The insurer is still not sure what happened.`; } },
            { label: `Take the payout and sell the site (${money(site)})`,
              detail: "Cash now. One fewer building.",
              apply() { cash(site); Properties.handOver(p, "none"); return `Took ${money(site)} for ${p.name}'s insurance and land.`; } },
          ]
        };
      }
    },
    {
      id: "rent_control",
      validIn: ["stable", "opportunity", "overheated", "distress", "crisis"],
      when: () => bySector("multifamily").length > 0 && !GameState._rentControl,
      build() {
        const mf = bySector("multifamily");
        const passes = () => { GameState._rentControl = true; mf.forEach(p => nudgeNOI(p, -0.05)); };
        return {
          title: "Rent control is on the ballot",
          body: `A ballot measure would cap apartment rent increases at 3% a year. It hits <b>${mf.map(p => p.name).join(", ")}</b>.<br><br>` +
                `<i>Both campaigns hired the same consultant. He bills each for "message discipline".</i>`,
          choices: [
            { label: "Fund the No campaign ($0.8M)",
              detail: "Usually enough to win.",
              apply() { cash(-0.8);
                        if (rnd() < 0.65) return "The measure failed. The consultant is available for the next one.";
                        passes(); return "It passed anyway. Apartment NOI -5%. The consultant sent an invoice and his condolences."; } },
            { label: "Stay out of it",
              detail: "Save the money. Roughly even odds.",
              apply() { if (rnd() < 0.45) { passes(); return "It passed. Apartment NOI -5%."; }
                        return "It failed without you. Nobody thanked you for your restraint."; } },
          ]
        };
      }
    },
    {
      id: "rent_deferral",
      validIn: ["distress", "crisis", "stable", "overheated"],
      when: () => (GameState.market.cycle === "recession" || arcPhase() === "crisis") && mine().length > 0 && !GameState._deferRepay,
      build() {
        const qNOI = fmt(mine().reduce((a, p) => a + p.annualNOI, 0) / 4), owed = fmt(qNOI * 0.25);
        return {
          title: "Tenants ask to defer rent",
          body: `Tenants paying about a quarter of your rent ask to defer <b>three months</b> and repay over the next year. That is <b>${money(owed)}</b> of rent, later.<br><br>` +
                `<i>One request came from a tenant whose CEO just bought a boat. It is, his CFO says, a "working boat".</i>`,
          choices: [
            { label: `Grant it (${money(owed)} now, repaid over a year)`,
              detail: "Keeps tenants alive through the trough. Your cash dips now.",
              apply() { unusual(-owed); GameState._deferRepay = { per: fmt(owed / 4), left: 4 }; attitude("hassan", 1);
                        return `Deferred ${money(owed)}. Repayments start next quarter.`; } },
            { label: "Refuse",
              detail: "Rent is due. Some tenants will not survive it.",
              apply() { const t = Tenants.myWeakest(); const line = t ? Tenants.forceDefault(t.id) : null;
                        return line ? "Refused. " + line.text : "Refused. Everyone paid, eventually."; } },
          ]
        };
      }
    },
    {
      id: "upzoning",
      validIn: ["stable", "opportunity", "overheated"],
      when: () => mine().some(p => p.location !== "tier1" && !p.underConstruction),
      build() {
        const p = pick(mine().filter(x => x.location !== "tier1"));
        const offer = fmt(p.currentValue * 1.3), cost = fmt(p.currentValue * 0.4);
        return {
          title: `The city has upzoned ${p.name}'s block`,
          body: `The block around <b>${p.name}</b> can now take a building three times the size. A developer offers <b>${money(offer)}</b> (130% of value). Redeveloping it yourself costs about <b>${money(cost)}</b> and takes a year.<br><br>` +
                `<i>The planning report calls it "transit-oriented". The nearest bus runs twice a day.</i>`,
          choices: [
            { label: `Redevelop it yourself (${money(cost)}, a year offline)`,
              detail: "No rent for four quarters, then roughly twice the building.",
              check: () => spend() >= cost, checkMsg: `Need ${money(cost)} cash`,
              apply() { cash(-cost); p.preRedevNOI = p.annualNOI; p.preRedevValue = p.currentValue;
                        p.underConstruction = true; p.constructionType = "redevelopment"; p.constructionQuartersLeft = 4;
                        attitude("chen", 2); return `${p.name} closes for redevelopment. Back in a year.`; } },
            { label: `Sell to the developer (${money(offer)})`,
              detail: "Take the premium and let someone else pour concrete.",
              apply() { cash(offer); Properties.handOver(p, "none"); return `Sold ${p.name} for ${money(offer)}.`; } },
            { label: "Hold",
              detail: "The zoning stays with the land. Value +8%.",
              apply() { p.baseValue = fmt((p.baseValue || p.currentValue) * 1.08); p.currentValue = fmt(p.currentValue * 1.08);
                        return `${p.name} is worth 8% more for doing nothing. Real estate.`; } },
          ]
        };
      }
    },
    {
      id: "jv_partner",
      validIn: ["stable", "opportunity", "overheated", "distress", "crisis"],
      when: () => !!jvTarget() && (shortOfCash() || (skilled() && GameState.balance.cash < 25)),
      build() {
        const p = jvTarget(), who = skilled();
        const full = who && who.skill >= 7;
        const price = fmt(p.currentValue * 0.49 * (full ? 1.0 : 0.92));
        const from = who ? `${who.name}, ${who.title}` : "Jenkins, Chief of Staff";
        return {
          title: `A sovereign fund wants half of ${p.name}`, face: who ? staffFace(who) : FACE("jenkins"),
          from,
          body: `${from.split(",")[0]}: "The Gulf Crescent fund will buy <b>49% of ${p.name}</b> for <b>${money(price)}</b>${full ? ", full value" : ", 8% under value"}. We keep 51%, keep running it, and charge them a management fee."<br><br>` +
                `<i>Their due diligence was one visit, lunch included. They liked the lunch.</i>`,
          choices: [
            { label: `Sell 49% (${money(price)})`,
              detail: "Cash now without losing the building. You keep 51% of its income, plus a fee.",
              apply() { cash(price);
                        p.jv = { partner: "Gulf Crescent Fund", share: 0.49 };
                        p.annualNOI = fmt(p.annualNOI * 0.51 * 1.04);            // our 51% + a 4% management fee
                        p.currentValue = fmt(p.currentValue * 0.51);
                        p.baseValue = fmt((p.baseValue || p.currentValue / 0.51) * 0.51);
                        if (p.purchasePrice) p.purchasePrice = fmt(p.purchasePrice * 0.51);
                        return `Sold 49% of ${p.name} for ${money(price)}. It now shows as a joint venture, 51% yours.`; } },
            { label: "Keep all of it",
              detail: "No partner, no cash.",
              apply() { return "Declined. The fund bought half of something of Rennick's instead."; } },
          ]
        };
      }
    },

    // ---- THE CEO -----------------------------------------------------------
    {
      id: "related_party",
      validIn: ["stable", "opportunity", "overheated", "distress"],
      when: () => false,               // round 15: Gary is a story now (gary.js)
      build() {
        const extra = fmt(mine().reduce((a, p) => a + p.annualNOI, 0) * 0.012);
        return {
          title: "Your brother-in-law would like the management contract", face: FACE("gary"), from: "Gary, your brother-in-law",
          body: `Gary's firm has bid for the property management contract: about <b>${money(extra)}/yr</b> more than the lowest bid. Gary has "a lot of experience with buildings". He has owned one.<br><br>` +
                `<i>Gary mentions his lake house is free most summers.</i>`,
          choices: [
            { label: "Give Gary the contract",
              detail: `Costs the company ${money(extra)}/yr. The lake house is yours most summers. It goes in the proxy statement, on page 212.`,
              apply() { GameState._gaSurcharge = fmt((GameState._gaSurcharge || 0) + extra / 4);
                        GameState._gary = { since: GameState.meta.year, extra };
                        GameState.ceoPerks = (GameState.ceoPerks || []).concat(["Gary's lake house"]);
                        return "Gary is your property manager. Thanksgiving has never been warmer."; } },
            { label: "Run an open tender",
              detail: "The lowest bid wins.",
              apply() { GameState._gary = { declined: true }; attitude("hassan", 1);
                        return "The lowest bidder won. Thanksgiving is going to be awkward."; } },
          ]
        };
      }
    },

    // ---- SYSTEM CARD (never in the deck): the bank's terms at a bad renewal ----
    {
      id: "revolver_renewal", system: true,
      build() {
        const T = GameState._renewalTerms; if (!T) return null;
        const cfo = window.Staff && Staff.getStaff && Staff.getStaff("cfo");
        const who = cfo ? cfo.name : "Jenkins";
        const why = T.worse.map(w => ({ rating: "your credit rating fell", leverage: "you borrowed more", cover: "interest cover got thinner" })[w]).join(", ") ||
                    "lending markets are in crisis";
        const r = GameState.revolver;
        return {
          title: "The bank wants new terms for your credit line",
          from: cfo ? cfo.name + ", CFO" : "Jenkins, Chief of Staff", face: cfo ? "assets/staff/" + cfo.portrait : "assets/faces/jenkins.jpg",
          body: `${who}: "The bank reviewed us: ${why}${T.crunch && T.worse.length ? ", and markets are in crisis" : ""}. They will renew the ${money(r.limit)} line only on these terms: ` +
                `the line cut by ${Math.round(T.cut * 100)}%, the rate up ${T.spread.toFixed(2)}%, and ` +
                T.conds.map(c => Revolver.COND[c.id].text(c)).join("; ") + `."<br><br>` +
                `<i>The relationship manager who called you "a valued partner" in January is on holiday. His replacement uses the word "exposure" a lot.</i>`,
          choices: [
            { label: "Accept the terms",
              detail: "Keep the line, on worse terms. Break a condition and it freezes anyway.",
              apply() { return Revolver.acceptTerms(); } },
            { label: "Push back",
              detail: "Your " + (cfo ? "CFO" : "chief of staff") + " negotiates (about " + Math.round(Revolver.pushOdds() * 100) + "% chance): keep the rate nearly flat and drop the dividend freeze. If it fails, the bank adds a little more.",
              apply() { return Revolver.pushBack(); } },
            { label: "Call in a favour (" + Revolver.FAVOUR.terms + " political capital)",
              detail: "Williams calls the bank's chairman. Rate +0.25% only, no conditions, the line cut by " + Math.round(T.cut * 50) + "% instead of " + Math.round(T.cut * 100) + "%. You have " + ((GameState.board && GameState.board.politicalCapital) || 0) + ".",
              check: () => Revolver.canFavour("terms"), checkMsg: "Needs " + Revolver.FAVOUR.terms + " political capital",
              apply() { return Revolver.favourTerms(); } },
            { label: "Refuse",
              detail: "The line freezes: repay only, no new draws. Profits pay it down; needing more than you owe is a default.",
              apply() { attitude("okafor", -2); return Revolver.refuseTerms(); } },
          ]
        };
      }
    },
    // ---- SYSTEM CARD: the 3-year review when your numbers held up ----
    {
      id: "revolver_review", system: true,
      build() {
        const O = GameState._renewalOffer; if (!O) return null;
        const cfo = window.Staff && Staff.getStaff && Staff.getStaff("cfo");
        const used = Revolver.drawn(), fee = n => money(n * Revolver.FEE / 100);
        return {
          title: "Your credit line is up for review",
          from: cfo ? cfo.name + ", CFO" : "Jenkins, Chief of Staff", face: cfo ? "assets/staff/" + cfo.portrait : "assets/faces/jenkins.jpg",
          body: `The bank is happy to renew for another 3 years. How big a line do you want? ` +
                `A bigger line is a bigger safety net, but you pay ${Revolver.FEE}% a year on the part you don't use. ` +
                (used > 0 ? `You are using ${money(used)} right now.` : `You are not using it right now.`) + `<br><br>` +
                `<i>The meeting is at a golf club. Nobody plays golf.</i>`,
          choices: [
            { label: `Keep ${money(O.same)}`,
              detail: `Same size. Unused fee up to ${fee(O.same)} a year.`,
              apply() { return Revolver.acceptOffer('same'); } },
            { label: `Ask for ${money(O.bigger)}`,
              detail: `More room for a crisis or a deal. About ${Math.round(Revolver.bigOdds() * 100)}% chance they say yes (your debt level, rating and CFO). Unused fee up to ${fee(O.bigger)} a year.`,
              apply() { return Revolver.acceptOffer('bigger'); } },
            { label: `Ask for ${money(O.bigger)}, with a favour (${Revolver.FAVOUR.bigger} political capital)`,
              detail: `The Chairman puts in a word: about ${Math.round(Revolver.favourOdds() * 100)}% chance instead of ${Math.round(Revolver.bigOdds() * 100)}%. You have ${(GameState.board && GameState.board.politicalCapital) || 0}.`,
              check: () => Revolver.canFavour("bigger"), checkMsg: `Needs ${Revolver.FAVOUR.bigger} political capital`,
              apply() { return Revolver.favourBigger(); } },
            { label: `Shrink to ${money(O.smaller)}`,
              detail: `Saves fees. Less of a cushion.`,
              check: () => Revolver.drawn() <= O.smaller, checkMsg: "You are using more than that right now",
              apply() { return Revolver.acceptOffer('smaller'); } },
          ]
        };
      }
    },
  ];

  // ==========================================================================
  function init() {
    GameState._deck = null;
    GameState._lastDecisionYear = 0;
    GameState._deferrals = 0;
    GameState._tenantLoans = 0;
    // deck 2 state (newGame edits GameState in place, so clear it here)
    GameState._inIndex = false; GameState._contam = null; GameState._deferRepay = null;
    GameState._gary = null; GameState._rentControl = false; GameState._scripQ = 0;
    GameState._pendingUnusual = 0; GameState.ceoPerks = [];
    GameState._renewalTerms = null; GameState._renewalOffer = null;
    if (GameState.credit) GameState.credit.upgradeLockQ = 0;
    if (window.Story) Story.init();
    ensureDeck();
  }

  /* Applied by ui.js's makeDecision(). Returns the v1 result contract so the
     existing modal plumbing works unchanged. */
  function applyChoice(evt, index) {
    if (!evt || !evt.choices || !evt.choices[index])
      return { success: false, message: "That option is not available." };
    let msg;
    GameState._decisionCtx = (evt.headline || evt.title || 'a decision') + ': ' + evt.choices[index].label;
    try { msg = evt.choices[index].apply(); }
    catch (e) { return { success: false, message: "That option could not be completed." }; }
    if (window.Story && Story.dueCard() === evt.id) Story.S().due = null;      // a story beat answered
    if (window.Story && Story.S().held) delete Story.S().held[evt.id];
    return { success: true, message: msg || "Done." };
  }

  const deckState = () => ({
    remaining: (GameState._deck || []).length,
    total: DECISIONS.length,
    recycled: GameState._deckRecycled || 0,
  });

  /* The bank's renewal terms jump the queue: a system card, outside the deck. */
  function systemDecision() {
    let id = GameState._renewalTerms ? "revolver_renewal" : GameState._renewalOffer ? "revolver_review" : null;
    // then the story (story.js): a thread beat waiting for an answer
    const story = !id && window.Story ? Story.dueCard() : null;
    if (story) id = story;
    if (!id) return null;
    const c = DECISIONS.find(d => d.id === id);
    const b = c && c.build();
    if (!b) { if (story) Story.S().due = null; return null; }
    b.id = c.id; b.headline = b.title; b.isWorld = true;
    return b;
  }

  return { rollBackground, checkDecision, applyChoice, init, deckState, systemDecision, buyAt, toRival,
           BACKGROUND, DECISIONS, badOdds };
})();
