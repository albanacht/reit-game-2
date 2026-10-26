// ============================================================
// ui.js — Game interface, rendering, player actions
// REIT Simulator Game
// ============================================================

window.UI = (function() {

  function fmt(n, d) {
    if (d === undefined) d = 2;
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Number(n).toFixed(d);
  }
  function fmtM(n)   { return "$" + fmt(n, 1) + "M"; }
  function fmtPct(n) { return fmt(n * 100, 1) + "%"; }
  function fmtPS(n)  { return "$" + fmt(n, 2); }
  function el(id)    { return document.getElementById(id); }
  function setText(id, val) { var e = el(id); if (e) e.textContent = val; }

  // ----------------------------------------------------------
  // MODAL
  // ----------------------------------------------------------
  function showModal(title, body, actions) {
    if (!actions) actions = [];
    var overlay = el("modal-overlay");
    if (!overlay) return;
    el("modal-title").textContent = title;
    el("modal-body").innerHTML = body.replace(/\n/g, "<br>");
    el("modal-actions").innerHTML = "";
    actions.forEach(function(a) {
      var btn = document.createElement("button");
      btn.textContent = a.label;
      btn.className = "btn " + (a.style || "btn-secondary");
      btn.onclick = function() { a.onClick(); closeModal(); };
      el("modal-actions").appendChild(btn);
    });
    var closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.className = "btn btn-secondary";
    closeBtn.onclick = closeModal;
    el("modal-actions").appendChild(closeBtn);
    overlay.classList.remove("hidden");
  }

  function closeModal() {
    var o = el("modal-overlay");
    if (o) o.classList.add("hidden");
    var mb = document.querySelector("#modal-overlay .modal-box"); if (mb) mb.classList.remove("wide");   // rival profiles widen it
    /* Clear the contents, not just the visibility. A hidden modal that still
       holds the last decision's buttons is stale DOM: it confused an automated
       test into thinking a new decision had opened, and it would let a stray
       click land on a choice that no longer applies. */
    var b = el("modal-body");    if (b) b.innerHTML = "";
    var a = el("modal-actions"); if (a) a.innerHTML = "";
  }

  // ----------------------------------------------------------
  // JENKINS TUTORIAL — Year 1 quarterly guidance (optional)
  // ----------------------------------------------------------
  var TUTORIAL_SCRIPT = {
    "1-1": [
      {
        title: "Step 1: Borrow", task: "borrow",
        body: "Welcome aboard, boss. First we need cash to grow.<br><br>" +
              "Open <strong>Finance</strong>. Under <strong>Borrow</strong>, enter <strong>$50M</strong> for <strong>7 years</strong>, the longest bonds we can sell. Rates are low, so lock in long."
      },
      {
        title: "Step 2: A little equity", task: "equity",
        body: "Still on <strong>Finance</strong>, under <strong>Issue shares</strong>, sell about <strong>2M shares</strong>.<br><br>" +
              "Don't make a habit of it. It dilutes the owners, and <strong>Director Petrova</strong> hates dilution."
      }
    ],
    "1-2": [
      {
        title: "Step 3: Buy a building", task: "buy",
        body: "Put the cash to work. Open <strong>Properties</strong>, find one <strong>for sale</strong> and press <strong>Buy</strong>.<br><br>" +
              "Higher <strong>cap rate</strong> means more income for the price, but the highest yields are usually the riskiest. Click a row to see who pays the rent."
      }
    ],
    "1-3": [
      {
        title: "Step 4: Hire a CFO", task: "cfo",
        body: "Open <strong>Staff</strong> and hire a <strong>CFO</strong>. A CFO unlocks <strong>unsecured notes</strong> once secured bonds hit the covenant (Okafor will hate them), and an emergency private loan.<br><br>" +
              "Later: an Asset Manager lifts occupancy, an Acquisitions Lead finds better deals."
      }
    ],
    "1-4": [
      {
        title: "The board",
        body: "From next year the <strong>board votes</strong> on whether you keep your job. Five directors, each wants one thing. <strong>Chairman Williams</strong> matters most: he wants a <strong>rising dividend</strong> every year.<br><br>" +
              "Strong results earn <strong>political capital</strong>, which you spend to win board fights and handle tough events."
      }
    ],
  };

  function maybeShowTutorial() {
    if (!GameState._tutorialEnabled) return false;
    if (GameState.meta.year !== 1) return false;
    var key = GameState.meta.year + "-" + GameState.meta.quarter;
    var entry = TUTORIAL_SCRIPT[key];
    if (!entry) return false;
    if (GameState._tutorialShown && GameState._tutorialShown[key]) return false;
    GameState._tutorialShown = GameState._tutorialShown || {};
    GameState._tutorialShown[key] = true;
    var steps = Array.isArray(entry) ? entry : [entry];
    showJenkinsSequence(steps, 0);
    return true;
  }

  // Show a chain of Jenkins popups one after another (each "Got it" advances).
  function showJenkinsSequence(steps, i) {
    if (i >= steps.length) return;
    var step = steps[i];
    var moreLabel = (i < steps.length - 1) ? "Next" : "Got it";
    // 2.0: tutorial steps are inbox messages that tick themselves off
    if (typeof Inbox !== "undefined" && step.task) {
      Inbox.message("Jenkins", "Chief of Staff", step.title, step.body, null, step.task);
      showJenkinsSequence(steps, i + 1);
      return;
    }
    showJenkinsPopup(step.title, step.body, moreLabel, function() {
      showJenkinsSequence(steps, i + 1);
    });
  }

  // Jenkins portrait popup (tutorial + advisories)
  function showJenkinsPopup(title, body, btnLabel, onClose) {
    /* 2.0: Jenkins no longer interrupts. His notes arrive in the inbox beside
       the map; a sequence (tutorial steps) arrives as separate messages. */
    if (typeof Inbox !== "undefined") {
      Inbox.message("Jenkins", "Chief of Staff", String(title).replace(/^Jenkins\s*[—-]\s*/, ""), body);
      if (typeof onClose === "function") onClose();
      return;
    }
    var overlay = el("modal-overlay");
    if (!overlay) return;
    el("modal-title").textContent = title;
    el("modal-body").innerHTML =
      '<div style="display:flex;gap:12px;align-items:flex-start;">' +
        '<div style="font-size:13px;line-height:1.6;">' + body + '</div>' +
      '</div>';
    el("modal-actions").innerHTML = "";
    var btn = document.createElement("button");
    btn.textContent = btnLabel || "Got it";
    btn.className = "btn btn-primary";
    btn.onclick = function() {
      closeModal();
      if (typeof onClose === "function") setTimeout(onClose, 250);
    };
    el("modal-actions").appendChild(btn);
    overlay.classList.remove("hidden");
  }

  // ----------------------------------------------------------
  // TOAST
  // ----------------------------------------------------------
  function showToast(message, type) {
    if (!type) type = "info";
    var container = el("toast-container");
    if (!container) return;
    var toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() { toast.classList.add("toast-visible"); }, 10);
    setTimeout(function() {
      toast.classList.remove("toast-visible");
      setTimeout(function() { if (toast.parentNode) toast.remove(); }, 400);
    }, 3500);
  }

  // ----------------------------------------------------------
  // RENDER FUNCTIONS
  // ----------------------------------------------------------
  function renderHeader() {
    setText("hdr-company",   GameState.company.name);
    setText("hdr-period",    GameState.currentPeriodLabel());
    setText("hdr-price",     fmtPS(GameState.company.sharePrice));
    setText("hdr-marketcap", fmtM(GameState.company.marketCap));
    setText("hdr-rating",    GameState.credit.rating);
    setText("hdr-cycle",     GameState.market.cycle.charAt(0).toUpperCase() + GameState.market.cycle.slice(1));
    setText("hdr-rate",      fmt(GameState.market.baseInterestRate, 2) + "%");
    setText("hdr-borrow",    fmt(GameState.market.baseInterestRate + GameState.credit.spread, 2) + "%");
    var pct = GameState.board.pressurePoints / GameState.board.maxPressure;
    var bar = el("board-pressure-bar");
    var lbl = el("board-pressure-label");
    if (bar) {
      bar.style.width = Math.min(100, pct * 100) + "%";
      bar.style.background = pct > 0.75 ? "#ef4444" : pct > 0.50 ? "#f59e0b" : "#22c55e";
    }
    if (lbl) {
      var tag = GameState.meta.tutorialYear ? " [ORIENTATION — Safe]" : "";
      lbl.textContent = "Board: " + GameState.board.mood.toUpperCase() + tag + " — " + GameState.board.pressurePoints + "/" + GameState.board.maxPressure + " pressure points";
    }
  }

  function renderPnL() {
    var p = GameState.pnl;
    setText("pnl-gpr",       fmtM(p.grossPotentialRent));
    setText("pnl-vacancy",   "(" + fmtM(p.vacancyLoss) + ")");
    setText("pnl-opex",      "(" + fmtM(p.operatingExpenses) + ")");
    setText("pnl-noi",       fmtM(p.noi));
    setText("pnl-ga",        "(" + fmtM(p.gAndA) + ")");
    setText("pnl-interest",  "(" + fmtM(p.interestExpense) + ")");
    setText("pnl-depr",      "(" + fmtM(p.depreciation) + ")");
    setText("pnl-unusual",   fmtM(p.unusualItems));
    var lir = el("pnl-loanint-row"); if (lir) { lir.style.display = p.loanInterest ? "" : "none"; setText("pnl-loanint", fmtM(p.loanInterest || 0)); }
    setText("pnl-netincome", fmtM(p.netIncome));
    setText("pnl-ffo",       fmtM(p.ffo));
    setText("pnl-affo",      fmtM(p.affo));
    // round 28: lease ups in AFFO; renovations and building shown, not costed
    var lr = el("pnl-leasing-row"); if (lr) lr.style.display = p.leasingCosts > 0 ? "" : "none"; setText("pnl-leasing", "(" + fmtM(p.leasingCosts || 0) + ")");
    var pr = el("pnl-projects-row"); if (pr) pr.style.display = p.projects > 0 ? "" : "none"; setText("pnl-projects", fmtM(p.projects || 0));
    setText("pnl-prefdiv",   p.preferredDiv > 0 ? "(" + fmtM(p.preferredDiv) + ")" : "—");
    setText("pnl-divpaid",   "(" + fmtM(p.dividendsPaid) + ")");
    setText("pnl-retained",  fmtM(p.retainedCash));
    var retEl = el("pnl-retained");
    if (retEl) retEl.className = p.retainedCash >= 0 ? "text-green" : "text-red";
    var niEl = el("pnl-netincome");
    if (niEl) niEl.className = p.netIncome >= 0 ? "text-green" : "text-yellow";
  }

  function renderRatios() {
    var r = GameState.ratios;
    function sr(id, val, good, bad) {
      var e = el(id);
      if (!e) return;
      e.textContent = val;
      if (good !== undefined) e.className = good ? "text-green" : bad ? "text-red" : "text-yellow";
    }
    sr("ratio-ffo-ps",     fmtPS(r.ffoPerShare));
    sr("ratio-affo-ps",    fmtPS(r.affoPerShare));
    sr("ratio-div-cov",    r.dividendCoverage === null ? "N/A" : fmt(r.dividendCoverage, 2) + "x",  r.dividendCoverage !== null && r.dividendCoverage >= 1.2,    r.dividendCoverage !== null && r.dividendCoverage < 1.0);
    sr("ratio-payout",     r.payoutRatio === null ? "N/A" : fmtPct(r.payoutRatio),             r.payoutRatio !== null && r.payoutRatio < 0.85,         r.payoutRatio !== null && r.payoutRatio > 1.0);
    sr("ratio-d2a",        r.debtToAssets === null ? "N/A" : fmtPct(r.debtToAssets),            r.debtToAssets !== null && r.debtToAssets < 0.40,        r.debtToAssets !== null && r.debtToAssets > 0.60);
    sr("ratio-d2e",        r.debtToEbitda === null ? "N/A" : fmt(r.debtToEbitda, 1) + "x",      r.debtToEbitda !== null && r.debtToEbitda < 5,           r.debtToEbitda !== null && r.debtToEbitda > 8);
    sr("ratio-int-cov",    r.interestCoverage >= 99 ? "N/A" : fmt(r.interestCoverage, 1) + "x",  r.interestCoverage >= 2.5,    r.interestCoverage < 1.5);
    sr("ratio-occ",        fmtPct(r.occupancyPortfolio),      r.occupancyPortfolio >= 0.92, r.occupancyPortfolio < 0.80);
    sr("ratio-noi-margin", fmtPct(r.noiMargin),               r.noiMargin >= 0.45,          r.noiMargin < 0.30);
    sr("ratio-cap-rate",   fmt(r.impliedCapRate, 2) + "%");
    sr("ratio-nav",        fmtPS(r.navPerShare));
    sr("ratio-pffo",       r.pToFFO === null ? "N/A" : fmt(r.pToFFO, 1) + "x");
    sr("ratio-paffo",      r.pToAFFO === null ? "N/A" : fmt(r.pToAFFO, 1) + "x");
    sr("ratio-div-yield",  fmt(r.dividendYield, 2) + "%",     r.dividendYield > 4,          r.dividendYield < 2);
  }

  function renderBalanceSheet() {
    var b = GameState.balance;
    setText("bs-cash",   fmtM(b.cash));
    setText("bs-assets", fmtM(b.totalAssets));
    var ta = (typeof Story !== "undefined") ? Story.otherAssets() : 0, lr = el("bs-loans-row");
    if (lr) { lr.style.display = ta > 0 ? "" : "none"; setText("bs-loans", fmtM(ta)); }
    // live: bonds plus whatever is drawn on the credit line right now (round 3)
    setText("bs-debt",   fmtM(GameState.debtTranches.reduce(function(a, t) { return a + t.amount; }, 0) + Math.max(0, -GameState.balance.cash)));
    var prefEl = el("bs-preferred");
    if (prefEl) {
      var prefRow = prefEl.closest ? prefEl.closest(".bs-item") : null;
      if ((b.preferredEquity || 0) > 0) {
        setText("bs-preferred", fmtM(b.preferredEquity));
        if (prefRow) prefRow.style.display = "";
      } else {
        if (prefRow) prefRow.style.display = "none";
      }
    }
    setText("bs-equity", fmtM(b.totalEquity));
    setText("bs-shares", fmt(GameState.company.sharesOutstanding, 2) + "M");
    setText("bs-divps",  fmtPS(GameState.company.dividendPerShare));
    var cashEl = el("bs-cash");
    if (cashEl) {
      if (b.cash < 0)  cashEl.className = "bs-value text-red";
      else if (b.cash < 10) cashEl.className = "bs-value text-red";
      else if (b.cash < 25) cashEl.className = "bs-value text-yellow";
      else cashEl.className = "bs-value text-green";
      // 2.0: below zero is the credit line in use
      if (b.cash < 0) {
        cashEl.textContent = fmtM(b.cash) + " (credit line)";
      }
    }
  }

  function renderDebtPanel() {
    var container = el("debt-tranches-list");
    if (!container) return;
    if (GameState.debtTranches.length === 0) {
      container.innerHTML = '<p class="text-muted">No debt outstanding.</p>';
      return;
    }
    var html = "";
    GameState.debtTranches.forEach(function(t) {
      var u = t.quartersUntilMaturity <= 3 ? "tranche-red" : t.quartersUntilMaturity <= 7 ? "tranche-yellow" : "tranche-green";
      html += '<div class="tranche-row ' + u + '">' +
        '<div class="tranche-info">' +
        '<span class="tranche-label">' + t.label + '</span>' +
        '<span class="tranche-meta">' + t.quartersUntilMaturity + 'q · ' + t.rate + '% · $' + fmt(t.amount, 1) + 'M</span>' +
        '</div><div class="tranche-actions">' +
        '<button class="btn btn-sm btn-danger" onclick="UI.confirmRetireDebt(\'' + t.id + '\')">Call</button>' +
        '</div></div>';
    });
    container.innerHTML = html;
    var countEl = el("debt-tranche-count");
    if (countEl) {
      var c = GameState.debtTranches.length;
      countEl.textContent = c + "/10 tranches";
      countEl.className = c >= 9 ? "text-red" : c >= 7 ? "text-yellow" : "text-green";
    }
  }

  // BOARD ATTITUDES PANEL
  // NEWS TERMINAL (legacy element removed — feed now merged into the quarter report)
  function renderNews() {
    var feed = el("news-feed");
    if (!feed) return; // panel removed; actions now render inside the quarter report
    var items = (typeof News !== "undefined" && News.getFeed) ? News.getFeed() : [];
    if (items.length === 0) {
      feed.innerHTML = '<p class="text-muted" style="font-size:11px">No headlines yet.</p>';
      return;
    }
    var catColor = {
      capital:"news-capital", debt:"news-debt", dividend:"news-dividend",
      rating:"news-rating", market:"news-market", board:"news-board",
      property:"news-property", staff:"news-staff", ambient:"news-ambient"
    };
    var html = "";
    items.slice(0, 30).forEach(function(it) {
      var cls = catColor[it.category] || "news-market";
      html += '<div class="news-item">' +
        '<span class="news-period">Y' + it.year + 'Q' + it.quarter + '</span>' +
        '<span class="news-dot ' + cls + '">●</span>' +
        '<span class="news-text">' + it.text + '</span>' +
        '</div>';
    });
    feed.innerHTML = html;
  }

  // STAFF ROSTER + TALENT MARKET
  function renderStaff() {
    var roster = el("staff-roster");
    var market = el("talent-market");
    if (!roster || !market) return;

    // Roster of hired staff — court-style cards with portrait
    var rh = "";
    GameState.staff.forEach(function(s) {
      var traitClass = Staff.traitColor(s);
      var traitTxt   = Staff.traitLabel(s);
      var traitDesc  = Staff.traitDesc(s);
      rh += '<div class="staff-row">' +
        '<img class="staff-portrait" src="assets/staff/' + (s.portrait || "s01.jpg") + '" alt="' + s.name + '">' +
        '<div class="staff-info">' +
          '<div class="staff-name-row"><span class="staff-name">' + s.name + '</span><span class="staff-stars">' + (s.stars || "") + '</span></div>' +
          '<div class="staff-title">' + s.title + '</div>' +
          '<div class="staff-trait ' + traitClass + '">' + traitTxt + (traitDesc ? ' — <span class="text-muted">' + traitDesc + '</span>' : '') + '</div>' +
        '</div>' +
        '<div class="staff-right">' +
          '<div class="staff-cost">$' + fmt(s.salary, 2) + 'M/q</div>' +
          '<button class="btn btn-sm btn-danger" onclick="UI.fireStaff(\'' + s.roleId + '\')">Fire</button>' +
        '</div>' +
        '</div>';
    });


    if (typeof Levi !== "undefined" && Levi.staffHTML) rh = Levi.staffHTML() + rh;   // round 20: the strategy advisor
    if (rh === "") {
      roster.innerHTML = '<p class="text-muted" style="font-size:12px">No staff hired yet. Browse the talent market below.</p>';
    } else {
      roster.innerHTML = rh;
    }

    // Talent market — grouped by role, 3 candidates each
    var tm = GameState._talentMarket || [];
    var header = el("talent-market-header");
    if (tm.length === 0) {
      if (header) header.style.display = "none";
      var allFilled = Object.keys(Staff.ROLES).every(function(r) { return Staff.isRoleFilled(r); });
      market.innerHTML = allFilled
        ? '<p class="text-muted" style="font-size:12px">✓ Your executive team is complete — every role is filled. Fire someone to open a search, or new candidates appear next year for any vacancy.</p>'
        : '<p class="text-muted" style="font-size:12px">No candidates available. New ones appear next year.</p>';
      return;
    }
    if (header) header.style.display = "";
    // Group candidates by role, preserving global index for hire()
    var byRole = {};
    tm.forEach(function(c, i) {
      (byRole[c.roleId] = byRole[c.roleId] || []).push({ c: c, i: i });
    });
    var mh = "";
    Object.keys(byRole).forEach(function(roleId) {
      var role = Staff.ROLES[roleId];
      mh += '<div class="talent-role-header">' + role.title + ' <span class="text-muted">— ' + role.unlocks + '</span></div>';
      byRole[roleId].forEach(function(entry) {
        var c = entry.c, i = entry.i;
        mh += '<div class="candidate-card">' +
          '<img class="candidate-portrait" src="assets/staff/' + (c.portrait || "s01.jpg") + '" alt="' + c.name + '">' +
          '<div class="candidate-body">' +
            '<div class="candidate-head">' +
              '<span class="candidate-title">' + c.name + ' <span class="staff-stars">' + (c.stars || "") + '</span></span>' +
              '<span class="candidate-salary">$' + fmt(c.salary, 2) + 'M/q</span>' +
            '</div>' +
            '<div class="candidate-hint">"' + c.hint + '"</div>' +
            '<button class="btn btn-sm btn-primary" onclick="UI.hireStaff(' + i + ')">Hire — $' + fmt(c.salary,2) + 'M/q</button>' +
          '</div>' +
          '</div>';
      });
    });
    market.innerHTML = mh;
  }

  function hireStaff(marketIndex) {
    var tm = GameState._talentMarket || [];
    var candidate = tm[marketIndex];
    if (!candidate) return;
    var r = Staff.hire(candidate);
    showToast(r.message, r.success ? "success" : "error");
    if (r.success) renderAll();
  }

  function fireStaff(roleId) {
    var s = Staff.getStaff(roleId);
    if (!s) return;
    showModal("Dismiss " + s.name + "?",
      "Role: " + s.title + "\n" +
      "Severance: $" + fmt(s.salary, 2) + "M (one quarter)\n\n" +
      "WARNING: Firing removes all functions this role unlocks. " +
      "Any in-progress benefits will stop.",
      [{ label: "Confirm Dismissal", style: "btn-danger", onClick: function() {
        var r = Staff.fire(roleId);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) renderAll();
      }}]);
  }

  function renderBoardAttitudes() {
    var container = el("board-attitudes-list");
    var capEl     = el("ba-capital-display");
    if (!container) return;

    var directors = GameState.board.directors;
    if (!directors || directors.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:11px">Start game to see board.</p>';
      return;
    }

    var names = { williams:"Williams", chen:"Chen", okafor:"Okafor", petrova:"Petrova", hassan:"Hassan" };
    var focus = {
      williams:"Dividends",
      chen:"Growth & FFO",
      okafor:"Leverage & Risk",
      petrova:"Share Price",
      hassan:"Occupancy"
    };
    var html = "";
    directors.forEach(function(d) {
      var att      = Math.round(d.attitude * 10) / 10;
      var pct      = (d.attitude / 10) * 100;
      var color    = d.attitude < 3 ? "#ef4444" : d.attitude >= 7 ? "#22c55e" : "#f59e0b";
      var hostile  = d.attitude < 3 ? " 🔴" : "";
      html += '<div class="ba-row">' +
        '<span class="ba-name">' + (names[d.id] || d.id) + hostile +
          '<span class="ba-focus">' + (focus[d.id] || "") + '</span>' +
        '</span>' +
        '<div class="ba-bar"><div class="ba-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
        '<span class="ba-score" style="color:' + color + '">' + fmt(att, 1) + '</span>' +
        '</div>';
    });
    container.innerHTML = html;

    if (capEl) {
      var cap = GameState.board.politicalCapital || 0;
      var max = GameState.board.maxCapital || 5;
      var dots = "";
      for (var i = 0; i < max; i++) dots += i < cap ? "●" : "○";
      capEl.textContent = dots + " (" + cap + "/" + max + ")";
    }
  }

  // Jenkins maturity warning: fires when a tranche matures within 2 quarters
  // and current cash can't cover it.
  function getJenkinsMaturityWarning() {
    if (!GameState.debtTranches || GameState.debtTranches.length === 0) return null;
    var soon = GameState.debtTranches.filter(function(t) {
      return t.quartersUntilMaturity > 0 && t.quartersUntilMaturity <= 2;
    });
    if (soon.length === 0) return null;
    var totalDue = soon.reduce(function(sum, t) { return sum + t.amount; }, 0);
    if (GameState.balance.cash >= totalDue) return null;
    var shortfall = fmt(totalDue - GameState.balance.cash);
    var q = soon[0].quartersUntilMaturity;
    return "$" + fmt(totalDue) + "M of debt matures within " + q + " quarter" + (q === 1 ? "" : "s") +
           " and we're $" + shortfall + "M short. Issue debt now while our rating holds, or sell an asset before we're forced to at fire-sale prices.";
  }

  // MARKET CONDITIONS PANEL
  function renderMarketConditions() {
    var container = el("market-conditions-list");
    if (!container) return;

    var capRates  = GameState.market.capRates;
    // Use stored baseline or current rates as baseline if no history
    var baselines = GameState.market.baselineCapRates || {
      office: 6.1, industrial: 5.0, multifamily: 5.5, retail: 6.6
    };
    var sectors   = ["office", "industrial", "multifamily", "retail"];
    var labels    = { office:"Office", industrial:"Industrial", multifamily:"Multifamily", retail:"Retail" };

    var html = "";

    // Jenkins advisory — maturity shortfall warning (1-2 quarters out)
    var jenkinsWarning = getJenkinsMaturityWarning();
    if (jenkinsWarning) {
      html += '<div class="jenkins-warning">⚠ <strong>Jenkins:</strong> ' + jenkinsWarning + '</div>';
    }

    sectors.forEach(function(s) {
      // Average cap rate across locations for this sector
      var avg = (capRates[s].tier1 + capRates[s].tier2 + capRates[s].suburban) / 3;
      avg = Math.round(avg * 100) / 100;
      var base = baselines[s];
      var diff = avg - base;

      var icon, signal;
      if (diff > 1.5)       { icon = "🔴"; signal = "Distressed — buy opportunity"; }
      else if (diff > 0.5)  { icon = "🟡"; signal = "Weakening — values falling"; }
      else if (diff > -0.5) { icon = "🔵"; signal = "Stable"; }
      else                   { icon = "🟢"; signal = "Booming — values rising"; }

      var arrow = diff > 0.1 ? "↑" : diff < -0.1 ? "↓" : "≈";
      var rateColor = diff > 0.5 ? "text-red" : diff < -0.5 ? "text-green" : "";

      html += '<div class="mc-row">' +
        '<span class="mc-icon">' + icon + '</span>' +
        '<span class="mc-sector">' + labels[s] + '</span>' +
        '<span class="mc-rate ' + rateColor + '">' + fmt(avg, 1) + '% ' + arrow + '</span>' +
        '<span class="mc-signal">' + signal + '</span>' +
        '</div>';
    });
    container.innerHTML = html;
  }

  // Board Goals panel — shows the current year's active mandates with live
  // met/unmet indicators, driven by the real mandate system.
  function renderGoalsPanel() {
    var container = el("goals-list");
    var yearLabel = el("goals-year-label");
    if (!container) return;

    var mandates = GameState.board.activeMandates || [];
    if (mandates.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:12px">The board sets your targets at the first annual meeting (end of Year 1).</p>';
      if (yearLabel) yearLabel.textContent = "Board Goals";
      return;
    }
    if (yearLabel) yearLabel.textContent = "Year " + GameState.meta.year + " Board Mandates";

    var r = GameState.ratios;
    var co = GameState.company;
    var b = GameState.board;
    var curPortfolio = GameState.portfolio.reduce(function(s, p) { return s + p.currentValue; }, 0);
    var worstOcc = GameState.portfolio.length > 0
      ? Math.min.apply(null, GameState.portfolio.map(function(p) { return p.occupancy; })) : 1;

    // Live current value for each metric (mirrors evaluateMandates)
    function liveValue(metric) {
      switch (metric) {
        case "dividendGrowthPct":   return b.startYearDividend > 0 ? (co.dividendPerShare - b.startYearDividend) / b.startYearDividend * 100 : 0;
        case "noDividendCut":       return co.dividendPerShare >= (b.startYearDividend || 0) ? 1 : 0;
        case "acquisitionsThisYear":return b.acquisitionsThisYear || 0;
        case "accretiveBuysThisYear":return b.accretiveBuysThisYear || 0;
        case "noUnsecured":         return GameState.debtTranches.some(function(t) { return t.unsecured; }) ? 0 : 1;
        case "ffoGrowthPct":        return GameState._lastFFOGrowthPct || 0;
        case "portfolioGrowthPct":  return (b.startYearPortfolio > 0) ? (curPortfolio - b.startYearPortfolio) / b.startYearPortfolio * 100 : 0;
        case "debtToAssets":        return (r.debtToAssets || 0) * 100;
        case "interestCoverage":    return r.interestCoverage >= 99 ? 99 : r.interestCoverage;
        case "noOverdraft":         return b.noOverdraftBroken ? 0 : 1;
        case "noDebtIncrease":      return GameState.balance.totalDebt <= (b.startYearDebt || GameState.balance.totalDebt) + 0.5 ? 1 : 0;
        case "sharePriceHeld":      return co.sharePrice >= (b.startYearSharePrice || co.sharePrice) ? 1 : 0;
        case "sharePriceGrowthPct": return (b.startYearSharePrice > 0) ? (co.sharePrice - b.startYearSharePrice) / b.startYearSharePrice * 100 : 0;
        case "noEquityIssued":      return b.noEquityBroken ? 0 : 1;
        case "occupancyPortfolio":  return (r.occupancyPortfolio || 0) * 100;
        case "worstOccupancy":      return worstOcc * 100;
        case "leaseUpsThisYear":    return b.leaseUpsThisYear || 0;
        default: return 0;
      }
    }

    // 2.0: every goal shows where you stand and the number to hit
    var now = Board.metricNow();
    var html = "";
    mandates.forEach(function(m) {
      if (m.response === "reject") {
        html += '<div class="goal-row"><span class="goal-icon">⊘</span><span class="goal-metric">' + dirShort(m.directorId) + ': ' + m.text + '</span><span class="goal-target text-muted">refused</span></div>';
        return;
      }
      var t = Board.targetFor(m), v = now[m.metric];
      var met = m.higher ? v >= t : v <= t;
      var nums = Board.mandateNumbers(m);
      var tgt = nums.binary ? "" : (m.higher ? "≥ " : "≤ ") + Board.fmtMetric(m, t);
      html += '<div class="goal-row">' +
        '<span class="goal-icon ' + (met ? "text-green" : "text-yellow") + '">' + (met ? "✓" : "…") + '</span>' +
        '<span class="goal-metric" style="font-size:11px;">' + dirShort(m.directorId) + ': ' + m.text + (nums.how && !met ? '<span style="display:block;color:#7a8794;font-size:10.5px">How: ' + nums.how + '.</span>' : '') + '</span>' +
        '<span class="goal-target ' + (met ? "text-green" : "") + '" style="font-size:11px;white-space:nowrap">now ' + Board.fmtMetric(m, v) + (tgt ? " · " + tgt : "") + '</span>' +
        '</div>';
    });
    container.innerHTML = html;
  }

  function dirShort(id) {
    var names = { williams: "Williams", chen: "Chen", okafor: "Okafor", petrova: "Petrova", hassan: "Hassan", activist: "Marlowe", mansour: "Mansour", grace: "Grace", tex: "Tex" };
    return names[id] || id;
  }

  function getPropertyIndicator(p) {
    if (p.underConstruction) {
      var label = p.constructionType === "renovation" ? "Renovating" : "Repositioning";
      return { icon: "🔨", tip: label + " — " + p.constructionQuartersLeft + " quarter(s) remaining" };
    }
    if (p.occupancy < 0.70)  return { icon: "🔴", tip: "Critical — occupancy below 70%" };
    if (p.occupancy < 0.80)  return { icon: "🟡", tip: "Needs attention — below 80%" };
    if (p.occupancy < 0.90)  return { icon: "🔵", tip: "Stable — 80-90% occupied" };
    return { icon: "🟢", tip: "Performing well — above 90%" };
  }

  function renderPortfolio() {
    var container = el("portfolio-list");
    if (!container) return;
    if (GameState.portfolio.length === 0) {
      container.innerHTML = '<p class="text-muted">No properties owned. Buy from the market.</p>';
      return;
    }
    var html = "";
    GameState.portfolio.forEach(function(p) {
      var oc = p.occupancy >= 0.90 ? "text-green" : p.occupancy >= 0.80 ? "text-yellow" : "text-red";
      var gl = p.purchasePrice ? fmt(p.currentValue - p.purchasePrice, 1) : 0;
      var gc = gl >= 0 ? "text-green" : "text-red";
      // Lease Up button — requires Asset Manager, grey/disabled if used this year
      var leaseUpBtn = "";
      if (p.occupancy < 0.90 && !p.underConstruction && Staff.hasRole("asset")) {
        var usedThisYear = p.leaseUpYear === GameState.meta.year;
        leaseUpBtn = usedThisYear
          ? '<button class="btn btn-sm btn-secondary" disabled style="opacity:0.4;cursor:not-allowed" title="Already leased up this year — available Year ' + (GameState.meta.year + 1) + '">✓ Leased Up</button>'
          : '<button class="btn btn-sm btn-primary" onclick="UI.leaseUp(\'' + p.id + '\')">Lease Up</button>';
      }

      // Upgrade buttons
      var upgradeHTML = "";
      if (p.underConstruction) {
        var constructionLabel = p.constructionType === "renovation" ? "🔨 Renovating" : "🔄 Repositioning";
        upgradeHTML = '<span class="upgrade-badge">' + constructionLabel + ' — ' + p.constructionQuartersLeft + 'q left</span>';
      } else {
        var canRen = Properties.canRenovate(p);
        var canRepo = Properties.canReposition(p);
        if (canRen.ok) {
          var renCost = fmt(p.currentValue * 0.10, 1);
          upgradeHTML += '<button class="btn btn-sm btn-upgrade" onclick="UI.confirmRenovate(\'' + p.id + '\')">🔨 Renovate $' + renCost + 'M</button>';
        } else if (p.renovated) {
          upgradeHTML += '<span class="upgrade-badge upgrade-done">✓ Renovated</span>';
        }
        if (canRepo.ok) {
          var repoCost = fmt(p.currentValue * 0.15, 1);
          upgradeHTML += '<button class="btn btn-sm btn-upgrade-repo" onclick="UI.confirmReposition(\'' + p.id + '\')">🔄 Reposition $' + repoCost + 'M</button>';
        } else if (p.repositioned) {
          upgradeHTML += '<span class="upgrade-badge upgrade-done">✓ Repositioned</span>';
        }
      }
      var indicator = getPropertyIndicator(p);
      html += '<div class="property-card">' +
        '<div class="prop-header">' +
        '<span class="prop-indicator" title="' + indicator.tip + '">' + indicator.icon + '</span>' +
        '<span class="prop-name">' + p.name + '</span>' +
        '<span class="prop-tag tag-' + p.sector + '">' + p.sector + ' · ' + p.location + '</span></div>' +
        '<div class="prop-stats">' +
        '<span>Value: <strong>' + fmtM(p.currentValue) + '</strong></span>' +
        '<span>NOI: <strong>' + fmtM(p.annualNOI) + '/yr</strong></span>' +
        '<span>Occ: <strong class="' + oc + '">' + fmtPct(p.occupancy) + '</strong></span>' +
        '<span>G/L: <strong class="' + gc + '">' + (gl >= 0 ? "+" : "") + gl + 'M</strong></span>' +
        '</div><div class="prop-actions">' +
        leaseUpBtn +
        upgradeHTML +
        '<button class="btn btn-sm btn-danger" onclick="UI.confirmSellProperty(\'' + p.id + '\')">Sell</button>' +
        '</div></div>';
    });
    container.innerHTML = html;
  }

  function renderPropertyMarket() {
    var container = el("market-list");
    if (!container) return;
    var html = "";
    GameState.propertyMarket.forEach(function(p) {
      // Actual cap rate of THIS property = NOI ÷ asking price (not the generic
      // sector market rate). This is what makes a mega-deal visibly attractive.
      var cr = p.askingPrice > 0 ? Math.round((p.annualNOI / p.askingPrice) * 1000) / 10 : 0;
      var ca = ((typeof Revolver !== "undefined" && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash) >= p.askingPrice;
      var megaTag = p.isMega
        ? '<div class="mega-flag">★ Off-market mega-asset · ' + (p.megaCapRate ? p.megaCapRate + '% cap rate · ' : '') + 'single tenant: ' + (p.megaTenant || "anchor") + '</div>'
        : '';
      html += '<div class="property-card ' + (ca ? "" : "prop-unaffordable") + (p.isMega ? " prop-mega" : "") + '">' +
        '<div class="prop-header"><span class="prop-name">' + p.name + '</span>' +
        '<span class="prop-tag tag-' + p.sector + '">' + p.sector + ' · ' + p.location + '</span></div>' +
        megaTag +
        '<div class="prop-stats">' +
        '<span>Ask: <strong>' + fmtM(p.askingPrice) + '</strong></span>' +
        '<span>NOI: <strong>' + fmtM(p.annualNOI) + '/yr</strong></span>' +
        '<span>Occ: <strong>' + fmtPct(p.occupancy) + '</strong></span>' +
        '<span>Cap: <strong>' + cr + '%</strong></span>' +
        '</div><div class="prop-actions">' +
        '<button class="btn btn-sm btn-primary" onclick="UI.confirmBuyProperty(\'' + p.id + '\')" ' +
        (ca ? "" : 'disabled') + '>Buy ' + fmtM(p.askingPrice) + '</button>' +
        '</div></div>';
    });
    container.innerHTML = html;
  }

  function renderEarningsReport(report) {
    if (!report) return;
    var container = el("earnings-report");
    if (!container) return;

    var y = GameState.meta.year, q = GameState.meta.quarter;

    // ---- EVENTS (loud — the things that happened TO you) ----
    var eventsHTML = "";
    if (report.firedEvents && report.firedEvents.length > 0) {
      report.firedEvents.forEach(function(e) {
        // tone: harmful = bad (red), explicit good keywords = good (green), else neutral
        var tone = "neutral";
        if (e.harmful) tone = "bad";
        else if (/Boom|Windfall|Signed|Approval|Surge|Prestige|Shortage|Rate Cut|Cuts Rates|cheaper|relief/i.test(e.headline + " " + (e.impact||""))) tone = "good";
        else if (/Fed|Rate|Cycle|Regulation/i.test(e.headline)) tone = "neutral";
        eventsHTML +=
          '<div class="feed-event feed-' + tone + '">' +
          '<div class="feed-event-head">' + e.headline + '</div>' +
          (e.impact ? '<div class="feed-event-impact">' + e.impact + '</div>' : '') +
          '</div>';
      });
    }

    // ---- YOUR ACTIONS (quiet — you already know you did these) ----
    var actionsHTML = "";
    var feed = (typeof News !== "undefined" && News.getFeed) ? News.getFeed() : [];
    var thisQ = feed.filter(function(it) {
      return it.year === y && it.quarter === q &&
        (it.category === "capital" || it.category === "debt" || it.category === "dividend" || it.category === "staff" || it.category === "property");
    });
    if (thisQ.length > 0) {
      actionsHTML = '<div class="feed-actions">';
      thisQ.slice(0, 6).forEach(function(it) {
        actionsHTML += '<div class="feed-action-line">· ' + it.text + '</div>';
      });
      actionsHTML += '</div>';
    }

    // ---- BOTTOM LINE (loud — the punchline) ----
    var rc = (report.retainedCash !== undefined) ? report.retainedCash
           : (GameState.pnl ? GameState.pnl.retainedCash : 0);
    var rcGood = rc >= 0;
    var verdict = rcGood ? "gained ground" : "lost ground";
    var bottomHTML =
      '<div class="feed-bottom ' + (rcGood ? "feed-good" : "feed-bad") + '">' +
        '<span class="feed-bottom-label">Retained Cash this quarter</span>' +
        '<span class="feed-bottom-num">' + (rc >= 0 ? "+" : "") + fmtM(rc) + ' ' + (rcGood ? "▲" : "▼") + '</span>' +
        '<span class="feed-bottom-verdict">' + verdict + '</span>' +
      '</div>' +
      '<div class="feed-bottom-detail">Rental income ' + fmtM(report.netRentalIncome !== undefined ? report.netRentalIncome : (GameState.pnl ? GameState.pnl.noi : 0)) +
        ' · interest ' + fmtM(-(GameState.pnl ? GameState.pnl.interestExpense : 0)) +
        ' · dividends ' + fmtM(-(GameState.pnl ? GameState.pnl.dividendsPaid : 0)) +
        (GameState.pnl && GameState.pnl.unusualItems ? ' · one-offs ' + fmtM(GameState.pnl.unusualItems) : '') +
        '</div>';

    if (typeof Inbox !== "undefined") {
      var evs = (report.firedEvents || []).map(function(e) {
        var tone = "neutral";
        if (e.harmful) tone = "bad";
        else if (/Boom|Windfall|Signed|Approval|Surge|Prestige|Shortage|Rate Cut|Cuts Rates|cheaper|relief|renewed|re-let|New tenants/i.test(e.headline + " " + (e.impact||""))) tone = "good";
        return { headline: e.headline, impact: e.impact, tone: tone, more: e.more || "", macro: !!e.isMacro, src: e.src || "news" };
      });
      // your actions belong to the quarter just played, not the one starting
      var dq = GameState.meta.totalQuarters, py = Math.floor((dq - 1) / 4) + 1, pq = (dq - 1) % 4 + 1;
      var acts = feed.filter(function(it) {
        return it.year === py && it.quarter === pq &&
          /^(capital|debt|dividend|staff|property)$/.test(it.category);
      }).map(function(it) { return it.text; });
      Inbox.ingestReport(report, evs, acts);
    }

    container.innerHTML =
      '<div class="panel-header"><span class="panel-title">📋 Quarter Report — Year ' + y + ', Q' + q + '</span></div>' +
      '<div class="panel-body feed-body">' +
        (eventsHTML || '<div class="feed-quiet-note">A quiet quarter — no major events.</div>') +
        bottomHTML +
        actionsHTML +
      '</div>';
  }

  // NEW: Updated to show term-adjusted rates
  function renderCapitalActions() {
    var baseRate = Market.getCurrentBorrowingRate();
    var getRateStr = function(y) { return Financials.getCurrentBorrowingRateForTerm ? fmt(Financials.getCurrentBorrowingRateForTerm(y), 2) : fmt(baseRate, 2); };
    setText("action-borrow-rate",
      "1yr: " + getRateStr(1) + "% | " +
      "3yr: " + getRateStr(3) + "% | " +
      "5yr: " + getRateStr(5) + "% | " +
      "7yr: " + getRateStr(7) + "%"
    );
    // Live borrowing capacity (80% LTV against portfolio)
    var pv = GameState.portfolio.reduce(function(s, p) { return s + p.currentValue; }, 0);
    var cd = GameState.debtTranches.reduce(function(s, t) { return s + t.amount; }, 0);
    var cap = Math.max(0, Math.round((pv * 0.80 - cd) * 10) / 10);
    var capEl = el("action-borrow-capacity");
    // 2.0 round 3: the binding limit is the bond covenant (total debt <= 60% of assets)
    var _dAll = cd + Math.max(0, -GameState.balance.cash), _aAll = pv + Math.max(0, GameState.balance.cash);
    var _lim = Financials.covenantLimit ? Financials.covenantLimit() : 0.60;
    var _room = Math.max(0, Math.floor((_lim * _aAll - _dAll) / (1 - _lim)));
    if (capEl) setText("action-borrow-capacity", "Room to borrow: " + fmtM(Math.min(cap, _room)) + " (debt is " + (_aAll > 0 ? Math.round(_dAll / _aAll * 100) : 0) + "% of assets; bonds allow " + Math.round(_lim * 100) + "%)");
    // Update dropdown to show rates next to each option
    var sel = el("input-debt-years");
    if (sel) {
      [[1,"1yr"],[2,"2yr"],[3,"3yr"],[5,"5yr"],[7,"7yr"]].forEach(function(t, i) {
        if (sel.options[i]) {
          sel.options[i].text = t[1] + " — " + getRateStr(t[0]) + "%";
        }
      });
    }
    setText("action-div-current", "$" + fmt(GameState.company.dividendPerShare, 2) + " /share each quarter");
    var equityUsedThisYear = GameState.company.equityIssuanceYear === GameState.meta.year;
    var debtCooldown = GameState.company.debtIssuanceQuarter > 0 ?
      Math.max(0, 2 - (GameState.meta.totalQuarters - GameState.company.debtIssuanceQuarter)) : 0;
    setText("action-shares-out", "Shares: " + fmt(GameState.company.sharesOutstanding, 2) + "M" +
      (equityUsedThisYear ? " ⚠ Equity used this year — available Year " + (GameState.meta.year + 1) : ""));
    setText("action-debt-cooldown", debtCooldown > 0 ?
      "⚠ Debt on cooldown — available in " + debtCooldown + " quarter(s)" : "");
    setText("action-cash-avail",  "Cash available: " + fmtM(GameState.balance.cash));
    // Preferred stock redeem card — only when preferred is outstanding
    var prefGroup = el("preferred-redeem-group");
    if (prefGroup) {
      var pref = GameState.preferred;
      if (pref && pref.issued && pref.outstanding > 0) {
        prefGroup.style.display = "";
        // round 17b: one row per series; each can be bought back at par once it is 5 years old
        var info = el("action-preferred-info"), list = Financials.prefList ? Financials.prefList() : [];
        if (info) info.innerHTML = list.map(function(s) {
          return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin:3px 0">' +
            '<span>' + fmtM(s.amount) + ' at ' + (s.rate * 100).toFixed(2) + '%' + (s.why ? ' <span style="color:#7a8794">(' + (Financials.prefPurpose ? Financials.prefPurpose(s.why) : s.why) + ')</span>' : '') + '<br><span style="color:#7a8794;font-size:11px">sold ' + s.issuedLabel + ' · ' + (s.callable ? 'callable now' : 'callable from ' + s.callLabel) + '</span></span>' +
            '<button class="btn btn-secondary btn-sm" onclick="UI.redeemPref(\'' + s.id + '\')"' + (s.callable ? '' : ' disabled title="Preferred shares cannot be bought back in their first 5 years"') + '>Redeem at par</button></div>';
        }).join("") + '<div style="color:#7a8794;font-size:11px;margin-top:4px">Total ' + fmtM(pref.outstanding) + ': ' + fmtM(pref.outstanding * pref.dividendRate / 4) + ' a quarter before the common dividend. New preferred shares are only sold for the big decisions, with the board\u2019s approval.</div>';
        var rb = el("btn-redeem-preferred"); if (rb) rb.style.display = "none";
      } else {
        prefGroup.style.display = "none";
      }
    }
  }

  function renderAll(report) {
    renderHeader();
    renderPnL();
    renderRatios();
    renderBalanceSheet();
    renderDebtPanel();
    renderGoalsPanel();
    renderBoardAttitudes();
    renderMarketConditions();
    renderStaff();
    renderNews();
    renderPortfolio();
    renderPropertyMarket();
    renderCapitalActions();
    if (report) renderEarningsReport(report);
    Charts.renderAll();
    // 2.0 tabs (Map, Properties) redraw from live state on every refresh.
    if (window.REIT && REIT.refresh) REIT.refresh();
    // 2.0: autosave (save.js). Every render follows a quarter or an action.
    if (typeof Save !== "undefined") Save.save();
  }

  // ----------------------------------------------------------
  // ANNUAL REPORT
  // ----------------------------------------------------------
  function showAnnualReport(snapshot) {
    if (!snapshot) return;
    var overlay = el("annual-report-overlay");
    var content = el("annual-report-content");
    if (!overlay || !content) return;
    var isY1 = snapshot.year === 1;
    function arw(a, b) { return a < b ? '<span class="text-green">▲</span>' : a > b ? '<span class="text-red">▼</span>' : "→"; }
    var ratingOrder = ["CCC","B","BB","BBB","A","AA","AAA"];
    var si = ratingOrder.indexOf(snapshot.startRating);
    var ei = ratingOrder.indexOf(snapshot.endRating);
    var ra = ei > si ? '<span class="text-green">▲</span>' : ei < si ? '<span class="text-red">▼</span>' : "→";
    var goalsHTML = "";
    if (snapshot.boardAssessment && snapshot.boardAssessment.goalResults) {
      goalsHTML = '<div class="ar-section"><div class="ar-section-title">Goal Performance</div>';
      snapshot.boardAssessment.goalResults.forEach(function(g) {
        goalsHTML += '<div class="ar-goal ' + (g.met ? "ar-goal-met" : "ar-goal-missed") + '">' + (g.met ? "✅" : "❌") + ' ' + g.metric + ': ' + g.target + '</div>';
      });
      goalsHTML += '</div>';
    }
    var ngHTML = "";
    if (snapshot.nextYearGoals && snapshot.nextYearGoals.length > 0) {
      ngHTML = '<div class="ar-section"><div class="ar-section-title">Year ' + (snapshot.year + 1) + ' Board Targets</div>';
      snapshot.nextYearGoals.forEach(function(g) { ngHTML += '<div class="ar-goal">▸ ' + g.metric + ': ' + g.target + '</div>'; });
      ngHTML += '</div>';
    }
    var evHTML = "";
    if (snapshot.yearEvents && snapshot.yearEvents.length > 0) {
      evHTML = '<div class="ar-section"><div class="ar-section-title">Key Events</div>';
      snapshot.yearEvents.forEach(function(e) { evHTML += '<div class="ar-event">▸ ' + e.headline + '</div>'; });
      evHTML += '</div>';
    }
    var sp = snapshot.boardAssessment ? (snapshot.boardAssessment.startingPressure || 0) : 0;
    var pnote = isY1 ? '<p class="ar-pressure-note">Starting Year 2 with <strong>' + sp + ' pressure point(s)</strong> on record.</p>' : "";
    content.innerHTML =
      '<div class="ar-header">' +
      '<div class="ar-logo">' + GameState.company.name + '</div>' +
      '<div class="ar-year">Annual Report — Year ' + snapshot.year + '</div>' +
      (isY1 ? '<div class="ar-badge">Orientation Year Complete</div>' : '') +
      '</div>' +
      '<div class="ar-grid">' +
      '<div class="ar-section"><div class="ar-section-title">Share Performance</div>' +
      '<div class="ar-row"><span>Share Price</span><span>' + arw(snapshot.endPrice, snapshot.startPrice) + ' $' + snapshot.startPrice + ' → $' + snapshot.endPrice + ' (' + (snapshot.priceChg >= 0 ? "+" : "") + snapshot.priceChg + '%)</span></div></div>' +
      '<div class="ar-section"><div class="ar-section-title">Full Year Financials</div>' +
      '<div class="ar-row"><span>Total Revenue</span><span>' + fmtM(snapshot.totalRevenue) + '</span></div>' +
      '<div class="ar-row"><span>Total NOI</span><span>' + fmtM(snapshot.totalNOI) + '</span></div>' +
      '<div class="ar-row"><span>Total FFO</span><span class="text-green">' + fmtM(snapshot.totalFFO) + '</span></div>' +
      '<div class="ar-row"><span>Dividends Paid</span><span>' + fmtM(snapshot.totalDividends) + '</span></div>' +
      '<div class="ar-row"><span>Avg Coverage</span><span class="' + (snapshot.avgCoverage >= 1.0 ? "text-green" : "text-red") + '">' + fmt(snapshot.avgCoverage, 2) + 'x</span></div>' +
      '</div>' +
      '<div class="ar-section"><div class="ar-section-title">Balance Sheet</div>' +
      '<div class="ar-row"><span>Total Assets</span><span>' + arw(snapshot.endAssets, snapshot.startAssets) + ' ' + fmtM(snapshot.startAssets) + ' → ' + fmtM(snapshot.endAssets) + '</span></div>' +
      '<div class="ar-row"><span>Total Debt</span><span>' + fmtM(snapshot.startDebt) + ' → ' + fmtM(snapshot.endDebt) + '</span></div>' +
      '<div class="ar-row"><span>Credit Rating</span><span>' + ra + ' ' + snapshot.startRating + ' → ' + snapshot.endRating + '</span></div>' +
      '</div>' +
      '<div class="ar-section"><div class="ar-section-title">Portfolio</div>' +
      '<div class="ar-row"><span>Properties</span><span>' + snapshot.startProps + ' → ' + snapshot.endProps + '</span></div>' +
      '<div class="ar-row"><span>Avg Occupancy</span><span class="' + (snapshot.avgOccupancy >= 0.85 ? "text-green" : "text-yellow") + '">' + fmtPct(snapshot.avgOccupancy) + '</span></div>' +
      (snapshot.bestProp  ? '<div class="ar-row"><span>Best</span><span class="text-green">'  + snapshot.bestProp.name  + ' (' + snapshot.bestProp.occ  + '%)</span></div>' : '') +
      (snapshot.worstProp ? '<div class="ar-row"><span>Worst</span><span class="text-red">'   + snapshot.worstProp.name + ' (' + snapshot.worstProp.occ + '%)</span></div>' : '') +
      '</div>' +
      evHTML + goalsHTML +
      '</div>' +
      '<div class="ar-board-letter"><div class="ar-section-title">Board Assessment</div>' +
      '<p>' + (snapshot.boardAssessment ? (snapshot.boardAssessment.letter || "") : "") + '</p>' +
      pnote + '</div>' +
      ngHTML +
      '<div class="ar-footer"><button class="btn btn-primary btn-lg" onclick="UI.closeAnnualReport()">Continue to Year ' + (snapshot.year + 1) + ' →</button></div>';
    overlay.classList.remove("hidden");
  }

  function closeAnnualReport() {
    var o = el("annual-report-overlay");
    if (o) o.classList.add("hidden");
    if (GameState.meta.gameOver) {
      setTimeout(showGameOver, 400);
    } else if (GameState._pendingBoardMeeting) {
      GameState._pendingBoardMeeting = false;
      setTimeout(showBoardMeeting, 400);
    }
  }

  // ----------------------------------------------------------
  // HELP
  // ----------------------------------------------------------
  function showHelp() { var o = el("help-overlay"); if (o) o.classList.remove("hidden"); }
  function closeHelp() { var o = el("help-overlay"); if (o) o.classList.add("hidden"); }
  function switchHelpTab(tabId, btn) {
    document.querySelectorAll(".help-tab-content").forEach(function(t) { t.classList.remove("active"); });
    document.querySelectorAll(".help-tab-btn").forEach(function(b) { b.classList.remove("active"); });
    var tab = document.getElementById(tabId);
    if (tab) tab.classList.add("active");
    if (btn) btn.classList.add("active");
  }

  // ----------------------------------------------------------
  // PLAYER ACTIONS
  // ----------------------------------------------------------
  function confirmBuyProperty(propertyId) {
    var prop = GameState.propertyMarket.find(function(p) { return p.id === propertyId; });
    if (!prop) return;
    // round 22: a building nobody is selling takes an offer (deals.js)
    if (!prop.listedByOwner && typeof Deals !== "undefined") { Deals.openOffer(propertyId); return; }
    // 2.0: the quick report (deal.js) instead of a line of raw numbers
    showModal("Buy " + prop.name,
      (typeof Deal !== "undefined") ? Deal.preview(prop, "buy") :
      "Asking: " + fmtM(prop.askingPrice) + "  |  NOI: " + fmtM(prop.annualNOI) + "/yr",
      [{ label: "Buy for " + fmtM(prop.askingPrice), style: "btn-primary", onClick: function() {
        var r = Properties.buyProperty(propertyId);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) {
          GameState.board.acquisitionsThisYear = (GameState.board.acquisitionsThisYear || 0) + 1;
          renderAll();
        }
      }}]);
  }

  /* round 10: selling takes time (sales.js). List it and wait for offers,
     or take a quick sale at a discount. */
  function confirmSellProperty(propertyId) {
    var prop = GameState.portfolio.find(function(p) { return p.id === propertyId; });
    if (!prop) return;
    var done = function(r) { showToast(r.message, r.success ? "success" : "error"); renderAll(); };
    var v = prop.currentValue, odds = function(m) { var save = prop.listing; prop.listing = { ask: v * Sales.MODES[m] }; var o = Math.round(Sales.offerOdds(prop) * 100); prop.listing = save; return o; };
    var preview = (typeof Deal !== "undefined") ? Deal.preview(prop, "sell") : "";
    if (prop.listing) {
      showModal("Sell " + prop.name, '<div class="dp-lead">Listed at <b>' + fmtM(prop.listing.ask) + '</b> since Y' + (Math.floor((prop.listing.since - 1) / 4) + 1) + ' Q' + ((prop.listing.since - 1) % 4 + 1) +
        '. About ' + Math.round(Sales.offerOdds(prop) * 100) + '% chance of an offer each quarter.</div>' + preview,
        [{ label: "Take it off the market", style: "btn-secondary", onClick: function() { done(Sales.withdraw(propertyId)); } },
         { label: "Quick sale now: " + fmtM(v * Sales.QUICK), style: "btn-danger", onClick: function() { done(Sales.quick(propertyId)); } }]);
      return;
    }
    showModal("Sell " + prop.name,
      '<div class="dp-lead">Buyers take time. List it and offers arrive in your inbox over the coming quarters, or sell now to a fund at a discount.</div>' + preview,
      [{ label: "List at value " + fmtM(v) + " (" + odds("value") + "%/qtr)", style: "btn-primary", onClick: function() { done(Sales.list(propertyId, "value")); } },
       { label: "List high " + fmtM(v * Sales.MODES.high) + " (" + odds("high") + "%/qtr)", style: "btn-secondary", onClick: function() { done(Sales.list(propertyId, "high")); } },
       { label: "List low " + fmtM(v * Sales.MODES.low) + " (" + odds("low") + "%/qtr)", style: "btn-secondary", onClick: function() { done(Sales.list(propertyId, "low")); } },
       { label: "Quick sale now: " + fmtM(v * Sales.QUICK), style: "btn-danger", onClick: function() { done(Sales.quick(propertyId)); } }]);
  }

  function confirmRetireDebt(trancheId) {
    var info = Financials.getCallInfo(trancheId);
    if (!info) return;
    showModal("Call " + info.label + "?",
      "Per the bond indenture, this tranche may be redeemed early by paying the outstanding principal plus a call premium.\n\n" +
      "Principal: " + fmtM(info.principal) + "\n" +
      "Call premium (2.5%): " + fmtM(info.premium) + "\n" +
      "Total cost to call: " + fmtM(info.total) + "\n\n" +
      "Available cash: " + fmtM(GameState.balance.cash) + "\n\n" +
      "Calling retires the bond and eliminates its future interest. Proceed?",
      [{ label: "Call Bond", style: "btn-danger", onClick: function() {
        var r = Financials.retireDebt(trancheId);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) renderAll();
      }}]);
  }

  // NEW: Lease Up action
  function confirmRenovate(propertyId) {
    var prop = GameState.portfolio.find(function(p) { return p.id === propertyId; });
    if (!prop) return;
    var cost = fmt(prop.currentValue * 0.10, 1);
    showModal("Renovate: " + prop.name,
      "Cost: $" + cost + "M (10% of value)\n" +
      "Duration: 1 quarter offline (zero NOI)\n" +
      "Effect: NOI +15% permanently | Occupancy +" + fmt(Math.min(8, (0.97 - prop.occupancy) * 100), 0) + "% on completion\n\n" +
      "Cash available: " + fmtM(GameState.balance.cash) + "\n" +
      "Current NOI: " + fmtM(prop.annualNOI) + "/yr — After: " + fmtM(prop.annualNOI * 1.15) + "/yr\n\n" +
      "Payback: ~2.5-3 years from NOI gain + value appreciation.",
      [{ label: "Start Renovation — $" + cost + "M", style: "btn-primary", onClick: function() {
        var r = Properties.startRenovation(propertyId);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) renderAll();
      }}]);
  }

  function confirmReposition(propertyId) {
    var prop = GameState.portfolio.find(function(p) { return p.id === propertyId; });
    if (!prop) return;
    var targets = Properties.getRepositionTargets(prop);
    if (targets.length === 0) { showToast("No repositioning options available.", "error"); return; }
    var cost = fmt(prop.currentValue * 0.15, 1);

    var targetText = targets.map(function(t) {
      var newCapRate = GameState.market.capRates[t][prop.location];
      var newNOI = fmt(prop.currentValue * newCapRate / 100, 1);
      return t + " (projected NOI: $" + newNOI + "M/yr @ " + newCapRate + "% cap rate)";
    }).join("\n");

    showModal("Reposition: " + prop.name,
      "Current: " + prop.sector + " · " + prop.location + " | NOI: " + fmtM(prop.annualNOI) + "/yr\n\n" +
      "Available targets:\n" + targetText + "\n\n" +
      "Cost: $" + cost + "M (15% of value)\n" +
      "Duration: 2 quarters offline\n" +
      "Cash available: " + fmtM(GameState.balance.cash),
      targets.map(function(t) {
        return {
          label: "Reposition to " + t.charAt(0).toUpperCase() + t.slice(1),
          style: "btn-primary",
          onClick: function() {
            var r = Properties.startRepositioning(propertyId, t);
            showToast(r.message, r.success ? "success" : "error");
            if (r.success) renderAll();
          }
        };
      })
    );
  }

  function leaseUp(propertyId) {
    var prop = GameState.portfolio.find(function(p) { return p.id === propertyId; });
    if (!prop) return;
    if (typeof Tenants !== "undefined" && Tenants.isLocked(prop)) { showToast("A single-tenant building is either let or empty. Your Asset Manager re-lets it when the tenant leaves.", "info"); return; }
    if (prop.occupancy >= 0.90) { showToast("Occupancy already above 90% — no lease up needed.", "info"); return; }
    // Once per property per year
    if (prop.leaseUpYear === GameState.meta.year) {
      showToast("Already leased up " + prop.name + " this year. Wait until next year.", "error"); return;
    }
    var cost = Math.round(prop.annualNOI * 0.12 * 10) / 10;
    var boost = prop.occupancy < 0.65 ? 0.08 : prop.occupancy < 0.75 ? 0.06 : prop.occupancy < 0.85 ? 0.05 : 0.03;
    showModal("Lease Up: " + prop.name,
      "Current occupancy: " + fmtPct(prop.occupancy) + "\n" +
      "Expected boost: +" + fmt(boost * 100, 0) + "% immediately\n" +
      "Cost: $" + cost + "M (12% of annual NOI)\n" +
      "Cash plus credit line: " + fmtM(((typeof Revolver !== "undefined" && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash)) + "\n\n" +
      "Covers broker commissions, tenant improvements and free rent periods.",
      [{ label: "Lease Up — $" + cost + "M", style: "btn-primary", onClick: function() {
        if (((typeof Revolver !== "undefined" && GameState.revolver) ? Revolver.spendable() : GameState.balance.cash) < cost) { showToast("Not enough money: cash plus credit line is below $" + cost + "M.", "error"); return; }
        GameState.balance.cash = Math.round((GameState.balance.cash - cost) * 100) / 100;
        if (Financials.noteSpend) Financials.noteSpend("leasing", cost);   // round 28: shows in this quarter's AFFO
        prop.occupancy = Math.min(0.97, Math.round((prop.occupancy + boost) * 1000) / 1000);
        showToast(prop.name + " occupancy boosted to " + fmtPct(prop.occupancy), "success");
        GameState.board.leaseUpsThisYear = (GameState.board.leaseUpsThisYear || 0) + 1;
        prop.leaseUpYear = GameState.meta.year;
        renderAll();
      }}]);
  }

  function handleIssueDebt() {
    var amtEl = el("input-debt-amount"), yrEl = el("input-debt-years");
    var amount = amtEl ? parseFloat(amtEl.value) : NaN;
    var years  = yrEl  ? parseInt(yrEl.value)    : NaN;
    if (isNaN(amount) || amount <= 0)            { showToast("Enter a valid amount", "error"); return; }
    if (isNaN(years) || years < 1 || years > 7) { showToast("Bonds run 1 to 7 years.", "error"); return; }
    var rate = Financials.getCurrentBorrowingRateForTerm ? Financials.getCurrentBorrowingRateForTerm(years) : Market.getCurrentBorrowingRate();
    var room           = Financials.debtRoom();
    var d2aNow         = Math.round((GameState.ratios.debtToAssets || 0) * 100);
    var hasCFO         = typeof Staff !== "undefined" && Staff.hasRole("cfo");
    var buttons = [{ label: "Issue Secured at " + fmt(rate, 2) + "%", style: "btn-primary", onClick: function() {
        var r = Financials.issueDebt(amount, years, false);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) { if (amtEl) amtEl.value = ""; renderAll(); }
      }}];
    if (hasCFO && room.secured < 1) {   // round 19: unsecured notes only once secured room is used up
      buttons.push({ label: "Issue Unsecured at " + fmt(rate + room.premium, 2) + "%", style: "btn-secondary", onClick: function() {
        var r = Financials.issueDebt(amount, years, true);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) { if (amtEl) amtEl.value = ""; renderAll(); }
      }});
    }
    showModal("Issue New Debt",
      "Amount: " + fmtM(amount) + "  |  Term: " + years + " yrs  |  Secured rate: " + fmt(rate, 2) + "%\n" +
      "Debt / assets now: " + d2aNow + "%\n" +
      "Secured bonds: up to " + Math.round(room.limit * 100) + "% of assets (your covenant). Room: " + fmtM(room.secured) + (room.refinancing > 0 ? " (includes " + fmtM(room.refinancing) + " to refinance bonds due within 2 quarters)" : "") + "\n" +
      (room.secured >= 1 ? "Unsecured notes open once secured room is used up." :
        hasCFO ? "Unsecured notes: a further " + Math.round((room.unsecLimit - room.limit) * 100) + "% of assets at +" + room.premium + "% a year. Room: " + fmtM(room.unsecured) + ". Okafor will want them repaid within a year."
               : "Secured room is used up. A CFO can raise unsecured notes for a further " + Math.round((room.unsecLimit - room.limit) * 100) + "% of assets."),
      buttons);
  }

  function handleIssueEquity() {
    var sharesEl = el("input-equity-shares");
    var shares = sharesEl ? parseFloat(sharesEl.value) : NaN;
    if (isNaN(shares) || shares <= 0) { showToast("Enter valid shares", "error"); return; }
    var ip = GameState.company.sharePrice * 0.95;
    showModal("Issue Equity",
      "Shares: " + fmt(shares, 1) + "M  |  Price: " + fmtPS(ip) + " (5% disc)\n" +
      "Proceeds: " + fmtM(shares * ip) + "  |  Dilution: " + fmt(shares / GameState.company.sharesOutstanding * 100, 1) + "%",
      [{ label: "Issue Shares", style: "btn-primary", onClick: function() {
        var r = Financials.issueEquity(shares);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) { if (sharesEl) sharesEl.value = ""; renderAll(); }
      }}]);
  }

  function handleBuyback() {
    var sharesEl = el("input-buyback-shares");
    var shares = sharesEl ? parseFloat(sharesEl.value) : NaN;
    if (isNaN(shares) || shares <= 0) { showToast("Enter valid shares", "error"); return; }
    var maxShares = fmt(GameState.company.sharesOutstanding * 0.05, 2);
    var cost = shares * GameState.company.sharePrice;
    var alreadyDone = GameState.company.lastBuybackYear === GameState.meta.year;
    showModal("Share Buyback",
      "Shares: " + fmt(shares, 1) + "M  |  Cost: " + fmtM(cost) + "\n" +
      "Cash after: " + fmtM(GameState.balance.cash - cost) + "\n\n" +
      "Limit: max 5% of float per year (" + maxShares + "M shares).\n" +
      (alreadyDone ? "⚠ Already used this year — next available Year " + (GameState.meta.year + 1) + "." : "Available this year."),
      [{ label: "Buy Back", style: "btn-primary", onClick: function() {
        var r = Financials.buybackShares(shares);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) { if (sharesEl) sharesEl.value = ""; renderAll(); }
      }}]);
  }

  function redeemPref(id) {
    var r = Financials.redeemSeries(id);
    showToast(r.message, r.success ? "success" : "error");
    if (r.success) renderAll();
  }

  function handleRedeemPreferred() {
    var pref = GameState.preferred;
    if (!pref || !pref.issued || pref.outstanding <= 0) { showToast("No preferred stock outstanding.", "error"); return; }
    showModal("Redeem Preferred Stock",
      "Outstanding: " + fmtM(pref.outstanding) + " (" + pref.shares + "M shares @ $" + pref.parValue + " par)\n" +
      "Redemption cost (at par): " + fmtM(pref.outstanding) + "\n" +
      "Cash after: " + fmtM(GameState.balance.cash - pref.outstanding) + "\n\n" +
      "This buys back all preferred shares at par and ends the " + (pref.dividendRate*100) + "% preferred dividend. Proceed?",
      [{ label: "Redeem at Par", style: "btn-primary", onClick: function() {
        var r = Financials.redeemPreferred();
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) renderAll();
      }}]);
  }

  function handleSetDividend() {
    var divEl = el("input-dividend");
    var newDiv = divEl ? parseFloat(divEl.value) : NaN;
    if (isNaN(newDiv) || newDiv < 0) { showToast("Enter valid dividend", "error"); return; }
    var old   = GameState.company.dividendPerShare;
    var isCut    = newDiv < old - 0.001;
    var startDiv = GameState.board.startYearDividend || 0.10;
    var minDiv   = GameState.meta.year <= 1 ? fmt(old, 2) : fmt(startDiv * 0.50, 2);
    var floorNote = GameState.meta.year <= 1
      ? "\n⚠ Year 1: dividend is locked — no cuts allowed."
      : "\nFloor this year: $" + minDiv + "/share (50% of year-start $" + fmt(startDiv,2) + ")";
    var warn = isCut
      ? "WARNING: Cutting dividend causes share price drop and board pressure." + floorNote
      : newDiv > old + 0.001 ? "Raising dividend signals confidence." : "No change.";
    showModal("Set Quarterly Dividend",
      "Current: " + fmtPS(old) + "  →  New: " + fmtPS(newDiv) + "\nQuarterly cost: " + fmtM(newDiv * GameState.company.sharesOutstanding) + "\n\n" + warn,
      [{ label: isCut ? "Cut Dividend" : "Set Dividend", style: isCut ? "btn-danger" : "btn-primary", onClick: function() {
        var r = Financials.setDividend(newDiv);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) { if (divEl) divEl.value = ""; renderAll(); }
      }}]);
  }

  function handleDividendQuickRaise(pct) {
    var old = GameState.company.dividendPerShare;
    var newDiv = fmt(old * (1 + pct / 100), 4);
    // Round to a clean cent
    newDiv = Math.round(newDiv * 100) / 100;
    if (newDiv <= old) newDiv = fmt(old + 0.01, 2); // ensure it actually rises
    showModal("Raise Dividend +" + pct + "%",
      "Current: " + fmtPS(old) + "  →  New: " + fmtPS(newDiv) + "\nQuarterly cost: " + fmtM(newDiv * GameState.company.sharesOutstanding) + "\n\nRaising the dividend pleases the board and signals confidence.",
      [{ label: "Raise to " + fmtPS(newDiv), style: "btn-primary", onClick: function() {
        var r = Financials.setDividend(newDiv);
        showToast(r.message, r.success ? "success" : "error");
        if (r.success) renderAll();
      }}]);
  }


  var _boardMeetingState = {
    mandates:       [],
    currentIndex:   0,
    voteResult:     null,
    earnedCapital:  [],
    mandateResults: [],
    typingTimer:    null,
  };

  function showBoardMeeting() {
    if (typeof Meeting !== "undefined") { Meeting.open(); return; }   // 2.0 round 4
    GameState._boardMeetingOpen = true;   // save.js: a closed tab must not dodge the vote
    // Earn capital ONCE per board meeting (guard against re-entry inflating it)
    var capital;
    if (GameState.board._capitalEarnedYear !== GameState.meta.year) {
      capital = Board.earnPoliticalCapital();
      GameState.board._capitalEarnedYear = GameState.meta.year;
      GameState.board._lastEarnedCapital = capital;
    } else {
      capital = GameState.board._lastEarnedCapital || [];
    }
    var mandates;
    if (GameState.board._mandatesYear === GameState.meta.year && GameState.board._cachedMandates) {
      mandates = GameState.board._cachedMandates;
    } else {
      mandates = Board.generateMandates();
      GameState.board._mandatesYear = GameState.meta.year;
      GameState.board._cachedMandates = mandates;
    }
    var mandateResults = Board.evaluateMandates();

    _boardMeetingState.mandates       = mandates;
    _boardMeetingState.currentIndex   = 0;
    _boardMeetingState.earnedCapital  = capital;
    _boardMeetingState.mandateResults = mandateResults;

    var overlay = el("board-meeting-overlay");
    if (overlay) overlay.classList.remove("hidden");

    renderBoardMeetingHeader();
    showCurrentMandate();
  }

  function renderBoardMeetingHeader() {
    var dirs = Board.DIRECTORS;
    var headerEl = el("bm-directors-row");
    if (!headerEl) return;

    headerEl.innerHTML = dirs.map(function(d) {
      var ds   = Board.getDirectorState(d.id);
      var att  = ds ? ds.attitude : 5;
      var expr = Board.getExpression(att);
      var stars = "";
      for (var i = 0; i < 10; i++) {
        stars += i < Math.round(att) ? "★" : "☆";
      }
      var isCurrent = _boardMeetingState.mandates[_boardMeetingState.currentIndex] &&
        _boardMeetingState.mandates[_boardMeetingState.currentIndex].directorId === d.id;

      return '<div class="bm-director ' + (isCurrent ? "bm-director-active" : "") + '" id="bm-dir-' + d.id + '">' +
        '<div class="bm-portrait-wrap">' +
        (function() {
          var dims = { williams:{w:987,h:253}, chen:{w:949,h:263}, okafor:{w:938,h:266}, petrova:{w:950,h:262}, hassan:{w:949,h:263} };
          var dim  = dims[d.id] || {w:949,h:263};
          var containerH = 130;
          var scale = containerH / dim.h;
          var scaledW = Math.round(dim.w * scale);
          var xPos = expr === "neutral" ? "0%" : expr === "happy" ? "33.33%" : expr === "angry" ? "66.66%" : "100%";
          // If this director is the current speaker, force the speaking frame (4th)
          if (isCurrent) xPos = "100%";
          return '<div class="bm-portrait" id="bm-sprite-' + d.id + '" style="background-image:url(\'' + d.image + '\');background-size:' + scaledW + 'px ' + containerH + 'px;background-position:' + xPos + ' 0%;background-repeat:no-repeat;"></div>';
        })() +
        '</div>' +
        '<div class="bm-dir-name">' + d.name.split(" ")[1] + '</div>' +
        '<div class="bm-dir-focus">' + ({williams:"Dividends",chen:"Growth",okafor:"Leverage",petrova:"Share Price",hassan:"Occupancy"}[d.id] || "") + '</div>' +
        '<div class="bm-dir-stars ' + (att < 3 ? "text-red" : att >= 7 ? "text-green" : "text-yellow") + '">' + fmt(att, 1) + '/10</div>' +
        '</div>';
    }).join("");
  }

  function showCurrentMandate() {
    var mandates = _boardMeetingState.mandates;
    var idx      = _boardMeetingState.currentIndex;

    if (idx >= mandates.length) {
      showBoardVote();
      return;
    }

    var mandate = mandates[idx];
    var director = Board.DIRECTORS.find(function(d) { return d.id === mandate.directorId; });
    var ds       = Board.getDirectorState(mandate.directorId);
    var attitude = ds ? ds.attitude : 5;

    // Update header — highlight speaking director
    renderBoardMeetingHeader();

    // Set speaking director info
    setText("bm-speaker-name", director ? director.name : "");
    setText("bm-speaker-title", director ? director.title : "");
    setText("bm-mandate-counter", "Mandate " + (idx + 1) + " of " + mandates.length);
    setText("bm-capital-display", "Political Capital: " + GameState.board.politicalCapital + "/" + GameState.board.maxCapital);

    // Clear previous state BEFORE typing the new speech
    var voteBox = document.querySelector(".bm-vote-box");
    if (voteBox) voteBox.remove();

    // Generate and type speech
    var speech = Board.generateSpeech(mandate.directorId, mandate, attitude);
    typeText("bm-speech-text", speech);

    // Update buttons
    var btnArea = el("bm-response-buttons");
    if (btnArea) {
      btnArea.innerHTML = "";
      var bmButtons = [
      {r:"accept",    cls:"btn-primary",   label:"Accept",       icon:"Accept",    cost:""},
      {r:"negotiate", cls:"btn-secondary",  label:"Negotiate Down",icon:"Negotiate", cost:" (1 capital)"},
      {r:"doubledown",cls:"btn-secondary",  label:"Double Down",  icon:"Double",    cost:""},
      {r:"reject",    cls:"btn-danger",     label:"Reject",       icon:"Reject",    cost:" (2 capital)"},
    ];
    var html = "";
    bmButtons.forEach(function(b) {
      var btn = document.createElement("button");
      btn.className = "btn " + b.cls + " bm-btn";
      btn.textContent = b.label + b.cost;
      btn.setAttribute("data-response", b.r);
      btn.onclick = function() { UI.boardResponse(b.r); };
      btnArea.appendChild(btn);
    });
    }

    // Update speaking director portrait to speaking expression
    var portraitDiv = el("bm-sprite-" + mandate.directorId);
    if (portraitDiv) portraitDiv.style.backgroundPosition = "100% 0%";
  }

  function boardResponse(response) {
    var mandates = _boardMeetingState.mandates;
    var idx      = _boardMeetingState.currentIndex;
    if (idx >= mandates.length) return;

    var mandate = mandates[idx];
    var capital = GameState.board.politicalCapital;

    // Check capital cost
    if (response === "negotiate" && capital < 1) {
      showToast("Insufficient political capital. Need 1.", "error"); return;
    }
    if (response === "reject" && capital < 2) {
      showToast("Insufficient political capital. Need 2.", "error"); return;
    }

    // Spend capital
    if (response === "negotiate") GameState.board.politicalCapital--;
    if (response === "reject")    GameState.board.politicalCapital -= 2;

    // Handle negotiate roll
    var outcome = response; // for dialogue lookup
    if (response === "negotiate") {
      var director = Board.DIRECTORS.find(function(d) { return d.id === mandate.directorId; });
      var successRate = director ? director.negotiateSuccessRate : 0.5;
      var success = Math.random() < successRate;

      if (success) {
        mandate.response = "negotiate";
        mandate.target   = mandate.target * 0.55;
        outcome = "negotiateOk";
      } else {
        var ds = Board.getDirectorState(mandate.directorId);
        if (ds) ds.attitude = Math.max(0, ds.attitude - 0.5);
        mandate.response = "accept"; // falls back to accept at original target
        outcome = "negotiateFail";
      }
    } else {
      mandate.response = response;
    }

    // Director replies in their own voice, shown in the speech area.
    var reply = directorSays(mandate.directorId, outcome);
    var nameEl = el("bm-speaker-name");
    if (nameEl) nameEl.textContent = reply.name;
    typeText("bm-speech-text", reply.line);
    // Hide the response buttons while the director replies.
    var btnArea = el("bm-response-buttons");
    if (btnArea) btnArea.innerHTML = "";

    // Advance to next mandate after the reply is read.
    _boardMeetingState.currentIndex++;
    setTimeout(function() {
      showCurrentMandate();
      renderBoardMeetingHeader();
      setText("bm-capital-display", "Political Capital: " + GameState.board.politicalCapital + "/" + GameState.board.maxCapital);
    }, 2200);
  }

  // In-character director dialogue for mandate responses. Each director speaks
  // in their own voice instead of a mechanical "reduced by 45%" toast.
  var DIRECTOR_DIALOGUE = {
    williams: {
      name: "Chairman Williams",
      negotiateOk:   ["Hmph. Fine. But I expect the dividend to keep climbing — don't test my patience again.", "Very well. I'll soften it this once. Shareholders still come first, always."],
      negotiateFail: ["The dividend is sacred. There is nothing to negotiate.", "No. Shareholders are owed their due, and that is final."],
      accept:        ["Good. See that it's done.", "As it should be. I'll be watching the payout."],
      doubledown:    ["Bold. I respect ambition — but fail and it's on your head.", "Now that's the spirit. Don't disappoint me."],
      reject:        ["Rejecting me? Reckless. I won't forget this.", "You overstep. The board will remember your defiance."],
    },
    chen: {
      name: "Director Chen",
      negotiateOk:   ["Reasonable. Growth takes time — I can live with a gentler pace this year.", "Agreed. Let's set a target we can actually hit."],
      negotiateFail: ["No. This company must grow, and growth is non-negotiable.", "Stagnation is death for a REIT. My target stands."],
      accept:        ["Excellent. Let's build something.", "Good. I want to see this portfolio expand."],
      doubledown:    ["Ambitious! I like it. Deliver and you'll have my full backing.", "Now we're talking. Go big."],
      reject:        ["Disappointing. Without growth, what are we even doing here?", "A mistake. The market rewards the bold, not the timid."],
    },
    okafor: {
      name: "Director Okafor",
      negotiateOk:   ["Prudent. I'll accept a measured approach — keep the balance sheet clean.", "Fair enough. Discipline matters more than the exact figure."],
      negotiateFail: ["Risk is risk. I won't loosen my guard on this.", "No. Over-leverage has sunk better firms than ours."],
      accept:        ["Sensible. Keep us solvent and we'll have no quarrel.", "Good. Caution is never wasted."],
      doubledown:    ["A firm commitment to discipline — I approve wholeheartedly.", "Resolute. That's what I like to see on risk."],
      reject:        ["Recklessness. You gamble with this company's survival.", "Noted, and not favourably. Risk ignored is risk multiplied."],
    },
    petrova: {
      name: "Director Petrova",
      negotiateOk:   ["All right, I understand. Just don't let the share price slide too far this year.", "Fine. I'll ease off — but the market is always watching, and so am I."],
      negotiateFail: ["My targets are firm. There's no further discussion.", "The share price reflects everything. I won't compromise on it."],
      accept:        ["Good. The market will reward steady hands.", "Wise. Keep the equity story intact."],
      doubledown:    ["Confident. If you can lift the stock, I'll be impressed.", "Bold move. The shareholders are watching with me."],
      reject:        ["Unwise. The market punishes those who ignore it.", "You'll regret dismissing the share price so lightly."],
    },
    hassan: {
      name: "Director Hassan",
      negotiateOk:   ["Acceptable. Keep the buildings full and I'll keep quiet.", "Fine. A little flexibility — but occupancy is everything to me."],
      negotiateFail: ["Empty buildings earn nothing. My standard holds.", "No. If the assets aren't leased, we have no business at all."],
      accept:        ["Good. Full buildings, happy tenants. That's the job.", "Right answer. Keep those occupancy numbers up."],
      doubledown:    ["Strong commitment to operations — I respect that.", "Ambitious on occupancy. Prove it to me."],
      reject:        ["Careless. Occupancy is the lifeblood of this portfolio.", "A poor choice. Neglect the buildings and they'll neglect us."],
    },
  };

  function directorSays(dirId, outcome) {
    var d = DIRECTOR_DIALOGUE[dirId];
    if (!d) return { name: "The director", line: "Very well." };
    var lines = d[outcome] || ["Very well."];
    return { name: d.name, line: lines[Math.floor(Math.random() * lines.length)] };
  }

  function showBoardVote() {
    var voteResult = Board.conductVote();
    _boardMeetingState.voteResult = voteResult;

    var btnArea = el("bm-response-buttons");
    if (btnArea) btnArea.innerHTML = "";
    var speechEl3 = el("bm-speech-text");
    if (speechEl3) speechEl3.textContent = "";

    // Show backroom deal option if any hostile and have capital
    var hostileDirs = voteResult.votes.filter(function(v) { return v.hostile; });
    var canDeal = hostileDirs.length > 0 && GameState.board.politicalCapital >= 3;

    var voteHTML = '<div class="bm-vote-header">BOARD VOTE — Year ' + (GameState.meta.year - 1) + '</div>' +
      '<div class="bm-vote-grid">' +
      voteResult.votes.map(function(v) {
        return '<div class="bm-vote-item">' +
          '<div class="bm-vote-name">' + v.name + '</div>' +
          '<div class="bm-vote-att">' + fmt(v.attitude, 1) + '/10</div>' +
          '<div class="bm-vote-result ' + (v.hostile ? "text-red" : "text-green") + '">' +
          (v.hostile ? "⚑ HOSTILE" : "✓ CONFIDENCE") +
          (v.veto ? " (VETO)" : "") + '</div>' +
          '</div>';
      }).join("") +
      '</div>' +
      '<div class="bm-vote-summary">' +
      'Confidence: ' + voteResult.confidenceCount + ' | Hostile: ' + voteResult.hostileCount +
      (voteResult.williamsVeto ? ' | Williams VETO active — need 4 confidence' : ' | Need 3 confidence') +
      '</div>';

    typeText("bm-speech-text", voteResult.fired
      ? "The motion to remove management has passed. " + voteResult.hostileCount + " directors have lost confidence."
      : "Management retains the board's confidence. " + voteResult.confidenceCount + " votes in favour.");

    var speechEl = el("bm-speech-text");
    if (speechEl) speechEl.insertAdjacentHTML("afterend", '<div class="bm-vote-box">' + voteHTML + '</div>');

    setText("bm-speaker-name", "BOARD VOTE");
    setText("bm-speaker-title", voteResult.fired ? "Vote to remove — PASSED" : "Vote of confidence — PASSED");

    // Backroom deal button
    if (canDeal) {
      if (btnArea) btnArea.innerHTML =
        '<button class="btn btn-danger bm-btn" onclick="UI.backroomDeal()">' +
        '🤝 Backroom Deal — Reset 1 hostile director to 3 (costs 3 capital)</button>' +
        '<button class="btn btn-primary bm-btn" onclick="UI.closeBoardMeeting()">' +
        (voteResult.fired ? "Accept Termination" : "Continue to Year " + GameState.meta.year) + '</button>';
    } else {
      if (btnArea) btnArea.innerHTML =
        '<button class="btn btn-primary bm-btn" onclick="UI.closeBoardMeeting()">' +
        (voteResult.fired ? "Accept Termination" : "Continue to Year " + GameState.meta.year) + '</button>';
    }

    renderBoardMeetingHeader();
  }

  function backroomDeal() {
    var voteResult = _boardMeetingState.voteResult;
    if (!voteResult) return;
    if (GameState.board.politicalCapital < 3) { showToast("Need 3 political capital.", "error"); return; }

    // Find most hostile director (lowest attitude)
    var hostile = voteResult.votes.filter(function(v) { return v.hostile; });
    if (hostile.length === 0) return;

    hostile.sort(function(a, b) { return a.attitude - b.attitude; });
    var target = hostile[0];
    var ds = Board.getDirectorState(target.id);
    if (ds) ds.attitude = 3;
    target.hostile = false;
    target.attitude = 3;

    GameState.board.politicalCapital -= 3;
    showToast("Backroom deal done. " + target.name + " reset to 3/10.", "success");

    // Re-run vote
    var newResult = Board.conductVote();
    _boardMeetingState.voteResult = newResult;

    var voteBox = document.querySelector(".bm-vote-box");
    if (voteBox) voteBox.remove();

    showBoardVote();
  }

  function closeBoardMeeting() {
    GameState._boardMeetingOpen = false;
    var overlay = el("board-meeting-overlay");
    if (overlay) overlay.classList.add("hidden");

    var voteResult = _boardMeetingState.voteResult;
    // 2.0 round 4: TWO STRIKES. A lost vote means probation; losing the next
    // one ends it. Winning while on probation lifts it.
    if (voteResult && voteResult.fired && !GameState.board.probation) {
      GameState.board.probation = { since: GameState.meta.year };
      if (typeof Inbox !== "undefined")
        Inbox.message("Chairman Williams", "Chairman", "You are on probation",
          "The board voted " + voteResult.hostileCount + "-" + voteResult.confidenceCount + " against you. You keep the job for one more year. Lose next year\u2019s vote and you are out. Watch the Board tab: it shows what each of us is judging.",
          "assets/faces/williams.jpg");
      Board.resetYearTracking();
      Staff.refreshTalentMarket();
      return;
    }
    if (voteResult && !voteResult.fired && GameState.board.probation) {
      GameState.board.probation = null;
      if (typeof Inbox !== "undefined")
        Inbox.message("Chairman Williams", "Chairman", "Probation lifted",
          "The board backed you this year. The probation is lifted. Don\u2019t make us regret it.", "assets/faces/williams.jpg");
    }
    if (voteResult && voteResult.fired) {
      GameState.meta.gameOver = true;
      GameState.meta.gameOverReason = "The board voted " + voteResult.hostileCount + "-" + voteResult.confidenceCount +
        " to remove you as CEO of " + GameState.company.name + " after Year " + (GameState.meta.year - 1) + ".";
      setTimeout(function() {
        showGameOver();
        var scoreData = Leaderboard.calculateScore();
        setTimeout(function() { Leaderboard.showSubmitScreen(scoreData); }, 800);
      }, 400);
    } else {
      // Reset year tracking for new year
      Board.resetYearTracking();
      // Refresh the talent market with new candidates for unfilled roles
      Staff.refreshTalentMarket();
    }
  }

  function typeText(elementId, text) {
    var e = el(elementId);
    if (!e) return;
    if (_boardMeetingState.typingTimer) clearInterval(_boardMeetingState.typingTimer);
    e.textContent = "";
    var i = 0;
    _boardMeetingState.typingTimer = setInterval(function() {
      if (i < text.length) {
        e.textContent += text[i];
        i++;
      } else {
        clearInterval(_boardMeetingState.typingTimer);
      }
    }, 18);
  }

  // ----------------------------------------------------------
  // DECISION EVENT MODAL
  // ----------------------------------------------------------
  var _currentDecision = null;

  function showDecisionEvent(evt) {
    _currentDecision = evt;
    // 2.0: the person behind the decision, when there is one
    var who = evt.face ? '<div class="decision-who"><img src="' + evt.face + '" alt="" onerror="this.style.display=\'none\'">' +
      (evt.from ? '<span>From <b>' + evt.from + '</b></span>' : '') + '</div>' : '';
    // the dialog title already shows the headline; no second copy (2.0)
    var html = who +
      '<div class="decision-body">' + evt.body.replace(/\n/g,"<br>") + '</div>' +
      '<div class="decision-choices">';

    evt.choices.forEach(function(c, i) {
      var costBadge = c.costType === "capital"
        ? '<span class="cost-badge cost-capital">💡 ' + (c.cost||1) + ' Capital</span>'
        : c.costType === "cash"
        ? '<span class="cost-badge cost-cash">💰 Cash</span>'
        : c.costType === "income"
        ? '<span class="cost-badge cost-income">📉 Income</span>'
        : '';

      // Determine availability: capital cost and any custom check() must pass.
      var available = true, reason = "";
      if (c.costType === "capital" && (GameState.board.politicalCapital||0) < (c.cost||1)) {
        available = false; reason = "Need " + (c.cost||1) + " political capital (you have " + (GameState.board.politicalCapital||0) + ")";
      }
      if (available && typeof c.check === "function" && !c.check()) {
        available = false; reason = c.checkMsg || "Not available right now";
      }

      if (available) {
        html += '<div class="decision-choice" onclick="UI.makeDecision(' + i + ')">' +
          '<div class="choice-label">' + c.label + costBadge + '</div>' +
          '<div class="choice-detail">' + String(c.detail || '').replace(/\n/g,"<br>") + '</div>' +
          '</div>';
      } else {
        html += '<div class="decision-choice decision-choice-disabled" title="' + reason + '">' +
          '<div class="choice-label">' + c.label + costBadge + '</div>' +
          '<div class="choice-detail">' + String(c.detail || '').replace(/\n/g,"<br>") + '</div>' +
          '<div class="choice-unavailable">🔒 ' + reason + '</div>' +
          '</div>';
      }
    });

    /* 2.0 round 7: can't afford it yet? Put it on hold and find the money. */
    var blocked = evt.choices.some(function(c) {
      return (c.costType === "capital" && (GameState.board.politicalCapital||0) < (c.cost||1)) || (typeof c.check === "function" && !c.check());
    });
    if (blocked && evt.isWorld && !evt._heldItem && evt === GameState._pendingDecision && evt.holdQ !== 0) {
      var hq = evt.holdQ || 2, lc = evt.choices[lapseIndex(evt)];
      html += '<div class="decision-choice decision-hold" onclick="UI.holdDecision()">' +
        '<div class="choice-label">Put it on hold: find the money first</div>' +
        '<div class="choice-detail">It waits ' + hq + ' quarter' + (hq > 1 ? 's' : '') + ' in your inbox and does not block Advance. Raise cash (borrow, sell shares or a building), then decide. If you don\u2019t: ' + (lc ? lc.label : 'it lapses') + '.</div></div>';
    }

    html += '</div>' +
      '<div class="decision-capital">💡 Political Capital: ' +
      (GameState.board.politicalCapital||0) + '/' + (GameState.board.maxCapital||5) + '</div>';

    showModal(evt.headline, "", []);
    var body = el("modal-body");
    if (body) body.innerHTML = html;
    var actions = el("modal-actions");
    if (actions) actions.innerHTML = "";
  }

  /* The choice a held decision falls back to: the card's own, or the last
     option that needs no money. */
  function lapseIndex(evt) {
    if (evt.lapse != null) return evt.lapse;
    for (var i = evt.choices.length - 1; i >= 0; i--) if (!evt.choices[i].check && evt.choices[i].costType !== "capital") return i;
    return evt.choices.length - 1;
  }
  function holdDecision() {
    var evt = _currentDecision; if (!evt) return;
    var lc = evt.choices[lapseIndex(evt)];
    Inbox.hold(evt, evt.holdQ || 2, lc ? lc.label : "");
    GameState._pendingDecision = null;
    if (typeof Story !== "undefined" && Story.dueCard() === evt.id) Story.S().due = null;
    _currentDecision = null;
    closeModal();
    showToast("On hold. Find the money, then decide from your inbox.", "info");
    renderAll();
  }
  function openHeldDecision(id) {
    var evt = Inbox.heldEvt(id);
    if (!evt) { Inbox.resolveHeld(id, "Lapsed", "The offer is no longer available."); return; }
    evt._heldItem = id;
    showDecisionEvent(evt);
  }
  /* Held decisions past their deadline fall back to their default choice. */
  function lapseHeld() {
    if (typeof Inbox === "undefined" || !Inbox.heldDue) return;
    Inbox.heldDue().forEach(function(it) {
      var evt = Inbox.heldEvt(it.id);
      if (!evt) { Inbox.resolveHeld(it.id, "Lapsed", "The offer is no longer available."); return; }
      var idx = lapseIndex(evt), r = World.applyChoice(evt, idx);
      Inbox.resolveHeld(it.id, "Lapsed: " + evt.choices[idx].label, r.message);
    });
  }

  function makeDecision(choiceIndex) {
    if (!_currentDecision) return;
    if (_currentDecision._heldItem) {                        // answered from hold (round 7)
      var hev = _currentDecision, hres = World.applyChoice(hev, choiceIndex);
      if (!hres.success) { showToast(hres.message, "error"); return; }
      Inbox.resolveHeld(hev._heldItem, hev.choices[choiceIndex].label, hres.message);
      _currentDecision = null; closeModal(); showToast(hres.message, "success"); renderAll();
      return;
    }
    var result = (_currentDecision && _currentDecision.isWorld)
      ? World.applyChoice(_currentDecision, choiceIndex)
      : Decisions.applyChoice(_currentDecision, choiceIndex);
    if (!result.success) {
      // Invalid choice (e.g. not enough capital) — keep the modal open,
      // the player must choose a valid option. No free escape.
      showToast(result.message, "error");
      return;
    }
    var picked = _currentDecision.choices && _currentDecision.choices[choiceIndex];
    if (GameState._pendingDecision === _currentDecision) {
      // Inbox decision: answered during the turn. The quarter does NOT run;
      // the player may still act before pressing Advance.
      GameState._pendingDecision = null;
      _currentDecision = null;
      closeModal();
      if (typeof Inbox !== "undefined") Inbox.resolve(picked ? picked.label : "", result.message);
      showToast(result.message, "success");
      renderAll();
      return;
    }
    _currentDecision = null;
    closeModal();
    showToast(result.message, "success");
    // Now run the quarter
    setTimeout(runQuarterAndReport, 400);
  }

  // ----------------------------------------------------------
  // MACRO EVENT POPUP — shows before earnings report for major events
  // ----------------------------------------------------------
  // Same odds and deck as before (World one-per-year, v1 lifelines); only the
  // moment changes: right after the books close, for the turn now starting.
  function drawDecisionForNextTurn() {
    if (!GameState.meta.gameOver) lapseHeld();
    if (GameState.meta.gameOver || GameState._pendingDecision) return;
    var evt = (typeof World !== "undefined" && World.systemDecision) ? World.systemDecision() : null;   // the bank first
    if (!evt) evt = (typeof World !== "undefined" && World.checkDecision) ? World.checkDecision() : null;
    if (!evt && typeof Decisions !== "undefined") evt = Decisions.checkForEvent();
    if (!evt) return;
    GameState._pendingDecision = evt;
    if (typeof Inbox !== "undefined") Inbox.addDecision(evt);
  }
  function openPendingDecision() {
    if (GameState._pendingDecision) showDecisionEvent(GameState._pendingDecision);
  }

  function showMacroEventPopup(firedEvents, callback) {
    // Macro events (Fed rate moves, etc.) now flow into the unified quarter
    // feed like everything else — no separate popup. One place for all news.
    callback();
  }

  // ----------------------------------------------------------
  // ADVANCE QUARTER
  // ----------------------------------------------------------
  function advanceQuarter() {
    if (GameState.meta.gameOver) { showGameOver(); return; }
    if (GameState._pendingOffer) {
      var offer = GameState._pendingOffer;
      var portraitHTML = offer.alPortrait
        ? '<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;"><img src="assets/staff/' + offer.alPortrait + '" style="width:52px;height:52px;border-radius:6px;" alt="' + (offer.alName||"") + '"><div style="font-size:12px;color:var(--text-muted);font-style:italic;">' + (offer.alName||"Acquisitions") + ' sourced this buyer.</div></div>'
        : '';
      showModal("Offer Expiring: " + offer.propertyName,
        portraitHTML + "Offer: " + fmtM(offer.offerPrice) + " (" + offer.premium + "% premium)\nExpires this quarter — accept or decline?",
        [
          { label: "Accept " + fmtM(offer.offerPrice), style: "btn-primary", onClick: function() {
            var r = Properties.sellProperty(offer.propertyId);
            if (r.success) {
              GameState.balance.cash = Math.round((GameState.balance.cash - r.salePrice + offer.offerPrice) * 100) / 100;
              showToast("Accepted: " + fmtM(offer.offerPrice), "success");
            }
            GameState._pendingOffer = null;
            doAdvance();
          }},
          { label: "Decline", style: "btn-secondary", onClick: function() { GameState._pendingOffer = null; doAdvance(); }}
        ]);
      return;
    }
    doAdvance();
  }

  function doAdvance() {
    // Check for decision event BEFORE quarter runs
    /* 2.0: World.checkDecision() is the only source — one per year, drawn from
       a shuffled deck so nothing repeats within a run (see world.js). v1's
       Decisions.checkForEvent() fired ~23 times a run with two events making up
       half of them; it is retained only for its lifeline offers. */
    /* 2.0 (inbox): decisions are drawn when a quarter ENDS and wait in the
       inbox for the whole turn. Advance is blocked until one is answered;
       pressing it opens the decision. */
    if (GameState._pendingDecision) { showDecisionEvent(GameState._pendingDecision); return; }
    runQuarterAndReport();
  }

  function runQuarterAndReport() {
    GameState._pendingAdvance = false;
    var qr = Financials.runQuarter();
    // Turn off tutorial BEFORE generating report
    if (GameState.meta.year === 2 && GameState.meta.quarter === 1) {
      GameState.meta.tutorialYear = false;
    }
    var br = Board.evaluateQuarter();
    var rp = Board.generateEarningsReport(qr, br);
    var justEndedYear = GameState.meta.quarter === 1 && GameState.meta.totalQuarters > 1;

    // NEW: Show macro event popup if any fired, then continue
    function continueAfterEvents() {
      // Year-15 victory (or any win) overrides the normal year-end flow.
      if (GameState.meta.gameOver && GameState.meta.gameWon) {
        renderAll(rp);
        var sdWin = Leaderboard.calculateScore();
        setTimeout(function() {
          showGameOver();
          setTimeout(function() { Leaderboard.showSubmitScreen(sdWin); }, 1200);
        }, 800);
        return;
      }
      if (justEndedYear) {
        var snap = Board.generateAnnualReport();
        renderAll(rp);
        // 2.0 round 4: one meeting a year (meeting.js) replaces the annual
        // report and the old boardroom. Year 1 is practice, no vote.
        GameState._pendingBoardMeeting = true;
        if (GameState.meta.gameOver) { GameState._pendingBoardMeeting = false; setTimeout(showGameOver, 600); }   // no meeting after a default
        else if (typeof Meeting !== "undefined") setTimeout(function() { Meeting.open(); }, 600);
        else if (GameState.meta.year === 2) setTimeout(function() { showAnnualReport(snap); }, 600);
        else setTimeout(function() { showAnnualReport(snap); }, 600);
      } else {
        renderAll(rp);
      }
      // 2.0: the report sits in the rail beside the map. Scrolling the window
      // to it (v1) pushed the map under the top bar; reset the rail instead.
      var rail = document.querySelector(".home-rail");
      if (rail) rail.scrollTop = 0;
      if (GameState.meta.gameOver && !justEndedYear) {
        var sd = Leaderboard.calculateScore();
        setTimeout(function() {
          showGameOver();
          setTimeout(function() { Leaderboard.showSubmitScreen(sd); }, 800);
        }, 1200);
      }
      if (qr.marketResult && qr.marketResult.cycleResult && qr.marketResult.cycleResult.cycleChanged) {
        var cy = qr.marketResult.cycleResult;
        setTimeout(function() { showToast("Market shift: " + cy.label, "warning"); }, 800);
      }

      // Acquisitions Lead mega-property find announcement
      if (GameState._pendingMegaFind) {
        var mf = GameState._pendingMegaFind;
        GameState._pendingMegaFind = null;
        var mfPortrait = mf.alPortrait
          ? '<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;"><img src="assets/staff/' + mf.alPortrait + '" style="width:52px;height:52px;border-radius:6px;" alt="' + (mf.alName||"") + '"><div style="font-size:12px;color:var(--text-muted);font-style:italic;">' + (mf.alName||"Acquisitions") + '</div></div>'
          : '';
        setTimeout(function() {
          showModal("★ Off-Market Opportunity",
            mfPortrait +
            '"Boss, I\'ve sourced something off-market — ' + mf.propName + ', a ' + mf.sector +
            ' asset with a ' + mf.tenant + ' on a long lease. These don\'t come up often. ' +
            'It\'s in the Property Market now, asking ' + fmtM(mf.price) + '. Worth a look before someone else takes it."',
            [{ label: "View the Market", style: "btn-primary", onClick: function() {
              closeModal();
              // 2.0: the market lives in the Properties screen
              if (typeof showView === "function") showView("properties");
            }},
             { label: "Later", style: "btn-secondary", onClick: closeModal }]
          );
        }, 1000);
      }

      drawDecisionForNextTurn();

      // Jenkins Year-1 tutorial (queued after other popups)
      setTimeout(function() {
        if (el("modal-overlay") && !el("modal-overlay").classList.contains("hidden")) return; // don't stack
        if (maybeShowTutorial()) return;
        // Q4 dividend-target reminder (every year), then board warning
        if (maybeShowDividendReminder()) return;
        // Q4 board warning (max once/year): if a director is angry before the vote
        maybeShowBoardWarning();
      }, 1200);
    }

    showMacroEventPopup(qr.firedEvents, continueAfterEvents);
  }

  // Jenkins warns before the annual meeting if a director is turning hostile.
  // Max once per year, only in Q4 (the meeting is imminent).
  function maybeShowBoardWarning() {
    if (GameState.meta.quarter !== 4) return;
    if (GameState.meta.year < 2) return; // no vote after Year 1
    if (GameState._boardWarnYear === GameState.meta.year) return;

    var directors = GameState.board.directors; // array of {id, attitude}
    if (!directors || !directors.length) return;

    // Find the angriest director below the danger threshold
    var worst = null;
    directors.forEach(function(d) {
      if (d.attitude < 3.8 && (!worst || d.attitude < worst.attitude)) worst = d;
    });
    if (!worst) return;

    GameState._boardWarnYear = GameState.meta.year;

    // Look up display info from the static directory
    var info = (Board.DIRECTORS || []).find(function(x) { return x.id === worst.id; }) || {};
    var dirName = info.name || "A director";

    var body;
    if (worst.id === "williams") {
      var startDiv = GameState.board.startYearDividend || GameState.company.dividendPerShare;
      var dmw = (GameState.board.activeMandates || []).find(function(m) { return m.directorId === "williams" && m.metric === "dividendGrowthPct"; });
      var reqGrowth = dmw ? dmw.target / 100 : (typeof Directors !== "undefined" ? Directors.williamsTarget() : 0.05);
      var target = fmt(startDiv * (1 + reqGrowth), 2);
      body = "Boss, remember our promise to <strong>Chairman Williams</strong> — we pledged to lift the dividend about <strong>" + Math.round(reqGrowth*100) + "%</strong> this year, to <strong>$" + target + "/share</strong>. " +
             "We're not there yet and he's losing patience. Raise it to that level before the vote and he'll come around — otherwise he may turn on us.";
    } else {
      body = "Boss, <strong>" + dirName + "</strong> is unhappy heading into the annual vote (watching " + (info.watches || "performance") + "). " +
             "We've this quarter to improve things — address their concern, or spend political capital to smooth it over before the meeting.";
    }
    showJenkinsPopup("Jenkins — Board Warning", body);
  }

  // Q4 reminder of Williams' dividend target — fires every year in Q4 (Y2+)
  // even if he's not yet hostile, so the player always knows the number to hit.
  function maybeShowDividendReminder() {
    if (GameState.meta.quarter !== 4 || GameState.meta.year < 2) return false;
    if (GameState._divReminderYear === GameState.meta.year) return false;
    var w = Board.getDirectorState ? Board.getDirectorState("williams") : null;
    if (!w) return false;
    GameState._divReminderYear = GameState.meta.year;
    var startDiv = GameState.board.startYearDividend || GameState.company.dividendPerShare;
    // round 17: the target he actually set at the meeting (a 2.0 demand), not v1's 10%
    var dm = (GameState.board.activeMandates || []).find(function(m) { return m.directorId === "williams" && m.metric === "dividendGrowthPct"; });
    if (!dm) return false;
    var reqGrowth = dm.target / 100;
    var target = fmt(startDiv * (1 + reqGrowth), 2);
    var actual = GameState.company.dividendPerShare;
    if (actual >= target - 0.001) return false; // already met — no nag
    showJenkinsPopup("Jenkins — Dividend Promise",
      "Boss, you remember we promised Chairman Williams a <strong>" + Math.round(reqGrowth*100) + "%</strong> dividend hike this year — that means <strong>$" + target + "/share</strong>. " +
      "We're at $" + fmt(actual, 2) + " right now. We should really deliver this before year-end, or he'll take it personally at the vote.");
    return true;
  }

  // ----------------------------------------------------------
  // GAME OVER
  // ----------------------------------------------------------
  function showGameOver() {
    var o = el("gameover-overlay");
    if (!o) return;
    // round 14: the visual novel ending plays first (ending.js), then the scores
    if (typeof Ending !== "undefined" && !GameState._endingShown) {
      GameState._endingShown = true;
      try { Ending.show(function () { showGameOver(); }); return; } catch (e) { if (window.console) console.warn('ending', e); }
    }
    var won = GameState.meta.gameWon;
    var titleEl = el("gameover-title");
    var videoSlot = el("gameover-video-slot");

    if (won) {
      // 2.0: no single victory title. The run simply ends after 60 quarters and
      // the dual-score epilogue (B.1/B.10) reports both numbers. Placeholder
      // until that screen exists.
      if (titleEl) { setText("gameover-title", "FIFTEEN YEARS"); titleEl.style.color = "#fbbf24"; }
      // v1 played assets/victory.mp4 here as part of the "divine status"
      // celebration. That ending is cut in 2.0 (A.12) and the file was never
      // copied across, so it would render as a broken player. The dual-score
      // epilogue (B.10) will own this screen.
      if (videoSlot) videoSlot.innerHTML = "";
    } else {
      // round 28: the title of the ending you actually reached (not always "fired")
      var _k = (typeof Ending !== "undefined") ? Ending.kind() : "fired", _t = (typeof Ending !== "undefined" && Ending.ALL) ? (Ending.ALL.find(function (a) { return a[0] === _k; }) || [0, "You're fired"])[1] : "You're fired";
      if (titleEl) { setText("gameover-title", _k === "fired" ? "YOU'RE FIRED" : String(_t).toUpperCase()); titleEl.style.color = /fired|receivers|prey/.test(_k) ? "" : "#fbbf24"; }
      // No video on a firing — remove it from the DOM entirely.
      if (videoSlot) videoSlot.innerHTML = "";
    }

    // round 12: the two scores, side by side (the full epilogue comes with the ending work)
    var _w = (typeof Pay !== "undefined") ? Pay.wealth() : null;
    var _p0 = GameState._p0 || 10, _divs = (GameState.history || []).reduce(function(a, h) { return a + (h.dividendPerShare || 0); }, 0);
    var _tsr = (GameState.company.sharePrice + _divs) / _p0 - 1;
    setText("gameover-reason", GameState.meta.gameOverReason + (_w ? "\n\nYour shareholders: total return " + (_tsr >= 0 ? "+" : "") + Math.round(_tsr * 100) + "% over your tenure. You: $" + _w.total.toFixed(1) + "M of your own" +
      (_w.forfeited ? " ($" + _w.forfeited.toFixed(1) + "M of unvested shares left behind)" : "") + "." : ""));
    setText("gameover-quarters", "Survived " + GameState.meta.totalQuarters + " quarters (" + GameState.meta.year + " years)");
    setText("gameover-ffo",      fmtPS(GameState.ratios.ffoPerShare));
    setText("gameover-occ",      fmtPct(GameState.ratios.occupancyPortfolio));
    setText("gameover-d2a",      fmtPct(GameState.ratios.debtToAssets));
    setText("gameover-props",    GameState.portfolio.length + " properties");
    var btn = el("btn-new-game");
    if (btn) btn.textContent = won ? "Play Again" : "Try Again";
    if (typeof Scores !== "undefined") Scores.renderGameOver();   // round 28
    // round 32: what went wrong, when the run ended early
    var pmBox = el("postmortem");
    if (pmBox) { var _kk = (typeof Ending !== "undefined") ? Ending.kind() : ""; var pm = (/fired|receivers|prey/.test(_kk) && Ending.postmortem) ? Ending.postmortem() : [];
      pmBox.innerHTML = pm.length ? '<div class="pm"><div class="pm-h">What went wrong</div>' + pm.map(function (t) { return '<div class="pm-r">\u2022 ' + t + '</div>'; }).join('') + '<div class="pm-f">Next time: watch the Board tab\u2019s scorecard during the year. Every line there is what a director will judge you on.</div></div>' : ''; }
    o.classList.remove("hidden");
  }

  // ----------------------------------------------------------
  // NEW GAME
  // ----------------------------------------------------------
  function newGame() {
    var ni = el("input-player-name");
    var ri = el("input-reit-name");
    var tut = el("input-tutorial");
    var playerName = (ni && ni.value.trim()) ? ni.value.trim() : "CEO";
    var reitName   = (ri && ri.value.trim()) ? ri.value.trim() : "My";

    GameState.player.name     = playerName;
    GameState.player.reitName = reitName;
    GameState.company.name    = reitName + " REIT";

    // Tutorial mode — Jenkins Year-1 guidance (default on)
    GameState._tutorialEnabled = tut ? tut.checked : true;
    GameState._tutorialShown   = {};
    // 2.0 state that newGame() must clear by hand (GameState is edited in place)
    GameState.inbox            = null;   // inbox.js
    GameState._pendingDecision = null;   // decision waiting in the inbox
    GameState._p0              = null;   // TSR start price (shell.js HUD)
    GameState._endingShown     = false;  // ending.js
    GameState.deals = null; GameState.agents = null; GameState.pr = null;   // round 22: deals.js, agents.js, pr.js
    GameState._spendQ = { leasing: 0, projects: 0 };
    GameState._scorePosted = false;
    GameState._staffCostV  = 2;                                              // round 29: staff salaries already at the new level                                          // round 28: scores.js                        // round 28: this quarter's lease ups and building spend
    if (window.Telemetry) Telemetry.started();   // round 23: anonymous counts (telemetry.js)
    GameState.meta._negEqQ     = 0;      // insolvency counter (financials.js)

    GameState.meta.quarter        = 1;
    GameState.meta.year           = 1;
    GameState.meta.totalQuarters  = 0;
    GameState.meta.gameOver       = false;
    GameState.meta.gameOverReason = "";
    GameState.meta.gameWon = false;
    GameState.meta.resigned = false;     // round 15: resignation (meeting.js)
    GameState.meta.started        = true;
    GameState.meta.tutorialYear   = true;

    GameState.company.sharePrice          = 10.00;
    GameState.company.sharesOutstanding   = 10;
    GameState.company.compShares          = 0;     // round 24: shares paid as pay (pay.js, directors.js)
    GameState.company.marketCap           = 100;
    GameState.company.dividendPerShare    = 0.10;   // mirror of state.js
    GameState.company.dividendHistory     = [];
    GameState.company.dividendCutQuarters = 0;
    GameState.company.equityIssuanceCount    = 0;
    GameState.company.equityIssuanceYear     = 0;
    GameState.company.equitySuppressQuarters = 0;
    GameState.company.debtIssuanceQuarter    = 0;
    GameState.board.acquisitionsThisYear     = 0;
    GameState.board.accretiveBuysThisYear    = 0;
    GameState.board.leaseUpsThisYear         = 0;
    GameState.board.noOverdraftBroken        = false;
    GameState.board.noEquityBroken           = false;
    GameState.board.politicalCapital         = 2;
    GameState.board._capitalEarnedYear = 0;
    GameState.board._lastEarnedCapital = [];
    GameState.board._mandatesYear = 0;
    GameState.board._cachedMandates = null;
    GameState.board.activeMandates           = [];
    Decisions.init();
    if (typeof World !== "undefined") World.init();
    GameState._lastTenantDistressYear = 0;
    GameState.balance.cash                = 40;

    GameState.debtTranches = [
      { id: "d001", amount: 35, rate: 5.0, maturityQuarter: 2, maturityYear: 4, quartersUntilMaturity: 13, label: "5.0% Sr Notes due Y4Q2" },
      { id: "d002", amount: 35, rate: 5.5, maturityQuarter: 4, maturityYear: 6, quartersUntilMaturity: 23, label: "5.5% Sr Notes due Y6Q4" },
    ];

    GameState.history         = [];
    GameState.eventLog        = [];
    GameState.annualSnapshots = [];
    GameState._pendingOffer   = null;
    GameState._pendingMegaFind = null;
    GameState._lastMegaRollYear = 0;
    GameState._lastBuyerFindYear = 0;
    GameState.preferred = { outstanding:0, shares:0, parValue:25, dividendRate:0.05, issued:false };
    GameState.balance.preferredEquity = 0;
    GameState._preferredOffered = false;
    GameState._privatePlacementUsed = false;
    GameState._gaSurcharge = 0;
    GameState._recurringPenalties = [];
    GameState._eventLastFired = {};
    GameState._lastDecisionQuarter = 0;
    GameState._negEventCooldown = 0;
    GameState._esgJustFired = false;
    GameState._divReminderYear = 0;

    Market.init();
    // Store baseline cap rates for market conditions indicator
    GameState.market.baselineCapRates = {
      office:      (GameState.market.capRates.office.tier1 + GameState.market.capRates.office.tier2 + GameState.market.capRates.office.suburban) / 3,
      industrial:  (GameState.market.capRates.industrial.tier1 + GameState.market.capRates.industrial.tier2 + GameState.market.capRates.industrial.suburban) / 3,
      multifamily: (GameState.market.capRates.multifamily.tier1 + GameState.market.capRates.multifamily.tier2 + GameState.market.capRates.multifamily.suburban) / 3,
      retail:      (GameState.market.capRates.retail.tier1 + GameState.market.capRates.retail.tier2 + GameState.market.capRates.retail.suburban) / 3,
    };
    Properties.init();
    if (typeof Story !== "undefined") Story.ensure();       // story buildings (Harlow's distribution centre)
    Board.init();
    Staff.init();
    if (typeof News !== "undefined") News.init();
    Events.init();
    Financials.init();
    if (typeof Revolver !== "undefined") Revolver.init();   // the revolving credit facility (round 3)
    if (typeof Rivals !== "undefined") Rivals.init();       // three rival REITs with real books (round 5)
    if (typeof Directors !== "undefined" && Directors.startTracking) Directors.startTracking();   // round 32
    Charts.init();

    var overlayIds = ["gameover-overlay", "start-overlay", "annual-report-overlay", "help-overlay"];
    overlayIds.forEach(function(id) {
      var o = el(id); if (o) o.classList.add("hidden");
    });

    // what the company looked like on day one (tutorial checklist, inbox.js)
    GameState._tutBase = { debt: GameState.debtTranches.reduce(function(a, t) { return a + t.amount; }, 0), props: GameState.portfolio.map(function(p) { return p.id; }) };
    GameState._tutDone = {};
    if (typeof Save !== "undefined") Save.start();
    renderAll();
    Leaderboard.renderLeaderboard("leaderboard-container");
    setTimeout(function() {
      // round 17: the welcome is a short inbox letter from the Chairman, not a modal
      if (typeof Inbox !== "undefined" && Inbox.message) Inbox.message("Chairman Williams", "Chairman of the board", "Welcome to " + reitName + " REIT",
        "Welcome aboard. Year 1 is yours to learn the job: the board does not vote on you until next year. From then on we vote every year.<br><br>" +
        "What I look for: buildings that earn more than they cost to finance, no nasty surprises with cash, and, from Year 2, a dividend that rises.<br><br>Williams",
        "assets/faces/williams.jpg");
      renderAll();
      // 2.0: Jenkins's first notes wait in the inbox behind the letter, so
      // they arrive however the letter is closed.
      maybeShowTutorial();
    }, 400);
  }

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------
  function init() {
    var buttons = {
      "btn-advance-quarter": advanceQuarter,
      "btn-new-game":        newGame,
      "btn-new-game-go":     newGame,
      "btn-issue-debt":      handleIssueDebt,
      "btn-issue-equity":    handleIssueEquity,
      "btn-buyback":         handleBuyback,
      "btn-set-dividend":    handleSetDividend,
      "btn-div-10":          function() { handleDividendQuickRaise(10); },
      "btn-div-20":          function() { handleDividendQuickRaise(20); },
      "btn-div-50":          function() { handleDividendQuickRaise(50); },
      "btn-redeem-preferred": handleRedeemPreferred,
      "btn-help":            showHelp,
      "btn-help-close":      closeHelp,
    };
    Object.keys(buttons).forEach(function(id) {
      var btn = el(id);
      if (btn) btn.addEventListener("click", buttons[id]);
    });

    document.addEventListener("keydown", function(e) {
      if (e.key === "F1")     { e.preventDefault(); showHelp(); }
      if (e.key === "Escape") { closeHelp(); closeModal(); }
    });

    var mo = el("modal-overlay");
    if (mo) mo.addEventListener("click", function(e) { if (e.target === mo) closeModal(); });
    var ho = el("help-overlay");
    if (ho) ho.addEventListener("click", function(e) { if (e.target === ho) closeHelp(); });

    Charts.init();

    var so = el("start-overlay");
    if (so) so.classList.remove("hidden");
    refreshContinue();
    var cb = el("btn-continue"); if (cb) cb.addEventListener("click", continueGame);
    var mb = el("btn-menu");     if (mb) mb.addEventListener("click", openMenu);
    var rb = el("btn-run-year"); if (rb) rb.addEventListener("click", runToYearEnd);

    Leaderboard.renderLeaderboard("leaderboard-container");
  }

  // ----------------------------------------------------------
  // 2.0: RUN TO YEAR END. Quarter by quarter, stopping the moment something
  // needs the player (feedback: "slow and fast at the same time").
  // ----------------------------------------------------------
  var _run = null;
  function unreadCount() {
    return ((GameState.inbox && GameState.inbox.items) || []).filter(function(i) { return i.kind === "message" && !i.read; }).length;
  }
  function stopRun(why) {
    _run = null;
    var b = el("btn-run-year"); if (b) b.innerHTML = "&#9656;&#9656; Year end";
    if (why) showToast("Stopped: " + why, "info");
  }
  function runToYearEnd() {
    if (_run) { stopRun("you pressed stop."); return; }
    if (GameState._pendingDecision) { showDecisionEvent(GameState._pendingDecision); return; }
    _run = { unread: unreadCount() };
    var b = el("btn-run-year"); if (b) b.innerHTML = "&#9632; Stop";
    stepRun();
  }
  function stepRun() {
    if (!_run) return;
    advanceQuarter();
    setTimeout(function() {
      if (!_run) return;
      var G = GameState, now = (G.meta.year - 1) * 4 + G.meta.quarter;
      var mo = el("modal-overlay"), modal = mo && !mo.classList.contains("hidden");
      var due = (G.debtTranches || []).some(function(t) {
        return ((t.maturityYear - 1) * 4 + t.maturityQuarter) - now <= 1 && t.amount > G.balance.cash; });
      var why = G.meta.gameOver ? "the game is over."
              : G._pendingDecision ? "a decision is waiting in your inbox."
              : modal ? "something needs your answer."
              : G.meta.quarter === 1 ? "the year has ended."
              : G.balance.cash < 0 ? "you are overdrawn."
              : due ? "a loan falls due next quarter and you can't cover it."
              : unreadCount() > _run.unread ? "you have a new message."
              : null;
      if (why) stopRun(why); else stepRun();
    }, 450);
  }

  // ----------------------------------------------------------
  // 2.0: CONTINUE, TITLE SCREEN, MENU (save.js)
  // ----------------------------------------------------------
  function refreshContinue() {
    var s = (typeof Save !== "undefined") ? Save.peek() : null;
    var b = el("btn-continue"), l = el("continue-label"), g = el("btn-new-game-go");
    if (b) b.classList.toggle("hidden", !s);
    var cb = el("continue-box"); if (cb) cb.classList.toggle("hidden", !s);
    var eg = el("endings-gallery"); if (eg && typeof Ending !== "undefined" && Ending.galleryHTML) eg.innerHTML = Ending.galleryHTML();   // round 25
    if (typeof Scores !== "undefined") Scores.renderTitle();   // round 28: the 2.0 leaderboard
    if (l) l.textContent = s ? "Saved: " + s.label + ". Your name and company above are only for a new game." : "";
    if (g) g.textContent = s ? "New game" : "Start Game";
    var w = el("new-game-warning");
    if (w) w.classList.toggle("hidden", !s);
  }
  function continueGame() {
    if (typeof Save === "undefined" || !Save.load()) { refreshContinue(); return; }
    if (window.Telemetry) Telemetry.continued();
    ["gameover-overlay", "start-overlay", "annual-report-overlay", "help-overlay"].forEach(function(id) {
      var o = el(id); if (o) o.classList.add("hidden");
    });
    _currentDecision = null;
    Charts.init();
    renderAll();
    if (typeof showView === "function") showView("map");
    // a year-end board meeting that was due or open when the tab closed
    if (GameState._pendingBoardMeeting || GameState._boardMeetingOpen) {
      GameState._pendingBoardMeeting = false;
      setTimeout(showBoardMeeting, 400);
    } else {
      showToast("Welcome back. " + GameState.company.name + ", Year " + GameState.meta.year + " Q" + GameState.meta.quarter + ".", "success");
    }
  }
  function toTitle() {
    if (typeof Save !== "undefined") Save.save();
    refreshContinue();
    var so = el("start-overlay"); if (so) so.classList.remove("hidden");
  }
  function openMenu() {
    showModal("Menu", "Your game saves itself after every quarter and every move, in this browser.", [
      { label: "Send feedback", style: "btn-primary", onClick: function() { setTimeout(function() { if (window.Telemetry) Telemetry.openFeedback(); }, 50); } },
      { label: "Back to title screen", style: "btn-secondary", onClick: toTitle },
      { label: "Start a new game", style: "btn-danger", onClick: function() {
          setTimeout(function() {
            showModal("Start a new game?", "Your current game (" + GameState.company.name + ", Year " + GameState.meta.year +
              ") will be deleted. This cannot be undone.",
              [{ label: "Delete it and start over", style: "btn-danger", onClick: function() {
                  if (typeof Save !== "undefined") { Save.clear(); Save.stop(); }
                  refreshContinue();
                  var so = el("start-overlay"); if (so) so.classList.remove("hidden");
              }}]);
          }, 50);
      }}
    ]);
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    init:                init,
    newGame:             newGame,
    renderAll:           renderAll,
    showModal:           showModal,
    closeModal:          closeModal,
    showToast:           showToast,
    showGameOver:        showGameOver,
    advanceQuarter:      advanceQuarter,
    showAnnualReport:    showAnnualReport,
    closeAnnualReport:   closeAnnualReport,
    showHelp:            showHelp,
    closeHelp:           closeHelp,
    switchHelpTab:       switchHelpTab,
    confirmBuyProperty:  confirmBuyProperty,
    openPendingDecision: openPendingDecision,
    holdDecision:        holdDecision,
    openHeldDecision:    openHeldDecision,
    continueGame:        continueGame,
    openMenu:            openMenu,
    runToYearEnd:        runToYearEnd,
    confirmSellProperty: confirmSellProperty,
    confirmRetireDebt:   confirmRetireDebt,
    handleIssueDebt:     handleIssueDebt,
    handleIssueEquity:   handleIssueEquity,
    handleBuyback:       handleBuyback,
    handleRedeemPreferred: handleRedeemPreferred,
    handleSetDividend:   handleSetDividend,
    leaseUp:             leaseUp,
    confirmRenovate:     confirmRenovate,
    confirmReposition:   confirmReposition,
    hireStaff:           hireStaff,
    fireStaff:           fireStaff,
    makeDecision:        makeDecision,
    redeemPref:          redeemPref,
    showBoardMeeting:    showBoardMeeting,
    boardResponse:       boardResponse,
    backroomDeal:        backroomDeal,
    closeBoardMeeting:   closeBoardMeeting,
  };

}());

document.addEventListener("DOMContentLoaded", UI.init);
