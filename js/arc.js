// ============================================================
// arc.js — THE MACRO STORYLINE: cheap money, warnings, crisis, reckoning
// REIT SIM 2.0  ·  design doc B.1e
// ============================================================
// v1's market.js ran a random chain of cycle phases plus an interest-rate
// ratchet that hiked 60% of the time regardless of the economy. That gave no
// story and made a 2022-style crisis (rates rising INTO a downturn) impossible,
// because v1 recessions always cut rates.
//
// The arc is Hearts-of-Iron shaped: you know a crisis is coming, not exactly
// when (a window in Y5-Y7) or what kind (one of three variants). Warning signs
// arrive a few quarters ahead. Outside the scripted phases, market.js's own
// random cycle keeps running as texture — without the upward bias.
//
// RULES FOR EDITING THIS FILE:
// - All tuning lives in DIFF and PHASE tables below.
// - arc.js DECIDES; market.js, tenants.js and events.js ASK. Nothing else may
//   script macro conditions, or two storytellers will contradict each other.
// - Everything is in quarters: q = GameState.totalQuartersElapsed() (1..60).
// ============================================================

window.Arc = (() => {

  const DIFF = {
    easy:   { warn: [6, 6], sev: 0.6, after: false, afterSev: 0   },
    normal: { warn: [4, 6], sev: 1.0, after: true,  afterSev: 0.5 },
    hard:   { warn: [2, 3], sev: 1.4, after: true,  afterSev: 0.8 },
  };
  const WINDOW       = [17, 28];   // crisis starts between Y5Q1 and Y7Q4
  const CRISIS_LEN   = [6, 10];
  const AFTER_WINDOW = [41, 49];   // aftershock starts between Y11Q1 and Y13Q1
  const AFTER_LEN    = [3, 4];
  const RECOVERY_LEN = 8;          // quarters of scripted recovery after the crisis
  const VARIANTS     = ["rate_shock", "credit_crunch", "sector_collapse"];

  const NAMES = {
    rate_shock:      "Rate shock",
    credit_crunch:   "Credit crunch",
    sector_collapse: "Sector collapse",
  };

  /* One warning line per quarter during the warning phase, in order. */
  const WARNINGS = {
    rate_shock: [
      "Inflation printed hotter than expected for a third straight month.",
      "Wage growth accelerated again. Bond markets are pricing in hikes.",
      "The central bank dropped 'patient' from its statement. Traders read it as a signal.",
      "Ten-year yields hit a two-year high. REIT stocks sold off on the day.",
      "Futures now price four rate hikes within a year.",
      "The yield curve inverted. Economists call it the most reliable recession signal there is.",
    ],
    credit_crunch: [
      "A mid-sized lender reported losses on its commercial property book.",
      "Two regional banks tightened commercial real estate lending standards.",
      "Credit spreads widened for a second quarter. Bond issuance is slowing.",
      "A property fund suspended withdrawals after a run of redemptions.",
      "Your own bank asked for updated covenant figures — earlier than usual.",
      "Interbank lending rates spiked. Lenders are hoarding cash.",
    ],
    sector_collapse: [
      "{S} demand indicators disappointed again this quarter.",
      "A national {s} operator announced a strategic review of its footprint.",
      "Analysts cut forecasts for {s} rents across the region.",
      "Sublet space in {s} is piling up faster than it is being taken.",
      "Two {s} tenants in Riverton asked landlords to renegotiate.",
      "Lenders quietly stopped quoting new loans secured on {s} property.",
    ],
  };

  const rnd  = () => Math.random();
  const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = a => a[Math.floor(rnd() * a.length)];
  const q    = () => (GameState.totalQuartersElapsed ? GameState.totalQuartersElapsed() : 1);

  // ----------------------------------------------------------
  // INIT — draws this run's arc. Called from Market.init().
  // ----------------------------------------------------------
  function init(difficulty) {
    const d = DIFF[difficulty] ? difficulty : "normal";
    const D = DIFF[d];
    const variant = pick(VARIANTS);
    const crisisStart = rint(WINDOW[0], WINDOW[1]);
    const warnLen = rint(D.warn[0], D.warn[1]);
    const crisisEnd = crisisStart + rint(CRISIS_LEN[0], CRISIS_LEN[1]);
    const afterStart = D.after ? rint(AFTER_WINDOW[0], AFTER_WINDOW[1]) : 999;
    GameState.arc = {
      active: true, difficulty: d,
      variant, sector: variant === "sector_collapse" ? pick(["office", "retail"]) : null,
      warnStart: crisisStart - warnLen, crisisStart, crisisEnd,
      afterStart, afterEnd: afterStart + rint(AFTER_LEN[0], AFTER_LEN[1]),
      afterVariant: pick(VARIANTS.filter(v => v !== variant)),
      sev: D.sev, afterSev: D.afterSev,
      warnIdx: 0, announced: {},
    };
    return GameState.arc;
  }

  const A = () => GameState.arc;
  const active = () => !!(A() && A().active);

  // ----------------------------------------------------------
  // PHASE
  // ----------------------------------------------------------
  function phase(at) {
    const a = A(); if (!a) return null;
    const t = at || q();
    if (t < a.warnStart)                          return "cheap";
    if (t < a.crisisStart)                        return "warning";
    if (t < a.crisisEnd)                          return "crisis";
    if (t >= a.afterStart && t < a.afterEnd)      return "aftershock";
    if (t < a.crisisEnd + RECOVERY_LEN)           return "recovery";
    return "late";
  }

  /* Which variant is live right now (the aftershock has its own). */
  function liveVariant() {
    const a = A(); if (!a) return null;
    return phase() === "aftershock" ? a.afterVariant : a.variant;
  }
  function liveSev() {
    const a = A(); if (!a) return 1;
    return phase() === "aftershock" ? a.afterSev : a.sev;
  }

  /* The cycle label market.js should use this quarter, or null to let its own
     random chain run (outside the scripted phases). */
  function cycleFor() {
    const a = A(), ph = phase();
    if (!a) return null;
    const cur = GameState.market && GameState.market.cycle;
    if (ph === "cheap")    return (cur === "expanding" || cur === "stable") ? null : "stable";
    if (ph === "warning")  return "expanding";                     // late-cycle boom
    if (ph === "crisis") {
      const len = a.crisisEnd - a.crisisStart, i = q() - a.crisisStart;
      return (i < len * 0.3 || i >= len * 0.8) ? "contracting" : "recession";
    }
    if (ph === "aftershock") return "contracting";
    if (ph === "recovery")   return (q() - a.crisisEnd) < 3 ? "stable" : "expanding";
    /* After the scripted story, v1's random chain runs as texture — but it may
       not start a full recession of its own. Big downturns belong to the arc;
       the first test produced ten unplanned recession quarters after the
       aftershock. Mild contractions are still allowed. */
    if (ph === "late" && cur === "recession") return "stable";
    return null;
  }

  // ----------------------------------------------------------
  // RATES — returns { delta, msg } on a move quarter, null on a hold
  // market.js keeps its own hold counter; this only decides the size.
  // ----------------------------------------------------------
  function rollRate() {
    const ph = phase(), v = liveVariant(), s = liveSev();
    const base = GameState.market.baseInterestRate;
    const r = rnd();
    const step = n => Math.round(n * 4) / 4;     // 0.25% steps

    if (ph === "cheap" || ph === "late") {
      // balanced texture: no ratchet. Leans back toward ~3.25% so rates wander, not drift.
      // (round 3: the world starts at 3%, was 2%)
      // round 10: a stronger pull home after a shock (rates sat at 7.5% for a decade)
      const lean = base > 6 ? -0.3 : base > 4.25 ? -0.15 : base < 2.25 ? 0.1 : 0;
      if (r < 0.22 + lean) return { delta: 0.25, msg: "hike" };
      if (r < 0.78 + lean) return null;                     // a high rate gets cut more often
      return { delta: base > 6 ? -0.5 : -0.25, msg: "cut" };
    }
    if (ph === "warning") {
      if (v === "rate_shock")    return r < 0.75 ? { delta: step(0.25 + 0.25 * s * rnd()), msg: "hike" } : null;
      if (v === "credit_crunch") return r < 0.35 ? { delta: 0.25, msg: "hike" } : null;
      return r < 0.2 ? { delta: 0.25, msg: "hike" } : null;
    }
    if (ph === "crisis" || ph === "aftershock") {
      const a = A();
      const early = ph === "aftershock" || (q() - a.crisisStart) < (a.crisisEnd - a.crisisStart) * 0.6;
      if (v === "rate_shock")
        return early ? { delta: step(0.5 + 0.25 * s), msg: s >= 1 ? "shock_up" : "hike" } : (r < 0.5 ? null : { delta: 0.25, msg: "hike" });
      if (v === "credit_crunch")
        return base > 0.75 ? { delta: -step(0.25 + 0.5 * s * rnd()), msg: "cut" } : null;
      return r < 0.5 ? { delta: -0.25, msg: "cut" } : null;                 // sector collapse: mild easing
    }
    if (ph === "recovery") {
      if (v === "rate_shock")    return base > 4.0 ? (r < 0.75 ? { delta: base > 6 ? -0.5 : -0.25, msg: "cut" } : null) : null;
      if (v === "credit_crunch") return r < 0.25 ? { delta: 0.25, msg: "hike" } : null;
      return r < 0.3 ? { delta: 0.25, msg: "hike" } : (r > 0.85 ? { delta: -0.25, msg: "cut" } : null);
    }
    return null;
  }

  /* Extra credit spread on all borrowing — the credit crunch lives here. */
  function spreadAdd() {
    if (!active()) return 0;
    const ph = phase(), v = liveVariant(), s = liveSev(), a = A();
    if (v !== "credit_crunch") return 0;
    if (ph === "warning") return Math.round(0.35 * s * 100) / 100;
    if (ph === "crisis" || ph === "aftershock") {
      // ramps up over the first two quarters, then holds
      const into = ph === "crisis" ? q() - a.crisisStart : q() - a.afterStart;
      return Math.round(Math.min(1, (into + 1) / 2) * 2.0 * s * 100) / 100;
    }
    if (ph === "recovery") return Math.round(Math.max(0, 1 - (q() - a.crisisEnd) / RECOVERY_LEN) * 0.8 * s * 100) / 100;
    return 0;
  }

  /* Extra cap-rate move per quarter, on top of the rate-linked move in
     market.js. This is the RISK PREMIUM: in a real crisis buyers demand
     higher yields whatever the central bank does. Without it, a credit crunch
     (where rates are cut) made buildings MORE valuable — the opposite of 2008.
     Positive = cap rates widen = values fall. */
  const PREMIUM = { rate_shock: 0.06, credit_crunch: 0.28, sector_collapse: 0.04 };
  function capRateExtra(sector) {
    if (!active()) return 0;
    const ph = phase(), v = liveVariant(), s = liveSev(), a = A();
    const target = sector === (a.sector || "office");
    if (ph === "crisis" || ph === "aftershock") {
      const start = ph === "crisis" ? a.crisisStart : a.afterStart;
      const end   = ph === "crisis" ? a.crisisEnd   : a.afterEnd;
      if (q() - start >= (end - start) * 0.7) return 0;          // widening stops late in the crisis
      let x = PREMIUM[v] || 0;
      if (v === "sector_collapse" && target) x = 0.24;
      return x * s;
    }
    if (ph === "warning" && v === "sector_collapse" && target) return 0.03 * s;
    if (ph === "recovery") {
      const into = q() - a.crisisEnd;
      if (into < 6) return -(v === "credit_crunch" ? 0.12 : 0.05) * s;   // premium unwinds
    }
    return 0;
  }

  /* How much of a base-rate move passes into cap rates. v1 used 60% always.
     In a credit crunch, cuts do not lower cap rates — lenders are not lending
     at any price — so the pass-through collapses. */
  function ratePassThrough() {
    if (!active()) return 0.6;
    const ph = phase(), v = liveVariant();
    return (v === "credit_crunch" && (ph === "crisis" || ph === "aftershock")) ? 0.15 : 0.6;
  }

  /* Extra quarterly hit to tenant coverage. Every crisis hurts every tenant a
     little; the sector collapse hurts its own sector a lot. (The generic cycle
     term in tenants.js alone was absorbed by tenant recovery: average
     coverage barely moved in the first test.) */
  function tenantShock(sector) {
    if (!active()) return 0;
    const ph = phase(), v = liveVariant(), s = liveSev(), a = A();
    const target = v === "sector_collapse" && sector === (a.sector || "office");
    if (ph === "crisis" || ph === "aftershock") return -(0.045 + (target ? 0.06 : 0)) * s;
    if (ph === "warning" && target) return -0.01 * s;
    return 0;
  }

  /* v1's random macro events in events.js that the arc now owns. */
  const OWNED_EVENTS = ["fed_rate_hike", "fed_rate_cut", "credit_crunch", "interest_rate_shock"];
  function suppresses(eventId) {
    if (!active()) return false;
    if (OWNED_EVENTS.indexOf(eventId) !== -1) return true;
    if (eventId === "pandemic_shock") return phase() === "crisis";   // never stack on the crisis
    return false;
  }

  // ----------------------------------------------------------
  // NEWS — warning signs and phase headlines for the quarter report
  // ----------------------------------------------------------
  function processQuarter() {
    const a = A(); if (!a) return [];
    const out = [];
    const ph = phase();
    const fill = s => s.replace("{S}", cap(a.sector || "office")).replace("{s}", a.sector || "office");

    if (ph === "warning") {
      const list = WARNINGS[a.variant];
      out.push({ good: false, macro: true, text: "Warning sign: " + fill(list[Math.min(a.warnIdx, list.length - 1)]) });
      a.warnIdx++;
    }
    const once = (key, text, good) => {
      if (a.announced[key]) return;
      a.announced[key] = true;
      out.push({ good, macro: true, text });
    };
    if (ph === "crisis") once("crisis", {
      rate_shock:      "CRISIS — Inflation shock. The central bank is hiking hard into a slowing economy. Borrowing costs are climbing and values are falling.",
      credit_crunch:   "CRISIS — Credit crunch. Lenders have stopped lending. Rates are being cut, but spreads have blown out and maturing loans are hard to roll.",
      sector_collapse: "CRISIS — " + cap(a.sector || "office") + " collapse. Demand for " + (a.sector || "office") + " space has broken. Values and tenants in the sector are falling fast.",
    }[a.variant], false);
    if (ph === "recovery") once("recovery", "The worst has passed. Markets are stabilising — and the weakest owners in Riverton now have to sell.", true);
    if (ph === "aftershock") once("after", "AFTERSHOCK — " + NAMES[a.afterVariant] + ". A second, smaller shock hits before the recovery is complete.", false);
    if (ph === "late" && a.announced.after) once("after_end", "The aftershock has passed.", true);
    return out;
  }

  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* For the design/test tools: the whole run's plan at a glance. */
  function describe() {
    const a = A(); if (!a) return "no arc";
    const yq = t => "Y" + (Math.floor((t - 1) / 4) + 1) + "Q" + (((t - 1) % 4) + 1);
    return `${NAMES[a.variant]}${a.sector ? " (" + a.sector + ")" : ""} · warnings ${yq(a.warnStart)} · crisis ${yq(a.crisisStart)}–${yq(a.crisisEnd - 1)}` +
           (a.afterStart < 999 ? ` · aftershock ${yq(a.afterStart)} (${NAMES[a.afterVariant]})` : "") + ` · ${a.difficulty}`;
  }

  return { init, phase, cycleFor, rollRate, spreadAdd, capRateExtra, ratePassThrough, tenantShock,
           suppresses, processQuarter, describe, liveVariant, active, NAMES, DIFF };
})();
