# Simulation harnesses

Node scripts that boot the real game headlessly (jsdom) and play it, so balance
questions get answered with measurements instead of guesses.

    cd tools && npm install jsdom && node sim_situation.js

| script | answers |
|---|---|
| `sim_situation.js` | Where does the company actually live? One narrated run, then a 25-run distribution across the five situation states. |
| `sim_balance.js`   | An active bot that levers up and buys. Reports survival to Y15, why runs end, and which severity-3 signals drive "crisis". |
| `sim_events.js`    | Event and decision firing rates: harmful vs benign ratio, silent quarters, which decisions actually appear and how often. |

They drive the real `Financials.runQuarter()` and `UI.newGame()`, so they catch
engine bugs, not just arithmetic. Two real bugs were found this way:
a crash when `renderAll()` ran before `REIT.init()`, and `Situation.assess()`
reading a stale P&L so the board described the company one quarter late.
| `sim_tenants.js`   | Engine-only, fast. How many of the original 40 tenants fail per run, and who fails most often. Use it to tune `Tenants.K`. |
| `sim_fullrun.js`   | Full games through the real UI, answering every decision. Checks that single-tenant buildings are only ever 0% or 100%, and counts defaults, renewals and re-lets. `RUNS=3 node sim_fullrun.js` |
| `check_drawers.js` | Opens property drawers in the merged build and prints the tenant panel. Caught the `#view-props` bug: since the merge, every click on the Properties tab had been dead. |
| `sim_arc.js`       | The macro storyline. Tenant defaults and coverage by phase (cheap money / warning / crisis / recovery / aftershock / late), and per crisis variant the peak rate rise, peak credit spread and worst city-wide value drop. `N=16 node sim_arc.js` |
| `check_map_control.js` | Clicks the map colour switch and confirms markers and legend change. Guards the `.toolbar` selector bug. |
| `check_shell.js` | Clicks every top-bar tab, the Advance button, and the drawer Sell/Buy buttons. Checks one screen shows at a time and the HUD updates. Run with `NODE_PATH=/tmp/t/node_modules`. |
| `check_deck.js` | Forces every decision card and every choice in a mid-game state, then plays 4 more quarters. Prints each choice's result text. Pass a card id to test one. |
| `sim_price.js` | Share price under three styles (passive, grower, dividend pump): price, % of NAV, bust rate. Also prints G&A as % of assets. |
| `browser_inbox.js` | Real headless Chrome: plays until a decision waits in the inbox, checks Advance is blocked, answers it, saves screenshots. Needs `@sparticuz/chromium` + `puppeteer-core` in /tmp/pp (`NODE_PATH=/tmp/pp/node_modules`). |

Note: /tmp is wiped between sessions. Reinstall with `cd /tmp/t && npm i jsdom` and `cd /tmp/pp && npm i @sparticuz/chromium puppeteer-core`.
| `browser_round2.js` | Real Chrome: start screen, welcome letter, tutorial step ticking off, tooltip on hover, Year end stopping with a reason, because-lines. |
| `browser_save.js` | Real Chrome: play, reload, Continue, compare every field; Menu > new game deletes the save. |
| `check_revolver.js` | The credit line, scenario by scenario: draw and auto-repay, interest on the P&L, forced sales, default, bad and good reviews, push back, dividend freeze, frozen line, bond covenant. |
| `browser_meeting.js` | Real Chrome: plays to the Y1 practice meeting and the Y2 vote, clicking through every beat; screenshots of the agenda and the vote. |
| `browser_fixes3.js` | Real Chrome, round 6 fix list: start screen, SALE tags, inbox mark read, Finance cash and chart titles, numbers on meeting choices, the activist as a 6th director (cards, scorecard, 6 votes), a director buying shares, political capital at the bank. |
| `browser_story.js` | Real Chrome: the Harlow story branch by branch (offer on hold then bought, news, late rent, loan, interest line, a miss with Bob's way, cannot pay, the extra year, bankruptcy) and save/reload. Pass `repaid` or `refuse` as the 2nd argument for those branches. |
| `sim_harlow.js` | Monte Carlo of Harlow's maturity odds for a player who lends (target repay 30 / another year 35 / cannot pay 35). `node tools/sim_harlow.js` |
| `browser_board.js` | Real Chrome, round 8: reputation, a director pushed out and replaced at the meeting, Grace's ESG initiative and the +5% bracket, cancelling one (red line), Tex nominated and the press story, the Harlow yacht exposé. |
| `browser_roundA.js` | Real Chrome, round 9 (playtest fixes A): welcome letter, date chip, map clicks buy / open your building, single-tenant occupancy, one-turn inbox, rate move with a story, Jenkins Year 2 nudge and credit line letter, buyback on the line, NAV chart. |
| `sim_econ.js` | The economics, measured: full 15-year runs straight through the engine with a bot (`passive`, `steady`, `grower`), printing each year's rent, overheads, interest, retained cash, leverage, rating, price vs NAV and return vs the rivals. `node tools/sim_econ.js steady 2` |
| `browser_roundB.js` | Real Chrome, round 10: value follows occupancy and rent, starting price vs NAV, share issues priced against NAV, the covenant shown and amended by a CFO, listing a building, an offer in the inbox, accepting, a quick sale. |
| `browser_roundC.js` | Real Chrome, round 11: directors own shares (on their cards), two demands tied to complaints (a promise becomes the demand), Harlow in the board room (Bob as a guest: the offer, the loan, the yearly review, the loan falling due at a meeting). |
| `sim_capital.js` | Political capital, measured: the same bots as `sim_econ.js`, with each year-end meeting's bookkeeping run uncapped, printing what a player earns a year. `node tools/sim_capital.js steady 2` |
| `browser_pay.js` | Real Chrome, round 12: the pay committee (contract mix, bonus or waive, a share grant each year, vesting a third a year), salary, a story's special recognition, unvested shares forfeited when fired, the political capital cap. |
| `browser_war.js` | Real Chrome, round 13, the Rennick war. `win` (default): Morrow Plaza in the city, the Year 3 auction with Jack in the room, the leak card, Petrova vs Chen, a free squeeze from Rennick's profile, the audit card and the write-down, "how do we hit him back", the crisis and a blocked sale, Chen's takeover (Voss in the room), four quarters after. `lose`: Kessler's 5% card, the rights plan and the seat demand at the meeting, the 14.9% cap, Voss joining at 15%, the hostile bid (rejected / "the prey"). |
| `sim_war.js` | The war over full runs: a steady bot wins the auction, answers every attack, and either fights (`fight`: both weapons yearly, blocks sales, moves the takeover) or keeps its head down (`quiet`). Prints crisis timing, how cheap Rennick got, the ending, Kessler's stake. `node tools/sim_war.js 4 fight` |
| `browser_tower.js` | Real Chrome, round 14, Celestial Heights through its own items and cards: Sebastian, the task, the lot, the loan, the build with overrun and Calder & Rowe, completion on road `A` (pandemic: Williams falls, Okafor elected chair) or `B`, then a real meeting under the new chair. 2nd argument: A or B. |
| `browser_index.js` | Real Chrome, round 14, the index: the checklist letter, candidate, joining, Henrik Dahl's asks, Granite voting against a director, a lost say on pay (pay cut), being dropped, and a real meeting with Dahl in the room. |
| `browser_ending.js` | Real Chrome, round 14, the visual novel ending: every card of a full run (screenshots), then the score screen; a "shown the door" run. |
| `sim_stories.js` | Every story over full runs with random choices at every meeting and card; prints each story's outcome, the chair, the index, the say on pay votes and the ending. `node tools/sim_stories.js 3` |
| `browser_gary.js` | Real Chrome, round 15: Gary's offer, buying 40% of Lakeside, the independent directors' vote, your share paid every quarter, the boiler, page 212, the cash-out (Crestline, then the Rennick variant and ending it), the new ending cards (Gary, Tex), and resigning at the Year 2 meeting ("The clean exit"). |
| `browser_port.js` | Real Chrome, round 16, Port Logistics: Atlas Cold Chain steady through a recession, Chen's item with Tex backing him, she sells (bought at 15% off), the late leak and the lawsuit (blame Chen), Tex's route where she holds (reputations), the mayor's favour, the Eleanor ending card, and the item in a real Year 4 meeting. |
| `browser_round17.js` | Real Chrome, round 17 playtest fixes: rating and base rate on the HUD, Year 1 dividend grace, the credit line dearer than bonds, the CFO found under both role names, preferred shares on Bob's offer and loan, Jack's auction and Port Logistics, a macro headline card in the inbox, demands that say how. |
| `browser_round18.js` | Real Chrome, round 18: a maturing bond on the clock and repaid in the inbox, renovation paid from the credit line, Okafor's 55% line and demands, Tex's seat date, preferred shares covering only the cash shortfall. |
| `browser_round19.js` | Real Chrome, round 19: secured bonds to the covenant, unsecured notes with a CFO (+2%, to 70%) and Okafor's repay demand, refinancing room for bonds about to fall due, and default at maturity when unpaid. |
| `browser_round20.js` | Real Chrome, round 20: Levi's arrival, a gibberish challenge with Jenkins's translation, a missed and a met verdict, his crisis forecast, his Staff card, and the Stories tab. |
| `sim_exploit.js` | The liquidator: sells a building a quarter and pays it out (`liquidator`), or pays it all at once (`pump`), against the `steady` bot. Prints price vs NAV, TSR vs rivals, your wealth, the four directors' moods, payout and shrink each year. `node tools/sim_exploit.js 1 steady,liquidator,pump` |
| `browser_round21.js` | Real Chrome, round 21: an uncovered dividend priced as a one-off (no bump, ex-dividend), Williams turning furious and Petrova after him (letters, scorecard, his demand, vote), a cut back forgiven, Chen and Hassan on selling the portfolio, the ending's sold line. |
| `browser_round22.js` | Real Chrome, round 22: offers (yes, counter, no, a bidding war, a rival's markup, the Acquisitions Lead, the war ban), land (the reserved tower lot, win, build, pre-let, lease up, a lot lost to a rival who builds), agents on story and deal cases, a PR campaign, IR softening a drop, staff fixes, the Dealroom tab, save and reload. Pins Math.random where a branch must be forced. |
| `browser_round23.js` | Real Chrome, round 23: anonymous play counts (GoatCounter stubbed): events fire once per game, survive a reload, nothing loads from disk, the feedback window from the menu and the ending. |
| `browser_round24.js` | Real Chrome, round 24 polish: start screen order, Jenkins's Asset Manager / lease up / renovate steps, the land auction letter, who pays your rent, the chairman's shares (not in Year 1), directors paid in shares, the meeting's share price chart, the Finance layout. |
| `browser_round25.js` | Real Chrome, round 25: Petrova's share advice by band and only on change, interest rates among the price reasons, the ending gallery (unlock badge, title screen, Dealroom). |
| `browser_round27.js` | Real Chrome, round 27: bonds capped at 7 years, preferred shares only for the cash shortfall (20% cap), the half bonds / half preferred split with a covenant waiver, offered on Bob's card. |
| `browser_round28.js` | Real Chrome, round 28: lease ups in AFFO and building spend on the income statement; the 2.0 leaderboard with JSONBin stubbed (post, rank, once per run, title screen); the game over title. |
