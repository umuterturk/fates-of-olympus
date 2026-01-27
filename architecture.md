You are a senior game engineer + software architect. Design and implement the core “board + rules” engine for a Snap-like card game in Python with STRONG static typing (Pyright strict). The program must be playable in the command line, BUT the CLI must be fully replaceable later by a real UI without rewriting the engine.

Primary goal:
- Build a clean, testable, data-driven rules engine with immutable-ish state snapshots and a typed event log.
- The CLI is just an adapter; all game logic must live in the engine package.

MVP Game Rules:
- 2 players
- 3 locations (lanes), indexed 0..2
- 6 turns max
- Deck size: 12 cards per player
- Starting hand: draw 3 cards
- Each turn: draw 1 card at start of turn
- Energy: starts at 1 on turn 1; increases by +1 each turn (energy on turn N = N)
- Each location has a capacity of 4 cards per player
- Each turn, both players choose 0–1 action: play one card from hand to a location, or pass
- Players act “simultaneously”:
  - Collect both actions first
  - Then resolve them in a deterministic reveal order (choose one and document it: e.g., P1 reveals then P2 every turn)
- Win condition:
  - Compute total power per player at each location
  - Win if you win 2 of 3 locations
  - If 1–1 with one tied: compare total power across all locations
  - If still tied: draw
- No “Snap/cubes”.

Card/Ability System (deterministic; no RNG):
Cards must be data-driven, not hardcoded in the main resolution loop.
Each card has:
- id (typed), name, cost, base_power, text, tags

Tags are typed enums used for:
- Ability categorization (Vanilla, OnReveal, Ongoing, Move, Destroy, Buff, Debuff, Tech, BuildAround)
- Targeting filters (e.g., Underworld Gate buffs cards with the Destroy tag)

Support ability categories:
1) VANILLA: no ability
2) ON_REVEAL: triggers once when revealed/played
3) ONGOING: continuously modifies power while in play (must be recomputed deterministically)
4) MOVE: move a card between locations (self or allied)
5) DESTROY: destroy a card on board (self or allied)

Effects must be composable primitives:

**Power Manipulation:**
- AddPower(target, amount) — one-time power change (+/- for buff/debuff)
- AddOngoingPower(target_filter, amount, condition?) — continuous power modifier while source is in play
- TransferPower(source_card, target_card) — move power from one card to another (for Hades)

**Card Manipulation:**
- MoveCard(card_ref, to_location) — move card to another location
- DestroyCard(card_ref) — remove card from board

**Special Effects:**
- DisableOngoing(target_filter) — suppress ongoing abilities of target cards (for Gorgon Glare)

**Target Filters (typed, composable):**
- Self — the card itself
- OtherAlliedHere — allied cards at same location, excluding self
- AllAlliedHere — all allied cards at same location, including self
- EnemyHere — enemy cards at same location
- AlliedWithTag(tag) — allied cards anywhere with specific tag
- AlliedHereWithTag(tag) — allied cards at same location with specific tag

**Conditions (for conditional abilities):**
- LocationIsFull — player's side of location has 4 cards (for Ares)
- MovedCardThisTurn — player moved any card this turn (for Poseidon)
- DestroyedCardThisGame — player destroyed any card this game (for Cerberus)
- HasEmptySlotHere — player has < 4 cards at this location (for Hades)
- OnlyCardHere — this is player's only card at this location (for Zeus)

**Turn/Game History Tracking:**
The engine must track:
- Cards moved per turn per player (reset each turn)
- Cards destroyed per game per player (cumulative)
This enables conditional abilities like Poseidon and Cerberus.

Keep the primitive set extensible; new effects and conditions can be added without modifying the core resolution loop.

Timing / Resolution (must be explicit and documented in code):
- Turn Start:
  - set energy to turn number
  - draw 1 card
  - reset per-turn history (cards_moved_this_turn for each player)
- Planning Phase:
  - each player submits a PlayerAction (play/pass)
- Resolution Phase:
  1) validate both actions against the pre-resolution state
  2) apply costs and place cards as “pending” at chosen location
  3) reveal in deterministic order
  4) when a card reveals, resolve its ON_REVEAL effects:
     - evaluate conditions (MovedCardThisTurn, DestroyedCardThisGame, OnlyCardHere, etc.) against current state/history
     - apply effects (AddPower, MoveCard, DestroyCard, TransferPower)
     - update history tracking (record moves and destroys as they happen)
     - emit events for each effect
  5) after all reveals, recompute ONGOING effects deterministically:
     - first, identify cards with DisableOngoing effects (Gorgon Glare) and mark suppressed cards
     - then compute power modifiers from non-suppressed ongoing effects
     - check ongoing conditions (LocationIsFull for Ares, etc.)
     - emit events for resulting power changes
- Turn End

Architecture Requirements (most important):
- Clean layering and type safety:
  1) Engine/domain layer: pure logic, no I/O, no printing, no input()
  2) Application/controller layer: orchestrates phases and exposes APIs
  3) Presentation layer: CLI only (replaceable)
- Engine must expose:
  - immutable-ish GameState snapshots (prefer frozen dataclasses; update by returning new objects)
  - typed PlayerAction commands
  - typed Event log entries describing everything that happened (for future UI animations):
    - CardPlayed, CardRevealed, CardMoved, CardDestroyed
    - PowerChanged (with reason: buff, debuff, ongoing, transfer)
    - OngoingDisabled (when Gorgon Glare suppresses an ability)
    - ConditionChecked (for conditional abilities, with result)
- No direct input/output in engine logic. CLI reads input and prints.
- Deterministic behavior (no randomness). If randomness is later added, it must be seedable and isolated.

Typing Requirements:
- Code must pass Pyright in `strict` mode (no `Any` in engine code; minimize casts).
- Use:
  - `@dataclass(frozen=True, slots=True)` where appropriate
  - `Enum` and `Literal` instead of string constants
  - `NewType` for strong IDs (CardId, PlayerId, InstanceId)
  - `Protocol` for interfaces if helpful
- Avoid “dict of dict” untyped structures inside the engine; keep explicit models.

Implementation Instructions:
- Language: Python 3.12+ (3.11 acceptable if needed)
- Use only standard library + pytest for tests (no heavy frameworks).
- Provide code in this module layout:
  - engine/types.py        (NewType IDs, enums, protocols, type aliases)
  - engine/models.py       (CardDef, CardInstance, PlayerState, LocationState, GameState, GameHistory)
  - engine/cards.py        (data-driven card definitions; 24 Greek mythology themed cards)
  - engine/effects.py      (Effect primitives + application functions)
  - engine/rules.py        (validation + resolution pipeline)
  - engine/controller.py   (GameController: step(state, actions)->(new_state, events))
  - cli.py                 (CLI adapter)
  - tests/test_engine.py   (basic tests)
- Tests:
  - legality: cannot play card not in hand; cannot exceed energy; cannot exceed location capacity
  - determinism: same inputs -> same state/events
  - win condition correctness on a constructed end state
  - ability tests:
    - ON_REVEAL buff (Satyr, Athena): verify power correctly added to targets
    - ON_REVEAL debuff (Harpies, Medusa): verify negative power applied to enemies
    - ONGOING power (Naiad Nymph, Ares): verify continuous effects recompute correctly
    - MOVE effects (Iris, Hermes): verify cards relocate and history tracks the move
    - DESTROY effects (Shade, Hecate, Hades): verify cards removed and history updated
    - DisableOngoing (Gorgon Glare): verify enemy ongoing abilities suppressed
    - Conditional abilities (Poseidon, Cerberus, Zeus): verify conditions checked against history/state

CLI Requirements:
- Terminal-playable match loop
- Each turn prints:
  - turn number
  - each player energy
  - each player hand (card ids + name + cost + power)
  - board summary for 3 locations (cards and effective power totals)
- Input per player:
  - `play <card_id> <loc>` or `pass`
- After both inputs, print the Event log for the resolution phase step-by-step
- At end: print winner + per-location totals

UI Replacement Guidance (must include in response):
- Explain exactly how a future UI should integrate:
  - how to render GameState
  - how to submit PlayerAction
  - how to consume Event log for animations
- Emphasize that CLI is replaceable and engine is UI-agnostic.

Deliverables:
1) Complete Python code for all modules + tests (ready to run)
2) Short integration explanation for replacing CLI with a UI
3) A short demo transcript showing 1–2 turns of CLI play

Be careful:
- Enforce legality and consistent state updates
- Keep it minimal but real (not pseudocode)
- No “magic” per-card hardcoding in the resolution loop; abilities must be data-driven via effects

