/* ============================================================================
   glossary.js — plain-English explanations on hover (design doc B.12h).

   Player feedback on v1: "Without prior financial knowledge and all the terms
   and acronyms I have no chance." Every label that names a financial idea
   gets a dotted underline; hovering shows one line a non-finance player
   understands. Labels are matched by their text, so new screens pick this up
   by calling Glossary.tag() after they render.
   ========================================================================== */

window.Glossary = (() => {

  const T = {
    // top bar
    'cash': 'Money in the bank right now. Below zero you are on an expensive overdraft.',
    'retained last qtr': 'What was left last quarter after rent, costs, interest and dividends. Below zero means you burned cash.',
    'share price': 'What one share sells for. It follows your dividend, your asset value and how risky you look.',
    'debt assets': 'How much of everything you own is paid for with borrowed money. Above about 50% lenders and investors get nervous.',
    'situation': 'A two-word read of where the company stands, from Crisis to Room to move.',

    // income statement
    'gross potential rent': 'All the rent you would collect if every building were full.',
    'vacancy loss': 'Rent you miss because space is empty.',
    'operating expenses': 'Running the buildings: maintenance, utilities, insurance, property tax.',
    'net operating income': 'NOI: rent after the buildings’ running costs. What the properties earn before head office and interest.',
    'noi': 'Net operating income: rent after the buildings’ running costs.',
    'ann noi': 'Net operating income per year: rent after the building’s running costs.',
    'ga expense': 'Head office: salaries, lawyers, accountants, the CEO’s office.',
    'interest expense': 'What your loans cost this quarter.',
    'depreciation': 'An accounting charge for buildings wearing out. Not real cash, so REITs add it back.',
    'unusual items': 'One-off costs or gains: repairs, fines, settlements.',
    'net income gaap': 'The official accounting profit. For a REIT it understates cash, because of depreciation.',
    'ffo': 'Funds from operations: net income with depreciation added back. The REIT’s real profit.',
    'affo': 'Adjusted FFO: FFO minus the upkeep spending needed to keep buildings competitive. The closest thing to free cash.',
    'preferred dividends': 'Fixed payments to preferred shareholders. They get paid before ordinary shareholders.',
    'dividends paid': 'Cash paid to your shareholders this quarter.',
    'retained cash': 'What is left after everything, including dividends. This is what grows (or shrinks) your bank balance.',

    // ratios
    'ffoshare': 'FFO divided by the number of shares: your profit per share each quarter.',
    'affoshare': 'Cash profit per share each quarter. Grow this and the share price follows.',
    'div coverage': 'Cash profit ÷ dividends. Below 1.0x you are paying out more than you earn.',
    'payout ratio': 'Share of cash profit paid out as dividends. REITs usually pay 70–90%.',
    'debtebitda': 'Years of profit it would take to repay all debt. Above about 7x looks stretched.',
    'int coverage': 'Profit ÷ interest. Below about 2x lenders start to worry.',
    'occupancy': 'Share of space that is let to paying tenants.',
    'noi margin': 'How much of gross rent survives as NOI after running costs.',
    'cap rate': 'Yearly rent after costs ÷ building value. Higher means a cheaper building, usually a riskier one.',
    'navshare': 'Net asset value per share: buildings plus cash, minus debt, split across shares.',
    'pffo': 'Share price ÷ yearly FFO per share: how many years of profit investors pay for.',
    'paffo': 'Share price ÷ yearly cash profit per share. Lower means cheaper.',
    'div yield': 'Yearly dividend ÷ share price. What shareholders earn in cash each year.',

    // balance sheet
    'total assets': 'Everything you own: buildings at today’s value, plus cash.',
    'total debt': 'Everything you owe to lenders.',
    'preferred equity': 'Money from preferred shareholders: like debt, but no fixed repayment date.',
    'common equity': 'What belongs to ordinary shareholders: assets minus debt and preferred.',
    'shares out': 'How many shares exist. Issuing more spreads the profit thinner.',
    'divshare q': 'Dividend per share paid each quarter.',

    // capital actions
    'borrow': 'Take a loan. Cheap money grows you; too much makes every shock dangerous.',
    'issue shares': 'Sell new shares for cash. No interest, but every existing share now owns a smaller slice.',
    'issue company shares': 'The company sells new shares to investors. The money goes to the company, not to you; every existing share now owns a smaller slice.',
    'buy back shares': 'Spend cash buying your own shares. Fewer shares, so each owns more profit.',
    'dividend': 'Cash you pay shareholders every quarter. The board watches it closely; cutting it hurts.',

    // credit line (revolver.js)
    'line': 'The most the bank will lend you on the revolving credit facility.',
    'drawn': 'How much of the credit line you are using. It shows as cash below zero.',
    'available': 'How much more you can draw before you hit the limit.',
    'rate on what you draw': 'Floating: it moves with interest rates and your credit rating.',
    'fee on the unused line': 'Banks charge a small fee for keeping money ready for you.',
    'next review': 'Every 3 years the bank renews the line. If your numbers got worse, it sets tougher terms.',

    // properties and map
    'est value': 'What the building would sell for today.',
    'value': 'What the building would sell for today.',
    'tenants': 'Who rents the space. A single tenant means all or nothing.',
    'yoc': 'Yield on cost: yearly rent after costs ÷ what you paid.',
    'noi yr': 'Net operating income per year: rent after the building\u2019s running costs.',
    'cap yoc': 'Cap rate: yearly rent after costs \u00f7 today\u2019s value. YoC (yield on cost): the same \u00f7 what you paid.',
    'asking': 'The price the seller wants.',
    'listed': 'How long the building has been for sale.',

    // deal preview
    'rent you collect': 'Yearly rent after the building’s running costs (NOI).',
    'rent you lose': 'Yearly rent after running costs that goes with the building.',
    'cash profit per share': 'Change in AFFO per share each quarter: the number the market cares about most.',
    'yield on price': 'What the building earns each year ÷ what you pay for it (its cap rate).',
    'if you borrowed for it': 'Your interest rate today on a 5-year loan.',
    'spread': 'Building yield minus borrowing cost. Positive: debt-funded, it pays for itself.',
    'gain vs what you paid': 'Sale price after fees minus what you paid for the building.',
  };

  const norm = s => String(s || '').toLowerCase().replace(/&amp;/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const KEY = {};
  Object.keys(T).forEach(k => { KEY[norm(k)] = T[k]; KEY[norm(k).replace(/ /g, '')] = T[k]; });
  const lookup = txt => KEY[norm(txt)] || KEY[norm(txt).replace(/ /g, '')] || null;

  // where labels live
  const SELECTORS = [
    '#tb-hud .k', '.pnl-table td:first-child', '.ratio-label', '.bs-label', '.action-group-title',
    '#tab-properties th', '#card .k', '.dp td:first-child', '.rcf-r span'
  ];

  function tag(root) {
    (root || document).querySelectorAll(SELECTORS.join(',')).forEach(el => {
      if (el.dataset.tip) return;
      // the label's own words, not trailing notes ("Borrow to buy property" -> "Borrow")
      const own = el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild.textContent : el.textContent;
      const t = lookup(own) || lookup(el.textContent);
      if (t) { el.dataset.tip = t; el.classList.add('has-tip'); }
    });
  }

  /* round 42: jargon inside sentences (inbox letters, the meeting, dialogs). The first
     time a term appears in a block it gets a dotted underline; hover shows one line. */
  const PROSE = [
    [/\bcap rates?\b/i, 'Cap rate: what a building earns in a year (rent after running costs) divided by its price. 7% means $7 a year for every $100.'],
    [/\bAFFO\b|\bcash profit\b/i, 'Cash profit (AFFO): rent minus interest, head office and upkeep. What the company really earned. The dividend should come out of it.'],
    [/\bNAV\b/, 'NAV: what all our buildings are worth, minus all our debt, per share. If the share price is below it, the market values us cheap.'],
    [/\bNOI\b/, 'NOI: a building\u2019s rent after its running costs (maintenance, tax, insurance).'],
    [/\bcovenants?\b/i, 'Covenant: a promise to our lenders, for example debt below 60% of assets. Break it and they can stop lending or demand money back.'],
    [/\bcredit line\b/i, 'Credit line: an overdraft from the bank. Cash below zero is drawn from it. Flexible, but dearer than bonds.'],
    [/\bunsecured notes\b/i, 'Unsecured notes: bonds with no buildings pledged behind them. Dearer, and the board dislikes them.'],
    [/\bdilut(?:es|ion|ive)\b/i, 'Dilution: new shares mean each existing share owns a smaller slice of the company and its profit.'],
    [/\bpolitical capital\b/i, 'Political capital: your influence with the board, the bank and the city. Earned with good results, spent to win fights.'],
    [/\boccupancy\b/i, 'Occupancy: the share of a building\u2019s space that is let and paying rent.'],
    [/\bdividend cover\b|\bnot covered\b/i, 'Covered: the dividend is paid out of cash profit. Not covered means we pay more than we earn.'],
    [/\bbonds?\b/i, 'Bond: a loan from investors at a fixed rate, repaid in full on a set date. Have the money ready, or refinance before it falls due.'],
  ];
  const PROSE_SEL = '.ib-body, #mt-chat .mt-bub, #mt-chat .mt-note, #modal-body';
  function prose(root) {
    (root || document).querySelectorAll(PROSE_SEL).forEach(blk => {
      const sig = blk.textContent.length + ':' + blk.textContent.slice(0, 40);   // a reused box (the dialog) gets a fresh pass when its text changes
      if (blk.dataset.gl === sig) return; blk.dataset.gl = sig;
      const used = {};
      const walk = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentNode.closest('button, input, select, textarea, a, .gl, [data-tip]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
      const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
      nodes.forEach(n => {
        for (let i = 0; i < PROSE.length; i++) {
          if (used[i]) continue;
          const m = PROSE[i][0].exec(n.nodeValue); if (!m) continue;
          used[i] = true;
          const after = n.splitText(m.index); after.nodeValue.length > m[0].length && after.splitText(m[0].length);
          const sp = document.createElement('span'); sp.className = 'gl has-tip'; sp.dataset.tip = PROSE[i][1]; sp.textContent = after.nodeValue.slice(0, m[0].length);
          after.parentNode.replaceChild(sp, after);
          break;   // one term per text node is plenty
        }
      });
    });
  }

  // one floating tooltip for the whole page (never clipped by panels)
  let box = null;
  function show(el, x, y) {
    if (!box) { box = document.createElement('div'); box.id = 'tipbox'; document.body.appendChild(box); }
    box.textContent = el.dataset.tip;
    box.style.display = 'block';
    const w = box.offsetWidth, h = box.offsetHeight;
    box.style.left = Math.min(window.innerWidth - w - 8, x + 12) + 'px';
    box.style.top = (y + h + 24 > window.innerHeight ? y - h - 10 : y + 16) + 'px';
  }
  const hide = () => { if (box) box.style.display = 'none'; };
  // round 42: never instant: the tip shows after the mouse rests on a term for 0.6 s
  let tmr = null, cur = null, lx = 0, ly = 0;
  document.addEventListener('mousemove', e => { lx = e.clientX; ly = e.clientY; }, { passive: true });
  document.addEventListener('mouseover', e => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el === cur) return;
    cur = el; clearTimeout(tmr); hide();
    if (el) tmr = setTimeout(() => { if (cur === el) show(el, lx, ly); }, 600);
  });
  document.addEventListener('scroll', hide, true);

  // tag whatever gets drawn: tables re-render, dialogs open, map cards appear
  let queued = false;
  new MutationObserver(() => {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; tag(document); try { prose(document); } catch (e) {} });
  }).observe(document.documentElement, { childList: true, subtree: true });

  return { tag, lookup, prose, TERMS: T };
})();
