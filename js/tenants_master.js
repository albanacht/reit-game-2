/* ============================================================================
   REIT SIM 2.0 — TENANT MASTER LIST
   ----------------------------------------------------------------------------
   Who actually pays the rent in Riverton. Pairs with properties_master.js:
   every one of the 40 buildings has exactly one LEASES entry below.

   SKELETON STATUS — draft for Alexander to edit:
     names, industries, coverage, trends, lease terms and one-line stories are
     all first drafts. Rename and retune freely; the validator at the bottom
     will shout if a change breaks a rule.

   THREE LEASE STRUCTURES (design doc B.4)
     single       one named tenant, triple-net. Occupancy is 100% or 0%.
     multi        2-4 named majors + "N other tenants". Occupancy = shares leased.
     residential  multifamily: units + occupancy %, plus a management model.

   RULES IF YOU EDIT BY HAND
     - Rent is NOT stored. It is derived as building NOI x the tenant's share,
       so NOI in properties_master.js stays the single source of truth.
     - coverage = the tenant's EBITDAR / the rent it pays. null = government.
     - trend: +1 improving, 0 flat, -1 deteriorating.
     - years = lease years remaining at game start. Keep expiries STAGGERED so
       something is always coming due (the overlapping-timer principle, B.11).
     - No single tenant may exceed 15% of the PLAYER'S starting rent roll
       (design doc C.3.3). The validator checks this.
   ========================================================================== */

window.TENANTS_MASTER = (() => {

  /* ------------------------------------------------------------------------
     THE TENANTS — each business exists once, however many buildings it is in.
     ---------------------------------------------------------------------- */
  const T = {

    /* ===== The town roster — businesses that span several buildings ===== */
    first_riverton_bank: { name:"First Riverton Bank",      industry:"Regional bank",          coverage:3.4,  trend: 0, esc:0.025,
      story:"The city's oldest bank. Conservative, slow to decide, never late on rent." },
    valley_mutual:       { name:"Valley Mutual Insurance",  industry:"Insurance",              coverage:3.8,  trend: 0, esc:0.025,
      story:"A mutual insurer headquartered downtown since the 1950s." },
    hartwell_pryce:      { name:"Hartwell & Pryce LLP",     industry:"Law firm",               coverage:3.0,  trend: 0, esc:0.03,
      story:"Riverton's largest law firm. Wants prestige space and pays for it." },
    keel_engineering:    { name:"Keel Engineering",         industry:"Engineering consultancy",coverage:2.7,  trend: 1, esc:0.025,
      story:"Growing on infrastructure work. The kind of tenant that asks to expand." },
    summit_software:     { name:"Summit Software",          industry:"Technology",             coverage:2.2,  trend: 1, esc:0.03,
      story:"Profitable and hiring — but half its staff work from home, and its lease is up soon." },
    eastbank_cu:         { name:"Eastbank Credit Union",    industry:"Credit union",           coverage:3.1,  trend: 0, esc:0.02,
      story:"Member-owned and dull, in the best way." },
    riverton_health:     { name:"Riverton Health Partners", industry:"Outpatient clinics",     coverage:2.6,  trend: 1, esc:0.025,
      story:"Clinics across the west side. Medical office tenants rarely leave — the fit-out is too expensive." },
    tristate_telecom:    { name:"Tri-State Telecom",        industry:"Call centre",            coverage:1.9,  trend:-1, esc:0.02,
      story:"Its customer-service floor is being automated one team at a time." },
    county:              { name:"Riverton County Services", industry:"Local government",       coverage:null, trend: 0, esc:0.015,
      story:"The county's permits and records office. Pays late, but always pays." },

    harlow_grocers:      { name:"Harlow Grocers",           industry:"Grocery chain",          coverage:1.7,  trend: 0, esc:0.015,
      story:"Riverton's grocery chain, run by Bob Harlow, the founder's grandson. Anchors three centres in town. Where Harlow goes, foot traffic follows." },
    crescent_pharmacy:   { name:"Crescent Pharmacy",        industry:"Pharmacy chain",         coverage:2.4,  trend: 0, esc:0.02,
      story:"A reliable in-line tenant that signs long leases." },
    starline_cinemas:    { name:"Starline Cinemas",         industry:"Cinema",                 coverage:1.3,  trend:-1, esc:0.02,
      story:"Attendance never fully came back. Management talks about 'experiential repositioning'." },
    prairie_outfitters:  { name:"Prairie Outfitters",       industry:"Sporting goods",         coverage:1.8,  trend: 0, esc:0.02,
      story:"Regional outdoor retailer with a loyal following." },
    ironcore_fitness:    { name:"IronCore Fitness",         industry:"Gym chain",              coverage:1.5,  trend: 0, esc:0.02,
      story:"Busy in January, quiet by March." },
    bellmont:            { name:"Bellmont & Co.",           industry:"Department store",       coverage:1.1,  trend:-1, esc:0.01,
      story:"A hundred-year-old department store closing branches across the region. Anchors Rennick's Gallery." },

    atlas_cold_chain:    { name:"Atlas Cold Chain",         industry:"Frozen food logistics",  coverage:3.2,  trend: 0, esc:0.03, steady:true,
      story:"Runs the cold storage that keeps Riverton's supermarkets stocked. Profitable in every economy: people eat in recessions too." },
    northline_logistics: { name:"Northline Logistics",      industry:"Third-party logistics",  coverage:2.9,  trend: 1, esc:0.03,
      story:"Runs warehousing for half the region's retailers." },
    kerper_foods:        { name:"Kerper Foods",             industry:"Food distribution",      coverage:1.4,  trend:-1, esc:0.02,
      story:"Part of the Kerper family group. Margins squeezed by the national distributors." },
    kerper_works_ltd:    { name:"Kerper Works Ltd",         industry:"Metal fabrication",      coverage:1.3,  trend:-1, esc:0.025,
      story:"Sold its own factory and leased it back to raise cash. Same family as Kerper Foods — if one goes, watch the other." },

    /* ===== Single-tenant occupiers ===== */
    ironside_steel:      { name:"Ironside Steel Fabricators", industry:"Heavy manufacturing",  coverage:2.4,  trend: 0, esc:0.02,
      story:"Riverton's biggest industrial employer. Ties to the rail line." },
    great_river_rail:    { name:"Great River Rail Services",industry:"Rail maintenance",       coverage:2.8,  trend: 0, esc:0.025,
      story:"Maintains rolling stock for the freight lines." },
    eagle_point_cold:    { name:"Eagle Point Cold Storage", industry:"Cold storage",           coverage:2.6,  trend: 1, esc:0.03,
      story:"Refrigerated warehousing. Expensive to build, so tenants stay." },
    southside_auto:      { name:"Southside Auto Parts",     industry:"Parts distribution",     coverage:1.7,  trend: 0, esc:0.02,
      story:"Family-run parts distributor, third generation." },
    bobs_machinery:      { name:"Bob's Machinery",          industry:"Industrial equipment",   coverage:2.2,  trend:-1, esc:0.025,
      story:"Sells and repairs farm and plant machinery. Order book softening." },
    dubois_freight:      { name:"Dubois Freight Lines",     industry:"Trucking",               coverage:1.9,  trend: 0, esc:0.02,
      story:"Sold its depot to fund new trucks and leased it back. Another sale-leaseback." },
    asbury_plastics:     { name:"Asbury Plastics",          industry:"Plastics moulding",      coverage:1.6,  trend:-1, esc:0.02,
      story:"Lost a major contract last year. Lease is up soon and nobody knows if they'll renew." },

    /* ===== Other named majors in multi-tenant buildings ===== */
    blue_heron_imports:  { name:"Blue Heron Imports",       industry:"Import wholesaler",      coverage:2.0,  trend: 0, esc:0.025, story:"Imports housewares through the port." },
    cardinal_beverage:   { name:"Cardinal Beverage",        industry:"Beverage distribution",  coverage:2.5,  trend: 0, esc:0.025, story:"Regional drinks distributor. Steady." },
    midwest_paper:       { name:"Midwest Paper Supply",     industry:"Packaging",              coverage:1.8,  trend: 0, esc:0.02,  story:"Packaging for the food trade." },
    oakes_architects:    { name:"Oakes Architects",         industry:"Architecture",           coverage:2.2,  trend: 0, esc:0.025, story:"Designed half of downtown." },
    cobalt_staffing:     { name:"Cobalt Staffing",          industry:"Recruitment",            coverage:1.6,  trend:-1, esc:0.02,  story:"Hiring agencies suffer first in a slowdown." },
    harbor_shipping:     { name:"Harbor Point Shipping",    industry:"Freight forwarding",     coverage:1.5,  trend:-1, esc:0.02,  story:"Has the building's name on the door and half the floors. Renewal due soon." },
    pinecrest_dental:    { name:"Pinecrest Dental Group",   industry:"Dental practices",       coverage:2.8,  trend: 0, esc:0.025, story:"Dentists do not work from home." },
    westland_title:      { name:"Westland Title & Escrow",  industry:"Title insurance",        coverage:2.0,  trend: 0, esc:0.02,  story:"Busy when houses sell, idle when they don't." },
    allied_homecare:     { name:"Allied Home Care",         industry:"Home health",            coverage:1.7,  trend: 1, esc:0.02,  story:"Growing with an ageing town." },
    midland_home:        { name:"Midland Home Goods",       industry:"Home furnishings",       coverage:1.2,  trend:-1, esc:0.015, story:"Anchors Crossroads Mall. Online competition is eating it alive." },
    riverwalk_brewing:   { name:"Riverwalk Brewing Co.",    industry:"Brewpub",                coverage:1.9,  trend: 1, esc:0.02,  story:"Draws the evening crowd the whole strip depends on." },
    pennylane_discount:  { name:"Penny Lane Discount",      industry:"Discount retail",        coverage:1.6,  trend: 0, esc:0.015, story:"Thrives when times are hard." },
    cedar_hardware:      { name:"Cedar Hardware",           industry:"Hardware store",         coverage:1.2,  trend:-1, esc:0.01,  story:"The sign is on the building. The lease runs out next year." },
    cedar_grocery:       { name:"Cedar Corner Grocery",     industry:"Independent grocer",     coverage:1.4,  trend: 0, esc:0.01,  story:"A small grocer hanging on beside the big chains." },

    /* ===== Operator (master lease) ===== */
    riverton_living:     { name:"Riverton Residential Living LLC", industry:"Apartment operator", coverage:1.5, trend: 0, esc:0.02,
      story:"Leases whole apartment buildings and runs them. Pays fixed rent; keeps the upside and the risk." },
  };

  /* ------------------------------------------------------------------------
     LEASES — one entry per building. share = fraction of the building's rent.
     count = total tenants (named + others). years = remaining at game start.
     ---------------------------------------------------------------------- */
  const L = {
    /* ---- OFFICE ---- */
    off_01: { type:"multi", count:25, majors:[ { t:"first_riverton_bank", share:0.22, years:7 },
                                               { t:"hartwell_pryce",      share:0.15, years:4 },
                                               { t:"valley_mutual",       share:0.12, years:9 } ] },
    off_02: { type:"multi", count:21, majors:[ { t:"summit_software",     share:0.25, years:2 },
                                               { t:"keel_engineering",    share:0.14, years:5 },
                                               { t:"eastbank_cu",         share:0.10, years:6 } ] },
    off_03: { type:"multi", count:11, majors:[ { t:"first_riverton_bank", share:0.35, years:5 },
                                               { t:"riverton_health",     share:0.20, years:8 } ] },
    off_04: { type:"multi", count:12, majors:[ { t:"valley_mutual",       share:0.30, years:6 },
                                               { t:"oakes_architects",    share:0.12, years:3 } ] },
    off_05: { type:"multi", count:10, majors:[ { t:"cobalt_staffing",     share:0.28, years:3 },
                                               { t:"keel_engineering",    share:0.18, years:4 } ] },
    off_06: { type:"multi", count:8,  majors:[ { t:"harbor_shipping",     share:0.40, years:2 } ] },
    off_07: { type:"single", tenant:"county",            years:8 },
    off_08: { type:"multi", count:5,  majors:[ { t:"riverton_health",     share:0.45, years:9 },
                                               { t:"pinecrest_dental",    share:0.15, years:4 } ] },
    off_09: { type:"multi", count:6,  majors:[ { t:"westland_title",      share:0.30, years:3 },
                                               { t:"allied_homecare",     share:0.20, years:5 } ] },
    off_10: { type:"single", tenant:"tristate_telecom",  years:3 },

    /* ---- RETAIL (the first major listed is the anchor, where there is one) ---- */
    ret_01: { type:"multi", count:29, anchor:false,
              majors:[ { t:"prairie_outfitters", share:0.18, years:6 },
                       { t:"starline_cinemas",   share:0.14, years:5 },
                       { t:"crescent_pharmacy",  share:0.10, years:8 } ] },
    ret_02: { type:"multi", count:24, anchor:true,
              majors:[ { t:"bellmont",           share:0.30, years:4 },
                       { t:"ironcore_fitness",   share:0.09, years:5 } ] },
    ret_03: { type:"multi", count:13, anchor:true,
              majors:[ { t:"harlow_grocers",     share:0.38, years:10 },
                       { t:"crescent_pharmacy",  share:0.08, years:6 } ] },
    ret_04: { type:"multi", count:16, anchor:true,
              majors:[ { t:"midland_home",       share:0.32, years:3 },
                       { t:"starline_cinemas",   share:0.12, years:4 } ] },
    ret_05: { type:"multi", count:10, anchor:true,
              majors:[ { t:"harlow_grocers",     share:0.40, years:8 } ] },
    ret_06: { type:"multi", count:13, anchor:false,
              majors:[ { t:"riverwalk_brewing",  share:0.15, years:5 } ] },
    ret_07: { type:"multi", count:8,  anchor:true,
              majors:[ { t:"harlow_grocers",     share:0.40, years:6 },
                       { t:"ironcore_fitness",   share:0.15, years:3 } ] },
    ret_08: { type:"multi", count:8,  anchor:true,
              majors:[ { t:"pennylane_discount", share:0.30, years:4 } ] },
    ret_09: { type:"multi", count:7,  anchor:true,
              majors:[ { t:"crescent_pharmacy",  share:0.30, years:7 } ] },
    ret_10: { type:"multi", count:6,  anchor:false,
              majors:[ { t:"cedar_hardware",     share:0.25, years:1 },
                       { t:"cedar_grocery",      share:0.20, years:2 } ] },

    /* ---- MULTIFAMILY ---- mgmt: inhouse | thirdparty | operator */
    mfr_01: { type:"residential", units:360, mgmt:"inhouse" },
    mfr_02: { type:"residential", units:310, mgmt:"inhouse" },
    mfr_03: { type:"residential", units:210, mgmt:"inhouse" },
    mfr_04: { type:"residential", units:240, mgmt:"inhouse" },
    mfr_05: { type:"residential", units:190, mgmt:"thirdparty" },
    mfr_06: { type:"residential", units:170, mgmt:"thirdparty" },
    mfr_07: { type:"residential", units:130, mgmt:"inhouse" },
    mfr_08: { type:"residential", units:120, mgmt:"thirdparty" },
    mfr_09: { type:"residential", units:80,  mgmt:"operator", operator:"riverton_living", years:9 },
    mfr_10: { type:"residential", units:96,  mgmt:"inhouse" },

    /* ---- INDUSTRIAL ---- */
    ind_01: { type:"single", tenant:"ironside_steel",    years:9 },
    ind_02: { type:"single", tenant:"atlas_cold_chain", years:15 },     // round 16: the Port Logistics story (port.js)
    /* Metro Distribution is the player's biggest building. As a single-tenant
       building its occupier would be ~27% of the starting rent roll, breaking
       the 15% rule — so it is multi-tenant, with three occupiers. */
    ind_03: { type:"multi", count:3, majors:[ { t:"kerper_foods",       share:0.40, years:3 },
                                              { t:"cardinal_beverage",  share:0.35, years:6 },
                                              { t:"midwest_paper",      share:0.25, years:2 } ] },
    ind_04: { type:"single", tenant:"great_river_rail",  years:6 },
    ind_05: { type:"single", tenant:"kerper_works_ltd",  years:5 },
    ind_06: { type:"single", tenant:"eagle_point_cold",  years:8 },
    ind_07: { type:"single", tenant:"southside_auto",    years:3 },
    ind_08: { type:"single", tenant:"bobs_machinery",    years:6 },
    ind_09: { type:"single", tenant:"dubois_freight",    years:4 },
    ind_10: { type:"single", tenant:"asbury_plastics",   years:2 },
  };

  /* ------------------------------------------------------------------------
     HELPERS
     ---------------------------------------------------------------------- */
  function creditLabel(cov) {
    if (cov == null) return "Government";
    if (cov >= 2.5)  return "Strong";
    if (cov >= 1.5)  return "Fine";
    if (cov >= 1.0)  return "Watch";
    return "Distressed";
  }

  /* Human-readable tenant count for building cards. */
  function countLabel(propId) {
    const l = L[propId];
    if (!l) return "";
    if (l.type === "single")      return "1 tenant";
    if (l.type === "residential") return l.units + " units";
    return l.count + " tenants";
  }

  /* Each named tenant position in a building, with rent derived from NOI. */
  function rentRoll(propId, buildingNOI) {
    const l = L[propId];
    if (!l) return [];
    if (l.type === "single")
      return [{ t: l.tenant, share: 1, years: l.years, rent: buildingNOI }];
    if (l.type === "residential")
      return l.mgmt === "operator"
        ? [{ t: l.operator, share: 1, years: l.years, rent: buildingNOI }]
        : [];
    return l.majors.map(m => ({ t: m.t, share: m.share, years: m.years, rent: buildingNOI * m.share }));
  }

  /* ------------------------------------------------------------------------
     VALIDATION — runs at load, like properties_master.js
     ---------------------------------------------------------------------- */
  function validate() {
    const errs = [];
    const M = window.PROPERTIES_MASTER;

    // every building has exactly one lease entry, and nothing extra
    if (M) {
      M.P.forEach(p => { if (!L[p.id]) errs.push(`${p.id} (${p.n}) has no lease entry`); });
      Object.keys(L).forEach(id => { if (!M.P.find(p => p.id === id)) errs.push(`lease for unknown building ${id}`); });
    }

    // structure checks
    Object.entries(L).forEach(([id, l]) => {
      if (l.type === "single" && !T[l.tenant]) errs.push(`${id}: unknown tenant ${l.tenant}`);
      if (l.type === "multi") {
        const sum = l.majors.reduce((a, m) => a + m.share, 0);
        if (sum > 1.0001) errs.push(`${id}: named shares add to ${Math.round(sum*100)}% (>100%)`);
        if (l.count < l.majors.length) errs.push(`${id}: count ${l.count} < named majors ${l.majors.length}`);
        l.majors.forEach(m => { if (!T[m.t]) errs.push(`${id}: unknown tenant ${m.t}`); });
      }
      if (l.type === "residential" && l.mgmt === "operator" && !T[l.operator])
        errs.push(`${id}: unknown operator ${l.operator}`);
      if (M) {
        const p = M.P.find(x => x.id === id);
        if (p && p.t === "multifamily" && l.type !== "residential") errs.push(`${id}: multifamily must be residential`);
        if (p && p.t !== "multifamily" && l.type === "residential") errs.push(`${id}: only multifamily can be residential`);
      }
    });

    // C.3.3 — no tenant above 15% of the PLAYER'S starting rent roll
    if (M) {
      const mine = M.P.filter(p => p.o === "you");
      const roll = mine.reduce((a, p) => a + p.noi, 0);
      const byTenant = {};
      mine.forEach(p => rentRoll(p.id, p.noi).forEach(r => {
        byTenant[r.t] = (byTenant[r.t] || 0) + r.rent;
      }));
      Object.entries(byTenant).forEach(([t, rent]) => {
        const pct = rent / roll;
        if (pct > 0.15) errs.push(`${T[t] ? T[t].name : t} is ${Math.round(pct*100)}% of the player's rent roll (max 15%)`);
      });
    }

    // lease expiries should be staggered, not bunched
    const byYear = {};
    Object.values(L).forEach(l => {
      const ys = l.type === "single" ? [l.years]
               : l.type === "multi"  ? l.majors.map(m => m.years)
               : (l.years ? [l.years] : []);
      ys.forEach(y => byYear[y] = (byYear[y] || 0) + 1);
    });
    const worstYear = Math.max(...Object.values(byYear));
    const total = Object.values(byYear).reduce((a, b) => a + b, 0);
    if (worstYear > total * 0.3) errs.push(`lease expiries bunched: ${worstYear} of ${total} in one year`);

    if (errs.length) console.error("[tenants_master] " + errs.length + " problem(s):\n" + errs.join("\n"));
    else console.log("[tenants_master] OK — " + Object.keys(T).length + " tenants, " +
                     Object.keys(L).length + " buildings, all checks passed.");
    return errs;
  }

  if (typeof window.PROPERTIES_MASTER !== "undefined") validate();

  return { TENANTS: T, LEASES: L, creditLabel, countLabel, rentRoll, validate };
})();
