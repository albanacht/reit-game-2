/* ============================================================================
   journal.js — THE DEALROOM (round 22; the Stories tab of round 20). window.Journal

   One card per story you have met: who, where it stands now, what comes next
   (or what you can do about it), and a short timeline. Stories you have not
   met yet stay hidden: no spoilers. Read-only: everything comes from the
   stories' own state (story.js, war.js, tower.js, gary.js, port.js,
   listing.js, levi.js).
   ========================================================================== */

window.Journal = (() => {

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const money = n => '$' + Math.abs(n || 0).toFixed(Math.abs(n || 0) >= 10 ? 0 : 1) + 'M';
  const yq = q => 'Y' + (Math.floor((q - 1) / 4) + 1) + ' Q' + (((q - 1) % 4) + 1);
  const FACE = k => 'assets/faces/' + k + '.jpg';
  const pc = n => Math.round((n || 0) * 100) + '%';

  /* Each returns null (not met yet) or { title, face, status, now, next, log } */
  function harlow() {
    if (!window.Story || !Story.H) return null;
    const h = Story.H(), L = h.loan, R = {
      healthy: 'Harlow is doing fine. The sale and leaseback worked.', survived: 'Harlow survived without your money.', repaid: 'Bob repaid the loan in full.',
      refinanced: 'Harlow refinanced elsewhere and repaid you.', partial: 'Harlow sold stores and repaid most of the loan.', bust: 'Harlow Grocers went bankrupt.',
      fizzled: 'Harlow stayed small; the story faded.', passed_ok: 'You passed on the centre. Harlow did fine without you.', passed_bust: 'You passed on the centre. Harlow went bust anyway.' };
    if (h.stage === 'wait') return null;
    const S = {
      offer: ['Bob Harlow offered to sell you his distribution centre and lease it back.', 'Decide: buy it (cash, credit line or preferred shares) or pass.'],
      owned: ['You own the Harlow Distribution Centre, let back to Harlow Grocers for 15 years.', 'Watch Harlow’s rent cover (Properties, the centre, its tenant).'],
      news: ['You own the centre. Harlow is expanding fast.', 'Watch Harlow’s rent cover.'],
      late: ['Harlow is paying the rent late.', 'Bob will ask the board for a loan at the next meeting.'],
      ask: ['Bob is asking the board for a loan.', 'Decide at the meeting: lend, or refuse.'],
      loan: ['You lent Harlow ' + money(L && L.amt) + ' at 10%' + (L && L.dueYear ? ', due at the Year ' + L.dueYear + ' meeting' : '') + '.', 'Each meeting the board reviews the loan. Harlow’s rent cover decides whether Bob repays.'],
      decide: ['Harlow missed a payment.', 'A decision waits in your inbox.'],
      refused: ['You refused Bob’s loan.', 'Harlow is on its own now. It may not survive.'],
      aftermath: ['Harlow went bust. The centre is empty.', 'Find a new tenant.'], relet: ['Re-letting the empty centre.', 'Your Asset Manager (or Jenkins) is looking for a tenant.'],
      reletAsk: ['A new tenant is interested in the centre.', 'Decide in your inbox.'], ramp: ['A new tenant moved in; the rent is stepping up.', 'Nothing to do.'],
    }[h.stage];
    const done = h.stage === 'done';
    return { title: 'Bob Harlow', face: FACE('bob'), status: done ? 'Ended' : 'Active', now: done ? (R[h.result] || 'The story is over.') : (S ? S[0] : h.stage), next: done ? '' : (S ? S[1] : ''), log: [] };
  }
  function war() {
    if (!window.War) return null;
    const w = War.W(), E = { takeover: 'You took Rennick over.', truce: 'A truce: the war is over.', prey: 'Kessler took you over.', none: 'You let Kessler have Morrow Plaza. No war.' };
    if (w.stage === 'wait') return null;
    let now, next = '';
    if (w.stage === 'bid') { now = 'The auction for Morrow Plaza.'; next = 'Bid at the meeting.'; }
    else if (w.stage === 'war') {
      now = 'At war with Rennick Capital. Heat ' + Math.round(w.heat || 0) + '/100.' + (w.leaked ? ' The leak is out.' : '') + (w.audited ? ' The short report is out.' : '');
      next = !w.leaked ? 'Expect Kessler’s first leak in the press soon.' : !w.audited ? 'Expect a second, bigger attack.' : 'Kessler keeps jabbing. Your weapons are on Rennick’s profile (Board, the league). When rates bite he will crack.';
    } else if (w.stage === 'crisis') {
      const pn = window.Rivals && Rivals.pnav ? Rivals.pnav('ren') : 0;
      now = 'Rennick is cracking: debt ' + pc(window.Rivals ? Rivals.d2a('ren') : 0) + ' of assets, price ' + pc(pn) + ' of NAV.';
      next = 'Block his sales (Rennick’s profile). Below 60% of NAV, Chen moves the takeover at the meeting.';
    } else now = E[w.ending] || 'The war is over.';
    if ((w.stake || 0) > 0 && w.stage !== 'done') now += ' Kessler owns ' + w.stake.toFixed(1) + '% of you.';
    return { title: 'The Rennick war', face: FACE('ceo_ren'), status: w.stage === 'done' ? 'Ended' : 'Active', now, next, log: w.log || [] };
  }
  function tower() {
    if (!window.Tower) return null;
    const t = Tower.T(), p = Tower.tower && Tower.tower();
    if (t.stage === 'wait') return null;
    const S = {
      nephew: ['Williams brought in his nephew, Sebastian.', 'Sebastian will present his big idea at the next meeting.'],
      task: ['The board is deciding on Celestial Heights.', ''],
      plot: ['The board wants Celestial Heights built.', 'Buy the Fifth Street lot (inbox).'],
      finance: ['The lot is yours.', 'Choose how to pay for the build (inbox).'],
      build: ['Under construction: ' + (t.qLeft || 0) + ' quarter' + (t.qLeft === 1 ? '' : 's') + ' left, ' + money(t.cost) + ' spent so far.', 'Bills arrive every quarter. Calder & Rowe may want to pre-let at a meeting.'],
      open: ['Celestial Heights is open: ' + (p ? pc(p.occupancy) : '') + ' let' + (t.road === 'A' ? ', into a pandemic' : '') + '.', 'The board decides what to do with it at the next meeting.'],
      held: ['Celestial Heights: ' + (p ? pc(p.occupancy) : '') + ' let, valued ' + money(p && p.currentValue) + ' against ' + money(t.cost) + ' of cost.', t.road === 'A' ? 'Waiting for the pandemic to pass.' : t.success ? 'Leasing up: at 90% it becomes a trophy.' : 'Leasing up slowly.'],
      convert: ['Converting the office floors to apartments.', 'About ' + (t.convQ || 0) + ' quarters to go.'],
    }[t.stage];
    const E = { trophy: 'Celestial Heights is a trophy tower, nearly full.', sold: 'You sold the tower.', never: 'You refused to build it.', apartments: 'The tower is apartments now.', converted: 'The tower is apartments now.' };
    const done = !S;
    const chair = t.williamsGone ? ' Williams ' + (t.williamsGone === 'fell' ? 'fell' : 'retired') + (t.chair ? '; ' + (t.chair === 'you' ? 'you are executive chairman' : Directors.name(t.chair) + ' chairs the board') : '') + '.' : '';
    return { title: 'Celestial Heights', face: FACE('sebastian'), status: done ? 'Ended' : 'Active', now: (done ? (E[t.ending] || E[t.stage] || 'The story is over.') : S[0]) + chair, next: done ? '' : S[1], log: t.log || [] };
  }
  function gary() {
    if (!window.Gary) return null;
    const g = Gary.S();
    if (g.stage === 'wait') return null;
    const S = {
      offer: ['Gary wants to manage your buildings, and offers you 40% of his firm.', 'Decide in your inbox.'],
      vote: ['You own 40% of Lakeside. The contract goes to the board.', 'The independent directors vote at the next meeting.'],
      run: ['Lakeside manages your buildings' + (g.stake > 0 ? '. Your 40% has paid you ' + money(g.earned) + ' so far.' : '.'), g.page212 ? (g.stake > 0 ? 'From Year 10, someone may buy Lakeside.' : 'Nothing to do.') : 'Sooner or later someone reads page 212 of the proxy statement.'],
    }[g.stage];
    const E = { sold: 'Gary sold Lakeside' + (g.sold ? '; your 40% came to ' + money(g.sold) : '') + '.', ended: 'You ended Lakeside’s contract.', voted_down: 'The board turned Gary down.', tender: 'Gary lost the open tender.' };
    return { title: 'Gary, your brother-in-law', face: FACE('gary'), status: S ? 'Active' : 'Ended', now: S ? S[0] : (E[g.stage] || 'Over.'), next: S ? S[1] : '', log: g.log || [] };
  }
  function port() {
    if (!window.Port) return null;
    const p = Port.P();
    if (p.stage === 'wait') return null;
    const S = { pitched: ['Chen wants Port Logistics.', 'Decide at the meeting.'], scheme: ['The fire marshal is at Port Logistics.', 'Eleanor will sell, hold, or it leaks: within a quarter or two.'],
                offer: ['Eleanor is selling Port Logistics at 15% off.', 'Decide in your inbox.'], suit: ['Wexmoor is suing you.', 'The board decides at the next meeting: settle, fight or blame.'],
                owned: ['Port Logistics is yours. Atlas pays on time.', 'For three years the emails could still come out.'] };
    const E = { held: 'Eleanor kept Port Logistics.', walked: 'You walked away.', settled: 'You settled with Wexmoor.', won: 'You won the case.', lost: 'You lost the case.', blamed: 'You blamed a director and settled.', declined: 'You said no to Chen’s plan.' };
    const s = S[p.stage];
    return { title: 'Port Logistics (Eleanor)', face: FACE('ceo_wex'), status: s ? 'Active' : 'Ended', now: s ? s[0] : (E[p.stage] || 'Over.'), next: s ? s[1] : '', log: p.log || [] };
  }
  function index() {
    if (!window.IndexFund) return null;
    const x = IndexFund.X();
    if (!x.told) return null;
    const T = IndexFund.tests(), n = T.filter(t => t.ok).length;
    const now = x.stage === 'in' ? 'You are in the ' + IndexFund.INDEX + '.' : x.stage === 'candidate' ? 'Analysts call you a candidate.' : 'Not in the ' + IndexFund.INDEX + (x.dropped ? ' (dropped once)' : '') + '.';
    return { title: 'The ' + IndexFund.INDEX, face: FACE('dahl'), status: 'Active', now: now + ' ' + n + ' of 3 tests met.', next: 'Reviews at the end of Q2 and Q4. ' + T.map(t => (t.ok ? '✓ ' : '✗ ') + t.k + ' (' + t.v + ')').join(' · '), log: x.log || [] };
  }
  /* round 33: the mayor's floors (mayor.js) */
  function mayor() {
    if (!window.Mayor) return null;
    const m = Mayor.M();
    if (m.stage === 'wait' || m.stage === 'none') return null;
    if (m.stage === 'offer') return { title: 'The mayor\u2019s floors', face: FACE('mayor'), status: 'Active', now: 'Frank Kowalczyk wants four floors for City Hall.', next: 'Decide in your inbox.', log: m.log || [] };
    const C = { clean: 'The city rents four floors at its budget rate.', sweet: 'The city pays 20% over market. $0.5M went to Frank\u2019s campaign.', skim: 'His cousin did the fit-out. You gave four well-paid speeches.', refuse: 'You turned Frank down.' }[m.choice] || '';
    if (!m.invDone) return { title: 'The mayor\u2019s floors', face: FACE('mayor'), status: 'Active', now: C, next: m.choice === 'clean' ? 'Nothing to worry about.' : 'An inquiry into City Hall\u2019s leases is coming, within a year or so.', log: m.log || [] };
    const R = m.choice === 'refuse' ? 'The inquiry made you "the only landlord who said no".' : m.choice === 'clean' ? 'The inquiry found nothing.' : m.exposed ? 'The inquiry found it.' + (m.fine ? ' You paid a ' + money(m.fine) + ' fine.' : ' The rent was cut to market.') : 'The inquiry never found it.';
    return { title: 'The mayor\u2019s floors', face: FACE('mayor'), status: 'Ended', now: C + ' ' + R, next: '', log: m.log || [] };
  }
  function levi() {
    if (!window.Levi) return null;
    const l = Levi.L();
    if (l.stage === 'wait' || l.stage === 'offered' || l.stage === 'letter') return null;
    if (l.stage !== 'hired') return { title: 'Dr. Levi Cohen', face: FACE('levi'), status: 'Ended', now: l.stage === 'quit' ? 'Levi resigned to write a paper about you.' : 'You passed on Levi. He works for Wexmoor.', next: '', log: l.log || [] };
    const m = l.ch && !l.ch.done ? Levi.metric(l.ch.id) : null;
    return { title: 'Dr. Levi Cohen', face: FACE('levi'), status: 'Active', now: 'Strategy advisor. ' + l.hits + ' challenge' + (l.hits === 1 ? '' : 's') + ' met, ' + l.misses + ' missed (three misses and he leaves).',
             next: m ? 'His challenge: ' + m.name + ', now ' + m.val().toFixed(3) + ', target ' + l.ch.target.toFixed(3) + ' by the next meeting. (Jenkins: "' + m.hint + '".)' : 'He forecasts crises in your inbox.', log: l.log || [] };
  }

  /* round 30: the old yard (gary.js) */
  function yard() {
    if (!window.Gary || !Gary.Y) return null;
    const y = Gary.Y(); if (y.stage === 'wait') return null;
    const now = { offer: 'Gary wants the REIT to buy the family scrap yard (' + money(y.value) + ').', declined: 'The independent directors said no to the yard.', refused: 'You kept the family yard out of the company.',
                  done: 'The REIT bought the yard for ' + money(y.price) + ' (value ' + money(y.value) + '). Your half of the premium: ' + money(y.mine) + '.' + (y.exposed ? ' The Ledger found it.' : '') }[y.stage] || '';
    const next = y.stage === 'offer' ? 'Decide in your inbox.' : y.stage === 'done' && !y.exposed ? 'For two years Nora Whitlock could still find it.' : '';
    return { title: 'The old yard', face: FACE('gary'), status: y.stage === 'offer' || (y.stage === 'done' && !y.exposed) ? 'Active' : 'Ended', now, next, log: [] };
  }
  function entries() { return [harlow(), war(), tower(), gary(), yard(), port(), mayor(), index(), levi()].filter(Boolean); }

  /* -- round 22: the Dealroom. Deals, cases (agents.js), stories, influence. -- */
  function agentBtn(id) {
    if (!window.Agents) return '';
    const w = Agents.who(id);
    return w ? '<span class="dr-ag">' + Agents.face(w) + ' ' + esc(w.name) + ' is on it</span>'
             : '<button class="btn btn-secondary btn-sm" data-case="' + id + '">Put someone on it</button>';
  }
  function dealsHTML() {
    if (!window.Deals) return '';
    const R = Deals.rows(), done = Deals.recent();
    const row = r => '<div class="dr-row"><div class="dr-main"><b>' + esc(r.title) + '</b><div class="sml-note">' + esc(r.now) + '</div></div><div class="dr-acts">' +
      (r.kind !== 'listing' ? agentBtn(r.id) : '') +
      (r.canWithdraw ? ' <button class="btn btn-secondary btn-sm" data-wd="' + r.id + '">Withdraw</button>' : '') +
      (r.canPlan ? ' <button class="btn btn-primary btn-sm" data-plan="' + r.id + '">Start building</button>' : '') + '</div></div>';
    return '<div class="jr-sec">Deals in progress</div>' +
      (R.length ? R.map(row).join('') : '<p class="text-muted">No deals running. Make an offer for any building from the map or Properties; bid for land on the map (the orange + markers).</p>') +
      (done.length ? '<div class="dr-done">' + done.map(d => '<div><span>' + yq(d.q) + '</span> ' + esc(d.result || (d.stage === 'won' ? 'Won ' + d.name : 'Lost ' + d.name)) + '</div>').join('') + '</div>' : '');
  }
  /* round 31: building works (renovation, repositioning) and tenants to watch */
  function worksHTML() {
    const G = GameState, rows = [];
    (G.portfolio || []).filter(p => p.underConstruction && (p.constructionType === 'renovation' || p.constructionType === 'repositioning')).forEach(p => {
      const ren = p.constructionType === 'renovation';
      rows.push('<div class="dr-row"><div class="dr-main"><b>' + (ren ? 'Renovating ' : 'Repositioning ') + esc(p.name) + '</b><div class="sml-note">' + p.constructionQuartersLeft + ' quarter' + (p.constructionQuartersLeft === 1 ? '' : 's') + ' left, offline meanwhile. ' +
        (ren ? 'Reopens with rent +15%, more of it let, and it ages slower for 4 years.' : 'Reopens as ' + esc(p.targetSector || 'a new use') + '.') + '</div></div></div>');
    });
    return rows.length ? '<div class="jr-sec">Building works</div>' + rows.join('') : '';
  }
  function tenantsHTML() {
    const G = GameState, rows = [];
    if (window.Tenants && Tenants.myTopTenants) Tenants.myTopTenants().filter(t => t.coverage != null && t.coverage < 1.5).forEach(t => {
      const where = Tenants.buildingsOf(t.id).filter(p => (G.portfolio || []).indexOf(p) > -1).map(p => p.name).join(', ');
      rows.push('<div class="dr-row dr-warn"><div class="dr-main"><b>' + esc(t.name) + '</b> <span class="sml-note">' + esc(where) + ' · ' + t.pct.toFixed(1) + '% of your rent</span><div class="sml-note">Rent cover ' + t.coverage.toFixed(1) + 'x' + (t.trend < 0 ? ', falling' : t.trend > 0 ? ', improving' : '') + '. ' +
        (t.coverage < 1 ? 'Paying you from savings: a default is a real risk.' : 'On watch: one bad year from trouble.') + '</div></div></div>');
    });
    (G.portfolio || []).forEach(p => (p.lease ? p.lease.positions : []).filter(x => x.vacant).forEach(x => {
      rows.push('<div class="dr-row"><div class="dr-main"><b>Empty space at ' + esc(p.name) + '</b><div class="sml-note">$' + (p.annualNOI * x.share).toFixed(1) + 'M a year of rent dark. Re-letting: about ' + Math.max(1, x.relet || 1) + ' quarter' + ((x.relet || 1) === 1 ? '' : 's') + ' to go' + (window.Staff && Staff.hasRole('asset') ? '' : ' (an Asset Manager would speed it up)') + '.</div></div></div>');
    }));
    (G.portfolio || []).filter(p => p.rentFactor != null && p.rentFactor < 1).forEach(p => {
      rows.push('<div class="dr-row"><div class="dr-main"><b>New tenant at ' + esc(p.name) + '</b><div class="sml-note">Rent stepping up: ' + Math.round(p.rentFactor * 100) + '% of the full rent collected now, rising each quarter.</div></div></div>');
    });
    return rows.length ? '<div class="jr-sec">Tenants to watch</div>' + rows.join('') : '';
  }
  function casesHTML() {
    if (!window.Agents) return '';
    const C = Agents.storyCases();
    if (!C.length) return '';
    return '<div class="jr-sec">Cases: put someone on it</div>' + C.map(c => {
      const w = Agents.who(c.id);
      return '<div class="dr-row"><div class="dr-main"><b>' + esc(c.title) + '</b><div class="sml-note">' + (w ? esc(c.effect(w.s)) : 'Assign a staff member (a bonus), a director (political capital) or a specialist (a fee).') + '</div></div><div class="dr-acts">' + agentBtn(c.id) + '</div></div>';
    }).join('');
  }
  function influenceHTML() {
    const b = (window.GameState && GameState.board) || {}, pcap = b.politicalCapital || 0, max = b.maxCapital || 8;
    const gala = b.galaYear === GameState.meta.year;
    const camp = window.PR ? PR.active() : [];
    return '<div class="jr-sec">Influence</div><div class="dr-row"><div class="dr-main"><b>Political capital: ' + pcap + ' / ' + max + '</b>' +
      '<div class="sml-note">Earned at board meetings and in stories. Spent on bank favours (Finance), trades with directors, story choices, and directors working your cases.</div></div>' +
      '<div class="dr-acts"><button class="btn btn-secondary btn-sm" id="dr-gala"' + (gala || pcap >= max ? ' disabled' : '') + '>' + (gala ? 'Gala held this year' : 'Host a charity gala: $0.5M for +1') + '</button></div></div>' +
      '<div class="dr-row"><div class="dr-main"><b>Campaigns</b><div class="sml-note">' +
      (camp.length ? camp.map(c => esc(c.name) + ' (' + (c.lift >= 0 ? '+' : '−') + Math.abs(c.lift * 100).toFixed(1) + '% on the share price, ' + (c.until - ((GameState.meta.year - 1) * 4 + GameState.meta.quarter)) + ' qtrs left)').join('; ')
                   : 'None running. Sponsorships and PR offers arrive in your inbox every year or so (more often with a Head of IR).') + '</div></div></div>';
  }
  function render() {
    const box = document.getElementById('stories-body'); if (!box || !window.GameState) return;
    const all = entries(), act = all.filter(e => e.status === 'Active'), done = all.filter(e => e.status !== 'Active');
    const card = e => '<div class="jr-card' + (e.status === 'Active' ? '' : ' jr-done') + '"><img src="' + e.face + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
      '<div class="jr-main"><div class="jr-h"><b>' + esc(e.title) + '</b><span class="jr-chip">' + esc(e.status) + '</span></div>' +
      '<div class="jr-now">' + esc(e.now) + '</div>' + (e.next ? '<div class="jr-next"><b>Next:</b> ' + esc(e.next) + '</div>' : '') +
      (e.log && e.log.length ? '<div class="jr-log">' + e.log.slice(-5).map(x => '<div><span>' + yq(x.q) + '</span> ' + esc(x.t) + '</div>').join('') + '</div>' : '') + '</div></div>';
    // round 25: the ending is the prize; say so where the stories live
    const left = Math.max(0, 15 - GameState.meta.year), eg = window.Ending && Ending.gallery ? Object.keys(Ending.gallery().main).length : 0;
    const head = '<div class="dr-end">Year ' + Math.min(15, GameState.meta.year) + ' of 15. ' + (left ? 'Your ending is being written by what you do here: every story below has its own last page.' : 'The last year. Your ending is close.') +
      (window.Ending ? ' <span>Endings found: ' + eg + ' of ' + Ending.ALL.length + '</span>' : '') + '</div>';
    box.innerHTML = head + dealsHTML() + worksHTML() + casesHTML() + tenantsHTML() +
      '<div class="jr-sec">Stories</div>' + (act.length ? act.map(card).join('') : '<p class="text-muted">No stories yet. They start at board meetings and in your inbox.</p>') +
      (done.length ? '<div class="jr-sec">Finished stories</div>' + done.map(card).join('') : '') +
      influenceHTML() +
      '<p class="sml-note" style="margin-top:10px">More stories will find you. Stories you have not met yet stay hidden.</p>';
    const after = () => render();
    box.querySelectorAll('[data-case]').forEach(b => b.onclick = () => Agents.openPicker(b.dataset.case, after));
    box.querySelectorAll('[data-wd]').forEach(b => b.onclick = () => { const r = Deals.withdraw(b.dataset.wd); if (window.UI) { UI.showToast(r.message, r.success ? 'success' : 'error'); UI.renderAll(); } render(); });
    box.querySelectorAll('[data-plan]').forEach(b => b.onclick = () => Deals.openPlan(b.dataset.plan));
    const g = document.getElementById('dr-gala');
    if (g) g.onclick = () => { const r = Board.hostGala(); if (window.UI) { UI.showToast(r.message, r.success ? 'success' : 'error'); UI.renderAll(); } render(); };
  }
  const activeCount = () => entries().filter(e => e.status === 'Active').length;

  return { render, entries, activeCount };
})();
