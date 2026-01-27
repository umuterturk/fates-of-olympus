"""
Core type definitions for the game engine.

This module defines:
- NewType IDs for strong typing of identifiers
- Enums for game states and categories
- Type aliases for clarity
- Protocols for extensibility
"""

from enum import Enum, auto
from typing import NewType, Literal, Protocol, TYPE_CHECKING

if TYPE_CHECKING:
    from engine.models import CardInstance, GameState

# =============================================================================
# Strong ID Types (NewType for compile-time safety)
# =============================================================================

CardId = NewType("CardId", str)
"""Unique identifier for a card definition (e.g., 'hulk', 'iron_man')."""

InstanceId = NewType("InstanceId", int)
"""Unique identifier for a specific card instance in a game."""

PlayerId = NewType("PlayerId", int)
"""Player identifier: 0 or 1."""

LocationIndex = NewType("LocationIndex", int)
"""Location index: 0, 1, or 2."""

TurnNumber = NewType("TurnNumber", int)
"""Turn number: 1 through 6."""

# =============================================================================
# Value Types
# =============================================================================

Energy = NewType("Energy", int)
"""Energy value for playing cards."""

Power = NewType("Power", int)
"""Power value of a card."""


# =============================================================================
# Enums
# =============================================================================


class AbilityType(Enum):
    """Types of card abilities."""

    VANILLA = auto()
    """No ability."""

    ON_REVEAL = auto()
    """Triggers once when the card is revealed."""

    ONGOING = auto()
    """Continuously modifies power while in play."""


class TargetFilter(Enum):
    """Filters for targeting cards with effects."""

    SELF = auto()
    """The card itself."""

    SAME_LOCATION_FRIENDLY = auto()
    """Friendly cards at the same location (excluding self)."""

    SAME_LOCATION_ENEMY = auto()
    """Enemy cards at the same location."""

    SAME_LOCATION_ALL = auto()
    """All cards at the same location (excluding self)."""

    ALL_FRIENDLY = auto()
    """All friendly cards on the board (excluding self)."""

    ALL_ENEMY = auto()
    """All enemy cards on the board."""

    ALL_CARDS = auto()
    """All cards on the board (excluding self)."""

    OTHER_LOCATIONS_FRIENDLY = auto()
    """Friendly cards at other locations."""

    LEFTMOST_FRIENDLY = auto()
    """The leftmost friendly card on the board."""

    RIGHTMOST_FRIENDLY = auto()
    """The rightmost friendly card on the board."""

    ONE_SAME_LOCATION_FRIENDLY = auto()
    """One other friendly card at the same location (first found)."""

    ONE_SAME_LOCATION_ENEMY = auto()
    """One enemy card at the same location (first found)."""

    FRIENDLY_WITH_DESTROY_TAG = auto()
    """Friendly cards that have the 'Destroy' tag."""


class ActionType(Enum):
    """Types of player actions."""

    PLAY_CARD = auto()
    """Play a card from hand to a location."""

    PASS = auto()
    """Pass without playing a card."""


class GamePhase(Enum):
    """Phases of a game turn."""

    TURN_START = auto()
    """Beginning of turn: set energy, draw card."""

    PLANNING = auto()
    """Players submit their actions."""

    RESOLUTION = auto()
    """Actions are validated and resolved."""

    TURN_END = auto()
    """End of turn processing."""

    GAME_OVER = auto()
    """Game has ended."""


class GameResult(Enum):
    """Possible game outcomes."""

    PLAYER_0_WINS = auto()
    """Player 0 wins the game."""

    PLAYER_1_WINS = auto()
    """Player 1 wins the game."""

    DRAW = auto()
    """The game is a draw."""

    IN_PROGRESS = auto()
    """Game is still in progress."""


# =============================================================================
# Protocols
# =============================================================================


class EffectProtocol(Protocol):
    """Protocol for card effects."""

    def apply(
        self,
        state: "GameState",
        source_card: "CardInstance",
        source_player: PlayerId,
    ) -> tuple["GameState", list["GameEvent"]]:
        """
        Apply this effect to the game state.

        Args:
            state: Current game state
            source_card: The card that triggered this effect
            source_player: The player who owns the source card

        Returns:
            Tuple of (new_state, events_generated)
        """
        ...


class GameEvent(Protocol):
    """Protocol for game events (for type checking)."""

    @property
    def event_type(self) -> str:
        """The type identifier for this event."""
        ...


# =============================================================================
# Constants
# =============================================================================

MAX_TURNS: Literal[6] = 6
"""Maximum number of turns in a game."""

NUM_LOCATIONS: Literal[3] = 3
"""Number of locations (lanes) on the board."""

LOCATION_CAPACITY: Literal[4] = 4
"""Maximum cards per player per location."""

STARTING_HAND_SIZE: Literal[3] = 3
"""Number of cards drawn at game start."""

DECK_SIZE: Literal[12] = 12
"""Number of cards in each player's deck."""

NUM_PLAYERS: Literal[2] = 2
"""Number of players in a game."""


# =============================================================================
# Type Aliases
# =============================================================================

RevealOrder = Literal[0, 1]
"""Order of card reveals: 0 = P0 first, 1 = P1 first."""
