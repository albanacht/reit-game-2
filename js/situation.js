// ============================================================
// situation.js — WHAT IS ACTUALLY HAPPENING TO THIS COMPANY
// REIT SIM 2.0
// ============================================================
// THE PROBLEM THIS SOLVES
// In v1 nothing read the company's position before speaking. Chen demanded
// three acquisitions while the player was insolvent; a Zoning Approval landed
// while covenants were breaking. Every system spoke from a fixed script.
//
// This module is the single shared reading of the situation. The board, the
// event engine, the analysts and the news feed all consult it, so they all
// describe the same reality and stop contradicting each other.
//
// RULES FOR EDITING THIS FILE:
// - It READS GameState and writes nothing except GameState.situation
// - It contains NO content: no speeches, no event text, no mandates.
//   It answers "what is going on"; other modules decide what to say about it.
// - Call Situation.assess() once per quarter, BEFORE board and events run.
// ============================================================

window.Situation = (() => {

  // ----------------------------------------------------------
  // THE FIVE STATES
  // Ordered worst to best. Everything downstream filters on these.
  // ----------------------------------------------------------
  const STATES = ["crisis", "distress", "stable", "opportunity", "overheated"];

  const LABELS = {
    crisis:      "Crisis",
    distress:    "Under strain",
    stable:      "Stable",
    opportunity: "Room to move",
    overheated:  "Stretched",
  };

  // ----------------------------------------------------------
  // THRESHOLDS — all tuning lives here, nowhere else
  // ----------------------------------------------------------
  const T = {
    crisisCash:        0,      // negative cash = overdraft
    crisisCoverage:    1.0,    // interest coverage below this = cannot pay lenders from NOI
    crisisLeverage:    0.70,
    distressCoverage:  1.5,
    distressLeverage:  0.60,
    distressDivCover:  1.0,    // paying the dividend out of capital
    healthyLeverage:   0.45,
    healthyCoverage:   2.0,
    richCashMonths:    6,      // cash vs quarterly cash burn
    overheatedLeverage:0.55,
  };

  // ----------------------------------------------------------
  // ASSESS — the single entry point
  // ----------------------------------------------------------
  function assess() {
    const r = GameState.ratios  || {};
    const b = GameState.balance || {};
    const p = GameState.pnl     || {};
    const m = GameState.market  || {};
    const h = GameState.history || [];

    const cash      = b.cash || 0;
    const d2a       = (r.debtToAssets == null) ? 0.4 : r.debtToAssets;
    const hasDebt   = (b.totalDebt || 0) > 0.1;
    /* 99 is the engine's "no debt" sentinel. It must never reach the player as
       "covered 99.0x" — that is a placeholder, not a fact about the company. */
    const intCov    = !hasDebt ? Infinity
                    : (r.interestCoverage == null) ? 99 : r.interestCoverage;
    const divCov    = r.dividendCoverage || 0;
    const affo      = p.affo || 0;
    const occ       = r.occupancyPortfolio || 0;

    // --- pressure signals, each with a plain-language reason ---------------
    const signals = [];
    /* Before the first quarter closes there is no P&L to read, and flagging
       zeroed ratios produced nonsense like "interest coverage 0.00x" on turn
       one. No closed books, no diagnosis. */
    const booksClosed = h.length > 0;
    const flag = (key, severity, reason) => {
      if (booksClosed) signals.push({ key, severity, reason });
    };

    // 2.0 round 3: negative cash is the credit line, which is normal to use.
    // The danger is the line running out, or the bank freezing it.
    const R = window.Revolver && GameState.revolver ? GameState.revolver : null;
    if (R && R.frozen)
      flag("overdraft", 3, "your credit line is frozen with " + fmtM(Math.max(0, -cash)) + " drawn");
    else if (R && -cash > R.limit * 0.8)
      flag("overdraft", 3, "your credit line is " + Math.round(-cash / R.limit * 100) + "% used");
    else if (!R && cash < T.crisisCash)
      flag("overdraft", 3, "cash is negative at " + fmtM(cash));
    if (hasDebt && intCov < T.crisisCoverage)
      flag("cannot_service", 3, "interest coverage " + intCov.toFixed(2) + "x — NOI does not cover interest");
    else if (hasDebt && intCov < T.distressCoverage)
      flag("thin_coverage", 2, "interest coverage " + intCov.toFixed(2) + "x is thin");
    if (d2a > T.crisisLeverage)
      flag("over_levered", 3, "debt/assets " + pctOf(d2a) + " is past the danger line");
    else if (d2a > T.distressLeverage)
      flag("high_leverage", 2, "debt/assets " + pctOf(d2a));
    if (affo < 0)
      flag("bleeding", 3, "AFFO is negative at " + fmtM(affo));
    if (divCov > 0 && divCov < T.distressDivCover)
      flag("dividend_uncovered", 2, "dividend covered only " + divCov.toFixed(2) + "x — funded from capital");
    if (occ > 0 && occ < 0.80)
      flag("empty_space", 2, "portfolio occupancy " + pctOf(occ));

    // a tenant of yours paying rent it cannot cover
    if (window.Tenants) {
      const w = Tenants.myWeakest();
      if (w && w.coverage < 1.0)
        flag("tenant_distress", 2, w.name + " covers its rent only " + w.coverage + "x (" + w.pct + "% of your rent)");
    }

    // maturity wall: debt due within 4 quarters vs cash on hand
    const dueSoon = (GameState.debtTranches || [])
      .filter(t => (t.quartersUntilMaturity || 99) <= 4)
      .reduce((s, t) => s + t.amount, 0);
    if (dueSoon > 0 && dueSoon > cash)
      flag("maturity_wall", dueSoon > cash * 2 ? 3 : 2,
           fmtM(dueSoon) + " of debt matures within a year against " + fmtM(cash) + " of cash");

    // --- opportunity signals ----------------------------------------------
    const opportunities = [];
    const opp = (key, reason) => opportunities.push({ key, reason });

    /* Two grades. BALANCE-SHEET capacity (cash, leverage headroom) means you
       COULD act. A WINDOW (cheap market, premium to NAV) means you SHOULD act
       now specifically. Capacity alone is not an opportunity — a company with
       cash and no debt is simply well run, which is "stable". It takes a real
       window, or an unusual amount of capacity, to make it a moment. */
    const burn = quarterlyBurn();
    const runway = burn > 0 ? cash / burn : 99;
    let windows = 0;

    if (cash > 25 && runway > T.richCashMonths) opp("dry_powder", fmtM(cash) + " of cash sitting idle");
    if (d2a < T.healthyLeverage)                opp("borrowing_room", "debt/assets only " + pctOf(d2a));
    /* Coverage is only worth remarking on when there IS debt to cover. */
    if (hasDebt && intCov > T.healthyCoverage)
      opp("strong_coverage", "interest covered " + intCov.toFixed(1) + "x");

    if (m.cycle === "recession" || m.cycle === "contracting") {
      opp("cheap_market", "cap rates are wide — assets are cheap"); windows++;
    }
    if (GameState.company && GameState.ratios &&
        GameState.ratios.navPerShare > 0 &&
        GameState.company.sharePrice > GameState.ratios.navPerShare * 1.05) {
      opp("premium_to_nav", "the stock trades above NAV — equity is cheap currency"); windows++;
    }
    if (dueSoonListed(m)) { /* placeholder hook: listed inventory as a window */ }

    // --- classify ----------------------------------------------------------
    const worst = signals.reduce((a, s) => Math.max(a, s.severity), 0);
    const severeCount = signals.filter(s => s.severity === 3).length;

    /* STABLE IS THE DEFAULT. It has to be reachable, or "opportunity" stops
       meaning anything — the first cut of this classifier produced 64%
       opportunity and 0% stable, because idle cash plus low leverage is the
       natural resting state of a company that is simply doing fine. */
    const capacity = opportunities.filter(o =>
      o.key === "dry_powder" || o.key === "borrowing_room" || o.key === "strong_coverage").length;

    let state;
    if (worst === 3)                             state = "crisis";
    else if (worst === 2)                        state = "distress";
    else if (d2a > T.overheatedLeverage)         state = "overheated";
    else if (windows >= 1 && capacity >= 1)      state = "opportunity";  // a window you can act on
    else if (capacity >= 3)                      state = "opportunity";  // or unusual firepower
    else                                         state = "stable";

    // --- trend: are we getting better or worse? ----------------------------
    const trend = readTrend(h);

    const out = {
      state, label: LABELS[state],
      severity: worst, severeCount,
      signals, opportunities, trend,
      // convenience flags other modules read constantly
      isBad:  state === "crisis" || state === "distress",
      isGood: state === "opportunity",
      cash, d2a, intCov, divCov, occ, dueSoon,
      // the single most pressing thing, for headlines
      headline: signals.length
        ? signals.slice().sort((a, b) => b.severity - a.severity)[0]
        : (opportunities[0] || null),
    };

    GameState.situation = out;
    return out;
  }

  // ----------------------------------------------------------
  // TREND — three quarters of FFO and share price direction
  // ----------------------------------------------------------
  function readTrend(h) {
    if (h.length < 3) return { dir: "flat", ffoPct: 0, pricePct: 0 };
    const now = h[h.length - 1], then = h[h.length - 3];
    const ffoPct   = then.ffo > 0 ? (now.ffo - then.ffo) / then.ffo * 100 : 0;
    const pricePct = then.sharePrice > 0 ? (now.sharePrice - then.sharePrice) / then.sharePrice * 100 : 0;
    const avg = (ffoPct + pricePct) / 2;
    return {
      dir: avg > 6 ? "improving" : avg < -6 ? "deteriorating" : "flat",
      ffoPct: Math.round(ffoPct * 10) / 10,
      pricePct: Math.round(pricePct * 10) / 10,
    };
  }

  // Reserved hook: listed-inventory-as-a-window, once the slow-sale model lands.
  function dueSoonListed() { return false; }

  // Rough quarterly cash burn, used for the runway calculation.
  function quarterlyBurn() {
    const p = GameState.pnl || {};
    const out = (p.interestExpense || 0) + (p.gAndA || 0) + (p.dividendsPaid || 0);
    return Math.max(0.1, out - (p.noi || 0));
  }

  // ----------------------------------------------------------
  // QUERIES — the API other modules actually use
  // ----------------------------------------------------------
  const get      = () => GameState.situation || assess();
  const is       = (...states) => states.indexOf(get().state) !== -1;
  const has      = key => get().signals.some(s => s.key === key);
  const canSee   = key => get().opportunities.some(o => o.key === key);

  /* Does a content item (mandate, event, decision) fit right now?
     Anything with a validIn list is filtered through this, which is how a
     director stops demanding acquisitions during insolvency. */
  function fits(item) {
    const s = get();
    if (item.validIn && item.validIn.indexOf(s.state) === -1) return false;
    if (item.requires && !item.requires.every(k => has(k) || canSee(k))) return false;
    if (item.forbidden && item.forbidden.some(k => has(k))) return false;
    return true;
  }

  /* Plain-language summary — used by the briefing and by director speeches
     so everyone describes the same reality in the same words. */
  function describe() {
    const s = get();
    if (!s.signals.length && !s.opportunities.length) return "The business is steady.";
    if (s.isBad) {
      const top = s.signals.slice().sort((a, b) => b.severity - a.severity).slice(0, 2);
      return top.map(x => x.reason).join("; ") + ".";
    }
    if (s.isGood) return s.opportunities.slice(0, 2).map(o => o.reason).join("; ") + ".";
    return "The business is steady.";
  }

  const fmtM  = v => "$" + (Math.round(v * 10) / 10) + "M";
  const pctOf = v => Math.round(v * 100) + "%";

  return { STATES, LABELS, assess, get, is, has, canSee, fits, describe, readTrend };
})();
