/* ============================================================================
   inbox.js — the one place news reaches the player (design doc B.12d).

   Lives in the column to the right of the map. Four kinds of item:
     decision  pinned on top until answered; Advance is blocked meanwhile
     summary   the quarter's bottom line (retained cash), with your own
               actions listed small underneath
     event     things that happened TO you: red bad, green good, blue neutral
     message   people talking to you (Jenkins for now; directors, staff and
               rivals later), no portraits

   Items are grouped by turn. A turn is the quarter you are playing now: the
   results of the quarter you just finished arrive at the start of the next.
   The current turn is open; older turns collapse to one line.

   State lives in GameState.inbox, so newGame() (which rebuilds GameState)
   starts a clean inbox automatically.
   ========================================================================== */

window.Inbox = (() => {

  const MAX_TURNS_SHOWN = 8;
  let pendingEvt = null;          // the decision object (holds functions, so not in GameState)
  const heldEvts = {};            // decisions on hold, by inbox item id (rebuilt from their card after a load)
  const nowQ = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;

  function S() {
    if (!GameState.inbox) GameState.inbox = { items: [], seq: 0, open: {}, lastReportTq: 0, pendingId: null };
    return GameState.inbox;
  }
  const turn = () => (GameState.meta.totalQuarters || 0) + 1;       // quarter being played now
  const turnLabel = t => 'Year ' + (Math.floor((t - 1) / 4) + 1) + ' · Q' + ((t - 1) % 4 + 1);
  const qLabel = t => 'Q' + ((t - 1) % 4 + 1) + ' Y' + (Math.floor((t - 1) / 4) + 1);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const money = v => (v < 0 ? '−' : '') + '$' + Math.abs(v).toFixed(1) + 'M';

  function add(item) {
    const s = S();
    item.id = ++s.seq;
    if (item.turn == null) item.turn = turn();
    if (item.read == null) item.read = item.kind !== 'message';
    s.items.push(item);
    render();
    return item.id;
  }

  /* -- people ------------------------------------------------------------- */
  const JENKINS = 'assets/faces/jenkins.jpg';
  function message(from, role, title, body, face, task) {
    return add({ kind: 'message', from, role, title, body, read: false,
                 face: face || (from === 'Jenkins' ? JENKINS : ''), task: task || null });
  }

  /* -- tutorial checklist (round 2) ----------------------------------------
     Each of Jenkins's Year 1 steps checks the real game state. When a step is
     first done he says so, with the number that changed. */
  const debtNow = G => (G.debtTranches || []).reduce((a, t) => a + t.amount, 0);
  const TASKS = {
    // loans are counted directly: balance.totalDebt only refreshes when a quarter closes
    borrow: { done: G => debtNow(G) > ((G._tutBase || {}).debt || 0) + 0.5,
              note: G => 'You borrowed. Debt is now ' + money(debtNow(G)) + '; the interest shows up in next quarter\u2019s results.' },
    equity: { done: G => (G.company.equityIssuanceCount || 0) > 0,
              note: G => 'Shares sold. ' + G.company.sharesOutstanding.toFixed(1) + 'M shares now share the profit. Petrova noticed.' },
    buy:    { done: G => (G.portfolio || []).some(p => ((G._tutBase || {}).props || []).indexOf(p.id) === -1),
              note: G => 'You own ' + G.portfolio.length + ' buildings now. Watch its rent in next quarter\u2019s results.' },
    cfo:    { done: G => !!(window.Staff && Staff.hasRole && Staff.hasRole('cfo')),
              note: G => 'Your CFO starts work. Unsecured loans are now open to you.' },
    // round 24: looking after the buildings
    asset:  { done: G => !!(window.Staff && Staff.hasRole && Staff.hasRole('asset')),
              note: G => 'Your Asset Manager starts work: a little more of every building let each quarter, and lease up and renovation are open.' },
    leaseup: { done: G => (G.portfolio || []).some(p => p.leaseUpYear),
              note: G => 'Leased up. Occupancy is ' + Math.round((G.ratios.occupancyPortfolio || 0) * 100) + '% across the portfolio; the extra rent shows next quarter.' },
    renovate: { done: G => (G.portfolio || []).some(p => p.renovated || p.renovating),
              note: G => 'Renovation under way. One quarter offline, then more rent and a building that ages slower.' },
  };
  /* round 24: after the CFO, Jenkins moves on to the buildings, one step at a time */
  const NEXT = {
    cfo: { task: 'asset', title: 'Step 5: Hire an Asset Manager',
      body: 'Buildings age, boss: rent drifts down about 1% a year and tenants leave. An <strong>Asset Manager</strong> keeps them full (a little more let every quarter) and unlocks <strong>lease up</strong>, <strong>renovation</strong> and <strong>repositioning</strong>.<br><br>Open <strong>Staff</strong> and hire one.' },
    asset: { task: 'leaseup', title: 'Step 6: Lease up a building',
      body: 'On <strong>Properties</strong>, open a building below 90% let and press <strong>Lease up</strong>. It costs 12% of that building\u2019s yearly rent (brokers, free months) and fills 3 to 8 points at once, more the emptier it is.<br><br><strong>Best between 65% and 85% let</strong>: there it pays for itself in about two years. Above 85% it barely pays. Once a year per building.' },
    leaseup: { task: 'renovate', title: 'Step 7: Renovate one',
      body: 'Renovation costs 10% of a building\u2019s value and takes it offline for a quarter. In return: <strong>rent +15%</strong>, value up about as much as it cost, 8 more points let, and it stops ageing for 4 years.<br><br><strong>Best for older buildings 75% to 90% let.</strong> Not downtown towers (already premium). Below 70% let, think <strong>repositioning</strong>: changing what the building is for.' },
  };
  function taskDone(id) { const t = TASKS[id]; return !!(t && window.GameState && t.done(GameState)); }
  function checkTasks() {
    const G = GameState; if (!G || !G._tutBase) return;
    G._tutDone = G._tutDone || {};
    Object.keys(TASKS).forEach(id => {
      if (G._tutDone[id] || !taskDone(id)) return;
      G._tutDone[id] = true;
      const asked = S().items.some(i => i.task === id);
      if (asked) add({ kind: 'message', from: 'Jenkins', role: 'Chief of Staff', face: JENKINS,
                       title: '\u2713 Done: ' + ({ borrow: 'you borrowed', equity: 'you sold shares', buy: 'you bought a building', cfo: 'you hired a CFO', asset: 'you hired an Asset Manager', leaseup: 'you leased up a building', renovate: 'you renovated' })[id],
                       body: TASKS[id].note(G), read: false });
      const nx = NEXT[id];
      if (asked && nx && G._tutorialEnabled !== false && !S().items.some(i => i.task === nx.task)) {
        add({ kind: 'message', from: 'Jenkins', role: 'Chief of Staff', face: JENKINS, title: nx.title, body: nx.body, task: nx.task, read: false });
        if (nx.task === 'asset' && window.Story) Story.S().nudgedAM = true;      // his Year 2 note would say the same
      }
    });
  }
  const av = it => it.face ? '<img class="ib-av" src="' + esc(it.face) + '" alt="" onerror="this.style.visibility=\'hidden\'">' : '';

  /* -- a finished quarter --------------------------------------------------
     Called from ui.js renderEarningsReport. Guarded so re-renders of the same
     report never duplicate it. */
  /* The key numbers under a macro headline, as they stand now (round 17). */
  function factors(src) {
    const G = GameState, m = G.market || {}, out = [], pct = n => (+n).toFixed(2) + '%';
    const CY = { expanding: 'growing', stable: 'steady', contracting: 'slowing', recession: 'in recession' };
    out.push('Base rate: <b>' + pct(m.baseInterestRate || 0) + '</b>');
    try { out.push('New 7 year bonds for us: <b>' + pct(Financials.getCurrentBorrowingRateForTerm(7)) + '</b> (rating ' + (G.credit.rating || '\u2014') + ')'); } catch (e) {}
    if (window.Revolver && G.revolver) out.push('Our credit line: <b>' + pct(Revolver.rate()) + '</b>');
    if (src !== 'fed') {
      out.push('The economy: <b>' + (CY[m.cycle] || m.cycle || 'steady') + '</b>');
      const sp = window.Arc && Arc.spreadAdd ? Arc.spreadAdd() : 0;
      if (sp > 0.05) out.push('Lenders charge <b>+' + sp.toFixed(2) + '%</b> on top while the panic lasts');
      const ph = window.Arc && Arc.phase ? Arc.phase() : null;
      if (ph === 'crisis' || ph === 'aftershock') out.push('Weak tenants fail more often, buildings sell for less, and rivals under pressure must sell.');
      else if (ph === 'recovery') out.push('Prices are low and recovering: the best time to buy.');
    } else out.push('Rates and building values move in opposite directions: when rates rise, values fall.');
    return out;
  }

  function ingestReport(report, events, actions) {
    const s = S(), done = GameState.meta.totalQuarters || 0;
    if (!report || done < 1 || s.lastReportTq === done) return;
    s.lastReportTq = done;
    // a new quarter: anything from earlier turns has been seen (Alexander: the count felt stuck)
    s.items.forEach(i => { if (i.kind === 'message' && i.turn < turn()) i.read = true; });
    const pnl = GameState.pnl || {};
    const rc = report.retainedCash !== undefined ? report.retainedCash : (pnl.retainedCash || 0);
    add({
      // year only when it differs from the turn's heading (Q4 results arrive in Q1)
      kind: 'summary', title: (done % 4 === 0 ? qLabel(done) : 'Q' + ((done - 1) % 4 + 1)) + ' results', rc,
      detail: 'Rent ' + money(report.netRentalIncome !== undefined ? report.netRentalIncome : (pnl.noi || 0)) +
              ' · interest ' + money(-(pnl.interestExpense || 0)) +
              ' · dividends ' + money(-(pnl.dividendsPaid || 0)) +
              (pnl.unusualItems ? ' · one-offs ' + money(pnl.unusualItems) : ''),
      actions: actions || [],
      why: explain(events || []),
      ytd: window.Directors ? Directors.ytd() : null,
      rank: window.Rivals && GameState.rivals ? (Rivals.league((GameState.meta.quarter - 1) || 4).find(r => r.key === 'you') || {}).rank : null,
      price: explainPrice()
    });
    (events || []).forEach(e => add(e.macro ? { kind: 'macro', src: e.src, tone: e.tone, title: e.headline, body: e.impact || '', more: e.more || '', factors: factors(e.src) }
                                            : { kind: 'event', tone: e.tone, title: e.headline, body: e.impact || '', more: e.more || '' }));
    snapshot();
  }

  /* -- "because" lines (round 2) ----------------------------------------------
     Why did retained cash change against last quarter, and why did the share
     price move? Every line names a cause the player can see and act on. */
  const OPEX = 0.30;                        // financials.js OPEX_RATIO
  // a building's rent after costs this quarter, exactly as the P&L counts it
  const contrib = p => p.underConstruction ? 0 : (p.annualNOI / 4) * (p.occupancy - OPEX) / (1 - OPEX);
  const plain = t => String(t || '').replace(/<[^>]+>/g, '').replace(/^[^A-Za-z0-9$]+/, '').trim();
  const short = t => t.length > 74 ? t.slice(0, 71) + '\u2026' : t;

  function snapshot() {
    const snap = {};
    (GameState.portfolio || []).forEach(p => { snap[p.id] = { c: contrib(p), occ: p.occupancy, n: p.name, uc: !!p.underConstruction }; });
    GameState._contribSnap = snap;
    GameState._priceWhyPrev = GameState._priceWhy ? JSON.parse(JSON.stringify(GameState._priceWhy)) : null;
    GameState._staffCountPrev = (GameState.staff || []).length;
  }

  function rentWhy(events) {
    const snap = GameState._contribSnap;
    if (!snap) return [];
    const out = [], seen = {};
    (GameState.portfolio || []).forEach(p => {
      seen[p.id] = 1;
      const was = snap[p.id], now = contrib(p);
      if (!was) { out.push({ d: now, t: 'bought ' + p.name }); return; }
      const d = now - was.c;
      if (Math.abs(d) < 0.02) return;
      let t;
      if (p.underConstruction && !was.uc) t = p.name + ' closed for works';
      else if (!p.underConstruction && was.uc) t = p.name + ' reopened';
      else {
        // the event that moved this building's rent (warnings about future expiries don't count)
        const ev = events.find(e => { const h = plain(e.headline);
          return h.indexOf(p.name) > -1 && !/expires in|up for re|renewed|out of cash/i.test(h) && (d < 0 ? e.tone === 'bad' : e.tone !== 'bad'); });
        const occ = Math.round(was.occ * 100) !== Math.round(p.occupancy * 100)
          ? 'occupancy ' + Math.round(was.occ * 100) + '% \u2192 ' + Math.round(p.occupancy * 100) + '%' : '';
        t = ev ? short(plain(ev.headline)) : p.name + ': ' + (occ || 'rent changed');
      }
      out.push({ d, t });
    });
    Object.keys(snap).forEach(id => { if (!seen[id]) out.push({ d: -snap[id].c, t: 'sold ' + snap[id].n }); });
    return out.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  }

  function explain(events) {
    const H = GameState.history || [];
    if (H.length < 2) return [];
    const cur = H[H.length - 1], prev = H[H.length - 2];
    const parts = [];
    const add_ = (label, d, why) => { if (Math.abs(d) >= 0.05) parts.push({ label, d: Math.round(d * 100) / 100, why: why || '' }); };

    const dRent = cur.noi - prev.noi, rw = rentWhy(events), top = rw.slice(0, 2);
    const rest = dRent - top.reduce((t, x) => t + x.d, 0);
    const reasons = top.map(x => x.t);
    if (Math.abs(rest) >= 0.05 && Math.abs(rest) > Math.abs(dRent) * 0.3)
      reasons.push((rest > 0 ? '+' : '\u2212') + money(Math.abs(rest)).replace('\u2212', '') + ' across the rest' +
        (GameState.meta.quarter === 1 && rest > 0 ? ' (yearly rent increases)' : ' of the portfolio'));
    add_('Rent', dRent, reasons.join('; '));

    const dDebt = (cur.totalDebt || 0) - (prev.totalDebt || 0);
    add_('Interest', -((cur.interestExpense || 0) - (prev.interestExpense || 0)),
      dDebt > 0.5 ? 'you borrowed ' + money(dDebt) : dDebt < -0.5 ? 'you repaid ' + money(-dDebt) : 'a loan refinanced at a new rate');

    const st = (GameState.staff || []).length, stPrev = GameState._staffCountPrev;
    add_('Head office', -((cur.gAndA || 0) - (prev.gAndA || 0)),
      stPrev != null && st > stPrev ? 'new hire' + (st - stPrev > 1 ? 's' : '') : stPrev != null && st < stPrev ? 'someone left' : 'overhead grows with the portfolio');

    const dps = cur.dividendPerShare, dpsPrev = prev.dividendPerShare;
    add_('Dividends', -((cur.dividendsPaid || 0) - (prev.dividendsPaid || 0)),
      dps > dpsPrev ? 'you raised the dividend to $' + dps.toFixed(2) : dps < dpsPrev ? 'you cut the dividend to $' + dps.toFixed(2)
        : GameState._scripQ > 0 ? 'paid mostly in shares' : 'more shares in issue');

    const big = events.filter(e => e.tone === 'bad').map(e => plain(e.headline))[0];
    add_('One-offs', (cur.unusualItems || 0) - (prev.unusualItems || 0),
      (cur.unusualItems || 0) < (prev.unusualItems || 0) ? (big ? short(big) : 'a one-off cost') : 'last quarter\u2019s one-off did not repeat');

    return parts.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3);
  }

  // a worry that went away, said the way a person would
  function relief(x) {
    const R = [[/^a recession/, 'the recession is over'], [/^a slowing economy/, 'the economy picked up'],
               [/^(heavy|rising) debt/, 'debt came down'], [/^thin dividend cover|^dividend cover only/, 'dividend cover improved'],
               [/^the dividend is bigger/, 'cash profit covers the dividend again'], [/^you are losing cash/, 'back to positive cash flow'],
               [/^a junk credit rating/, 'credit rating upgraded']];
    const m = R.find(r => r[0].test(x));
    return m ? m[1] : 'less worry about ' + x.replace(/^(a |an |the )/, '');
  }

  function explainPrice() {
    const H = GameState.history || [], w = GameState._priceWhy, pw = GameState._priceWhyPrev;
    if (H.length < 2 || !w) return null;
    const from = H[H.length - 2].sharePrice, to = H[H.length - 1].sharePrice;
    const pct = from ? (to / from - 1) * 100 : 0;
    if (Math.abs(pct) < 1) return null;
    const bits = [];
    if (pw) {
      if (w.dividend > pw.dividend + 0.001) bits.push('a higher dividend');
      if (w.dividend < pw.dividend - 0.001) bits.push('a lower dividend');
      if (w.rate > pw.rate + 0.01) bits.push('interest rates up');
      if (w.rate < pw.rate - 0.01) bits.push('interest rates down');
      w.bad.filter(x => pw.bad.indexOf(x) === -1).slice(0, 2).forEach(x => bits.push(x));
      pw.bad.filter(x => w.bad.indexOf(x) === -1).slice(0, 1).forEach(x => bits.push(relief(x)));
    }
    if (!bits.length) {
      // nothing new: the price is still moving toward last quarter's verdict
      if ((w.fair - from) * pct > 0)
        return { from, to, pct: Math.round(pct), text: 'Still catching up with its fair value of about $' + w.fair.toFixed(2) + '.' };
      (pct < 0 ? w.bad : w.good).slice(0, 2).forEach(x => bits.push(x));
    }
    const text = 'Investors now want a ' + w.yieldWanted.toFixed(1) + '% dividend yield' +
      (bits.length ? ': ' + bits.join(', ') : '') + '. Fair value about $' + w.fair.toFixed(2) +
      (Math.abs(w.fair - to) / to > 0.04 ? '; the price drifts there over a few quarters.' : '.');
    return { from, to, pct: Math.round(pct), text };
  }

  /* -- decisions ------------------------------------------------------------ */
  function addDecision(evt) {
    pendingEvt = evt;
    const id = add({ kind: 'decision', title: String(evt.headline || evt.title || 'A decision').replace(/^[^A-Za-z0-9$]+/, ''), body: firstLine(evt.body), status: 'open',
                     from: evt.from || '', face: evt.face || '' });
    S().pendingId = id;
    render();
  }
  function firstLine(t) {
    const s = String(t || '').replace(/<[^>]+>/g, '').split(/\n/)[0];
    return s.length > 140 ? s.slice(0, 137) + '…' : s;
  }
  const pending = () => (S().pendingId ? pendingEvt : null);
  /* after loading a save (save.js): the decision was rebuilt from its card */
  function rebind(evt) {
    pendingEvt = evt;
    const it = S().items.find(i => i.id === S().pendingId);
    if (it) { it.title = evt.headline; it.body = firstLine(evt.body); it.from = evt.from || ''; it.face = evt.face || ''; }
    render();
  }
  function expirePending(msg) {
    const s = S(), it = s.items.find(i => i.id === s.pendingId);
    if (it) { it.status = 'done'; it.choice = 'No answer'; it.result = msg; }
    s.pendingId = null; pendingEvt = null;
    render();
  }
  /* -- on hold (2.0 round 7): "find the money first" ------------------------
     A decision you cannot afford yet can wait a few quarters. It stays pinned,
     does not block Advance, and lapses to its default choice if you never
     come back to it. */
  function hold(evt, n, lapseLabel) {
    const s = S(), it = s.items.find(i => i.id === s.pendingId); if (!it) return;
    it.status = 'held'; it.until = nowQ() + n; it.card = evt.id; it.lapseLabel = lapseLabel || '';
    heldEvts[it.id] = evt;
    s.pendingId = null; pendingEvt = null;
    render();
  }
  function heldEvt(id) {
    if (heldEvts[id]) return heldEvts[id];
    const it = S().items.find(i => i.id === id); if (!it || !window.World) return null;
    const c = World.DECISIONS.find(x => x.id === it.card);
    let e = null; try { e = c ? c.build() : null; } catch (err) { e = null; }
    if (e) { e.id = c.id; e.headline = e.title; e.isWorld = true; heldEvts[id] = e; }
    return e;
  }
  const heldItems = () => S().items.filter(i => i.kind === 'decision' && i.status === 'held');
  const heldDue = () => heldItems().filter(i => i.until <= nowQ());
  function resolveHeld(id, choiceLabel, resultMsg) {
    const it = S().items.find(i => i.id === id);
    if (it) { it.status = 'done'; it.choice = choiceLabel; it.result = resultMsg; it.read = true; }
    delete heldEvts[id];
    render();
  }

  function resolve(choiceLabel, resultMsg) {
    const s = S(), it = s.items.find(i => i.id === s.pendingId);
    if (it) { it.status = 'done'; it.choice = choiceLabel; it.result = resultMsg; it.read = true; }
    s.pendingId = null; pendingEvt = null;
    render();
  }

  /* -- render --------------------------------------------------------------- */
  function itemHTML(it) {
    const unread = it.read ? '' : '<span class="ib-dot" title="Unread"></span>';
    if (it.kind === 'decision') {
      if (it.status === 'open')
        return '<div class="ib ib-decision' + (it.face ? ' has-av' : '') + '" data-id="' + it.id + '">' + av(it) +
          '<div class="ib-tag">Needs your decision' + (it.from ? ' <span class="ib-tag-from">\u00b7 from ' + esc(it.from) + '</span>' : '') + '</div>' +
          '<div class="ib-title">' + esc(it.title) + '</div>' +
          (it.body ? '<div class="ib-body">' + esc(it.body) + '</div>' : '') +
          '<button class="ib-btn" data-act="decide">Decide</button></div>';
      if (it.status === 'held') {
        const left = it.until - nowQ();
        return '<div class="ib ib-decision ib-held' + (it.face ? ' has-av' : '') + '" data-id="' + it.id + '">' + av(it) +
          '<div class="ib-tag">On hold: decide ' + (left <= 0 ? 'this quarter' : 'within ' + left + ' qtr' + (left > 1 ? 's' : '')) + '</div>' +
          '<div class="ib-title">' + esc(it.title) + '</div>' +
          '<div class="ib-body">If you don\u2019t: ' + esc(it.lapseLabel || 'the offer lapses') + '</div>' +
          '<button class="ib-btn" data-act="decide-held" data-id="' + it.id + '">Decide</button></div>';
      }
      return '<div class="ib ib-decided" data-id="' + it.id + '">' +
        '<div class="ib-tag">Decided</div><div class="ib-title">' + esc(it.title) + '</div>' +
        '<div class="ib-body">' + esc(it.choice || '') + (it.result ? ' — ' + esc(it.result) : '') + '</div></div>';
    }
    if (it.kind === 'summary') {
      const good = it.rc >= 0;
      return '<div class="ib ib-summary ' + (good ? 'up' : 'down') + '">' +
        '<div class="ib-sum-row"><span class="ib-sum-k">' + esc(it.title) + '</span>' +
        '<span class="ib-sum-v">' + (good ? '▲ +' : '▼ ') + money(it.rc) + '</span></div>' +
        '<div class="ib-sum-d">Retained cash · ' + esc(it.detail) + '</div>' +
        (it.ytd ? '<div class="ib-ytd">Total return ' + (it.ytd.label === 'last year' ? 'last year' : 'this year so far') + ': <b class="' + (it.ytd.you >= it.ytd.sector ? 'up' : 'down') + '">' +
          (it.ytd.you >= 0 ? '+' : '\u2212') + Math.abs(it.ytd.you * 100).toFixed(1) + '%</b> (' + (it.ytd.bench === 'rivals' ? 'rivals average ' : 'REIT sector ') + (it.ytd.sector >= 0 ? '+' : '\u2212') + Math.abs(it.ytd.sector * 100).toFixed(1) + '%)' +
          (it.rank ? ' \u00b7 <b>' + ['1st', '2nd', '3rd', '4th'][it.rank - 1] + ' of 4</b>' : '') + '</div>' : '') +
        (it.why && it.why.length ? '<div class="ib-why"><div class="ib-why-h">vs last quarter, because</div>' + it.why.map(w =>
          '<div class="ib-why-r"><span class="' + (w.d >= 0 ? 'up' : 'down') + '">' + (w.d >= 0 ? '+' : '\u2212') + money(Math.abs(w.d)).replace('\u2212', '') +
          '</span> <b>' + esc(w.label) + '</b>' + (w.why ? ': ' + esc(w.why) : '') + '</div>').join('') + '</div>' : '') +
        (it.price ? '<div class="ib-why"><div class="ib-why-r"><span class="' + (it.price.pct >= 0 ? 'up' : 'down') + '">' +
          (it.price.pct >= 0 ? '+' : '\u2212') + Math.abs(it.price.pct) + '%</span> <b>Share price</b> $' + it.price.from.toFixed(2) + ' \u2192 $' + it.price.to.toFixed(2) +
          '. ' + esc(it.price.text) + '</div></div>' : '') +
        (it.actions && it.actions.length
          ? '<div class="ib-acts">' + it.actions.slice(0, 6).map(a => '<div>· ' + a + '</div>').join('') + '</div>' : '') +
        '</div>';
    }
    if (it.kind === 'macro') {        // round 17: the economy as a front page (the Ledger) or a central bank notice
      const fed = it.src === 'fed', more = it.more ? (S().open[it.id] ? '<div class="ib-more">' + esc(it.more) + '</div>' : '<span class="ib-more-k">read more \u25b8</span>') : '';
      return '<div class="ib ib-macro ib-src-' + (fed ? 'fed' : 'news') + ' ib-' + (it.tone || 'neutral') + (it.more ? ' has-more' : '') + '" data-id="' + it.id + '">' +
        '<div class="ib-mast"><img src="assets/icons/' + (fed ? 'fed' : 'newspaper') + '.png" alt="" onerror="this.style.display=\'none\'"><span>' + (fed ? 'Central Bank \u00b7 rate decision' : 'Riverton Ledger \u00b7 the economy') + '</span></div>' +
        '<div class="ib-head">' + esc(String(it.title).replace(/^[^A-Za-z0-9$]+/, '').replace(/^(CRISIS|AFTERSHOCK) \u2014 /, '$1: ')) + '</div>' +
        (it.factors && it.factors.length ? '<ul class="ib-factors">' + it.factors.map(f => '<li>' + f + '</li>').join('') + '</ul>' : '') + more + '</div>';
    }
    if (it.kind === 'event') {
      const more = it.more ? (S().open[it.id] ? '<div class="ib-more">' + esc(it.more) + '</div>' : '<span class="ib-more-k">read more \u25b8</span>') : '';
      return '<div class="ib ib-event ib-' + (it.tone || 'neutral') + (it.more ? ' has-more' : '') + '" data-id="' + it.id + '">' +
        '<div class="ib-title">' + it.title + '</div>' +
        (it.body ? '<div class="ib-body">' + it.body + '</div>' : '') + more + '</div>';
    }
    // message
    const open = S().open[it.id];
    return '<div class="ib ib-msg' + (open ? ' open' : '') + (it.read ? '' : ' unread') + (it.face ? ' has-av' : '') + '" data-id="' + it.id + '">' + av(it) +
      '<div class="ib-from">' + unread + esc(it.from) + (it.role ? ' <span>· ' + esc(it.role) + '</span>' : '') + '</div>' +
      '<div class="ib-title">' + esc(it.title) +
        (it.task ? (taskDone(it.task) ? ' <span class="ib-chip ok">\u2713 Done</span>' : ' <span class="ib-chip todo">To do</span>') : '') + '</div>' +
      '<div class="ib-body">' + it.body + '</div></div>';
  }

  /* -- on the clock --------------------------------------------------------
     Things with a timer or a threshold, computed live from GameState so they
     can never go stale. Only things the player can still act on or should
     plan around; no nagging about settled matters. */
  function pendingRows() {
    const G = GameState, rows = [], q = G.meta.quarter;
    const now = (G.meta.year - 1) * 4 + q;
    const qs = n => n <= 0 ? 'this quarter' : n === 1 ? '1 qtr' : n + ' qtrs';
    // loans falling due within a year
    (G.debtTranches || []).forEach(t => {
      const left = ((t.maturityYear - 1) * 4 + t.maturityQuarter) - now;
      if (left < 0 || left > 4) return;
      // round 18: say how it will be paid when it falls due
      const spend = window.Revolver && G.revolver ? Revolver.spendable() : G.balance.cash;
      rows.push({ tone: t.amount > spend ? 'bad' : t.amount > G.balance.cash ? 'warn' : '',
        k: 'Bond ' + money(t.amount) + ' due' + (t.amount > spend ? ': NOT enough even with the credit line. Unpaid, it is a default: refinance with a new bond, sell or raise shares' : t.amount > G.balance.cash ? ': part will come from the credit line' : ': repaid from cash'), v: qs(left) });
    });
    // Jenkins's Year 1 checklist
    const asked = S().items.filter(i => i.task);
    if (G.meta.year === 1 && asked.length) {
      const d = asked.filter(i => taskDone(i.task)).length;
      if (d < asked.length) rows.push({ tone: '', k: 'Jenkins\u2019s first steps', v: d + ' of ' + asked.length + ' done' });
    }
    // decisions on hold, and the story's clocks (story.js)
    heldItems().forEach(i => rows.push({ tone: 'warn', k: 'On hold: ' + i.title, v: qs(i.until - now) }));
    if (window.Story && Story.clockRows) Story.clockRows().forEach(r => rows.push(r));
    if (window.IndexFund) IndexFund.clockRows().forEach(r => rows.push(r));
    // the credit line (revolver.js)
    if (window.Revolver && G.revolver) Revolver.clockRows().forEach(r => rows.push(r));
    // two strikes (round 4)
    if (G.board && G.board.probation) rows.push({ tone: 'bad', k: 'On probation: lose the next board vote and you are out', v: 'in ' + qs(5 - q) });
    // annual board vote (from the end of Year 2)
    if (G.meta.year >= 2) rows.push({ tone: q === 4 ? 'warn' : '', k: 'Annual board vote', v: q === 4 ? 'after this quarter' : 'in ' + qs(5 - q) });
    // building works
    (G.portfolio || []).filter(p => p.underConstruction).forEach(p => rows.push({ tone: '',
      k: p.name + ': ' + (p.constructionType === 'redevelopment' ? 'redevelopment' : p.constructionType || 'works') + ', no rent', v: qs(p.constructionQuartersLeft) + ' left' }));
    // big leases ending soon
    (G.portfolio || []).forEach(p => (p.lease && p.lease.positions || []).forEach(pos => {
      const t = G.tenants && G.tenants[pos.t];
      if (!pos.vacant && t && pos.share >= 0.2 && pos.q <= 2) rows.push({ tone: 'warn', k: t.name + ' lease at ' + p.name + ' ends', v: qs(pos.q) });
    }));
    // deck-2 timers
    if (G._scripQ > 0) rows.push({ tone: '', k: 'Dividend paid 90% in shares', v: qs(G._scripQ) + ' left' });
    if (G._deferRepay) rows.push({ tone: 'good', k: 'Deferred rent coming back, ' + money(G._deferRepay.per) + '/qtr', v: qs(G._deferRepay.left) + ' left' });
    if (G._inIndex) {
      const y = G.company.sharePrice > 0 ? G.company.dividendPerShare * 4 / G.company.sharePrice * 100 : 0;
      rows.push({ tone: y < 5 ? 'bad' : '', k: 'High-yield index: your yield ' + y.toFixed(1) + '%', v: 'floor 4.5%' });
    }
    if (G.credit && G.credit.upgradeLockQ > 0) rows.push({ tone: '', k: 'Rating frozen at ' + G.credit.rating, v: qs(G.credit.upgradeLockQ) + ' left' });
    if (G._contam) rows.push({ tone: 'bad', k: 'Leaking tank at ' + G._contam.name + ', unreported', v: 'any quarter' });
    return rows;
  }
  function pendingHTML() {
    const rows = pendingRows();
    if (!rows.length) return '';
    return '<div class="ib-pend"><div class="ib-pend-h">On the clock</div>' +
      rows.map(r => '<div class="ib-pr ' + (r.tone ? 'pr-' + r.tone : '') + '"><span>' + esc(r.k) + '</span><b>' + esc(r.v) + '</b></div>').join('') +
      '</div>';
  }

  /* Within a turn: results first (what happened), then people, then any
     decision already answered. */
  const ORDER = { macro: -1, summary: 0, event: 1, message: 2, decision: 3 };

  function render() {
    const list = document.getElementById('inbox-list');
    if (!list || !window.GameState) return;
    checkTasks();
    const s = S(), now = turn();

    // open decision pinned on top, outside the turn groups
    const pin = s.items.find(i => i.id === s.pendingId);
    const held = heldItems();
    let html = (pin ? itemHTML(pin) : '') + held.map(itemHTML).join('') + pendingHTML();

    const turns = [...new Set(s.items.filter(i => i !== pin && held.indexOf(i) === -1).map(i => i.turn))].sort((a, b) => b - a);
    if (!turns.length && !pin)
      html += '<div class="ib-empty">Nothing yet. Make your moves, then press <strong>Advance quarter</strong>.</div>';

    // round 9: only the latest turn. Older quarters were a pile of collapsed rows nobody opened.
    turns.slice(0, 1).forEach((t, idx) => {
      const its = s.items.filter(i => i.turn === t && i !== pin && held.indexOf(i) === -1)
        .sort((a, b) => (ORDER[a.kind] - ORDER[b.kind]) || (b.id - a.id));   // round 24: newest on top, like an email inbox
      const collapsed = idx > 0 && !s.open['t' + t];
      const sum = its.find(i => i.kind === 'summary');
      html += '<div class="ib-turn' + (collapsed ? ' shut' : '') + '" data-turn="' + t + '">' +
        '<div class="ib-turn-h">' + (t === now ? 'This turn · ' : '') + turnLabel(t) +
          (collapsed ? '<span class="ib-turn-n">' + its.length + ' items' +
            (sum ? ' · ' + (sum.rc >= 0 ? '+' : '') + money(sum.rc) : '') + '</span>' : '') +
        '</div>' +
        (collapsed ? '' : its.map(itemHTML).join('')) + '</div>';
    });
    list.innerHTML = html;

    // header count + Map tab badge: unread messages and open decisions only.
    const n = s.items.filter(i => (i.kind === 'message' && !i.read)).length + (pin ? 1 : 0);
    const cnt = document.getElementById('inbox-count');
    if (cnt) {
      cnt.textContent = n ? n + ' new \u00b7 mark read' : '';
      cnt.title = 'Mark all messages as read';
      cnt.onclick = () => { S().items.forEach(i => { if (i.kind === 'message') i.read = true; }); render(); };
    }
    const tab = document.querySelector('.tb-tab[data-view="map"]');
    if (tab) {
      let b = tab.querySelector('.tb-badge');
      if (n && !b) { b = document.createElement('span'); b.className = 'tb-badge'; tab.appendChild(b); }
      if (b) { if (n) b.textContent = n; else b.remove(); }
    }

    // Advance button: blocked while a decision waits
    const adv = document.getElementById('btn-advance-quarter');
    if (adv) {
      adv.classList.toggle('tb-wait', !!pin);
      adv.innerHTML = pin ? 'Decide first ▸' : 'Advance quarter ▸';
    }
    wire(list);
  }

  function wire(list) {
    list.querySelectorAll('.ib-btn[data-act="decide"]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      if (window.UI && UI.openPendingDecision) UI.openPendingDecision();
    });
    list.querySelectorAll('.ib-btn[data-act="decide-held"]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      if (window.UI && UI.openHeldDecision) UI.openHeldDecision(+b.dataset.id);
    });
    list.querySelectorAll('.ib-event.has-more, .ib-macro.has-more').forEach(m => m.onclick = () => { const s = S(), id = +m.dataset.id; s.open[id] = !s.open[id]; render(); });
    list.querySelectorAll('.ib-msg').forEach(m => m.onclick = () => {
      const s = S(), id = +m.dataset.id, it = s.items.find(i => i.id === id);
      if (it) it.read = true;
      s.open[id] = !s.open[id];
      render();
    });
    list.querySelectorAll('.ib-turn.shut .ib-turn-h, .ib-turn .ib-turn-h').forEach(h => h.onclick = () => {
      const t = h.parentElement.dataset.turn, s = S(), now = turn();
      const top = Math.max(...S().items.map(i => i.turn));
      if (+t === top) return;                     // newest turn is always open
      s.open['t' + t] = !s.open['t' + t];
      render();
    });
  }

  return { add, message, ingestReport, addDecision, pending, resolve, render, pendingRows, rebind, expirePending,
           hold, heldEvt, heldDue, heldItems, resolveHeld };
})();
