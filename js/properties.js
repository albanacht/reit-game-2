// ============================================================
// properties.js — Property pool, generation, buy/sell logic
// REIT Simulator Game
// ============================================================
// RULES FOR EDITING THIS FILE:
// - This file manages the property market and portfolio
// - It reads/writes GameState.portfolio and GameState.propertyMarket
// - It never touches P&L directly — financials.js does that
// - Property VALUE is recalculated here; property INCOME is in financials.js
// ============================================================

window.Properties = (() => {

  // ----------------------------------------------------------
  // PROPERTY TEMPLATES
  // Each sector+location combo has a profile that drives generation
  // noiYield = annual NOI as % of property value (before vacancy)
  // volatility = how much occupancy swings (higher = riskier)
  // eventWeight = how likely bad events hit this type
  // ----------------------------------------------------------
  const PROFILES = {
    office: {
      tier1:    { basePriceMid: 105, noiYield: 0.072, occupancyMid: 0.90, volatility: 0.08, label: "CBD Office Tower" },
      tier2:    { basePriceMid: 48,  noiYield: 0.077, occupancyMid: 0.85, volatility: 0.10, label: "City Office Park" },
      suburban: { basePriceMid: 18,  noiYield: 0.0845, occupancyMid: 0.80, volatility: 0.13, label: "Suburban Office Campus" },
    },
    industrial: {
      tier1:    { basePriceMid: 90,  noiYield: 0.062, occupancyMid: 0.95, volatility: 0.04, label: "Urban Logistics Hub" },
      tier2:    { basePriceMid: 42,  noiYield: 0.067, occupancyMid: 0.93, volatility: 0.05, label: "Regional Distribution Center" },
      suburban: { basePriceMid: 15,  noiYield: 0.0745, occupancyMid: 0.90, volatility: 0.06, label: "Suburban Warehouse Park" },
    },
    multifamily: {
      tier1:    { basePriceMid: 100, noiYield: 0.067, occupancyMid: 0.93, volatility: 0.05, label: "Urban Apartment Tower" },
      tier2:    { basePriceMid: 45,  noiYield: 0.072, occupancyMid: 0.90, volatility: 0.07, label: "Mid-City Apartment Complex" },
      suburban: { basePriceMid: 16,  noiYield: 0.0795, occupancyMid: 0.87, volatility: 0.10, label: "Suburban Apartment Community" },
    },
    retail: {
      tier1:    { basePriceMid: 95,  noiYield: 0.077, occupancyMid: 0.88, volatility: 0.10, label: "High Street Retail Center" },
      tier2:    { basePriceMid: 40,  noiYield: 0.082, occupancyMid: 0.83, volatility: 0.13, label: "Community Shopping Center" },
      suburban: { basePriceMid: 13,  noiYield: 0.0945, occupancyMid: 0.78, volatility: 0.16, label: "Suburban Strip Mall" },
    },
  };

  // Market and starting portfolio now use the same base prices (no multiplier).
  // Range emerges naturally: ~10M suburban up to ~120M prime tier-1.
  const MARKET_PRICE_MULT = 1.0;

  // ----------------------------------------------------------
  // NAME BANKS — for generating realistic property names
  // ----------------------------------------------------------
  const NAMES = {
    office: {
      tier1:    ["One Capital Plaza", "Meridian Tower", "Exchange Place", "The Landmark", "Civic Center Tower", "Harbor Point Office"],
      tier2:    ["Westgate Business Park", "Riverview Office Centre", "Northgate Plaza", "Commerce Park II", "The Atrium", "Lakeside Office Park"],
      suburban: ["Innovation Campus", "Creekside Business Center", "Pinewood Office Park", "Hillside Campus", "Meadowbrook Center", "Gateway Business Park"],
    },
    industrial: {
      tier1:    ["Port Logistics Center", "Metro Distribution Hub", "Urban Commerce Center", "Railyard Industrial", "Harbor Logistics", "City Freight Terminal"],
      tier2:    ["Crossroads Distribution", "Regional Logistics Park", "Central Warehouse Hub", "Eastgate Industrial", "Westpark Distribution", "Summit Logistics"],
      suburban: ["Freedom Industrial Park", "Countryside Warehouse", "Route 9 Distribution", "Clearfield Logistics", "Valley Industrial Estate", "Ridgeline Warehouse"],
    },
    multifamily: {
      tier1:    ["The Metropolitan", "Skyline Residences", "Harborview Apartments", "The Gramercy", "Central Park Flats", "The Pinnacle"],
      tier2:    ["Riverside Commons", "The Meridian", "Uptown Flats", "Lakeside Living", "The Enclave", "Midtown Residences"],
      suburban: ["Maple Grove Apartments", "Sunridge Communities", "Creekwood Flats", "The Villages at Oakdale", "Pinecrest Residences", "Willowbrook Commons"],
    },
    retail: {
      tier1:    ["The Gallery at Fifth", "Regent Street Shops", "Harbor Place Retail", "The Arcade", "City Center Market", "Union Square Retail"],
      tier2:    ["Westfield Commons", "Riverside Marketplace", "Northgate Shopping Center", "The Town Center", "Lakeview Mall", "Central Plaza"],
      suburban: ["Sunset Strip Mall", "Route 40 Retail Plaza", "Valley Fair Center", "Clearview Commons", "Millbrook Shopping Center", "Parkway Plaza"],
    },
  };

  // Track which names have been used to avoid duplicates
  const usedNames = new Set();

  // ----------------------------------------------------------
  // UTILITY: random float between min and max
  // ----------------------------------------------------------
  function randBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  // ----------------------------------------------------------
  // UTILITY: random int between min and max inclusive
  // ----------------------------------------------------------
  function randInt(min, max) {
    return Math.floor(randBetween(min, max + 1));
  }

  // ----------------------------------------------------------
  // UTILITY: pick random item from array
  // ----------------------------------------------------------
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ----------------------------------------------------------
  // UTILITY: generate unique property ID
  // ----------------------------------------------------------
  let propIdCounter = 1;
  function nextPropId() {
    return "p" + String(propIdCounter++).padStart(3, "0");
  }

  // ----------------------------------------------------------
  // GENERATE a single property given sector and location
  // ----------------------------------------------------------
  function generateProperty(sector, location, forSale = true, forMarket = false) {
    const profile = PROFILES[sector][location];

    // Pick a unique name
    const namePool = NAMES[sector][location];
    const availableNames = namePool.filter(n => !usedNames.has(n));
    const name = availableNames.length > 0
      ? pick(availableNames)
      : `${profile.label} ${propIdCounter}`;
    usedNames.add(name);

    // Market properties priced 1.5x base; starting portfolio uses raw base.
    const priceMult = forMarket ? MARKET_PRICE_MULT : 1.0;

    // Price varies ±30% around midpoint
    const priceVariance = randBetween(0.70, 1.30);
    const currentValue = Math.round(profile.basePriceMid * priceMult * priceVariance * 10) / 10;

    // NOI yield varies slightly around profile
    const actualYield = profile.noiYield * randBetween(0.90, 1.10);
    const annualNOI = Math.round(currentValue * actualYield * 10) / 10;

    // Occupancy varies around midpoint
    const occupancy = Math.min(1.0, Math.max(0.50,
      profile.occupancyMid + randBetween(-0.08, 0.08)
    ));

    // Age affects capex reserve needs
    const age = randInt(1, 25);
    const capexReserve = Math.round(currentValue * 0.01 * (age / 10) * 10) / 10;

    // Asking price: slight premium over value for seller motivation
    const askingPremium = forSale ? randBetween(1.00, 1.05) : 1.0;
    const askingPrice = Math.round(currentValue * askingPremium * 10) / 10;

    return {
      id: nextPropId(),
      name,
      sector,
      location,
      label: profile.label,
      purchasePrice: null,          // set when bought
      currentValue,
      askingPrice,
      annualNOI,
      occupancy: Math.round(occupancy * 1000) / 1000,
      age,
      capexReserve,
      quarterOwned: 0,
      encumbered: false,
      daysOnMarket: randInt(1, 6),  // quarters already listed
    };
  }

  // ----------------------------------------------------------
  // GENERATE the initial pool of 20 market properties
  // Distribution: 5 office, 5 industrial, 5 multifamily, 5 retail
  // Each sector gets roughly: 2 tier1, 2 tier2, 1 suburban (varied)
  // ----------------------------------------------------------
  function generateInitialMarket() {
    const sectors = ["office", "industrial", "multifamily", "retail"];
    const locations = ["tier1", "tier2", "suburban"];
    const pool = [];

    sectors.forEach(sector => {
      // Ensure at least one of each location per sector
      locations.forEach(location => {
        pool.push(generateProperty(sector, location, true, true));
      });
      // Add two more varied properties per sector
      pool.push(generateProperty(sector, pick(locations), true, true));
      pool.push(generateProperty(sector, pick(locations), true, true));
    });

    return pool;
  }

  // ----------------------------------------------------------
  // GENERATE starting portfolio (2 properties, already owned)
  // Player starts with one industrial and one multifamily
  // ----------------------------------------------------------
  function generateStartingPortfolio() {
    const sectors = ["industrial", "multifamily", "office", "retail"];
    var portfolio = sectors.map(function(sector) {
      const prop = generateProperty(sector, "tier2", false);
      prop.purchasePrice = prop.currentValue;
      prop.quarterOwned  = 1;
      prop.askingPrice   = null;
      prop.daysOnMarket  = null;
      // Easter egg: the starting multifamily building is named after a
      // certain seaside workplace in Phuket.
      if (sector === "multifamily") prop.name = "Sunshine Beach Residences";
      return prop;
    });

    // A small, high-yield suburban anchor — provides useful income to help
    // cover fixed costs while you build, at a realistic suburban occupancy
    // (~86%) so there's room to lease it up as an early goal. ~$10M, ~9.5% cap.
    var anchor = generateProperty("retail", "suburban", false);
    anchor.currentValue   = 10;
    anchor.baseValue      = 10;
    anchor.annualNOI      = 0.95;        // ~9.5% cap on $10M (at full occupancy)
    anchor.baseCapRate    = 9.5;
    anchor.occupancy      = 0.86;        // realistic suburban — room to lease up
    anchor.purchasePrice  = 10;
    anchor.quarterOwned   = 1;
    anchor.askingPrice    = null;
    anchor.daysOnMarket   = null;
    anchor.name           = "Cornerstone Strip Center";
    portfolio.push(anchor);

    return portfolio;
  }

  // ----------------------------------------------------------
  // RECALCULATE property market value from current cap rates
  // Called every quarter as cap rates shift
  // ----------------------------------------------------------
  // ----------------------------------------------------------
  // RECALCULATE PROPERTY VALUES
  // Value is NOT driven by operational lease-up (filling the bus earns
  // more fares, it doesn't make the bus worth more). Instead value =
  // a depreciating base, re-rated by market cap-rate swings (cycle + rates).
  // Operational gains show up as NOI, never as value.
  // ----------------------------------------------------------
  function recalculatePropertyValues() {
    const capRates = GameState.market.capRates;

    /* 2.0 round 10: owned buildings (yours and the rivals') are valued on
       what they actually earn. v1 valued them as "purchase price x market
       move", so a building bought half empty and then filled stayed cheap
       (Cedar Crossing at a 22% cap rate), and an empty one kept its full value.
       Now, against a baseline taken when we first see the building (or buy it):
         value = baseline x (NOI now / NOI then) x (occupancy factor now / then)
                 x (market cap rate then / now) x one-off adjustments x tenant credit
       and the book moves halfway to that each quarter (appraisals lag).
       Occupancy factor: buyers pay for half the lease-up still to come; an
       empty single-tenant building is worth 65% of a let one. One-off
       adjustments are changes to baseValue made by events (a fire, a rezoning). */
    GameState.portfolio.concat(GameState.cityRivals || []).forEach(prop => {
      if (prop.underConstruction) return; // tower under construction has no market value yet
      if (prop.baseValue === undefined) prop.baseValue = prop.currentValue;
      const curCap = capRates[prop.sector][prop.location];
      // round 35b: moves with the building's FAIR value (stabilised rent / area cap rate, minus the refill), from a baseline
      if (!prop.vb || prop.vb.f == null) prop.vb = { v: prop.currentValue, f: Math.max(0.1, fairValue(prop)), base: prop.baseValue || prop.currentValue };
      const vb = prop.vb;
      const target = vb.v * (fairValue(prop) / vb.f) * ((prop.baseValue || vb.base) / vb.base);
      prop.currentValue = Math.round((prop.currentValue + (target - prop.currentValue) * 0.5) * 10) / 10;
    });

    GameState.propertyMarket.forEach(prop => {
      if (!(prop.annualNOI > 0)) return;                      // land: priced by its auction
      prop.currentValue = Math.round(fairValue(prop) * 10) / 10;   // round 35b: the market's price is the fair value
      // sellers are slow to move (15% of the way a quarter), but nobody asks more than 15% over value and sells
      if (prop.askingPrice) prop.askingPrice = Math.round(Math.max(prop.currentValue, Math.min(prop.currentValue * MAX_PREMIUM,
        prop.askingPrice * 0.85 + prop.currentValue * 1.02 * 0.15)) * 10) / 10;
    });
  }

  /* -- round 35b: FAIR VALUE, the way valuers do it ---------------------------------
     annualNOI is rent after costs IF FULLY LET. Valuers do not value this quarter's
     occupancy: they use STABILISED rent (normal occupancy, 95%) and subtract the cost
     of getting there (three years of the missing rent: void, incentives, agents, risk).
       fair value = annualNOI x max(occupancy, 95%) / area cap rate
                    - max(0, 95% - occupancy) x annualNOI x 3
     A single-tenant building is let or empty: let = full rent / cap rate; empty =
     65% of that. A weak single tenant marks it down (creditFactor).
     CAP RATE (the screens): stabilised rent / price. At fair value it is about the
     area rate. YIELD TODAY: rent collected now / price (it moves with vacancies). */
  const STAB = 0.95, REFILL_YEARS = 3, MAX_PREMIUM = 1.15;   // refill: three years of the missing rent (void, incentives, agents, the risk)
  const areaCap = p => { const C = GameState.market && GameState.market.capRates; return C && C[p.sector] ? C[p.sector][p.location] : 8; };
  const stabRent = p => {
    if (typeof Tenants !== "undefined" && Tenants.isLocked(p)) return Math.max(0, p.annualNOI || 0);
    return Math.max(0, p.annualNOI || 0) * Math.max(p.occupancy || 0, STAB);
  };
  function fairValue(p) {
    const noi = Math.max(0, p.annualNOI || 0), cap = areaCap(p) / 100;
    if (!(noi > 0) || !(cap > 0)) return p.currentValue || 0;
    if (typeof Tenants !== "undefined" && Tenants.isLocked(p)) {
      const pos = p.lease && p.lease.positions[0];
      return (noi / cap) * (pos && !pos.vacant ? 1 : 0.65) * creditFactor(p);
    }
    const gap = Math.max(0, STAB - (p.occupancy || 0));
    return Math.max(noi / cap * 0.25, stabRent(p) / cap - gap * noi * REFILL_YEARS) * creditFactor(p);
  }
  /* New game: every building starts at its fair value, and listings ask 0 to 5% over it
     (the catalogue's prices were set on full-occupancy rent: listings started 14-28% over value). */
  function rebaseValues() {
    const G = GameState;
    G.portfolio.concat(G.cityRivals || [], G.propertyMarket || []).forEach(p => {
      if (p.underConstruction || !(p.annualNOI > 0)) return;
      const prem = p.askingPrice && p.currentValue ? Math.min(1.05, Math.max(1.0, p.askingPrice / p.currentValue)) : 1;
      p.currentValue = Math.round(fairValue(p) * 10) / 10; p.baseValue = p.currentValue; p.vb = null;
      if (p.askingPrice) p.askingPrice = Math.round(p.currentValue * prem * 10) / 10;
    });
  }

  // ----------------------------------------------------------
  // ANNUAL DEPRECIATION & NOI DECAY (called once per year)
  // Buildings wear out: base value depreciates ~1.75%/yr and NOI drifts
  // down ~1.25%/yr unless renovated. Renovation resets the decay clock.
  // ----------------------------------------------------------
  function occFactor(p) {
    if (typeof Tenants !== "undefined" && Tenants.isLocked(p)) {
      const pos = p.lease && p.lease.positions[0];
      return pos && !pos.vacant ? 1 : 0.65;
    }
    const prof = PROFILES[p.sector] && PROFILES[p.sector][p.location], mid = prof ? prof.occupancyMid : 0.9;
    const o = p.occupancy || 0;
    return o < mid ? o + 0.5 * (mid - o) : o;
  }
  /* A single tenant in trouble makes its building worth less to any buyer. */
  function creditFactor(p) {
    if (!(typeof Tenants !== "undefined" && Tenants.isLocked(p))) return 1;
    const pos = p.lease && p.lease.positions[0], t = pos && !pos.vacant && GameState.tenants ? GameState.tenants[pos.t] : null;
    if (!t || t.coverage == null) return 1;
    return 1 - Math.min(0.2, Math.max(0, (1.3 - t.coverage) * 0.4));
  }

  function applyAnnualDecay() {
    GameState.portfolio.concat(GameState.cityRivals || []).forEach(prop => {
      if (prop.underConstruction) return;
      if (prop.baseValue === undefined) prop.baseValue = prop.currentValue;

      // round 10: no separate 2%/yr value decay. Value now follows NOI, and
      // the NOI decay below already carries the ageing.

      // NOI decay (1.25%/yr). In v1 this was detuned to 0.4% BECAUSE the
      // nephew's department escalation supplied the late-game cost pressure.
      // That storyline is cut in 2.0 (A.12), so the decay is restored to carry
      // the squeeze on its own until tenants, oversupply and the maturity wall
      // are built. RETUNE once those land. Renovated properties resist it.
      var decayResist = (prop.renovated && prop.renovatedYear && (GameState.meta.year - prop.renovatedYear) < 4) ? 0.5 : 1.0;
      prop.annualNOI = Math.round(prop.annualNOI * (1 - 0.0125 * decayResist) * 10) / 10;

      prop.age = (prop.age || 0) + 1;
    });
  }

  // ----------------------------------------------------------
  // BUY a property from the market
  // Returns { success: bool, message: string }
  // ----------------------------------------------------------
  // Transaction fee on any acquisition/disposition (legal, brokerage, closing
  // costs). ~1% of price; an Acquisitions Lead cuts it roughly in half through
  // relationships and off-market sourcing.
  function transactionFee(price) {
    var rate = 0.01;
    if (typeof Staff !== "undefined" && Staff.hasRole("acquisitions")) {
      rate = 0.01 * (0.5 - Staff.skillFactor("acquisitions") * 0.1); // ~0.4-0.5% with a lead
    }
    return Math.round(price * rate * 10) / 10;
  }

  function buyProperty(propertyId) {
    const idx = GameState.propertyMarket.findIndex(p => p.id === propertyId);
    if (idx === -1) return { success: false, message: "Property not found in market." };

    const prop = GameState.propertyMarket[idx];
    const fee  = transactionFee(prop.askingPrice);
    const totalCost = Math.round((prop.askingPrice + fee) * 10) / 10;

    // 2.0: cash plus the unused credit line (revolver.js)
    const canSpend = (typeof Revolver !== "undefined" && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash;
    if (canSpend < totalCost) {
      return {
        success: false,
        message: `Not enough money. Need $${totalCost}M (incl. $${fee}M fees); cash plus credit line gives $${canSpend}M.`
      };
    }

    // Transfer
    prop.purchasePrice = prop.askingPrice;
    prop.listedByOwner = false;                      // it is ours now, not on the market
    prop.vb = null;                                  // round 10: valued from here on what it earns
    prop.quarterOwned = 0;
    prop.askingPrice = null;
    prop.daysOnMarket = null;

    GameState.balance.cash = Math.round((GameState.balance.cash - totalCost) * 10) / 10;
    GameState.portfolio.push(prop);
    // round 17: Chen's demand counts buildings that yield more than we pay to borrow, plus a point
    if (typeof Market !== "undefined" && prop.purchasePrice > 0 && stabRent(prop) / prop.purchasePrice * 100 >= Market.getCurrentBorrowingRate() + 1)   // round 35b: the cap rate on what you paid (stabilised rent / price), not full-occupancy rent
      GameState.board.accretiveBuysThisYear = (GameState.board.accretiveBuysThisYear || 0) + 1;
    GameState.propertyMarket.splice(idx, 1);

    // Refresh market with a new property to keep pool near 20
    refreshMarket();

    if (typeof News !== "undefined" && News.propertyBought) {
      News.propertyBought(prop.name, prop.purchasePrice);
    }

    return {
      success: true,
      message: `Acquired ${prop.name} for $${prop.purchasePrice}M (+ $${fee}M transaction fees).`
    };
  }

  // ----------------------------------------------------------
  // SELL a property from portfolio
  // Sells at current market value ± negotiation variance
  // Returns { success: bool, message: string, salePrice: number }
  // ----------------------------------------------------------
  /* 2.0: THE CITY IS FINITE, so a building that leaves your hands must land
     in someone else's. v1 simply deleted it, which shrank Riverton every time
     you sold. `to` = a rival key ('wex','ren','hal'), 'none' for a private
     buyer, or 'rival' for whichever rival is hungriest (random for now). */
  const RIVALS = ["wex", "ren", "hal"];
  function handOver(prop, to, price) {
    if (!prop) return null;
    GameState.portfolio = GameState.portfolio.filter(function(p) { return p.id !== prop.id; });
    // round 5: the rival who wants it (and can pay) buys it, and pays for it
    var owner = to === "rival"
      ? (typeof Rivals !== "undefined" && GameState.rivals ? Rivals.buyerFor(prop) : RIVALS[Math.floor(Math.random() * RIVALS.length)])
      : (to || "none");
    if (typeof Rivals !== "undefined" && GameState.rivals && GameState.rivals[owner])
      Rivals.onAcquire(owner, prop, price || prop.currentValue);
    prop.purchasePrice = null; prop.quarterOwned = null;
    prop.listedByOwner = false; prop.underConstruction = false; prop.jv = null;
    if (owner === "none") { prop.askingPrice = prop.currentValue; GameState.propertyMarket.push(prop); }
    else { prop.owner = owner; GameState.cityRivals.push(prop); }
    return owner;
  }
  function ownerName(key) {
    var O = (window.PROPERTIES_MASTER && PROPERTIES_MASTER.OWNERS) || {};
    return (O[key] && O[key].short) || "a private buyer";
  }

  function sellProperty(propertyId, atPrice) {
    const idx = GameState.portfolio.findIndex(p => p.id === propertyId);
    if (idx === -1) return { success: false, message: "Property not found in portfolio." };

    const prop = GameState.portfolio[idx];

    // Sale price: 95%–102% of current value (market conditions apply)
    const cycle = GameState.market.cycle;
    const cycleMod = cycle === "expanding" ? 1.02
                   : cycle === "contracting" ? 0.97
                   : cycle === "recession" ? 0.93
                   : 1.00;
    // round 10: an agreed price (an offer you accepted, a quick sale) is the price
    const salePrice = atPrice != null ? Math.round(atPrice * 10) / 10 : Math.round(prop.currentValue * cycleMod * randBetween(0.97, 1.02) * 10) / 10;
    prop.listing = null;
    const fee = transactionFee(salePrice);
    const netProceeds = Math.round((salePrice - fee) * 10) / 10;
    const gain = Math.round((netProceeds - prop.purchasePrice) * 10) / 10;

    GameState.balance.cash = Math.round((GameState.balance.cash + netProceeds) * 10) / 10;
    var buyer = handOver(prop, "rival", salePrice);       // your sales feed your competitors
    if (typeof Directors !== "undefined" && Directors.noteSale) Directors.noteSale(salePrice);   // round 21: Chen and Hassan watch the portfolio shrink

    if (typeof News !== "undefined" && News.propertySold) {
      News.propertySold(prop.name, salePrice, gain);
    }

    return {
      success: true,
      message: `Sold ${prop.name} to ${ownerName(buyer)} for $${salePrice}M (− $${fee}M fees = $${netProceeds}M net; ${gain >= 0 ? "+" : ""}$${gain}M vs cost).`,
      salePrice,
      gain,
    };
  }

  // ----------------------------------------------------------
  // REFRESH MARKET — add new properties when pool drops below 20
  // Called after a purchase
  // ----------------------------------------------------------
  // 2.0: THE CITY IS FINITE. v1 topped the market back up to 20 by generating
  // new buildings forever, which made inventory effectively unlimited. Riverton
  // has 40 buildings and no more — contested, depleting inventory is the point
  // (design doc C.3.1). Buying now genuinely removes something from the market.
  //
  // Mega-properties are suspended: they were generated with no map coordinates,
  // so they would appear in the Properties tab and be invisible on the Map,
  // which is exactly the inconsistency step 2a existed to remove. Needs a
  // design decision — see notes.
  function refreshMarket() {
    /* intentionally empty */
  }

  // ----------------------------------------------------------
  // MEGA-PROPERTY — large single-tenant assets only accessible
  // with an Acquisitions Lead hired. Rare, expensive, reliable.
  // ----------------------------------------------------------
  function maybeInjectMegaProperty() {
    if (typeof Staff === "undefined" || !Staff.hasRole("acquisitions")) return;
    // Only one mega-property on the market at a time
    if (GameState.propertyMarket.some(function(p) { return p.isMega; })) return;
    // Only roll once per year
    if (GameState._lastMegaRollYear === GameState.meta.year) return;
    GameState._lastMegaRollYear = GameState.meta.year;
    // 40% base chance per year, 60% with a Rainmaker
    var megaOdds = (Staff.hasTrait && Staff.hasTrait("acquisitions", "rainmaker")) ? 0.60 : 0.40;
    if (Math.random() > megaOdds) return;

    var megaTypes = [
      { sector: "industrial", label: "Mega Distribution Centre", price: [80, 140], tenant: "national logistics operator" },
      { sector: "industrial", label: "Machinery Manufacturing Plant", price: [90, 160], tenant: "blue-chip manufacturer" },
      { sector: "office",     label: "Corporate HQ Campus", price: [100, 160], tenant: "Fortune 500 anchor" },
      { sector: "retail",     label: "Regional Distribution Hub", price: [85, 150], tenant: "diversified retail consortium" },
    ];
    var m = pick(megaTypes);

    // The acquisitions officer's skill sets how good a deal he digs up:
    // a poor AL finds ~7.5% cap, a great one ~9.5% cap. Higher cap = cheaper
    // for the income = a genuine life-saving bargain.
    var skill = Staff.skillFactor("acquisitions"); // 0..1
    var capRate = 7.5 + skill * 2.0;               // 7.5% (poor) → 9.5% (great)
    capRate = Math.round(capRate * 10) / 10;

    var value = Math.round(randBetween(m.price[0], m.price[1]) * 10) / 10;
    var noi   = Math.round(value * (capRate / 100) * 10) / 10;

    var prop = {
      id: nextPropId(),
      name: "★ " + m.label,
      sector: m.sector,
      location: "tier1",
      label: m.label,
      purchasePrice: null,
      currentValue: value,
      baseValue: value,
      baseCapRate: capRate,
      askingPrice: value,         // sold at fair value — the deal is the high cap
      annualNOI: noi,
      occupancy: 0.97,            // single reliable tenant, near-full
      age: randInt(1, 8),
      capexReserve: Math.round(value * 0.008 * 10) / 10,
      quarterOwned: 0,
      encumbered: false,
      daysOnMarket: 0,
      isMega: true,
      isSingleTenant: true,
      megaCapRate: capRate,
      megaTenant: m.tenant,
    };
    GameState.propertyMarket.unshift(prop);

    // The Acquisitions Lead announces the find with his face/voice
    var al = Staff.getStaff("acquisitions");
    if (al) {
      GameState._pendingMegaFind = {
        alName:     al.name,
        alPortrait: al.portrait,
        propName:   prop.name,
        tenant:     m.tenant,
        price:      prop.askingPrice,
        sector:     prop.sector,
      };
    }
  }

  // ----------------------------------------------------------
  // QUARTERLY UPDATE — age properties, shift occupancy slightly
  // Called once per quarter advance
  // ----------------------------------------------------------
  function quarterlyUpdate() {
    GameState.portfolio.forEach(prop => {
      if (prop.underConstruction) return; // skip the tower until built
      prop.quarterOwned = (prop.quarterOwned || 0) + 1;

      // Age increases every 4 quarters
      if (prop.quarterOwned % 4 === 0) prop.age += 1;

      // Single-tenant and operator-leased buildings NEVER drift: they are 100%
      // or 0%, and only tenants.js changes them (renewal, default, re-let).
      if (typeof Tenants !== "undefined" && Tenants.isLocked(prop)) return;

      // Occupancy drifts slightly (mean-reversion toward profile midpoint)
      const profile = PROFILES[prop.sector][prop.location];
      const drift = (profile.occupancyMid - prop.occupancy) * 0.1;
      const noise = randBetween(-profile.volatility * 0.15, profile.volatility * 0.15);
      prop.occupancy = Math.min(1.0, Math.max(0.40,
        Math.round((prop.occupancy + drift + noise) * 1000) / 1000
      ));
    });

    // 2.0 round 5: rivals' occupancy moves like yours
    (GameState.cityRivals || []).forEach(prop => {
      if (prop.underConstruction || (typeof Tenants !== "undefined" && Tenants.isLocked(prop))) return;
      const profile = PROFILES[prop.sector][prop.location];
      const drift = (profile.occupancyMid - prop.occupancy) * 0.1;
      const noise = randBetween(-profile.volatility * 0.15, profile.volatility * 0.15);
      prop.occupancy = Math.min(1.0, Math.max(0.40, Math.round((prop.occupancy + drift + noise) * 1000) / 1000));
    });

    // Age market listings
    GameState.propertyMarket.forEach(prop => {
      prop.daysOnMarket = (prop.daysOnMarket || 0) + 1;
      // Properties on market too long get a price reduction
      if (prop.daysOnMarket > 4) {
        prop.askingPrice = Math.round(prop.askingPrice * 0.98 * 10) / 10;
      }
    });
  }

  // ----------------------------------------------------------
  // INITIALISE — call once at game start
  // ----------------------------------------------------------
  // ----------------------------------------------------------
  // MASTER LIST → v1 PROPERTY SHAPE
  // 2.0 no longer generates buildings. properties_master.js is the single
  // source of truth for the whole city, so the map and this module can never
  // disagree. The master list is treated as IMMUTABLE — we deep-copy out of
  // it so a new game always starts from the same template.
  // ----------------------------------------------------------
  function fromMaster(m, owned) {
    var profile = PROFILES[m.t][m.ti];
    var age     = 3 + ((m.held || 0) >> 1);          // plausible, deterministic
    return {
      id:            m.id,
      name:          m.n,
      sector:        m.t,
      location:      m.ti,                            // tier1 / tier2 / suburban
      label:         profile.label,
      purchasePrice: owned ? m.basis : null,
      currentValue:  m.v,
      baseValue:     m.v,
      baseCapRate:   m.cap,
      askingPrice:   owned ? null : (m.ask || m.v),
      annualNOI:     m.noi,                           // derived in the master as v*cap/100
      occupancy:     Math.round(m.occ) / 100,
      age:           age,
      capexReserve:  Math.round(m.v * 0.01 * (age / 10) * 10) / 10,
      quarterOwned:  owned ? (m.held || 0) : 0,
      encumbered:    false,
      daysOnMarket:  owned ? null : (m.qlist || 0),
      // 2.0 fields the map and properties tab read
      photo:         m.ph,
      x:             m.x,
      y:             m.y,
      zone:          m.z,
      listedByOwner: !!m.listed,
      story:         m.story || "",
      traits:        (m.traits || []).slice(),
    };
  }

  function init() {
    usedNames.clear();
    propIdCounter = 1;

    var M = window.PROPERTIES_MASTER;
    if (!M) {
      console.error("[properties] PROPERTIES_MASTER missing — falling back to v1 generation.");
      GameState.portfolio      = generateStartingPortfolio();
      GameState.propertyMarket = generateInitialMarket();
      return;
    }

    // Yours at the start.
    GameState.portfolio = M.P.filter(function(p) { return p.o === "you"; })
                             .map(function(p) { return fromMaster(p, true); });

    // Buyable: everything in private hands. Rival-held assets are deliberately
    // NOT here — rivals only sell when they choose to list, or you take the
    // whole company (design doc B.3).
    GameState.propertyMarket = M.P.filter(function(p) { return p.o === "none"; })
                                  .map(function(p) { return fromMaster(p, false); });

    // The rest of the city, for the map and the "rest of the city" table.
    GameState.cityRivals = M.P.filter(function(p) { return p.o !== "you" && p.o !== "none"; })
                              .map(function(p) {
                                var c = fromMaster(p, false);
                                c.owner = p.o;
                                return c;
                              });

    GameState.devLots = M.LOTS.map(function(l) {
      return { id:l.id, name:l.n, zone:l.zone, cost:l.cost, x:l.x, y:l.y,
               photo:l.ph, unlockQuarter:l.unlockQuarter, story:l.story || "" };
    });

    // Leases and tenants (tenants.js). Attaches a lease to every building in
    // the city and sets single-tenant buildings to exactly 100% occupied.
    if (typeof Tenants !== "undefined") Tenants.init();
  }

  // ----------------------------------------------------------
  // UPGRADE FUNCTIONS
  // ----------------------------------------------------------

  // Check if renovation is available for a property
  function canRenovate(prop) {
    if (!prop) return { ok: false, reason: "Property not found." };
    if (typeof Staff !== "undefined" && !Staff.hasRole("asset")) return { ok: false, reason: "Requires an Asset Manager. Hire one in the Staff tab." };
    if (prop.location === "tier1") return { ok: false, reason: "Tier 1 properties are already premium — renovation not applicable." };
    if (prop.renovated) return { ok: false, reason: "Already renovated." };
    if (prop.underConstruction) return { ok: false, reason: "Already under construction." };
    if (prop.repositioning) return { ok: false, reason: "Repositioning in progress." };
    if ((prop.quarterOwned || 0) < 2) return { ok: false, reason: "Must own property for at least 2 quarters before renovating." };
    if (prop.occupancy >= 0.90) return { ok: false, reason: "Occupancy already above 90% — renovation would not improve returns sufficiently." };
    return { ok: true };
  }

  function canReposition(prop) {
    if (!prop) return { ok: false, reason: "Property not found." };
    if (typeof Staff !== "undefined" && !Staff.hasRole("asset")) return { ok: false, reason: "Requires an Asset Manager. Hire one in the Staff tab." };
    if (prop.location === "tier1") return { ok: false, reason: "Tier 1 properties cannot be repositioned." };
    if (prop.repositioned) return { ok: false, reason: "Already repositioned." };
    if (prop.underConstruction) return { ok: false, reason: "Already under construction." };
    if (prop.renovating) return { ok: false, reason: "Renovation in progress." };
    if ((prop.quarterOwned || 0) < 2) return { ok: false, reason: "Must own for at least 2 quarters." };

    // Repositioning is a last resort for genuinely distressed assets only —
    // a major, expensive structural change, not a routine optimisation.
    if (prop.occupancy >= 0.70) {
      return { ok: false, reason: "Repositioning is only for distressed properties (occupancy below 70%). This asset is performing too well to justify it." };
    }

    // Must have a valid target sector
    var targets = getRepositionTargets(prop);
    if (targets.length === 0) return { ok: false, reason: "No valid repositioning targets for this property type." };
    return { ok: true };
  }

  function getRepositionTargets(prop) {
    var targets = [];
    if (prop.location === "suburban") {
      if (prop.sector === "office")      targets = ["industrial"];
      if (prop.sector === "retail")      targets = ["industrial", "multifamily"];
      if (prop.sector === "multifamily") targets = ["office"];
      if (prop.sector === "industrial")  targets = [];
    }
    if (prop.location === "tier2") {
      if (prop.sector === "office")      targets = ["multifamily"];
      if (prop.sector === "retail")      targets = ["multifamily", "industrial"];
      if (prop.sector === "multifamily") targets = ["office"];
      if (prop.sector === "industrial")  targets = [];
    }
    return targets;
  }

  function startRenovation(propId) {
    var prop = GameState.portfolio.find(function(p) { return p.id === propId; });
    var check = canRenovate(prop);
    if (!check.ok) return { success: false, message: check.reason };

    var cost = Math.round(prop.currentValue * 0.10 * 10) / 10;
    if (((typeof Revolver !== "undefined" && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash) < cost) {   // round 18: cash plus the credit line
      return { success: false, message: "Not enough money. Need $" + cost + "M (cash plus credit line)." };
    }

    GameState.balance.cash = Math.round((GameState.balance.cash - cost) * 100) / 100;
    if (typeof Financials !== "undefined" && Financials.noteSpend) Financials.noteSpend("projects", cost);   // round 28
    prop.underConstruction = true;
    prop.renovating        = true;
    prop.constructionQuartersLeft = 1;
    prop.constructionType  = "renovation";
    prop.preConstructionOccupancy = prop.occupancy;
    prop.occupancy         = 0; // offline

    return {
      success: true,
      message: prop.name + " renovation started. $" + cost + "M spent. Property offline for 1 quarter.",
      cost: cost
    };
  }

  function startRepositioning(propId, targetSector) {
    var prop = GameState.portfolio.find(function(p) { return p.id === propId; });
    var check = canReposition(prop);
    if (!check.ok) return { success: false, message: check.reason };

    var targets = getRepositionTargets(prop);
    if (targets.indexOf(targetSector) === -1) {
      return { success: false, message: "Cannot reposition " + prop.sector + " to " + targetSector + " at this location." };
    }

    var cost = Math.round(prop.currentValue * 0.15 * 10) / 10;
    if (((typeof Revolver !== "undefined" && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash) < cost) {   // round 18: cash plus the credit line
      return { success: false, message: "Not enough money. Need $" + cost + "M (cash plus credit line)." };
    }

    GameState.balance.cash = Math.round((GameState.balance.cash - cost) * 100) / 100;
    if (typeof Financials !== "undefined" && Financials.noteSpend) Financials.noteSpend("projects", cost);   // round 28
    prop.underConstruction  = true;
    prop.repositioning      = true;
    prop.constructionQuartersLeft = 2;
    prop.constructionType   = "repositioning";
    prop.targetSector       = targetSector;
    prop.preConstructionOccupancy = prop.occupancy;
    prop.occupancy          = 0;

    return {
      success: true,
      message: prop.name + " repositioning to " + targetSector + " started. $" + cost + "M spent. Offline for 2 quarters.",
      cost: cost
    };
  }

  function processConstructionProgress() {
    GameState.portfolio.forEach(function(prop) {
      if (!prop.underConstruction) return;

      prop.constructionQuartersLeft--;

      if (prop.constructionQuartersLeft <= 0) {
        // Construction complete
        prop.underConstruction = false;

        if (prop.constructionType === "renovation") {
          prop.renovating  = false;
          prop.renovated   = true;
          prop.renovatedYear = GameState.meta.year;
          // Renovation lifts NOI 15% and restores the asset's base value
          prop.annualNOI   = Math.round(prop.annualNOI * 1.15 * 100) / 100;
          prop.baseValue   = Math.round((prop.baseValue || prop.currentValue) * 1.12 * 10) / 10;
          prop.baseCapRate = GameState.market.capRates[prop.sector][prop.location];
          prop.occupancy   = Math.min(0.97, Math.round((prop.preConstructionOccupancy + 0.08) * 1000) / 1000);
          prop.constructionType = null;
          GameState.eventLog.push({
            quarter: GameState.meta.quarter,
            year:    GameState.meta.year,
            headline:"🔨 Renovation Complete",
            body:    prop.name + " renovation complete. NOI increased 15%. Occupancy restored.",
            events:  [{ headline: "🔨 " + prop.name + " Renovation Complete", body: "NOI +15%, occupancy restored.", impact: "+$" + Math.round(prop.annualNOI * 0.15 * 10)/10 + "M annual NOI" }]
          });
        }

        /* 2.0: redevelopment after an upzoning (world.js "upzoning"). A year
           offline, then a much bigger building on the same land. */
        if (prop.constructionType === "redevelopment") {
          prop.annualNOI   = Math.round((prop.preRedevNOI || prop.annualNOI) * 1.9 * 100) / 100;
          prop.baseValue   = Math.round((prop.preRedevValue || prop.currentValue) * 1.8 * 10) / 10;
          prop.currentValue = prop.baseValue;
          prop.vb = null;                            // round 10: a new building, a new baseline
          prop.redeveloped = true;
          prop.constructionType = null;
          GameState.eventLog.push({
            quarter: GameState.meta.quarter, year: GameState.meta.year,
            headline: "Redevelopment complete", body: prop.name + " reopens, roughly twice the size.",
            events: [{ headline: prop.name + " reopens after redevelopment", body: "", impact: "NOI now $" + prop.annualNOI + "M/yr" }]
          });
        }

        if (prop.constructionType === "repositioning") {
          var oldSector    = prop.sector;
          prop.sector      = prop.targetSector;
          prop.repositioning = false;
          prop.repositioned  = true;
          // Recalculate NOI at new sector cap rate — use new sector's tier2/suburban profile
          var newProfile   = PROFILES[prop.targetSector][prop.location];
          var newCapRate   = GameState.market.capRates[prop.targetSector][prop.location] / 100;
          // New NOI = current value × new cap rate (value unchanged, income improves)
          prop.annualNOI   = Math.round(prop.currentValue * newCapRate * 100) / 100;
          prop.occupancy   = Math.round((newProfile.occupancyMid * 0.90) * 1000) / 1000; // start at 90% of sector midpoint
          prop.label       = newProfile.label;
          prop.targetSector = null;
          prop.constructionType = null;
          GameState.eventLog.push({
            quarter: GameState.meta.quarter,
            year:    GameState.meta.year,
            headline:"🔄 Repositioning Complete",
            body:    prop.name + " repositioned from " + oldSector + " to " + prop.sector + ".",
            events:  [{ headline: "🔄 " + prop.name + " Repositioned", body: "Sector: " + oldSector + " → " + prop.sector, impact: "New NOI: $" + prop.annualNOI + "M/yr" }]
          });
        }
      }
    });
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    init,
    fromMaster,
    buyProperty,
    sellProperty,
    handOver,
    ownerName,
    transactionFee,
    recalculatePropertyValues, fairValue, stabRent, rebaseValues,
    applyAnnualDecay,
    quarterlyUpdate,
    refreshMarket,
    maybeInjectMegaProperty,
    generateProperty,
    canRenovate,
    canReposition,
    getRepositionTargets,
    startRenovation,
    startRepositioning,
    processConstructionProgress,
    PROFILES,
  };

})();
