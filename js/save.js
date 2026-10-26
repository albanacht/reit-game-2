/* ============================================================================
   save.js — autosave and continue (design doc B.12e).

   WHERE SAVES LIVE: in each player's own browser (localStorage), on their own
   machine. No server, no accounts, no cost. One save slot per browser.
   A save is lost if the player clears site data or plays in incognito.

   WHEN: after every render (so after each quarter AND after every action in
   a turn), plus when the tab is hidden or closed.

   WHAT: every data field of GameState. Two things need care:
   - a decision waiting in the inbox holds functions, so we store which card
     it was and rebuild it on load (details such as which building may differ);
   - a board meeting in progress: if the tab closes mid-meeting, the meeting
     reopens on load, so closing the tab can never dodge the vote.
   ========================================================================== */

window.Save = (() => {

  const KEY = 'reitsim2.save';
  const FORMAT = 1;            // bump if the save layout changes incompatibly
  let active = false;          // only save once a game is actually running

  function available() {
    try { localStorage.setItem('reitsim2.t', '1'); localStorage.removeItem('reitsim2.t'); return true; }
    catch (e) { return false; }
  }

  function snapshot() {
    const data = {};
    Object.keys(GameState).forEach(k => {
      if (typeof GameState[k] !== 'function') data[k] = GameState[k];
    });
    const pd = GameState._pendingDecision;
    data._pendingDecision = null;
    data._pendingDecisionCard = pd ? { id: pd.id, isWorld: !!pd.isWorld } : null;
    return data;
  }

  function save() {
    if (!active || !window.GameState || !GameState.meta) return false;
    if (GameState.meta.gameOver) { clear(); return false; }   // a finished run cannot be continued
    try {
      localStorage.setItem(KEY, JSON.stringify({
        format: FORMAT, savedAt: Date.now(),
        label: (GameState.company.name || 'My REIT') + ' · Year ' + GameState.meta.year + ' Q' + GameState.meta.quarter,
        state: snapshot()
      }));
      return true;
    } catch (e) { return false; }                               // storage full or blocked: play on
  }

  function peek() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.format === FORMAT && s.state && s.state.meta && !s.state.meta.gameOver ? s : null;
    } catch (e) { return null; }
  }

  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }

  /* Restore onto the live GameState object (keeps its methods). */
  function load() {
    const s = peek();
    if (!s) return false;
    const d = s.state;
    Object.keys(d).forEach(k => { GameState[k] = d[k]; });
    // saves made before the photo faces point at v1 cartoon files
    const fix = f => /^port(\d+)\.png$/.test(f || '') ? 's' + ('0' + Math.min(15, +RegExp.$1)).slice(-2) + '.jpg' : f;
    (GameState.staff || []).forEach(s => { s.portrait = fix(s.portrait); });
    (GameState._talentMarket || []).forEach(c => { if (c) c.portrait = fix(c.portrait); });

    // saves from before the credit line (round 3) get one
    if (!GameState.revolver && window.Revolver) Revolver.init();
    if (!GameState.rivals && window.Rivals) Rivals.init();          // and rivals (round 5)

    // rebuild a decision that was waiting in the inbox
    const card = d._pendingDecisionCard;
    GameState._pendingDecision = null;
    delete GameState._pendingDecisionCard;
    if (card && GameState.inbox && GameState.inbox.pendingId) {
      let evt = null;
      if (card.isWorld && window.World) {
        const c = World.DECISIONS.find(x => x.id === card.id);
        try { evt = c ? c.build() : null; } catch (e) { evt = null; }
        if (evt) { evt.id = card.id; evt.headline = evt.title; evt.isWorld = true; }
      }
      if (evt) { GameState._pendingDecision = evt; Inbox.rebind(evt); }
      else Inbox.expirePending('The offer lapsed while you were away.');
    }
    if (GameState.board && GameState.board.maxCapital === 5) GameState.board.maxCapital = 8;   // round 12
    if (!GameState._staffCostV) {                                     // round 29: staff cost half; older saves catch up
      (GameState.staff || []).concat(GameState._talentMarket || []).forEach(s => { if (s && s.salary) s.salary = Math.round(s.salary * 50) / 100; });
      GameState._staffCostV = 2;
    }
    active = true;
    return true;
  }

  function start() { active = true; save(); }
  function stop()  { active = false; }

  // last chance to save when the player leaves
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
  window.addEventListener('pagehide', save);

  return { available, save, load, peek, clear, start, stop, KEY };
})();
