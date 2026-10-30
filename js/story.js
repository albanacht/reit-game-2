/* ============================================================================
   story.js — SIDE STORIES (round 7).

   A story runs over years, not a quarter. Each beat names people, carries
   numbers, and the outcome is rolled from the numbers at that moment, so no
   two runs tell it the same way. Stories also leave marks on the board
   (Directors.bond: friend or foe), which later stories build on.

   STORY 1 — HARLOW (the MPT story). Alexander was an MPT investor; this is
   that experience transposed: a sale and leaseback that makes one tenant too
   big to fail, then a loan to keep it paying rent, then the dice.
     Act 0  Year 2. Bob Harlow offers his distribution centre, worth ~$68M,
            for $60M, leased back for 15 years at $4.8M (8%). Hassan backs it.
     Act 1  If Harlow overexpands (70%): news of trouble, then late rent in
            the second year.
     Act 2  Bob asks for $24M, 2 years at 10%. Hassan backs Bob. Lend or refuse.
     Act 3  Every quarter his rent cover decides whether he pays. First miss:
            Okafor says evict, Hassan and Bob say wait (+1 political capital).
     Act 4  At maturity: repay ~30%, ask for a year ~35%, can't pay ~35%,
            shifted by his rent cover and the economy.
     Act 5  The extra year: repay, part repay, or bust.

   Plumbing:
     - Story.processQuarter() runs inside the quarter (financials.js, before
       the P&L). It books loan interest (pnl.loanInterest), moves the story
       on, posts letters and returns lines for the quarter feed.
     - A decision beat sets GameState.story.due to a card id. The cards are
       registered as World SYSTEM cards (never in the deck), so the inbox,
       the dialog, holds and save/load handle them unchanged. World serves
       the bank's cards first, then the story.
     - Loans are an ASSET (Story.otherAssets() in financials' total assets).
       Interest is income only when paid; unpaid interest is not booked.
       Write-offs and provisions are P&L losses but not cash (the cash left
       when you lent): writeOff() puts the cash back after the P&L line.
   ========================================================================== */

window.Story = (() => {

  const rnd = () => Math.random();
  const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const fmt = n => Math.round(n * 100) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const money = n => '$' + Math.abs(n).toFixed(1) + 'M';
  const pc = n => Math.round(n) + '%';
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const FACE = k => 'assets/faces/' + k + '.jpg';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function S() {
    const G = GameState;
    if (!G.story) G.story = { due: null, held: {}, harlow: null };
    if (!G.story.held) G.story.held = {};
    return G.story;
  }
  function init() { GameState.story = null; GameState.ceo = null; S(); }

  // -- money: what is P&L and what is only cash ------------------------------
  const cash = d => { GameState.balance.cash = fmt(GameState.balance.cash + d); };
  const pnlNow = d => { GameState.pnl.unusualItems = fmt((GameState.pnl.unusualItems || 0) + d); };
  const pnlLater = d => { GameState._pendingUnusual = fmt((GameState._pendingUnusual || 0) + d); };
  /* A loss with no cash leaving: the P&L line also runs through cash in
     financials (now) or at the next quarter (later), so put the cash back. */
  function writeOff(amount, now) { if (Math.abs(amount) < 0.005) return; (now ? pnlNow : pnlLater)(-amount); cash(amount); oneOff(-amount, now); }
  /* round 35: tag one-offs so the market's "core" cash profit leaves them out (financials.js coreAffo) */
  function oneOff(d, now) { if (now) GameState.pnl.nonCash = fmt((GameState.pnl.nonCash || 0) + d); else GameState._pendingNonCash = fmt((GameState._pendingNonCash || 0) + d); }

  function attitude(id, d, why) {
    const x = (GameState.board.directors || []).find(v => v.id === id); if (!x) return;
    GameState._attCause = GameState._attCause || {}; GameState._attCause[id] = why || GameState._decisionCtx || 'a story beat';
    x.attitude = clamp(x.attitude + d, 0, 10);
  }
  const bond = (id, d, why) => { if (window.Directors && Directors.bond) Directors.bond(id, d, why); };
  const repOf = (id, d, why) => { if (window.Directors && Directors.repChange) Directors.repChange(id, d, why); };
  const JOURNO = 'Nora Whitlock', PAPER = 'Riverton Ledger';
  const say = (from, role, title, body, face) => { if (window.Inbox) Inbox.message(from, role, title, body, face); };
  const dname = id => window.Directors ? Directors.name(id) : id;
  const spend = () => (window.Revolver && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash;
  const fee = n => window.Properties && Properties.transactionFee ? Properties.transactionFee(n) : n * 0.02;

  /* A board member's line inside a decision. */
  const onBoard = id => !window.Directors || !Directors.has || Directors.has(id);
  const sayDir = (id, role, title, body) => { if (onBoard(id)) say(dname(id), role, title, body, FACE(id)); };
  const voice = (id, text) => !onBoard(id) ? '' : '<div class="dv"><img src="' + FACE(id) + '" alt=""><div><b>' + esc(dname(id).replace(/^(Chairman|Director) /, '')) + ':</b> ' + text + '</div></div>';
  const voices = list => '<div class="dv-wrap">' + list.join('') + '</div>';
  const nums = rows => '<table class="dv-nums">' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';

  // ============================================================================
  // STORY 1 — HARLOW
  // ============================================================================
  const HID = 'harlow_grocers', DCID = 'ind_hdc';
  const BOB = 'Bob Harlow', BOBROLE = 'CEO, Harlow Grocers', BOBFACE = FACE('bob');
  const PRICE = 60, LEASE = 4.8, LOAN = 24, RATE = 0.10, RECOVER = 0.25;

  const HT = () => GameState.tenants && GameState.tenants[HID];
  const alive = () => { const t = HT(); return !!t && t.status === 'active'; };
  const cover = () => { const t = HT(); return t && t.coverage != null ? t.coverage : 0; };
  function setCover(c) { const t = HT(); if (!t) return; t.coverage = fmt(c); t.base = fmt(c); t.trend = 0; }
  const allB = () => (GameState.portfolio || []).concat(GameState.cityRivals || [], GameState.propertyMarket || []);
  const dc = () => allB().find(p => p.id === DCID) || null;
  const dcMine = () => (GameState.portfolio || []).some(p => p.id === DCID);
  const harlowRent = () => fmt((GameState.portfolio || []).reduce((a, p) => a + (p.lease ? p.lease.positions
                               .filter(x => x.t === HID && !x.vacant).reduce((b, x) => b + p.annualNOI * x.share, 0) : 0), 0));
  const harlowShare = () => window.Tenants ? Tenants.shareOfMyRent(HID) : 0;
  const totalRent = () => (GameState.portfolio || []).reduce((a, p) => a + (p.annualNOI || 0), 0);
  const marketCap = () => Math.max(1, GameState.company.sharePrice * GameState.company.sharesOutstanding);
  const cyc = () => (GameState.market && GameState.market.cycle) || 'stable';

  /* The distribution centre exists in the city from day one, owned and used
     by Harlow, not for sale (a story building, outside the locked 40). */
  function ensure() {
    if (window.War) War.ensure();
    const M = window.PROPERTIES_MASTER, G = GameState;
    if (!M || !M.SPECIALS || !M.SPECIALS.harlow_dc || !window.Properties || !Properties.fromMaster || !G.cityRivals) return;
    if (dc()) return;
    const h = S().harlow; if (h && h.stage !== 'wait') return;           // already sold on, or gone
    const p = Properties.fromMaster(M.SPECIALS.harlow_dc, false);
    p.owner = 'none'; p.askingPrice = null; p.listedByOwner = false;
    p.ownerNote = 'Owned and used by Harlow Grocers. Not for sale.';
    p.storyLock = true;                                       // random events leave it alone while the story runs
    p.lease = { type: 'single', positions: [{ t: HID, share: 1, q: 60 }] }; p.occupancy = 1;
    G.cityRivals.push(p);
  }

  function H() {
    const s = S();
    if (!s.harlow) s.harlow = { stage: 'wait', pcGiven: 0 };
    return s.harlow;
  }
  /* Is a story deciding this tenant's fate right now? (tenants.js skips its
     random default roll.) */
  function protects(tid) {
    if (tid === 'atlas_cold_chain') return true;                  // round 16: Atlas never gets into trouble (port.js)
    if (tid !== HID) return false;
    const h = S().harlow; return !!h && (['owned', 'news', 'late', 'ask', 'loan', 'refused', 'decide'].indexOf(h.stage) > -1 || h.rescue === 'family' || (h.rescue === 'turnaround' && !(h.turn && h.turn.done && h.turn.fails)));   // round 35: our own chain only fails if the story says so
  }

  // -- the odds -----------------------------------------------------------------
  /* +5 points of "repay" for every 0.1x of rent cover above 1.55x; worse in a
     downturn. Centred so a player who lends lands near Alexander's split:
     repay ~30%, another year ~35%, cannot pay ~35% (tools/sim_harlow.js).
     Shown on the cards and in "On the clock". */
  const CENTRE = 1.55;
  function shift(c) { return clamp((c - CENTRE) * 50, -25, 25) + Math.round((window.Agents ? Agents.strength('harlow') : 0) * 40) - (cyc() === 'recession' ? 10 : cyc() === 'contracting' ? 5 : 0) - ((S().harlow && S().harlow.penalty) || 0); }
  /* Without the loan: Harlow's chance of going bust within 6 quarters. A
     grocer that the banks have dropped does not drift, it runs out of cash. */
  const refuseOdds = c => Math.round(clamp(70 - (c - 1.0) * 100, 25, 80));
  function maturityOdds(c) {
    const s = shift(c), repay = clamp(30 + s, 5, 70), cant = clamp(35 - s, 5, 70);
    return { repay: Math.round(repay), extend: Math.round(100 - repay - cant), cant: Math.round(cant) };
  }
  function finalOdds(c, from) {
    const s = shift(c), base = from === 'cant' ? [20, 30, 50] : [45, 25, 30];
    const repay = clamp(base[0] + s, 5, 85), bust = clamp(base[2] - s, 5, 85);
    return { repay: Math.round(repay), partial: Math.round(Math.max(0, 100 - repay - bust)), bust: Math.round(bust) };
  }
  /* Odds in words a person reads: "about 3 in 10". */
  const inTen = p => p >= 95 ? 'almost certainly' : p < 8 ? 'about 1 in ' + Math.max(12, Math.round(100 / Math.max(1, p))) : 'about ' + Math.round(p / 10) + ' in 10';
  const matWords = o => inTen(o.repay) + ' he repays in full, ' + inTen(o.extend) + ' he asks for another year, ' + inTen(o.cant) + ' he cannot pay';
  const finWords = o => inTen(o.repay) + ' he repays in full, ' + inTen(o.partial) + ' he repays most of it (60%), ' + inTen(o.bust) + ' he goes bust';
  const likely = (o, names) => { const k = Object.keys(names).sort((a, b) => o[b] - o[a])[0]; return names[k]; };
  const refiOdds = c => Math.round(clamp((c - 0.9) / 0.8, 0.1, 0.9) * 100);
  /* Chance Harlow fails within a year on its own, cover sliding `drift` a quarter. */
  function failOdds(c, drift) {
    let ok = 1; for (let q = 0; q < 4; q++) { c += drift; ok *= 1 - (window.Tenants ? Tenants.K.defaultHazard(c) : 0.05); }
    return Math.round((1 - ok) * 100);
  }
  function roll(odds, keys) { let r = rnd() * 100; for (const k of keys) { r -= odds[k]; if (r < 0) return k; } return keys[keys.length - 1]; }

  /* What a Harlow bankruptcy would cost you, today. */
  function bustCost() {
    const h = H(), L = h.loan, p = dc();
    const owed = L ? L.amt : 0, back = fmt(owed * RECOVER), w = fmt(Math.max(0, owed - back - (L ? L.prov : 0)));
    const dcLoss = p && dcMine() ? fmt(p.currentValue * 0.35) : 0;
    const loss = fmt(owed - back + dcLoss);
    return { owed, back, writeoff: w, dcLoss, rent: harlowRent(), drop: Math.round(clamp(0.6 * loss / marketCap(), 0, 0.2) * 100) };   // round 35: at most -20% on the day (was 30%)
  }

  // -- the quarter ----------------------------------------------------------------
  function harlowQuarter(out) {
    ensure();
    const s = S(), h = H(), now = tq(), t = HT();
    try { rescueQuarter(out, now); } catch (e) { if (window.console) console.warn('rescue', e); }   // round 35
    const pdc = dc(); if (pdc) pdc.storyLock = h.stage !== 'done';   // random events leave it alone while the story runs
    if (!t || h.stage === 'done') return;
    // the story's hand on Harlow's health: a slow slide while overexpanded
    if (h.drift && alive()) t.base = clamp(fmt((t.base || t.coverage) + h.drift), 0.3, 5);

    switch (h.stage) {
      case 'wait':                                            // Act 0 happens at the board meeting now (agenda())
        if (now > 17) h.stage = 'done';                      // never raised (meetings skipped): let it go
        return;

      case 'owned':                                           // bought: healthy, or the slide begins
        if (now < h.at) return;
        if (!h.over) {
          sayDir('hassan', 'Operations', 'Harlow: two good years',
              'Harlow Grocers paid every quarter on time and opened two stores. Rent cover ' + cover().toFixed(2) + 'x. The distribution centre is running three shifts.<br><i>I told you. Super deal.</i>', FACE('hassan'));
          bond('hassan', 0.5, 'his Harlow deal worked'); repOf('hassan', 15, 'Harlow, his deal, worked'); rewardCEO('the Harlow sale and leaseback', 0.25); h.stage = 'done'; h.result = 'healthy'; return;
        }
        h.stage = 'news'; h.at = h.dealQ + rint(5, 8);
        say('Jenkins', 'Chief of Staff', 'Harlow is growing fast. Maybe too fast',
            'The Ledger reports Harlow Grocers opened 9 stores in 12 months, paid for with the $60M from our deal and new debt. Sales at its older stores are down 4%. Its rent cover is ' + cover().toFixed(2) + 'x (it was 1.80x when we bought).<br>' +
            '<b>Hassan:</b> "Growing pains. Bob knows grocery."', FACE('jenkins'));
        return;

      case 'news':                                            // Act 1: late rent, in the second year
        if (now < h.at) return;
        setCover(1.2 + rnd() * 0.1); t.trend = -1;
        h.stage = 'late'; h.at = now + 1; repOf('hassan', -5, 'Harlow paid late');
        say(dname('okafor'), 'Balance sheet', 'Harlow paid rent 23 days late',
            'Harlow Grocers paid this quarter’s rent 23 days late. Rent cover is down to <b>' + cover().toFixed(2) + 'x</b>. Harlow is <b>' + pc(harlowShare()) + '</b> of our rent (' + money(harlowRent()) + ' a year).<br>' +
            '<b>Hassan:</b> "One late payment from a 70-year-old business. Relax."<br><i>Bob Harlow has asked for a meeting.</i>', FACE('okafor'));
        return;

      case 'late':                                            // Act 2: Bob asks the board, at the next meeting (agenda())
        if (!alive() || harlowShare() < 8) { h.stage = 'done'; h.result = 'fizzled'; }
        return;

      case 'loan': loanQuarter(out, now); return;

      case 'refused': {                                       // on its own
        if (!alive()) { h.stage = 'done'; return; }
        if (h.refuseBustQ && now >= h.refuseBustQ) { bust(out, 'ran out of cash without our loan', true); return; }
        if (now >= h.at) {
          h.drift = 0; h.stage = 'done'; h.result = 'survived';
          say(BOB, BOBROLE, 'We made it. No thanks to you',
              'Harlow found the money from a private lender at 15%. We are still here, rent cover ' + cover().toFixed(2) + 'x. I won’t forget who helped and who didn’t.', BOBFACE);
        }
        return;
      }

      case 'aftermath':                                       // bankrupt: the pinned card waits for its turn
        if (!dcMine() && !(h.bust && h.bust.owed > 0)) { h.stage = 'done'; h.result = 'bust_lost'; return; }   // sold (or forced to sell) meanwhile
        if (!s.due || lowDue()) s.due = 'story_harlow_after';
        return;
      case 'reletAsk': if (!dcMine()) { h.stage = 'done'; h.result = 'bust_lost'; } return;
      case 'relet':                                           // the Asset Manager is looking
        if (!dcMine()) { h.stage = 'done'; h.result = 'bust_lost'; return; }
        if (now >= h.at && (!s.due || lowDue())) { h.offer = h.offer || newOffer(); s.due = 'story_harlow_relet'; h.stage = 'reletAsk'; }
        return;
      case 'ramp': {                                          // the new tenant's rent steps up
        const p = dc(); if (!p || !dcMine()) { h.stage = 'done'; return; }
        const k = now - h.ramp.start, f = k < h.ramp.free ? 0 : Math.min(1, (k - h.ramp.free + 1) * (h.ramp.step || 0.25));
        p.rentFactor = f;                                     // the lease is signed at full rent; what is collected steps up
        if (f >= 1) { p.rentFactor = null; h.stage = 'done'; h.result = h.rescue ? h.rescue : (h.result || 'bust') + '_relet';
          out.push({ good: true, text: h.ramp.name + ' now pays full rent at the Harlow centre: ' + money(h.ramp.full) + ' a year.' }); }
        return;
      }
      case 'passedWatch':                                     // you passed; Wexmoor owns it
        if (now < h.at) return;
        h.stage = 'done';
        if (h.over && alive() && rnd() < 0.45) {
          const line = Tenants.forceDefault(HID); h.result = 'passed_bust'; repOf('hassan', -10, 'his Harlow deal blew up on Wexmoor');
          bond('hassan', -0.5, 'his Harlow deal blew up on Wexmoor');
          say('Jenkins', 'Chief of Staff', 'Harlow Grocers has filed for bankruptcy',
              'Harlow Grocers filed for bankruptcy this morning. Wexmoor owns the distribution centre you passed on, and it is now empty. ' + (line ? line.text : '') +
              '<br><b>Hassan</b> has not mentioned Harlow since.', FACE('jenkins'));
          if (line) out.push(line);
        } else h.result = 'passed_ok';
        return;
    }
  }

  function loanQuarter(out, now) {
    const s = S(), h = H(), L = h.loan; if (!L) { h.stage = 'done'; return; }
    if (!alive()) { bust(out, 'collapsed', true); return; }
    const due = fmt(L.amt * L.rate / 4);
    if (cover() >= 1.0) {
      GameState.pnl.loanInterest = fmt((GameState.pnl.loanInterest || 0) + due);
      L.paid = fmt((L.paid || 0) + due); L.streak = 0;
    } else {
      L.accrued = fmt((L.accrued || 0) + due); L.streak = (L.streak || 0) + 1; L.missed = (L.missed || 0) + 1;
      out.push({ good: false, text: 'Harlow missed its ' + money(due) + ' loan interest (rent cover ' + cover().toFixed(2) + 'x). Unpaid so far: ' + money(L.accrued) + '.' });
      if (L.streak >= 3 && !L.prov) {
        const p = fmt(L.amt * 0.2); L.prov = p; writeOff(p, true);
        say(dname('okafor'), 'Balance sheet', 'The auditors want a provision on Harlow',
            'Three missed quarters in a row. The auditors require a <b>' + money(p) + '</b> provision (20% of the loan): a loss this quarter, no cash moves.', FACE('okafor'));
        out.push({ good: false, text: 'Auditors forced a ' + money(p) + ' provision on the Harlow loan.' });
      }
      if (!s.due && (!h.missAsked || (L.streak >= 3 && !h.missAsked2))) {
        if (h.missAsked) h.missAsked2 = true; h.missAsked = true;
        repOf('hassan', -5, 'Harlow missed a payment');
        h.stage = 'decide'; s.due = 'story_harlow_miss'; return;
      }
    }
    // the press finds out where the money went (once; 50% a quarter once Harlow is in trouble)
    if (!h.pressDone && (L.missed > 0 || L.ext) && !s.due && rnd() < 0.5) { h.pressDone = true; h.stage = 'decide'; s.due = 'story_harlow_press'; return; }
    if (!L.dueYear && now >= L.due && !s.due) maturity(out);   // loans made at a meeting fall due at a meeting (agenda())
  }

  /* Act 4 / Act 5: the loan falls due. */
  function maturity(out) {
    const s = S(), h = H(), L = h.loan, c = cover();
    if (!L.ext) {
      const r = roll(maturityOdds(c), ['repay', 'extend', 'cant']);
      if (r === 'repay') { repaid(out); return; }
      h.stage = 'decide'; s.due = r === 'extend' ? 'story_harlow_extend' : 'story_harlow_default';
      if (r === 'extend' && L.accrued) { GameState.pnl.loanInterest = fmt((GameState.pnl.loanInterest || 0) + L.accrued); L.paid = fmt((L.paid || 0) + L.accrued); L.accrued = 0; }
      return;
    }
    const r = roll(finalOdds(c, L.from), ['repay', 'partial', 'bust']);
    if (r === 'repay') repaid(out);
    else if (r === 'partial') partial(out);
    else bust(out, 'could not pay after the extra year', true);
  }

  function endLoan() { const h = H(); h.loan = null; h.drift = 0; }
  function repaid(out, later) {
    const h = H(), L = h.loan, G = GameState, pl = later ? pnlLater : pnlNow;
    cash(L.amt);                                              // principal back (balance sheet only)
    if (L.accrued) pl(L.accrued);                             // the unpaid interest, finally paid
    if (L.prov) { pl(L.prov); cash(-L.prov); }                 // provision released: a gain, no cash
    const t = HT(); if (t) { t.trend = 1; t.base = fmt((t.base || t.coverage) + 0.2); }
    G.company.sharePrice = fmt(G.company.sharePrice * 1.02);
    attitude('okafor', 1, 'Harlow repaid'); attitude('petrova', 1, 'Harlow repaid'); attitude('hassan', 1.5, 'Bob repaid, as he promised');
    bond('hassan', 1, 'you stood by Bob, and Bob paid'); repOf('hassan', 20, 'Bob repaid, as he promised');
    rewardCEO('the Harlow loan, repaid in full', 0.5);
    say(BOB, BOBROLE, 'Paid in full',
        'Harlow has repaid the ' + money(L.amt) + ' in full' + (L.accrued ? ', with the ' + money(L.accrued) + ' of interest we owed you' : '') + '. In total you earned ' + money((L.paid || 0) + (L.accrued || 0)) + ' of interest. Rent cover is back to ' + cover().toFixed(2) + 'x.<br><i>You took a chance on us when the banks wouldn’t. Riverton remembers that.</i>', BOBFACE);
    out.push({ good: true, text: 'Harlow repaid its ' + money(L.amt) + ' loan in full. Share price +2%.' });
    endLoan(); h.stage = 'done'; h.result = 'repaid';
  }
  function partial(out, later) {
    const h = H(), L = h.loan, back = fmt(L.amt * 0.6), loss = fmt(L.amt - back - (L.prov || 0));
    cash(back); writeOff(loss, !later);
    attitude('okafor', -0.5, 'Harlow paid back only 60%'); attitude('hassan', 0.5, 'Bob paid back what he could'); repOf('hassan', -5, 'Harlow repaid only 60%');
    say(BOB, BOBROLE, 'Most of it',
        'We sold six stores. Harlow repays <b>' + money(back) + '</b> of the ' + money(L.amt) + '. The rest we cannot pay: a write-off of <b>' + money(Math.max(0, loss)) + '</b>' + (L.prov ? ' (after the ' + money(L.prov) + ' already provided)' : '') + '. We are smaller, but we are still your tenant.', BOBFACE);
    out.push({ good: false, text: 'Harlow repaid 60% of its loan (' + money(back) + '). Write-off ' + money(Math.max(0, loss)) + '.' });
    const t = HT(); if (t) { t.trend = 0; }
    endLoan(); h.stage = 'done'; h.result = 'partial';
  }
  /* Harlow goes bankrupt: the loan, the rent and the building, together. */
  function bust(out, why, now) {
    const h = H(), G = GameState, c = bustCost(), L = h.loan;
    h.stage = 'done'; h.result = 'bust';                     // stops protecting Harlow first
    if (L) { cash(c.back); writeOff(c.writeoff, now); }
    endLoan();
    const p = dc();
    if (p && dcMine()) h.oldRent = p.annualNOI;               // the empty centre's value falls on its own (properties.js: vacant = 65%)
    const line = Tenants.forceDefault(HID);
    if (p && dcMine() && p.lease && p.lease.positions[0]) p.lease.positions[0].relet = 999;   // the story finds the next tenant
    h.bust = { why, owed: c.owed, back: c.back, writeoff: c.writeoff, rent: c.rent, dcLoss: c.dcLoss, drop: c.drop, q: tq() };
    // round 35: the rescue card comes whenever we were in deep (the centre, or the loan)
    if ((p && dcMine()) || c.owed > 0) { h.stage = 'aftermath'; if (!S().due || /^story_harlow/.test(S().due) || lowDue()) S().due = 'story_harlow_after'; }
    G.company.sharePrice = fmt(G.company.sharePrice * (1 - c.drop / 100));
    attitude('petrova', -1.5, 'Harlow went bust'); attitude('chen', -1, 'Harlow went bust');
    if (h.lent) attitude('okafor', -1, 'you lent to Harlow against his advice');
    h.hassanDiscredited = !!(h.bought || h.lent);              // for the board story: Hassan pushed Bob
    if (h.bought) repOf('hassan', -25, 'Harlow, his deal, went bust');
    if (!(p && dcMine()) && !(c.owed > 0))
      say(dname('okafor'), 'Balance sheet', 'Harlow Grocers is bankrupt',
          'Harlow ' + why + ' and filed for bankruptcy.' + nums([['Loan', L ? money(c.owed) + ' lent, ' + money(c.back) + ' recovered' : 'none'], ['Rent lost', money(c.rent) + ' a year'], ['Share price', '−' + c.drop + '%']]), FACE('okafor'));
    if (h.hassanDiscredited)
      sayDir('hassan', 'Operations', 'About Bob',
          'I backed Bob from the first day. I called it a super deal. I was wrong, and the board knows it.', FACE('hassan'));
    if (line) out.push(line);
    out.push({ good: false, text: 'Harlow Grocers is bankrupt. ' + (L ? 'Loan write-off ' + money(c.writeoff) + '. ' : '') + 'Share price −' + c.drop + '%.' });
  }

  // -- the cards --------------------------------------------------------------------
  const CARDS = [
    /* ---------------- Act 0: the sale and leaseback ---------------- */
    {
      id: 'story_harlow_offer', system: true, story: true, holdQ: 2, lapse: 1,
      build() {
        const h = H(), p = dc(); if (!p || h.stage !== 'offer') return null;
        const cost = fmt(PRICE + fee(PRICE)), val = fmt(p.currentValue), rent = harlowRent();
        const share = Math.round((rent + LEASE) / (totalRent() + LEASE) * 100);
        const line = Math.max(0, fmt(cost - Math.max(0, GameState.balance.cash)));
        const avgYield = totalRent() / Math.max(1, (GameState.portfolio || []).reduce((a, x) => a + x.currentValue, 0)) * 100;
        return {
          title: 'Bob Harlow offers you his distribution centre', from: BOB + ', ' + BOBROLE, face: BOBFACE,
          body: '"Every Harlow store is fed from one building. I want my capital in stores, not in a warehouse. Buy it, we lease it back for 15 years. You get a grocer for a tenant. Grocers don’t go anywhere."' +
                nums([['Price', money(PRICE) + ' + ' + money(fee(PRICE)) + ' fees'],
                      ['Worth at today’s market yields', 'about ' + money(val)],
                      ['Rent from Harlow', money(LEASE) + ' a year, +2% a year, 15 years'],
                      ['Yield on the price', '8.0% (your buildings: ' + avgYield.toFixed(1) + '%)'],
                      ['Harlow’s rent cover', '1.80x'],
                      ['Harlow after the deal', share + '% of your rent'],
                      ['Paying for it', line > 0 ? 'your cash plus ' + money(line) + ' from the credit line' : 'from cash']]) +
                voices([voice('hassan', '"100% occupied, 15-year lease, 8% yield on cost. This is a super deal."'),
                        voice('okafor', '"' + share + '% of our rent from one grocer. If Harlow sneezes, we catch a cold."')]),
          choices: [
            { label: 'Buy it for ' + money(PRICE),
              detail: '+' + money(LEASE) + ' rent a year and about +' + money(val - PRICE) + ' of NAV on day one. Harlow becomes ' + share + '% of your rent. Hassan +1 and warmer toward you, Chen +0.5, Okafor −0.5.',
              check: () => spend() >= cost, checkMsg: 'Need ' + money(cost) + ' (cash plus credit line)',
              apply() {
                const G = GameState, s = S();
                G.cityRivals = (G.cityRivals || []).filter(x => x !== p); p.ownerNote = null;
                const msg = World.buyAt(p, PRICE);
                if (!(G.portfolio || []).includes(p)) { G.cityRivals.push(p); return 'The purchase did not go through: ' + msg; }
                p.purchasePrice = PRICE; p.baseValue = p.currentValue; p.vb = null;
                setCover(1.8);
                h.bought = true; h.dealQ = tq(); h.over = rnd() < 0.7; h.drift = h.over ? -0.03 : 0;
                h.stage = 'owned'; h.at = tq() + rint(3, 5); s.due = null;
                attitude('hassan', 1, 'you took his Harlow deal'); attitude('chen', 0.5, 'you bought the Harlow centre'); attitude('okafor', -0.5, 'Harlow is a big share of our rent now');
                bond('hassan', 0.5, 'you took his Harlow deal');
                return 'You own the Harlow Distribution Centre. Bob shook your hand for a long time.';
              } },
            { label: 'Pass',
              detail: 'Wexmoor will buy it. Nothing changes for you, today. Hassan −1.',
              apply() {
                const s = S();
                if (window.World && World.toRival) { p.ownerNote = null; World.toRival(p, 'wex', PRICE); }
                h.stage = 'passedWatch'; h.over = rnd() < 0.7; h.at = tq() + rint(10, 14); s.due = null;
                attitude('hassan', -1, 'you passed on the Harlow deal'); bond('hassan', -0.5, 'you passed on his Harlow deal');
                return 'Wexmoor bought the Harlow centre for ' + money(PRICE) + '. Hassan read about it in the Ledger.';
              } },
          ]
        };
      }
    },

    /* ---------------- Act 2: the loan ---------------- */
    {
      id: 'story_harlow_loan', system: true, story: true, holdQ: 1, lapse: 1,
      build() {
        const h = H(); if (h.stage !== 'ask') return null;
        const c = cover(), b = bustCostIf(LOAN), f0 = refuseOdds(c), mo = maturityOdds(c + 0.4);
        return {
          title: 'Bob Harlow asks for a loan', from: BOB + ', ' + BOBROLE, face: BOBFACE,
          body: '"We opened too fast, I admit it. The new stores need a year to mature, and the banks have gone cold on grocers. Lend us ' + money(LOAN) + ' for two years and we come out the other side. Your rent stays safe."' +
                nums([['Harlow’s rent cover', c.toFixed(2) + 'x (1.80x when you bought)'],
                      ['Harlow pays you', money(harlowRent()) + ' a year, ' + pc(harlowShare()) + ' of your rent'],
                      ['The loan', money(LOAN) + ', 2 years, 10%: ' + money(LOAN * RATE) + ' interest a year'],
                      ['Security', 'store inventory: about 25% back if Harlow fails'],
                      ['If you refuse', 'about ' + f0 + '% chance Harlow goes bust within 18 months'],
                      ['If Harlow fails', 'lose ' + money(harlowRent()) + ' rent a year; the centre loses ~30% of its value; share price about −' + b.drop + '%'],
                      ['With this loan', 'Harlow is ' + pc(harlowShare()) + ' of your rent and ' + money(LOAN) + ' of loans: if Harlow fails in a downturn, about ' + Math.min(100, Math.round((harlowRent() + LOAN * RATE) / Math.max(0.5, (GameState.history || []).slice(-4).reduce((a, e) => a + (e.affoPerShare || 0), 0) * GameState.company.sharesOutstanding) * 100)) + '% of your cash profit goes with it']]) +
                voices([voice('hassan', '"Bob is a superb manager. He will sort it out. We keep a good tenant."'),
                        voice('okafor', '"We lend a tenant money so it can pay us rent. I have seen this film."')]),
          choices: [
            { label: 'Lend ' + money(LOAN),
              detail: '+' + money(LOAN * RATE) + ' interest a year while he pays. His rent cover rises to about ' + (c + 0.4).toFixed(2) + 'x. When it falls due in 2 years, as things stand: ' + matWords(mo) + '. Share price −2% (the market dislikes it). Hassan +1, Okafor −0.5, Petrova −0.5.',
              check: () => spend() >= LOAN, checkMsg: 'Need ' + money(LOAN) + ' (cash plus credit line)',
              apply() {
                const G = GameState;
                cash(-LOAN); h.lent = true;
                // round 11: the loan falls due at the annual meeting two years on (agenda())
                h.loan = { amt: LOAN, rate: RATE, prov: 0, accrued: 0, paid: 0, streak: 0, missed: 0, due: 9999, dueYear: (G.meta.year - 1) + 2, ext: 0 };
                setCover(cover() + 0.4); h.helps = rnd() < 0.6; h.drift = h.helps ? 0 : -0.06;
                G.company.sharePrice = fmt(G.company.sharePrice * 0.98);
                attitude('hassan', 1, 'you backed Bob'); attitude('okafor', -0.5, 'you lent to Harlow'); attitude('petrova', -0.5, 'the market dislikes the Harlow loan');
                bond('hassan', 1, 'you backed Bob when it mattered'); repOf('hassan', -5, 'the board lent to Harlow on his word');
                h.stage = 'loan';
                return 'Lent ' + money(LOAN) + ' to Harlow Grocers at 10% for two years.';
              } },
            { label: 'Refuse',
              detail: 'No money at risk except the rent. About ' + f0 + '% chance Harlow goes bust within 18 months (you lose ' + money(harlowRent()) + ' rent a year, the centre ~30% of its value, share price about −' + bustCostIf(0).drop + '%). Hassan −1.5 and cold toward you. Okafor +0.5.',
              apply() {
                h.stage = 'refused'; h.at = tq() + 6; h.drift = -0.05;
                h.refuseBustQ = rnd() * 100 < f0 ? tq() + rint(2, 6) : null;      // decided now, revealed later
                attitude('hassan', -1.5, 'you turned Bob away'); attitude('okafor', 0.5, 'you refused the Harlow loan');
                bond('hassan', -1.5, 'you turned Bob away');
                return 'Bob thanked you for your time. Hassan did not.';
              } },
          ]
        };
      }
    },

    /* ---------------- Act 3: the missed payment ---------------- */
    {
      id: 'story_harlow_miss', system: true, story: true,
      build() {
        const h = H(), L = h.loan; if (!L || h.stage !== 'decide') return null;
        const b = bustCost(), give = h.pcGiven < 2, mo = maturityOdds(cover());
        return {
          title: 'Harlow missed a payment', from: BOB + ', ' + BOBROLE, face: BOBFACE,
          body: '"A bad quarter, the new stores are slow. Let me skip the interest for now, I will make it up. And look: I chair the Riverton Business Council. I can open doors for you."' +
                nums([['Missed so far', L.missed + ' quarter' + (L.missed > 1 ? 's' : '') + ', ' + money(L.accrued) + ' unpaid'],
                      ['Harlow’s rent cover', cover().toFixed(2) + 'x'],
                      ['Loan', money(L.amt) + (L.prov ? ', ' + money(L.prov) + ' already provided' : '') + ', due in ' + Math.max(0, L.due - tq()) + ' quarters'],
                      ['When it falls due, as things stand', matWords(mo)]]) +
                voices([voice('okafor', '"Evict them. Call the loan, take the building back, re-let it."'),
                        voice('hassan', '"You don’t kill your best tenant over a bad quarter. Give Bob time."')]),
          choices: [
            { label: 'Okafor’s way: call the loan, evict Harlow',
              detail: 'Recover ' + money(b.back) + ', write off ' + money(b.writeoff) + '. Lose ' + money(b.rent) + ' rent a year; the centre loses about ' + money(b.dcLoss) + ' of value and re-lets at 70% of the rent in 4 to 8 quarters. Share price about −' + b.drop + '%. Okafor +1, Hassan −2 and an enemy.',
              apply() {
                const out = []; h.stage = 'loan';
                attitude('okafor', 1, 'you took his advice on Harlow'); attitude('hassan', -2, 'you evicted Bob'); bond('hassan', -2, 'you evicted Bob');
                h.lent = false;                                   // Okafor's way: the board does not blame him
                bust(out, 'was evicted when we called the loan', false);
                return 'You called the loan. Harlow is bankrupt. ' + (out[out.length - 1] || {}).text;
              } },
            { label: 'Bob’s way: let him miss the payments',
              detail: 'Unpaid interest piles up (' + money(L.amt * L.rate / 4) + ' a quarter, not counted as income). ' + (give ? '+1 political capital from Bob’s connections. ' : 'No more favours from Bob. ') + 'Hassan +1 and warmer, Okafor −1. After 3 missed quarters in a row the auditors force a 20% provision (' + money(L.amt * 0.2) + ' loss).',
              apply() {
                h.stage = 'loan';
                if (give) { const b2 = GameState.board; b2.politicalCapital = Math.min(b2.maxCapital || 5, (b2.politicalCapital || 0) + 1); h.pcGiven += 1; }
                attitude('hassan', 1, 'you gave Bob time'); attitude('okafor', -1, 'you ignored the missed Harlow payments'); bond('hassan', 1, 'you gave Bob time');
                return 'Bob: "You won’t regret it." ' + (give ? 'The zoning board returned your calls the same week (+1 political capital).' : '');
              } },
          ]
        };
      }
    },

    /* ---------------- Act 4a: he asks for another year ---------------- */
    {
      id: 'story_harlow_extend', system: true, story: true,
      build() {
        const h = H(), L = h.loan; if (!L || h.stage !== 'decide') return null;
        const c = cover(), fo = finalOdds(c, 'extend'), fo2 = finalOdds(c - 0.1, 'extend'), ro = refiOdds(c), b = bustCost();
        const done = () => { h.stage = 'loan'; L.ext = 1; L.from = 'extend'; if (L.dueYear) L.dueYear += 1; else L.due = tq() + 4; };
        return {
          title: 'Bob asks for one more year', from: BOB + ', ' + BOBROLE, face: BOBFACE,
          body: '"Every cent of interest is paid. We are not out of the woods, and refinancing ' + money(L.amt) + ' in this market would eat us alive. One more year and I repay you in full."' +
                nums([['Interest received so far', money(L.paid || 0)], ['Harlow’s rent cover', c.toFixed(2) + 'x'], ['Loan', money(L.amt)]]) +
                voices([voice('hassan', '"He has paid every cent. Give him the year."')]),
          choices: [
            { label: 'Extend one year at 10%',
              detail: 'In a year: ' + finWords(fo) + '. Hassan +0.5.',
              apply() { done(); attitude('hassan', 0.5, 'you gave Bob another year'); bond('hassan', 0.5, 'you gave Bob another year'); return 'Extended a year at 10%.'; } },
            { label: 'Extend one year at 12%',
              detail: '+' + money(L.amt * 0.02) + ' a year more interest, but it squeezes him (cover −0.10x). In a year: ' + finWords(fo2) + '.',
              apply() { done(); L.rate = 0.12; setCover(cover() - 0.1); return 'Extended a year at 12%. Bob signed without reading it.'; } },
            { label: 'Refuse: he must refinance elsewhere',
              detail: 'About ' + ro + '% he finds the money and repays you now. Otherwise Harlow goes bankrupt: write-off ' + money(b.writeoff) + ', share price about −' + b.drop + '%. Hassan −1.',
              apply() {
                attitude('hassan', -1, 'you refused Bob another year'); bond('hassan', -0.5, 'you refused Bob another year');
                const out = [];
                if (rnd() * 100 < ro) { h.stage = 'loan'; repaidLater(out); return 'Bob refinanced with a private credit fund at 14% and repaid you in full.'; }
                h.stage = 'loan'; bust(out, 'could not refinance', false); return 'Nobody would lend to Harlow. It filed for bankruptcy.';
              } },
          ]
        };
      }
    },

    /* ---------------- Act 4b: he cannot pay ---------------- */
    {
      id: 'story_harlow_default', system: true, story: true,
      build() {
        const h = H(), L = h.loan; if (!L || h.stage !== 'decide') return null;
        const c = cover(), fo = finalOdds(c, 'cant'), b = bustCost(), give = h.pcGiven < 2;
        const prov30 = fmt(Math.max(0, L.amt * 0.3 - (L.prov || 0)));
        return {
          title: 'Harlow cannot repay', from: BOB + ', ' + BOBROLE, face: BOBFACE,
          body: '"I don’t have it. Not today. Write me off now and you book the loss, your share price drops, and an empty warehouse sits on your books. Give me one year. I am this close."' +
                nums([['Owed', money(L.amt) + (L.accrued ? ' + ' + money(L.accrued) + ' unpaid interest' : '')], ['Harlow’s rent cover', c.toFixed(2) + 'x'],
                      ['Already provided', money(L.prov || 0)]]) +
                voices([voice('okafor', '"Write it off now. Every quarter we wait, the hole gets deeper."'),
                        voice('hassan', '"Bob has kept this city fed for seventy years. One more year."')]),
          choices: [
            { label: 'Okafor’s way: write it off now',
              detail: 'Harlow goes bankrupt now. We get ' + money(b.back) + ' back from their inventory and write off the other ' + money(b.writeoff) + '. We lose their ' + money(b.rent) + ' a year of rent, and the empty centre is worth about ' + money(b.dcLoss) + ' less. Share price about −' + b.drop + '%. Okafor +1, Hassan −1.5.',
              apply() {
                attitude('okafor', 1, 'you wrote off Harlow'); attitude('hassan', -1.5, 'you wrote Bob off'); bond('hassan', -1, 'you wrote Bob off');
                const out = []; h.stage = 'loan'; bust(out, 'could not repay', false); return 'Written off. Harlow filed for bankruptcy the same week.';
              } },
            { label: 'Bob’s way: one more year',
              detail: 'Nothing is written off: Bob keeps paying rent and his loan stays on our books one more year. The auditors make us set aside ' + money(prov30) + ' against it: a loss on paper this quarter, no cash moves. In a year: ' + finWords(fo) + '. ' + (give ? '+1 political capital (his connections). ' : '') + 'Hassan +1.',
              apply() {
                if (prov30 > 0) { L.prov = fmt((L.prov || 0) + prov30); writeOff(prov30, false); }
                if (give) { const b2 = GameState.board; b2.politicalCapital = Math.min(b2.maxCapital || 5, (b2.politicalCapital || 0) + 1); h.pcGiven += 1; }
                attitude('hassan', 1, 'you gave Bob one more year'); bond('hassan', 1, 'you gave Bob one more year');
                h.stage = 'loan'; L.ext = 1; L.from = 'cant'; if (L.dueYear) L.dueYear += 1; else L.due = tq() + 4;
                return 'One more year. Provision ' + money(prov30) + '.';
              } },
          ]
        };
      }
    },
  ];
  /* ---------------- the exposé: where Bob's loan went ---------------- */
  CARDS.push({
    id: 'story_harlow_press', system: true, story: true,
    build() {
      const h = H(), L = h.loan; if (!L || h.stage !== 'decide') return null;
      const pc0 = (GameState.board && GameState.board.politicalCapital) || 0, mo = maturityOdds(cover()), r0 = window.Directors ? Directors.rep('hassan') : 0;
      const hit = () => { const G = GameState; G.company.sharePrice = fmt(G.company.sharePrice * 0.97); h.penalty = 5; h.stage = 'loan'; };
      return {
        title: 'The Ledger: Bob Harlow\u2019s jet and yacht', from: JOURNO + ', ' + PAPER, face: FACE('journalist'),
        body: 'Front page of the business section: in the same quarter Harlow borrowed our ' + money(L.amt) + ', Bob Harlow leased a private jet and took delivery of a 120-foot yacht, the <i>Harlow Gold</i>. The article calls our loan "the most generous landlord in Riverton" and names Hassan as the director who championed Harlow.' +
              nums([['Share price', '\u22123% (whatever you do)'], ['Harlow\u2019s odds at maturity', 'repay ' + mo.repay + '% \u2192 ' + Math.max(5, mo.repay - 5) + '% (lenders and suppliers lose faith in Bob)'],
                    ['Hassan\u2019s reputation', r0 + ' / 100 (below 30 at the annual meeting and he is out)']]) +
              voices([voice('hassan', '"The man is entitled to a boat. The stores are what matter."'), voice('petrova', '"Our shareholders are reading this over breakfast."')]),
        choices: [
          { label: 'Defend Hassan in public (1 political capital)',
            detail: 'Hassan\u2019s reputation \u221210 instead of \u221220, and he warms to you (+1). Petrova \u22121: you tied us to Bob in public. You have ' + pc0 + '.',
            costType: 'capital', cost: 1,
            apply() { hit(); GameState.board.politicalCapital = Math.max(0, pc0 - 1); repOf('hassan', -10, 'the jet and yacht story (you defended him)'); bond('hassan', 1, 'you defended him over the yacht story');
                      attitude('petrova', -1, 'you defended the Harlow loan in public'); return 'Your statement ran on page 2: "Our directors acted in good faith." Hassan called to thank you.'; } },
          { label: 'Say nothing',
            detail: 'Hassan\u2019s reputation \u221220.',
            apply() { hit(); repOf('hassan', -20, 'the jet and yacht story'); return 'No comment. The story ran for three days.'; } },
          { label: 'Force Bob to sell the yacht',
            detail: '$4.0M of the loan repaid now (' + money(L.amt) + ' \u2192 ' + money(L.amt - 4) + '). Bob\u2019s rent cover \u22120.10x and he turns cold: no more political capital from him. Hassan\u2019s reputation \u221210.',
            apply() { hit(); L.amt = fmt(L.amt - 4); cash(4); setCover(cover() - 0.1); h.pcGiven = 2; h.yachtSold = true;   // round 36: the endings remember repOf('hassan', -10, 'the jet and yacht story (yacht sold)');
                      return 'The Harlow Gold was sold at a loss. $4.0M came back to us. Bob has stopped returning calls.'; } },
        ]
      };
    }
  });

  // ============================================================================
  // STORY 2 — THE BOARD CHANGES (round 8): Grace's ESG initiatives, Tex
  // ============================================================================
  /* ESG score, 0 to 100. Only Grace raises it, by talking you into initiatives
     that cost money. At 60, ESG funds buy your shares: the price bracket
     shifts up 5% (financials.js fairPrice). Recurring initiatives hold their
     points while you pay; one-offs fade 5 points a year. Cancelling one is
     Grace's red line. */
  const ESG_LINE = 60, ESG_PREMIUM = 1.05;
  const INITIATIVES = [
    { id: 'beehives', name: 'Rooftop beehives on every building', rec: 0.40, pts: 12, done: 'The bees are thriving. Two tenants have complained about the bees.' },
    { id: 'report',   name: 'A 400-page sustainability report',   rec: 0.25, pts: 10, done: 'The report won an award. Nobody on the board has read it.' },
    { id: 'chargers', name: 'EV chargers at every building',       one: 1.80, pts: 15, done: 'Chargers installed. Three cars used them last quarter.' },
    { id: 'wellbeing',name: 'A Chief Wellbeing Officer',           rec: 0.35, pts: 8,  done: 'She has introduced standing desks and a gong.' },
    { id: 'offsets',  name: 'Carbon offsets for the whole portfolio', rec: 0.60, pts: 15, done: 'The offsets are a forest in another country. Nobody has seen it.' },
    { id: 'greenroof',name: 'A green roof on our biggest building', one: 1.20, pts: 12, done: 'The roof is green. The roof also leaks.' },
    { id: 'pledge',   name: 'A net zero by 2050 pledge',           one: 0, pts: 6,  done: 'Pledged. It costs nothing until 2050, when it will be someone else\u2019s problem.' },
  ];
  function E() { const s = S(); if (!s.esg) s.esg = { base: 20, items: [], refusedQ: -99, cancelledQ: -99, nextQ: null, offer: null, seen: {} }; return s.esg; }
  function esgScore() {
    const e = E(), now = tq();
    const pts = e.items.reduce((a, i) => a + (i.rec != null ? i.pts : Math.max(0, i.pts - 5 * Math.floor((now - i.q) / 4))), 0);
    return Math.round(clamp(e.base + pts, 0, 100));
  }
  const esgPremium = () => esgScore() >= ESG_LINE ? ESG_PREMIUM : 1;
  const esgNewThisYear = () => { const y = GameState.meta.quarter === 1 ? GameState.meta.year - 1 : GameState.meta.year; return E().items.filter(i => i.y === y).length; };
  const esgRefusedRecently = () => tq() - E().refusedQ < 4;
  const esgCancelledRecently = () => tq() - E().cancelledQ < 4;
  const esgItems = () => E().items.map(i => Object.assign({}, i, { now: i.rec != null ? i.pts : Math.max(0, i.pts - 5 * Math.floor((tq() - i.q) / 4)) }));
  function esgCancel(id) {
    const e = E(), it = e.items.find(i => i.id === id && i.rec != null); if (!it) return '';
    e.items = e.items.filter(i => i !== it); e.cancelledQ = tq();
    GameState._gaSurcharge = fmt(Math.max(0, (GameState._gaSurcharge || 0) - it.rec / 4));
    if (window.Directors && Directors.has('grace')) say(dname('grace'), 'Sustainability', 'You cancelled ' + it.name.toLowerCase(),
      'I found out from the facilities team. ' + it.name + ' is gone, and with it ' + it.pts + ' points of our ESG score (now ' + esgScore() + '). I don\u2019t know what to say. Actually I do, and I will say it at the meeting.', FACE('grace'));
    return 'Cancelled ' + it.name.toLowerCase() + ': saves ' + money(it.rec) + ' a year, ESG \u2212' + it.pts + ' (now ' + esgScore() + ').';
  }
  function esgQuarter() {
    const s = S(), e = E(), now = tq();
    if (!window.Directors || !Directors.has('grace') || s.due || e.nextQ == null || now < e.nextQ) return;
    const pick1 = INITIATIVES.filter(i => !e.items.some(x => x.id === i.id) && (e.seen[i.id] || 0) < 2);
    if (!pick1.length) { e.nextQ = null; return; }
    e.offer = pick1[Math.floor(rnd() * pick1.length)].id; e.seen[e.offer] = (e.seen[e.offer] || 0) + 1;
    e.nextQ = now + 4; s.due = 'story_esg';
  }
  CARDS.push({
    id: 'story_esg', system: true, story: true, holdQ: 2,
    build() {
      const e = E(), I = INITIATIVES.find(i => i.id === e.offer); if (!I) return null;
      const now = esgScore(), after = Math.min(100, now + I.pts), crosses = now < ESG_LINE && after >= ESG_LINE;
      const cost = I.rec != null ? money(I.rec) + ' a year, for as long as it runs' : I.one ? money(I.one) + ' once (its points fade 5 a year)' : 'nothing';
      return {
        title: 'Grace proposes: ' + I.name, from: 'Julian Grace, Sustainability', face: FACE('grace'),
        body: '"Investors are watching our ESG score. This is the single best thing we can do for it this year. Honestly, the bees alone." ' +
              nums([['Cost', cost], ['ESG score', now + ' \u2192 ' + after + ' (60 or more: ESG funds buy your shares, share price +5%)'],
                    ['Right now', now >= ESG_LINE ? 'you are in the ESG bracket' : (ESG_LINE - now) + ' points short of the bracket']]) +
              (crosses ? '<div class="dv-nums"><b>This one takes you into the ESG bracket: share price about +5%.</b></div>' : ''),
        choices: [
          { label: 'Back it',
            detail: (I.rec != null ? 'Costs ' + money(I.rec) + ' a year (G&A). ' : I.one ? 'Costs ' + money(I.one) + ' now. ' : 'Free. ') + 'ESG +' + I.pts + '. Grace +1.' + (crosses ? ' Share price bracket +5%.' : ''),
            check: () => !I.one || spend() >= I.one, checkMsg: 'Need ' + money(I.one || 0),
            apply() {
              const G = GameState, y = G.meta.year;
              if (I.rec != null) G._gaSurcharge = fmt((G._gaSurcharge || 0) + I.rec / 4);
              if (I.one) { pnlLater(-I.one); }
              e.items.push({ id: I.id, name: I.name, rec: I.rec != null ? I.rec : null, pts: I.pts, q: tq(), y });
              attitude('grace', 1, 'you backed ' + I.name.toLowerCase()); e.offer = null;
              return I.done + ' ESG score now ' + esgScore() + '.';
            } },
          { label: 'Turn it down',
            detail: 'Saves the money. Grace \u22121.5, and it counts against you on his scorecard for a year.',
            apply() { e.refusedQ = tq(); e.offer = null; attitude('grace', -1.5, 'you turned down ' + I.name.toLowerCase()); return 'Grace took it well. He has already drafted the next one.'; } },
        ]
      };
    }
  });

  /* Someone new joins the board (meeting.js replacement()). */
  function onDirectorJoin(id) {
    const s = S(), G = GameState;
    if (id === 'grace') E().nextQ = tq() + 1;
    if (id === 'tex') {
      G.board.texJoinQ = tq();                         // round 18: his first award motion waits a year
      G._gaSurcharge = fmt((G._gaSurcharge || 0) + 0.075);
      if (window.Directors) { Directors.bond('petrova', -1, 'you put your friend on the board'); Directors.remember('petrova', -1, 'you put your friend on the board'); }
      s.brennanPressQ = rnd() < 0.6 ? tq() + rint(4, 8) : null;
    }
  }
  /* The press finds Tex (60% within two years of his arrival). */
  function brennanQuarter(out) {
    const s = S(), G = GameState;
    if (!s.brennanPressQ || tq() < s.brennanPressQ || !window.Directors || !Directors.has('tex')) return;
    s.brennanPressQ = null;
    repOf('tex', -15, 'the press story about his seat');
    (G.board.directors || []).forEach(d => { if (d.id !== 'tex') attitude(d.id, -1, 'the press story about Tex'); });
    G.company.sharePrice = fmt(G.company.sharePrice * 0.99);
    say(JOURNO, 'Reporter, ' + PAPER, 'CEO\u2019s friend joins the board',
        'The Ledger ran it today: Tex Brennan, a Texas real estate man and your friend since a Dallas deal, sits on the board that sets your pay. Share price \u22121%. Every director is a little less happy (\u22121), and Tex\u2019s reputation fell to ' + Directors.rep('tex') + ' (below 30 at the annual meeting and he is out).', FACE('journalist'));
    out.push({ good: false, text: 'Press story on Tex\u2019s board seat. Share price \u22121%.' });
  }

  /* -- your own pocket (round 8) ------------------------------------------------
     The CEO's personal stake, kept apart from the company's money. This is
     the seed of the personal-wealth half of the final score. */
  function CEO() { if (window.Pay) return Pay.L(); const G = GameState; if (!G.ceo) G.ceo = { cash: 0, shares: 0, awards: [] }; return G.ceo; }
  const rewardCEO = (why, cash, shares) => { if (window.Pay) Pay.reward(why, cash, shares); };
  const ceoWorth = () => fmt(CEO().cash + CEO().shares * GameState.company.sharePrice / 1e6);

  /* -- Tex's motion at the annual meeting (round 8) ----------------------------
     When the year gives him an excuse, Tex moves a special award for the CEO.
     The excuse is five checks on the year just ended; he needs 2 to stand
     up. Each director then votes, with odds from the checks, their mood and
     their character; majority wins, the Chairman breaks a tie. If paid, the
     proxy advisers may notice: the weaker the excuse, the likelier. */
  const AWARD_CASH = 1.5, AWARD_SHARES = 150000;
  function texChecks() {
    const h = GameState.history || [], n = h.length, G = GameState;
    const at = k => n > k ? h[n - 1 - k] : null, now = at(0), then = at(4);
    const sum = (key, off) => { let t = 0, c = 0; for (let i = n - 1 - off; i >= 0 && c < 4; i--, c++) t += h[i][key] || 0; return c === 4 ? t : null; };
    const g = (a, b) => a != null && b ? a / b - 1 : null;
    const navPS = e => e && e.sharePrice && e.marketCap ? e.totalEquity / (e.marketCap / e.sharePrice) : null;
    const pc = v => v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + '%';
    const affo = g(sum('affoPerShare', 0), sum('affoPerShare', 4));
    const price = now && then ? g(now.sharePrice, then.sharePrice) : null;
    const div = now && then ? g(now.dividendPerShare, then.dividendPerShare) : null;
    const nav = now && then ? g(navPS(now), navPS(then)) : null;
    const y = window.Directors && Directors.ytd ? Directors.ytd() : null;
    return [
      { k: 'Cash profit per share, 12 months', v: pc(affo), want: '≥ +5%', ok: affo != null && affo >= 0.05 },
      { k: 'Share price, 12 months',           v: pc(price), want: '≥ +10%', ok: price != null && price >= 0.10 },
      { k: 'Total return vs the rivals',       v: y ? pc(y.you) + ' vs ' + pc(y.sector) : '—', want: 'ahead', ok: !!y && y.you > y.sector },
      { k: 'Dividend per share, 12 months',    v: pc(div), want: '≥ +4%', ok: div != null && div >= 0.04 },
      { k: 'NAV per share, 12 months',         v: pc(nav), want: '≥ +5%', ok: nav != null && nav >= 0.05 },
    ];
  }
  /* Each director's chance of voting yes, and the chance the motion passes. */
  function awardOdds(kind, checks) {
    const passed = checks.filter(c => c.ok).length, G = GameState, dirs = (G.board.directors || []), d2a = (G.ratios && G.ratios.debtToAssets) || 0;
    const per = dirs.map(d => {
      let p;
      if (d.id === 'tex') p = 1;
      else if (d.id === 'activist') p = 0.02;
      else {
        p = 0.15 + 0.12 * passed + 0.06 * (d.attitude - 5);
        if (kind === 'shares' && d.id === 'petrova') p -= 0.2;           // dilution
        if (kind === 'cash' && d.id === 'okafor' && d2a > 0.45) p -= 0.15; // cash out of a stretched balance sheet
        if (d.id === 'williams' && !checks[3].ok) p -= 0.15;              // no dividend rise, no bonus
        if (d.id === 'grace' && esgScore() >= ESG_LINE) p += 0.1;           // a happy Grace is a generous Grace
        if (G.board.probation) p -= 0.2;
        const bd = window.Directors && Directors.bondOf ? Directors.bondOf(d.id) : null;
        if (bd) p += 0.05 * bd.pts;                                       // friends vote for friends
        p = clamp(p, 0.03, 0.95);
      }
      return { id: d.id, p };
    });
    // exact chance of a majority (tie: the Chairman's vote decides)
    let dist = [{ yes: 0, chair: null, pr: 1 }];
    per.forEach(x => {
      const next = [];
      dist.forEach(s => {
        next.push({ yes: s.yes + 1, chair: x.id === Directors.chair() ? true : s.chair, pr: s.pr * x.p });
        next.push({ yes: s.yes, chair: x.id === Directors.chair() ? false : s.chair, pr: s.pr * (1 - x.p) });
      });
      dist = next;
    });
    const N = per.length;
    const approve = dist.reduce((a, s) => a + (s.yes * 2 > N || (s.yes * 2 === N && s.chair) ? s.pr : 0), 0);
    return { per, approve: Math.round(approve * 100) };
  }
  const flagOdds = passed => Math.round(clamp(0.5 - 0.08 * passed, 0.1, 0.5) * 100);
  /* The award is approved: pay it, and maybe the proxy advisers notice. */
  function payAward(kind, passed) {
    const G = GameState, c = CEO(), s = S();
    if (kind === 'cash') { pnlLater(-AWARD_CASH); c.cash = fmt(c.cash + AWARD_CASH); c.awards.push({ q: tq(), kind, v: AWARD_CASH }); }
    else { G.company.sharesOutstanding = fmt(G.company.sharesOutstanding + AWARD_SHARES / 1e6); c.shares += AWARD_SHARES; c.awards.push({ q: tq(), kind, v: AWARD_SHARES }); }
    if (rnd() * 100 < flagOdds(passed)) s.texCaughtQ = tq() + rint(1, 2);
  }
  function texPayQuarter(out) {
    const s = S(), G = GameState, now = tq();
    if (!s.texCaughtQ || now < s.texCaughtQ) return;
    s.texCaughtQ = null;
    repOf('tex', -10, 'the pay award he pushed through');
    attitude('petrova', -1, 'the special pay award'); attitude('williams', -1, 'the special pay award');
    G.company.sharePrice = fmt(G.company.sharePrice * 0.99);
    say(JOURNO, 'Reporter, ' + PAPER, 'Proxy advisers flag your special award',
        'Two proxy advisers have told shareholders to vote against the pay report: a special award "moved by a director with close personal ties to the CEO". Share price −1%. Petrova and Williams −1. Tex’s reputation fell to ' + (window.Directors ? Directors.rep('tex') : '?') + '.', FACE('journalist'));
    out.push({ good: false, text: 'Proxy advisers flagged your special award. Share price −1%.' });
  }

  /* -- after the bankruptcy: the empty centre ---------------------------------- */
  const NEW_TENANTS = ['Ridgeline Logistics', 'Prairie Cold Chain', 'Northgate Freight', 'Keystone 3PL'];
  const AM = () => window.Staff && Staff.getStaff ? Staff.getStaff('asset') : null;
  /* An offer for the empty centre: about 70% of Harlow's rent, some quarters free. */
  function newOffer(better) {
    const h = H(), base = h.oldRent || LEASE, am = AM();
    const pct = better === true ? 0.8 : better === false ? 0.6 : 0.7 + (am ? (am.skill - 5) * 0.01 : -0.03);
    return { name: NEW_TENANTS[Math.floor(rnd() * NEW_TENANTS.length)], rent: fmt(base * pct), pct: Math.round(pct * 100), free: better === true ? 1 : 2, years: 10 };
  }
  /* -- round 35: THE RESCUE. When Harlow goes bust and we were in deep (the centre,
     the loan, or both), three hard ways out, so no path ends in a 70% crash:
       A  The chairman makes a call. The board blames Hassan; he is forced out and
          Mansour takes his seat. A grocer takes the centre after 1 quarter at 85%
          of Harlow's rent. The courts return 40% of the loan, over a year.
       B  The CFO's rescue facility (needs a CFO). Every bond due in the next two
          years is refinanced into one 3-year loan at base + 5%; the bondholders
          waive the debt limit for a year; the rating goes on watch; Okafor -2.
          Selling Harlow's trucks, stock and stores returns 70% of the loan and
          half the unpaid rent, over a year. The centre re-lets on the market
          in 4 to 6 quarters.
       C  We take over Harlow. The loan becomes a 70% stake (or we buy it from
          the court for $8M). No rent for 2 quarters, then 85% of the old rent,
          to the end. The stake sits on the balance sheet at a fixed value and
          pays 8% a year from the next year.
            Gary runs it ("Family Groceries"): $0.2M, and Nora may run the story
              (then: a community food drive and a donation, your bonus waived;
              or ride it out: the board remembers).
            A turnaround firm runs it: $1.5M, and safe (round 36: it no longer fails).
     Plus the plain ways: market it ourselves, or sell the centre as it stands. */
  const STAKE_YIELD = 0.08, BUY_STAKE = 8;
  const pickOne = a => a[Math.floor(rnd() * a.length)];
  const instal = (amt, n, why) => { const h = H(); h.instal = h.instal || []; const per = fmt(amt / n); for (let k = 1; k <= n; k++) h.instal.push({ q: tq() + k, amt: per, why }); };
  function rescueQuarter(out, now) {
    const h = H(), G = GameState;
    (h.instal || []).filter(x => x.q === now).forEach(x => { pnlNow(x.amt); oneOff(x.amt, true); out.push({ good: true, text: x.why + ': ' + money(x.amt) + ' back this quarter.' }); });
    if (h.instal) h.instal = h.instal.filter(x => x.q > now);
    if (h.stake && h.stake.v > 0 && now >= h.stake.from) GameState.pnl.loanInterest = fmt((GameState.pnl.loanInterest || 0) + h.stake.v * STAKE_YIELD / 4);
    if (G._covWaiver && now > G._covWaiver.until) { G.credit.covenantLimit = G._covWaiver.prev; G._covWaiver = null; out.push({ good: null, text: 'The bondholders’ waiver has ended: the debt limit is back to ' + Math.round((G.credit.covenantLimit || 0.6) * 100) + '%.' }); }
    if (h.turn && !h.turn.done && now >= h.turn.q) {
      h.turn.done = true;
      if (h.turn.fails) {
        const p = dc(), v = h.stake ? h.stake.v : 0; if (v) writeOff(v, true); h.stake = null; h.rescue = 'turnaround_failed';
        const T = HT(); if (T) T.status = 'active'; const line = Tenants.forceDefault(HID);
        if (p && dcMine()) { p.rentFactor = null; if (p.lease && p.lease.positions[0]) p.lease.positions[0].relet = 999; h.stage = 'relet'; h.at = now + rint(4, 6); h.offer = null; }
        else { h.stage = 'done'; h.result = 'turnaround_failed'; }
        say(dname('okafor'), 'Balance sheet', 'The turnaround failed', 'The turnaround firm could not save the chain. The stores close for good. Our stake is written off (' + money(v) + ')' + (p && dcMine() ? ', and the centre goes back on the leasing market.' : '.'), FACE('okafor'));
        out.push({ good: false, text: 'The Harlow turnaround failed: stake written off (' + money(v) + ').' }); if (line) out.push(line);
      } else say('Jenkins', 'Chief of Staff', 'Harlow is trading again', 'Boss, the turnaround firm says the chain is stable. Fewer stores, better ones. Rent is paid on time and our stake pays from next year.', FACE('jenkins'));
    }
    if (h.nora && !h.nora.done && now >= h.nora.q && (!S().due || lowDue())) { h.nora.done = true; S().due = 'story_family_nora'; }
  }
  function otherStake() { const h = H(); return h.stake ? h.stake.v : 0; }
  function reopen(p, name, free) {
    const h = H(), T = HT(), old = h.oldRent || p.annualNOI;
    if (T) { T.status = 'active'; T.coverage = 1.4; T.base = 1.4; T.trend = 0; if (name) T.name = name; }
    p.lease = { type: 'single', positions: [{ t: HID, share: 1, q: 40 }] }; p.occupancy = 1; p.annualNOI = fmt(old * 0.85); p.rentFactor = 0; p.ownerNote = null;
    h.ramp = { start: tq(), free: free, full: p.annualNOI, name: name || 'Harlow Grocers', step: 1 }; h.stage = 'ramp';
  }
  function signNew(p, o, free) {
    const h = H(), G = GameState, id = 'story_tenant_' + tq();
    G.tenants[id] = { id, name: o.name, industry: 'Grocery', story: 'Took the Harlow centre after the bankruptcy.', coverage: 2.0, base: 2.0, trend: 0, esc: 0.02, status: 'active', history: [] };
    p.lease = { type: 'single', positions: [{ t: id, share: 1, q: o.years * 4 }] }; p.occupancy = 1; p.annualNOI = o.rent; p.rentFactor = 0; p.ownerNote = null;
    h.ramp = { start: tq(), free: free, full: o.rent, name: o.name, step: 1 }; h.stage = 'ramp'; h.offer = null;
  }
  CARDS.push({
    id: 'story_harlow_after', system: true, story: true,
    build() {
      const h = H(), B = h.bust, p = dc(), G = GameState; if (!B || h.stage !== 'aftermath') return null;
      const mine = !!(p && dcMine()), old = h.oldRent || (p ? p.annualNOI : LEASE), owed = B.owed || 0;
      const hasH = onBoard('hassan'), chairId = window.Directors ? Directors.chair() : 'williams', chairN = dname(chairId).replace(/^(Chairman|Chair|Director) /, '');
      const cfo = !!(window.Staff && Staff.hasRole && Staff.hasRole('financial')), cfoN = cfo && Staff.getStaff('financial') ? Staff.getStaff('financial').name : 'Your CFO';
      const dueSoon = (G.debtTranches || []).filter(t => G.quartersUntilMaturity(t.maturityYear, t.maturityQuarter) <= 8 && !t.rescue), dueAmt = fmt(dueSoon.reduce((a, t) => a + t.amount, 0));
      const arrears = fmt(B.rent / 2), rateB = fmt((G.market.baseInterestRate || 3) + 5);
      const back40 = fmt(owed * (0.40 - RECOVER)), back70 = fmt(owed * (0.70 - RECOVER) + arrears * 0.5);
      const stakeV = owed > 0 ? fmt(owed * 0.5) : BUY_STAKE;
      const ch = [];
      ch.push({ label: chairN + ' makes a call' + (hasH ? '; the board blames Hassan' : ' (2 political capital)'),
        detail: (mine ? 'A grocer takes the centre after 1 quarter, at 85% of Harlow’s rent (' + money(old * 0.85) + ' a year). ' : '') + (owed ? 'The courts return 40% of the loan (' + money(back40) + ' more, over a year). ' : '') +
                (hasH ? 'Hassan is forced off the board; Mansour (operations, wants 87% occupancy) takes his seat. ' : '') + chairN + ' +1.',
        check: () => hasH || (G.board.politicalCapital || 0) >= 2, checkMsg: 'Needs 2 political capital',
        apply() {
          if (!hasH) G.board.politicalCapital = (G.board.politicalCapital || 0) - 2;
          if (back40 > 0) instal(back40, 4, 'The Harlow bankruptcy court');
          if (hasH && window.Directors) { Directors.removeDirector('hassan', 'Hassan was forced out over Harlow.'); if (!Directors.has('mansour')) Directors.addDirector('mansour', 5, 'Director Mansour joined (operations), in Hassan’s seat.'); }
          if (window.Directors) Directors.remember(chairId, 1, 'he saved the Harlow centre with one call');
          h.rescue = 'bust_williams'; h.result = h.rescue;
          if (mine) { signNew(p, { name: pickOne(['Riverton Fresh Markets', 'Greenleaf Grocers', 'Valley Foods']), rent: fmt(old * 0.85), years: 12 }, 1); return chairN + ' called an old friend. A grocer moves into the centre next quarter.' + (hasH ? ' Hassan has cleared his desk.' : ''); }
          h.stage = 'done'; h.result = 'bust_williams'; return chairN + ' called the court’s administrators. We will get 40% back.' + (hasH ? ' Hassan has cleared his desk.' : '');
        } });
      ch.push({ label: 'The CFO’s rescue facility' + (dueAmt > 0 ? ': ' + money(dueAmt) + ' refinanced at ' + rateB.toFixed(1) + '%' : ''),
        detail: (dueAmt > 0 ? 'Every bond due in the next two years becomes one 3-year loan, secured on our buildings. ' : 'A 3-year facility, secured on our buildings, for a year of lost rent (' + money(B.rent) + '). ') +
                'The bondholders waive the debt limit for a year. Selling Harlow’s assets returns ' + money(back70) + ' over a year (70% of the loan, half the unpaid rent). ' + (mine ? 'The centre re-lets on the market in 4 to 6 quarters. ' : '') + 'Rating on watch, Okafor −2.',
        check: () => cfo, checkMsg: 'Needs a CFO (Staff screen)',
        apply() {
          const now = tq();
          if (dueAmt > 0) G.debtTranches = G.debtTranches.filter(t => dueSoon.indexOf(t) < 0);
          const amt = dueAmt > 0 ? dueAmt : fmt(B.rent), my = G.meta.year + 3;
          G.debtTranches.push({ id: 'rescue' + now, amount: amt, rate: rateB, maturityQuarter: G.meta.quarter, maturityYear: my, quartersUntilMaturity: 12, label: rateB.toFixed(1) + '% Rescue facility due Y' + my + 'Q' + G.meta.quarter, rescue: true });
          if (!(dueAmt > 0)) cash(amt);
          pnlLater(-fmt(amt * 0.01));
          G._covWaiver = { until: now + 4, prev: G.credit.covenantLimit || 0.60 }; G.credit.covenantLimit = 0.70;
          G._ratingHit = { until: now + 4, pts: 7 };
          if (back70 > 0) instal(back70, 4, 'Harlow’s trucks, stock and stores, sold');
          if (window.Directors) Directors.remember('okafor', -2, 'the rescue facility');
          h.rescue = 'bust_cfo'; h.result = h.rescue;
          if (mine) { h.stage = 'relet'; h.at = now + rint(4, 6); return cfoN + ' closed the facility in a week: ' + money(amt) + ', three years, ' + rateB.toFixed(1) + '%. Nothing falls due for two years.'; }
          h.stage = 'done'; h.result = 'bust_cfo'; return cfoN + ' closed the facility. The administrators start selling Harlow’s assets.';
        } });
      const take = gary => ({ label: 'Take over Harlow: ' + (gary ? 'Gary runs it ("Family Groceries")' : 'a turnaround firm runs it'),
        detail: (owed > 0 ? 'Our loan becomes a 70% stake' : 'We buy 70% from the court for ' + money(BUY_STAKE)) + ', on the books at ' + money(stakeV) + ', paying 8% a year from next year. ' +
                (mine ? 'No rent for 2 quarters, then 85% of the old rent (' + money(old * 0.85) + ' a year) to the end. ' : '') +
                (gary ? 'Gary costs $0.2M and renames it Family Groceries. Half the time, Nora runs the story.' : 'The firm costs $1.5M. Safe: no family, no story.'),
        check: () => owed > 0 || spend() >= BUY_STAKE, checkMsg: 'Needs ' + money(BUY_STAKE) + ' to buy the stake',
        apply() {
          const now = tq();
          if (!(owed > 0)) cash(-BUY_STAKE); else { pnlLater(stakeV); cash(-stakeV); oneOff(stakeV, false); }   // the written-off loan comes back as an asset: a gain, no cash
          h.stake = { v: stakeV, from: G.meta.year * 4 + 1 };
          pnlLater(-(gary ? 0.2 : 1.5));
          if (gary) { h.rescue = 'family'; if (rnd() < 0.5) h.nora = { q: now + rint(2, 4) }; }
          else { h.rescue = 'turnaround'; h.turn = { q: now + 4, fails: false }; }   // round 36: the firm no longer fails (Boss Alex: the 85% rent is price enough)
          h.result = h.rescue;
          if (mine) reopen(p, gary ? 'Family Groceries' : 'Harlow Grocers', 2);
          else { h.stage = 'done'; h.result = h.rescue; const T = HT(); if (T) { T.status = 'active'; T.coverage = 1.4; if (gary) T.name = 'Family Groceries'; } }
          return gary ? 'Gary has the keys. The signs say FAMILY GROCERIES. He has ordered aprons with his face on them.' : 'The turnaround firm moved in on Monday. Bob was offered a consultancy. He declined.';
        } });
      ch.push(take(true), take(false));
      if (mine) {
        const sale = fmt(p.currentValue * 0.75);
        ch.push({ label: 'Sell the centre as it stands, for about ' + money(sale), detail: 'An empty specialist warehouse sells about 25% under its value. The story ends here.',
          apply() { const r = Properties.sellProperty(p.id); if (!r || !r.success) return 'The sale fell through.'; G.balance.cash = fmt(G.balance.cash - (r.salePrice || 0) + sale); h.stage = 'done'; h.result = 'bust_sold'; return 'Sold the Harlow centre for ' + money(sale) + '.'; } });
        ch.push({ label: 'Market it ourselves', detail: (AM() ? 'Your Asset Manager: about 2 to 3 quarters.' : 'About 4 to 6 quarters without an Asset Manager.') + ' About 70% of Harlow’s rent. The loan: what has been recovered (25%).',
          apply() { h.stage = 'relet'; h.at = tq() + (AM() ? rint(2, 3) : rint(4, 6)); return 'The centre is on the leasing market.'; } });
      } else ch.push({ label: 'Write it off and move on', detail: 'The 25% already recovered is all we get.', apply() { h.stage = 'done'; h.result = 'bust'; return 'Written off. Okafor has filed the papers under "lessons".'; } });
      return {
        title: 'Harlow Grocers is bankrupt. What now?', from: dname('okafor') + ', Balance sheet', face: FACE('okafor'),
        body: 'Harlow ' + B.why + ' and filed for bankruptcy this week. Bob Harlow has not returned calls.' +
              nums([['Loan', owed ? money(owed) + ' lent, ' + money(B.back) + ' recovered so far, ' + money(B.writeoff) + ' written off' : 'none'],
                    ['Rent lost', money(B.rent) + ' a year, from today'],
                    ...(mine ? [['The distribution centre', 'empty, now worth about ' + money(p.currentValue)]] : []),
                    ['Bonds due in the next two years', dueAmt > 0 ? money(dueAmt) : 'none']]) +
              '<div class="dv-nums"><b>It is bad. It is not the end. Three ways out, each with a price.</b></div>' +
              voices([voice(chairId, hasH ? '"The shareholders want a name. Hassan brought us Bob. I can make one call that fills the building."' : '"I can make one call. It will cost us."'),
                      voice('okafor', '"Whatever we do, nothing may fall due while the rent is gone."')]),
        choices: ch
      };
    }
  });
  CARDS.push({
    id: 'story_family_nora', system: true, story: true, holdQ: 1,
    build() {
      const h = H(); if (!h.nora || h.rescue !== 'family') return null;
      return { title: 'The Ledger: "CEO’s brother-in-law runs bankrupt grocer with shareholders’ money"', from: JOURNO + ', ' + PAPER, face: FACE('journalist'),
        body: 'Nora Whitlock has the story: the REIT turned its bad loan into a grocery chain and handed it to the CEO’s brother-in-law. Gary told her "family is a business model".' +
              voices([voice('petrova', '"Our shareholders read this over breakfast. Fix it."'), voice('williams', '"A good cause and a quiet year. That is how this goes away."')]),
        choices: [
          { label: 'Quiet it: a community food drive, a $0.5M donation, and your bonus waived this year', detail: 'The story fades. The board calms down.',
            apply() { pnlLater(-0.5); GameState._noBonusYear = GameState.meta.year; if (window.Directors) Directors.remember('petrova', 0.5, 'you paid to quiet the Family Groceries story');
                      return 'Family Groceries fed 4,000 families at Thanksgiving. Gary gave the speech. Nora wrote a second, kinder piece.'; } },
          { label: 'Ride it out', detail: 'No cost now. Every director remembers it, Petrova most. Share price −3%.',
            apply() { GameState.company.sharePrice = fmt(GameState.company.sharePrice * 0.97);
                      (GameState.board.directors || []).forEach(d => { if (d.id !== 'tex' && d.id !== 'voss' && window.Directors) Directors.remember(d.id, d.id === 'petrova' ? -2.5 : -1.5, 'Family Groceries in the Ledger'); });
                      return 'No comment. The story ran for a week.'; } },
        ] };
    }
  });
  CARDS.push({
    id: 'story_harlow_relet', system: true, story: true,
    build() {
      const h = H(), o = h.offer, p = dc(); if (!o || h.stage !== 'reletAsk' || !p || !dcMine()) return null;
      const am = AM(), from = am ? am.name + ', Asset Manager' : 'Jenkins, Chief of Staff', face = am && am.portrait ? 'assets/staff/' + am.portrait : FACE('jenkins');
      return {
        title: 'A tenant for the Harlow centre', from, face,
        body: '"I found someone: <b>' + o.name + '</b>, on a ' + o.years + '-year lease. It is not Harlow\u2019s rent, but it is better than an empty building."' +
              nums([['Full rent', money(o.rent) + ' a year (' + o.pct + '% of what Harlow paid)'],
                    ['Rent free', o.free + ' quarter' + (o.free > 1 ? 's' : '')],
                    ['Then', 'rent steps up a quarter at a time: 25%, 50%, 75%, then full']]),
        choices: [
          { label: 'Sign it',
            detail: 'The centre is let again. Full rent of ' + money(o.rent) + ' a year after ' + (o.free + 4) + ' quarters.',
            apply() {
              const G = GameState, id = 'story_tenant_' + tq();
              G.tenants[id] = { id, name: o.name, industry: 'Logistics', story: 'Took the Harlow centre after the bankruptcy.', coverage: 2.0, base: 2.0, trend: 0, esc: 0.02, status: 'active', history: [] };
              p.lease = { type: 'single', positions: [{ t: id, share: 1, q: o.years * 4 }] }; p.occupancy = 1; p.annualNOI = o.rent; p.rentFactor = 0;
              p.ownerNote = null;
              h.ramp = { start: tq(), free: o.free, full: o.rent, name: o.name }; h.stage = 'ramp'; h.offer = null;
              return 'Signed with ' + o.name + '. The forklifts are back.';
            } },
          { label: 'Hold out for a better offer',
            detail: 'Wait 2 more quarters. About half the time a better offer comes (80% of the old rent, 1 quarter free); otherwise a worse one (60%).',
            apply() { h.offer = newOffer(rnd() < 0.5); h.stage = 'relet'; h.at = tq() + 2; return 'You told them you would think about it.'; } },
        ]
      };
    }
  });

  /* ============================================================================
     THE BOARD ROOM (round 11). Stories bring their big beats to the annual
     meeting as agenda items: a director proposes, another objects, a guest
     may join (Bob Harlow), and you decide in the room. meeting.js calls
     agenda(year) once per meeting and plays each item:
       { lines: [[who, text], ...], guest: {name, face, role},
         card: id (a decision card played in the room), later: bool (can go
         to the inbox instead), effect: () => text (no choice, just happens) }
     who: a director id, 'guest', or 'note'.
     ========================================================================== */
  const BOBG = { name: BOB, face: BOBFACE, role: BOBROLE };
  const lead = (a, b) => (window.Directors && Directors.has(a)) ? a : b;
  /* The meeting's story items: Harlow first, then the war (which waits a
     year rather than share a meeting with Bob's offer or loan). */
  function agenda(year) {
    const items = harlowAgenda(year);
    try { if (window.War) War.agenda(year, items); } catch (e) { if (window.console) console.warn('war', e); }
    try { if (window.Tower) Tower.agenda(year, items); } catch (e) { if (window.console) console.warn('tower', e); }
    try { if (window.Gary) Gary.agenda(year, items); } catch (e) { if (window.console) console.warn('gary', e); }
    try { if (window.Port) Port.agenda(year, items); } catch (e) { if (window.console) console.warn('port', e); }
    try { if (window.Levi) Levi.agenda(year, items); } catch (e) { if (window.console) console.warn('levi', e); }
    try { if (window.IndexFund) IndexFund.agenda(year, items); } catch (e) { if (window.console) console.warn('index', e); }
    return items;
  }
  function harlowAgenda(year) {
    const items = [], h = H(), s = S();
    if (!HT()) return items;
    // Act 0: Hassan brings Bob's offer (Year 2 meeting, else Year 3)
    if (h.stage === 'wait' && alive() && dc() && !dcMine() && (year >= 3 || (year === 2 && (h.offerNow || rnd() < 0.6)))) {
      h.stage = 'offer';
      const L = lead('hassan', 'chen');
      items.push({ guest: BOBG, card: 'story_harlow_offer', later: true, lines: [
        [L, 'One item from me. Bob Harlow is here: Harlow Grocers wants to sell us its distribution centre and lease it straight back. 100% let, 15 years, 8% on cost. A super deal.'],
        ['guest', 'Thank you for having me. Every Harlow store is fed from one building. I would rather own stores than a warehouse.'],
        [lead('okafor', 'petrova'), 'Before anyone gets excited: that is one grocer paying nearly a third of our rent. If Harlow sneezes, we catch a cold.']] });
    }
    // Act 2: Bob asks the board for a loan, in person
    if (h.stage === 'late' && alive() && harlowShare() >= 8) {
      h.stage = 'ask';
      items.push({ guest: BOBG, card: 'story_harlow_loan', later: false, lines: [
        [lead('hassan', 'chen'), 'Bob asked to address the board. I said yes. Hear him out.'],
        ['guest', 'I will not dress it up. We opened too fast and the banks have gone cold on grocers. I need ' + money(LOAN) + ' for two years. You get 10%, and you keep your best tenant.'],
        [lead('okafor', 'petrova'), 'Our tenant is late on rent and now wants us to be its bank. I have seen how this film ends.']] });
    }
    // the exposé, argued in the room
    if (h.pressDone && !h.pressTalked) {
      h.pressTalked = true;
      items.push({ lines: [['petrova', 'Our shareholders read about Bob Harlow\u2019s yacht over breakfast. Bought in the quarter we lent him ' + money(h.loan ? h.loan.amt : LOAN) + '.'],
                           [lead('hassan', 'williams'), 'A man is entitled to a boat. The stores are what matter.'],
                           ['williams', 'Let us not have this conversation in the newspaper again.']] });
    }
    const L = h.loan;
    // maturity: the loan falls due at this meeting
    if (h.stage === 'loan' && L && L.dueYear && year >= L.dueYear) {
      const c = cover();
      if (!L.ext) {
        const r = roll(maturityOdds(c), ['repay', 'extend', 'cant']);
        if (r === 'repay') items.push({ guest: BOBG, lines: [['guest', 'Ladies and gentlemen, Harlow repays the ' + money(L.amt) + ' in full. You took a chance on us when the banks would not. Riverton remembers that.']],
                                        effect: () => { const amt = L.amt; repaid([], true); return 'Harlow repaid ' + money(amt) + '. Share price +2%. Hassan +1.5.'; } });
        else {
          h.stage = 'decide';
          if (r === 'extend' && L.accrued) { pnlLater(L.accrued); L.paid = fmt((L.paid || 0) + L.accrued); L.accrued = 0; }
          items.push({ guest: BOBG, card: r === 'extend' ? 'story_harlow_extend' : 'story_harlow_default', later: false, lines: r === 'extend'
            ? [['guest', 'Every cent of interest is paid. I need one more year to refinance, and then you have it all back.'], [lead('hassan', 'chen'), 'He has paid every cent. Give him the year.']]
            : [['guest', 'I don\u2019t have it. Not today. Give me one year. I am this close.'], [lead('okafor', 'petrova'), 'Write it off now. Every quarter we wait, the hole gets deeper.'], [lead('hassan', 'chen'), 'One more year. He has kept this city fed for seventy years.']] });
        }
      } else {
        const r = roll(finalOdds(c, L.from), ['repay', 'partial', 'bust']);
        if (r === 'repay') items.push({ guest: BOBG, lines: [['guest', 'The extra year was enough. Harlow repays you in full, today.']], effect: () => { const amt = L.amt; repaid([], true); return 'Harlow repaid ' + money(amt) + '.'; } });
        else if (r === 'partial') items.push({ guest: BOBG, lines: [['guest', 'We sold six stores. I can repay 60%. The rest is gone, and I am sorry.']], effect: () => { partial([], true); return 'Harlow repaid 60% of its loan. The rest is written off.'; } });
        else items.push({ guest: BOBG, lines: [['guest', 'I have nothing left to offer you. Harlow files for bankruptcy on Monday.'], [lead('okafor', 'petrova'), 'Then we should have written it off a year ago.']],
                          effect: () => { bust([], 'could not pay after the extra year', false); return 'Harlow Grocers is bankrupt. Details in your inbox.'; } });
      }
    } else if (h.stage === 'loan' && L && L.dueYear && (L.missed > 0 || cover() < 1.15)) {
      // the yearly review while the loan runs
      h.stage = 'decide';
      items.push({ card: 'story_harlow_review', later: false, lines: [
        [lead('okafor', 'petrova'), 'Harlow: ' + (L.missed ? L.missed + ' missed payment' + (L.missed > 1 ? 's' : '') + ', ' : '') + 'rent cover ' + c2(cover()) + '. I move that we call the loan.'],
        [lead('hassan', 'chen'), 'And lose our best tenant over a bad patch? Bob is turning it round. Give him the year.']] });
    }
    return items;
  }
  const c2 = c => c.toFixed(2) + 'x';
  CARDS.push({
    id: 'story_harlow_review', system: true, story: true,
    build() {
      const h = H(), L = h.loan; if (!L || h.stage !== 'decide') return null;
      const b = bustCost(), mo = maturityOdds(cover());
      return {
        title: 'The Harlow loan: keep or call', from: dname('okafor'), face: FACE('okafor'),
        body: nums([['Loan', money(L.amt) + (L.accrued ? ', ' + money(L.accrued) + ' interest unpaid' : '') + ', falls due at the Year ' + L.dueYear + ' meeting'],
                    ['Harlow\u2019s rent cover', c2(cover())], ['When it falls due, as things stand', matWords(mo)]]),
        choices: [
          { label: 'Keep backing Bob', detail: 'Nothing changes. Hassan +0.5 and warmer, Okafor \u22120.5.',
            apply() { h.stage = 'loan'; attitude('hassan', 0.5, 'you kept backing Bob'); attitude('okafor', -0.5, 'you kept the Harlow loan'); bond('hassan', 0.5, 'you kept backing Bob'); return 'The loan stands.'; } },
          { label: 'Call the loan now', detail: 'Harlow goes bankrupt. We get ' + money(b.back) + ' back, write off ' + money(b.writeoff) + ', lose ' + money(b.rent) + ' a year of rent. Share price about \u2212' + b.drop + '%. Okafor +1, Hassan \u22122 and an enemy.',
            apply() { h.stage = 'loan'; attitude('okafor', 1, 'you called the Harlow loan'); attitude('hassan', -2, 'you called the Harlow loan'); bond('hassan', -2, 'you evicted Bob'); h.lent = false;
                      bust([], 'was evicted when we called the loan', false); return 'You called the loan. Harlow filed for bankruptcy.'; } },
        ]
      };
    }
  });

  /* repaid() outside the quarter: the P&L parts must wait for the next quarter */
  function repaidLater(out) {
    const h = H(), L = h.loan;
    cash(L.amt); if (L.accrued) pnlLater(L.accrued); if (L.prov) { pnlLater(L.prov); cash(-L.prov); }
    say(BOB, BOBROLE, 'Paid in full, elsewhere', 'Harlow refinanced and repaid your ' + money(L.amt) + '. Bob did not send a card.', BOBFACE);
    endLoan(); h.stage = 'done'; h.result = 'refinanced';
  }
  function bustCostIf(amt) {
    const p = dc(), dcLoss = p && dcMine() ? p.currentValue * 0.35 : 0, loss = amt * (1 - RECOVER) + dcLoss;
    return { drop: Math.round(clamp(0.6 * loss / marketCap(), 0, 0.3) * 100) };
  }

  /* round 17: every big cheque can be paid with preferred shares (financials.js prefChoice) */
  const withPref = (c, amt) => { const b = c.build; c.build = function () { const k = b.apply(this, arguments);
    if (k && k.choices && k.choices[0] && window.Financials && Financials.prefChoice) { const a = amt(); if (a > 0) { const pc = Financials.prefChoice(k.choices[0], a, { why: k.title }); k.choices.splice(1, 0, pc); if (Financials.splitChoice) k.choices.splice(2, 0, Financials.splitChoice(k.choices[0], a, { why: k.title }));   /* round 27: or split it */ k.body = (k.body || '') + Financials.prefDebateHTML(pc.rate); } } return k; }; };
  const PREF_AMT = { story_harlow_offer: () => PRICE + (Properties.transactionFee ? Properties.transactionFee(PRICE) : 0), story_harlow_loan: () => LOAN };
  CARDS.forEach(c => { if (PREF_AMT[c.id]) withPref(c, PREF_AMT[c.id]); });
  if (window.World && World.DECISIONS) CARDS.forEach(c => { if (!World.DECISIONS.some(d => d.id === c.id)) World.DECISIONS.push(c); });

  // ============================================================================
  /* -- the economy, in a sentence or two (round 9) --------------------------------
     Rate moves and cycle changes arrive in the inbox with a short story
     behind a click: ambience, not homework. */
  const CYCLE_NAME = { expanding: 'The economy is growing', stable: 'The economy is steady', contracting: 'The economy is slowing', recession: 'Recession' };
  function macroLine(kind, x) {
    const r2 = n => n.toFixed(2) + '%', cpi = (2 + Math.random() * 3).toFixed(1), jobs = (3.6 + Math.random() * 3).toFixed(1);
    if (kind === 'rate') {
      const up = x.to > x.from, d = Math.round(Math.abs(x.to - x.from) * 100);
      return { headline: (up ? 'The central bank raised rates ' : 'The central bank cut rates ') + d + ' basis points, to ' + r2(x.to),
        more: up ? pick([
          'Inflation came in at ' + cpi + '% for the year, above target again. The chair called the move "insurance". Floating-rate debt, like our credit line, costs more from today.',
          'Wage growth and rents are running hot. The committee voted 7 to 2; the two dissenters wanted to wait. Bond yields rose within the hour.',
          'Oil and food prices pushed inflation to ' + cpi + '%. The chair warned of "further firming". REIT shares fell across the board.']) : pick([
          'Unemployment rose to ' + jobs + '% and retail sales fell two months running. The chair said the committee "can afford patience". Cheaper money for us, eventually.',
          'Factory orders slipped again. The cut was smaller than markets hoped, but the message was clear: the bank is worried about growth.',
          'With inflation back near target, the bank eased. Refinancing just got a little cheaper.']) };
    }
    return { headline: CYCLE_NAME[x.to] || 'The economy has turned',
      more: ({ expanding: 'Hiring is strong and empty space across the city is the lowest in years. Landlords are raising asking rents again.',
               stable: 'Growth is steady and inflation near target. Nobody is excited, which is the point.',
               contracting: 'Factory orders fell for a third month and the jobs report missed. Economists now say "slowdown" without the quotation marks. Tenants will start asking for help.',
               recession: 'Two quarters of shrinking output. Layoffs at the port and the auto plant; shoppers are trading down. Weak tenants will fail now, and buildings get cheaper.' })[x.to] || '' };
  }
  const pick = a => a[Math.floor(Math.random() * a.length)];

  /* -- Jenkins's nudges after the tutorial year (round 9) --------------------- */
  function nudges() {
    const s = S(), G = GameState, now = tq();
    // round 19: a bond we cannot repay is a default. Jenkins warns two quarters out, once per bond.
    s.bondWarned = s.bondWarned || {};
    (G.debtTranches || []).forEach(t => {
      const left = (t.maturityYear - 1) * 4 + t.maturityQuarter - now, spend = window.Revolver && G.revolver ? Revolver.spendable() : G.balance.cash;
      if (left < 0 || left > 2 || s.bondWarned[t.id] || t.amount <= spend) return;
      s.bondWarned[t.id] = true;
      if (window.Inbox) Inbox.message('Jenkins', 'Chief of Staff', 'We cannot repay the ' + money(t.amount) + ' bond',
        'Boss, ' + t.label + ' falls due ' + (left === 0 ? 'at the end of this quarter' : 'in ' + left + ' quarter' + (left > 1 ? 's' : '')) + '. Cash plus the credit line is ' + money(spend) + '. Bonds are not rolled for us: if we cannot pay on the day, we default and it is over.<br><br>' +
        'Ways out: <b>issue a new bond</b> to refinance it (borrowing to repay a bond due within two quarters does not count against the covenant), <b>sell a building</b>, or <b>sell new shares</b>.', 'assets/faces/jenkins.jpg');
    });
    // round 32: the economy, in Jenkins's words, when it turns
    const ph = window.Arc && Arc.phase ? Arc.phase() : null;
    s.phaseSaid = s.phaseSaid || {};
    if (ph && !s.phaseSaid[ph] && window.Inbox && GameState.meta.year >= 2) {
      const NOTE = {
        warning: ['Storm clouds', 'Boss, the mood is changing. Banks are asking more questions, bond buyers want more interest, and the papers have started using the word "slowdown". Nothing has broken yet.<br><br>If it comes: <b>cash</b> keeps you alive, <b>long fixed-rate bonds</b> beat the credit line, and a <b>dividend you can afford</b> beats a generous one. I would not borrow short this year.'],
        crisis: ['Things are going dim', 'Boss, this is it. The economy has turned: tenants will struggle, buildings are worth less, lenders want more, and some will not lend at all.<br><br>What matters now: <b>do not run out of cash</b>, keep debt under the covenant, refinance anything falling due <b>early</b>, and do not cut the dividend unless you must (Williams). The rivals are in the same storm. Some of them will have to sell, cheaply.'],
        recovery: ['The worst is over', 'Boss, the numbers are turning up. Buildings are still cheap and the rivals are licking their wounds. This is when good companies buy.'],
        aftershock: ['Not again', 'Boss, a second shock. Smaller than the first, but the same rules: cash first, covenants second, everything else third.'],
      }[ph];
      s.phaseSaid[ph] = true;
      if (NOTE) Inbox.message('Jenkins', 'Chief of Staff', NOTE[0], NOTE[1], 'assets/faces/jenkins.jpg');
    }
    // round 31: two short notes at the moment they matter
    const listed = (G.propertyMarket || []).filter(p => p.listedByOwner).length;
    if (!s.nudgedDR && window.Inbox && now >= 6 && (listed <= 2 || now >= 7)) {
      s.nudgedDR = true;
      Inbox.message('Jenkins', 'Chief of Staff', 'Not everything for sale is on the market',
        'Boss, only ' + listed + ' building' + (listed === 1 ? ' is' : 's are') + ' openly for sale. The rest of Riverton still has owners who might sell at the right price. Click any building on the map or in Properties and <b>make an offer</b>; land lots (the orange + on the map) go to <b>auction</b>.<br><br>Everything you have running sits in the <b>Dealroom</b>: offers, bids, building sites, and the people you can put on each case.', 'assets/faces/jenkins.jpg');
    }
    if (!s.nudgedPC && window.Inbox && G.meta.year >= 2 && (G.board.politicalCapital || 0) >= 3) {
      s.nudgedPC = true;
      Inbox.message('Jenkins', 'Chief of Staff', 'You have political capital to spend',
        'Boss, you have <b>' + G.board.politicalCapital + ' political capital</b>: goodwill with the board, the bank and the city. You earn it at board meetings by delivering. You spend it on trades with directors at the meeting, favours from the bank (Finance, credit line), story choices, and putting a director on a case in the <b>Dealroom</b>. It caps at ' + (G.board.maxCapital || 8) + ', so do not hoard it.', 'assets/faces/jenkins.jpg');
    }
    if (now === 5 && !s.nudgedAM && window.Inbox) {
      s.nudgedAM = true;
      const am = window.Staff && Staff.getStaff && Staff.getStaff('asset');
      const lowest = (G.portfolio || []).filter(p => !p.underConstruction && !(window.Tenants && Tenants.isLocked(p))).sort((a, b) => a.occupancy - b.occupancy)[0];
      Inbox.message('Jenkins', 'Chief of Staff', 'Year 2: fill the empty space',
        (am ? 'Good: ' + am.name + ' is on the team. ' : 'Boss, one suggestion for this year: <b>hire an Asset Manager</b> (Staff screen). They keep buildings full every quarter, unlock renovations, and find tenants faster when one leaves. ') +
        (lowest ? 'Then <b>lease up ' + lowest.name + '</b>: it is only ' + Math.round(lowest.occupancy * 100) + '% let. On Properties, open the building and press Lease up. Every point of occupancy is rent we are not collecting.' : ''),
        'assets/faces/jenkins.jpg');
    }
  }

  /* round 26: a sponsorship offer or an off-market pitch must not hold up a story beat */
  function lowDue() {
    const d = S().due; if (d !== 'pr_offer' && d !== 'deal_pitch') return false;
    if (d === 'pr_offer' && GameState.pr) GameState.pr.offer = null;
    if (d === 'deal_pitch' && GameState.deals) GameState.deals.pitch = null;
    return true;
  }
  function processQuarter() {
    const out = [];
    if (!window.GameState || !GameState.meta || GameState.meta.gameOver) return out;
    GameState.pnl.loanInterest = 0;
    try { harlowQuarter(out); } catch (e) { if (window.console) console.warn('story', e); }
    try { esgQuarter(); brennanQuarter(out); texPayQuarter(out); nudges(); } catch (e) { if (window.console) console.warn('story', e); }
    try { if (window.War) War.processQuarter(out); } catch (e) { if (window.console) console.warn('war', e); }
    try { if (window.Tower) Tower.processQuarter(out); } catch (e) { if (window.console) console.warn('tower', e); }
    try { if (window.Gary) Gary.processQuarter(out); } catch (e) { if (window.console) console.warn('gary', e); }
    try { if (window.Port) Port.processQuarter(out); } catch (e) { if (window.console) console.warn('port', e); }
    try { if (window.Levi) Levi.processQuarter(out); } catch (e) { if (window.console) console.warn('levi', e); }
    try { if (window.Mayor) Mayor.processQuarter(out); } catch (e) { if (window.console) console.warn('mayor', e); }   // round 33
    try { if (window.IndexFund) IndexFund.processQuarter(out); } catch (e) { if (window.console) console.warn('index', e); }
    try { if (window.Sales) Sales.processQuarter(); } catch (e) { if (window.console) console.warn('sales', e); }
    try { if (window.Deals) Deals.processQuarter(out); } catch (e) { if (window.console) console.warn('deals', e); }   // round 22
    try { if (window.PR) PR.processQuarter(out); } catch (e) { if (window.console) console.warn('pr', e); }
    try { if (window.Pay) Pay.quarter(); } catch (e) { if (window.console) console.warn('pay', e); }
    return out;
  }
  function dueCard() { return S().due; }
  function otherAssets() { const L = S().harlow && S().harlow.loan; return (L ? fmt(L.amt - (L.prov || 0)) : 0) + otherStake(); }   // round 35: and the Harlow stake

  /* "On the clock" lines (inbox). */
  function clockRows() {
    const h = S().harlow, rows = []; if (!h || !h.loan) return rows;
    const L = h.loan, left = L.due - tq(), q = n => n <= 0 ? 'this quarter' : n === 1 ? '1 qtr' : n + ' qtrs';
    if (!L.ext) { const o = maturityOdds(cover()); rows.push({ tone: L.streak ? 'bad' : 'warn', k: 'Harlow loan ' + money(L.amt) + ' due. Most likely: ' + likely(o, { repay: 'he repays', extend: 'he asks for more time', cant: 'he cannot pay' }), v: q(left) }); }
    else { const o = finalOdds(cover(), L.from); rows.push({ tone: 'bad', k: 'Harlow\u2019s last chance. Most likely: ' + likely(o, { repay: 'he repays', partial: 'he repays most of it', bust: 'he goes bust' }), v: q(left) }); }
    if (L.accrued) rows.push({ tone: 'bad', k: 'Harlow unpaid interest', v: money(L.accrued) });
    return rows;
  }

  /* For tests and tuning: jump the Harlow story to a stage. */
  function debugBust(why) { const out = []; bust(out, why || 'ran out of cash', true); return out; }   // round 35: tools/browser_round35b.js
  function debug(stage, extra) { const h = H(); Object.assign(h, { stage }, extra || {}); if (extra && extra.due) S().due = extra.due; return h; }

  return { debugBust, lowDue, init, ensure, processQuarter, dueCard, otherAssets, protects, clockRows, S, H, maturityOdds, finalOdds, failOdds, debug,
           esgScore, esgPremium, esgNewThisYear, esgRefusedRecently, esgCancelledRecently, esgItems, esgCancel, onDirectorJoin, ESG_LINE,
           CEO, ceoWorth, texChecks, awardOdds, payAward, flagOdds, AWARD_CASH, AWARD_SHARES, macroLine, agenda };
})();
