/* ============================================================================
   meeting.js — the annual board meeting (design doc B.1a §8, round 4 part 2).

   One scene a year, after Q4. Replaces v1's dark annual report AND the old
   sprite boardroom. Five portraits with live satisfaction markers on top, a
   chat below (typing dots, click to skip), your choices at the bottom.

     1. Chairman opens with the scorecard (the numbers each director judges)
     2. Last year's demands: met or missed, markers move as they speak
        (+ promises you made last year: kept or broken)
     3. The unhappiest director raises an issue: promise / argue / capital / deflect
     4. Three demands for next year, in tension: accept / push back / refuse
     5. The vote, one by one, swing vote last; a final appeal if it is close
   Year 1 is practice: no vote. Two strikes: a lost vote = probation.
   ========================================================================== */

window.Meeting = (() => {

  // Hassan (swing) votes last. The activist sits only if you gave him a seat.
  const BASE = ['williams', 'petrova', 'chen', 'okafor', 'activist', 'voss', 'grace', 'tex', 'mansour', 'hassan'];
  const order = () => BASE.filter(id => dir(id));
  const CH = () => Directors.chair();                                  // round 14: the chair can change
  const chairNo = () => G().board.chair !== 'you' && S.votes[CH()] === 'AGAINST';   // executive chairman: the casting vote is yours
  /* Lost on a majority against; on a tie the Chairman's side wins (casting vote). */
  const lostWith = (n, chairAgainst) => n * 2 > order().length || (n * 2 === order().length && chairAgainst);
  const AGAINST = 3;                                                   // Unhappy or Furious votes against (directors.js bands)
  let S = null;                                                        // this meeting only (not saved)

  const G = () => GameState;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const cap = s => String(s || '').replace(/^./, m => m.toUpperCase());
  const dir = id => G().board.directors.find(d => d.id === id);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const nm = id => Directors.name(id);
  const sn = id => nm(id).replace(/^(Chairman|Director) /, '');

  // ---------------------------------------------------------------- the scene
  function dom() {
    let m = document.getElementById('meeting');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'meeting'; m.className = 'hidden';
    m.innerHTML = '<div class="mt-box"><div class="mt-head"><span id="mt-title"></span><button class="mt-skip" id="mt-skip" title="Show everything now">Skip ▸▸</button></div>' +
      '<div class="mt-portraits" id="mt-portraits"></div><div class="mt-chat" id="mt-chat"></div><div class="mt-actions" id="mt-actions"></div></div>';
    document.body.appendChild(m);
    m.querySelector('#mt-chat').addEventListener('click', flush);
    m.querySelector('#mt-skip').addEventListener('click', flush);
    return m;
  }

  function portraits() {
    const box = document.getElementById('mt-portraits'); if (!box) return;
    // round 32: every guest of the year sits at the table from the start; the one on the agenda now is lit
    const gs = (S.guests || []).slice(); if (S.guest && !gs.some(g => g.name === S.guest.name)) gs.push(S.guest);
    // round 35: guests sit apart, behind a divider, with their role under the name
    box.style.gridTemplateColumns = 'repeat(' + order().length + ', 1fr)' + (gs.length ? ' 34px repeat(' + gs.length + ', 1fr)' : '');
    box.innerHTML = order().map(id => {
      const a = S.shown[id] != null ? S.shown[id] : dir(id).attitude, L = Directors.level(a);
      const v = S.votes[id];
      return '<div class="mt-p' + (S.speaking === id ? ' talking' : '') + '" id="mtp-' + id + '">' +
        '<img src="' + Directors.face(id) + '" alt=""><div class="mt-pn">' + esc(sn(id)) + '</div>' +
        '<div class="mt-mood ' + L[2] + '">' + L[1] + '</div>' +
        (v ? '<div class="mt-stamp ' + (v === 'FOR' ? 'for' : 'against') + '">' + v + '</div>' : '') + '</div>';
    }).join('') + (gs.length ? '<div class="mt-gdiv"><span>Guests</span></div>' : '') + gs.map(g => { const on = S.guest && S.guest.name === g.name;
      return '<div class="mt-p guest' + (on ? ' on' : ' waiting') + (on && S.speaking === 'guest' ? ' talking' : '') + '"><img src="' + g.face + '" alt=""><div class="mt-pn">' + esc(g.name) + '</div>' +
        (g.role ? '<div class="mt-grole">' + esc(g.role) + '</div>' : '') + '<div class="mt-mood mt-guest">' + (on ? 'Speaking' : 'Waiting') + '</div></div>'; }).join('');
  }

  /* The chat: lines queue up, each appears after a short "typing" pause. */
  function say(who, text, html) { S.q.push({ who, text, html, g: who === 'guest' ? S.guest : null }); }
  function pump(then) {
    S.then = then || S.then;
    if (S.timer) return;
    const next = () => {
      if (!S) return;                                   // the meeting was closed mid-line
      if (!S.q.length) { S.timer = null; S.speaking = null; portraits(); const t = S.then; S.then = null; if (t) t(); return; }
      const it = S.q[0];
      S.speaking = it.who; portraits();
      const chat = document.getElementById('mt-chat');
      const typing = document.createElement('div'); typing.className = 'mt-typing';
      typing.textContent = (it.who === 'you' ? 'You are' : it.who === 'note' ? '' : (it.g ? it.g.name : sn(it.who)) + ' is') + (it.who === 'note' ? '' : ' typing…');
      if (it.who !== 'note') chat.appendChild(typing);
      chat.scrollTop = chat.scrollHeight;
      S.timer = setTimeout(() => { typing.remove(); if (!S) return; show(S.q.shift()); next(); }, S.fast ? 0 : (it.who === 'note' ? 150 : 650));
    };
    next();
  }
  function show(it) {
    const chat = document.getElementById('mt-chat'), el = document.createElement('div');
    if (it.who === 'note') { el.className = 'mt-note'; el.innerHTML = it.html || esc(it.text); }
    else if (it.who === 'you') { el.className = 'mt-line you'; el.innerHTML = '<div class="mt-bub">' + esc(it.text) + '</div>'; }
    else el.className = 'mt-line' + (it.g ? ' guest' : ''),
      el.innerHTML = '<img src="' + (it.g ? it.g.face : Directors.face(it.who)) + '" alt=""><div><div class="mt-who">' + esc(it.g ? it.g.name + ', ' + it.g.role : nm(it.who)) + '</div><div class="mt-bub">' + (it.html || esc(it.text)) + '</div></div>';
    if (it.mood) { S.shown[it.who] = it.mood; }
    chat.appendChild(el); chat.scrollTop = chat.scrollHeight;
    portraits();
  }
  function flush() {
    if (!S) return;
    S.fast = true; if (S.timer) { clearTimeout(S.timer); S.timer = null; }
    document.querySelectorAll('#mt-chat .mt-typing').forEach(t => t.remove());
    while (S.q.length) show(S.q.shift());
    S.speaking = null; portraits();
    const t = S.then; S.then = null; S.fast = false; if (t) t();
  }
  function actions(list, prompt) {
    const box = document.getElementById('mt-actions');
    box.innerHTML = (prompt ? '<div class="mt-prompt">' + prompt + '</div>' : '') + '<div class="mt-btns">' + list.map((a, i) =>
      '<button class="mt-btn' + (a.primary ? ' primary' : '') + '"' + (a.disabled ? ' disabled title="' + esc(a.why || '') + '"' : '') + ' data-i="' + i + '">' +
      '<b>' + esc(a.label) + '</b>' + (a.detail ? '<span>' + esc(a.detail) + '</span>' : '') + (a.disabled && a.why ? '<span class="mt-why">\u{1F512} ' + esc(a.why) + '</span>' : '') + '</button>').join('') + '</div>';
    box.querySelectorAll('.mt-btn').forEach(b => b.onclick = () => { if (b.disabled) return; box.innerHTML = ''; list[+b.dataset.i].go(); });
  }
  const mood = id => { Directors.refresh(); S.shown[id] = dir(id).attitude; portraits(); };
  /* round 32: the meeting reads in chunks. After each block of talk, you press Continue. */
  function pause(next, label) { if (!S) return; actions([{ label: label || 'Continue', primary: true, go: next }]); }

  // ---------------------------------------------------------------- open
  function open() {
    const g = G(), b = g.board, year = g.meta.year - 1;
    g._boardMeetingOpen = true; g._pendingBoardMeeting = false;
    const m = dom(); m.classList.remove('hidden');
    document.getElementById('mt-chat').innerHTML = ''; document.getElementById('mt-actions').innerHTML = '';
    S = { year, practice: year < 2, q: [], shown: {}, votes: {}, timer: null };
    document.getElementById('mt-title').textContent = 'Board meeting · end of Year ' + year + (S.practice ? ' · practice, no vote' : '');
    order().forEach(id => { S.shown[id] = dir(id).attitude; });         // moods before the review

    // once a year: settle last year's demands and promises, earn capital
    if (b._meetingYear !== year) {
      b._meetingYear = year;
      const res = (b.activeMandates || []).length ? Board.evaluateMandates() : [];
      b._lastReview = res.map(r => ({ id: r.mandate.directorId, text: r.mandate.text, achieved: r.achieved, skipped: r.skipped }));
      b._lastPromises = settlePromises();
      b._lastEarned = Board.earnPoliticalCapital();
      if (Directors.has('tex')) {                           // your nominee's seat is held up by YOUR influence
        if ((b.politicalCapital || 0) >= 1) {
          b.politicalCapital -= 1;
          b._lastEarned = (b._lastEarned || []).concat(['Keeping Tex on the board (calls to the big shareholders, favours with the nominating committee): \u22121 political capital']);
        } else {
          Directors.repChange('tex', -15, 'you had no influence left to hold his seat');
          b._lastEarned = (b._lastEarned || []).concat(['No political capital left to hold Tex\u2019s seat: his reputation \u221215 (below 30 and he is out)']);
        }
      }
      Directors.refresh();
    }
    if (window.Story && Story.agenda && b._storyYear !== year) { b._storyYear = year; S.items = Story.agenda(year) || []; }   // round 32: guests known from the start
    S.guests = []; (S.items || []).forEach(it => { if (it.guest && !S.guests.some(g => g.name === it.guest.name)) S.guests.push(it.guest); });
    portraits();
    beatOpen();
  }

  // ---------------------------------------------------------------- 1. open
  function beatOpen() {
    const y = Directors.ytd(), rows = Directors.scorecard();
    say(CH(), pick(['Let’s begin. Year ' + S.year + ' in numbers.', 'Good morning. The numbers first, then the questions.']));
    // round 32: the room knows when the economy turns
    const ph = window.Arc && Arc.phase ? Arc.phase() : null;
    if (ph === 'crisis' || ph === 'aftershock') say(CH(), CH() === 'williams' ? 'Son, we are in a crisis. Nobody expects records this year. I expect us to be standing next year: cash, covenants, no surprises.' : 'We are in a crisis. Keep us afloat this year: cash, covenants, no surprises.');
    else if (ph === 'warning' && dir('okafor')) say('okafor', 'Before the numbers: the banks are getting nervous. Whatever we decide today, decide it as if money will cost more next year.');
    else if (ph === 'recovery') say(CH(), 'The worst is behind us. Prices are low. This is when good companies buy.');
    say('note', '', '<table class="mt-sc">' + rows.map(r => '<tr><td>' + esc(r.k) + '</td><td class="v">' + esc(r.v) + '</td><td class="w">' + esc(r.want) +
      '</td><td>' + (r.ok == null ? '—' : r.ok ? '<span class="ok">✓</span>' : '<span class="no">✗</span>') + '</td><td class="who">' + esc(sn(r.id)) + '</td></tr>').join('') + '</table>');
    if (y) say('petrova', y.you >= y.sector - 0.005
      ? pick(['We returned ' + pct(y.you) + ' against ' + (y.bench === 'rivals' ? 'the rivals’ average of ' : 'the sector’s ') + pct(y.sector) + '. Shareholders can live with that.', pct(y.you) + ', ahead of ' + (y.bench === 'rivals' ? 'the rivals at ' : 'the sector at ') + pct(y.sector) + '. Good.'])
      : pick(['We returned ' + pct(y.you) + '. ' + (y.bench === 'rivals' ? 'The rivals averaged ' : 'The sector did ') + pct(y.sector) + '. Investors noticed the gap.', pct(y.you) + ' against ' + pct(y.sector) + (y.bench === 'rivals' ? ' for our rivals' : ' for the sector') + '. That is the number I hear about.']));
    const sp = priceSpark(); if (sp) say('note', '', sp);
    (G().board._lastEarned || []).forEach(e => say('note', e));
    pump(() => pause(beatPersonal));
  }
  const pct = v => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + '%';
  /* round 24: the share price since you started, and against what the buildings are worth (NAV) */
  function priceSpark() {
    const h = (G().history || []).filter(e => e.sharePrice);
    if (h.length < 2) return '';
    const P = h.map(e => e.sharePrice), N = h.map(e => (e.sharePrice && e.marketCap) ? e.totalEquity / (e.marketCap / e.sharePrice) : null);
    const all = P.concat(N.filter(v => v != null && v > 0)), hi = Math.max.apply(null, all) * 1.08, lo = Math.max(0, Math.min.apply(null, all) * 0.9);
    const W = 520, Hh = 110, x = i => 8 + i * (W - 16) / (h.length - 1), y = v => Hh - 14 - (v - lo) / Math.max(0.01, hi - lo) * (Hh - 28);
    const path = arr => arr.map((v, i) => v == null ? '' : (i && arr[i - 1] != null ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    const yr = Math.max(0, h.length - 4), p0 = P[0], p1 = P[P.length - 1], py = P[yr];
    const ch = (a, b) => (b >= a ? '+' : '−') + Math.abs((b / a - 1) * 100).toFixed(0) + '%';
    return '<div class="mt-spark"><div class="mt-spark-h"><b>Share price</b> $' + p1.toFixed(2) + ' · this year ' + ch(py, p1) + ' · since you started ' + ch(p0, p1) +
      (N[N.length - 1] ? ' · ' + Math.round(p1 / N[N.length - 1] * 100) + '% of NAV' : '') + '</div>' +
      '<svg viewBox="0 0 ' + W + ' ' + Hh + '" width="100%" height="' + Hh + '">' +
      '<rect x="' + x(yr).toFixed(1) + '" y="0" width="' + (x(h.length - 1) - x(yr) + 6).toFixed(1) + '" height="' + Hh + '" fill="#eef4fb"/>' +
      '<path d="' + path(N) + '" fill="none" stroke="#14a38b" stroke-width="1.6" stroke-dasharray="5 4"/>' +
      '<path d="' + path(P) + '" fill="none" stroke="#2f6fb0" stroke-width="2.2"/>' +
      '<circle cx="' + x(h.length - 1).toFixed(1) + '" cy="' + y(p1).toFixed(1) + '" r="3.5" fill="#2f6fb0"/>' +
      '<text x="8" y="' + (Hh - 2) + '" font-size="10" fill="#7a8796">Year 1</text><text x="' + (W - 8) + '" y="' + (Hh - 2) + '" font-size="10" fill="#7a8796" text-anchor="end">now</text>' +
      '</svg><div class="sml-note"><span style="color:#2f6fb0">━</span> share price &nbsp; <span style="color:#14a38b">╍</span> NAV per share (what the buildings are worth) &nbsp; shaded: this year</div></div>';
  }

  // ---------------------------------------------------------------- 1b. personal moments, hints
  function beatPersonal() {
    const b = G().board;
    if (b._personalYear !== S.year) {                 // once a year, even if the meeting reopens
      b._personalYear = S.year;
      b._personal = Directors.personal ? Directors.personal() : [];
      b._hint = Directors.hint ? Directors.hint() : null;
    }
    (b._personal || []).forEach(p => {
      say(p.id, p.text);
      if (p.kind === 'bought') say('note', '', sn(p.id) + ' bought <b>10,000 more shares</b>. If the stake falls 10% or more below what ' + sn(p.id) + ' paid, it costs you mood, up to −2.5. Up 15%: a bonus.');
      if (p.kind === 'sold') say('note', 'A director selling shares is noticed. Share price −1.5%.');
    });
    if (b._hint) say(b._hint.id, b._hint.text);
    pump(beatReview);
  }

  // ---------------------------------------------------------------- 2. review
  function beatReview() {
    const rev = G().board._lastReview || [], pro = G().board._lastPromises || [];
    if (!rev.length && !pro.length) { beatDeparture(); return; }
    rev.forEach(r => {
      if (r.skipped) return;
      say(r.id, r.achieved ? pick(['You met my demand: ' + r.text + ' Good.', r.text.replace(/\.$/, '') + ': done. Thank you.'])
                           : pick(['I asked for this: ' + r.text + ' You missed it.', r.text.replace(/\.$/, '') + ': not done. I remember these things.']));
      S.q[S.q.length - 1].mood = dir(r.id) ? dir(r.id).attitude : null;
    });
    pro.forEach(p => {
      if (!dir(p.id)) return;
      say(p.id, p.kept ? 'Last year you promised to fix it. You did. I’ll trust your word next time.' : 'You gave me your word last year. You didn’t keep it.');
      S.q[S.q.length - 1].mood = dir(p.id).attitude;
    });
    pump(() => pause(beatDeparture));
  }

  // ---------------------------------------------------------------- 2b. a director pushed out (round 8)
  /* Reputation below Directors.REP_LINE: the board wants them gone. Save them
     once for 2 political capital, or let them go and choose who comes in.
     The chairman and the activist have their own stories; not here. */
  const CANDIDATES = ['mansour', 'grace'];
  const PROFILE = {
    mansour: () => 'Born in Cairo; twenty years running operations for a Gulf retail group, then a US supermarket chain. Judges occupancy a little harder than Hassan did: wants 87% (Hassan: 86%), and no building below 75%. Red line: any building below 75%. Starts Content.',
    grace:  () => 'Sustainability champion. Judges your ESG score (wants 60, you are at ' + Story.esgScore() + '). Proposes a new initiative every year, and they cost money. At ESG 60, ESG funds buy your shares: share price +5%. Happy for you to borrow.',
  };
  function beatDeparture() {
    const b = G().board;
    const out = S.practice || b._departYear === S.year ? null
      : order().filter(id => id !== 'williams' && id !== CH() && id !== 'activist' && Directors.rep(id) < Directors.REP_LINE)[0];
    if (!out) { beatStory(); return; }
    b._departYear = S.year; b.saved = b.saved || {};
    const c = Directors.card(out), pc = b.politicalCapital || 0, why = (c.repWhy || []).slice(0, 3).join('; ');
    const harlow = out === 'hassan' && window.Story && Story.H && Story.H().hassanDiscredited;
    say(CH(), (harlow ? 'Hassan backed Harlow from the first day, and the shareholders have not forgotten it. ' : '') +
      sn(out) + ' has offered ' + (out === 'mansour' ? 'her' : 'his') + ' resignation. The board is minded to accept it.');
    say('note', '', '<b>' + esc(sn(out)) + '\u2019s reputation: ' + c.rep + ' / 100</b> (below ' + Directors.REP_LINE + ')' + (why ? '<div class="mt-sub">' + esc(why) + '</div>' : ''));
    pump(() => actions([
      { label: 'Save ' + sn(out) + ' (2 political capital)', primary: true,
        detail: 'Reputation back to 35. ' + sn(out) + ' becomes your ally (relationship +2): a near-certain vote for you. Petrova \u22121, Okafor \u22121: "you protect your friends". Once only.',
        disabled: pc < 2 || b.saved[out], why: b.saved[out] ? 'You already saved ' + sn(out) + ' once' : 'Needs 2 political capital', go: () => {
          b.politicalCapital = pc - 2; b.saved[out] = true;
          Directors.repChange(out, 35 - Directors.rep(out), 'you saved the seat');
          Directors.bond(out, 2, 'you saved the seat');
          ['petrova', 'okafor'].forEach(id => { if (id !== out && dir(id)) Directors.remember(id, -1, 'you protected ' + sn(out)); });
          say('you', 'I want ' + sn(out) + ' on this board. I\u2019ll stand behind that.');
          say(out, 'Thank you. I won\u2019t forget it.'); mood(out); pump(beatStory); } },
      { label: 'Let ' + sn(out) + ' go',
        detail: 'Leaves the board today. The search firm has candidates' + (pc >= 3 ? ', or you can nominate your own.' : '.'),
        go: () => {
          const bd = Directors.bondOf(out);
          say(out, bd && bd.pts > 0 ? 'You stood by me when it counted. Good luck with the rest of them.'
                 : bd && bd.pts < 0 ? 'You never backed me when it mattered. I hope it was worth it.'
                 : 'It was an honour. Mostly.');
          Directors.removeDirector(out, sn(out) + ' left the board' + (harlow ? ' after Harlow' : '') + ' (reputation ' + c.rep + ').');
          delete S.shown[out]; portraits();
          pump(() => replacement(out));
        } },
    ], esc(sn(out)) + '\u2019s seat · political capital: ' + pc));
  }
  function replacement(left) {
    const b = G().board, pc = b.politicalCapital || 0;
    const pool = CANDIDATES.filter(id => !dir(id) && !(b.formerly || {})[id]);
    say(CH(), pool.length ? 'The search firm has a shortlist.' : 'The seat stays empty for now.');
    if (!pool.length && pc < 3) { pump(beatStory); return; }
    const join = (id, att, line) => {
      Directors.addDirector(id, att, ({ mansour: 'Salma Mansour', grace: 'Julian Grace', tex: 'Tex Brennan (your nominee)' })[id] + ' joined the board, in ' + sn(left) + '\u2019s seat.');
      if (window.Story && Story.onDirectorJoin) Story.onDirectorJoin(id);
      Directors.refresh(); S.shown[id] = dir(id).attitude; portraits();
      say(id, line); pump(beatStory);
    };
    pump(() => actions(pool.map(id => ({ label: 'Appoint ' + ({ mansour: 'Salma Mansour', grace: 'Julian Grace' })[id], detail: PROFILE[id](), go: () => join(id, 5,
        id === 'mansour' ? 'Thank you. I\u2019ve read the rent roll. We have work to do.' : 'Thank you! I\u2019ve brought a few ideas. Twelve, actually.') })).concat([
      { label: 'Nominate your friend Tex Brennan (3 political capital)',
        detail: 'Your friend from Texas real estate. Votes with you unless 4 others are already against. Your influence holds his seat: 1 political capital at every meeting; with none left his reputation drops 15. In a good year he moves a special pay award for you, in cash or shares, and the board votes on it. Board fees +$0.3M a year. Petrova \u22121 for good (board independence). Reputation starts at 40: one bad press story could push him out.',
        disabled: pc < 3, why: 'Needs 3 political capital', go: () => { b.politicalCapital = pc - 3; join('tex', 6, 'Howdy, y\u2019all. Call me Tex. Everybody does.'); } },
    ]), 'Who takes the seat?'));
  }

  // ---------------------------------------------------------------- 2c. the stories' agenda (round 11)
  /* Stories bring their big beats to the meeting (story.js agenda()): a
     director proposes, another objects, a guest may speak, you decide here. */
  function beatStory() {
    if (!window.Story || !Story.agenda) { beatAgenda(); return; }
    const b = G().board;
    if (b._storyYear !== S.year) { b._storyYear = S.year; S.items = Story.agenda(S.year) || []; } else S.items = S.items || [];
    if (S.items.length) say(CH(), pick(['Now, business. ' + (S.guests.length ? 'We have guests today.' : ''), 'To the agenda.' + (S.guests.length ? ' Our guests have waited long enough.' : '')]).trim());
    pump(() => runItems(S.items, 0, beatAgenda));
  }
  /* Play agenda items one by one (stories, the pay committee):
     { lines, guest, note, card | choices | effect } */
  function runItems(list, i, done) {
    if (!list || i >= list.length) { S.guest = null; portraits(); done(); return; }
    const it = list[i];
    S.guest = it.guest || null; portraits();
    (it.lines || []).forEach(l => { if (l[0] === 'note' || l[0] === 'guest' || dir(l[0])) say(l[0], l[1]); });
    if (it.note) say('note', it.note);
    const next = () => { S.guest = null; portraits(); pump(() => (i + 1 < list.length ? pause(() => runItems(list, i + 1, done)) : runItems(list, i + 1, done))); };   // round 32: a breath between items
    if (it.effect) { pump(() => { const msg = it.effect(); if (msg) say('note', msg); Directors.refresh(); next(); }); return; }
    if (it.choices) {
      pump(() => actions(it.choices.map(ch => ({ label: ch.label, detail: ch.detail, primary: ch.primary, disabled: ch.disabled, why: ch.why,
        go: () => { say('you', ch.label); const msg = ch.go(); if (msg) say('note', msg); Directors.refresh(); order().forEach(id => { S.shown[id] = dir(id).attitude; }); next(); } })),
        esc((it.title || '').toString()) || ''));
      return;
    }
    if (!it.card) { next(); return; }
    const c = window.World && World.DECISIONS.find(x => x.id === it.card);
    let card = null; try { card = c ? c.build() : null; } catch (e) { card = null; }
    if (!card) { next(); return; }
    card.id = it.card; card.isWorld = true; card.headline = card.title;
    pump(() => {
      // the guest already said it in the room: drop the card's opening quote, keep the numbers
      say('note', '', '<b>' + esc(card.title) + '</b><div>' + String(card.body || '').replace(/^\s*"[^<]*"/, '') + '</div>');
      pump(() => {
        const opts = card.choices.map((ch, k) => {
          const ok = !ch.check || ch.check(), cap = ch.costType === 'capital' && (G().board.politicalCapital || 0) < (ch.cost || 1);
          return { label: ch.label, detail: ch.detail, primary: k === 0, disabled: !ok || cap, why: !ok ? (ch.checkMsg || 'Not available') : 'Not enough political capital',
                   go: () => { say('you', ch.label); const r = World.applyChoice(card, k); say('note', r.message || ''); Directors.refresh(); order().forEach(id => { S.shown[id] = dir(id).attitude; }); next(); } };
        });
        if (it.later) opts.push({ label: 'Decide later (it goes to your inbox)', detail: 'Time to find the money. It waits in your inbox, where you can put it on hold.',
          go: () => { say('you', 'Let me come back to the board on this.'); if (window.Story) Story.S().due = it.card; next(); } });
        actions(opts, esc(card.title));
      });
    });
  }
  /* The pay committee, after the vote (pay.js). */
  function payCommittee(done) {
    if (!window.Pay || !Pay.meeting) { done(); return; }
    const items = Pay.meeting(S.year);
    if (!items.length) { done(); return; }
    say(CH(), 'One more item, and then you may go. Your pay.');
    pump(() => runItems(items, 0, done));
  }

  // ---------------------------------------------------------------- 3. agenda
  function beatAgenda() {
    const unhappy = order().map(id => dir(id)).filter(d => d.attitude < 4.75).sort((a, b) => a.attitude - b.attitude)[0];
    if (!unhappy) { say(CH(), 'No complaints worth the board’s time. On to next year.'); pump(beatDemands); return; }
    const id = unhappy.id, c = Directors.card(id), b = G().board;
    // round 24: a director's own shares are personal: said in his own voice, not as a line item
    const stk = /^own [\d,]+ shares, down/.test(c.cause) && c.stake ? c.stake : null;
    if (stk) {
      const down = Math.round((1 - G().company.sharePrice / stk.avg) * 100);
      say(id, id === 'williams'
        ? 'I own ' + stk.n.toLocaleString() + ' shares of this company, son. They are down ' + down + '% since I bought them. I expect them to go up from here, and I expect a hefty dividend. That is what the shareholders elected us for.'
        : 'I own ' + stk.n.toLocaleString() + ' shares of this company. They are down ' + down + '% since I bought them. I would like to see them go up, and so would every other shareholder.');
    } else
    say(id, pick(['Before we move on. ' + cap(c.cause) + '. I want to hear what you will do about it.', cap(c.cause) + '. Explain that to me.']));
    pump(() => {
      const pc = b.politicalCapital || 0, dodged = (b.deflected || {})[id];
      const promiseD = Board.demandFor(id), other = OPPOSE[id] && dir(OPPOSE[id]) ? OPPOSE[id] : null;
      actions([
        { label: 'Promise to fix it', detail: '+1 mood now, and the fix becomes ' + sn(id) + '\u2019s demand for next year' + (promiseD ? ' ("' + promiseD.text.replace(/\.$/, '') + '")' : '') + '. Kept: +3.5 mood. Broken: −4.', primary: true, go: () => {
            say('you', 'You have my word: this will be fixed by next year’s meeting.');
            S.first = id; S.promised = true;
            Directors.remember(id, 1, 'you promised to fix: ' + c.cause);
            say(id, pick(['I will hold you to that.', 'Noted. Don’t make me remind you.'])); mood(id); S.q[S.q.length - 1].mood = dir(id).attitude; pump(beatDemands); } },
        // round 11: "Argue with the facts" changed nothing you could not already see. A trade costs something real.
        { label: other ? 'Offer a trade: side with ' + sn(id) + ' against ' + sn(other) : 'Offer a trade', detail: other
            ? sn(id) + ' +1.5 now, and ' + sn(id) + '\u2019s priority comes first in next year\u2019s demands. ' + sn(other) + ' \u22121: you sold them out.'
            : 'No one on the board to trade against.', disabled: !other, why: 'No opposing director on the board', go: () => {
            say('you', sn(id) + ', you have a point. Next year your priority comes first' + (other ? ', even if ' + sn(other) + ' won\u2019t like it.' : '.'));
            S.first = id; S.promised = false;
            Directors.remember(id, 1.5, 'you sided with him on his priority');
            Directors.remember(other, -1, 'you sold him out to ' + sn(id));
            say(id, pick(['That is all I wanted to hear.', 'Good. That is a deal.'])); say(other, pick(['Noted.', 'I see how it is.']));
            mood(id); mood(other); S.q[S.q.length - 1].mood = dir(other).attitude; pump(beatDemands); } },
        // round 35: shares that bought buildings are an answer Petrova accepts
        ...(id === 'petrova' && /new shares/.test(c.cause) ? [{ label: 'Explain: the money bought buildings', detail: Directors.issueInvested() ? 'True: what we bought this year is worth what the shares raised. +1.5 mood, and the new shares stop counting against you.' : 'Not true yet: the money is still mostly cash.',
          disabled: !Directors.issueInvested(), why: 'The money from the shares has not been spent on buildings yet', go: () => {
            say('you', 'Every dollar from those shares went into buildings that pay rent. Look at the portfolio.');
            Directors.explainIssue(); say(id, 'Fair. As long as they keep paying. Next time, sell shares when they are dear.'); mood(id); S.q[S.q.length - 1].mood = dir(id).attitude; pump(beatDemands); } }] : []),
        { label: 'Spend 1 political capital', detail: 'Private lunch: +1.5 mood. You have ' + pc + ' capital.', disabled: pc < 1, why: 'No political capital left', go: () => {
            b.politicalCapital = pc - 1; say('you', 'Let’s talk properly. Lunch tomorrow, just us.');
            Directors.remember(id, 1.5, 'you made time for his concerns');
            say(id, 'Fine. I appreciate being taken seriously.'); mood(id); S.q[S.q.length - 1].mood = dir(id).attitude; pump(beatDemands); } },
        { label: 'Deflect', detail: dodged ? 'Second time: −1 mood.' : 'No change this time. A second dodge costs −1 mood.', go: () => {
            b.deflected = Object.assign({}, b.deflected, { [id]: true });
            say('you', 'It’s on my list. Let’s look at next year first.');
            if (dodged) Directors.remember(id, -1, 'you dodged him again');
            say(id, dodged ? 'You said that last time.' : 'Hm. Fine.'); mood(id); S.q[S.q.length - 1].mood = dir(id).attitude; pump(beatDemands); } },
      ], esc(sn(id)) + ' wants an answer.');
    });
  }

  /* Who pulls against whom (round 11 trades). */
  const OPPOSE = { chen: 'okafor', okafor: 'chen', williams: 'okafor', petrova: 'chen', hassan: 'okafor', mansour: 'okafor', grace: 'okafor', activist: 'williams' };

  // ---------------------------------------------------------------- 4. demands
  /* Demands must pull against each other: at least one asks you to grow or
     pay out (spend), at least one asks you to hold back (save). */
  const SPEND = ['div_raise', 'div_raise2', 'acquisitions', 'ffo_growth', 'portfolio_sz', 'price_growth'];
  const SAVE = ['leverage', 'int_coverage', 'no_overdraft', 'no_debt_grow', 'no_equity', 'share_price'];
  function beatDemands() {
    const b = G().board;
    if (b._demandsYear !== S.year) {
      Board.generateDemands({ first: S.first, promise: S.promised });     // round 11: two, tied to what is wrong
      b._demandsYear = S.year; b._demandsDone = 0;
    }
    say(CH(), 'Now, next year. Two demands, and we will hold you to both.');
    pump(() => nextDemand());
  }
  function nextDemand() {
    const b = G().board, list = b.activeMandates || [], i = b._demandsDone || 0;
    if (i >= list.length) { wrapDemands(); return; }
    const m = list[i], id = m.directorId, d = Board.DIRECTORS.find(x => x.id === id);
    const N = Board.mandateNumbers(m);
    say(id, m.text + ' ' + pick(['By next year’s meeting.', 'I’ll be checking.', 'That is my condition.']));
    say('note', '', N.binary ? '<b>Pass or fail.</b> ' + esc(N.nowLabel) + ': ' + esc(N.now)
                             : '<b>Target ' + N.sign + ' ' + esc(N.target) + '</b> · ' + esc(N.nowLabel) + ': ' + esc(N.now) + (N.how ? '<div class="mt-sub">How: ' + esc(N.how) + '.</div>' : ''));
    pump(() => {
      const pc = b.politicalCapital || 0, binary = N.binary;
      // round 34: asked to buy while debt is high or in a crisis, Okafor takes your side
      const buyAsk = /acquisitions|accretive/.test(m.metric), d2a = G().ratios.debtToAssets || 0, crisisNow = Directors.crisis && Directors.crisis();
      const backed = buyAsk && (d2a >= 0.50 || crisisNow) && Directors.has('okafor') && id !== 'okafor';
      const odds = Math.round(Math.min(0.9, (d.negotiateSuccessRate || 0.5) * (0.6 + dir(id).attitude / 10) + (backed ? 0.2 : 0)) * 100);
      const ally = { williams: 'petrova', petrova: 'williams' }[id];
      const done = r => { m.response = r; b._demandsDone = i + 1; Directors.refresh(); S.q.length && (S.q[S.q.length - 1].mood = dir(id).attitude); pump(nextDemand); };
      actions([
        { label: 'Accept', detail: (binary ? '' : 'Target ' + N.sign + ' ' + N.target + '. ') + (m.promise ? 'Your promise. Met: +3.5 mood, +1 capital. Missed: −4 mood.' : 'Met: +2.5 mood, +1 capital. Missed: −3 mood.'), primary: true, go: () => { say('you', 'Agreed.'); say(id, 'Good.'); done('accept'); } },
        { label: 'Push back (1 capital)', detail: binary
              ? (isBinaryReal(m) ? 'Ask them to drop it. ' : 'Ask for no target this year. ') + odds + '% chance' + (backed ? ' (Okafor backs you: ' + (crisisNow ? 'we are in a crisis' : 'debt is ' + Math.round(d2a * 100) + '%') + ')' : '') + '. If they say no: −0.5 mood and it stays.'
              : 'Ask for ' + N.sign + ' ' + N.eased + ' instead of ' + N.target + '. ' + odds + '% chance. Eased and met: +1 mood, +1 capital; missed: −1.5. If they say no: −0.5 mood, target stays.',
          disabled: pc < 1, why: 'No political capital left', go: () => {
            b.politicalCapital = pc - 1; say('you', binary ? (buyAsk ? 'Not this year. We cannot afford to buy right now.' : 'I can’t promise that this year. Drop it.') : 'That target is too tight. ' + N.sign + ' ' + N.eased + ' is realistic.');
            if (backed) say('okafor', 'I agree with the CEO. Not with debt where it is.');
            if (Math.random() * 100 < odds) {
              if (binary) { say(id, buyAsk ? 'Fine. Not this year. Next year I expect us to be buying.' : 'Fine. Off the list.'); done('reject'); return; }
              say(id, 'All right. ' + N.sign + ' ' + N.eased + ' instead of ' + N.target + '. But I want it met.');
              m.text = m.text.replace(/\.$/, '') + ' (eased to ' + N.sign + ' ' + N.eased + ')'; done('negotiate');
            } else { Directors.remember(id, -0.5, 'you tried to bargain down his demand'); say(id, 'No. ' + (binary ? 'It stands.' : N.sign + ' ' + N.target + ' stands.')); done('accept'); } } },
        { label: 'Refuse', detail: 'No target. −1.5 mood now' + (ally ? ', and −0.5 for ' + sn(ally) + '.' : '.'), go: () => {
            say('you', 'No. I won’t commit to that.');
            Directors.remember(id, -1.5, 'you refused his demand: ' + m.text);
            if (ally) Directors.remember(ally, -0.5, 'you refused ' + sn(id) + '’s demand');
            say(id, pick(['Noted. Very clearly noted.', 'Then we’ll see how the year goes.'])); done('reject'); } },
      ], 'Demand ' + (i + 1) + ' of ' + list.length + ' · political capital: ' + pc + ' · mood runs 0 to 10, below 3.0 they vote against');
    });
  }
  const isBinaryReal = m => m.target === 1 && !/ThisYear$|Pct$/.test(m.metric);
  function wrapDemands() {
    const list = G().board.activeMandates || [];
    say('note', '', '<b>Your demands for next year</b>' + list.map(m => '<div>• ' + esc(sn(m.directorId)) + ': ' + esc(m.text) +
      (m.response === 'reject' ? ' <i>(refused)</i>' : '') + '</div>').join('') + '<div class="mt-sub">They are on the Board tab, with progress, all year.</div>');
    if (S.practice) {
      say(CH(), 'That’s Year 1. From next year this board votes on you. Use the year well.');
      pump(() => payCommittee(() => actions([{ label: 'Back to work', primary: true, go: close }])));
      return;
    }
    say(CH(), 'Now, the vote. Each of us in turn.');
    pump(() => vote(0, 0));
  }

  // ---------------------------------------------------------------- 5. the vote
  function vote(i, against) {
    const O = order();
    if (i >= O.length) { result(against); return; }
    const id = O[i], b = G().board, last = i === O.length - 1, chair = chairNo();
    // the last vote decides it: one final appeal
    if (last && !lostWith(against, chair) && lostWith(against + 1, chair) && !S.appealed && Directors.votesAgainst(id)) {
      S.appealed = true;
      const pc = b.politicalCapital || 0;
      say('note', (against === 2 ? 'Two' : 'Three') + ' votes against. ' + sn(id) + ' decides it.');
      pump(() => actions([
        { label: 'Final appeal to ' + sn(id) + ' (1 capital)', detail: 'About +1.5 mood. ' + sn(id) + ' is at ' + dir(id).attitude.toFixed(1) + '; below 3.0 he votes against. You have ' + pc + ' capital.', primary: true, disabled: pc < 1, why: 'No political capital left', go: () => {
            b.politicalCapital = pc - 1; say('you', sn(id) + ', give me one more year. You know what I can do.');
            Directors.remember(id, 1.5, 'your final appeal'); Directors.refresh(); S.shown[id] = dir(id).attitude; pump(() => vote(i, against)); } },
        { label: 'Let the vote stand', go: () => vote(i, against) },
      ]));
      return;
    }
    const a = dir(id).attitude, no = id === 'tex' ? against >= 4 : Directors.votesAgainst(id);
    S.votes[id] = no ? 'AGAINST' : 'FOR';
    const c = Directors.card(id);
    say(id, no ? pick(['Against. ' + cap(c.cause) + '.', 'I can’t support this. ' + cap(c.cause) + '.'])
               : pick(['For.', 'I back the CEO.', 'For. ' + (a >= 7.5 ? 'A good year.' : 'For now.')]));
    S.q[S.q.length - 1].mood = a;
    pump(() => vote(i + 1, against + (no ? 1 : 0)));
  }

  function result(against) {
    const g = G(), b = g.board, lost = lostWith(against, chairNo()), forN = order().length - against;
    if (lost && against * 2 === order().length) say('note', 'A tie. The Chairman has the casting vote, and he voted against you.');
    if (!lost) {
      say(CH(), 'The board backs you, ' + forN + ' to ' + against + (forN === against ? ', on the Chairman\u2019s casting vote' : '') + '.' + (b.probation ? ' The probation is lifted.' : ''));
      if (b.probation) b.probation = null;
      pump(() => payCommittee(() => texMotion(() => actions(leave('Back to work')))));
    } else if (!b.probation) {
      b.probation = { since: S.year };
      say(CH(), against + ' to ' + forN + ' against. You keep the job for one more year, on probation. Lose next year’s vote and you are out.');
      pump(() => payCommittee(() => texMotion(() => actions(leave('Back to work, on probation')))));
    } else {
      say(CH(), against + ' to ' + forN + '. You were on probation. Thank you for your service.');
      if (window.Pay) Pay.onFired();                        // the unvested shares go with the job
      g.meta.gameOver = true;
      g.meta.gameOverReason = 'The board voted ' + against + '-' + forN + ' to remove you as CEO of ' + g.company.name + ' after Year ' + S.year + ', a year after putting you on probation.';
      pump(() => actions([{ label: 'Leave the boardroom', primary: true, go: () => { close(); UI.showGameOver(); } }]));
    }
  }

  // ---------------------------------------------------------------- 6. Tex's motion (round 8)
  /* In a year that gives him an excuse (2 of 5 checks), and not more than
     once every 6 quarters, Tex moves a special award for you. You choose the
     form; the board votes, each director with their own odds. */
  function texMotion(done) {
    const g = G(), b = g.board, now = (g.meta.year - 1) * 4 + g.meta.quarter;
    // round 18: never at the meeting where he takes his seat; after that, at most once a year
    if (!dir('tex') || S.practice || (b.texJoinQ != null && now - b.texJoinQ < 3) || (b._texMotionQ && now - b._texMotionQ < 4)) { done(); return; }
    const checks = Story.texChecks(), passed = checks.filter(c => c.ok).length;
    if (passed < 2) { done(); return; }
    b._texMotionQ = now;
    say('tex', 'Before we break, friends. Look at this year. ' + passed + ' out of 5 by my count. I move that the board grants our CEO a special award. Earned, every cent.');
    say('note', '', '<b>Tex\u2019s case</b><table class="mt-sc">' + checks.map(c => '<tr><td>' + esc(c.k) + '</td><td class="v">' + esc(c.v) + '</td><td class="w">' + esc(c.want) +
      '</td><td>' + (c.ok ? '<span class="ok">✓</span>' : '<span class="no">✗</span>') + '</td></tr>').join('') + '</table>');
    const oc = Story.awardOdds('cash', checks), os = Story.awardOdds('shares', checks), flag = Story.flagOdds(passed);
    const val = Story.AWARD_SHARES * g.company.sharePrice / 1e6;
    const vote = kind => {
      const o = kind === 'cash' ? oc : os;
      say('you', kind === 'cash' ? 'If the board agrees, I\u2019ll take it in cash.' : 'If the board agrees, I\u2019ll take it in shares. I\u2019d rather own more of this company.');
      let yes = 0, chairYes = false;
      o.per.forEach(x => {
        const y = Math.random() < x.p; if (y) yes++; if (x.id === CH()) chairYes = y;
        say(x.id, x.id === 'tex' ? 'Aye, obviously.' : y ? pick(['Aye.', 'Fine. It was a good year.', 'In favour.']) : pick(['No.', 'Not with our shareholders\u2019 money.', 'Against. It looks terrible.']));
      });
      const N = o.per.length, pass = yes * 2 > N || (yes * 2 === N && chairYes);
      if (pass) {
        Story.payAward(kind, passed);
        say(CH(), 'The award is approved, ' + yes + ' to ' + (N - yes) + '. ' + (kind === 'cash' ? '$' + Story.AWARD_CASH.toFixed(1) + 'M' : Story.AWARD_SHARES.toLocaleString() + ' shares') + ' to the CEO. Minute it, please.');
        Directors.remember('tex', 0.5, 'his motion passed');
      } else {
        say(CH(), 'The motion fails, ' + yes + ' to ' + (N - yes) + '.');
        Directors.repChange('tex', -5, 'his pay motion for the CEO failed');
        o.per.forEach(x => { if (x.id !== 'tex' && x.p < 0.5) Directors.remember(x.id, -0.5, 'you let Tex ask for a special award'); });
      }
      pump(done);
    };
    pump(() => actions([
      { label: 'Take it in cash: $' + Story.AWARD_CASH.toFixed(1) + 'M', primary: true,
        detail: 'Board approval about ' + oc.approve + '%. The company books a $' + Story.AWARD_CASH.toFixed(1) + 'M one-off cost. Okafor dislikes cash out if debt is above 45%. If paid, ' + flag + '% chance the proxy advisers notice.',
        go: () => vote('cash') },
      { label: 'Take it in shares: ' + Story.AWARD_SHARES.toLocaleString(),
        detail: 'Board approval about ' + os.approve + '%. Worth about $' + val.toFixed(1) + 'M today; no cash out, ' + (Story.AWARD_SHARES / 1e6 / g.company.sharesOutstanding * 100).toFixed(1) + '% dilution, which Petrova dislikes. If paid, ' + flag + '% chance the proxy advisers notice.',
        go: () => vote('shares') },
      { label: 'Ask Tex to withdraw it',
        detail: 'No vote, no risk. Tex shrugs: "Your call, partner." Nothing else changes.',
        go: () => { say('you', 'Thank you, Tex, but not this year.'); say('tex', 'Your call, partner.'); pump(done); } },
    ], 'Tex\u2019s motion · approval depends on the checks, each director\u2019s mood and character'));
  }

  // ---------------------------------------------------------------- promises
  /* A promise is kept if that director's scorecard lines are on target. */
  function settlePromises() {
    const b = G().board, due = (b.promises || []).filter(p => p.year <= G().meta.year - 1), out = [];
    due.forEach(p => {
      const kept = Directors.scorecard().filter(r => r.id === p.id).every(r => r.ok !== false);
      Directors.remember(p.id, kept ? 2 : -3, kept ? 'you kept your promise' : 'you broke your promise about: ' + p.cause);
      out.push({ id: p.id, kept });
    });
    b.promises = (b.promises || []).filter(p => due.indexOf(p) === -1);
    return out;
  }

  // ---------------------------------------------------------------- close
  /* round 15: you may resign at the end of any annual meeting from Year 2:
     keep what has vested, forfeit the rest, and the run is scored now. */
  function leave(label) {
    const w = window.Pay ? Pay.wealth() : { total: 0, unvestedValue: 0 };
    return [{ label, primary: true, go: close },
            { label: 'Resign as CEO', detail: 'Leave with ' + '$' + w.total.toFixed(1) + 'M of your own. Unvested shares worth $' + (w.unvestedValue || 0).toFixed(1) + 'M are forfeited. The run ends and is scored now.',
              go: () => { say('you', 'Before we close. I have decided to step down.'); say(CH(), 'Are you certain? There is no taking it back.');
                pump(() => actions([{ label: 'Yes: resign now', go: resignNow }, { label: 'No, I will stay', primary: true, go: () => { say('you', 'Forget I said it.'); pump(() => actions([{ label, primary: true, go: close }])); } }])); } }];
  }
  function resignNow() {
    const g = G();
    if (window.Pay) Pay.onFired();
    g.meta.gameOver = true; g.meta.resigned = true;
    g.meta.gameOverReason = 'You resigned as CEO of ' + g.company.name + ' after Year ' + S.year + '.';
    close(); if (window.UI && UI.showGameOver) UI.showGameOver();
  }
  function close() {
    const g = G();
    document.getElementById('meeting').classList.add('hidden');
    g._boardMeetingOpen = false;
    if (S && S.timer) clearTimeout(S.timer);
    S = null;
    if (!g.meta.gameOver) { Board.resetYearTracking(); if (window.Staff && Staff.refreshTalentMarket) Staff.refreshTalentMarket(); }
    if (window.UI && UI.renderAll) UI.renderAll();
  }

  return { open, close, flush };
})();
