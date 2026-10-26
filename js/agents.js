/* ============================================================================
   agents.js — PUT SOMEONE ON IT (round 22). window.Agents

   Crusader Kings style: every risky case (a story roll, an offer, a land
   auction, a building site) can have ONE person assigned to it.
     your staff      paid a bonus (about a quarter's salary); skill counts
     a director      paid in political capital (Williams 2, others 1);
                     not while they are Unhappy or Furious with you
     a specialist    an outside hire for a fee
   A person works one case at a time. Story cases last a year; deals last
   until they close. The help is a strength s (0.10 to 0.45):
     a risk becomes      risk x (1 - s)          (never below 3%)
     a chance becomes    chance + (1 - chance) x s   (never above 97%)
   so nothing is ever certain. Each case module asks Agents.strength(id).
   ========================================================================== */

window.Agents = (() => {

  const fmt = n => Math.round(n * 100) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const money = n => '$' + Math.abs(n).toFixed(Math.abs(n) >= 10 ? 0 : 1) + 'M';
  const tq = () => (GameState.meta.year - 1) * 4 + GameState.meta.quarter;
  const pc = p => Math.round(p * 100) + '%';
  const A = () => GameState.agents || (GameState.agents = { on: {}, log: [] });
  const cap = () => (GameState.board && GameState.board.politicalCapital) || 0;
  const spendable = () => (window.Revolver && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash;
  const oneOff = d => { GameState._pendingUnusual = fmt((GameState._pendingUnusual || 0) - d); };

  /* What kind of work each case is. */
  const CAT = { deal: 'buying a building', lot: 'a land auction', dev: 'a building site', build: 'construction', loan: 'a troubled loan',
                leak: 'keeping a secret', press: 'a press fight', pay: 'a shareholder vote' };

  /* Who is good at what (fit 0..0.45). */
  const STAFF_FIT = {
    acquisitions: { deal: 0.35, lot: 0.35, dev: 0.10 },
    ir:           { press: 0.35, pay: 0.35, leak: 0.30 },
    cfo:          { loan: 0.30, deal: 0.15, build: 0.15, dev: 0.15 },
    financial:    { loan: 0.30, deal: 0.15, build: 0.15, dev: 0.15 },
    asset:        { dev: 0.30, loan: 0.20, deal: 0.10 },
    operations:   { build: 0.35, dev: 0.30 },
  };
  const DIR_FIT = {
    tex:      { lot: 0.35, deal: 0.25, leak: 0.25, build: 0.20, press: 0.15 },
    chen:     { deal: 0.30, lot: 0.25, dev: 0.15 },
    hassan:   { loan: 0.35, dev: 0.25 },
    mansour:  { dev: 0.30, loan: 0.15 },
    petrova:  { press: 0.30, pay: 0.30 },
    okafor:   { build: 0.30, loan: 0.20 },
    williams: { pay: 0.35, press: 0.20, lot: 0.20 },
    grace:    { press: 0.15, pay: 0.10 },
  };
  const SPECIALISTS = [
    { key: 'x_pryce',   name: 'Duncan Pryce',  role: 'Commercial broker',     face: 'assets/faces/spec_pryce.jpg',   fee: 0.6, fit: { deal: 0.30, lot: 0.25 },
      perk: 'Exclusivity: no rival bids against you on his deals.' },
    { key: 'x_quint',   name: 'Marla Quint',   role: 'Litigator',             face: 'assets/faces/spec_quint.jpg',   fee: 0.8, fit: { leak: 0.30, press: 0.25, loan: 0.25 } },
    { key: 'x_sato',    name: 'Vivian Sato',   role: 'Crisis PR',             face: 'assets/faces/spec_sato.jpg',    fee: 0.7, fit: { press: 0.35, leak: 0.30, pay: 0.20 } },
    { key: 'x_brenner', name: 'Otto Brenner',  role: 'Construction manager',  face: 'assets/faces/spec_brenner.jpg', fee: 0.9, fit: { build: 0.40, dev: 0.35 } },
  ];

  /* -- the story cases ------------------------------------------------------
     Each: title, cat, active(), effect(s) -> a sentence with the number. */
  const H = () => window.Story && Story.S().harlow;
  const STORY = {
    harlow: { title: 'Harlow’s loan', face: 'assets/faces/bob.jpg', cat: 'loan',
      active: () => { const h = H(); return !!(h && h.loan && ['loan', 'late', 'decide'].indexOf(h.stage) > -1); },
      effect: s => 'Bob’s odds of repaying in full: +' + Math.round(s * 40) + ' points.' },
    port: { title: 'Port Logistics: the leak', face: 'assets/faces/ceo_wex.jpg', cat: 'leak',
      active: () => !!(window.Port && ['scheme', 'offer', 'owned'].indexOf(Port.P().stage) > -1 && !Port.P().leaked),
      effect: s => 'The chance the emails leak: ' + pc(1 - s) + ' of what it was.' },
    war: { title: 'The Rennick war: the press', face: 'assets/faces/ceo_ren.jpg', cat: 'press',
      active: () => !!(window.War && ['war', 'crisis'].indexOf(War.W().stage) > -1),
      effect: s => 'Kessler’s attacks hit the share price ' + pc(s) + ' softer; a lawsuit against his short seller wins more often.' },
    tower: { title: 'Celestial Heights: the build', face: 'assets/faces/sebastian.jpg', cat: 'build',
      active: () => !!(window.Tower && Tower.T().stage === 'build'),
      effect: s => 'The cost overrun: ' + pc(1 - s) + ' of its size.' },
    pay: { title: 'Say on pay', face: 'assets/faces/dahl.jpg', cat: 'pay',
      active: () => !!(window.IndexFund && IndexFund.X().stage === 'in'),
      effect: s => 'Shareholders voting for your pay: +' + Math.round(s * 30) + ' points.' },
  };

  /* Deal cases are registered by deals.js: id 'deal:<n>' with a category. */
  const dealCase = id => window.Deals && Deals.caseInfo ? Deals.caseInfo(id) : null;
  function caseOf(id) {
    if (STORY[id]) return Object.assign({ id }, STORY[id]);
    const d = dealCase(id); return d ? Object.assign({ id }, d) : null;
  }

  /* -- the people ------------------------------------------------------------ */
  function busyOn(key) { const on = A().on; return Object.keys(on).find(id => on[id].key === key && live(id)) || null; }
  function live(id) {
    const a = A().on[id]; if (!a) return false;
    const c = caseOf(id); if (!c || !c.active()) return false;
    return a.until == null || tq() < a.until;
  }
  function people(id) {
    const c = caseOf(id); if (!c) return [];
    const out = [], cat = c.cat;
    (GameState.staff || []).forEach(s => {
      const f = (STAFF_FIT[s.roleId] || {})[cat]; if (!f) return;
      const skill = s.traitId === 'complacent' ? Math.max(1, s.skill - 3) : s.skill;
      out.push({ key: 'st_' + s.roleId, name: s.name, role: s.title, face: s.portrait ? 'assets/staff/' + s.portrait : '',
                 s: fmt(clamp(f * (0.6 + 0.08 * skill), 0.08, 0.45)), cost: { cash: fmt(Math.max(0.2, s.salary)) }, kind: 'staff' });
    });
    (GameState.board.directors || []).forEach(d => {
      const f = (DIR_FIT[d.id] || {})[cat]; if (!f) return;
      const n = window.Directors ? Directors.name(d.id) : d.name;
      out.push({ key: 'dr_' + d.id, name: n, role: window.Directors ? Directors.ROLE[d.id] : 'Director', face: 'assets/faces/' + d.id + '.jpg',
                 s: f, cost: { pc: d.id === 'williams' ? 2 : 1 }, kind: 'director',
                 sour: d.attitude < 3 ? n.replace(/^(Chairman|Chair|Director) /, '') + ' is too unhappy with you to help' : null });
    });
    SPECIALISTS.forEach(x => { const f = x.fit[cat]; if (f) out.push({ key: x.key, name: x.name, role: x.role, face: x.face, s: f, cost: { cash: x.fee }, kind: 'specialist', perk: x.perk }); });
    return out.map(p => {
      const b = busyOn(p.key);
      const why = p.sour || (b && b !== id ? 'busy on ' + (caseOf(b) || {}).title : null) ||
                  (p.cost.pc && cap() < p.cost.pc ? 'not enough political capital' : null) ||
                  (p.cost.cash && spendable() < p.cost.cash ? 'not enough money' : null);
      return Object.assign(p, { why, costText: p.cost.pc ? p.cost.pc + ' political capital' : money(p.cost.cash) + (p.kind === 'staff' ? ' bonus' : ' fee') });
    }).sort((a, b) => b.s - a.s);
  }

  function assign(id, key) {
    const c = caseOf(id); if (!c || !c.active()) return { success: false, message: 'That case is closed.' };
    if (live(id)) return { success: false, message: 'Someone is already on it: ' + A().on[id].name + '.' };
    const p = people(id).find(x => x.key === key); if (!p) return { success: false, message: 'Not available.' };
    if (p.why) return { success: false, message: p.name + ': ' + p.why + '.' };
    if (p.cost.pc) GameState.board.politicalCapital = cap() - p.cost.pc;
    if (p.cost.cash) oneOff(p.cost.cash);
    A().on[id] = { key, name: p.name, role: p.role, face: p.face, s: p.s, q: tq(), until: STORY[id] ? tq() + 4 : null, perk: !!p.perk };
    if (window.Telemetry) Telemetry.used('agent');
    A().log.push({ q: tq(), t: p.name + ' took on ' + c.title + '.' }); while (A().log.length > 30) A().log.shift();
    return { success: true, message: p.name + ' is on it (' + p.costText + '). ' + c.effect(p.s) };
  }
  function release(id) { delete A().on[id]; }

  const strength = id => live(id) ? A().on[id].s : 0;
  const who = id => live(id) ? A().on[id] : null;
  const exclusive = id => live(id) && A().on[id].key === 'x_pryce';
  const risk = (id, p) => clamp(p * (1 - strength(id)), Math.min(p, 0.03), 1);
  const chance = (id, p) => clamp(p + (1 - p) * strength(id), 0, Math.max(p, 0.97));

  /* Active story cases, for the Dealroom. */
  const storyCases = () => Object.keys(STORY).filter(id => STORY[id].active()).map(caseOf);

  /* A face, or the person's initials when there is no portrait yet. */
  const initials = n => String(n).replace(/^(Chairman|Chair|Director|Dr\.) /, '').split(' ').map(w => w[0]).join('').slice(0, 2);
  const face = p => '<span class="ag-face"><span class="ag-ini">' + initials(p.name) + '</span>' + (p.face ? '<img src="' + p.face + '" alt="" onerror="this.remove()">' : '') + '</span>';

  /* The picker (a modal). */
  function openPicker(id, after) {
    const c = caseOf(id); if (!c || !window.UI) return;
    const cur = who(id), list = people(id);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    const rows = list.map(p => '<div class="ag-row' + (p.why ? ' ag-off' : '') + '">' +
      face(p) + '<div class="ag-m"><b>' + esc(p.name) + '</b> <span class="sml-note">' + esc(p.role) + '</span>' +
      '<div class="sml-note">' + esc(c.effect(p.s)) + (p.perk ? ' ' + esc(p.perk) : '') + '</div></div>' +
      '<div class="ag-r"><div class="sml-note">' + esc(p.costText) + '</div>' +
      (p.why ? '<div class="sml-note">' + esc(p.why) + '</div>' : '<button class="btn btn-primary btn-sm" data-ag="' + p.key + '">Assign</button>') + '</div></div>').join('');
    UI.showModal('Put someone on it: ' + c.title,
      '<div class="dp-lead">' + (cur ? '<b>' + esc(cur.name) + '</b> is on this case.' : 'One person per case. They stay on it ' + (STORY[id] ? 'for a year' : 'until it closes') + '.') + '</div>' +
      (cur ? '' : (rows || '<p class="text-muted">Nobody on your team or board fits this one.</p>')), []);
    document.querySelectorAll('#modal-body [data-ag]').forEach(b => b.onclick = () => {
      const r = assign(id, b.dataset.ag);
      UI.closeModal(); if (UI.showToast) UI.showToast(r.message, r.success ? 'success' : 'error');
      if (after) after(); if (UI.renderAll) UI.renderAll();
    });
  }

  return { people, assign, release, strength, who, exclusive, risk, chance, storyCases, caseOf, openPicker, face, SPECIALISTS, CAT, STORY, live };
})();
