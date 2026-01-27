"""
Event types for the game engine.

Events form a typed log of everything that happens during the game.
They are designed to be consumed by UI layers for rendering animations
and game state updates.
"""

from dataclasses import dataclass

from engine.types import (
    PlayerId,
    LocationIndex,
    TurnNumber,
    InstanceId,
    Power,
    Energy,
    GameResult,
)


# =============================================================================
# Turn Events
# =============================================================================


@dataclass(frozen=True, slots=True)
class TurnStartedEvent:
    """A new turn has begun."""

    turn: TurnNumber
    """The turn number that started."""

    @property
    def event_type(self) -> str:
        return "turn_started"


@dataclass(frozen=True, slots=True)
class TurnEndedEvent:
    """A turn has ended."""

    turn: TurnNumber
    """The turn number that ended."""

    @property
    def event_type(self) -> str:
        return "turn_ended"


# =============================================================================
# Energy Events
# =============================================================================


@dataclass(frozen=True, slots=True)
class EnergySetEvent:
    """Player energy was set."""

    player_id: PlayerId
    """The player whose energy changed."""

    energy: Energy
    """The new energy value."""

    @property
    def event_type(self) -> str:
        return "energy_set"


@dataclass(frozen=True, slots=True)
class EnergySpentEvent:
    """Player spent energy."""

    player_id: PlayerId
    """The player who spent energy."""

    amount: Energy
    """The amount spent."""

    remaining: Energy
    """Remaining energy after spending."""

    @property
    def event_type(self) -> str:
        return "energy_spent"


# =============================================================================
# Card Events
# =============================================================================


@dataclass(frozen=True, slots=True)
class CardDrawnEvent:
    """A card was drawn from deck to hand."""

    player_id: PlayerId
    """The player who drew the card."""

    card_instance_id: InstanceId
    """The instance ID of the drawn card."""

    @property
    def event_type(self) -> str:
        return "card_drawn"


@dataclass(frozen=True, slots=True)
class CardPlayedEvent:
    """A card was played to a location."""

    player_id: PlayerId
    """The player who played the card."""

    card_instance_id: InstanceId
    """The instance ID of the played card."""

    location: LocationIndex
    """The location where the card was played."""

    @property
    def event_type(self) -> str:
        return "card_played"


@dataclass(frozen=True, slots=True)
class CardRevealedEvent:
    """A card was revealed at a location."""

    card_instance_id: InstanceId
    """The instance ID of the revealed card."""

    location: LocationIndex
    """The location where the card was revealed."""

    player_id: PlayerId
    """The player who owns the card."""

    @property
    def event_type(self) -> str:
        return "card_revealed"


@dataclass(frozen=True, slots=True)
class CardMovedEvent:
    """A card was moved between locations."""

    card_instance_id: InstanceId
    """The instance ID of the moved card."""

    from_location: LocationIndex
    """The location the card moved from."""

    to_location: LocationIndex
    """The location the card moved to."""

    source_card_id: InstanceId | None
    """The card that caused this move (if any)."""

    @property
    def event_type(self) -> str:
        return "card_moved"


@dataclass(frozen=True, slots=True)
class CardDestroyedEvent:
    """A card was destroyed."""

    card_instance_id: InstanceId
    """The instance ID of the destroyed card."""

    location: LocationIndex
    """The location where the card was destroyed."""

    source_card_id: InstanceId | None
    """The card that caused this destruction (if any)."""

    @property
    def event_type(self) -> str:
        return "card_destroyed"


# =============================================================================
# Power Events
# =============================================================================


@dataclass(frozen=True, slots=True)
class PowerChangedEvent:
    """A card's power was modified."""

    card_instance_id: InstanceId
    """The instance ID of the affected card."""

    old_power: Power
    """The power before the change."""

    new_power: Power
    """The power after the change."""

    source_card_id: InstanceId | None
    """The card that caused this change (if any)."""

    @property
    def event_type(self) -> str:
        return "power_changed"


# =============================================================================
# Action Events
# =============================================================================


@dataclass(frozen=True, slots=True)
class PlayerPassedEvent:
    """A player passed their turn."""

    player_id: PlayerId
    """The player who passed."""

    @property
    def event_type(self) -> str:
        return "player_passed"


@dataclass(frozen=True, slots=True)
class ActionInvalidEvent:
    """An action was invalid and rejected."""

    player_id: PlayerId
    """The player whose action was invalid."""

    reason: str
    """Explanation of why the action was invalid."""

    @property
    def event_type(self) -> str:
        return "action_invalid"


# =============================================================================
# Game Events
# =============================================================================


@dataclass(frozen=True, slots=True)
class GameStartedEvent:
    """The game has started."""

    @property
    def event_type(self) -> str:
        return "game_started"


@dataclass(frozen=True, slots=True)
class GameEndedEvent:
    """The game has ended."""

    result: GameResult
    """The final result of the game."""

    location_winners: tuple[PlayerId | None, PlayerId | None, PlayerId | None]
    """Winner of each location (None = tie)."""

    location_powers: tuple[
        tuple[Power, Power],
        tuple[Power, Power],
        tuple[Power, Power],
    ]
    """Power totals at each location: ((p0_loc0, p1_loc0), ...)."""

    total_power: tuple[Power, Power]
    """Total power across all locations for each player."""

    @property
    def event_type(self) -> str:
        return "game_ended"


# =============================================================================
# Event Union Type
# =============================================================================

GameEvent = (
    TurnStartedEvent
    | TurnEndedEvent
    | EnergySetEvent
    | EnergySpentEvent
    | CardDrawnEvent
    | CardPlayedEvent
    | CardRevealedEvent
    | CardMovedEvent
    | CardDestroyedEvent
    | PowerChangedEvent
    | PlayerPassedEvent
    | ActionInvalidEvent
    | GameStartedEvent
    | GameEndedEvent
)
