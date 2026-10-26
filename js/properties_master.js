/* ============================================================================
   REIT SIM 2.0 — PROPERTY MASTER LIST
   ----------------------------------------------------------------------------
   THE SINGLE SOURCE OF TRUTH for every building in Riverton.
   The map, the properties tab, the rivals and the engine all read from here.
   Nothing generates properties from a random seed any more.

   Locked against REIT_SIM_DESIGN_DOC_v2.md section C.3.1:
     player 4 · rivals 12 (4 each) · private unlisted 20 · private listed 4 = 40
     plus 6 development lots (2 open at start)

   SKELETON STATUS — what is done and what is yours:
     DONE   ids, coordinates (all water-checked), sector, tier, zone, owner,
            listed status, value, cap rate, occupancy, photo key, cost basis
     YOURS  `name`   placeholder names, rename freely
            `story`  one or two sentences of history, empty for now
            `traits` mechanical quirks, empty array for now
            `owner`  reassign to rebalance the rivals

   RULES IF YOU EDIT BY HAND:
     - `noi` is NOT stored. It is derived as value * cap / 100 at load.
       Change value or cap and NOI follows automatically.
     - `ph` must exist in assets/photos/manifest.json or the card shows blank.
     - x and y are percentages of the map image. Every coordinate below sits on
       land. If you invent a new one, check it against the river first.
     - Owner counts are asserted at load. Break them and the console tells you.
   ========================================================================== */

window.PROPERTIES_MASTER = (() => {

  /* -- Owners ------------------------------------------------------------- */
  const OWNERS = {
    you:   { name: 'Meridian REIT',   short: 'You',        color: '#1f9d55', rival: false },
    wex:   { name: 'Wexmoor Properties', short: 'Wexmoor', color: '#e69500', rival: true },
    ren:   { name: 'Rennick Capital', short: 'Rennick',    color: '#d33b3b', rival: true },
    hal:   { name: 'Halden Realty',   short: 'Halden',     color: '#7a5cd0', rival: true },
    none:  { name: 'Private owner',   short: 'Private',    color: '#8393a3', rival: false }
  };

  /* Rival character, so their starting books are not interchangeable.
     This is flavour + the seed for their rule-based behaviour in B.6.      */
  const RIVAL_PROFILES = {
    wex:   { style: 'institutional', appetite: 'industrial+multifamily', risk: 'low',
             note: 'Slow, well capitalised, buys quality and never overpays. The hardest to rattle.' },
    ren:   { style: 'aggressive',    appetite: 'office+retail',          risk: 'high',
             note: 'Levered, trophy hungry, bids fast. Most exposed when rates rise.' },
    hal:   { style: 'yield chaser',  appetite: 'suburban',               risk: 'medium',
             note: 'Buys cheap suburban cash flow. Fat yields until a shock lands on tier 3.' }
  };

  /* -- Zones -------------------------------------------------------------- */
  /* Geography drives tier. Tier 1 only exists in the CBD and on the riverfront. */
  const ZONES = {
    cbd:        'Central Business District',
    riverfront: 'Riverfront',
    midtown:    'Midtown',
    westside:   'West Side',
    southside:  'South Side',
    northend:   'North End'
  };

  /* -- Properties --------------------------------------------------------- */
  /* t  = sector      ti = tier        o = owner      ph = photo key
     v  = value $M    cap = cap rate % occ = occupancy %
     x,y = map position as % of image  basis = original cost $M
     held = quarters owned (player + rivals)                                 */

  const P = [

    /* ===== OFFICE (10) =================================================== */
    { id:'off_01', n:'Meridian Tower',          t:'office', ti:'tier1',    z:'cbd',
      o:'ren' ,  x:78.7, y:42.4, v:128, cap:7.8, occ:91, ph:'office_tier1_a',
      listed:false, basis:118.0, held:9,  status:'active', traits:[], story:'' },

    { id:'off_02', n:'One Riverfront Plaza',    t:'office', ti:'tier1',    z:'riverfront',
      o:'none',  x:82.5, y:61.5, v:112, cap:8.1, occ:87, ph:'office_tier1_b',
      listed:true, ask:118.0, qlist:2, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'off_03', n:'Keystone Building',       t:'office', ti:'tier2',    z:'midtown',
      o:'you',   x:42.6, y:44.4, v:52,  cap:8.4, occ:90, ph:'office_tier2_a',
      listed:false, basis:47.0,  held:6,  status:'active', traits:[], story:'' },

    { id:'off_04', n:'The Landmark',            t:'office', ti:'tier2',    z:'midtown',
      o:'none',  x:62.5, y:36.1, v:61,  cap:8.2, occ:92, ph:'office_tier2_b',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'off_05', n:'Exchange Place',          t:'office', ti:'tier2',    z:'midtown',
      o:'wex'  , x:59.3, y:52.8, v:57,  cap:8.5, occ:88, ph:'office_tier2_c',
      listed:false, basis:52.0,  held:14, status:'active', traits:[], story:'' },

    { id:'off_06', n:'Harbor Point Office',     t:'office', ti:'tier2',    z:'midtown',
      o:'none',  x:64.0, y:58.0, v:48,  cap:8.6, occ:86, ph:'office_tier2_d',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'off_07', n:'Civic Center Office',     t:'office', ti:'suburban', z:'westside',
      o:'hal',   x:12.7, y:40.9, v:29,  cap:9.5, occ:82, ph:'office_suburban_a',
      listed:false, basis:26.5,  held:7,  status:'active', traits:[], story:'' },

    { id:'off_08', n:'Summit Park Office',      t:'office', ti:'suburban', z:'southside',
      o:'none',  x:55.5, y:82.9, v:31,  cap:9.3, occ:89, ph:'office_suburban_b',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'off_09', n:'Westland Business Park',  t:'office', ti:'suburban', z:'westside',
      o:'none',  x:22.3, y:57.7, v:24,  cap:9.7, occ:84, ph:'office_suburban_c',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'off_10', n:'Northgate Offices',       t:'office', ti:'suburban', z:'westside',
      o:'none',  x:31.0, y:50.5, v:21,  cap:9.6, occ:80, ph:'office_suburban_d',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    /* ===== RETAIL (10) =================================================== */
    { id:'ret_01', n:'Fifth & Main',            t:'retail', ti:'tier1',    z:'cbd',
      o:'none',  x:90.0, y:30.9, v:118, cap:8.4, occ:90, ph:'retail_tier1_a',
      listed:true, ask:126.0, qlist:3, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'ret_02', n:'The Gallery',             t:'retail', ti:'tier1',    z:'riverfront',
      o:'ren' ,  x:86.2, y:70.9, v:104, cap:8.6, occ:88, ph:'retail_tier1_b',
      listed:false, basis:96.0,  held:5,  status:'active', traits:[], story:'' },

    { id:'ret_03', n:'Union Market',            t:'retail', ti:'tier2',    z:'northend',
      o:'wex'  , x:61.8, y:28.5, v:58,  cap:9.0, occ:87, ph:'retail_tier2_a',
      listed:false, basis:54.0,  held:12, status:'active', traits:[], story:'' },

    { id:'ret_04', n:'Crossroads Mall',         t:'retail', ti:'tier2',    z:'southside',
      o:'hal',   x:60.2, y:76.6, v:64,  cap:9.2, occ:84, ph:'retail_tier2_b',
      listed:false, basis:59.0,  held:8,  status:'active', traits:[], story:'' },

    { id:'ret_05', n:'Parkway Plaza',           t:'retail', ti:'tier2',    z:'southside',
      o:'none',  x:72.5, y:73.6, v:55,  cap:9.1, occ:86, ph:'retail_tier2_c',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'ret_06', n:'Riverwalk Shops',         t:'retail', ti:'tier2',    z:'southside',
      o:'none',  x:52.5, y:72.0, v:47,  cap:9.3, occ:83, ph:'retail_tier2_d',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'ret_07', n:'Town Center',             t:'retail', ti:'suburban', z:'westside',
      o:'you',   x:36.6, y:57.8, v:27,  cap:10.2, occ:85, ph:'retail_suburban_d',
      listed:false, basis:24.5,  held:9,  status:'active', traits:[], story:'' },

    { id:'ret_08', n:'Oakwood Mall',            t:'retail', ti:'suburban', z:'southside',
      o:'hal',   x:75.7, y:89.6, v:22,  cap:10.4, occ:79, ph:'retail_suburban_b',
      listed:false, basis:19.5,  held:11, status:'active', traits:[], story:'' },

    { id:'ret_09', n:'Market Square',           t:'retail', ti:'suburban', z:'westside',
      o:'none',  x:34.7, y:42.2, v:19,  cap:10.5, occ:81, ph:'retail_suburban_c',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'ret_10', n:'Cedar Crossing',          t:'retail', ti:'suburban', z:'westside',
      o:'none',  x:17.7, y:68.9, v:17,  cap:10.6, occ:78, ph:'retail_suburban_e',
      listed:true, ask:18.0, qlist:1, basis:null, held:null, status:'active', traits:[], story:'' },

    /* ===== MULTIFAMILY (10) ============================================== */
    { id:'mfr_01', n:'Harbor Flats',            t:'multifamily', ti:'tier1',    z:'riverfront',
      o:'none',  x:70.0, y:41.5, v:109, cap:7.2, occ:94, ph:'multifamily_tier1_a',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'mfr_02', n:'The Enclave',             t:'multifamily', ti:'tier1',    z:'cbd',
      o:'wex'  , x:85.3, y:20.0, v:98,  cap:7.3, occ:93, ph:'multifamily_tier1_b',
      listed:false, basis:88.0,  held:16, status:'active', traits:[], story:'' },

    { id:'mfr_03', n:'The Gramercy',            t:'multifamily', ti:'tier2',    z:'midtown',
      o:'you',   x:46.1, y:57.6, v:55,  cap:7.8, occ:91, ph:'multifamily_tier2_a',
      listed:false, basis:51.0,  held:4,  status:'active', traits:[], story:'' },

    { id:'mfr_04', n:'Birchwood',               t:'multifamily', ti:'tier2',    z:'midtown',
      o:'none',  x:57.0, y:44.0, v:61,  cap:7.7, occ:92, ph:'multifamily_tier2_b',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'mfr_05', n:'Lakeshore Apartments',    t:'multifamily', ti:'tier2',    z:'northend',
      o:'ren' ,  x:77.3, y:24.4, v:49,  cap:7.9, occ:90, ph:'multifamily_tier2_c',
      listed:false, basis:44.0,  held:6,  status:'active', traits:[], story:'' },

    { id:'mfr_06', n:'Willow Court',            t:'multifamily', ti:'tier2',    z:'midtown',
      o:'none',  x:45.5, y:67.5, v:44,  cap:8.0, occ:89, ph:'multifamily_tier2_d',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'mfr_07', n:'Uptown Flats',            t:'multifamily', ti:'suburban', z:'midtown',
      o:'none',  x:51.0, y:34.4, v:33,  cap:8.5, occ:88, ph:'multifamily_suburban_a',
      listed:true, ask:35.0, qlist:1, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'mfr_08', n:'Parkview Apartments',     t:'multifamily', ti:'suburban', z:'westside',
      o:'hal',   x:38.5, y:65.0, v:28,  cap:8.6, occ:91, ph:'multifamily_suburban_b',
      listed:false, basis:25.0,  held:10, status:'active', traits:[], story:'' },

    { id:'mfr_09', n:'Elm Street Homes',        t:'multifamily', ti:'suburban', z:'westside',
      o:'none',  x:24.4, y:44.6, v:18,  cap:8.8, occ:93, ph:'multifamily_suburban_c',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'mfr_10', n:'Midtown Residences',      t:'multifamily', ti:'suburban', z:'southside',
      o:'none',  x:23.9, y:83.8, v:20,  cap:8.7, occ:87, ph:'multifamily_suburban_d',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    /* ===== INDUSTRIAL (10) =============================================== */
    { id:'ind_01', n:'Ironside Works',          t:'industrial', ti:'tier1',    z:'riverfront',
      o:'none',  x:66.4, y:49.3, v:113, cap:6.4, occ:92, ph:'industrial_tier1_a',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'ind_02', n:'Port Logistics Center',   t:'industrial', ti:'tier1',    z:'northend',
      o:'wex'  , x:76.2, y:16.0, v:100, cap:7.4, occ:100, ph:'industrial_tier1_b',
      listed:false, basis:84.0,  held:18, status:'active', traits:[], story:'Atlas Cold Chain\u2019s frozen food hub at the port: one tenant, a 15 year lease, rent up 3% a year. Wexmoor\u2019s best building, and Eleanor knows it.' },

    { id:'ind_03', n:'Metro Distribution',      t:'industrial', ti:'tier2',    z:'midtown',
      o:'you',   x:54.8, y:62.1, v:59,  cap:7.0, occ:95, ph:'industrial_tier2_a',
      listed:false, basis:48.2,  held:11, status:'active', traits:[], story:'' },

    { id:'ind_04', n:'Railyard Yard',           t:'industrial', ti:'tier2',    z:'midtown',
      o:'ren' ,  x:50.0, y:45.6, v:43,  cap:7.2, occ:91, ph:'industrial_tier2_b',
      listed:false, basis:39.0,  held:4,  status:'active', traits:[], story:'' },

    /* NAME LOCKED: the photo has "KERPER WORKS" painted on the building. Rename
       this one and the picture contradicts the card. Either keep the name or
       swap the photo first.                                                    */
    { id:'ind_05', n:'Kerper Works',            t:'industrial', ti:'tier2',    z:'riverfront',
      o:'none',  x:68.6, y:63.1, v:52,  cap:7.1, occ:93, ph:'industrial_tier2_c',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'ind_06', n:'Eagle Point Depot',       t:'industrial', ti:'tier2',    z:'northend',
      o:'none',  x:67.0, y:21.0, v:46,  cap:7.3, occ:90, ph:'industrial_tier2_d',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'ind_07', n:'Southside Warehouse',     t:'industrial', ti:'suburban', z:'southside',
      o:'none',  x:23.1, y:75.4, v:22,  cap:7.9, occ:90, ph:'industrial_suburban_a',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'ind_08', n:'Millbrook Yard',          t:'industrial', ti:'suburban', z:'westside',
      o:'none',  x:14.3, y:50.7, v:17,  cap:8.1, occ:88, ph:'industrial_suburban_b',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'ind_09', n:'Dubois Freight',          t:'industrial', ti:'suburban', z:'midtown',
      o:'none',  x:43.0, y:34.7, v:25,  cap:7.8, occ:92, ph:'industrial_suburban_c',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' },

    { id:'ind_10', n:'Asbury Industrial',       t:'industrial', ti:'suburban', z:'southside',
      o:'none',  x:69.1, y:84.9, v:19,  cap:8.0, occ:86, ph:'industrial_suburban_d',
      listed:false, basis:null, held:null, status:'active', traits:[], story:'' }
  ];

  /* -- Development lots ---------------------------------------------------- */
  /* C.3.2: 2 open at start, +1 roughly every 10 quarters, max 6.
     `unlockQuarter` is the quarter the auction opens. Auctions run 2 quarters. */
  const LOTS = [
    { id:'lot_01', n:'Fifth Street Lot',  z:'cbd',       zone:'office',
      x:78.8, y:53.2, cost:42, unlockQuarter:1,  ph:'land_downtown_a',  story:'' },
    { id:'lot_02', n:'Grandview Lot',     z:'midtown',   zone:'multifamily',
      x:51.1, y:25.6, cost:24, unlockQuarter:1,  ph:'land_midtown_a',   story:'' },
    { id:'lot_03', n:'Southgate Lot',     z:'southside', zone:'retail',
      x:30.0, y:71.2, cost:20, unlockQuarter:11, ph:'land_suburban_a',  story:'' },
    { id:'lot_04', n:'Peninsula Lot',     z:'northend',  zone:'industrial',
      x:72.3, y:9.0,  cost:30, unlockQuarter:21, ph:'land_industrial_a', story:'' },
    { id:'lot_05', n:'Hillcrest Lot',     z:'westside',  zone:'multifamily',
      x:36.5, y:29.3, cost:26, unlockQuarter:31, ph:'land_general_a',   story:'' },
    { id:'lot_06', n:'Riverbend Lot',     z:'midtown',   zone:'office',
      x:64.0, y:30.0, cost:34, unlockQuarter:41, ph:'land_general_b',   story:'' }
  ];

  /* Celestial Heights and the whole nephew storyline are CUT from 2.0 — they
     belong to v1 (see A.12 in the design doc). The 'supertower' photo is now
     unassigned and available: the obvious use is a genuine tier-1 trophy that
     appears on the market once, late, at a price that hurts.
     'industrial_toptier' is reserved for the superfactory if it gets made.   */
  /* Story buildings: not part of the locked 40, added by the story that
     needs them (story.js). Same fields as P.                                */
  const SPECIALS = {
    // The Harlow story (MPT): Harlow Grocers' own distribution centre, sold to
    // you in Year 2 and leased back. Worth ~$68M at market yields; Bob asks $60M.
    harlow_dc: { id:'ind_hdc', n:'Harlow Distribution Centre', t:'industrial', ti:'tier2', z:'southside',
      o:'none', x:60.0, y:70.0, v:68, cap:7.06, occ:100, ph:'industrial_harlow_dc',
      listed:false, basis:null, held:null, status:'active', traits:[], noi:4.8,
      story:'Harlow Grocers\' only distribution centre. Every store in the chain is fed from here.' },
    // The Rennick war: Jack Morrow's office building, sold when he retires (war.js)
    morrow_plaza: { id:'off_mpz', n:'Morrow Plaza', t:'office', ti:'tier2', z:'midtown',
      o:'none', x:72.0, y:56.0, v:45, cap:9.0, occ:96, ph:'office_tier2_c',
      listed:false, basis:null, held:null, status:'active', traits:[], noi:4.05,
      story:'Built by Jack Morrow in 1986. Long leases, a lobby he still polishes himself.' }
  };

  /* -- Derived values ------------------------------------------------------ */
  /* NOI and yield-on-cost are computed, never stored. One source of truth.   */
  P.forEach(p => {
    p.noi = +(p.v * p.cap / 100).toFixed(2);
    p.yoc = p.basis ? +(p.noi / p.basis * 100).toFixed(1) : null;
  });

  /* -- Self-check ---------------------------------------------------------- */
  /* Runs at load. Any drift from the locked design shows up in the console
     immediately rather than as a weird balance problem three weeks later.    */
  function validate() {
    const errs = [];
    const count = (f) => P.filter(f).length;

    const expect = (label, got, want) => {
      if (got !== want) errs.push(`${label}: got ${got}, expected ${want}`);
    };

    expect('total properties', P.length, 40);
    expect('player assets',    count(p => p.o === 'you'), 4);
    expect('Wexmoor',          count(p => p.o === 'wex'), 4);
    expect('Rennick',          count(p => p.o === 'ren'), 4);
    expect('Halden',           count(p => p.o === 'hal'), 4);
    expect('private unlisted', count(p => p.o === 'none' && !p.listed), 20);
    expect('private listed',   count(p => p.o === 'none' && p.listed), 4);
    expect('development lots', LOTS.length, 6);
    expect('lots open at Q1',  LOTS.filter(l => l.unlockQuarter === 1).length, 2);

    ['office', 'retail', 'multifamily', 'industrial'].forEach(s =>
      expect(`sector ${s}`, count(p => p.t === s), 10));
    expect('tier1',    count(p => p.ti === 'tier1'), 8);
    expect('tier2',    count(p => p.ti === 'tier2'), 16);
    expect('suburban', count(p => p.ti === 'suburban'), 16);

    // ids must be unique
    const ids = new Set();
    [...P, ...LOTS].forEach(o => {
      if (ids.has(o.id)) errs.push(`duplicate id: ${o.id}`);
      ids.add(o.id);
    });

    // listed properties need an asking price
    P.filter(p => p.listed && !p.ask).forEach(p =>
      errs.push(`${p.id} is listed but has no ask price`));

    // anything the player or a rival owns needs a cost basis
    P.filter(p => p.o !== 'none' && !p.basis).forEach(p =>
      errs.push(`${p.id} is owned by ${p.o} but has no cost basis`));

    // coordinates must be on the map
    [...P, ...LOTS].forEach(o => {
      if (o.x < 5 || o.x > 95 || o.y < 5 || o.y > 95)
        errs.push(`${o.id} coordinate off map: ${o.x},${o.y}`);
    });

    if (errs.length) console.error('[properties_master] ' + errs.length + ' problem(s):\n' + errs.join('\n'));
    else console.log('[properties_master] OK — 40 properties, 6 lots, all checks passed.');
    return errs;
  }

  /* -- Helpers the other modules will want --------------------------------- */
  const byId      = id => P.find(p => p.id === id) || LOTS.find(l => l.id === id) || null;
  const owned     = owner => P.filter(p => p.o === owner);
  const forSale   = () => P.filter(p => p.listed);
  const openLots  = quarter => LOTS.filter(l => l.unlockQuarter <= quarter);
  const photoPath = key => 'assets/photos/' + key + '.jpg';

  /* Portfolio roll-up: value, NOI, weighted cap, weighted occupancy. */
  function summarise(list) {
    const v = list.reduce((a, p) => a + p.v, 0);
    const noi = list.reduce((a, p) => a + p.noi, 0);
    return {
      count: list.length,
      value: +v.toFixed(1),
      noi:   +noi.toFixed(2),
      cap:   v ? +(noi / v * 100).toFixed(2) : 0,
      occ:   v ? +(list.reduce((a, p) => a + p.occ * p.v, 0) / v).toFixed(1) : 0
    };
  }

  validate();

  return { OWNERS, RIVAL_PROFILES, ZONES, P, LOTS, SPECIALS,
           validate, byId, owned, forSale, openLots, photoPath, summarise };
})();
