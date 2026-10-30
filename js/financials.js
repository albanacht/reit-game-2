// ============================================================
// financials.js — Quarterly P&L engine, ratios, balance sheet
// REIT Simulator Game
// ============================================================
// RULES FOR EDITING THIS FILE:
// - This is the master calculation engine for each quarter
// - Call Financials.runQuarter() once per quarter advance
// - It reads from GameState.portfolio, market, debt, company
// - It writes to GameState.pnl, ratios, balance, history
// - It never generates events — events.js does that
// - It never renders anything — ui.js does that
// ============================================================

window.Financials = (() => {

  // ----------------------------------------------------------
  // CONSTANTS
  // ----------------------------------------------------------
  const OPEX_RATIO        = 0.28;  // Operating expenses as % of gross rent (round 34: was 0.30; Boss Alex: AFFO too thin)
  const GROSS_UP          = 0.30;  // round 34: gross rent is still worked back at 30%, so the cut lowers costs, not rent
  const DEPRECIATION_RATE = 0.020; // Annual depreciation as % of asset value
  /* 2.0: G&A roughly halved (~2% -> ~1% of assets a year on the starting
     portfolio). v1 was a survival game tuned max-harsh; 2.0 is a fight
     between REITs, and overhead that big made every passive company trade at
     ~65% of NAV. The fixed base also gives growth a real scale economy. */
  const GA_BASE           = 0.20;   // Fixed G&A per quarter $M: $0.8M a year (round 37: was 0.25; v1: 0.4)
  const GA_PORTFOLIO_PCT  = 0.0010; // Additional G&A per quarter per $M of portfolio value: 0.4% a year (round 37: was 0.6%; real REITs run overheads at ~6-8% of rent)
  const CAPEX_RESERVE_PCT = 0.005; // Annual normalized capex reserve as % of asset value

  // ----------------------------------------------------------
  // UTILITY
  // ----------------------------------------------------------
  function fmt(n) {
    return Math.round(n * 100) / 100;
  }

  // ----------------------------------------------------------
  // STEP 1 — CALCULATE PORTFOLIO NOI
  // Gross Potential Rent → Vacancy Loss → Net Revenue → NOI
  // ----------------------------------------------------------
  function calcPortfolioNOI() {
    let grossPotentialRent  = 0;
    let vacancyLoss         = 0;
    let netRentalRevenue    = 0;
    let operatingExpenses   = 0;
    let noi                 = 0;

    GameState.portfolio.forEach(prop => {
      // Properties under construction generate zero NOI
      if (prop.underConstruction) return;

      // prop.annualNOI is ALREADY net operating income (clean profit, after
      // operating expenses). We must NOT subtract opex again. Instead we work
      // BACKWARDS from NOI to show a realistic Gross Rent → Vacancy → Opex
      // breakdown that sums correctly and matches the property list.
      //
      // Quarterly clean NOI at full occupancy:
      // rentFactor: a new tenant's rent-free quarters and step-ups (story.js)
      const fullNOIq = prop.annualNOI * (prop.rentFactor != null ? prop.rentFactor : 1) / 4;

      // Gross it up for display: if opex is OPEX_RATIO of gross rent, then
      // NOI (at full occ) = grossRent * (1 - OPEX_RATIO). So gross rent is:
      const propGPR     = fmt(fullNOIq / (1 - GROSS_UP));
      const propOpex    = fmt(propGPR * OPEX_RATIO);
      // Vacancy is the only real haircut applied to NOI (occupancy):
      const propVacancy = fmt(propGPR * (1 - prop.occupancy));
      const propRevenue = fmt(propGPR - propVacancy);
      // Final NOI = gross - vacancy - opex  (lands at fullNOIq * occupancy)
      const propNOI     = fmt(propRevenue - propOpex);

      grossPotentialRent += propGPR;
      vacancyLoss        += propVacancy;
      netRentalRevenue   += propRevenue;
      operatingExpenses  += propOpex;
      noi                += propNOI;
    });


    return {
      grossPotentialRent: fmt(grossPotentialRent),
      vacancyLoss:        fmt(vacancyLoss),
      netRentalRevenue:   fmt(netRentalRevenue),
      operatingExpenses:  fmt(operatingExpenses),
      noi:                fmt(noi),
    };
  }

  // ----------------------------------------------------------
  // STEP 2 — CALCULATE G&A EXPENSE
  // Fixed base + scales with portfolio size
  // ----------------------------------------------------------
  function calcGA() {
    const portfolioValue = GameState.portfolio.reduce(
      (sum, p) => sum + p.currentValue, 0
    );
    let ga = GA_BASE + portfolioValue * GA_PORTFOLIO_PCT;

    // Operations head reduces base G&A by up to 20% (scaled by skill)
    if (typeof Staff !== "undefined" && Staff.hasRole("operations")) {
      const reduction = 0.10 + Staff.skillFactor("operations") * 0.10 + (Staff.hasTrait("operations", "steady") ? 0.06 : 0); // 10-20%, +6% Steady
      ga = ga * (1 - reduction);
    }

    // Add staff salaries (shown as subline inside G&A)
    if (typeof Staff !== "undefined") {
      ga += Staff.totalSalary();
    }


    // Persistent surcharges from decision events (e.g. union settlement,
    // retained-talent bonus). Stored as a flat $M/quarter addition.
    if (GameState._gaSurcharge) ga += GameState._gaSurcharge;
    if (typeof Gary !== "undefined" && Gary.feeQ) ga += Gary.feeQ();   // round 15: Lakeside's fee above the cheapest bid (gary.js)
    if (typeof Pay !== "undefined" && Pay.salaryQ) ga += Pay.salaryQ();   // round 12: your salary (pay.js)
    // round 34: belt-tightening (levi.js): overheads -10% for a year
    const B = GameState._belt, nowQ = (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
    if (B && nowQ <= B.until) ga *= 0.9;

    return fmt(ga);
  }

  // ----------------------------------------------------------
  // STEP 3 — CALCULATE INTEREST EXPENSE
  // Sum across all debt tranches (quarterly = annual rate ÷ 4)
  // ----------------------------------------------------------
  function calcInterestExpense() {
    // bonds + the revolving credit facility (drawn interest + fee on the unused line)
    const rcf = (typeof Revolver !== "undefined" && GameState.revolver) ? Revolver.costQ() : 0;
    return fmt(
      GameState.debtTranches.reduce((sum, tranche) => {
        return sum + (tranche.amount * (tranche.rate / 100) / 4);
      }, 0) + rcf
    );
  }

  // ----------------------------------------------------------
  // STEP 4 — CALCULATE DEPRECIATION
  // Non-cash charge; adds back to get FFO
  // Annual rate applied quarterly
  // ----------------------------------------------------------
  function calcDepreciation() {
    const totalAssetValue = GameState.portfolio.reduce(
      (sum, p) => sum + p.currentValue, 0
    );
    return fmt(totalAssetValue * (DEPRECIATION_RATE / 4));
  }

  // ----------------------------------------------------------
  // STEP 5 — CALCULATE NORMALIZED CAPEX RESERVE
  // Not paid out in cash necessarily, but subtracted for AFFO
  // ----------------------------------------------------------
  function calcCapexReserve() {
    const totalAssetValue = GameState.portfolio.reduce(
      (sum, p) => sum + p.currentValue, 0
    );
    let capex = totalAssetValue * (CAPEX_RESERVE_PCT / 4);

    // Head of Operations — preventive maintenance genuinely lowers capex
    // (fewer emergency repairs). Reduction scales with skill (8-18%). This
    // benefit grows with portfolio size, so the role earns its keep more the
    // bigger you get — without being game-changing.
    if (typeof Staff !== "undefined" && Staff.hasRole("operations")) {
      const capexReduction = 0.08 + Staff.skillFactor("operations") * 0.10 + (Staff.hasTrait("operations", "steady") ? 0.06 : 0); // 8-18%, +6% Steady
      capex = capex * (1 - capexReduction);
    }

    return fmt(capex);
  }

  // ----------------------------------------------------------
  // STEP 6 — ASSEMBLE FULL P&L
  // ----------------------------------------------------------
  function assemblePnL(noComponents, ga, interest, depreciation, capex) {
    const unusualItems = GameState.pnl.unusualItems; // already set by events.js
    const loanInterest = GameState.pnl.loanInterest || 0;   // story.js: interest received on loans to tenants

    // Net Income (GAAP)
    const netIncome = fmt(
      noComponents.noi
      + loanInterest
      - ga
      - interest
      - depreciation
      + unusualItems
    );

    // FFO = Net Income + Depreciation (add back non-cash)
    const ffo = fmt(netIncome + depreciation);

    // AFFO = FFO - Normalized Capex Reserve - leasing costs (round 28: lease ups
    // are brokers' fees and free months, which REITs take out of AFFO; the cash
    // already left when you pressed Lease up, so it is not in cashFlow again)
    const sp = GameState._spendQ || {};
    const leasingCosts = fmt(sp.leasing || 0);
    const affo = fmt(ffo - capex - leasingCosts);
    // round 35: CORE AFFO, what the market prices: without one-off write-offs and recoveries (a loan written off is not lost rent every year)
    const coreAffo = fmt(affo - (GameState.pnl.nonCash || 0));

    // Preferred dividend — a fixed charge paid BEFORE common dividends.
    const preferredDiv = fmt(
      (GameState.preferred ? GameState.preferred.outstanding : 0) *
      (GameState.preferred ? GameState.preferred.dividendRate : 0) / 4
    );

    // Common dividends
    let dividendsPaid = fmt(
      GameState.company.dividendPerShare *
      GameState.company.sharesOutstanding
    );
    /* 2.0 scrip dividend (world.js "scrip_dividend"): for a year, 90% of the
       dividend is paid in new shares at the market price. The headline
       dividend per share is unchanged; cash out drops, share count rises. */
    if (GameState._scripQ > 0 && dividendsPaid > 0) {
      const inShares = fmt(dividendsPaid * 0.9);
      dividendsPaid = fmt(dividendsPaid - inShares);
      GameState.company.sharesOutstanding = fmt(GameState.company.sharesOutstanding +
        inShares / Math.max(0.5, GameState.company.sharePrice));
      GameState._scripQ -= 1;
    }

    // Retained cash (can be negative — danger signal). Preferred dividend
    // comes out of cash flow too.
    const retainedCash = fmt(affo - preferredDiv - dividendsPaid);

    return {
      grossPotentialRent:  noComponents.grossPotentialRent,
      vacancyLoss:         noComponents.vacancyLoss,
      netRentalRevenue:    noComponents.netRentalRevenue,
      operatingExpenses:   noComponents.operatingExpenses,
      noi:                 noComponents.noi,
      gAndA:               ga,
      interestExpense:     interest,
      depreciation:        depreciation,
      unusualItems:        unusualItems,
      loanInterest:        loanInterest,
      netIncome:           netIncome,
      ffo:                 ffo,
      affo:                affo,
      coreAffo:            coreAffo,
      capexReserve:        capex,
      leasingCosts:        leasingCosts,
      projects:            fmt(sp.projects || 0),   // renovations, repositioning, building sites: into the buildings' value, not profit
      preferredDiv:        preferredDiv,
      dividendsPaid:       dividendsPaid,
      retainedCash:        retainedCash,
    };
  }

  // ----------------------------------------------------------
  // STEP 7 — UPDATE BALANCE SHEET
  // Cash moves based on actual cash flows (not depreciation)
  // ----------------------------------------------------------
  function updateBalanceSheet(pnl) {
    // Cash P&L: only real cash flows
    // Overdraft interest on negative cash balance
    // 2.0 round 3: negative cash is the revolving credit facility, and its cost
    // is already inside interestExpense (calcInterestExpense). v1 charged a
    // separate overdraft rate of base + 8% here.
    var overdraftInterest = 0;

    const cashFlow = fmt(
      pnl.noi
      + (pnl.loanInterest || 0)
      - pnl.gAndA
      - pnl.interestExpense
      + pnl.unusualItems
      - (pnl.preferredDiv || 0)
      - pnl.dividendsPaid
      - overdraftInterest
    );

    // No floor — cash can go negative (overdraft)
    GameState.balance.cash = fmt(GameState.balance.cash + cashFlow);
    GameState.pnl.overdraftInterest = overdraftInterest;

    // 2.0: the -$50M overdraft rule is gone. Running past the credit line's
    // limit is a default; revolver.js checks it once the quarter has settled.

    // Total portfolio value (recalculated by properties.js each quarter)
    const portfolioValue = GameState.portfolio.reduce(
      (sum, p) => sum + p.currentValue, 0
    );

    // Total assets: buildings + cash. Negative cash is not an asset: it is the
    // drawn credit line, counted as debt below.
    GameState.balance.totalAssets = fmt(
      Math.max(0, GameState.balance.cash) + portfolioValue
      + (typeof Story !== "undefined" ? Story.otherAssets() : 0)   // loans to / stakes in tenants
    );

    // Total debt: bonds + whatever is drawn on the credit line
    GameState.balance.totalDebt = fmt(
      GameState.debtTranches.reduce((sum, t) => sum + t.amount, 0) + Math.max(0, -GameState.balance.cash)
    );

    // Total equity (residual = assets − debt). This includes preferred.
    var totalEq = fmt(GameState.balance.totalAssets - GameState.balance.totalDebt);
    GameState.balance.preferredEquity = GameState.preferred ? GameState.preferred.outstanding : 0;
    // Common equity is what's left after preferred's claim.
    GameState.balance.totalEquity = fmt(totalEq - GameState.balance.preferredEquity);

    /* INSOLVENCY (2.0). v1 only ended the game at a $50M overdraft, so a
       company that owed more than it owned, or had sold every building,
       kept trading at a dividend-based price. Now: liabilities above assets
       for two quarters in a row, or no buildings left and nothing to show
       for it, puts the company into administration. */
    if (totalEq < 0) GameState.meta._negEqQ = (GameState.meta._negEqQ || 0) + 1;
    else GameState.meta._negEqQ = 0;
    if (!GameState.meta.gameOver &&
        (GameState.meta._negEqQ >= 2 || (GameState.portfolio.length === 0 && totalEq <= 0))) {
      GameState.meta.gameOver = true;
      GameState.meta.gameOverReason = GameState.player.name + ", " + GameState.company.name +
        " owes more than it owns. Lenders have appointed administrators after " +
        GameState.meta.totalQuarters + " quarters.";
    }

    // Market cap
    GameState.company.marketCap = fmt(
      GameState.company.sharePrice *
      GameState.company.sharesOutstanding
    );
  }

  // ----------------------------------------------------------
  // STEP 8 — CALCULATE ALL RATIOS
  // ----------------------------------------------------------
  /* round 28: spending the player does during a turn, for the income statement */
  function noteSpend(kind, amt) { var s = GameState._spendQ = GameState._spendQ || { leasing: 0, projects: 0 }; s[kind] = fmt((s[kind] || 0) + amt); }
  function calcRatios(pnl) {
    const shares     = GameState.company.sharesOutstanding;
    const price      = GameState.company.sharePrice;
    const debt       = GameState.balance.totalDebt;
    const assets     = GameState.balance.totalAssets;
    const equity     = GameState.balance.totalEquity;

    // FFO & AFFO per share. Round 26: per COMMON share, after the preferred
    // dividend (what REITs report: FFO "available to common shareholders").
    const prefDivQ     = pnl.preferredDiv || 0;
    const ffoPerShare  = shares > 0 ? fmt((pnl.ffo - prefDivQ) / shares)  : 0;
    const affoPerShare = shares > 0 ? fmt((pnl.affo - prefDivQ) / shares) : 0;

    // Annualised FFO for valuation ratios
    const annualFFO    = fmt(pnl.ffo * 4);
    const annualAFFO   = fmt(pnl.affo * 4);
    const annualFFOPS  = fmt(ffoPerShare * 4);

    // Dividend coverage (FFO / dividends) — board threshold. null when no div.
    const dividendCoverage = pnl.dividendsPaid > 0
      ? fmt((pnl.ffo - prefDivQ) / pnl.dividendsPaid)
      : null;

    // Payout ratio (dividends / AFFO) — >1.0 is danger. null when AFFO ≤ 0
    // (a payout ratio against negative AFFO is meaningless, not "9900%").
    const payoutRatio = pnl.affo - prefDivQ > 0
      ? fmt(pnl.dividendsPaid / (pnl.affo - prefDivQ))
      : null;

    // Leverage ratios
    const debtToAssets  = assets > 0  ? fmt(debt / assets)  : null;
    const debtToEquity  = equity > 0  ? fmt(debt / equity)  : null;

    // EBITDA approx = NOI - G&A (no tax for REITs)
    const ebitda        = fmt(pnl.noi - pnl.gAndA);
    const annualEbitda  = fmt(ebitda * 4);
    const debtToEbitda  = annualEbitda > 0 ? fmt(debt / annualEbitda) : null;

    // Interest coverage = NOI / Interest (quarterly)
    const interestCoverage = pnl.interestExpense > 0
      ? fmt(pnl.noi / pnl.interestExpense)
      : 99;
    // Round 26: what the rating agencies use. Fixed charges = interest + preferred
    // dividends; and preferred shares count as half debt ("50% equity credit").
    const fixedChargeCoverage = (pnl.interestExpense + prefDivQ) > 0
      ? fmt(pnl.noi / (pnl.interestExpense + prefDivQ))
      : 99;
    const prefOut = (GameState.balance && GameState.balance.preferredEquity) || 0;
    const ratingLeverage = assets > 0 ? fmt((debt + 0.5 * prefOut) / assets) : null;

    // Portfolio occupancy (weighted by property value)
    const totalPortfolioValue = GameState.portfolio.reduce(
      (sum, p) => sum + p.currentValue, 0
    );
    // round 22: land and buildings under construction have no tenants yet; they do not count
    const letting = GameState.portfolio.filter(p => !p.underConstruction);
    const lettingValue = letting.reduce((sum, p) => sum + p.currentValue, 0);
    const weightedOccupancy = lettingValue > 0
      ? fmt(letting.reduce((sum, p) => sum + (p.occupancy * p.currentValue), 0) / lettingValue)
      : 0;

    // NOI margin = NOI / GPR
    const noiMargin = pnl.grossPotentialRent > 0
      ? fmt(pnl.noi / pnl.grossPotentialRent)
      : 0;

    // Implied cap rate = annualized NOI / portfolio value
    const impliedCapRate = totalPortfolioValue > 0
      ? fmt((pnl.noi * 4) / totalPortfolioValue * 100)
      : 0;

    // NAV per share
    const navPerShare = shares > 0 ? fmt(equity / shares) : 0;

    // P/FFO (annualized) — N/A when FFO is non-positive (negative multiple is meaningless)
    const pToFFO = annualFFOPS > 0 ? fmt(price / annualFFOPS) : null;

    // P/AFFO (annualized)
    const annualAFFOPS = fmt(affoPerShare * 4);
    const pToAFFO = annualAFFOPS > 0 ? fmt(price / annualAFFOPS) : null;

    // Dividend yield
    const annualDividend = fmt(GameState.company.dividendPerShare * 4);
    const dividendYield  = price > 0 ? fmt((annualDividend / price) * 100) : 0;

    // Write to GameState
    GameState.ratios = {
      ffoPerShare,
      affoPerShare,
      annualFFOPS,
      annualAFFOPS,
      dividendCoverage,
      payoutRatio,
      debtToAssets,
      debtToEquity,
      debtToEbitda,
      interestCoverage,
      fixedChargeCoverage,
      ratingLeverage,
      occupancyPortfolio: weightedOccupancy,
      noiMargin,
      impliedCapRate,
      navPerShare,
      pToFFO,
      pToAFFO,
      dividendYield,
      ebitda,
    };

    return GameState.ratios;
  }

  // ----------------------------------------------------------
  // STEP 9 — UPDATE SHARE PRICE
  // Driven by: FFO growth, dividend changes, board mood,
  // market cycle, leverage signals
  // ----------------------------------------------------------
  // ----------------------------------------------------------
  // SHARE PRICE — BOND-PROXY MODEL
  // A REIT is priced off its dividend yield. price = annualDividend / targetYield.
  // Target yield sits in a band: healthy REITs command a low yield (premium
  // price), distressed ones are pushed to a high yield (cheap price). The whole
  // band shifts UP with interest rates — when bonds pay more, REITs must too.
  // NAV provides a sanity backstop. Operational quality moves you within the band.
  // ----------------------------------------------------------
  /* PRICE RULE (2.0, design doc B.12c)
       anchor = annual dividend / target yield   (the bracket; stress moves it)
       + NAV pull:  30% of the gap to NAV/share. Upward pull capped at +15% of
                    the anchor; if the stock trades above NAV the pull is down,
                    uncapped.
       + growth:    sustainable growth = min(dividend growth, AFFO/share growth)
                    over the last year, only while the dividend is covered.
                    Adds 2x that growth, capped at +15% of the anchor.
     So the price can sit at most ~30% above the dividend bracket, and only a
     company with both asset backing and real growth gets there.
     `opening` = the first quarter, before any P&L exists: assume healthy. */
  const PRICE = { navPull: 0.30, navCap: 0.15, growthMult: 2.0, growthCap: 0.15 };

  function sustainableGrowth() {
    var h = GameState.history || [];
    if (h.length < 8) return 0;
    var n = h.length;
    var sum = function (from, to) { var t = 0; for (var i = from; i < to; i++) t += (h[i].affoPerShare || 0); return t; };
    var affoNow = sum(n - 4, n), affoPrev = sum(n - 8, n - 4);
    var divNow = h[n - 1].dividendPerShare || 0, divPrev = h[n - 5].dividendPerShare || 0;
    if (affoPrev <= 0 || divPrev <= 0) return 0;
    var g = Math.min(divNow / divPrev - 1, affoNow / affoPrev - 1);
    return Math.max(0, Math.min(0.10, g));
  }

  /* round 21: cash profit (AFFO) per share over the last year, annualised.
     Uses this quarter's P&L if given, plus up to 3 earlier quarters.
     null when there is no history yet. */
  function trailingAffoPS(pnl) {
    var h = GameState.history || [], v = [], sh = GameState.company.sharesOutstanding || 1;
    var core = function (x) { return x.coreAffo != null && isFinite(x.coreAffo) ? x.coreAffo : x.affo; };   // round 35: one-offs excluded
    if (pnl && isFinite(pnl.affo)) v.push((core(pnl) - (pnl.preferredDiv || 0)) / sh);   // round 26: after the preferred dividend
    for (var i = h.length - 1; i >= 0 && v.length < 4; i--) { var e = h[i], ps = e.coreAffoPerShare != null && isFinite(e.coreAffoPerShare) ? e.coreAffoPerShare : e.affoPerShare; v.push(isFinite(ps) ? ps : 0); }
    if (!v.length) return null;
    return v.reduce(function (a, x) { return a + x; }, 0) / v.length * 4;
  }
  /* round 21: the market only prices the dividend your cash profit can pay.
     Up to 110% of trailing AFFO counts as dividend (divided by the yield);
     anything above is a return of capital: worth $1 per $1 paid over the
     next year, not multiplied into the price. Kills "sell the buildings,
     pay it all out, watch the shares fly". */
  var COVER = 1.10;
  /* round 35: the market looks through one bad year: the better of the last 4 and the last 8 quarters */
  function lookThroughAffoPS(pnl) {
    var a4 = trailingAffoPS(pnl), h = GameState.history || [];
    if (h.length < 6) return a4;
    var v = h.slice(-8).map(function (e) { var ps = e.coreAffoPerShare != null ? e.coreAffoPerShare : e.affoPerShare; return isFinite(ps) ? ps : 0; }), a8 = v.reduce(function (x, y) { return x + y; }, 0) / v.length * 4;
    return a4 == null ? a8 : Math.max(a4, a8);
  }
  function sustainableDividend(annualDiv, pnl) {
    var a = lookThroughAffoPS(pnl);
    if (a == null || !isFinite(a)) return { covered: annualDiv, excess: 0 };
    var cap = Math.max(0, a * COVER);
    return { covered: Math.min(annualDiv, cap), excess: Math.max(0, annualDiv - cap) };
  }
  /* the dividend you pay now (annualised) / cash profit per share over the
     last year. A cut counts at once. null = not enough history. */
  function payoutRatio() {
    var h = GameState.history || [];
    if (h.length < 2) return null;
    var d = GameState.company.dividendPerShare * 4, a = trailingAffoPS(null);
    if (d <= 0.0001) return 0;
    return a > 0 ? d / a : 99;
  }

  function fairPrice(pnl, opening) {
    var annualDiv = GameState.company.dividendPerShare * 4;
    var navPS     = GameState.ratios.navPerShare ||
                    (GameState.balance.totalEquity / GameState.company.sharesOutstanding) || 0;
    var rate      = GameState.market.baseInterestRate || 2.5;

    // Base band shifts with rates. A Head of IR tightens the band by 1%.
    var irBonus = (typeof Staff !== "undefined" && Staff.hasRole && Staff.hasRole("ir")) ? 0.3 : 0;   // round 22: a slight lift (was 1.0); IR also softens bad news (updateSharePrice)
    var healthyYield   = rate + 2.5 - irBonus;   // premium end of the band
    var distressYield  = rate + 7.0 - irBonus;   // distressed end of the band

    // Position within the band (0 = healthy, 1 = distressed)
    var stress = 0;
    // 2.0: plain-English reasons, shown in the inbox ("why did the price move")
    var bad = [], good = [];
    var cov = GameState.ratios.dividendCoverage || 0;
    if (!opening) {
      var affo = pnl ? pnl.affo : 0;
      if (affo < 0)        { stress += 0.45; bad.push("you are losing cash (AFFO below zero)"); }
      else if (affo - ((pnl && pnl.preferredDiv) || 0) < GameState.company.dividendPerShare * GameState.company.sharesOutstanding) { stress += 0.20; bad.push("the dividend is bigger than your cash profit"); }
      if (cov < 0.8)       { stress += 0.20; bad.push("dividend cover only " + cov.toFixed(1) + "x"); }
      else if (cov < 1.1)  { stress += 0.10; bad.push("thin dividend cover (" + cov.toFixed(1) + "x)"); }
      else if (cov > 1.8)  { stress -= 0.05; good.push("very safe dividend (" + cov.toFixed(1) + "x cover)"); }
    }
    var d2a = GameState.ratios.debtToAssets || 0;
    if (d2a > 0.60)      { stress += 0.15; bad.push("heavy debt (" + Math.round(d2a * 100) + "% of assets)"); }
    else if (d2a > 0.50) { stress += 0.07; bad.push("rising debt (" + Math.round(d2a * 100) + "% of assets)"); }
    var ratingStress = { AAA:-0.10, AA:-0.07, A:-0.04, BBB:0, BB:0.10, B:0.20, CCC:0.35 };
    var rs = ratingStress[GameState.credit.rating] || 0;
    stress += rs;
    if (rs > 0) bad.push("a junk credit rating (" + GameState.credit.rating + ")");
    if (rs < 0) good.push("a strong credit rating (" + GameState.credit.rating + ")");
    var cycle = GameState.market.cycle;
    if (cycle === "recession")        { stress += 0.10; bad.push("a recession"); }
    else if (cycle === "contracting") { stress += 0.05; bad.push("a slowing economy"); }
    else if (cycle === "expanding")   { stress -= 0.05; good.push("a growing economy"); }
    if (irBonus) good.push("your Head of Investor Relations");
    // round 25: say it when rates moved. The yield band above rides on the base rate,
    // and cap rates follow (market.js), so higher rates mean a lower share price.
    var hR = GameState.history || [], r4 = hR.length >= 4 ? hR[hR.length - 4].baseInterestRate : null;
    if (r4 != null && Math.abs(rate - r4) >= 0.25) {
      if (rate > r4) bad.push("interest rates up " + (rate - r4).toFixed(2) + " points in a year: bonds pay more, so investors want a higher yield from REITs");
      else good.push("interest rates down " + (r4 - rate).toFixed(2) + " points in a year: REIT dividends look better next to bonds");
    }
    stress = Math.max(0, Math.min(0.6, stress));   // round 35: capped (was 1): bad news stacks, but not to a 70% crash

    var targetYield = healthyYield + (distressYield - healthyYield) * stress;

    // Anchor: the dividend bracket. No dividend: steep discount to NAV.
    if (annualDiv <= 0.001) return navPS > 0 ? navPS * 0.35 : 0.5;
    var sd = opening ? { covered: annualDiv, excess: 0 } : sustainableDividend(annualDiv, pnl);
    var anchor = sd.covered / (targetYield / 100) + sd.excess;
    if (sd.excess > 0.005) bad.push("$" + sd.excess.toFixed(2) + " of the $" + annualDiv.toFixed(2) + " dividend is not covered by cash profit: the market counts it as a one-off payout, not income");
    // Liabilities exceed assets: nobody pays for the dividend of an insolvent company.
    if (navPS <= 0) return Math.max(0.5, anchor * 0.15);

    // Growth premium: only real, covered growth
    var growthAdj = 0, g = (!opening && cov >= 1.0) ? sustainableGrowth() : 0;
    if (g > 0) growthAdj = Math.min(anchor * g * PRICE.growthMult, anchor * PRICE.growthCap);

    /* 2.0 round 10: two legs, half each. The dividend leg (what income buyers
       pay) and the NAV leg (what the buildings are worth, marked down for
       stress, up for real growth). v1 was almost all dividend leg, so every
       company traded at 50 to 65% of NAV forever. Now a healthy, growing
       company trades near NAV, a great one above it, a stressed one well below. */
    var navMult = 1.0 - 0.35 * stress + Math.min(0.2, g * 2.5);
    var fair = 0.5 * (anchor + growthAdj) + 0.5 * navPS * navMult;

    // 2.0 round 8: ESG funds (story.js). At ESG 60 the bracket shifts up 5%.
    var esgP = (typeof Story !== "undefined" && Story.esgPremium) ? Story.esgPremium() : 1;
    if (esgP > 1) { fair = fair * esgP; good.push("ESG funds hold your shares (ESG score " + Story.esgScore() + ")"); }
    // round 14: in the National REIT 100, index funds hold about 15% of us (listing.js)
    var idxP = (typeof IndexFund !== "undefined" && IndexFund.premium) ? IndexFund.premium() : 1;
    if (idxP > 1) { fair = fair * idxP; good.push("index funds hold your shares (" + IndexFund.INDEX + ")"); }
    // round 22: campaigns and sponsorships (pr.js), temporary
    var prP = (typeof PR !== "undefined" && PR.premium) ? PR.premium() : 1;
    if (prP !== 1) { fair = fair * prP; (prP > 1 ? good : bad).push(PR.active().map(function (b) { return b.name.toLowerCase(); }).join(", ")); }

    // NAV sanity backstop, as before
    if (navPS > 0) fair = Math.max(navPS * 0.40, Math.min(navPS * 1.6, fair));   // round 35: floor 40% of NAV (was 30%)
    if (growthAdj > 0.01) good.push("real dividend growth");
    if (!opening) GameState._priceWhy = { fair: fmt(fair), yieldWanted: fmt(targetYield), rate: rate,
                                          dividend: annualDiv, bad: bad, good: good };
    return fair;
  }

  function updateSharePrice(pnl) {
    var target = fairPrice(pnl, false);

    // Equity-issuance suppression: dampen for 2 quarters after dilution
    if (GameState.company.equitySuppressQuarters > 0) {
      GameState.company.equitySuppressQuarters--;
      target *= 0.97;
    }
    // Mean-revert toward fair price (35%/quarter) plus small noise, so moves
    // feel gradual rather than instant snaps.
    var cur = GameState.company.sharePrice || target;
    // round 22: a Head of IR works the phones when bad news hits: whatever the
    // price lost since last quarter's close, 30% of it comes back (50% for a Silver Tongue).
    var h = GameState.history || [], last = h.length ? h[h.length - 1].sharePrice : null;
    GameState._irNote = null;
    if (last && cur < last * 0.995 && typeof Staff !== "undefined" && Staff.hasRole && Staff.hasRole("ir")) {
      var soft = Staff.hasTrait && Staff.hasTrait("ir", "silvertongue") ? 0.5 : 0.3, back = (last - cur) * soft, irp = Staff.getStaff("ir");
      GameState._irNote = (irp ? irp.name : "Your Head of IR") + " called the analysts: the share price fell " + ((last - cur) / last * 100).toFixed(1) + "% on the news, then won back " + (back / last * 100).toFixed(1) + " points.";
      cur = cur + back;
    }
    // round 21: the uncovered part of this quarter's dividend left the company.
    // The share goes ex-dividend by that much at once (no lag to exploit).
    var qDiv = GameState.company.dividendPerShare, sdq = sustainableDividend(qDiv * 4, pnl);
    var exDiv = Math.max(0, qDiv - sdq.covered / 4);
    if (exDiv > 0.005) cur = Math.max(0.5, cur - exDiv);
    var noise = 1 + (Math.random() - 0.5) * 0.02;
    var newPrice = (cur * 0.65 + target * 0.35) * noise;

    if (!isFinite(newPrice)) newPrice = isFinite(cur) && cur > 0 ? cur : (GameState.history.length ? GameState.history[GameState.history.length - 1].sharePrice : 10);   // round 22: never let a NaN through
    GameState.company.sharePrice = fmt(Math.max(0.5, newPrice));
  }

  // ----------------------------------------------------------
  // STEP 10 — DEBT MATURITY TICK
  // Reduce quartersUntilMaturity on all tranches
  // Flag any tranches maturing this quarter
  // ----------------------------------------------------------
  function tickDebtMaturities() {
    const matured = [];
    GameState.debtTranches.forEach(tranche => {
      tranche.quartersUntilMaturity =
        GameState.quartersUntilMaturity(
          tranche.maturityYear,
          tranche.maturityQuarter
        );
      if (tranche.quartersUntilMaturity <= 0) {
        matured.push(tranche);
      }
    });
    return matured;
  }

  // ----------------------------------------------------------
  // STEP 11 — HANDLE MATURED DEBT — escalation ladder:
  // 1. Pay with cash if possible
  // 2. Else refinance IF credit allows (distress rate) — needs tranche slot
  // 3. Else forced asset sale at fire-sale discount to raise cash
  // 4. Else fall into overdraft (cash goes negative)
  // 5. Default fires elsewhere if overdraft breaches -$50M
  // ----------------------------------------------------------
  function handleMaturedDebt(maturedTranches) {
    const messages = [];
    maturedTranches.forEach(tranche => {

      // ---- 1. Pay with cash, topped up from the credit line if needed ----
      var canPay = (typeof Revolver !== "undefined" && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash;
      if (canPay >= tranche.amount) {
        var fromLine = fmt(Math.max(0, tranche.amount - Math.max(0, GameState.balance.cash)));
        GameState.balance.cash = fmt(GameState.balance.cash - tranche.amount);
        GameState.debtTranches = GameState.debtTranches.filter(t => t.id !== tranche.id);
        messages.push(`${tranche.label} matured — retired with $${tranche.amount}M` + (fromLine > 0 ? ` ($${fromLine}M of it from the credit line).` : ` cash.`));
        if (typeof News !== "undefined" && News.add) {
          News.add(GameState.company.name + " repaid $" + tranche.amount + "M of maturing debt on schedule.", "debt");
        }
        return;
      }

      // ---- 2. round 19: a bond is not a credit line. Nobody rolls it for you:
      //      if cash plus the line cannot repay it on the day, the company defaults.
      if (!GameState.meta.gameOver) {
        GameState.meta.gameOver = true;
        GameState.meta.gameOverReason = GameState.player.name + ", " + GameState.company.name + " has defaulted: " + tranche.label + " ($" + tranche.amount + "M) fell due and cash plus the credit line could not repay it. The bondholders have called every loan.";
        messages.push("DEFAULT: " + tranche.label + " ($" + tranche.amount + "M) fell due and could not be repaid.");
        if (typeof News !== "undefined" && News.add) News.add(GameState.company.name + " defaults on $" + tranche.amount + "M of bonds.", "debt");
      }
    });
    return messages;
  }

  // ----------------------------------------------------------
  // STEP 12 — SAVE TO HISTORY
  // One entry per quarter for charts and trend analysis
  // ----------------------------------------------------------
  function saveToHistory(pnl) {
    GameState.history.push({
      quarter:        GameState.meta.quarter,
      year:           GameState.meta.year,
      totalQuarters:  GameState.meta.totalQuarters,
      label:          GameState.currentPeriodLabel(),

      // P&L
      grossPotentialRent: pnl.grossPotentialRent,
      noi:                pnl.noi,
      interestExpense:    pnl.interestExpense,
      gAndA:              pnl.gAndA,
      unusualItems:       pnl.unusualItems,
      netIncome:          pnl.netIncome,
      ffo:                pnl.ffo,
      affo:               pnl.affo,
      dividendsPaid:      pnl.dividendsPaid,
      retainedCash:       pnl.retainedCash,

      // Ratios
      ffoPerShare:        GameState.ratios.ffoPerShare,
      affoPerShare:       GameState.ratios.affoPerShare,
      coreAffoPerShare:   pnl.coreAffo != null ? fmt((pnl.coreAffo - (pnl.preferredDiv || 0)) / (GameState.company.sharesOutstanding || 1)) : GameState.ratios.affoPerShare,   // round 35
      dividendPerShare:   GameState.company.dividendPerShare,
      dividendCoverage:   GameState.ratios.dividendCoverage,
      debtToAssets:       GameState.ratios.debtToAssets,
      interestCoverage:   GameState.ratios.interestCoverage,
      occupancy:          GameState.ratios.occupancyPortfolio,

      // Balance sheet
      cash:               GameState.balance.cash,
      totalAssets:        GameState.balance.totalAssets,
      totalDebt:          GameState.balance.totalDebt,
      totalEquity:        GameState.balance.totalEquity,

      // Market
      sharePrice:         GameState.company.sharePrice,
      marketCap:          GameState.company.marketCap,
      baseInterestRate:   GameState.market.baseInterestRate,
      creditRating:       GameState.credit.rating,
      marketCycle:        GameState.market.cycle,

      // Portfolio
      portfolioSize:      GameState.portfolio.length,
      pressurePoints:     GameState.board.pressurePoints,
    });
  }

  // ----------------------------------------------------------
  // CAPITAL ACTIONS
  // These are called by the player before advancing the quarter
  // ----------------------------------------------------------

  // Issue new debt tranche
  function getTermPremium(years) {
    if (years <= 1)  return 0.00;  // 1yr: no premium
    if (years <= 2)  return 0.15;  // 2yr: small premium
    if (years <= 3)  return 0.30;  // 3yr: medium
    if (years <= 5)  return 0.50;  // 5yr: standard
    if (years <= 7)  return 0.75;  // 7yr: long term
    return 1.00;                   // 10yr: maximum
  }

  function getCurrentBorrowingRateForTerm(years) {
    return fmt(Market.getCurrentBorrowingRate() + getTermPremium(years));
  }

  /* The bond covenant: total debt at most this share of assets. A CFO can
     ask the bondholders, once, to raise it to 65% for a consent fee (round 10). */
  function covenantLimit() { return (GameState.credit && GameState.credit.covenantLimit) || 0.60; }
  function amendCovenant() {
    if ((GameState.credit.covenantLimit || 0.60) >= 0.65) return { success: false, message: "Already amended to 65%." };
    if (!(typeof Staff !== "undefined" && Staff.hasRole("financial"))) return { success: false, message: "Only a CFO can negotiate with the bondholders. Hire one on the Staff screen." };
    var bonds = GameState.debtTranches.reduce(function(a, t) { return a + t.amount; }, 0);
    var fee = fmt(Math.max(0.25, bonds * 0.005));
    GameState._pendingUnusual = fmt((GameState._pendingUnusual || 0) - fee);
    GameState.credit.covenantLimit = 0.65;
    if (typeof Directors !== "undefined") Directors.remember('okafor', -0.5, 'you loosened the bond covenants');
    return { success: true, message: "The bondholders agreed: total debt may now reach 65% of assets. Consent fee $" + fee + "M (a one-off cost this quarter)." };
  }
  function consentFee() { return fmt(Math.max(0.25, GameState.debtTranches.reduce(function(a, t) { return a + t.amount; }, 0) * 0.005)); }

  var UNSEC_BAND = 0.10, UNSEC_PREMIUM = 2.0;
  function hasCFO() { return typeof Staff !== "undefined" && Staff.hasRole && Staff.hasRole("cfo"); }
  /* How much more we may borrow: secured up to the covenant, unsecured 10% beyond it. */
  function debtRoom() {
    var now = (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
    var due = GameState.debtTranches.reduce(function(a, t) { var left = (t.maturityYear - 1) * 4 + t.maturityQuarter - now; return a + (left >= 0 && left <= 2 ? t.amount : 0); }, 0);
    var d = GameState.debtTranches.reduce(function(a, t) { return a + t.amount; }, 0) + Math.max(0, -GameState.balance.cash) - due;
    var A = GameState.portfolio.reduce(function(a, p) { return a + p.currentValue; }, 0) + Math.max(0, GameState.balance.cash) + (typeof Story !== "undefined" && Story.otherAssets ? Story.otherAssets() : 0);
    var lim = covenantLimit();
    // real indentures allow "permitted refinancing": you may always replace a bond falling due, even above the covenant
    var sec = Math.max(due, Math.max(0, (lim * A - d) / (1 - lim)));
    var uns = Math.max(0, ((lim + UNSEC_BAND) * A - d) / (1 - lim - UNSEC_BAND) - sec);
    return { secured: fmt(sec), unsecured: fmt(uns), refinancing: fmt(due), limit: lim, unsecLimit: lim + UNSEC_BAND, premium: UNSEC_PREMIUM,
             unsecuredOut: fmt(GameState.debtTranches.reduce(function(a, t) { return a + (t.unsecured ? t.amount : 0); }, 0)) };
  }
  var MAX_YEARS = 7;
  function issueDebt(amount, years, unsecured) {
    if (GameState.debtTranches.length >= 12) {
      return { success: false, message: "Maximum debt tranches reached. Retire existing debt first." };
    }
    if (amount <= 0) return { success: false, message: "Amount must be greater than zero." };
    // round 27: 7 years at most. In a 15-year game a 10-year bond locks in Year 1 rates past the crisis.
    if (years > MAX_YEARS) years = MAX_YEARS;
    /* round 19: two layers of bonds.
         Secured bonds: up to the covenant, 60% of assets (65% if a CFO had it amended).
         Unsecured notes: only once secured room is used up, with a CFO, for a further 10% of
         assets, at +2% a year. Okafor hates them and wants them repaid within a year.
       Bonds falling due within two quarters do not count: borrowing to repay them is refinancing. */
    var lim = covenantLimit(), room = debtRoom();
    if (!unsecured) {
      if (amount > room.secured + 0.05) {
        return { success: false, message: "Secured bonds are capped at " + Math.round(lim * 100) + "% of assets (your covenant). Room left: $" + Math.floor(room.secured) + "M." +
          (room.secured < 1 ? (hasCFO() ? " Beyond it: unsecured notes, up to " + Math.round((lim + UNSEC_BAND) * 100) + "% (Issue debt, unsecured)." : " Beyond it a CFO can raise unsecured notes, up to " + Math.round((lim + UNSEC_BAND) * 100) + "%.") : "") };
      }
      var lastDebtQ = GameState.company.debtIssuanceQuarter || 0, quartersSince = GameState.meta.totalQuarters - lastDebtQ;
      if ((GameState.ratios.debtToAssets || 0) >= 0.50 && lastDebtQ > 0 && quartersSince < 2 && amount > room.refinancing + 0.05) {   // refinancing a bond about to fall due is always allowed
        return { success: false, message: "You're above 50% leverage: lenders need time between issuances. Wait " + (2 - quartersSince) + " more quarter(s)." };
      }
    } else {
      if (!hasCFO()) return { success: false, message: "Unsecured notes need a CFO. Hire one on the Staff screen." };
      if (room.secured >= 1) return { success: false, message: "Use secured bonds first: $" + Math.floor(room.secured) + "M of room left under the " + Math.round(lim * 100) + "% covenant." };
      if (amount > room.unsecured + 0.05) return { success: false, message: "Unsecured notes stop at " + Math.round((lim + UNSEC_BAND) * 100) + "% of assets. Room left: $" + Math.floor(room.unsecured) + "M." };
    }

    var rate    = getCurrentBorrowingRateForTerm(years);
    if (unsecured) rate = fmt(rate + UNSEC_PREMIUM);
    if (typeof Staff !== "undefined" && Staff.hasTrait && (Staff.hasTrait("cfo", "disciplined") || Staff.hasTrait("financial", "disciplined"))) rate = fmt(rate - 0.25);   // round 22
    var matYear = GameState.meta.year + years;
    var matQ    = GameState.meta.quarter;
    var id      = "d" + Date.now();
    var label   = rate + "% " + (unsecured ? "Unsec. Notes" : "Sr Notes") + " due Y" + matYear + "Q" + matQ;

    GameState.debtTranches.push({
      id:                   id,
      amount:               fmt(amount),
      rate:                 rate,
      maturityQuarter:      matQ,
      maturityYear:         matYear,
      quartersUntilMaturity:years * 4,
      label:                label,
      unsecured:            !!unsecured,
      issuedQ:              GameState.meta.totalQuarters + 1,
    });
    if (unsecured && typeof Directors !== "undefined") Directors.remember("okafor", -1.5, "you issued unsecured notes");

    GameState.balance.cash = fmt(GameState.balance.cash + amount);
    GameState.company.debtIssuanceQuarter = GameState.meta.totalQuarters;

    if (typeof News !== "undefined" && News.debtIssued) {
      News.debtIssued(amount, rate, years);
    }

    return {
      success: true,
      message: `Issued $${amount}M of ${rate}% notes due Y${matYear}Q${matQ}. Cash increased by $${amount}M.`,
      rate,
    };
  }

  // Retire debt tranche early
  // Call premium: 2.5% of principal per the bond indenture (issuer's early
  // redemption right). Flat rate for simplicity.
  const CALL_PREMIUM_PCT = 0.025;

  function getCallInfo(trancheId) {
    const tranche = GameState.debtTranches.find(t => t.id === trancheId);
    if (!tranche) return null;
    const premium = fmt(tranche.amount * CALL_PREMIUM_PCT);
    return {
      principal: fmt(tranche.amount),
      premium:   premium,
      total:     fmt(tranche.amount + premium),
      label:     tranche.label,
    };
  }

  function retireDebt(trancheId) {
    const tranche = GameState.debtTranches.find(t => t.id === trancheId);
    if (!tranche) return { success: false, message: "Tranche not found." };

    // Call premium per indenture: 2.5% of principal
    const premium   = fmt(tranche.amount * CALL_PREMIUM_PCT);
    const totalCost = fmt(tranche.amount + premium);

    if (((typeof Revolver !== "undefined" && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash) < totalCost) {
      return {
        success: false,
        message: `Insufficient cash to call this bond. Need $${totalCost}M (principal $${tranche.amount}M + $${premium}M call premium).`,
      };
    }

    GameState.balance.cash = fmt(GameState.balance.cash - totalCost);
    GameState.debtTranches = GameState.debtTranches.filter(t => t.id !== trancheId);

    if (typeof News !== "undefined" && News.add) {
      News.add(GameState.company.name + " called $" + tranche.amount + "M of notes early, paying a " + (CALL_PREMIUM_PCT*100) + "% premium.", "debt");
    }

    return {
      success: true,
      message: `Called ${tranche.label}. Paid $${totalCost}M (principal + $${premium}M call premium).`,
    };
  }

  // ----------------------------------------------------------
  // PREFERRED SHARES (round 17b). Only for the big story decisions, and only
  // with the board's blessing: never a standing button, so a player who has
  // already borrowed to the hilt cannot keep pulling money from them.
  //   - each issue is its own SERIES with a coupon fixed on the day it is sold:
  //     base rate + our credit spread + any crisis spread + 2.5% (they rank
  //     below every bond, so they cost more than bonds)
  //   - paid before the common dividend; not debt (no covenant hit)
  //   - capped at 30% of total assets
  //   - callable at par only after 5 years (real preferreds are non-callable
  //     for about five years), so you cannot swap them for cheap bonds next quarter
  // GameState.preferred.outstanding / dividendRate stay as the totals the P&L reads.
  // ----------------------------------------------------------
  var PREF_JUNIOR = 2.5, PREF_CALL_Q = 20, PREF_CAP = 0.20;   // round 27: 20% of assets (was 30%); real REITs rarely go past 10-15% of capital
  function prefSeries() {
    var P = GameState.preferred;
    if (!P.series) {
      P.series = [];
      if ((P.outstanding || 0) > 0) P.series.push({ id: "p0", amount: fmt(P.outstanding), rate: P.dividendRate || 0.07, q: 0, callQ: 0, why: "earlier issue" });
    }
    return P.series;
  }
  function syncPref() {
    var P = GameState.preferred, S = prefSeries(), tot = S.reduce(function(a, x) { return a + x.amount; }, 0);
    P.outstanding = fmt(tot); P.shares = fmt(tot / 25); P.parValue = 25; P.issued = tot > 0;
    P.dividendRate = tot > 0 ? Math.round(S.reduce(function(a, x) { return a + x.amount * x.rate; }, 0) / tot * 10000) / 10000 : 0;
  }
  function prefRate() {
    var arc = (typeof Arc !== "undefined" && Arc.spreadAdd) ? Arc.spreadAdd() : 0;
    return Math.round(((GameState.market.baseInterestRate || 3) + (GameState.credit.spread || 1.5) + arc + PREF_JUNIOR) * 100) / 10000;
  }
  function prefRoom() { return fmt(Math.max(0, (GameState.balance.totalAssets || 0) * PREF_CAP - ((GameState.preferred && GameState.preferred.outstanding) || 0))); }
  var yq = function(q) { return "Y" + (Math.floor((q - 1) / 4) + 1) + " Q" + (((q - 1) % 4) + 1); };
  function issuePreferredFor(amount, why) {
    amount = fmt(Math.ceil(amount * 10) / 10);
    if (amount <= 0) return { success: false, message: "Nothing to raise." };
    if (amount > prefRoom() + 0.01) return { success: false, message: "Preferred shares are capped at 20% of total assets ($" + prefRoom() + "M of room left)." };
    var S = prefSeries(), rate = prefRate(), now = GameState.meta.totalQuarters + 1;
    S.push({ id: "p" + now + "_" + S.length, amount: amount, rate: rate, q: now, callQ: now + PREF_CALL_Q, why: why || "" });
    syncPref();
    GameState.balance.cash = fmt(GameState.balance.cash + amount);
    capLog("pref", "$" + amount + "M of " + (rate * 100).toFixed(2) + "% preferred shares sold" + (why ? " (" + why + ")" : ""));
    if (typeof News !== "undefined" && News.add) News.add(GameState.company.name + " sells $" + amount + "M of " + (rate * 100).toFixed(2) + "% preferred shares.", "capital");
    return { success: true, message: "Sold $" + amount + "M of " + (rate * 100).toFixed(2) + "% preferred shares: $" + fmt(amount * rate) + "M a year to the preferred holders, before the common dividend. Callable from " + yq(now + PREF_CALL_Q) + "." };
  }
  /* legacy entry (old saves, old callers): one series at the given rate */
  function issuePreferred(shares, parValue, annualRate) {
    var amt = fmt(shares * (parValue || 25)), S = prefSeries(), now = GameState.meta.totalQuarters + 1;
    S.push({ id: "p" + now + "_" + S.length, amount: amt, rate: annualRate, q: now, callQ: now + PREF_CALL_Q, why: "" });
    syncPref(); GameState.balance.cash = fmt(GameState.balance.cash + amt);
    return { success: true, message: "Issued $" + amt + "M of " + (annualRate * 100).toFixed(2) + "% preferred shares." };
  }
  /* round 32: what a series was sold for, in words (old saves stored the card title) */
  function prefPurpose(why) {
    var w = String(why || "");
    if (/distribution centre/i.test(w)) return "to buy the Harlow Distribution Centre";
    if (/Harlow/i.test(w) && /loan/i.test(w)) return "to lend to Harlow Grocers";
    if (/Port Logistics/i.test(w)) return "to buy Port Logistics";
    if (/Morrow/i.test(w)) return "to bid for Morrow Plaza";
    if (/Celestial|Fifth Street|tower/i.test(w)) return "for Celestial Heights";
    return w ? "for: " + w : "";
  }
  /* The board's conversation when preferred shares come up on a big decision. */
  function prefBoardOK() {
    if (typeof Directors === "undefined") return true;
    var ch = Directors.chair(), d = (GameState.board.directors || []).find(function(x) { return x.id === ch; });
    return !d || d.attitude >= 1.75;   // round 32: only a Furious chair refuses (was: Unhappy too, which locked every way to pay)
  }
  function prefDebate(rate) {
    if (typeof Directors === "undefined") return [];
    var has = Directors.has, first = function(ids) { for (var i = 0; i < ids.length; i++) if (has(ids[i])) return ids[i]; return null; };
    var no = first(["okafor", "petrova"]), yes = first(["hassan", "chen", "mansour", "tex"]), mid = first(["petrova", "chen", "williams"].filter(function (x) { return x !== no && x !== yes; })), ch = Directors.chair(), out = [];
    if (no) out.push([no, "Not another dollar of debt for this. I will not vote for it."]);
    if (yes) out.push([yes, "Then not debt. Preferred shares: " + (rate * 100).toFixed(2) + "% fixed, paid before the common dividend, nothing on the covenant."]);
    if (mid) out.push([mid, "Or split it: half bonds, half preferred shares. Neither the bondholders nor the preferred holders carry all of it."]);   // round 27
    if (ch) out.push([ch, prefBoardOK() ? "For this, and only this, the board approves it." : "Not while this board is this unhappy with you. No."]);
    return out;
  }
  function prefDebateHTML(rate) {
    return '<div class="dv-nums" style="margin-top:6px"><b>Paying for it</b></div>' + prefDebate(rate).map(function(l) {
      var n = Directors.name(l[0]).replace(/^(Chairman|Chair|Director) /, "");
      return '<div class="dv"><img src="assets/faces/' + l[0] + '.jpg" alt=""><div><b>' + n + ':</b> "' + l[1] + '"</div></div>';
    }).join("");
  }
  /* A sibling choice for a story card: the same decision, paid for with preferred shares. */
  function prefChoice(choice, amount, opts) {
    // round 18: preferred shares pay for the part your CASH cannot (keeping $5M in hand); the credit line is left alone.
    // If you have the cash already, they pay for all of it (up to the cap).
    var cashUse = Math.max(0, Math.min(amount, GameState.balance.cash - 5));
    var shortBy = amount - cashUse;
    // round 27: only the part your cash cannot pay. With the cash in hand there is nothing to approve.
    var amt = fmt(Math.ceil(Math.max(0, shortBy) * 10) / 10), rate = prefRate();
    if (amt < 0.1) return { amount: 0, rate: rate, label: (opts && opts.label) || (choice.label + ", paid with preferred shares"),
      detail: "Not needed: you have the cash. The board does not sell preferred shares the company does not need.",
      check: function () { return false; }, checkMsg: "You have the cash for this", apply: function () { return ""; } };
    var fromCash = fmt(Math.max(0, amount - amt));
    var why = (opts && opts.why) || "";
    return {
      amount: amt, rate: rate,
      label: (opts && opts.label) || (choice.label + ", paid with preferred shares"),
      detail: "The cost: $" + fmt(amount) + "M = $" + amt + "M of preferred shares" + (fromCash > 0.05 ? " + $" + fromCash + "M of your cash" : "") + ". The board approves the preferred shares for this deal only: " + (rate * 100).toFixed(2) + "% fixed (base rate + our spread + 2.5%), $" + fmt(amt * rate) + "M a year before the common dividend, callable after 5 years; not debt. Then: " + (choice.detail || ""),
      check: function () { return amt > 0 && prefRoom() >= amt && prefBoardOK(); },
      checkMsg: !prefBoardOK() ? "The Chairman will not approve it while the board is this unhappy" : "Preferred shares are capped at 20% of total assets ($" + prefRoom() + "M of room): split it with bonds instead",
      apply: function () { var r = issuePreferredFor(amt, why); if (!r.success) return r.message; var m = choice.apply(); return r.message + " " + (m || ""); }
    };
  }
  /* round 27: the split. For a story deal only: whatever cash cannot pay is
     raised half with a 5-year deal bond and half with preferred shares (the
     preferred half shrinks to fit the 20% cap; the bond takes the rest). If the
     bond half would break the 60% covenant, the bondholders waive it for this
     deal: a consent fee of 1% on the excess and +0.5% on the deal bond. So a
     story deal can always be paid for, at a price: Okafor −1 (−2 with a waiver),
     and the rating feels both halves. */
  function splitPlan(amount) {
    var shortBy = fmt(Math.max(0, amount - Math.max(0, GameState.balance.cash - 5)));
    var pref = prefBoardOK() ? Math.floor(Math.min(shortBy / 2, prefRoom() - 0.05) * 10) / 10 : 0; if (pref < 0.1) pref = 0;
    var bond = fmt(shortBy - pref);
    var room = Math.max(0, debtRoom().secured), over = fmt(Math.max(0, bond - room));
    var rate = fmt(getCurrentBorrowingRateForTerm(5) + (over > 0 ? 0.5 : 0)), fee = fmt(over * 0.01);
    return { shortBy: shortBy, pref: pref, bond: bond, over: over, rate: rate, fee: fee, prefRate: prefRate() };
  }
  function splitChoice(choice, amount, opts) {
    var P = splitPlan(amount), why = (opts && opts.why) || "";
    if (P.shortBy < 0.1) return { label: "Half bonds, half preferred shares", detail: "Not needed: you have the cash.", check: function () { return false; }, checkMsg: "You have the cash for this", apply: function () { return ""; } };
    return {
      label: (P.pref > 0 ? "Half bonds, half preferred shares: $" : "Borrow it: 5-year deal bonds, $") + P.shortBy + "M",
      detail: "$" + P.bond + "M of 5-year deal bonds at " + P.rate.toFixed(2) + "%" + (P.pref > 0 ? " + $" + P.pref + "M of preferred shares at " + (P.prefRate * 100).toFixed(2) + "%" : (prefBoardOK() ? (prefRoom() < 1 ? " (preferred shares are at their 20% cap, so it is all debt)" : "") : " (the chair is too angry to approve preferred shares, so it is all debt)")) +
              (P.over > 0 ? ". $" + P.over + "M of it is above your bond covenant: the bondholders waive it for this deal (consent fee $" + P.fee + "M, +0.5% on the deal bond)" : "") +
              ". Okafor " + (P.over > 0 ? "−2" : "−1") + ". Then: " + (choice.detail || ""),
      check: function () { return true; }, checkMsg: "",   // round 32: bonds are management's call; without the chair's blessing the preferred half becomes bonds too
      apply: function () {
        var P2 = splitPlan(amount), msgs = [];
        if (P2.pref >= 0.1) { var r = issuePreferredFor(P2.pref, why); msgs.push(r.message); if (!r.success) { P2.bond = fmt(P2.bond + P2.pref); P2.pref = 0; } }   // if the preferred half fails, the bond takes it
        if (P2.bond >= 0.1) {
          var matYear = GameState.meta.year + 5, matQ = GameState.meta.quarter;
          GameState.debtTranches.push({ id: "dl" + Date.now(), amount: P2.bond, rate: P2.rate, maturityQuarter: matQ, maturityYear: matYear, quartersUntilMaturity: 20,
                                        label: P2.rate + "% Deal Notes due Y" + matYear + "Q" + matQ + (why ? " (" + why + ")" : ""), unsecured: false, issuedQ: GameState.meta.totalQuarters + 1 });
          GameState.balance.cash = fmt(GameState.balance.cash + P2.bond);
          if (P2.fee > 0) GameState._pendingUnusual = fmt((GameState._pendingUnusual || 0) - P2.fee);
          capLog("debt", "$" + P2.bond + "M of " + P2.rate + "% deal notes" + (P2.over > 0 ? " (covenant waived for this deal)" : ""));
          msgs.push("Sold $" + P2.bond + "M of " + P2.rate + "% deal notes due Y" + matYear + "Q" + matQ + (P2.over > 0 ? "; the bondholders waived the covenant for this deal ($" + P2.fee + "M consent fee)" : "") + ".");
        }
        if (typeof Directors !== "undefined") Directors.remember("okafor", P2.over > 0 ? -2 : -1, P2.over > 0 ? "you borrowed past the covenant for a deal" : "more debt for a deal");
        var m = choice.apply(); return msgs.join(" ") + " " + (m || "");
      }
    };
  }
  /* Redeem one series at par, once it is callable (5 years after issue). */
  function redeemSeries(id) {
    var S = prefSeries(), x = S.find(function(s) { return s.id === id; }), now = GameState.meta.totalQuarters + 1;
    if (!x) return { success: false, message: "No such series." };
    if (now < x.callQ) return { success: false, message: "Not callable until " + yq(x.callQ) + "." };
    var spend = (typeof Revolver !== "undefined" && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash;
    if (spend < x.amount) return { success: false, message: "Need $" + x.amount + "M (cash plus credit line) to buy them back at par." };
    GameState.balance.cash = fmt(GameState.balance.cash - x.amount);
    S.splice(S.indexOf(x), 1); syncPref();
    capLog("pref", "$" + x.amount + "M of preferred shares redeemed");
    return { success: true, message: "Redeemed $" + x.amount + "M of " + (x.rate * 100).toFixed(2) + "% preferred shares at par: $" + fmt(x.amount * x.rate) + "M a year less to pay." };
  }
  function redeemPreferred() {            // legacy button: every callable series
    var now = GameState.meta.totalQuarters + 1, c = prefSeries().filter(function(s) { return now >= s.callQ; });
    if (!c.length) return { success: false, message: "No preferred series is callable yet (5 years after issue)." };
    var msgs = c.map(function(s) { return redeemSeries(s.id).message; });
    return { success: true, message: msgs.join(" ") };
  }
  function prefList() { var now = GameState.meta.totalQuarters + 1; return prefSeries().map(function(s) { return Object.assign({ callable: now >= s.callQ, callLabel: yq(s.callQ), issuedLabel: s.q ? yq(s.q) : "earlier" }, s); }); }

  // Issue new equity
  function issueEquity(shares) {
    if (shares <= 0) return { success: false, message: "Shares must be greater than zero." };

    // Cap at 20% of existing shares per issuance
    var maxShares = fmt(GameState.company.sharesOutstanding * 0.20);
    if (shares > maxShares) {
      return { success: false, message: "Maximum issuance is " + maxShares + "M shares (20% of float)." };
    }

    // Equity can only be issued ONCE per year
    var lastEquityYear = GameState.company.equityIssuanceYear || 0;
    if (lastEquityYear === GameState.meta.year) {
      return { success: false, message: "Equity can only be issued once per year. Markets need time to absorb dilution. Wait until Year " + (GameState.meta.year + 1) + "." };
    }

    /* 2.0 round 10: the price of new shares depends on where you trade
       against NAV. Above NAV the market welcomes it (every new share brings
       in more than it is worth); far below NAV it is punished, harder each
       time (v1 punished it always). */
    var count     = GameState.company.equityIssuanceCount || 0;
    var sizeRatio = shares / GameState.company.sharesOutstanding;
    var navPS     = GameState.ratios.navPerShare || 0;
    var pnav      = navPS > 0 ? GameState.company.sharePrice / navPS : 0.5;
    var baseDrop, totalDrop;
    if (pnav >= 1.0)      { baseDrop = 0.02; totalDrop = Math.min(0.05, 0.01 + sizeRatio * 0.05); }
    else if (pnav >= 0.8) { baseDrop = 0.05; totalDrop = Math.min(0.12, 0.03 + sizeRatio * 0.10); }
    else { baseDrop = count === 0 ? 0.08 : count === 1 ? 0.15 : count === 2 ? 0.22 : 0.30; totalDrop = Math.min(0.40, baseDrop + sizeRatio * 0.15); }
    if (typeof IndexFund !== "undefined" && IndexFund.included && IndexFund.included()) baseDrop = Math.max(0.01, baseDrop - 0.01);   // round 14: index buyers absorb new shares

    var issuePrice = fmt(GameState.company.sharePrice * (1 - baseDrop));
    var proceeds   = fmt(shares * issuePrice);

    GameState.company.sharesOutstanding   = fmt(GameState.company.sharesOutstanding + shares);
    GameState.balance.cash                = fmt(GameState.balance.cash + proceeds);
    capLog('issue', shares + 'M new shares sold for $' + proceeds + 'M');
    GameState.board.equitySharesThisYear = (GameState.board.equitySharesThisYear || 0) + shares;
    GameState.company.sharePrice          = fmt(GameState.company.sharePrice * (1 - totalDrop));
    GameState.company.equityIssuanceCount = pnav < 0.8 ? count + 1 : count;   // only cheap issues count against you
    GameState.company.equityIssuanceYear  = GameState.meta.year;
    if (typeof Directors !== "undefined" && Directors.noteIssue) Directors.noteIssue(shares, pnav, proceeds);   // round 35: Petrova remembers the price
    // Suppress positive share price drift for 2 quarters
    GameState.company.equitySuppressQuarters = 2;

    // Board pressure for repeated issuances
    if (count >= 1) {
      GameState.board.pressurePoints = Math.min(
        GameState.board.maxPressure,
        GameState.board.pressurePoints + 1
      );
    }

    if (typeof News !== "undefined" && News.equityIssued) {
      News.equityIssued(fmt(sizeRatio * 100), fmt(totalDrop * 100));
    }

    return {
      success: true,
      message: `Issued ${shares}M shares at $${issuePrice}/share. Raised $${proceeds}M. Existing shareholders diluted.`,
    };
  }

  // Buy back shares — capped at 5% of float per action, once per year
  /* Share register events for the price chart (round 9): buybacks, issues,
     directors' own trades. */
  function capLog(kind, text) {
    const c = GameState.company; c.capLog = c.capLog || [];
    c.capLog.push({ tq: GameState.meta.totalQuarters + 1, kind: kind, text: text });
    if (c.capLog.length > 80) c.capLog.shift();
  }

  function buybackShares(shares) {
    if (shares <= 0) return { success: false, message: "Shares must be greater than zero." };

    // Frequency limit: once per year
    if (GameState.company.lastBuybackYear === GameState.meta.year) {
      return { success: false, message: "You can only conduct one buyback per year. Next available Year " + (GameState.meta.year + 1) + "." };
    }

    // Per-action cap: max 5% of shares outstanding
    const maxShares = fmt(GameState.company.sharesOutstanding * 0.05);
    if (shares > maxShares) {
      return { success: false, message: "Buyback capped at 5% of float per year — maximum " + maxShares + "M shares ($" + fmt(maxShares * GameState.company.sharePrice) + "M)." };
    }

    const cost = fmt(shares * GameState.company.sharePrice);
    // 2.0 round 9: companies borrow to buy back shares too. Cash plus the unused credit line.
    const canSpend = (typeof Revolver !== "undefined" && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash;
    if (canSpend < cost) {
      return { success: false, message: `Not enough money. Buyback costs $${cost}M; cash plus credit line gives $${canSpend}M.` };
    }
    const borrowed = Math.max(0, fmt(cost - Math.max(0, GameState.balance.cash)));
    if (borrowed > 0 && typeof Directors !== "undefined") Directors.remember('okafor', -0.5, 'you borrowed to buy back shares');
    capLog('buyback', shares + 'M shares bought back for $' + cost + 'M');
    GameState.board.buybackSharesThisYear = (GameState.board.buybackSharesThisYear || 0) + shares;

    GameState.company.sharesOutstanding = fmt(
      Math.max(1, GameState.company.sharesOutstanding - shares)
    );
    GameState.balance.cash = fmt(GameState.balance.cash - cost);
    GameState.company.lastBuybackYear = GameState.meta.year;

    // Small immediate uptick — the mirror image of issuance dropping the
    // price. This makes the price higher than last quarter, which pleases
    // Petrova when the board evaluates this quarter.
    GameState.company.sharePrice = fmt(GameState.company.sharePrice * 1.02);

    // Newsfeed
    if (typeof News !== "undefined" && News.add) {
      News.add(GameState.company.name + " repurchased " + shares + "M shares for $" + cost + "M — earnings per share to improve.", "capital");
    }

    return {
      success: true,
      message: `Bought back ${shares}M shares for $${cost}M. FFO per share will improve next quarter.`,
    };
  }

  // Set quarterly dividend per share
  /* -- round 37: THE EMERGENCY DIVIDEND CUT ---------------------------------------
     In a crisis (or the aftershock), with the dividend not covered by cash profit,
     the board approves halving it: 1 political capital, once per crisis and once in
     the aftershock. Williams accepts it as prudence (-0.5, not his red line); the
     market dips 6% (a normal halving costs 18%). After the crisis he asks for it back. */
  function canEmergencyCut() {
    var G = GameState, ph = (typeof Arc !== "undefined" && Arc.phase) ? Arc.phase() : "";
    if (ph !== "crisis" && ph !== "aftershock") return { ok: false, show: false };
    var used = G._eCutUsed || {}, pr = payoutRatio();
    if (used[ph]) return { ok: false, show: true, why: "Already used in this " + (ph === "crisis" ? "crisis" : "aftershock") };
    if (!(G.company.dividendPerShare > 0.005)) return { ok: false, show: false };
    if (pr == null || pr <= 1.0) return { ok: false, show: true, why: "Only when the dividend is not covered by cash profit (now " + (pr == null ? "?" : Math.round(pr * 100)) + "% of it)" };
    if ((G.board.politicalCapital || 0) < 1) return { ok: false, show: true, why: "Needs 1 political capital" };
    return { ok: true, show: true, phase: ph };
  }
  function emergencyCut() {
    var c = canEmergencyCut(), G = GameState; if (!c.ok) return { success: false, message: c.why || "Not available now." };
    var old = G.company.dividendPerShare, nw = Math.max(0.01, fmt(old / 2));
    G.board.politicalCapital = (G.board.politicalCapital || 0) - 1;
    G.company.dividendPerShare = nw; G.company.sharePrice = fmt(G.company.sharePrice * 0.94);
    G.board.pressurePoints = Math.min(G.board.maxPressure, (G.board.pressurePoints || 0) + 1);
    G._eCutUsed = G._eCutUsed || {}; G._eCutUsed[c.phase] = true;
    G._eCut = { q: (G.meta.year - 1) * 4 + G.meta.quarter, from: old, to: nw, restored: false };
    if (typeof Directors !== "undefined") Directors.remember("williams", -0.5, "the emergency dividend cut, which he approved");
    if (typeof News !== "undefined" && News.add) News.add(G.company.name + " halves its dividend to protect its balance sheet through the downturn.", "dividend");
    return { success: true, message: "The board approved it: the dividend is halved to $" + nw.toFixed(2) + " a share. Williams: \"Prudence, son. I expect it back when this is over.\" Share price \u22126%." };
  }
  function setDividend(newDividendPerShare) {
    if (typeof Revolver !== "undefined" && Revolver.dividendFrozen() &&
        newDividendPerShare > GameState.company.dividendPerShare + 0.0001) {
      return { success: false, message: "Your bank has frozen dividend increases (a condition of your credit line). You can hold or cut it." };
    }
    const old = GameState.company.dividendPerShare;
    const change = newDividendPerShare - old;
    const pct = old > 0 ? (change / old) * 100 : 0;

    if (newDividendPerShare < 0) {
      return { success: false, message: "Dividend cannot be negative." };
    }

    // DIVIDEND FLOOR MECHANIC
    // Year 1: completely locked — cannot cut at all
    if (GameState.meta.year <= 1 && change < -0.001) {
      return { success: false, message: "Dividend is locked in Year 1. You cannot cut during the orientation year. Focus on growing NOI instead." };
    }
    // Year 2+: cannot cut below 50% of the year-start dividend
    if (GameState.meta.year >= 2 && change < -0.001) {
      var startDiv = GameState.board.startYearDividend || 0.10;
      var minAllowed = fmt(startDiv * 0.50, 2);
      if (newDividendPerShare < minAllowed) {
        return { success: false, message: "Cannot cut dividend below $" + minAllowed + "/share (50% of year-start $" + fmt(startDiv,2) + "). This floor protects shareholder trust." };
      }
    }

    // Cutting the dividend — punishment scales with size of cut
    if (change < -0.001) {
      var cutPct     = Math.abs(pct);
      var pressurePts = cutPct > 60 ? 4 : cutPct > 30 ? 3 : cutPct > 10 ? 2 : 1;
      var priceHit    = cutPct > 60 ? 0.25 : cutPct > 30 ? 0.18 : cutPct > 10 ? 0.12 : 0.06;
      GameState.company.sharePrice = fmt(
        GameState.company.sharePrice * (1 - priceHit)
      );
      GameState.board.dividendCutQuarters = 0;
      GameState.board.pressurePoints = Math.min(
        GameState.board.maxPressure,
        GameState.board.pressurePoints + pressurePts
      );
      GameState.board.pressureLog.push({
        quarter: GameState.meta.quarter,
        year:    GameState.meta.year,
        reason:  "Dividend cut " + fmt(cutPct, 0) + "% from $" + old + " to $" + newDividendPerShare + "/share",
        points:  pressurePts,
      });
    }

    // Raising the dividend
    var sdNew = sustainableDividend(newDividendPerShare * 4, null);
    if (change > 0.001 && sdNew.excess <= 0.005) {
      GameState.company.sharePrice = fmt(
        GameState.company.sharePrice * (1 + Math.min(0.05, pct / 100 * 0.5))
      );
    }

    if (typeof News !== "undefined" && News.dividendChanged) {
      News.dividendChanged(old, fmt(newDividendPerShare));
    }

    GameState.company.dividendPerShare = fmt(newDividendPerShare);

    const direction = change > 0.001 ? "raised" : change < -0.001 ? "cut" : "maintained";
    return {
      success: true,
      message: `Dividend ${direction} to $${newDividendPerShare}/share per quarter ($${fmt(newDividendPerShare * 4)}/share annualized). ${change < -0.001 ? "Share price declined on the news." : ""}`,
      direction,
      pctChange: fmt(pct),
    };
  }

  // ----------------------------------------------------------
  // MASTER QUARTERLY RUN
  // Call this once per quarter — runs all steps in order
  // ----------------------------------------------------------
  function runQuarter() {
    // Increment counters
    GameState.meta.totalQuarters += 1;
    GameState.meta.quarter += 1;
    if (GameState.meta.quarter > 4) {
      GameState.meta.quarter = 1;
      GameState.meta.year   += 1;
      Market.applyYearlyEscalation();
      Properties.applyAnnualDecay();
      if (typeof Staff !== "undefined" && Staff.processYearEnd) Staff.processYearEnd();


      // ── END OF RUN: 60 quarters. The scored run always ends at Y15. ──
      // 2.0 replaces v1's single "divine status" victory with the dual-score
      // epilogue (design doc B.1 / B.10): personal wealth AND company TSR,
      // side by side, with no verdict attached. Until that is built, end the
      // run neutrally rather than declaring a winner.
      // year rolls to 16 only after Y15 Q4 is played: a full 60 quarters
      // (v1 checked >= 15, which ended the run after 56).
      if (GameState.meta.year >= 16 && !GameState.meta.gameOver) {
        GameState.meta.gameOver    = true;
        GameState.meta.gameWon     = true;   // reached the end rather than being fired
        GameState.meta.runComplete = true;
        GameState.meta.gameOverReason =
          "Fifteen years. Your term as CEO of " + GameState.company.name + " is complete.";
      }

    }

    // NOTE: Situation.assess() deliberately does NOT run here. At this point in
    // the quarter the P&L is still last quarter's, so assessing now would
    // describe the company one quarter late — the board would comment on a
    // crisis that had already passed. It runs at the END of runQuarter instead
    // (see below), which means events rolling this quarter correctly read the
    // position as of the LAST CLOSED quarter: you act on known information.

    // Reset unusual items (events.js will populate this before we run)
    GameState.pnl.unusualItems = GameState._pendingUnusual || 0;   // in-turn decision charges (world.js)
    GameState.pnl.nonCash = GameState._pendingNonCash || 0; GameState._pendingNonCash = 0;   // round 35: one-off write-offs and recoveries (story.js), inside unusualItems
    GameState._pendingUnusual = 0;

    // 1. Roll random events (they modify portfolio and unusualItems)
    const firedEvents = Events.rollEvents();
    // round 35: a harmful economy-wide event is not your doing: the board judges the numbers gently for a year (directors.js)
    firedEvents.forEach(function (e) { if (e.harmful && e.isMacro && typeof Directors !== "undefined" && Directors.shock && !Directors.shockOn()) Directors.shock(/Pandemic/.test(e.headline || "") ? "the pandemic hit us all" : "the economy hit us all"); });

    /* Property-level texture from world.js. Small, frequent, always naming a
       building and a number — this is what makes the city feel alive between
       the once-a-year decisions. */
    /* Tenants: coverage drift, defaults, lease expiries, re-letting. Runs
       BEFORE NOI is computed so a tenant leaving this quarter costs you this
       quarter's rent. */
    if (typeof Arc !== "undefined" && Arc.processQuarter) {
      Arc.processQuarter().forEach(function (e) {
        firedEvents.push({ isMacro: true, src: "news", harmful: e.good === false, isArc: true,
                           headline: e.text, body: "", impact: "", more: e.more || "" });
      });
    }

    if (typeof Tenants !== "undefined" && Tenants.processQuarter) {
      Tenants.processQuarter().forEach(function (e) {
        firedEvents.push({
          isMacro: false, harmful: e.good === false, isBackground: true, isTenant: true,
          headline: (e.good === false ? "\u2198\ufe0e " : e.good ? "\u2197\ufe0e " : "\u2022 ") + e.text,
          body: "", impact: "",
        });
      });
    }

    // round 7: story threads (story.js) — interest, payoffs, write-offs land in this quarter
    if (typeof Story !== "undefined" && Story.processQuarter) {
      Story.processQuarter().forEach(function (e) {
        firedEvents.push({ isMacro: false, harmful: e.good === false, isBackground: true,
                           headline: (e.good ? "\u2197\ufe0e " : "\u2198\ufe0e ") + e.text, body: "", impact: "" });
      });
    }

    if (typeof World !== "undefined" && World.rollBackground) {
      World.rollBackground().forEach(function (e) {
        firedEvents.push({
          isMacro: false, harmful: !e.good, isBackground: true,
          headline: e.good ? "\u2197\ufe0e " + e.text : "\u2198\ufe0e " + e.text,
          body: "", impact: "",
        });
      });
    }


    // Recurring penalties from declined decision events (e.g. carbon mandate
    // non-compliance). Each ticks down and charges Unusual Items per quarter.
    if (GameState._recurringPenalties && GameState._recurringPenalties.length) {
      GameState._recurringPenalties = GameState._recurringPenalties.filter(function(pen) {
        GameState.pnl.unusualItems = fmt(GameState.pnl.unusualItems - pen.amount);
        pen.quartersLeft -= 1;
        return pen.quartersLeft > 0;
      });
    }

    // 2. Update market conditions and property values
    const _rate0 = GameState.market.baseInterestRate, _cyc0 = GameState.market.cycle;
    const marketResult = Market.quarterlyUpdate();
    // round 9: the central bank and the economy get a line in the inbox, with a short story behind a click
    if (typeof Story !== "undefined" && Story.macroLine) {
      const _r1 = GameState.market.baseInterestRate, _c1 = GameState.market.cycle;
      if (Math.abs(_r1 - _rate0) >= 0.01) {
        const m = Story.macroLine('rate', { from: _rate0, to: _r1 });
        firedEvents.push({ isMacro: true, src: "fed", harmful: _r1 > _rate0, headline: m.headline, body: "", impact: "", more: m.more });
      }
      if (_c1 !== _cyc0) {
        const m = Story.macroLine('cycle', { from: _cyc0, to: _c1 });
        firedEvents.push({ isMacro: true, src: "news", harmful: _c1 === "contracting" || _c1 === "recession", headline: m.headline, body: "", impact: "", more: m.more });
      }
    }
    Properties.recalculatePropertyValues();
    Properties.quarterlyUpdate();
    Properties.processConstructionProgress();
    if (typeof Staff !== "undefined") Staff.processQuarter();
    if (typeof News !== "undefined" && News.rollAmbient) News.rollAmbient();

    // single-tenant buildings: 100% or 0% (tenants.js), whatever touched them above
    if (typeof Tenants !== "undefined" && Tenants.normalize) Tenants.normalize();

    // 3. Run P&L calculations
    const noComponents   = calcPortfolioNOI();
    const ga             = calcGA();
    const interest       = calcInterestExpense();
    const depreciation   = calcDepreciation();
    const capex          = calcCapexReserve();
    const pnl            = assemblePnL(noComponents, ga, interest, depreciation, capex);

    // Write P&L to GameState
    GameState.pnl = { ...GameState.pnl, ...pnl };

    // 4. Handle debt maturities FIRST — this deducts cash, retires/refinances
    //    tranches, and may force asset sales. Must happen before the balance
    //    sheet and ratios so they reflect the post-maturity reality.
    const matured      = tickDebtMaturities();
    const maturityMsgs = handleMaturedDebt(matured);
    // round 18: a maturing bond is news in the inbox, not a line in a report nobody sees
    maturityMsgs.forEach(function (m) {
      firedEvents.push({ isMacro: false, harmful: /Could not|fire-sale|shut|overdraft/i.test(m), isBackground: false,
                         headline: String(m).replace(/^[^A-Za-z0-9$]+/, ''), body: '', impact: '' });
    });

    // 5. Update balance sheet (now reflects matured-debt cash & tranche changes)
    updateBalanceSheet(pnl);

    // 6. Calculate ratios
    const ratios = calcRatios(pnl);

    // 7. Update credit rating (uses freshly computed ratios)
    const creditResult = Market.computeCreditRating();

    // 7b. The credit line: limit, conditions, renewal, default (revolver.js)
    if (typeof Revolver !== "undefined" && GameState.revolver) {
      Revolver.processQuarter().forEach(function (e) {
        firedEvents.push({ isMacro: false, harmful: e.good === false, isRevolver: true,
                           headline: (e.good === false ? "\u2198\ufe0e " : "\u2197\ufe0e ") + e.text, body: "", impact: "" });
      });
    }

    // 7c. The rivals act: their books, buying, selling, dividends (rivals.js)
    if (typeof Rivals !== "undefined" && GameState.rivals) {
      Rivals.processQuarter().forEach(function (e) {
        firedEvents.push({ isMacro: false, harmful: false, isRival: true, headline: "\u25c6 " + e.text, body: "", impact: "" });
      });
    }

    // 8. Update share price
    updateSharePrice(pnl);
    if (GameState._irNote) firedEvents.push({ isMacro: false, harmful: false, headline: "\u260e\ufe0e " + GameState._irNote, body: "", impact: "" });

    // 9. Save quarter to history
    saveToHistory(pnl);
    GameState._spendQ = { leasing: 0, projects: 0 };   // round 28: a fresh quarter of spending
    if (typeof Telemetry !== "undefined") Telemetry.quarter();   // round 23: how far players get

    // Books are closed — NOW read the company's position. Everything that
    // speaks (board, analysts, briefing, next quarter's events) reads this.
    if (typeof Situation !== "undefined") Situation.assess();

    // 10. Return full summary for board.js and ui.js to consume
    return {
      pnl,
      ratios,
      marketResult,
      creditResult,
      firedEvents,
      maturityMsgs,
      period: GameState.currentPeriodLabel(),
    };
  }

  // ----------------------------------------------------------
  // INITIALISE — set starting financials
  // ----------------------------------------------------------
  function init() {
    // Run initial property valuation
    Properties.recalculatePropertyValues();

    // Set starting balance sheet from initial portfolio
    const portfolioValue = GameState.portfolio.reduce(
      (sum, p) => sum + p.currentValue, 0
    );
    GameState.balance.totalAssets = fmt(GameState.balance.cash + portfolioValue);
    GameState.balance.totalDebt   = fmt(
      GameState.debtTranches.reduce((sum, t) => sum + t.amount, 0)
    );
    GameState.balance.totalEquity = fmt(
      GameState.balance.totalAssets - GameState.balance.totalDebt
    );
    /* Opening price = where updateSharePrice() will hold it, so the game does
       not open with a built-in slide. It used to open at 95% of NAV, but the
       engine prices off the dividend, so the price then fell ~60% in two years
       whatever the player did. Healthy company at the start: bottom of the
       yield band, same NAV clamps as updateSharePrice(). */
    var navPerShare = fmt(
      GameState.balance.totalEquity / GameState.company.sharesOutstanding
    );
    GameState.ratios.navPerShare = navPerShare;
    var openPrice = fairPrice(null, true);
    GameState.company.sharePrice = fmt(openPrice);
    GameState.company.marketCap  = fmt(
      GameState.company.sharePrice * GameState.company.sharesOutstanding
    );
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    init,
    runQuarter,
    issueDebt,
    retireDebt,
    getCallInfo,
    issuePreferred,
    debtRoom,
    issuePreferredFor,
    prefChoice,
    prefPurpose,
    splitChoice,
    splitPlan,
    prefRoom,
    prefRate,
    prefDebate,
    prefDebateHTML,
    prefBoardOK,
    redeemSeries,
    prefList,
    redeemPreferred,
    issueEquity,
    buybackShares,
    capLog,
    covenantLimit,
    amendCovenant,
    consentFee,
    setDividend,
    canEmergencyCut, emergencyCut,   // round 37
    noteSpend,
    trailingAffoPS,
    fairPrice,          // round 25: for tests (what the price is pulled toward)
    sustainableDividend,
    payoutRatio,
    calcRatios,
    getCurrentBorrowingRateForTerm,
    getTermPremium,
  };

})();
