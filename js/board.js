// ============================================================
// board.js — Board of Directors system
// REIT Simulator Game v0.6
// ============================================================

window.Board = (() => {

  // ----------------------------------------------------------
  // DIRECTOR DEFINITIONS
  // ----------------------------------------------------------
  const DIRECTORS = [
    {
      id:        "williams",
      name:      "Chairman Williams",
      title:     "Board Chairman",
      image:     "assets/board/williams.png",
      watches:   "Dividends & Coverage",
      personality: "Conservative. Obsessed with dividend reliability. Hard to negotiate with.",
      negotiateSuccessRate: 0.35,
    },
    {
      id:        "chen",
      name:      "Director Chen",
      title:     "Growth Director",
      image:     "assets/board/chen.png",
      watches:   "FFO Growth & Acquisitions",
      personality: "Aggressive. Wants growth at all costs. Responds well to ambition.",
      negotiateSuccessRate: 0.65,
    },
    {
      id:        "okafor",
      name:      "Director Okafor",
      title:     "Risk Officer",
      image:     "assets/board/okafor.png",
      watches:   "Leverage & Coverage",
      personality: "Cautious. Cares about balance sheet discipline. Respects financial arguments.",
      negotiateSuccessRate: 0.55,
    },
    {
      id:        "petrova",
      name:      "Director Petrova",
      title:     "Investor Relations",
      image:     "assets/board/petrova.png",
      watches:   "Share Price & Yield",
      personality: "Shareholder-focused. Hates dilution. Responds to market performance.",
      negotiateSuccessRate: 0.60,
    },
    {
      id:        "hassan",
      name:      "Director Hassan",
      title:     "Operations",
      image:     "assets/board/hassan.png",
      watches:   "Occupancy & Property Quality",
      personality: "Practical. Cares about what he can see and touch. Easiest to negotiate with.",
      negotiateSuccessRate: 0.75,
    },
    // 2.0: joins only if you give the activist fund a seat (world.js "activist")
    {
      id:        "activist",
      name:      "Director Marlowe",
      title:     "Activist (Sterling Park Capital)",
      image:     "assets/faces/activist.jpg",
      watches:   "Discount to NAV & Total Return",
      personality: "Thinks management is the discount. Reads everything. Almost impossible to negotiate with.",
      negotiateSuccessRate: 0.25,
      extra:     true,
    },
    // round 13: Kessler's nominee if Rennick buys 15% of us (war.js)
    {
      id:        "voss",
      name:      "Director Voss",
      title:     "Rennick Capital's nominee",
      image:     "assets/faces/voss.jpg",
      watches:   "Rennick's interests",
      personality: "Rennick's CFO. Cold, precise, loyal to Kessler. Votes against you every time.",
      negotiateSuccessRate: 0.05,
      extra:     true,
    },
    // 2.0 round 8: replacements when a director is pushed out (meeting.js)
    {
      id:        "mansour",
      name:      "Director Mansour",
      title:     "Operations (Salma Mansour)",
      image:     "assets/faces/mansour.jpg",
      watches:   "Occupancy, harder than Hassan did",
      personality: "Born in Cairo. Twenty years running operations for a Gulf retail group, then a US supermarket chain. Counts empty units in her sleep.",
      negotiateSuccessRate: 0.5,
      extra:     true,
    },
    {
      id:        "grace",
      name:      "Director Grace",
      title:     "Sustainability (Julian Grace)",
      image:     "assets/faces/grace.jpg",
      watches:   "ESG score and initiatives",
      personality: "Sincere, tireless, and always has a new initiative. Happy for you to borrow, as long as it is green.",
      negotiateSuccessRate: 0.6,
      extra:     true,
    },
    {
      id:        "tex",
      name:      "Director Tex",
      title:     "Your nominee (Tex Brennan)",
      image:     "assets/faces/tex.jpg",
      watches:   "You",
      personality: "Ran two Texas real estate firms and a pipeline company's property arm. Your friend since a Dallas deal years ago. Votes with you, at a price.",
      negotiateSuccessRate: 0.9,
      extra:     true,
    },
  ];

  // ----------------------------------------------------------
  // MANDATE CATALOGUE
  // Each director has a pool of possible mandates
  // ----------------------------------------------------------
  const MANDATE_POOL = {
    williams: [
      { id: "div_raise",    text: (t) => `Raise the quarterly dividend by at least ${t}% this year.`, metric: "dividendGrowthPct", target: (y) => Math.min(7, Math.round(3 + y * 0.5)), higher: true  },
      { id: "div_raise2",   text: (t) => `Deliver dividend growth of ${t}% — shareholders expect rising income.`, metric: "dividendGrowthPct", target: (y) => Math.min(7, Math.round(3 + y * 0.5)), higher: true  },
      { id: "div_nocut",    text: () => `Do not cut the dividend at any point this year.`,         metric: "noDividendCut",       target: () => 1,               higher: true  },
    ],
    chen: [
      { id: "acquisitions", text: (t) => `Acquire at least ${t} ${t > 1 ? "properties" : "property"} this year.`, metric: "acquisitionsThisYear", target: (y) => Math.min(3, 1 + Math.floor(y/4)), higher: true },
      { id: "ffo_growth",   text: (t) => `FFO must grow at least ${t}% year over year.`,          metric: "ffoGrowthPct",        target: (y) => Math.min(10, 3 + y),     higher: true  },
      { id: "portfolio_sz", text: (t) => `Grow portfolio value by at least ${t}% this year.`,     metric: "portfolioGrowthPct",  target: (y) => Math.min(12, 4 + y),     higher: true  },
    ],
    okafor: [
      { id: "leverage",     text: (t) => `Debt/assets must not exceed ${t}%.`,                    metric: "debtToAssets",        target: (y) => 0.50,           higher: false },
      { id: "int_coverage", text: (t) => `Interest coverage must exceed ${t}x.`,                  metric: "interestCoverage",    target: (y) => 2.0,            higher: true  },
      { id: "no_overdraft", text: () => `Don't draw on the credit line this year.`,                    metric: "noOverdraft",         target: () => 1,               higher: true  },
      { id: "no_debt_grow", text: () => `Do not grow total debt this year — refinance, don't expand it.`, metric: "noDebtIncrease", target: () => 1,            higher: true  },
    ],
    petrova: [
      { id: "share_price",  text: () => `Share price must not fall below current level.`,          metric: "sharePriceHeld",      target: () => 1,               higher: true  },
      { id: "no_equity",    text: () => `No equity issuance this year — shareholders hate dilution.`, metric: "noEquityIssued",   target: () => 1,               higher: true  },
      { id: "price_growth", text: (t) => `Grow the share price by at least ${t}% this year.`,       metric: "sharePriceGrowthPct", target: (y) => Math.min(8, 3 + y), higher: true  },
    ],
    hassan: [
      { id: "occupancy",    text: (t) => `Portfolio occupancy must exceed ${t}%.`,                metric: "occupancyPortfolio",  target: (y) => 0.86,           higher: true  },
      { id: "no_bad_prop",  text: (t) => `No property below ${t}% occupancy at year end.`,        metric: "worstOccupancy",      target: (y) => 0.70,           higher: true  },
      { id: "lease_ups",    text: (t) => `Use the lease-up action at least ${t} times this year.`,metric: "leaseUpsThisYear",    target: () => 2,               higher: true  },
    ],
    mansour: [
      { id: "rey_occ",      text: (t) => `Portfolio occupancy must reach ${t}%.`,                 metric: "occupancyPortfolio",  target: () => 0.90,            higher: true  },
      { id: "rey_worst",    text: (t) => `No building below ${t}% occupancy at year end.`,          metric: "worstOccupancy",      target: () => 0.75,            higher: true  },
      { id: "rey_leaseups", text: (t) => `Use the lease-up action at least ${t} times this year.`,  metric: "leaseUpsThisYear",    target: () => 3,               higher: true  },
    ],
    grace: [
      { id: "moss_score",   text: (t) => `Get our ESG score to at least ${t}.`,                    metric: "esgScore",            target: () => 60,              higher: true  },
      { id: "moss_new",     text: () => `Back at least one new sustainability initiative this year.`, metric: "esgNew",         target: () => 1,               higher: true  },
    ],
    activist: [
      { id: "act_pnav",     text: (t) => `Get the share price to at least ${t}% of NAV.`,         metric: "priceToNav",          target: () => (window.Directors && Directors.actWant ? Directors.actWant() : 0.9), higher: true  },
      { id: "act_rivals",   text: () => `Beat the rivals' average total return this year.`,      metric: "beatRivals",          target: () => 1,               higher: true  },
    ],
  };

  // ----------------------------------------------------------
  // UTILITY
  // ----------------------------------------------------------
  function fmt(n, d) { d = d === undefined ? 2 : d; return Math.round(n * Math.pow(10, d)) / Math.pow(10, d); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  function getDirectorState(id) {
    return GameState.board.directors.find(function(d) { return d.id === id; });
  }

  function getExpression(attitude) {
    if (attitude >= 8) return "happy";
    if (attitude >= 5) return "neutral";
    if (attitude >= 3) return "neutral";
    return "angry";
  }

  // ----------------------------------------------------------
  // INITIALISE
  // ----------------------------------------------------------
  function init() {
    GameState.board.directors = DIRECTORS.filter(function(d) { return !d.extra; }).map(function(d) {
      return {
        id:       d.id,
        attitude: 5,
        mandates: [],
      };
    });

    GameState.board.probation         = null;   // two strikes (round 4)
    GameState.board.brain             = null;   // directors.js rebuilds it
    GameState.board.history           = [];     // round 8: who left, who joined
    GameState.board.startBoard        = null;
    GameState.board.chair             = null;   // round 14: Williams's successor, or 'you' (tower.js)
    GameState.board.saved             = {};
    GameState.board.texUnpaid         = null;
    GameState.board._departYear       = null;
    GameState.board.activist          = null;
    GameState.board.politicalCapital  = 2;
    GameState.board.maxCapital        = 8;      // round 12: was 5 (tools/sim_capital.js: players earned ~1 a year)
    GameState.board.galaYear          = 0;
    GameState.board.year1Safe         = true;
    GameState.board.activeMandates    = [];
    GameState.board.mandateTracking   = {};
    GameState.board.acquisitionsThisYear = 0;
    GameState.board.accretiveBuysThisYear = 0;
    GameState.board.leaseUpsThisYear  = 0;
    GameState.board.noOverdraftBroken = false;
    GameState.board.noEquityBroken    = false;
    GameState.board.startYearSharePrice = GameState.company.sharePrice;
    GameState.board.startYearFFO      = 0;
    GameState.board.startYearDividend = GameState.company.dividendPerShare;
    GameState.board.startYearDebt     = GameState.balance.totalDebt;
    GameState.board.debtIncreasedThisYear = false;
    GameState.board.startYearPortfolio = GameState.portfolio.reduce(function(s, p) { return s + p.currentValue; }, 0);

    // Legacy pressure fields — kept for UI compatibility
    GameState.board.pressurePoints = 0;
    GameState.board.maxPressure    = 8;
    GameState.board.mood           = "neutral";
    GameState.board.pressureLog    = [];
    GameState.board.currentGoals   = [];
    GameState.board.lastYearGoals  = [];
    GameState.board.year1Score     = { dividendMaintained: true, occupancyOk: true, leverageOk: true, cashOk: true, noiGrowth: true };
    GameState.board.thresholds     = { dividendCoverage: 1.0, debtToAssets: 0.60, occupancy: 0.80, ffoGrowth: 0 };
    GameState.eventLog             = [];
    GameState.annualSnapshots      = [];
    GameState.meta.tutorialYear    = true;
  }

  // ----------------------------------------------------------
  // QUARTERLY ATTITUDE UPDATE
  // Called silently every quarter — no UI shown
  // ----------------------------------------------------------
  function updateAttitudes() {
    var r  = GameState.ratios;
    var p  = GameState.pnl;
    var co = GameState.company;
    var b  = GameState.balance;
    var h  = GameState.history;

    // Coalesce nullable leverage ratio for Okafor's logic.
    var d2aSafe = (r.debtToAssets === null || r.debtToAssets === undefined) ? 0.40 : r.debtToAssets;

    // Williams — DIVIDENDS. Dividend GROWTH is his overwhelming concern.
    // Coverage is near-cosmetic: it barely nudges him, and only bites if
    // truly catastrophic — so the early-game solvency struggle doesn't
    // unfairly enrage him. The real pressure is to keep raising the payout.
    var w = getDirectorState("williams");
    if (w) {
      var startDiv = GameState.board.startYearDividend || co.dividendPerShare;
      // Williams wants the dividend to keep rising. His target escalates early
      // but CAPS at 12% so it stays achievable as the payout compounds — the
      // bug before was an ever-rising % demand that "a few cents" couldn't meet.
      var requiredGrowth = Math.min(0.12, 0.06 + (GameState.meta.year - 1) * 0.01); // 6%→cap 12%
      GameState.board.williamsTargetGrowth = requiredGrowth;
      var actualGrowth = startDiv > 0 ? (co.dividendPerShare - startDiv) / startDiv : 0;

      if (co.dividendPerShare < startDiv - 0.001) {
        w.attitude = clamp(w.attitude - 1.2, 0, 10);          // cut — furious
      } else if (actualGrowth >= requiredGrowth) {
        w.attitude = clamp(w.attitude + 0.8, 0, 10);          // met his target — very pleased
      } else if (actualGrowth > 0.005) {
        w.attitude = clamp(w.attitude + 0.2, 0, 10);          // raised at all — still net positive
      } else {
        w.attitude = clamp(w.attitude - 0.5, 0, 10);          // flat — displeased
      }
      // Williams cares ONLY about the dividend. Coverage, FFO, leverage —
      // none of it moves him. Dividend growth is his entire world.
    }

    // Chen — growth
    var ch = getDirectorState("chen");
    if (ch) {
      if (h.length >= 4) {
        var currFFO = p.ffo;
        var prevFFO = h[h.length - 4] ? h[h.length - 4].ffo : currFFO;
        var growth  = prevFFO > 0 ? (currFFO - prevFFO) / prevFFO : 0;
        if (growth > 0.08)  ch.attitude = clamp(ch.attitude + 0.5, 0, 10);
        if (growth < 0)     ch.attitude = clamp(ch.attitude - 0.6, 0, 10);
      }
      if (GameState.board.acquisitionsThisYear > 0)
        ch.attitude = clamp(ch.attitude + 0.3, 0, 10);
    }

    // Okafor — balance sheet
    var ok = getDirectorState("okafor");
    if (ok) {
      var d2a = d2aSafe;
      if (d2a >= 0.30 && d2a <= 0.55) ok.attitude = clamp(ok.attitude + 0.5, 0, 10);
      if (d2a < 0.20 && GameState.meta.year >= 2) ok.attitude = clamp(ok.attitude - 0.5, 0, 10);
      if (d2a > 0.70)                 ok.attitude = clamp(ok.attitude - 0.6, 0, 10);
      if (r.interestCoverage > 2.0)   ok.attitude = clamp(ok.attitude + 0.3, 0, 10);
      if (b.cash < 0) {
        ok.attitude = clamp(ok.attitude - 0.6, 0, 10);
        GameState.board.noOverdraftBroken = true;
      }
    }

    // Petrova — SHAREHOLDERS. She cares purely about the share price rising
    // and hates dilution. No yield concern (that contradicted price).
    var pe = getDirectorState("petrova");
    if (pe) {
      if (h.length > 0) {
        var lastPrice = h[h.length - 1].sharePrice || co.sharePrice;
        if (co.sharePrice > lastPrice * 1.04)      pe.attitude = clamp(pe.attitude + 0.5, 0, 10);
        else if (co.sharePrice < lastPrice * 0.96) pe.attitude = clamp(pe.attitude - 0.5, 0, 10);
        else                                       pe.attitude = clamp(pe.attitude - 0.1, 0, 10); // flat = mild impatience
      }
      if (co.equityIssuanceYear === GameState.meta.year) {
        pe.attitude = clamp(pe.attitude - 0.6, 0, 10);
        GameState.board.noEquityBroken = true;
      }
    }

    // Hassan — operations
    var ha = getDirectorState("hassan");
    if (ha) {
      // Hassan is a demanding operator — he expects HIGH occupancy and is
      // unimpressed by merely "okay" numbers.
      if (r.occupancyPortfolio >= 0.93)      ha.attitude = clamp(ha.attitude + 0.5, 0, 10);  // excellent
      else if (r.occupancyPortfolio >= 0.88) ha.attitude = clamp(ha.attitude + 0.1, 0, 10);  // fine, barely
      else if (r.occupancyPortfolio >= 0.83) ha.attitude = clamp(ha.attitude - 0.4, 0, 10);  // mediocre — displeased
      else                                    ha.attitude = clamp(ha.attitude - 0.8, 0, 10);  // poor — angry
      var worstOcc = GameState.portfolio.length > 0
        ? Math.min.apply(null, GameState.portfolio.map(function(p) { return p.occupancy; }))
        : 1;
      if (worstOcc < 0.70) ha.attitude = clamp(ha.attitude - 0.5, 0, 10);   // a weak property irritates him
      if (GameState.board.leaseUpsThisYear > 0) ha.attitude = clamp(ha.attitude + 0.2, 0, 10);
    }

    // Gentle mean-reversion: directors slowly drift back toward neutral (5)
    // when not being actively failed, so one rough patch doesn't permanently
    // doom you. Only nudges those below neutral upward, by a small amount.
    GameState.board.directors.forEach(function(d) {
      if (d.attitude < 5) d.attitude = clamp(d.attitude + 0.15, 0, 5);
    });
  }

  // ----------------------------------------------------------
  // GENERATE MANDATES for annual meeting
  // ----------------------------------------------------------
  /* -- round 11: two demands a year, each tied to the complaint ---------------
     v1 drew three demands at random from each director's pool, so the
     Chairman could demand "don't cut" right after you promised him a rise.
     Now each director asks for the thing their own scorecard line says is
     wrong, a notch stricter than where you are. A promise you made in the
     room (or a trade you offered) puts that director first. */
  var PCT = { debtToAssets: 1, occupancyPortfolio: 1, worstOccupancy: 1, priceToNav: 1 };
  function mk(id, mandateId, text, metric, target, higher, extra) {
    var shown = PCT[metric] ? Math.round(target * 100) : (Math.round(target * 10) / 10);
    return Object.assign({ directorId: id, mandateId: mandateId, text: typeof text === "function" ? text(shown) : text,
                           metric: metric, target: target, higher: higher, response: null, achieved: null }, extra || {});
  }
  function demandFor(id) {
    var G = GameState, r = G.ratios, co = G.company;
    var cr = typeof Directors !== "undefined" && Directors.crisis && Directors.crisis();
    var sc = typeof Directors !== "undefined" ? Directors.scorecard().filter(function(x) { return x.id === id; }) : [];
    var failing = function(k) { return sc.some(function(x) { return x.ok === false && x.k.indexOf(k) === 0; }); };
    var pnav = r.navPerShare > 0 ? co.sharePrice / r.navPerShare : 1;
    var d2a = r.debtToAssets || 0, occ = r.occupancyPortfolio || 0.9, cov = r.interestCoverage || 9;
    var worst = G.portfolio.length ? Math.min.apply(null, G.portfolio.filter(function(p) { return !p.underConstruction; }).map(function(p) { return p.occupancy; })) : 1;
    switch (id) {
      case "williams":
        if (typeof Directors !== "undefined" && Directors.overPaying && Directors.overPaying() >= 2)   // round 21
          return mk(id, "div_earned", "Pay the dividend from what we earn: no more than our cash profit by next year. I will not count that cut against you.", "payoutOk", 1, true);
        if (cr) return mk(id, "div_nocut", "Hold the dividend through this crisis: no cut at any point this year.", "noDividendCut", 1, true);
        return mk(id, "div_raise", function(t) { return "Raise the dividend by at least " + t + "% this year."; }, "dividendGrowthPct",
                  Math.round(((typeof Directors !== "undefined" ? Directors.williamsTarget() : 0.05) + 0.01) * 100), true);
      case "chen":
        if (failing("Cash profit")) {   // round 17: something you can do, not a number you can only hope for
          var hurdle = Math.round(((typeof Market !== "undefined" ? Market.getCurrentBorrowingRate() : 6) + 1) * 10) / 10;
          return mk(id, "accretive", "Buy at least one building yielding " + hurdle + "% or more: our borrowing cost plus a point. That is how cash profit per share grows.", "accretiveBuysThisYear", 1, true, { hurdle: hurdle });
        }
        return mk(id, "acquisitions", function(t) { return "Buy at least " + t + " building" + (t > 1 ? "s" : "") + " this year."; }, "acquisitionsThisYear", G.meta.year >= 6 ? 2 : 1, true);
      case "okafor":
        var unsec = G.debtTranches.reduce(function(a, t) { return a + (t.unsecured ? t.amount : 0); }, 0);
        if (unsec > 0) return mk(id, "repay_unsec", "Repay all $" + Math.round(unsec) + "M of unsecured notes by next year. No exceptions.", "noUnsecured", 1, true);   // round 19
        // round 34: his line is 55%, crisis or not; above it he asks for one step a year: 55%, or 3 points down if that is further
        if (d2a > 0.55) return mk(id, "leverage", function(t) { return d2a - 0.03 > 0.55 ? "Bring debt down to " + t + "% of assets by next year. One step at a time, but every year." : "Bring debt back under " + t + "% of assets by next year."; }, "debtToAssets", Math.max(0.55, Math.round((d2a - 0.03) * 100) / 100), false);
        if (cov < 2.5) return mk(id, "int_coverage", function(t) { return "Interest cover of at least " + t + "x by next year."; }, "interestCoverage", 2.5, true);
        return mk(id, "int_coverage", function(t) { return "Keep interest cover at " + t + "x or more."; }, "interestCoverage", 2.5, true);   // round 18: was "stay off the credit line"
      case "hassan": case "mansour":
        var floor = id === "mansour" ? 0.90 : 0.86;
        if (worst < 0.75) return mk(id, "no_bad_prop", function(t) { return "No building below " + t + "% occupancy at year end."; }, "worstOccupancy", id === "mansour" ? 0.78 : 0.75, true);
        return mk(id, "occupancy", function(t) { return "Portfolio occupancy of at least " + t + "% by next year."; }, "occupancyPortfolio", Math.min(0.95, Math.max(floor, Math.round((occ + 0.02) * 100) / 100)), true);
      case "petrova":
        // round 35: if she is upset about new shares, the fix she asks for is about new shares
        if (typeof Directors !== "undefined" && /new shares/.test((Directors.card("petrova") || {}).cause || ""))
          return mk(id, "no_equity", "No new shares below 85% of NAV this year.", "noCheapEquity", 1, true);
        if (pnav < 0.70) return mk(id, "pet_buyback", function(t) { return "Buy back at least " + t + "% of our shares this year. We trade at " + Math.round(pnav * 100) + "% of NAV."; }, "buybackPct", 2, true);
        if (pnav > 1.10) return mk(id, "pet_issue", function(t) { return "We trade above NAV. Sell at least " + t + "% new shares this year and put the money to work."; }, "equityIssuedPct", 5, true);
        if (failing("Total return")) return mk(id, "beat_rivals", "Beat the rivals\u2019 total return this year.", "beatRivals", 1, true);
        return mk(id, "price_growth", function(t) { return "Grow the share price at least " + t + "% this year."; }, "sharePriceGrowthPct", 8, true);
      case "grace":
        var e = typeof Story !== "undefined" && Story.esgScore ? Story.esgScore() : 0;
        if (e < 60) return mk(id, "moss_score", function(t) { return "Get our ESG score to at least " + t + "."; }, "esgScore", Math.min(60, e + 15), true);
        return mk(id, "moss_new", "Back at least one new sustainability initiative this year.", "esgNew", 1, true);
      case "activist":
        var w = typeof Directors !== "undefined" && Directors.actWant ? Directors.actWant() : 0.9;
        if (pnav < w) return mk(id, "act_pnav", function(t) { return "Get the share price to at least " + t + "% of NAV."; }, "priceToNav", w, true);
        return mk(id, "act_rivals", "Beat the rivals\u2019 total return this year.", "beatRivals", 1, true);
    }
    return null;   // Tex makes no demands of his friend
  }
  /* opts.first: the director you promised or traded with this meeting. */
  function generateDemands(opts) {
    var b = GameState.board, out = [], used = {};
    var order = (b.directors || []).slice().sort(function(a, c) { return a.attitude - c.attitude; }).map(function(d) { return d.id; });
    if (opts && opts.first) order = [opts.first].concat(order.filter(function(x) { return x !== opts.first; }));
    for (var i = 0; i < order.length && out.length < 2; i++) {
      var m = demandFor(order[i]);
      if (!m || used[m.metric]) continue;
      if (opts && opts.first === order[i] && opts.promise) m.promise = true;
      used[m.metric] = true; out.push(m);
    }
    b.activeMandates = out;
    return out;
  }

  function generateMandates() {
    var year = GameState.meta.year;
    var mandates = [];

    // Pick 3 directors weighted toward lower attitude
    var dirStates = GameState.board.directors.slice().sort(function(a, b) {
      return a.attitude - b.attitude;
    });

    // Always include the two most dissatisfied, plus one random
    var speakers = [dirStates[0], dirStates[1]];
    var remaining = dirStates.slice(2);
    speakers.push(remaining[Math.floor(Math.random() * remaining.length)]);
    // the activist always has a demand (2.0)
    var act = GameState.board.directors.find(function(d) { return d.id === "activist"; });
    if (act && speakers.indexOf(act) === -1) speakers[2] = act;

    speakers.forEach(function(ds) {
      var pool = MANDATE_POOL[ds.id];
      if (!pool) return;
      var mandate = pick(pool);
      var target  = mandate.target(year);
      mandates.push({
        directorId: ds.id,
        mandateId:  mandate.id,
        text:       mandate.text(
          mandate.metric === "debtToAssets" || mandate.metric === "minDebtToAssets" || mandate.metric === "occupancyPortfolio" || mandate.metric === "worstOccupancy" || mandate.metric === "priceToNav"
            ? fmt(target * 100, 0)
            : fmt(target, 1)
        ),
        metric:     mandate.metric,
        target:     target,
        higher:     mandate.higher,
        response:   null,
        achieved:   null,
      });
    });

    GameState.board.activeMandates = mandates;
    return mandates;
  }

  // ----------------------------------------------------------
  // EVALUATE MANDATES at year end
  // ----------------------------------------------------------
  function metricNow() {
    var r   = GameState.ratios;
    var co  = GameState.company;
    var b   = GameState.board;
    var h   = GameState.history;


    // Calculate year metrics
    var ffoGrowthPct = 0;
    if (h.length >= 4) {
      var currFFO = GameState.pnl.ffo * 4;
      var prevFFO = h.length >= 8 ? h[h.length - 5].ffo * 4 : currFFO;
      ffoGrowthPct = prevFFO > 0 ? ((currFFO - prevFFO) / prevFFO) * 100 : 0;
    }
    GameState._lastFFOGrowthPct = ffoGrowthPct;

    var divGrowthPct = b.startYearDividend > 0
      ? ((co.dividendPerShare - b.startYearDividend) / b.startYearDividend) * 100
      : 0;

    var worstOcc = GameState.portfolio.length > 0
      ? Math.min.apply(null, GameState.portfolio.map(function(p) { return p.occupancy; }))
      : 1;

    var startYearSharePrice = b.startYearSharePrice || co.sharePrice;

    var curPortfolioVal = GameState.portfolio.reduce(function(s, p) { return s + p.currentValue; }, 0);
    var portfolioGrowthPct = (b.startYearPortfolio && b.startYearPortfolio > 0)
      ? ((curPortfolioVal - b.startYearPortfolio) / b.startYearPortfolio) * 100
      : 0;

    return {
      dividendYield:       r.dividendYield,
      dividendGrowthPct:   divGrowthPct,
      dividendCoverage:    r.dividendCoverage,
      acquisitionsThisYear:b.acquisitionsThisYear,
      accretiveBuysThisYear: b.accretiveBuysThisYear || 0,
      noUnsecured:         GameState.debtTranches.some(function(t) { return t.unsecured; }) ? 0 : 1,
      ffoGrowthPct:        ffoGrowthPct,
      portfolioGrowthPct:  portfolioGrowthPct,
      totalAssets:         GameState.balance.totalAssets,
      debtToAssets:        r.debtToAssets,
      minDebtToAssets:     r.debtToAssets,
      interestCoverage:    r.interestCoverage,
      noOverdraft:         b.noOverdraftBroken ? 0 : 1,
      noDividendCut:       (GameState.company.dividendCutQuarters || 0) > 0 ? 0 : 1,
      payoutOk:            (function() { var p = window.Financials && Financials.payoutRatio ? Financials.payoutRatio() : null; return p == null || p <= 1.0 ? 1 : 0; })(),
      sharePriceHeld:      co.sharePrice >= startYearSharePrice ? 1 : 0,
      sharePriceGrowthPct: startYearSharePrice > 0 ? ((co.sharePrice - startYearSharePrice) / startYearSharePrice) * 100 : 0,
      noEquityIssued:      b.noEquityBroken ? 0 : 1,
      noCheapEquity:       (b.cheapIssueThisYear || 0) > 0 ? 0 : 1,   // round 35
      noDebtIncrease:      GameState.balance.totalDebt <= (b.startYearDebt || GameState.balance.totalDebt) + 0.5 ? 1 : 0,
      occupancyPortfolio:  r.occupancyPortfolio,
      worstOccupancy:      worstOcc,
      leaseUpsThisYear:    b.leaseUpsThisYear,
      priceToNav:          r.navPerShare > 0 ? co.sharePrice / r.navPerShare : 1,
      esgScore:            window.Story && Story.esgScore ? Story.esgScore() : 0,
      esgNew:              window.Story && Story.esgNewThisYear ? Story.esgNewThisYear() : 0,
      buybackPct:          b.startYearShares > 0 ? (b.buybackSharesThisYear || 0) / b.startYearShares * 100 : 0,
      equityIssuedPct:     b.startYearShares > 0 ? (b.equitySharesThisYear || 0) / b.startYearShares * 100 : 0,
      beatRivals:          (function() { var y = window.Directors && Directors.ytd(); return y && y.you >= y.sector - 0.005 ? 1 : 0; })(),
    };

  }

  /* Numbers behind a demand (2.0): what "easier" means, and how to show it. */
  var COUNT_METRICS = { acquisitionsThisYear: 1, accretiveBuysThisYear: 1, leaseUpsThisYear: 1, esgScore: 1 };
  /* round 17: every demand says how to meet it */
  var HOW = {
    noCheapEquity: "if you need money, borrow or sell a building; sell new shares only when they trade at 85% of NAV or more",
    dividendGrowthPct: "raise the quarterly dividend (Finance screen), and keep cash profit above it",
    noDividendCut: "keep the dividend where it is, even if retained cash dips for a quarter",
    payoutOk: "cut the dividend to what cash profit pays (Finance screen), or grow cash profit by buying and filling buildings",
    acquisitionsThisYear: "buy any building on the market (Map or Properties)",
    accretiveBuysThisYear: "pick a market building whose yield beats the number; pay with bonds, the credit line or preferred shares",
    debtToAssets: "repay bonds or the credit line, sell a building, or sell new shares",
    interestCoverage: "repay the dearest debt, refinance cheaper, or fill empty space",
    noOverdraft: "keep cash above zero all year",
    occupancyPortfolio: "lease up the emptiest buildings (Properties, Lease up); an Asset Manager speeds it up",
    worstOccupancy: "lease up or sell the emptiest building",
    buybackPct: "buy back shares (Finance screen)",
    equityIssuedPct: "sell new shares (Finance screen) and buy buildings with the money",
    beatRivals: "total return is share price plus dividends: beat the league table average",
    sharePriceGrowthPct: "raise the dividend, cut debt, fill empty space: the price follows",
    priceToNav: "raise the dividend or buy back shares, and cut debt",
    esgScore: "back Grace's initiatives when he brings them",
    esgNew: "say yes to Grace's next initiative",
    ffoGrowthPct: "buy buildings that yield more than your borrowing cost, fill empty space, trim overheads",
    noUnsecured: "retire the unsecured notes early from the debt table (a small call premium), with cash, a sale or new shares"
  };
  var SHARE_METRICS = { debtToAssets: 1, minDebtToAssets: 1, occupancyPortfolio: 1, worstOccupancy: 1, priceToNav: 1 };
  function isBinary(m) { return m.target === 1 && !COUNT_METRICS[m.metric] && m.metric !== "ffoGrowthPct"; }
  function easedTarget(m) {
    var t = m.target;
    if (m.metric === "esgScore") return t - 10;
    if (COUNT_METRICS[m.metric]) return Math.max(1, t - 1);
    if (SHARE_METRICS[m.metric]) return m.higher ? t - 0.06 : t + 0.06;
    return m.higher ? t * 0.75 : t * 1.12;
  }
  function targetFor(m) {
    if (m.response === "negotiate") return easedTarget(m);
    if (m.response === "doubledown") return m.target * 1.5;
    return m.target;
  }
  function fmtMetric(m, v) {
    if (v == null || isNaN(v)) return "—";
    if (isBinary(m)) return v >= 1 ? "kept" : "broken";
    if (COUNT_METRICS[m.metric]) return String(Math.round(v));
    if (SHARE_METRICS[m.metric]) return Math.round(v * 100) + "%";
    if (m.metric === "interestCoverage") return v.toFixed(1) + "x";
    return (Math.round(v * 10) / 10) + "%";
  }
  /* For the meeting: the target, the eased target, and where you stand. */
  function mandateNumbers(m) {
    var now = metricNow()[m.metric];
    var growth = /Pct$|ThisYear$/.test(m.metric);
    return {
      // round 34: a target already at its minimum (buy 1 building) cannot be eased: push back means "not this year"
      binary: isBinary(m) || fmtMetric(m, easedTarget(m)) === fmtMetric(m, m.target),
      target: fmtMetric(m, m.target),
      eased:  isBinary(m) ? null : fmtMetric(m, easedTarget(m)),
      now:    fmtMetric(m, now),
      nowLabel: growth ? "Last year" : "Now",
      sign:   m.higher ? "≥" : "≤",
      how:    HOW[m.metric] || "",
    };
  }

  function evaluateMandates() {
    var b = GameState.board;
    var results = [];
    var metricValues = metricNow();

    b.activeMandates.forEach(function(mandate) {
      if (mandate.response === "reject") {
        results.push({ mandate: mandate, achieved: null, skipped: true });
        return;
      }

      var actual  = metricValues[mandate.metric] || 0;
      // eased (pushed back) or doubled down: see targetFor()
      var target  = targetFor(mandate);

      var achieved = mandate.higher ? actual >= target : actual <= target;
      mandate.achieved = achieved;

      var dir = getDirectorState(mandate.directorId);
      if (dir) {
        GameState._attCause = GameState._attCause || {};
        GameState._attCause[dir.id] = (achieved ? "you met his demand: " : "you missed his demand: ") + mandate.text;
        if (mandate.promise) GameState._attCause[dir.id] = (achieved ? "you kept your promise: " : "you broke your promise: ") + mandate.text;
        if (achieved) {
          var gain = mandate.response === "doubledown" ? 4 : mandate.response === "accept" ? 2.5 : 1;
          if (mandate.promise) gain += 1;                    // round 11: your word, kept
          dir.attitude = clamp(dir.attitude + gain, 0, 10);
          // Earn political capital for achieving mandate
          b.politicalCapital = Math.min(b.maxCapital, b.politicalCapital + 1);
        } else {
          // 2.0 round 4: softer (v1: 6 / 4 / 2). A soft game on firing, hard on pressure.
          var loss = mandate.response === "doubledown" ? 4 : mandate.response === "accept" ? 3 : 1.5;
          if (mandate.promise) loss += 1;                    // round 11: your word, broken
          dir.attitude = clamp(dir.attitude - loss, 0, 10);
        }
      }

      results.push({ mandate: mandate, achieved: achieved, actual: actual });
    });

    return results;
  }

  // ----------------------------------------------------------
  // EARN POLITICAL CAPITAL from exceptional performance
  // ----------------------------------------------------------
  function earnPoliticalCapital() {
    var b   = GameState.board;
    var co  = GameState.company;
    var r   = GameState.ratios;
    var h   = GameState.history;
    var earned = [];

    // Dividend raised >25%
    var divGrowth = b.startYearDividend > 0
      ? (co.dividendPerShare - b.startYearDividend) / b.startYearDividend
      : 0;
    if (divGrowth >= 0.25) {
      b.politicalCapital = Math.min(b.maxCapital, b.politicalCapital + 2);
      earned.push("Dividend raised >" + fmt(divGrowth * 100, 0) + "% — +2 political capital");
    } else if (divGrowth >= 0.10) {
      b.politicalCapital = Math.min(b.maxCapital, b.politicalCapital + 1);
      earned.push("Dividend raised " + fmt(divGrowth * 100, 0) + "% — +1 political capital");
    }

    // Share price up >15%
    var startPrice = b.startYearSharePrice || co.sharePrice;
    if (co.sharePrice >= startPrice * 1.15) {
      b.politicalCapital = Math.min(b.maxCapital, b.politicalCapital + 1);
      earned.push("Share price up >" + fmt(((co.sharePrice / startPrice) - 1) * 100, 0) + "% — +1 political capital");
    }

    // Credit rating improved
    var ratingOrder = ["CCC","B","BB","BBB","A","AA","AAA"];
    var startRating = h.length >= 4 ? h[h.length - 4].creditRating : GameState.credit.rating;
    if (ratingOrder.indexOf(GameState.credit.rating) > ratingOrder.indexOf(startRating)) {
      b.politicalCapital = Math.min(b.maxCapital, b.politicalCapital + 1);
      earned.push("Credit rating upgraded to " + GameState.credit.rating + " — +1 political capital");
    }

    // FFO growth >20%
    if (h.length >= 4) {
      var currFFO = GameState.pnl.ffo;
      var prevFFO = h[h.length - 4].ffo || currFFO;
      if (prevFFO > 0 && (currFFO - prevFFO) / prevFFO >= 0.20) {
        b.politicalCapital = Math.min(b.maxCapital, b.politicalCapital + 1);
        earned.push("FFO grew >20% — +1 political capital");
      }
    }

    // round 12: steady sources, so political capital can pay for the stories
    var dirs = b.directors || [], avg = dirs.length ? dirs.reduce(function(a, d) { return a + d.attitude; }, 0) / dirs.length : 5;
    if (!b.probation && avg >= 4.75) {
      b.politicalCapital = Math.min(b.maxCapital, b.politicalCapital + 1);
      earned.push("A content board, a year of goodwill — +1 political capital");
    }
    var yt = typeof Directors !== "undefined" && Directors.ytd ? Directors.ytd() : null;
    if (yt && yt.you > yt.sector) {
      b.politicalCapital = Math.min(b.maxCapital, b.politicalCapital + 1);
      earned.push("Beat the rivals' total return — +1 political capital");
    }
    return earned;
  }
  /* Once a year: a charity gala / the mayor's fund. Money for influence. */
  function hostGala() {
    var b = GameState.board, cost = 0.5;
    if (b.galaYear === GameState.meta.year) return { success: false, message: "One gala a year. Next year." };
    if (b.politicalCapital >= b.maxCapital) return { success: false, message: "Your political capital is already full." };
    b.galaYear = GameState.meta.year;
    GameState._pendingUnusual = Math.round(((GameState._pendingUnusual || 0) - cost) * 100) / 100;
    b.politicalCapital = Math.min(b.maxCapital, b.politicalCapital + 1);
    return { success: true, message: "The Riverton Children's Hospital gala: the mayor sat at your table. +1 political capital ($0.5M, a one-off cost)." };
  }

  // ----------------------------------------------------------
  // CONDUCT VOTE
  // ----------------------------------------------------------
  function conductVote() {
    var votes = GameState.board.directors.map(function(d) {
      var hostile = d.attitude < 3;
      return {
        id:      d.id,
        name:    DIRECTORS.find(function(x) { return x.id === d.id; }).name,
        attitude:d.attitude,
        hostile: hostile,
        veto:    d.id === "williams" && hostile,
      };
    });

    var hostileCount = votes.filter(function(v) { return v.hostile; }).length;
    var williamsVeto = votes.find(function(v) { return v.id === "williams"; }).veto;

    // Williams veto: need 4 confidence votes if he's hostile
    var threshold = williamsVeto ? 4 : 3;
    var confidenceCount = votes.filter(function(v) { return !v.hostile; }).length;
    var fired = confidenceCount < threshold;

    return { votes: votes, fired: fired, hostileCount: hostileCount, confidenceCount: confidenceCount, williamsVeto: williamsVeto };
  }

  // ----------------------------------------------------------
  // RESET YEAR TRACKING
  // ----------------------------------------------------------
  function resetYearTracking() {
    GameState.board.acquisitionsThisYear  = 0;
    GameState.board.accretiveBuysThisYear = 0;
    GameState.board.leaseUpsThisYear      = 0;
    GameState.board.noOverdraftBroken     = false;
    GameState.board.noEquityBroken        = false;
    GameState.board.startYearSharePrice   = GameState.company.sharePrice;
    GameState.board.startYearFFO          = GameState.pnl.ffo;
    GameState.board.startYearDividend     = GameState.company.dividendPerShare;
    GameState.board.startYearDebt         = GameState.balance.totalDebt;
    GameState.board.debtIncreasedThisYear = false;
    GameState.board.startYearPortfolio    = GameState.portfolio.reduce(function(s, p) { return s + p.currentValue; }, 0);
    GameState.board.startYearShares       = GameState.company.sharesOutstanding;
    GameState.board.buybackSharesThisYear = 0;
    GameState.board.equitySharesThisYear  = 0;
    GameState.board.cheapIssueThisYear    = 0;   // round 35
  }

  // ----------------------------------------------------------
  // GENERATE DIRECTOR SPEECH
  // Context-aware dialogue based on metrics and attitude
  // ----------------------------------------------------------
  function generateSpeech(directorId, mandate, attitude) {
    var r  = GameState.ratios;
    var co = GameState.company;
    var b  = GameState.balance;

    var speeches = {
      williams: {
        happy:   ["The dividend programme has been exemplary. Shareholders are well served.", "I am pleased with how you have managed distributions. Keep it up."],
        neutral: ["The board expects continued commitment to shareholder distributions.", "Dividend discipline remains our top priority."],
        angry:   ["I am deeply concerned about our dividend policy. This cannot continue.", "Shareholders are not being adequately rewarded. This must change."],
      },
      chen: {
        happy:   ["Excellent growth momentum. The portfolio is moving in the right direction.", "This is the kind of aggressive expansion I expect. Well done."],
        neutral: ["Growth is acceptable but we can do more. The market has opportunities.", "I want to see bolder acquisition strategy going forward."],
        angry:   ["We are standing still while competitors grow. This is unacceptable.", "Where are the deals? I see cash sitting idle while properties go unsold."],
      },
      okafor: {
        happy:   ["The balance sheet is in excellent shape. Well managed.", "Risk metrics are within acceptable parameters. I am satisfied."],
        neutral: ["I am monitoring our leverage closely. Stay disciplined.", "The balance sheet requires careful attention going forward."],
        angry:   ["Our financial position concerns me greatly.", "I cannot support continued mismanagement of our capital structure."],
      },
      petrova: {
        happy:   ["Shareholders are being rewarded. The market is responding positively.", "Share price performance has been strong. Investors are pleased."],
        neutral: ["I expect continued focus on shareholder value creation.", "The market is watching. Do not disappoint investors."],
        angry:   ["Shareholders are losing patience. The stock performance is embarrassing.", "I am fielding calls from institutional investors. They are not happy."],
      },
      hassan: {
        happy:   ["The portfolio is operationally strong. Occupancy is excellent.", "Properties are performing well. The team has done good work."],
        neutral: ["I want to see continued attention to occupancy levels.", "Some properties need work. Do not let standards slip."],
        angry:   ["Occupancy levels are a disgrace. This is a management failure.", "I visited our properties personally. What I saw was not acceptable."],
      },
    };

    var tone = attitude >= 7 ? "happy" : attitude >= 4 ? "neutral" : "angry";
    var pool = speeches[directorId] ? speeches[directorId][tone] : ["No comment."];
    var intro = pick(pool);

    // Add mandate text
    return intro + " My mandate for Year " + (GameState.meta.year + 1) + ": " + mandate.text;
  }

  // ----------------------------------------------------------
  // EVALUATE QUARTER (called each quarter for attitude updates)
  // Replaces old pressure system
  // ----------------------------------------------------------
  function evaluateQuarter() {
    // 2.0 round 4: directors.js recalculates every mood from performance,
    // memory and allies (v1's updateAttitudes nudged and self-healed).
    if (typeof Directors !== "undefined") Directors.letters(Directors.update());
    else if (GameState.meta.year >= 1) updateAttitudes();

    // Update legacy pressure display from average attitude
    var avgAttitude = GameState.board.directors.reduce(function(s, d) { return s + d.attitude; }, 0) / 5;
    var inversePressure = Math.round((10 - avgAttitude) / 10 * GameState.board.maxPressure);
    GameState.board.pressurePoints = Math.max(0, Math.min(GameState.board.maxPressure, inversePressure));

    var mood = avgAttitude >= 8 ? "pleased" : avgAttitude >= 6 ? "neutral" : avgAttitude >= 4 ? "concerned" : avgAttitude >= 2 ? "angry" : "furious";
    GameState.board.mood = mood;

    // No game over from quarterly check — only from annual vote
    return { pressureChanges: [], totalDelta: 0, currentPressure: GameState.board.pressurePoints, maxPressure: GameState.board.maxPressure, mood: mood, gameOver: false, isTutorial: GameState.meta.tutorialYear };
  }

  // ----------------------------------------------------------
  // GENERATE EARNINGS REPORT (simplified — board meeting replaces detail)
  // ----------------------------------------------------------
  function generateEarningsReport(quarterResult, boardResult) {
    var period  = GameState.currentPeriodLabel();
    var pnl     = quarterResult.pnl;
    var ratios  = quarterResult.ratios;
    var market  = GameState.market;
    var credit  = GameState.credit;
    var isTut   = GameState.meta.tutorialYear;

    var moodHeadlines = {
      pleased:   "✅ " + period + " — Strong Results",
      neutral:   "📋 " + period + " — Steady Quarter",
      concerned: "⚠️ " + period + " — Challenges Emerging",
      angry:     "🔴 " + period + " — Board Dissatisfied",
      furious:   "🚨 " + period + " — Crisis Situation",
    };
    var headline = isTut ? "📚 " + period + " — Orientation Year" : (moodHeadlines[boardResult.mood] || "📋 " + period);

    var body = "NOI: $" + fmt(pnl.noi, 1) + "M | FFO: $" + fmt(pnl.ffo, 1) + "M ($" + fmt(ratios.ffoPerShare, 2) + "/share) | Coverage: " + fmt(ratios.dividendCoverage, 2) + "x\n" +
      "Occupancy: " + fmt(ratios.occupancyPortfolio * 100, 1) + "% | Debt/Assets: " + fmt(ratios.debtToAssets * 100, 1) + "% | Rating: " + credit.rating + "\n" +
      "Base rate: " + fmt(market.baseInterestRate, 2) + "% | Borrow at: " + fmt(market.baseInterestRate + credit.spread, 2) + "% | Cycle: " + market.cycle + "\n" +
      (quarterResult.maturityMsgs && quarterResult.maturityMsgs.length ? quarterResult.maturityMsgs.join(" ") + "\n" : "") +
      (isTut ? "\n[ORIENTATION YEAR — Board is watching silently. No firing until Year 2.]" : "");

    var events = quarterResult.firedEvents || [];
    GameState.eventLog.push({ quarter: GameState.meta.quarter, year: GameState.meta.year, headline: headline, body: body, events: events, pressure: boardResult });

    return { headline: headline, body: body, firedEvents: events, boardResult: boardResult };
  }

  // ----------------------------------------------------------
  // GENERATE ANNUAL REPORT SNAPSHOT (for annual report overlay)
  // ----------------------------------------------------------
  function generateAnnualReport() {
    var year    = GameState.meta.year - 1;
    var history = GameState.history;
    var yearHistory = history.slice(-4);
    if (yearHistory.length === 0) return null;

    var priorSnapshot = GameState.annualSnapshots.length > 0
      ? GameState.annualSnapshots[GameState.annualSnapshots.length - 1] : null;

    var snapshot = {
      year:           year,
      totalRevenue:   fmt(yearHistory.reduce(function(s,h) { return s + (h.grossPotentialRent||0); }, 0), 1),
      totalNOI:       fmt(yearHistory.reduce(function(s,h) { return s + (h.noi||0); }, 0), 1),
      totalFFO:       fmt(yearHistory.reduce(function(s,h) { return s + (h.ffo||0); }, 0), 1),
      totalAFFO:      fmt(yearHistory.reduce(function(s,h) { return s + (h.affo||0); }, 0), 1),
      totalDividends: fmt(yearHistory.reduce(function(s,h) { return s + (h.dividendsPaid||0); }, 0), 1),
      totalRetained:  fmt(yearHistory.reduce(function(s,h) { return s + (h.retainedCash||0); }, 0), 1),
      avgOccupancy:   fmt(yearHistory.reduce(function(s,h) { return s + (h.occupancy||0); }, 0) / yearHistory.length, 3),
      avgCoverage:    fmt(yearHistory.reduce(function(s,h) { return s + (h.dividendCoverage||0); }, 0) / yearHistory.length, 2),
      startPrice:     fmt(priorSnapshot ? priorSnapshot.endPrice : yearHistory[0].sharePrice, 2),
      endPrice:       fmt(yearHistory[yearHistory.length-1].sharePrice, 2),
      priceChg:       fmt(priorSnapshot ? ((yearHistory[yearHistory.length-1].sharePrice - priorSnapshot.endPrice) / priorSnapshot.endPrice * 100) : 0, 1),
      startAssets:    fmt(priorSnapshot ? priorSnapshot.endAssets : yearHistory[0].totalAssets, 1),
      endAssets:      fmt(yearHistory[yearHistory.length-1].totalAssets, 1),
      startDebt:      fmt(priorSnapshot ? priorSnapshot.endDebt : yearHistory[0].totalDebt, 1),
      endDebt:        fmt(yearHistory[yearHistory.length-1].totalDebt, 1),
      startRating:    priorSnapshot ? priorSnapshot.endRating : (yearHistory[0].creditRating || "BBB"),
      endRating:      yearHistory[yearHistory.length-1].creditRating || GameState.credit.rating,
      startProps:     priorSnapshot ? priorSnapshot.endProps : 0,
      endProps:       yearHistory[yearHistory.length-1].portfolioSize,
      yearEvents:     GameState.eventLog.filter(function(e) { return e.year === year; }).flatMap(function(e) { return e.events || []; }).slice(0, 5),
      boardAssessment:{ letter: "The board will convene at the annual meeting to review Year " + year + " performance and issue mandates for Year " + (year+1) + "." },
      nextYearGoals:  [],
    };

    snapshot.bestProp  = GameState.portfolio.length > 0 ? { name: GameState.portfolio.reduce(function(a,b) { return a.occupancy > b.occupancy ? a : b; }).name, occ: fmt(Math.max.apply(null, GameState.portfolio.map(function(p){return p.occupancy;}))*100,1) } : null;
    snapshot.worstProp = GameState.portfolio.length > 0 ? { name: GameState.portfolio.reduce(function(a,b) { return a.occupancy < b.occupancy ? a : b; }).name, occ: fmt(Math.min.apply(null, GameState.portfolio.map(function(p){return p.occupancy;}))*100,1) } : null;

    GameState.annualSnapshots.push(snapshot);
    return snapshot;
  }

  // ----------------------------------------------------------
  // GET BOARD STATUS (for header display)
  // ----------------------------------------------------------
  function getBoardStatus() {
    var dirs = GameState.board.directors || [];
    var hostileCount = dirs.filter(function(d) { return d.attitude < 3; }).length;
    var pct = GameState.board.pressurePoints / GameState.board.maxPressure;
    return {
      pressure:   GameState.board.pressurePoints,
      max:        GameState.board.maxPressure,
      pct:        fmt(pct * 100),
      mood:       GameState.board.mood,
      moodLabel:  GameState.board.mood,
      color:      pct > 0.75 ? "#ef4444" : pct > 0.50 ? "#f59e0b" : "#22c55e",
      isTutorial: GameState.meta.tutorialYear,
      hostileCount: hostileCount,
    };
  }

  // ----------------------------------------------------------
  // STUBS for compatibility
  // ----------------------------------------------------------
  function assessYear1() { return { letter: "Year 1 orientation complete.", startingPressure: 0, performance: "acceptable" }; }
  function setAnnualGoals() { return []; }
  function getTutorialMessage() {
    var msgs = {
      1: "Welcome. Focus on growing your portfolio this year. Buy properties, issue some debt.",
      2: "Your interest coverage needs attention. Check NOI vs interest expense.",
      3: "Review your debt maturity ladder. Avoid clustering maturities.",
      4: "Final quarter of Year 1. The annual board meeting happens at year end from Year 2.",
    };
    return msgs[GameState.meta.quarter] || "";
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    init,
    evaluateQuarter,
    generateEarningsReport,
    generateAnnualReport,
    getBoardStatus,
    updateAttitudes,
    generateMandates,
    hostGala,
    generateDemands,
    demandFor,
    evaluateMandates,
    mandateNumbers,
    metricNow,
    targetFor,
    easedTarget,
    fmtMetric,
    earnPoliticalCapital,
    conductVote,
    resetYearTracking,
    generateSpeech,
    getDirectorState,
    getExpression,
    DIRECTORS,
  };

})();
