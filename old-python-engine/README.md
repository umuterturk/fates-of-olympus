# Fates of Olympus

A Greek mythology-themed card game engine inspired by Marvel Snap. Features clean architecture, strong typing (Pyright strict), and 24 unique Greek mythology cards.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                           │
│                                                                     │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    │
│   │   CLI    │    │   Web    │    │  Mobile  │    │   GUI    │    │
│   │ (cli.py) │    │   (TBD)  │    │   (TBD)  │    │   (TBD)  │    │
│   └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘    │
│        │               │               │               │           │
└────────┼───────────────┼───────────────┼───────────────┼───────────┘
         │               │               │               │
         └───────────────┴───────────────┴───────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Application Layer                             │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │                      GameController                          │  │
│   │                                                              │  │
│   │  • create_game() -> (GameState, [Event])                    │  │
│   │  • start_turn(state) -> (GameState, [Event])                │  │
│   │  • resolve_turn(state, action_p0, action_p1) -> (GameState, │  │
│   │                                                   [Event])   │  │
│   │  • get_legal_actions(state, player_id) -> [PlayerAction]    │  │
│   │                                                              │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Engine/Domain Layer                         │
│                                                                     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│   │    Types     │  │    Models    │  │    Events    │            │
│   │ (types.py)   │  │ (models.py)  │  │ (events.py)  │            │
│   │              │  │              │  │              │            │
│   │ • CardId     │  │ • CardDef    │  │ • GameEvent  │            │
│   │ • PlayerId   │  │ • CardInst.  │  │ • CardPlayed │            │
│   │ • InstanceId │  │ • PlayerSt.  │  │ • CardReveal │            │
│   │ • Enums      │  │ • GameState  │  │ • PowerChg   │            │
│   └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│   │   Effects    │  │    Rules     │  │    Cards     │            │
│   │ (effects.py) │  │ (rules.py)   │  │ (cards.py)   │            │
│   │              │  │              │  │              │            │
│   │ • AddPower   │  │ • validate   │  │ • CardDefs   │            │
│   │ • MoveCard   │  │ • resolve    │  │ • Registry   │            │
│   │ • Destroy    │  │ • winner     │  │              │            │
│   └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the CLI
python cli.py

# Run tests
pytest

# Type check
pyright
```

## Game Rules

- **2 players**, **3 locations** (lanes), **6 turns**
- Each player has a **12-card deck**, draws **3 cards** at start
- **Energy = turn number** (1 on turn 1, 2 on turn 2, etc.)
- Each turn: draw 1 card, then play 0-1 card or pass
- **Location capacity**: 4 cards per player per location
- **Win condition**: Win 2 of 3 locations by total power
- Tiebreaker: Total power across all locations

## Project Structure

```
fates-of-olympus/
├── engine/
│   ├── __init__.py      # Package exports
│   ├── types.py         # NewType IDs, enums, protocols
│   ├── models.py        # CardDef, CardInstance, GameState, etc.
│   ├── events.py        # Typed event log entries
│   ├── effects.py       # Effect primitives (AddPower, Move, Destroy)
│   ├── rules.py         # Validation + resolution pipeline
│   ├── cards.py         # Sample card definitions
│   └── controller.py    # GameController orchestration
├── tests/
│   └── test_engine.py   # Comprehensive tests
├── cli.py               # Terminal adapter
├── pyproject.toml       # Project configuration
└── README.md            # This file
```

## UI Integration Guide

The engine is designed to be **UI-agnostic**. The CLI is just one adapter - you can build web, mobile, or desktop UIs that integrate the same way.

### How to Integrate

#### 1. Instantiate the Controller

```python
from engine import GameController

controller = GameController()
```

#### 2. Create a Game

```python
state, events = controller.create_game()
# events contains GameStartedEvent and CardDrawnEvents
```

#### 3. Game Loop

```python
while state.result == GameResult.IN_PROGRESS:
    # Start turn
    state, turn_events = controller.start_turn(state)
    
    # Render state to your UI
    render_game_state(state)
    
    # Collect actions from your UI
    action_p0 = get_player_action_from_ui(state, PlayerId(0))
    action_p1 = get_player_action_from_ui(state, PlayerId(1))
    
    # Resolve turn
    state, resolve_events = controller.resolve_turn(state, action_p0, action_p1)
    
    # Animate events in your UI
    for event in resolve_events:
        animate_event(event)
```

#### 4. Rendering GameState

The `GameState` object provides:

- `state.turn` - Current turn number
- `state.phase` - Current game phase
- `state.get_player(player_id)` - Player's hand, deck, energy
- `state.get_location(index)` - Cards at a location with power totals
- `state.result` - Game result (IN_PROGRESS or final outcome)

#### 5. Creating PlayerActions

```python
from engine import PlayCardAction, PassAction, PlayerId, LocationIndex, InstanceId

# Play a card
action = PlayCardAction(
    player_id=PlayerId(0),
    card_instance_id=InstanceId(card.instance_id),
    location=LocationIndex(1),
)

# Or pass
action = PassAction(player_id=PlayerId(0))
```

#### 6. Consuming Events

Events are typed union types you can pattern-match:

```python
from engine.events import (
    CardPlayedEvent, CardRevealedEvent, PowerChangedEvent, ...
)

for event in events:
    match event:
        case CardPlayedEvent(player_id=pid, card_instance_id=cid, location=loc):
            animate_card_play(pid, cid, loc)
        case CardRevealedEvent(card_instance_id=cid, location=loc):
            animate_card_reveal(cid, loc)
        case PowerChangedEvent(card_instance_id=cid, old_power=old, new_power=new):
            animate_power_change(cid, old, new)
        # ... handle other events
```

### Key Principles

1. **Engine has no I/O** - Never prints, never reads input
2. **State is immutable** - Each operation returns a new state
3. **Events describe changes** - Replay-friendly, animation-friendly
4. **Actions are validated** - Use `validate_action()` before submitting
5. **Deterministic** - Same inputs always produce same outputs

## Card Ability System

Cards have ability types that determine when effects trigger:

- **VANILLA**: No ability (Hoplite, Myrmidon, Titan Atlas, etc.)
- **ON_REVEAL**: Triggers once when card is revealed (Satyr, Athena, Zeus, etc.)
- **ONGOING**: Continuously modifies power while in play (Naiad Nymph, Ares, Gorgon Glare, etc.)

Effects are composable primitives:

```python
from engine.effects import AddPowerEffect, AddOngoingPowerEffect, ConditionalPowerEffect
from engine.types import TargetFilter, Power

# ON_REVEAL: +1 power to another ally at same location (Satyr)
AddPowerEffect(target=TargetFilter.ONE_SAME_LOCATION_FRIENDLY, amount=Power(1))

# ONGOING: +1 power to friendly cards at same location (Naiad Nymph)
AddOngoingPowerEffect(target=TargetFilter.SAME_LOCATION_FRIENDLY, amount=Power(1))

# CONDITIONAL: +6 power if only card here (Zeus)
ConditionalPowerEffect(target=TargetFilter.SELF, amount=Power(6), condition="only_card_here")
```

## Card Set (24 Cards)

| Cost | Cards |
|------|-------|
| 1 | Hoplite, Satyr, Naiad Nymph, Shade, Harpies |
| 2 | Argive Scout, Iris, Hermes, Phaethon, Gorgon Glare |
| 3 | Athena, Ares, Medusa, Myrmidon, Underworld Gate |
| 4 | Pegasus Rider, Minotaur, Hecate, Poseidon |
| 5 | Cerberus, Hades, Cyclops |
| 6 | Zeus, Titan Atlas |

## Timing / Resolution Order

1. **Turn Start**: Set energy = turn number, draw 1 card
2. **Planning Phase**: Collect both player actions
3. **Resolution Phase**:
   - Validate both actions against pre-resolution state
   - Spend energy and place cards (unrevealed)
   - Reveal P0's card, trigger ON_REVEAL
   - Reveal P1's card, trigger ON_REVEAL
   - Recompute all ONGOING effects
4. **Turn End**: Check for game end

## License

MIT
